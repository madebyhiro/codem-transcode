var util          = require('util'),
    crypto        = require('crypto'),
    fs            = require('fs'),
    child_process = require('child_process'),
    config        = require('./config').load()
    mkdirp        = require('mkdirp'),
    path          = require('path'),
    notifyHandler = require('./notify-handler'),
    logger        = require('./logger'),
    Sequelize     = require('sequelize'),
    async         = require('async'),
    os            = require('os');

var StatusCodes = {
  SUCCESS: "success",
  FAILED: "failed",
  PROCESSING: "processing"
}

var JobUtils = {
  sql: null,
  
  generateThumbnailPath: function(destinationFile, offset, format) {
    return [path.dirname(destinationFile), path.basename(destinationFile, path.extname(destinationFile))].join(path.sep) + "-" + offset + "." + format;    
  },
  
  generateRangeFromThumbOpts: function(thumbOpts, duration) {
    if (thumbOpts['percentages']) {
      // percentage based thumbnails
      return JobUtils.percentagesToRange(thumbOpts['percentages'], duration);
    } else if (thumbOpts['seconds']) {
      // seconds based thumbnails
      return JobUtils.secondsToRange(thumbOpts['seconds'], duration);
    } else {
      return null;
    }
  },
  
  getDatabase: function() {
    if (JobUtils.sql == null) {
      if (config['database']['dialect'] == "sqlite") {
        JobUtils.sql = new Sequelize('database', 'username', 'password', {
          dialect: 'sqlite',
          storage: config['database']['database'],
          logging: false
        });
      } else {
        JobUtils.sql = new Sequelize(config['database']['database'], config['database']['username'], config['database']['password'], {
          dialect: config['database']['dialect'],
          storage: config['database']['database'],
          host: config['database']['host'],
          port: config['database']['port'],
          pool: false,
          logging: false
        });
      }
    }
    return JobUtils.sql;
  },

  getMask: function() {
    return JobUtils.pad((process.umask() ^ 0777).toString(8), '0', 4);
  },

  markUnknownState: function(callback) {
    Job.findAll({ where: { status: StatusCodes.PROCESSING }}).success(function(result) {
      if (result.length > 0) {
        for (var job in result) {
          result[job].status = StatusCodes.FAILED;
          result[job].message = "The transcoder quit unexpectedly or the database was unavailable for some period.";
          result[job].save();
        }
      }
    });
    callback(null);
  },
  
  migrateDatabase: function(callback) {
    var migrator = JobUtils.getDatabase().getMigrator({path: __dirname + "/../migrations" });
    migrator.migrate().success(function() {
      callback(null);
    }).error(function(err) {
      callback(err);
    });
  },
  
  pad: function(orig, padString, length) {
    var str = orig;
    while (str.length < length)
        str = padString + str;
    return str;
  },
  
  percentagesToRange: function(percentages, duration) {
    if (Array.isArray(percentages)) {
      // explicit percentages
      return percentages.map(function (p) { return Math.floor(p * duration); });
    } else {
      // single percentage interval
      var offsets = [];
      for (var p = 0.0; p <= 1.0; p += percentages) {
        offsets.push(Math.floor(p * duration));
      }
      return offsets;
    }
  },
  
  secondsToRange: function(seconds, duration) {
    if (Array.isArray(seconds)) {
      // explicit percentages
      return seconds;
    } else {
      // single percentage interval
      var offsets = [];
      for (var offset = 0; offset <= duration; offset += seconds) {
        offsets.push(Math.floor(offset));
      }
      return offsets;
    }
  },
  
  verifyDatabase: function(callback) {
    JobUtils.getDatabase().getQueryInterface().showAllTables().success(function (tables) {
      if (tables.length > 0 && tables.indexOf('SequelizeMeta') == -1) {
        logger.log("You appear to be upgrading from an old version of codem-transcode (<0.5). The database handling has " +
                   "changed, please refer to the upgrade instructions. To prevent data loss the transcoder will now exit.");
        callback("Old database schema detected.");
      } else {
        callback(null);
      }
    }).error(function (err) {
      logger.log(err);
      callback(err);
    });
  }
}

