const Server = require('./server.js')

class Transcoder {
  constructor(config, logger) {
    this._config = config
    this._logger = logger
  }
  
  boot() {
    this._server = new Server(this._config.port, this._config.address, this._logger, this._config.storageBackend, this._config.slots, this._config.processorBackends)
  }
}

module.exports = Transcoder