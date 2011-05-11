var config       = require('../config').load(),
    jobHandler   = require('./job-handler'),
		fs				   = require('fs'),
		util         = require('util'),
    connect      = require('connect');

var rejectMessage =         'The transcoder is not accepting jobs right now. Please try again later.';
var acceptedMessage =       'The transcoder accepted your job.';
var notImplementedMessage = 'This method is not yet implemented.';
var badRequestMessage =     'The data supplied was not valid.';
var notFoundMessage =       'The specified job could not be found.';

var routes = function(app) {
  app.get( '/jobs',     getJobs);
  app.post('/jobs',     postNewJob);
  app.get( '/jobs/:id', getJobStatus);
}

var logfile = null;  
var server = null;

exports.launch = function() {
  logfile = fs.createWriteStream(config['access_log'], { flags: 'a' });
  server = connect.createServer(connect.logger({stream: logfile}));
  server.use(connect.router(routes));
  server.listen(config['port'], config['interface']);
  util.log("Started server on interface " + config['interface'] + " port " + config['port'] + " with pid " + process.pid + ".");  	
}

exports.relaunch = function() {
  util.log("Restarting...");
  server.close();
  logfile.end();
  exports.launch();
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

  response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
  response.end(JSON.stringify(content), 'utf8');    
}

// GET /jobs/:id
getJobStatus = function(request, response) {
	jobHandler.find(request.params.id, function onResult(err, result) {
	  var body = {};

    if (err || !result) {
      response.statusCode = 404;
      body['message'] = notFoundMessage;            
    } else {
      response.statusCode = 200;
      body = result;
    }
	  response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body), 'utf8');  
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
		
	  response.end(JSON.stringify(body), 'utf8');			
	});
}