var util          = require('util'),
    crypto        = require('crypto'),
    fs            = require('fs'),
    EventEmitter  = require('events').EventEmitter,
    child_process = require('child_process'),
    config        = require('./config').load(),
    dbHandler     = require('./db-handler'),
    mkdirp        = require('mkdirp'),
    path          = require('path'),
    notifyHandler = require('./notify-handler'),
    logger        = require('./logger')

// Constructor
var Job = function(opts) {
  this.id           = Job.generateId();
  this.filesize     = Number.NaN;
  this.duration     = Number.NaN;
  this.progress     = Number.NaN;
  this.status       = "processing";
  this.message      = null;
  this.opts         = opts;
  this.lastMessage  = null;

  return this;
}

// Extend with EventEmitter properties
util.inherits(Job, EventEmitter);

Job.create = function(opts) {
	var job = new Job(opts);
	dbHandler.insertJob(job);
	
	job.prepare(function onPrepared(message) {
	  if (message == "hasInput")     job.hasInput     = true;
	  if (message == "hasOutputDir") job.hasOutputDir = true;
	  if (job.hasInput && job.hasOutputDir) job.spawn();
	});
	
	return job;
}

Job.find = function(id, callback) {
	dbHandler.getJob(id, function(err, job) {
	  if (job) {
	    var j = new Job();
	    for (var field in job) {
	      j[field] = job[field];
	    }
	    callback(err, j);
	  } else {
	    callback(err, job);
	  }
	});
}

Job.prototype.delete = function() {
  dbHandler.deleteJob(this.id, function(err, result) {
    if (err) throw("Error while deleting job.");
  });
}

Job.generateId = function() {
  var hash = crypto.createHash('sha1');
  var date = new Date();

  hash.update([date, Math.random()].join(''));
  
  return hash.digest('hex');
}

Job.prototype.prepare = function(callback) {
  var job = this;
  var destination_dir = path.dirname(path.normalize(job.opts['destination_file']));
  var mode = getMask();

  fs.stat(job.opts['source_file'], function(err, stats) {
    if (err) {
      job.exitHandler(-1, "unable to read input file (" + job.opts['source_file'] + ").");
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
  
}

Job.prototype.spawn = function() {
  var job = this;

  if (this.hasInput && this.hasOutputDir && !this.the_process) {
    var args = this.opts['encoder_options'].replace(/\s+/g, " ").split(' ');
    args.unshift('-i', this.opts['source_file']);

    var extension = path.extname(this.opts['destination_file']);
    var outputDir = path.dirname(this.opts['destination_file']);
    
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
}

Job.prototype.cancel = function() {
  if (this.the_process) {
    this.the_process.kill();
  }
}

Job.prototype.finalize = function(code, tmpFile) {
  var job = this;
  if (code == 0) {
    fs.rename(tmpFile, job.opts['destination_file'], function (err) {
      if (err) {
        if ( (err.message).match(/EXDEV/) ) {
          /*
            EXDEV fix, since util.pump is deprecated, using stream.pipe
            example from http://stackoverflow.com/questions/11293857/fastest-way-to-copy-file-in-node-js
          */
          try {
            logger.log('ffmpeg finished successfully, trying to copy across partitions');
            fs.createReadStream(tmpFile).pipe(fs.createWriteStream(job.opts['destination_file']));
            job.exitHandler(code, 'ffmpeg finished succesfully.');
          } catch (err) {
            logger.log(err);
            job.exitHandler(-1, 'ffmpeg finished succesfully, but unable to move file to different partition (' + job.opts['destination_file'] + ').');
          }
            
        } else {
          logger.log(err);
          job.exitHandler(-1, 'ffmpeg finished succesfully, but unable to move file to destination (' + job.opts['destination_file'] + ').');
        }
      } else {
        job.exitHandler(code, 'ffmpeg finished succesfully.');
      }
    });
  } else {
    job.exitHandler(code, "ffmpeg finished with an error: '" + job.lastMessage + "' (" + code + ").")
  }
}

Job.prototype.toJSON = function() {
  var obj = {
    'id': this.id,
    'status': this.status,
    'progress': this.progress,
    'duration': this.duration,
    'filesize': this.filesize,
    'message': this.message
  };
  
  return obj;
}

Job.prototype.progressHandler = function(data) {
  this.lastMessage = data.toString().replace("\n",'');
  
  isNaN(this.duration) ? this.extractDuration(data.toString()) : this.extractProgress(data.toString());
  
  this.update();
};

Job.prototype.extractDuration = function(text) {
  if (!this.durationBuffer) this.durationBuffer = "";
  
  this.durationBuffer += text;
  var re = new RegExp(/Duration:\s+(\d{2}):(\d{2}):(\d{2}).(\d{1,2})/);
  var m = re.exec(this.durationBuffer);

  if (m != null) {
    var hours = parseInt(m[1], 10), minutes = parseInt(m[2], 10), seconds = parseInt(m[3], 10);

    this.duration = hours * 3600 + minutes * 60 + seconds;
    notifyHandler.notify(this);
  }    
}

Job.prototype.extractProgress = function(text) {
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
}

Job.prototype.exitHandler = function(code, message) {
  if (!this.hasExited) {
    this.hasExited = true
    this.status = (code == 0 ? 'success' : 'failed');
    this.message = message;

  	if (this.status == 'success' && !isNaN(this.progress)) {
  		this.progress = 1.0;
  	}

  	this.update();
    this.emit('completed');
  }
}

Job.prototype.update = function() {
	dbHandler.updateJob(this);
}

getMask = function() {
  return pad((process.umask() ^ 0777).toString(8), '0', 4);
}

pad = function(orig, padString, length) {
	var str = orig;
  while (str.length < length)
      str = padString + str;
  return str;
}

module.exports = Job;