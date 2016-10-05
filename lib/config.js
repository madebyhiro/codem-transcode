const fs = require('fs')

class Config {
  get address () { return this._rawConfig.address || '127.0.0.1' }
  get port    () { return this._rawConfig.port || 8080 }
  
  constructor(pathToConfigFile) {
    if (pathToConfigFile) {
      this._loadConfig(pathToConfigFile)
    } else {
      this._rawConfig = {}
    }
  }
  
  _loadConfig(pathToConfigFile) {
    this._rawConfig = JSON.parse(fs.readFileSync(pathToConfigFile, 'utf-8'))
  }
}

module.exports = Config