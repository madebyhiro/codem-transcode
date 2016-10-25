const Errors = require('restify').errors
const Job = require('./job.js')

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
    this._processors = {}
  }
  
  createJob(request, response, next) {
    this._verifySlotAvailable()
      .then(()  => this._buildJob(request.params.options))
      .then(job => this._storageBackend.create(job))
      .then(job => this._spawnJob(job))
      .then(()  => this._sendCreatedResponse(response))
      .then(next, next)
  }
  
  getAllJobs(request, response, next) {
    this._storageBackend.getAll()
      .then(jobs => this._sendAllResponse(jobs, response))
      .then(next, next)
  }
  
  getJob(request, response, next) {
    this._storageBackend.get(request.params.id)
      .then(job => this._sendGetJobResponse(job, response))
      .then(next, next)
  }
  
  cancelJob(request, response, next) {
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
    let processor = this._processors[job.id]
    
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
  
  _exitHandler(processor, jobID, code, signal) {
    let success = (code == 0)
    let message = success ? "Job finished succesfully." : "Job failed processing."
    this._logger.info({context: {exitCode: code, id: jobID}}, message)

    this._storageBackend.get(jobID).then(
      (job) => {
        if (job.isProcessing) {
          if (success) {
            job.setSuccess()
            job.message = message
            job.progress = 1.0
          } else {
            job.message = processor.output.trim().split("\n").pop()
            job.setFailed()
          }
          this._storageBackend.update(job)
        }
        delete this._processors[jobID]
      }
    ).catch(
      err => this._logger.warn({context: {id: jobID, error: (err || 'unknown')}}, "Updating exit status failed.")
    )
  }
  
  _progressHandler(jobID, progress) {
    this._storageBackend.get(jobID).then(
      (job) => {
        if (job.isPending || job.isProcessing) {
          job.setProcessing()
          job.progress = progress
          this._storageBackend.update(job)
        }
      }
    ).catch(
      err => this._logger.warn({context: {id: jobID, error: (err || 'unknown')}}, "Updating progress failed.")
    )
  }
  
  _sendAllResponse(jobs, response) {
    try {
      const responseContent = {
        totalSlots: this._totalAvailableSlots,
        freeSlots: this._totalAvailableSlots - jobs.length,
        jobs: jobs
      }
      response.send(responseContent)
      return Promise.resolve()
    } catch(err) {
      return Promise.reject(err)
    }
  }
  
  _sendCreatedResponse(response) {
    try {
      response.send(201)
      return Promise.resolve()
    } catch(err) {
      return Promise.reject(err)
    }    
  }
  
  _sendDeletedResponse(job, response) {
    try {
      response.send(job)
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
        response.send(job)
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

    jobProcessor.on('progress', (progress)     => { this._progressHandler(job.id, progress) })
    jobProcessor.on('error',    (err)          => { this._logger.warn(err) })
    jobProcessor.on('exit',     (code, signal) => { this._exitHandler(jobProcessor, job.id, code, signal) })
    jobProcessor.spawn()
    
    this._processors[job.id] = jobProcessor
    
    this._logger.info({context: {id: job.id, options: job.options}}, "Job accepted.")
    
    job.setProcessing()
    return this._storageBackend.update(job)
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