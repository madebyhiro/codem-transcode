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
  get progress () { return (typeof this._progress === 'undefined') ? null : this._progress }
  set progress (progress) {
    if (typeof progress !== 'number') return
    
    this._progress = Math.min(1.0, progress)
  }
  get attributes () { return this._attributes || new Map() }
  set attributes (attributes) { this._attributes = attributes }
  get message () { return this._message || null }
  set message (message) { this._message = message }
  get state () { return this._state }
  get asJSON () {
    return {
      id: this.id,
      message: this.message,
      options: this.options,
      progress: this.progress,
      state: this.state,
      attributes: [...this.attributes]
    }
  }
  get callbackURLs () { return this._callbackURLs || [] }
  
  static build(params) {
    let job = new Job()
    job._id = Job._generateID()
    job._options = params.options
    job._callbackURLs = params.callbackURLs
    job._state = STATUS_CODES.PENDING
    return job
  }
  
  static _generateID() {
    let hash = crypto.createHash('sha1')
    let date = new Date()
    hash.update([date, Math.random()].join(''))

    return hash.digest('hex')
  }
  
  setFailed() {
    this._state = STATUS_CODES.FAILED
  }
  
  setProcessing() {
    if (this._state == STATUS_CODES.PROCESSING) return
      
    this._state = STATUS_CODES.PROCESSING
    if (this.progress === null) this.progress = 0.0
  }
  
  setSuccess() {
    this._state = STATUS_CODES.SUCCESS
  }
}

module.exports = Job