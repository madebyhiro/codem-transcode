var fs = require('fs'),
    logger = require('./logger');

var stream = null;
var path = null;
var opts = null;

var RecoverableStream = function(streamPath, streamOpts) {
  path = streamPath;
  opts = streamOpts;
  reopen();
  
  return this;
}

RecoverableStream.prototype.write = function(string) {
  stream.write(string);
}

reopen = function() {
  stream = fs.createWriteStream(path, opts);
  stream.on('error', function(err) { logger.log('Error while logging to access_log. ' + err); stream.end(); stream.destroy(); reopen(); });
}

module.exports = RecoverableStream;