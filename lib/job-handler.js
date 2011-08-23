var os        		= require('os'),
    util      		= require('util'),
    config    		= require('./config').load(),
    Job       		= require('./job'),
		notifyHandler = require('./notify-handler');

var slots = [];

exports.find = function(id, callback) {
	Job.find(id, callback);
}

exports.freeSlots = function() {
	return config['slots'] - slots.length;
}

exports.cancelAndRemove = function(id, callback) {
  for (var item in slots) {
    if (slots[item].id == id) {
      slots[item].cancel();
      slots[item].delete();
      callback(null, slots[item]);
      return;
    }
  }
  
  var job = Job.find(id, function(err, job) {
    if (job) {
      job.delete();
      callback(null, job);
      return;
    }
  });
  
  callback("No such job to delete", null);
}

exports.slots = slots;

exports.processJobRequest = function(postData, callback) {
	validateJobRequest(postData, function(err, opts) {
		if (err) {
			callback({ type: 'invalid', missingFields: err['missingFields'] }, null)
		} else {
	    if (hasFreeSlots()) {
	      var job = spawnJob(opts);
	      slots.push(job);
				callback(false, job);
			} else {
				callback({ type: 'full' }, null);				
			}
		}
	});
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
		callback(false, opts);		
	}
}

spawnJob = function(opts) {
	var job = Job.create(opts);
  job.on('completed', function() {
    util.log('Job ' + this.id + ' finished with status: "' + this.status + '" and message: "' + this.message + '"');
		notifyHandler.notify(this);
    removeItemFromSlot(this);
  });
  util.log('Job ' + job.id + ' accepted with opts: "' + util.inspect(job.opts) + '"');
  return job;
}

hasFreeSlots = function() {
  return config['slots'] - slots.length > 0;
}

removeItemFromSlot = function(item) {
  var idx = slots.indexOf(item);
  if(idx!=-1) slots.splice(idx, 1);
}