var util          = require('util'),
    crypto        = require('crypto'),
    fs            = require('fs'),
    child_process = require('child_process'),
    config        = require('./config').load()
    mkdirp        = require('mkdirp'),
    path          = require('path'),
    notifyHandler = require('./notify-handler'),
    logger        = require('./logger'),
    Sequelize     = require('sequelize')

var StatusCodes = {
  SUCCESS: "success",
  FAILED: "failed",
  PROCESSING: "processing",
  UNKNOWN: "unknown"
}

var JobUtils = {
  sql: null,
  
  getDatabase: function() {
    if (JobUtils.sql == null) {
      if (config['database']['dialect'] == "sqlite") {
        JobUtils.sql = new Sequelize('database', 'username', 'password', {
          dialect: 'sqlite',
          storage: config['database']['database']
        });
      } else {
        JobUtils.sql = new Sequelize(config['database']['database'], config['database']['username'], config['database']['password'], {
          dialect: config['database']['dialect'],
          storage: config['database']['database']
        });
      }
    }
    return JobUtils.sql;
  },

  getMask: function() {
    return JobUtils.pad((process.umask() ^ 0777).toString(8), '0', 4);
  },

  migrateDatabase: function() {
    var migrator = JobUtils.getDatabase().getMigrator({path: __dirname + "/../migrations" }, true)
    migrator.migrate().success(function() {
      // successfully migrated
    }).error(function(err) {
      // can't migrate
    })
  },
  
  pad: function(orig, padString, length) {
    var str = orig;
    while (str.length < length)
        str = padString + str;
    return str;
  }
}

