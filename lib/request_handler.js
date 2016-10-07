class RequestHandler {
  constructor(logger) {
    this._logger = logger
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