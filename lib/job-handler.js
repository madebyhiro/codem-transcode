var os = require('os'),
        logger = require('./logger'),
        util = require('util'),
        config = require('./config').load(),
        Job = require('./job'),
        notifyHandler = require('./notify-handler');

var slots = [];
var queue = [];

exports.find = function(id, callback) {
    Job.find({
        where: {
            internalId: id
        }
    }).success(function(job) {
        callback(null, job);
    }).error(function(err) {
        // error while finding job
        callback('Error while finding the job in the database. Make sure the database is available.', null);
    })
}

exports.freeSlots = function() {
    var threads = 0;
    for (var i in slots) {
        var job = slots[i];
        threads += job.threads;
    }
    return config['slots'] - threads;
}

exports.cancelAndRemove = function(internalId, callback) {
    for (var item in slots) {
        if (slots[item].internalId == internalId) {
            slots[item].cancel();
        }
    }

    var job = Job.find({
        where: {
            internalId: internalId
        }
    }).success(function(job) {
        if (job) {
            job.destroy().success(function() {
                callback(null, job);
            }).error(function(error) {
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
exports.queue = queue;

exports.processJobRequest = function(postData, callback) {
    validateJobRequest(postData, function(err, opts) {
        if (err) {
            callback({type: 'invalid', message: 'Some required fields are missing.', missingFields: err['missingFields']}, null);
        } else {
            var threads = opts.encoder_options.match(/threads\s(\d+)/i);
            if (threads) {
                threads = parseInt(threads[1], 10);
                if (threads > config['slots']) {
                    threads = config['slots'];
                    opts.encoder_options.replace(/threads\s(\d+)/i, "threads " + threads);
                }
            } else {
                threads = 1;
            }

            var onQueue = hasFreeSlots() ? null : true;
            //console.log('var processJobRequest::onQueue '+ onQueue);
            var stack = onQueue ? queue : slots;
            //console.log('var processJobRequest::stack '+stack);

            spawnJob(opts, onQueue, function onQueue(err, job) {
                if (job) {
                    job['threads'] = threads;
                    stack.push(job);
                    callback(null, job);
                } else {
                    callback({type: 'spawn', message: 'An error occurred while spawning a new job.'}, null);
                }
            });
        }
    });
};

exports.purgeJobs = function(age, callback) {
    var parsedAge = parseInt(age, 10);
    var timestamp = (new Date().valueOf()) - parsedAge * 1000;

    if (isNaN(timestamp)) {
        callback("Error while parsing age: " + age, null);
    } else {
        Job.findAll({
            where: ["createdAt < ? AND status = 'success'", new Date(timestamp)]
        }).success(function(jobs) {
            var count = jobs.length;
            var chainer = new Sequelize.Utils.QueryChainer;

            for (var i = 0; i < count; i++) {
                chainer.add(jobs[i].destroy());
            }

            chainer.run().success(function() {
                callback(null, count);
            }).error(function(errors) {
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
    // source_file:       the input file
    // destination_file:  the output file
    // encoder_options:   the flags for the encoder
    // thumbnail_options: options to generate thumbnails (optional)
    // callback_urls:     array of callbacks to notify of events (optional)
    var missingFields = [];
    var opts = {};

    try {
        var obj = JSON.parse(postData);
        var requiredFields = ['source_file', 'destination_file', 'encoder_options'];
        var acceptedFields = ['source_file', 'destination_file', 'encoder_options', 'thumbnail_options', 'callback_urls'];

        for (var field in requiredFields) {
            if (typeof (obj[requiredFields[field]]) == "undefined") {
                missingFields.push(requiredFields[field]);
            }
        }

        // simple clone
        for (var field in acceptedFields) {
            if (typeof (obj[acceptedFields[field]]) != "undefined") {
                opts[acceptedFields[field]] = obj[acceptedFields[field]];
            }
        }
    } catch (error) {
        callback(new Error('No valid JSON supplied'), null);
        return
    }

    if (missingFields.length > 0) {
        callback({
            missingFields: missingFields
        }, null);
    } else {
        callback(null, opts);
    }
}

spawnJob = function(opts, onQueue, callback) {
    Job.create(opts, onQueue,
            function onQueue(err, job) {
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
				console.log(queue);
                    if (queue.length > 0) {
                        var nextJob = queue.shift();
						console.log(nextJob);
                        slots.push(nextJob);
                        nextJob.spawn();
                    }
            }
    );
}

hasFreeSlots = function() {
    var threads = 0;
    for (var i in slots) {
        var job = slots[i];
        threads += job.threads;
    }
    return config['slots'] - threads > 0;
}

removeItemFromSlot = function(item) {
    var idx = slots.indexOf(item);
    if (idx != -1)
        slots.splice(idx, 1);
}