const Restify = require('restify')
const RequestHandler = require('./request_handler.js')

class Server {
  constructor(port, address, logger, storageBackend, slots) {
    this._logger = logger
    this._requestHandler = new RequestHandler(logger, storageBackend, slots)
    this._createServer(port, address)
    this._addRoutes()
    this._logger.info(`Started server on interface ${address} port ${port}.`)
  }
  
  _addRoutes() {
    this._server.post('/jobs',    (...args) => this._requestHandler.createJob(...args))
    this._server.get('/jobs',     (...args) => this._requestHandler.getAllJobs(...args))
    this._server.get('/jobs/:id', (...args) => this._requestHandler.getJob(...args))
    this._server.del('/jobs/:id', (...args) => this._requestHandler.cancelJob(...args))
  }
  
  _createServer(port, address) {
    this._server = Restify.createServer()
    this._server.pre(Restify.pre.sanitizePath())
    this._server.listen(port, address)
  }
}

module.exports = Server