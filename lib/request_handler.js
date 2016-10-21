const Errors = require('restify').errors
const Job = require('./job.js')

const TRANSCODER_MAX_CAPACITY = "All encoding slots are in use"
const JOB_NOT_FOUND           = "The specified job could not be found"
const NO_OPTIONS_SPECIFIED    = "No options where found for the job, please supply an options object"

class RequestHandler {
  constructor(logger, storageBackend, totalAvailableSlots, JobProcessor) {
    this._logger = logger
    this._storageBackend = storageBackend
    this._totalAvailableSlots = totalAvailableSlots
    this._JobProcessor = JobProcessor
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
    this._storageBackend.getAll().then(
      (jobs) => {
        const responseContent = {
          totalSlots: this._totalAvailableSlots,
          freeSlots: this._totalAvailableSlots - jobs.length,
          jobs: jobs
        }
        response.send(responseContent)
        next()
      },
      next
    )
  }
  
  getJob(request, response, next) {
    this._storageBackend.get(request.params.id).then(
      (job) => {
        if (typeof job === 'undefined') {
          next(new Errors.NotFoundError(JOB_NOT_FOUND))
          return
        }
        response.send(job)
        next()
      },
      next
    )
  }
  
  cancelJob(request, response, next) {
    response.send(501)    
    next()
  }
  
  _buildJob(options) {
    if (typeof options === 'undefined') {
      return Promise.reject(new Error(NO_OPTIONS_SPECIFIED))
    }
    
    let job = Job.build(options)
    return Promise.resolve(job)
  }
  
  _exitHandler(jobID, code, signal) {
    this._logger.info(`Job ${jobID} finished with exit code ${code}.`)

    let success = (code == 0)
    this._storageBackend.get(jobID).then(
      (job) => {
        if (job.isProcessing) {
          if (success) {
            job.setSuccess()
            job.progress = 1.0
          } else {
            job.setFailed()
          }
          this._storageBackend.update(job)
        }
      }
    ).catch(
      err => this._logger.warn(`Attempting to update exit status for job ${jobID} failed. Possible reason: ${err || 'unknown'}`)
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
      err => this._logger.warn(`Attempting to update progress on job ${jobID} failed. Possible reason: ${err || 'unknown'}`)
    )
  }
  
  _sendCreatedResponse(response) {
    try {
      response.send(201)
      return Promise.resolve()
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
    jobProcessor.on('exit',     (code, signal) => { this._exitHandler(job.id, code, signal) })
    jobProcessor.spawn()
    jobProcessor.jobID = job.id
    
    this._logger.info(`Job ${job.id} accepted with options ${JSON.stringify(job.options)}`)
    
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