// Model definition
var Job = JobUtils.getDatabase().define('Job', {
  id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  internalId:  { type: Sequelize.STRING, defaultValue: null },
  status:      { type: Sequelize.STRING, defaultValue: StatusCodes.PROCESSING },
  progress:    { type: Sequelize.FLOAT, defaultValue: 0.0 },
  duration:    { type: Sequelize.INTEGER, defaultValue: 0 },
  filesize:    { type: Sequelize.INTEGER, defaultValue: 0 },
  opts:        { type: Sequelize.TEXT, defaultValue: null },
  message:     { type: Sequelize.TEXT, defaultValue: null },
  createdAt:   Sequelize.DATE,
  updatedAt:   Sequelize.DATE
}, {
  classMethods: {
    prepareDatabase: function() {
      JobUtils.migrateDatabase();
    },
    create: function(opts, callback, completeCallback) {
      var job = Job.build({ opts: JSON.stringify(opts), internalId: Job.generateId() });
      job.save().success(function(job) {
        job.prepare(function onPrepared(message) {
          if (message == "hasInput")     job.hasInput     = true;
          if (message == "hasOutputDir") job.hasOutputDir = true;
          if (job.hasInput && job.hasOutputDir) job.spawn();
        });
        job.completeCallback = completeCallback;
        callback(null, job);      
      }).error(function(error) {
        // Error while saving job
        callback('Unable to save new job to the database', null);
      });
    },
    generateId: function() {
      var hash = crypto.createHash('sha1');
      var date = new Date();

      hash.update([date, Math.random()].join(''));

      return hash.digest('hex');
    }
  },
  instanceMethods: {
    parsedOpts: function() {
      return JSON.parse(this.opts);
    },
    
    prepare: function(callback) {
      var job = this;
      var destination_dir = path.dirname(path.normalize(job.parsedOpts()['destination_file']));
      var mode = JobUtils.getMask();

      fs.stat(job.parsedOpts()['source_file'], function(err, stats) {
        if (err) {
          job.exitHandler(-1, "unable to read input file (" + job.parsedOpts()['source_file'] + ").");
        } else {
          if (stats.isFile()) { job.filesize = stats.size || Number.NaN };
          callback("hasInput");
        }
      });

      mkdirp.mkdirp(destination_dir, mode, function(err) {
        if (err) {
          fs.stat(destination_dir, function(err, stats) {
            if (err) {
              job.exitHandler(-1, "unable to create output directory (" + destination_dir + ").");          
            } else {
              if (stats.isDirectory()) {
                callback("hasOutputDir");            
              } else {
                job.exitHandler(-1, "unable to create output directory (" + destination_dir + ").");                      
              }
            }
          });
        } else {
          callback("hasOutputDir");
        }
      });

    },
    spawn: function() {
      var job = this;
      if (this.hasInput && this.hasOutputDir && !this.the_process) {
        var args = this.parsedOpts()['encoder_options'].replace(/\s+/g, " ").split(' ');
        args.unshift('-i', this.parsedOpts()['source_file']);

        var extension = path.extname(this.parsedOpts()['destination_file']);
        var outputDir = path.dirname(this.parsedOpts()['destination_file']);

        var tmpFile = outputDir + "/" + this.id + extension;

        if (config['use_scratch_dir'] == true) {
          tmpFile = config['scratch_dir'] + "/" + this.id + extension;
        }

        args.push(tmpFile);

        var the_process = child_process.spawn(config['encoder'], args);
        the_process.stderr.on('data', function(data) { job.progressHandler(data) });
        the_process.on('exit', function(code) { job.finalize(code, tmpFile); });

        this.the_process = the_process;    
      }
    },
    cancel: function() {
      if (this.the_process) {
        this.the_process.kill();
        this.exitHandler(-1, 'job was cancelled');
      }
    },
    finalize: function(code, tmpFile) {
      var job = this;
      if (code == 0) {
        fs.rename(tmpFile, job.parsedOpts()['destination_file'], function (err) {
          if (err) {
            if ( (err.message).match(/EXDEV/) ) {
              /*
                EXDEV fix, since util.pump is deprecated, using stream.pipe
                example from http://stackoverflow.com/questions/11293857/fastest-way-to-copy-file-in-node-js
              */
              try {
                logger.log('ffmpeg finished successfully, trying to copy across partitions');
                fs.createReadStream(tmpFile).pipe(fs.createWriteStream(job.parsedOpts()['destination_file']));
                job.exitHandler(code, 'ffmpeg finished succesfully.');
              } catch (err) {
                logger.log(err);
                job.exitHandler(-1, 'ffmpeg finished succesfully, but unable to move file to different partition (' + job.parsedOpts()['destination_file'] + ').');
              }

            } else {
              logger.log(err);
              job.exitHandler(-1, 'ffmpeg finished succesfully, but unable to move file to destination (' + job.parsedOpts()['destination_file'] + ').');
            }
          } else {
            job.exitHandler(code, 'ffmpeg finished succesfully.');
          }
        });
      } else {
        job.exitHandler(code, "ffmpeg finished with an error: '" + job.lastMessage + "' (" + code + ").")
      }
    },
    toJSON: function() {
      var obj = {
        'id': this.internalId,
        'status': this.status,
        'progress': this.progress,
        'duration': this.duration,
        'filesize': this.filesize,
        'message': this.message
      };

      return obj;
    },
    progressHandler: function(data) {
      this.lastMessage = data.toString().replace("\n",'');

      (isNaN(this.duration) || this.duration == 0) ? this.extractDuration(data.toString()) : this.extractProgress(data.toString());

      this.save().success(function() {
        // successfull save
      }).error(function(err) {
        // error while saving job
      });
    },
    extractDuration: function(text) {
      if (!this.durationBuffer) this.durationBuffer = "";

      this.durationBuffer += text;
      var re = new RegExp(/Duration:\s+(\d{2}):(\d{2}):(\d{2}).(\d{1,2})/);
      var m = re.exec(this.durationBuffer);

      if (m != null) {
        var hours = parseInt(m[1], 10), minutes = parseInt(m[2], 10), seconds = parseInt(m[3], 10);

        this.duration = hours * 3600 + minutes * 60 + seconds;
        notifyHandler.notify(this);
      }    
    },
    extractProgress: function(text) {
      // 00:00:00 (hours, minutes, seconds)
      var re = new RegExp(/time=(\d{2}):(\d{2}):(\d{2})/);    
      var m = re.exec(text);

      if (m != null) {
        var hours = parseInt(m[1], 10), minutes = parseInt(m[2], 10), seconds = parseInt(m[3], 10);
        var current = hours * 3600 + minutes * 60 + seconds;
        this.progress = current / this.duration;
      } else {
        // 00.00 (seconds, hundreds)
        re = new RegExp(/time=(\d+).(\d{2})/);    
        m = re.exec(text);

        if (m != null) {
          var current = parseInt(m[1], 10);
          this.progress = current / this.duration;
        }
      }
    },
    exitHandler: function(code, message) {
      if (!this.hasExited) {
        this.hasExited = true
        this.status = (code == 0 ? 'success' : 'failed');
        this.message = message;

        if (this.status == 'success' && !isNaN(this.progress)) {
          this.progress = 1.0;
        }

        this.save();
        this.completeCallback();
      }
    }
  }
});

module.exports = Job;