var os            = require('os'),
    util          = require('util'),
    config        = require('./config').load(),
    child_process = require('child_process');

var slots = [];

exports.doProbe = function(postData, callback) {
  try {
    var obj = JSON.parse(postData);
  } catch(e) {
    callback(new Error("HTTP POST data contains no valid JSON object."), null, null);
    return;
  }

  var source_file = obj['source_file'];
  
  if (source_file) {
    var the_process = child_process.exec(
      config['ffprobe'] + ' -print_format json -show_format -show_streams ' + source_file,
      callback
    );    
  } else {
    callback(new Error("No source file was specified to probe."), null, null);
  }
}