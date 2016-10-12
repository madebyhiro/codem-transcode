const Job = require('./job.js')
const LRUCache = require('./lru.js')
const StorageBackend = require('./storage_backend.js')

class MemoryStorageBackend extends StorageBackend {
  constructor() {
    super()
    this._cache = new LRUCache(500)
  }
  
  getAll() {
    return new Promise((resolve, reject) => {
      let processingJobs = []
      this._cache.forEach((key, value, cache) => {
        if (value.isProcessing) processingJobs.push(value)
      }, this, true)
      resolve(processingJobs)
    })
  }
}

module.exports = MemoryStorageBackend