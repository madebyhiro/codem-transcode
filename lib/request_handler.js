const Restify = require('restify')

class RequestHandler {
  constructor(logger, storageBackend, slots) {
    this._logger = logger
    this._storageBackend = storageBackend
    this._slots = slots
  }
  
  createJob(request, response, next) {
    response.send(501)    
    next()
  }
  
  getAllJobs(request, response, next) {
    this._storageBackend.getAll().then(
      function(jobs) {
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
    response.send(501)    
    next()
  }
  
  cancelJob(request, response, next) {
    response.send(501)    
    next()
  }
}

module.exports = RequestHandler