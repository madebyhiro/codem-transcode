const Restify = require('restify')

class RequestHandler {
  constructor(logger, storageBackend, totalAvailableSlots, JobProcessor) {
    this._logger = logger
    this._storageBackend = storageBackend
    this._totalAvailableSlots = totalAvailableSlots
    this._JobProcessor = JobProcessor
  }
  
  createJob(request, response, next) {
    response.send(501)    
    next()
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
          next(new Restify.errors.NotFoundError("The specified job could not be found"))
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