const Restify = require('restify')
const RequestHandler = require('./request_handler.js')

class Server {
  constructor(port, address, logger) {
    this._logger = logger
    this._requestHandler = new RequestHandler(logger)
    this._createServer(port, address)
    this._addRoutes()
    this._logger.info(`Started server on interface ${address} port ${port}.`)
  }
  
  _addRoutes() {
    this._server.post('/jobs',    (req, res, next) => this._requestHandler.handler(req, res, next))
    this._server.get('/jobs',     (req, res, next) => this._requestHandler.handler(req, res, next))
    this._server.get('/jobs/:id', (req, res, next) => this._requestHandler.handler(req, res, next))
    this._server.del('/jobs/:id', (req, res, next) => this._requestHandler.handler(req, res, next))
    this._server.post('/probe',   (req, res, next) => this._requestHandler.handler(req, res, next))
  }
  
  _createServer(port, address) {
    this._server = Restify.createServer()
    this._server.listen(port, address)
  }
}

module.exports = Server