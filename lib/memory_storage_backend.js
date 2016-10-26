const LRUCache = require('./lru.js')
const StorageBackend = require('./storage_backend.js')

const JOB_NOT_FOUND = "The storage backend does not contain the specified job."
const JOB_ALREADY_EXISTS = "The job could not be created because a job with that ID already exists"

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
    if (this._contains(job)) return Promise.reject(new Error(JOB_ALREADY_EXISTS))

    this._cache.set(job.id, job)
    return Promise.resolve(job)
  }
  
  update(job) {
    if (!this._contains(job)) return Promise.reject(new Error(JOB_NOT_FOUND))
    
    this._cache.set(job.id, job)
    return Promise.resolve(job)
  }
  
  purge() {
    return Promise.resolve()
  }
  
  _contains(job) {
    return typeof this._cache.get(job.id) !== 'undefined'
  }
}

module.exports = MemoryStorageBackend