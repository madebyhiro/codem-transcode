const fs = require('fs')

class Config {
  constructor(pathToConfigFile) {
    if (pathToConfigFile) this._loadConfig(pathToConfigFile)
  }
  
  _loadConfig(pathToConfigFile) {
    this._rawConfig = JSON.parse(fs.readFileSync(pathToConfigFile, 'utf-8'))
  }
}

module.exports = Config