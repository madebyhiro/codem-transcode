const Job = require('./job.js')
const LRUCache = require('./lru.js')
const StorageBackend = require('./storage_backend.js')

class MemoryStorageBackend extends StorageBackend {
  constructor() {
    super()
    this._cache = new LRUCache(500)
  }
  
  getAll() {
    return new Promise(function(resolve, reject) {
      reject(new Error("Not implemented"))
    })
  }
}

module.exports = MemoryStorageBackend