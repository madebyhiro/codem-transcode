const Errors = require('restify').errors
const Job = require('./job.js')
const NotificationHandler = require('./notification_handler.js')

const TRANSCODER_MAX_CAPACITY = "All encoding slots are in use"
const JOB_NOT_FOUND           = "The specified job could not be found"
const NO_OPTIONS_SPECIFIED    = "No options where found for the job, please supply an options object"
const NO_PROCESSOR_FOUND      = "Unable to cancel job, no job processor found"

class RequestHandler {
  constructor(logger, storageBackend, totalAvailableSlots, JobProcessor) {
    this._logger = logger
    this._storageBackend = storageBackend
    this._totalAvailableSlots = totalAvailableSlots
    this._JobProcessor = JobProcessor
    this._processors = new Map()
  }
  
  createJob(request, response, next) {
    this._logger.debug({req: request}, "Create job (POST /jobs)")
    this._verifySlotAvailable()
      .then(()  => this._buildJob(request.params))
      .then(job => this._storageBackend.create(job))
      .then(job => this._spawnJob(job))
      .then(job => this._sendCreatedResponse(job, response))
      .then(next, next)
  }
  
  getAllJobs(request, response, next) {
    this._logger.debug({req: request}, "Get all jobs (GET /jobs)")
    this._storageBackend.getAll()
      .then(jobs => this._sendAllResponse(jobs, response))
      .then(next, next)
  }
  
  getJob(request, response, next) {
    this._logger.debug({req: request}, "Get job (GET /jobs/:id)")
    this._storageBackend.get(request.params.id)
      .then(job => this._sendGetJobResponse(job, response))
      .then(next, next)
  }
  
  cancelJob(request, response, next) {
    this._logger.debug({req: request}, "Cancel job (DELETE /jobs/:id)")
    this._storageBackend.get(request.params.id)
      .then(job => this._cancelJob(job))
      .then(job => this._sendDeletedResponse(job, response))
      .then(next, next)
  }
  
  _buildJob(options) {
    if (typeof options === 'undefined') {
      return Promise.reject(new Error(NO_OPTIONS_SPECIFIED))
    }
    
    let job = Job.build(options)
    return Promise.resolve(job)
  }
  
  _cancelJob(job) {
    let processor = this._processors.get(job.id)
    
    if (typeof processor === 'undefined') {
      return Promise.reject(new Error(NO_PROCESSOR_FOUND))
    }
    
    try {
      processor.cancel()      
    } catch(err) {
      return Promise.reject(err)
    }
    
    return Promise.resolve(job)
  }
  
  _exitHandler(jobID, code, signal) {
    let success = (code == 0)
    let message = success ? "Job finished succesfully." : "Job failed processing."
    this._logger.info({context: {exitCode: code, id: jobID}}, message)

    this._storageBackend.get(jobID)
      .then(job => this._finalizeJobStatus(job, success, message))
      .then(job => NotificationHandler.notify(job.callbackURLs, job.asJSON, this._logger))
      .catch(err => this._logger.warn({context: {id: jobID, error: (err || 'unknown')}}, "Error in exit handler."))
  }
  
  _finalizeJobStatus(job, success, message) {
    if (success) {
      job.message = message
      job.progress = 1.0
      job.setSuccess()
    } else {
      job.message = processor.output.trim().split("\n").pop()
      job.setFailed()
    }

    this._processors.delete(job.id)
    return this._storageBackend.update(job)
  }
  
  _processLogMessage(jobID, level, message) {
    if (!['error', 'warn', 'info', 'debug', 'trace'].includes(level)) {
      this._logger.warn({context: {id: jobID, invalidLevel: level, message: message}}, "Invalid log level received from processor backend.")
      return
    }
    this._logger[level].call(this, {context: {id: jobID}}, message)
  }
  
  _progressHandler(jobID, progress) {
    this._storageBackend.get(jobID)
      .then(job => this._updateProgress(job, progress))
      .catch(err => this._logger.warn({context: {id: jobID, error: (err || 'unknown')}}, "Updating progress failed."))
  }
  
  _sendAllResponse(jobs, response) {
    try {
      const responseContent = {
        totalSlots: this._totalAvailableSlots,
        freeSlots: this._totalAvailableSlots - jobs.length,
        jobs: jobs.map(j => j.asJSON)
      }
      response.send(responseContent)
      return Promise.resolve()
    } catch(err) {
      return Promise.reject(err)
    }
  }
  
  _sendCreatedResponse(job, response) {
    try {
      response.setHeader('Location', `/jobs/${job.id}`)
      response.send(201, job.asJSON)
      return Promise.resolve()
    } catch(err) {
      return Promise.reject(err)
    }    
  }
  
  _sendDeletedResponse(job, response) {
    try {
      response.send(job.asJSON)
      return Promise.resolve()
    } catch(err) {
      return Promise.reject(err)
    }
  }
  
  _sendGetJobResponse(job, response) {
      if (typeof job === 'undefined') {
        return Promise.reject(new Errors.NotFoundError(JOB_NOT_FOUND))
      }
      
      try {
        response.send(job.asJSON)
      } catch(err) {
        return Promise.reject(err)
      }
  }
  
  _spawnJob(job) {
    try {
      var jobProcessor = new this._JobProcessor(job.options)
    } catch(err) {
      return Promise.reject(err)
    }

    jobProcessor.on('progress', (progress)       => { this._progressHandler(job.id, progress) })
    jobProcessor.on('log',      (level, message) => { this._processLogMessage(job.id, level, message) })
    jobProcessor.on('error',    (err)            => { this._logger.warn(err) })
    jobProcessor.on('exit',     (code, signal)   => { this._exitHandler(job.id, code, signal) })
    jobProcessor.spawn()
    
    this._processors.set(job.id, jobProcessor)
    
    this._logger.info({context: {id: job.id, options: job.options}}, "Job accepted.")
    
    job.setProcessing()
    return this._storageBackend.update(job)
  }
  
  _updateProgress(job, progress) {
    if (job.isPending || job.isProcessing) {
      job.setProcessing()
      job.progress = progress
      job.attributes = this._processors.get(job.id).attributes
      return this._storageBackend.update(job)
    }
    return Promise.resolve()
  }
  
  _verifySlotAvailable() {
    return this._storageBackend.activeJobsCount.then((activeJobsCount) => {
      if (activeJobsCount >= this._totalAvailableSlots) {
        return Promise.reject(new Errors.ServiceUnavailableError(TRANSCODER_MAX_CAPACITY))
      } else {
        return Promise.resolve()
      }
    })
  }
}

module.exports = RequestHandler