// Model definition
var Job = JobUtils.getDatabase().define('Job', {
  id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  internalId:  { type: Sequelize.STRING, defaultValue: null },
  label:       { type: Sequelize.STRING, defaultValue: null },
  status:      { type: Sequelize.STRING, defaultValue: StatusCodes.PROCESSING },
  progress:    { type: Sequelize.FLOAT, defaultValue: 0.0 },
  duration:    { type: Sequelize.INTEGER, defaultValue: 0 },
  filesize:    { type: Sequelize.INTEGER, defaultValue: 0 },
  opts:        { type: Sequelize.TEXT, defaultValue: null },
  thumbnails:  { type: Sequelize.TEXT, defaultValue: null },
  message:     { type: Sequelize.TEXT, defaultValue: null },
  playlist:    { type: Sequelize.STRING, defaultValue: null },
  segments:    { type: Sequelize.TEXT, defaultValue: null },
  createdAt:   Sequelize.DATE,
  updatedAt:   Sequelize.DATE
}, {
  classMethods: {
    prepareDatabase: function(callback) {
      JobUtils.verifyDatabase(function (err) {
        if (err) {
          callback(err);
        } else {
          JobUtils.migrateDatabase(function (err) {
            if (err) {
              callback(err);
            } else {
              JobUtils.markUnknownState(function (err) {
                err ? callback(err) : callback(null);
              })
            }
          });
        }
      })
    },
    create: function(opts, callback, completeCallback) {
      var label = opts.label;

      delete opts.label;

      var job = Job.build({ opts: JSON.stringify(opts), label: label, internalId: Job.generateId() });
      job.save().success(function(job) {
        job.prepare(function onPrepared(message) {
          if (message == "hasInput")     job.hasInput     = true;
          if (message == "hasOutputDir") job.hasOutputDir = true;
          if (job.hasInput && job.hasOutputDir) job.spawn();
        })
        job.completeCallback = completeCallback;
        callback(null, job);
      }).error(function(error) {
        /*
          Error while saving job, this appears to not always be called(!).
          Known issue in either sequelize or mysql package.
        */
        logger.log("Could not write job " + job.internalId + " to the database.");
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
        var args = [];
        args.push('-i', this.parsedOpts()['source_file']);

        var extension = path.extname(this.parsedOpts()['destination_file']);
        var outputDir = path.dirname(this.parsedOpts()['destination_file']);

        if (this.parsedOpts()['encoder_options'].length > 0) {
          // "proper" transcoding job
          if (Array.isArray(this.parsedOpts()['encoder_options'])) {
            args = args.concat(this.parsedOpts()['encoder_options']);
          } else {
            args = args.concat(this.parsedOpts()['encoder_options'].replace(/\s+/g, " ").split(' '));
          }
          var tmpFile = outputDir + path.sep + this.internalId + extension;

          if (config['use_scratch_dir'] == true) {
            tmpFile = config['scratch_dir'] + path.sep + this.internalId + extension;
          }

          args.push(tmpFile);

          job.tmpFile = tmpFile;
        } else {
          // thumbnail only job, but still need to find duration, so we start a "null" job
          var null_file = (!!os.platform().match(/^win/) ? 'nul' : '/dev/null');
          args.push('-f', 'null', '-acodec', 'copy', '-vcodec', 'copy', '-y', null_file);
        }
        
        var the_process = child_process.spawn(config['encoder'], args);          

        the_process.stderr.on('data', function(data) { job.progressHandler(data); });
        the_process.on('error', function(err) { job.lastMessage = 'Unable to execute the ffmpeg binary: ' + err; job.didFinish(1); });
        the_process.on('exit', function(code) { job.didFinish(code); });

        this.the_process = the_process;
      }
    },
    cancel: function() {
      if (this.the_process) {
        this.the_process.kill();
        this.exitHandler(-1, 'job was cancelled');
      }
    },
    didFinish: function(code) {
      if (code != 0) {
        this.finalize(code);
        return;
      }

      this.processThumbnails({
        error:   function(job) { job.finalize(1); },
        success: function(job) {
          job.processSegments({
            error:   function(job) { job.finalize(1); },
            success: function(job) { job.finalize(0); }
          })
        }
      })
    },

    processSegments: function(callbacks){
      if (!this.parsedOpts()['segments_options']) {
        callbacks.success(this);
        return;
      }

      logger.log("Processing segments for job " + this.internalId + ".");

      var job              = this;
      var args             = [];
      var segmentsOpts     = this.parsedOpts()['segments_options'];
      var segmentTime      = segmentsOpts['segment_time'];
      var destinationFile  = this.parsedOpts()['destination_file'];
      var playlistName     = path.basename(destinationFile, path.extname(destinationFile));
      var playlistDir      = path.dirname(destinationFile);
      var playlistPath     = [playlistDir, playlistName].join(path.sep) + '.m3u8';
      var segmentsFormat   = [playlistDir, playlistName].join(path.sep) + '-%06d.ts'
      var inputFile        = (this.parsedOpts()['encoder_options'].length > 0) ? job.tmpFile : this.parsedOpts()['source_file']
      
      args.push('-i', inputFile,
                '-codec', 'copy', '-map', '0', '-f', 'segment',
                '-vbsf', 'h264_mp4toannexb', '-flags', '-global_header',
                '-segment_format', 'mpegts', '-segment_list', playlistPath,
                '-segment_time', segmentTime, segmentsFormat);

      child_process.execFile(config['encoder'], args, { maxBuffer: 4096*1024 }, function(error, stdout, stderr) {
        if (error) {
          job.lastMessage = 'Error while generating segments: ' + error.message;
          callbacks.error(job);
          return;
        }

        fs.readdir(playlistDir, function(error, files) {
          if (error) {
            job.lastMessage = 'Error while generating segments: ' + error.message;
            callbacks.error(job);
            return;
          }

          job.segments = JSON.stringify(files.filter(
            function(file){ return file.match(new RegExp(playlistName + "-\\d+\\.ts")) }
          ).map(
            function(file){ return path.join(playlistDir, file) }
          ));

          job.playlist = playlistPath;

          callbacks.success(job);
        });
      });
    },

    processThumbnails: function(callbacks) {
      if (!this.parsedOpts()['thumbnail_options']) {
        callbacks.success(this);
        return;
      }

      logger.log("Processing thumbnails for job " + this.internalId + ".");
      var thumbOpts = this.parsedOpts()['thumbnail_options'];
      var range = JobUtils.generateRangeFromThumbOpts(thumbOpts, this.duration);

      if (!range) {
        // no valid range
        logger.log("No valid thumbnails to process for job " + this.internalId + ". Skipping...");
        callbacks.success(this);
        return;
      }

      var job = this;
      async.parallel(
        range.map(job.execThumbJob.bind(job)),
        function(err, results) {
          if (err) {
            job.lastMessage = err.message;
            callbacks.error(job);
          } else {
            job.thumbnails = JSON.stringify(results);
            callbacks.success(job);
          }
        }
      );
    },
    execThumbJob: function(offset) {
      var job = this;
      return function(callback) {
        var thumbOpts = job.parsedOpts()['thumbnail_options'];
        var args = ['-ss', offset, '-i', job.parsedOpts()['source_file'], '-vframes', '1', '-y'];
        
        // Explicit size provided
        if (thumbOpts['size'] && thumbOpts['size'] != 'src') {
          args.push('-s', thumbOpts['size']);
        }

        var format = thumbOpts['format'] ? thumbOpts['format'] : 'jpg';
        var destinationFile = job.parsedOpts()['destination_file'];
        
        // Destination file + offset + extension
        var outputFile = JobUtils.generateThumbnailPath(destinationFile, offset, format);
        args.push(outputFile);
        
        var thumb_process = child_process.execFile(config['encoder'], args, { maxBuffer: 4096*1024 }, function(error, stdout, stderr) {
          if (error) {
            callback(new Error('Error while generating thumbnail: ' + error.message), null);
          } else {
            callback(null, outputFile);
          }
        });
      }
    },
    finalize: function(code) {
      var job = this;

      if (code != 0) {
        job.exitHandler(code, "ffmpeg finished with an error: '" + job.lastMessage + "' (" + code + ").");
        return;
      }

      if (!job.tmpFile) {
        // No tmpFile, hence no transcoding, only thumbnails or segmenting
        if (job.parsedOpts()['thumbnail_options']) {
          job.exitHandler(code, 'finished thumbnail job.');
        } else {
          job.exitHandler(code, 'finished segmenting job.');
        }
        return;
      }

      fs.rename(job.tmpFile, job.parsedOpts()['destination_file'], function (err) {
        if (err) {
          if ( (err.message).match(/EXDEV/) ) {
            /*
              EXDEV fix, since util.pump is deprecated, using stream.pipe
              example from http://stackoverflow.com/questions/11293857/fastest-way-to-copy-file-in-node-js
            */
            try {
              logger.log('ffmpeg finished successfully, trying to copy across partitions');
              fs.createReadStream(job.tmpFile).pipe(fs.createWriteStream(job.parsedOpts()['destination_file']));
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
    },
    toJSON: function() {
      var obj = {
        'id': this.internalId,
        'status': this.status,
        'label': this.label,
        'progress': this.progress,
        'duration': this.duration,
        'filesize': this.filesize,
        'message': this.message,
      };

      if (this.thumbnails) {
        obj['thumbnails'] = JSON.parse(this.thumbnails);
      }

      if (this.playlist) { obj['playlist'] = this.playlist; }
      if (this.segments) {
        obj['segments'] = JSON.parse(this.segments);
      }

      return obj;
    },
    progressHandler: function(data) {
      if (this.hasExited) return;
      
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
      this.hasExited = true
      this.message = message;

      if (code == 0) {
        this.progress = 1.0;
      }

      this.status = (code == 0 ? StatusCodes.SUCCESS : StatusCodes.FAILED);
      this.save().success(function() {
        // successfull save
      }).error(function(err) {
        // error while saving job
        logger.log("Error while saving job: " + err)
      });
      this.completeCallback();
    }
  }
});

module.exports = Job;
