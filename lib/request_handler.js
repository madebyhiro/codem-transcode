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
          totalSlots: this._slots,
          freeSlots: this._slots - jobs.length,
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

    jobProcessor.on('progress', (progress)     => { console.log(progress) })
    jobProcessor.on('error',    (err)          => { console.log(err) })
    jobProcessor.on('exit',     (code, signal) => { console.log(code, signal) })
    jobProcessor.spawn()
    jobProcessor.jobID = job.id
    
    job.setIsProcessing()
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