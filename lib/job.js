const STATUS_CODES = {
  SUCCESS: "success",
  FAILED: "failed",
  PROCESSING: "processing"
}

class Job {
  get id () { return this._id }
  get isProcessing () { return this._state == STATUS_CODES.PROCESSING }
}

module.exports = Job