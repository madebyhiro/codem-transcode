const crypto = require('crypto')

const STATUS_CODES = {
  SUCCESS: "success",
  FAILED: "failed",
  PROCESSING: "processing",
  PENDING: "pending"
}

const ARGUMENT_ERROR = "The specified job options is not a valid object."

class Job {
  get id () { return this._id }
  get isProcessing () { return this._state == STATUS_CODES.PROCESSING }
  get options () { return this._options }
  
  static build(options) {
    if (typeof options !== 'object') throw new Error(ARGUMENT_ERROR)
      
    let job = new Job()
    job._id = Job._generateID()
    job._options = options
    job._state = STATUS_CODES.PENDING
    return job
  }
  
  static _generateID() {
    let hash = crypto.createHash('sha1')
    let date = new Date()
    hash.update([date, Math.random()].join(''))

    return hash.digest('hex')
  }
}

module.exports = Job