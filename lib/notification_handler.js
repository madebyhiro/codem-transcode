const request = require('request')

const INVALID_ENDPOINTS = "The endpoints for callback are not valid. Should be an array of http(s) URLs."
const INVALID_PAYLOAD = "The payload for notifications should be an object."

class NotificationHandler {
  static notify(endpoints, payload) {
    if (!Array.isArray(endpoints))   return Promise.reject(new Error(INVALID_ENDPOINTS))
    if (typeof payload !== 'object') return Promise.reject(new Error(INVALID_PAYLOAD))
      
    return Promise.resolve()
  }
}

module.exports = NotificationHandler