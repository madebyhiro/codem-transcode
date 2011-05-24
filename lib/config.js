var os = require('os'),
    opts = require('argsparser').parse(),
    fs = require('fs'),
    util = require('util');

var config = {
  port:        8080,
  access_log:  '/var/log/access_log',
  database:    '/var/db/jobs.db',
  slots:       os.cpus().length,
  interface:   "127.0.0.1",
  encoder:     "ffmpeg",
  scratch_dir: "/tmp"
};

var loaded_config = null;

exports.load = function() {
  if (opts['-c'] && !loaded_config) {
    try {
      loaded_config = eval('(' + fs.readFileSync(opts['-c'], 'utf8') + ')');
      merge(config, loaded_config);
    } catch(err) {
      util.log('Error reading config from ' + opts['-c']);
      util.log(err);
      process.exit(1);
    }
  }
  return config;    
}

merge = function(obj1,obj2) {
  for (key in obj2) {
    obj1[key] = obj2[key];
  }
}