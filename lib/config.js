const fs = require('fs')
const os = require('os')
const MemoryStorageBackend = require('./memory_storage_backend.js')

const UNKNOWN_STORAGE_BACKEND = "The specified storage backend is unknown"

class Config {
  get address  () { return this._rawConfig.address || '127.0.0.1' }
  get port     () { return this._rawConfig.port || 8080 }
  get logLevel () { return this._rawConfig.logLevel || 'info' }
  get storageBackend () { return this._extractStorageBackend() }
  get slots () { return this._rawConfig.slots || os.cpus().length }
  
  constructor(pathToConfigFile) {
    this._rawConfig = pathToConfigFile ? this._loadConfig(pathToConfigFile) : {}
  }
  
  _loadConfig(pathToConfigFile) {
    return JSON.parse(fs.readFileSync(pathToConfigFile, 'utf-8'))
  }
  
  _extractStorageBackend() {
    if (this._storageBackend) return this._storageBackend
    
    this._storageBackend = (() => {
      if (!this._rawConfig.storageBackend) return new MemoryStorageBackend()

      switch (this._rawConfig.storageBackend.type) {
        case 'memory':
          return new MemoryStorageBackend()
          break
        default:
          throw new Error(`${UNKNOWN_STORAGE_BACKEND} (${this._rawConfig.storageBackend.type})`)
      }
    })()  
    
    return this._storageBackend
  }
}

module.exports = Config