var os            = require('os'),
    config        = require('./config').load(),
    child_process = require('child_process');

exports.doProbe = function(postData, callback) {
  try {
    var obj = JSON.parse(postData);
  } catch(e) {
    callback("HTTP POST data contains no valid JSON object.", null);
    return;
  }

  var source_file = obj['source_file'];
  
  if (source_file) {
    var the_process = child_process.execFile(
      config['ffprobe'],
      ['-print_format', 'json', '-show_format', '-show_streams', source_file],
      function didFinishProbing(error, stdout, stderr) {
        if (error) {
          var lastMsg = error.message.trim().split("\n").pop();
          callback(lastMsg, null);
        } else {
          try {
            var probe = JSON.parse(stdout);
            callback(null, probe);
          } catch(e) {
            callback("Error while parsing ffprobe JSON output.", null);
          }
        }
      }
    );    
  } else {
    callback("No source file was specified to probe.", null);
  }
}