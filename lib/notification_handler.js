const request = require('request')

const INVALID_ENDPOINTS = "The endpoints for callback are not valid. Should be an array of http(s) URLs."
const INVALID_PAYLOAD = "The payload for notifications should be an object."

class NotificationHandler {
  static notify(endpoints, payload, logger) {
    if (!Array.isArray(endpoints))   return Promise.reject(new Error(INVALID_ENDPOINTS))
    if (typeof payload !== 'object') return Promise.reject(new Error(INVALID_PAYLOAD))
    
    for (let endpoint of endpoints) {
      if (typeof endpoint !== 'string') {
        logger.warn({context: {endpoint: endpoint}}, "Skipping invalid endpoint for callback. Should be a string.")
        continue
      }
      
      NotificationHandler._sendPayload(endpoint, payload, logger)
    }
    
    return Promise.resolve()
  }
  
  static _sendPayload(endpoint, payload, logger) {
    let notificationTimestamp = new Date().getTime()
    let requestParameters = {
      method: 'PUT',
      uri: endpoint,
      headers: {
        'x-codem-notify-timestamp': notificationTimestamp
      },
      json: true,
      body: payload
    }
    
    request(requestParameters, (error, response, body) => {
      if (error) {
        logger.warn({context: {endpoint: endpoint, error: error}}, "Delivery of notification failed.")
        return
      }
      
      logger.info({context: {endpoint: endpoint, statusCode: response.statusCode}}, "Delivery of notification complete.")
    })
  }
}

module.exports = NotificationHandler