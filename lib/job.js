const PROCESSING = Symbol('processing')
const SUCCESS    = Symbol('success')
const FAILED     = Symbol('failed')

class Job {
  get status () { return this._status }
}

module.exports = Job