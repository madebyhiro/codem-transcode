const NOT_IMPLEMENTED_MESSAGE = "Please implement this in a subclass"

class StorageBackend {
  get(id) {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  getAll() {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  create(job) {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  delete(id) {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  update(job) {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
  
  purge() {
    throw new Error(NOT_IMPLEMENTED_MESSAGE)
  }
}