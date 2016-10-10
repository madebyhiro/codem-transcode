const StorageBackend = require('./storage_backend')

class MemoryStorageBackend extends StorageBackend {
  getAll() {
    return new Promise(function(resolve, reject) {
      reject(new Error("Not implemented"))
    })
  }
}

module.exports = MemoryStorageBackend