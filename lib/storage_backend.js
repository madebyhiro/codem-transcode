const NOT_IMPLEMENTED_MESSAGE = "Please implement this in a subclass"

class StorageBackend {
  get activeJobsCount () {
    return this.getAll().then(
      (jobs) => { return jobs.length }
    )
  }

  get(id) {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  getAll() {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  create(job) {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  update(job) {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  purge() {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
}

module.exports = StorageBackend