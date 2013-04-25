var os            = require('os'),
    logger        = require('./logger'),
    util          = require('util'),
    config        = require('./config').load(),
    Job           = require('./job'),
    notifyHandler = require('./notify-handler');

var slots = [];

exports.find = function(id, callback) {
  Job.find({ where: { internalId: id }}).success(function(job) {
    callback(null, job);
  }).error(function(err) {
    // error while finding job
    callback('Error while finding the job in the database. Make sure the database is available.', null);
  })
}

exports.freeSlots = function() {
  return config['slots'] - slots.length;
}

exports.cancelAndRemove = function(internalId, callback) {
  for (var item in slots) {
    if (slots[item].internalId == internalId) {
      slots[item].cancel();
    }
  }
  
  var job = Job.find({ where: { internalId: internalId }}).success(function(job) {
    if (job) {
      job.destroy().success(function () {
        callback(null, job);
      }).error(function (error) {
        callback("Error while destroying job from database: " + error, null);
      });
    } else {
      callback("No such job to delete", null);      
    }
  }).error(function(err) {
    callback("Error while cancelling and/or removing job: " + err, null);
  });
}

exports.slots = slots;

exports.processJobRequest = function(postData, callback) {
  validateJobRequest(postData, function(err, opts) {
    if (err) {
      callback({ type: 'invalid', message: 'Some required fields are missing.', missingFields: err['missingFields'] }, null)
    } else {
      if (hasFreeSlots()) {
        spawnJob(opts, function onSpawned(err, job) {
          if (job) {
            slots.push(job);
            callback(null, job);
          } else {
            callback({ type: 'spawn', message: 'An error occurred while spawning a new job.' }, null);
          }
        });
      } else {
        callback({ type: 'full', message: 'The transcoder is at maximum capacity right now.' }, null);       
      }
    }
  });
}

exports.purgeJobs = function(age, callback) {
  var parsedAge = parseInt(age, 10);
  var timestamp = (new Date().valueOf()) - parsedAge * 1000;
  
  if (isNaN(timestamp)) {
    callback("Error while parsing age: " + age, null);
  } else {
    Job.findAll({ where: ["createdAt < ? AND status = 'success'", new Date(timestamp)] }).success(function(jobs) {
      var count = jobs.length;
      var chainer = new Sequelize.Utils.QueryChainer;

      for (var i=0; i<count; i++) {
        chainer.add(jobs[i].destroy());
      }

      chainer.run().success(function(){
        callback(null, count);
      }).error(function(errors){
        callback("Error while purging jobs.", null);
      });
    }).error(function(err) {
      callback("Unable to find jobs to be purged.", null);
    });    
  }  
}

validateJobRequest = function(postData, callback) {
  // Valid job object should contain:
  //
  // source_file:      the input file
  // destination_file: the output file
  // encoder_options:  the flags for the encoder
  // callback_urls:     array of callbacks to notify of events (optional)
  var missingFields = [];
  var opts = {};
  
  try {
    var obj = JSON.parse(postData);
    var requiredFields = ['source_file', 'destination_file', 'encoder_options'];
    var acceptedFields = ['source_file', 'destination_file', 'encoder_options', 'callback_urls'];
    
    for (var field in requiredFields) {
      if (typeof(obj[requiredFields[field]]) == "undefined") {
        missingFields.push(requiredFields[field]);
      }      
    }

    // simple clone
    for (var field in acceptedFields) {
      if (typeof(obj[acceptedFields[field]]) != "undefined") {
        opts[acceptedFields[field]] = obj[acceptedFields[field]];
      }      
    }      
  } catch (error) {
    callback({}, null);
  }

  if (missingFields.length > 0) {
    callback({ missingFields: missingFields }, null);
  } else {
    callback(null, opts);    
  }
}

spawnJob = function(opts, callback) {
  Job.create(
    opts,
    function onCreate(err, job) {
      if (job) {
        logger.log('Job ' + job.internalId + ' accepted with opts: "' + util.inspect(job.parsedOpts()) + '"');
        callback(null, job);
      } else {
        callback('Job could not be created.', null);
      }
    },
    function onComplete(job) {
        logger.log('Job ' + this.internalId + ' finished with status: "' + this.status + '" and message: "' + this.message + '"');
        notifyHandler.notify(this);
        removeItemFromSlot(this);
    }
  );
}

hasFreeSlots = function() {
  return config['slots'] - slots.length > 0;
}

removeItemFromSlot = function(item) {
  var idx = slots.indexOf(item);
  if(idx!=-1) slots.splice(idx, 1);
}