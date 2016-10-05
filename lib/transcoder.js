const Server = require('./server.js')

class Transcoder {
  constructor(config) {
    this._config = config
  }
  
  boot() {
    this._server = new Server(this._config.port, this._config.address)
  }
}

module.exports = Transcoder