const Restify = require('restify')

class RequestHandler {
  constructor(logger, storageBackend) {
    this._logger = logger
    this._storageBackend = storageBackend
  }
  
  createJob(request, response, next) {
    response.send(501)    
    return next()
  }
  
  getAllJobs(request, response, next) {
    response.send(501)    
    return next()    
  }
  
  getJob(request, response, next) {
    response.send(501)    
    return next()
  }
  
  cancelJob(request, response, next) {
    response.send(501)    
    return next()
  }
}

module.exports = RequestHandler