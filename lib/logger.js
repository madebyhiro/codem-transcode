var buffer = [],
    timer  = null;

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

var isWorking = true;

var Logger = function() {
}

setupTimer = function() {
  // Set interval to flush buffer every 250ms
  setInterval(function() {
    if (buffer.length) {
      Logger.flush();
    }
  }, 250);
}

intPad = function(n) {
  return (n < 10 ? "0" + n.toString(10) : n.toString(10));
}

timestamp = function() {
  var d = new Date();
  var time = [intPad(d.getHours()), intPad(d.getMinutes()), intPad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

Logger.log = function(string) {
  if (timer == null) {
    setupTimer();
  }
  
  buffer.push(timestamp() + " - " + string);
}

Logger.isWorking = function() {
  return isWorking;
}

Logger.flush = function() {
  try {
    process.stdout.write(buffer.join("\n") + "\n");
    buffer.length = 0;
    isWorking = true;
  } catch(err) {
    // Unable to write to stdout due to possible stream errors
    isWorking = false;
  }
}

Logger.stop = function() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}
module.exports = Logger;