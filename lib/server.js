const Restify = require('restify')

class Server {
  constructor(port, address, logger) {
    this._logger = logger
    this._createServer(port, address)
    this._addRoutes()
    
    this._logger.info(`Started server on interface ${address} port ${port}.`)
  }
  
  _addRoutes() {
    this._server.post('/jobs',    (req, res, next) => { this._handler(req, res, next) })
    this._server.get('/jobs',     (req, res, next) => { this._handler(req, res, next) })
    this._server.get('/jobs/:id', (req, res, next) => { this._handler(req, res, next) })
    this._server.del('/jobs/:id', (req, res, next) => { this._handler(req, res, next) })
    this._server.post('/probe',   (req, res, next) => { this._handler(req, res, next) })
  }
  
  _createServer(port, address) {
    this._server = Restify.createServer()
    this._server.listen(port, address)
  }
  
  _handler(request, response, next) {
    this._logger.info(request)
    response.send(501)
    return next()
  }
}

module.exports = Server