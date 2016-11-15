class Utils {
  static mapAsJSON(map) {
    let obj = {}
    for (let [k,v] of map) {
      obj[k] = v
    }
    return obj
  }
  
  static objectEntries(obj) {
    return Object.keys(obj).map(k => [k, obj[k]])
  }
}

module.exports = Utils