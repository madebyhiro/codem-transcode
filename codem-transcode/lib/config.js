var os     = require('os'),
    opts   = require('argsparser').parse(),
    fs     = require('fs'),
    logger = require('./logger');

var config =  {
      port:                8080,
      access_log:      	  "/var/local/codem-transcode.js/log/access.log",
        "database":        {
            "dialect": "mysql",
            "username": "tcode",
            "database": "tcode",
            "host": "localhost",
            "port": 3306
        },
        slots: 4,
      interface:           "0.0.0.0",
      encoder:             "ffmpeg",
      scratch_dir:         "/var/local/codem-transcode.js/scratch/",
      use_scratch_dir:     true,
      ffprobe:             "ffprobe"
    }
    ;

var loadedConfig = null;

exports.load = function() {
  if (opts['-c'] && !loadedConfig) {
    try {
      loadedConfig = eval('(' + fs.readFileSync(opts['-c'], 'utf8') + ')');
      ConfigUtils.merge(config, loadedConfig);
      ConfigUtils.rewriteDatabaseEntry(config);
    } catch(err) {
      logger.log('Error reading config from ' + opts['-c']);
      logger.log(err);
      process.exit(1);
    }
  }
  return config;
}

var ConfigUtils = {
  merge: function(obj1,obj2) {
    for (key in obj2) {
      obj1[key] = obj2[key];
    }
  },

  rewriteDatabaseEntry: function(config) {
    if (typeof config.database == 'string') {
      config.database = {
        dialect: "sqlite",
        database: config.database
      }
    }
  }
}