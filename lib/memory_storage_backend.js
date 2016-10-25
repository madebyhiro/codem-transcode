const LRUCache = require('./lru.js')
const StorageBackend = require('./storage_backend.js')

class MemoryStorageBackend extends StorageBackend {
  constructor() {
    super()
    this._cache = new LRUCache(500)
  }
  
  get(id) {
    return Promise.resolve(this._cache.get(id))
  }
  
  getAll() {
    let processingJobs = []
    this._cache.forEach((key, value, cache) => {
      if (value.isProcessing) processingJobs.push(value)
    }, this, true)
    return Promise.resolve(processingJobs)
  }
  
  create(job) {
    return this._createOrUpdate(job)
  }
  
  delete(id) {
    return Promise.resolve(this._cache.remove(id))
  }

  update(job) {
    return this._createOrUpdate(job)
  }
  
  purge() {
    return Promise.resolve()
  }
  
  _createOrUpdate(job) {
    this._cache.set(job.id, job)
    return Promise.resolve(job)
  }
}

module.exports = MemoryStorageBackend