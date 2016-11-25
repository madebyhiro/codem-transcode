const fs = require('fs')
const os = require('os')
const MemoryStorageBackend = require('./memory_storage_backend.js')
const Utils = require('./utils.js')

const UNKNOWN_STORAGE_BACKEND = "The specified storage backend is unknown"

class Config {
  get address  () { return this._rawConfig.address || '127.0.0.1' }
  get port     () { return this._rawConfig.port || 8080 }
  get logLevel () { return this._rawConfig.logLevel || 'info' }
  get logStream () { return this._buildLogStream() }
  get storageBackend () { return this._extractStorageBackend() }
  get slots () { return this._rawConfig.slots || os.cpus().length }
  get processorBackends () { return this._extractProcessorBackends() }
  
  constructor(pathToConfigFile) {
    this._rawConfig = pathToConfigFile ? this._loadConfig(pathToConfigFile) : {}
  }
  
  _loadConfig(pathToConfigFile) {
    return JSON.parse(fs.readFileSync(pathToConfigFile, 'utf-8'))
  }
  
  _buildLogStream() {
    if (!this._rawConfig.logFile) { return { level: this.logLevel, stream: process.stdout } }
    
    return { level: this.logLevel, path: this._rawConfig.logFile }
  }
  
  _buildProcessorBackends() {
    if (!this._rawConfig.processorBackends) {
      let backend = require('codem-ffmpeg')
      let map = new Map()
      map.set('codem-ffmpeg', backend)
      return map
    }
    
    let backends = new Map()
    this._rawConfig.processorBackends.forEach((backend) => {
      let processorBackend = require(backend.type)
      processorBackend.config = new Map(Utils.objectEntries(backend.config))
      backends.set(backend.type, processorBackend)
    })
    return backends
  }
  
  _buildStorageBackend() {
    if (!this._rawConfig.storageBackend) return new MemoryStorageBackend()

    switch (this._rawConfig.storageBackend.type) {
      case 'memory':
        return new MemoryStorageBackend()
        break
      default:
        throw new Error(`${UNKNOWN_STORAGE_BACKEND} (${this._rawConfig.storageBackend.type})`)
    }    
  }
  
  _extractProcessorBackends() {
    if (this._processorBackends) return this._processorBackends
      
    this._processorBackends = this._buildProcessorBackends()
    return this._processorBackends
  }
  
  _extractStorageBackend() {
    if (this._storageBackend) return this._storageBackend
    
    this._storageBackend = this._buildStorageBackend()
    return this._storageBackend
  }
}

module.exports = Config