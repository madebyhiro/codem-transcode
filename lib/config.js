const fs = require('fs')
const os = require('os')
const MemoryStorageBackend = require('./memory_storage_backend')

const UNKNOWN_STORAGE_BACKEND = "The specified storage backend is unknown"

class Config {
  get address  () { return this._rawConfig.address || '127.0.0.1' }
  get port     () { return this._rawConfig.port || 8080 }
  get logLevel () { return this._rawConfig.logLevel || 'info' }
  get storageBackend () { return this._extractStorageBackend() }
  get slots () { return this._rawConfig.slots || os.cpus().length }
  
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
  
  _extractStorageBackend() {
    if (this._storageBackend) return this._storageBackend
      
    if (this._rawConfig.storageBackend) {
      switch (this._rawConfig.storageBackend.type) {
      case 'memory':
        this._storageBackend = new MemoryStorageBackend()
        break
      default:
        throw new Error(`${UNKNOWN_STORAGE_BACKEND} (${this._rawConfig.storageBackend.type})`)
      }
    } else {
      this._storageBackend = new MemoryStorageBackend()
    }
    
    return this._storageBackend
  }
}

module.exports = Config