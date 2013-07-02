var config            = require('./config').load(),
    jobHandler        = require('./job-handler'),
    probeHandler      = require('./probe-handler'),
    logger            = require('./logger'),
    express           = require('express'),
    RecoverableStream = require('./recoverable-stream');

var rejectMessage            = 'The transcoder is not accepting jobs right now. Please try again later.';
var rejectLoggerMessage      = 'The transcoder is not accepting jobs due to a logger error. Please try again later.';
var acceptedMessage          = 'The transcoder accepted your job.';
var notImplementedMessage    = 'This method is not yet implemented.';
var badRequestMessage        = 'The data supplied was not valid.';
var notFoundMessage          = 'The specified job could not be found.';
var probeNotSupportedMessage = 'Probing files is not supported. Make sure you add the \'ffprobe\' configuration option.';
var probeErrorMessage        = 'An error occurred while probing the file.';
var unableToDeleteMessage    = 'The transcoder was not able to cancel and/or delete the job.';
var unableToSpawnMessage     = 'The transcoder was not able to spawn a new job.';
var unableToPurgeMessage     = 'The transcoder was not able to purge jobs.';
var purgeMessage            = 'The transcoder successfully purged old jobs.';

var logfile = null;  
var server = null;

exports.launch = function() {
  server = express.createServer();
  logfile = new RecoverableStream(config['access_log'], { flags: 'a' });
  server.use(express.logger({stream: logfile}));

  server.get(   '/jobs',            getJobs);
  server.post(  '/jobs',            postNewJob);
  server.get(   '/jobs/:id',        getJobStatus);
  server.delete('/jobs/purge/:age', purgeJobs);
  server.delete('/jobs/:id',        removeJob);
  server.post(  '/probe',           probeFile);
  
  server.listen(config['port'], config['interface']);
    
  logger.log("Started server on interface " + config['interface'] + " port " + config['port'] + " with pid " + process.pid + ".");    
}

exports.relaunch = function() {
  logger.log("Restarting...");
  server.close();
  logfile.end();
  exports.launch();
}

// POST /probe
probeFile = function(request, response) {
  var postData = "";
  
  request.on('data', function(data) { postData += data; })
  request.on('end', function() { processProbe(postData, response); } );      
}

// POST /jobs
postNewJob = function(request, response) {
  var postData = "";
  
  request.on('data', function(data) { postData += data; })
  request.on('end', function() { processPostedJob(postData, response); } );    
}

// GET /jobs
getJobs = function(request, response) {
  var content = { max_slots: config['slots'], free_slots: jobHandler.freeSlots(), jobs: jobHandler.slots };

  try {
    response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
    response.end(JSON.stringify(content), 'utf8');        
  } catch(e) {
    logger.log("Error while returning all jobs: " + e + e.stack);
  }
}

// GET /jobs/:id
getJobStatus = function(request, response) {
  jobHandler.find(request.params.id, function onResult(err, job) {
    var body = {};

    if (err || !job) {
      response.statusCode = 404;
      body['message'] = notFoundMessage;            
    } else {
      response.statusCode = 200;
      body = job;
    }

    try {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(body), 'utf8');        
    } catch(e) {
      logger.log("Error while returning job status: " + e + e.stack);
    }
  });
}

// DELETE /jobs/:id
removeJob = function(request, response) {
  jobHandler.cancelAndRemove(request.params.id, function onResult(err, job) {
    var body = {};

    if (err) {
      if (job) {
        response.statusCode = 500;
        body['message'] = unableToDeleteMessage;
      } else {
        response.statusCode = 404;
        body['message'] = notFoundMessage;            
      }
    } else {
      response.statusCode = 200;
      body = job;
    }

    try {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(body), 'utf8');        
    } catch(e) {
      logger.log("Error while returning deleted job: " + e + e.stack);
    }    
  });
}

// DELETE /jobs/purge
purgeJobs = function(request, response) {
  jobHandler.purgeJobs(request.params.age, function onPurge(err, count) {
    var body = {};
    if (err) {
      response.statusCode = 500;
      body['message'] = unableToPurgeMessage + " " + err;
    } else {
      response.statusCode = 200;
      body['message'] = purgeMessage + ' (' + count + ')';
    }
    
    try {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(body), 'utf8');        
      } catch(e) {
        logger.log("Error while returning purged jobs: " + e + e.stack);
      }    
  });
}

rejectRequestDueToLogger = function(response) {
  var body = {};
  body['message'] = rejectLoggerMessage;
  response.statusCode = 503;
  
  try {
    response.end(JSON.stringify(body), 'utf8');           
  } catch(e) {
    logger.log("Error while sending response: " + e + e.stack);
  }
}

processPostedJob = function(postData, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!logger.isWorking()) {
    rejectRequestDueToLogger(response);
  } else {
    jobHandler.processJobRequest(postData, function onProcessed(err, job) {
      var body = {};

      if (err) {
        switch(err.type) {
          case 'invalid':
            body['message'] = badRequestMessage;
            if (err['missingFields'] && err['missingFields'].length > 0) {
              body['message'] += " Missing fields: " + err['missingFields'].join(", ") + ".";
            }
            response.statusCode = 400;        
            break;
          case 'spawn':
            body['message'] = unableToSpawnMessage;
            response.statusCode = 500;
            break;
          case 'full':
          case 'shutdown':
            body['message'] = rejectMessage;
            response.statusCode = 503;      
            break;
        } 
      } else {
        body['message'] = acceptedMessage;
        body['job_id'] = job.internalId;
        response.statusCode = 202;        
      }

      try {
        response.end(JSON.stringify(body), 'utf8');           
      } catch(e) {
        logger.log("Error while posting new job: " + e + e.stack);
      }
    });
  }
}

processProbe = function(postData, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  var body = {};
  
  if (!logger.isWorking()) {
    rejectRequestDueToLogger(response);
  } else if (config['ffprobe']) {
    logger.log("Starting probe for: " + postData);
    
    probeHandler.doProbe(postData, function onProbed(err, probe) {
      if (err) {
        response.statusCode = 500;
        body['message'] = probeErrorMessage + " " + err;
        logger.log("Error while probing: " + body['message']);
      } else {
        response.statusCode = 200;
        body['ffprobe'] = probe;          
      }
      
      try {
        response.end(JSON.stringify(body), 'utf8');
      } catch(e) {
        logger.log("Error while sending probe response: " + e + e.stack);
      }
      
    });
  } else {
    // ffprobe not supported
    response.statusCode = 400;
    body['message'] = probeNotSupportedMessage;
    logger.log("An attempt was made to probe a file, but ffprobe support was not configured.");
    
    try {
      response.end(JSON.stringify(body), 'utf8');
    } catch(e) {
      logger.log("Error while sending probe response: " + e + e.stack);
    }
  }
}