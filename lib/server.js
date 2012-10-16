var config       = require('./config').load(),
    jobHandler   = require('./job-handler'),
    probeHandler = require('./probe-handler'),
		fs				   = require('fs'),
		util         = require('util'),
    express      = require('express');

var rejectMessage =            'The transcoder is not accepting jobs right now. Please try again later.';
var acceptedMessage =          'The transcoder accepted your job.';
var notImplementedMessage =    'This method is not yet implemented.';
var badRequestMessage =        'The data supplied was not valid.';
var notFoundMessage =          'The specified job could not be found.';
var probeNotSupportedMessage = 'Probing files is not supported. Make sure you add the \'ffprobe\' configuration option.';
var probeErrorMessage =        'An error occurred while probing the file.';
var probeFfprobeError =        'ffprobe returned invalid JSON.';

var logfile = null;  
var server = null;

exports.launch = function() {
  logfile = fs.createWriteStream(config['access_log'], { flags: 'a' });

  server = express.createServer(express.logger({stream: logfile}));

  server.get(   '/jobs',     getJobs);
  server.post(  '/jobs',     postNewJob);
  server.get(   '/jobs/:id', getJobStatus);
  server.delete('/jobs/:id', removeJob);
  server.post(  '/probe',    probeFile);
  
  server.listen(config['port'], config['interface']);
    
  util.log("Started server on interface " + config['interface'] + " port " + config['port'] + " with pid " + process.pid + ".");  	
}

exports.relaunch = function() {
  util.log("Restarting...");
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
    util.log("Error while getting all jobs: " + e + e.stack);
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
      util.log("Error while getting job status: " + e + e.stack);
    }
  });
}

// DELETE /jobs/:id
removeJob = function(request, response) {
  jobHandler.cancelAndRemove(request.params.id, function onResult(err, job) {
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
      util.log("Error while deleting job: " + e + e.stack);
    }    
  });
}

processPostedJob = function(postData, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  jobHandler.processJobRequest(postData, function(err, job) {
	  var body = {};

		if (err) {
			switch(err.type) {
				case 'invalid':
			    body['message'] = badRequestMessage;
			    if (err['missingFields'].length > 0) {
			      body['message'] += " Missing fields: " + err['missingFields'].join(", ") + ".";
			    }
			    response.statusCode = 400;				
					break;
				case 'full':
				case 'shutdown':
					body['message'] = rejectMessage;
      		response.statusCode = 503;			
      		break;
			}	
		} else {
      body['message'] = acceptedMessage;
      body['job_id'] = job.id;
      response.statusCode = 202;				
		}
		
		try {
  	  response.end(JSON.stringify(body), 'utf8');					  
		} catch(e) {
      util.log("Error while posting new job: " + e + e.stack);
    }
	});
}

processProbe = function(postData, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  var body = {};
  
  if (config['ffprobe']) {
    // Do probe
    util.log("Starting probe for: " + postData);
    
    probeHandler.doProbe(postData, function(error, stdout, stderr) {
      if (error !== null) {
        // something went wrong
        response.statusCode = 500;
        body['message'] = probeErrorMessage;
        if (error.message) body['message'] += " " + error.message;
        if (stderr) body['message'] += " " + stderr;
        util.log("Error while probing: " + body['message']);
      } else {
        // everything's ok
        response.statusCode = 200;
        try {
          util.log("Succesfully completed probe for: " + postData);
          body['ffprobe'] = JSON.parse(stdout);          
        } catch(e) {
          util.log("Error while parsing ffprobe response: " + stdout);
          response.statuscode = 500;
          body['message'] = probeFfprobeError;
          if (stdout) body['message'] += " ffprobe output: " + stdout;
        }
      }
      
      try {
        response.end(JSON.stringify(body), 'utf8');
      } catch(e) {
        util.log("Error while sending probe response: " + e + e.stack);
      }
      
    });
  } else {
    // Return not supported
    response.statusCode = 400;
    body['message'] = probeNotSupportedMessage;
    util.log("An attempt was made to probe a file, but ffprobe support was not configured.");
    
    try {
      response.end(JSON.stringify(body), 'utf8');
    } catch(e) {
      util.log("Error while sending probe response: " + e + e.stack);
    }
  }
}