const Restify = require('restify')

class Server {
  constructor(port, address) {
    this._createServer(port, address)
    this._addRoutes()
    
    console.log(`Started server on interface ${address} port ${port} with pid ${process.pid}.`)
  }
  
  _addRoutes() {
    this._server.post('/jobs',    this._handler)
    this._server.get('/jobs',     this._handler)
    this._server.get('/jobs/:id', this._handler)
    this._server.del('/jobs/:id', this._handler)
    this._server.post('/probe',   this._handler)
  }
  
  _createServer(port, address) {
    this._server = Restify.createServer()
    this._server.listen(port, address)
  }
  
  _handler(request, response, next) {
    console.log(request)
    response.send(501)
    return next()
  }
}

module.exports = Server