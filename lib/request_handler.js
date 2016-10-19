const Errors = require('restify').errors
const Job = require('./job.js')

const TRANSCODER_MAX_CAPACITY = "All encoding slots are in use"
const JOB_NOT_FOUND           = "The specified job could not be found"

class RequestHandler {
  constructor(logger, storageBackend, totalAvailableSlots, JobProcessor) {
    this._logger = logger
    this._storageBackend = storageBackend
    this._totalAvailableSlots = totalAvailableSlots
    this._JobProcessor = JobProcessor
  }
  
  createJob(request, response, next) {
    this._storageBackend.activeJobsCount.then(
      (activeJobsCount) => {
        if (activeJobsCount >= this._totalAvailableSlots) {
          next(new Errors.ServiceUnavailableError(TRANSCODER_MAX_CAPACITY))
          return
        }

        try {
          var job = Job.build(request.params)
        } catch(err) {
          next(err)
          return
        }
        
        this._storageBackend.create(job).then(
          () => {
            response.send(200)
            next()
          },
          next
        )
      },
      next
    )
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
}

module.exports = RequestHandler