/*global exports,require,console*/
var os = require('os'),
	util = require('util'),
	config = require('./config').load(),
	Job = require('./job'),
	notifyHandler = require('./notify-handler');

var slots = [];
var queue = [];
var validateJobRequest, spawnJob, hasFreeSlots, removeItemFromSlot;

exports.find = function(id, callback) {
	Job.find(id, callback);
};

exports.freeSlots = function() {
	var threads = 0;
	for( var i in slots ){
		var job = slots[i];
		threads += job.threads;
	}
	return config['slots'] - threads;
};

exports.cancelAndRemove = function(id, callback) {
	for (var item in slots) {
		if (slots[item].id == id) {
			slots[item].cancel();
			slots[item].delete();
			callback(null, slots[item]);
			return;
		}
	}

	var job = Job.find(id,
	function(err, job) {
		if (job) {
			job.delete();
			callback(null, job);
			return;
		}
	});

	callback("No such job to delete", null);
};

exports.slots = slots;
exports.queue = queue;

exports.processJobRequest = function(postData, callback) {
	validateJobRequest(postData,
	function(err, opts) {
		if (err) {
			callback({ type: 'invalid', missingFields: err['missingFields'] }, null);
		} else {
			var threads = opts.encoder_options.match(/threads\s(\d+)/i);
			if( threads ){
				threads = parseInt(threads[1], 10);
				if( threads > config['slots'] ){
					threads = config['slots'];
					opts.encoder_options.replace(/threads\s(\d+)/i, "threads "+threads);
				}
			} else {
				threads = 1;
			}
			
			var onQueue = hasFreeSlots()? null : true;
			var stack = onQueue? queue : slots;
			
			var job = spawnJob(opts, onQueue);
			job['threads'] = threads;
			stack.push(job);
			callback(null, job);					
		}
	});
};

validateJobRequest = function(postData, callback) {
	// Valid job object should contain:
	//
	// source_file:	  the input file
	// destination_file: the output file
	// encoder_options:  the flags for the encoder
	// callback_urls:	 array of callbacks to notify of events (optional)
	var missingFields = [];
	var opts = {};

	try {
		var obj = JSON.parse(postData);
		var requiredFields = ['source_file', 'destination_file', 'encoder_options'];
		var acceptedFields = ['source_file', 'destination_file', 'encoder_options', 'callback_urls'];
		var field = null;

		for (field in requiredFields) {
			if (typeof(obj[requiredFields[field]]) == "undefined") {
				missingFields.push(requiredFields[field]);
			}
		}

		// simple clone
		for (field in acceptedFields) {
			if (typeof(obj[acceptedFields[field]]) != "undefined") {
				opts[acceptedFields[field]] = obj[acceptedFields[field]];
			}
		}
	} catch(error) {
		callback({}, null);
	}

	if (missingFields.length > 0) {
		callback({missingFields: missingFields},null);
	} else {
		callback(false, opts);
	}
};

spawnJob = function(opts, onQueue) {
	var job = Job.create(opts, onQueue);
	job.on('completed', function(){
		util.log('Job ' + this.id + ' finished with status: "' + this.status + '" and message: "' + this.message + '"');
		notifyHandler.notify(this);
		removeItemFromSlot(this);
		if( queue.length > 0 ){
			var nextJob = queue.shift();
			slots.push(nextJob);
			nextJob.spawn();
		}
	});
	util.log('Job ' + job.id + ' accepted with opts: "' + util.inspect(job.opts) + '"');
	return job;
};

hasFreeSlots = function() {
	var threads = 0;
	for( var i in slots ){
		var job = slots[i];
		threads += job.threads;
	}
	return config['slots'] - threads > 0;
};

removeItemFromSlot = function(item) {
	var idx = slots.indexOf(item);
	if (idx != -1){
		slots.splice(idx, 1);
	}
};