const STATUS_CODES = {
  SUCCESS: "success",
  FAILED: "failed",
  PROCESSING: "processing"
}

class Job {
  get isProcessing () { return this._status == STATUS_CODES.PROCESSING }
}

module.exports = Job