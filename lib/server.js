const Restify = require('restify')

class Server {
  constructor(port, address) {
    this._server = Restify.createServer()
    this._server.listen(port, address)
    
    console.log(`Started server on interface ${address} port ${port} with pid ${process.pid}.`)
  }
}

module.exports = Server