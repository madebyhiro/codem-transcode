class Utils {
  static mapAsJSON(map) {
    let obj = {}
    for (let [k,v] of map) {
      obj[k] = v
    }
    return obj
  }
}

module.exports = Utils