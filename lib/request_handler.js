class RequestHandler {
  constructor(logger) {
    this._logger = logger
  }
  
  handler(request, response, next) {
    response.send(501)
    this._logger.debug({req: request, res: response})
    return next()
  }
}

module.exports = RequestHandler