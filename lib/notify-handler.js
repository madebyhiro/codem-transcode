var url  = require('url'),
		http = require('http'),
		util = require('util');

exports.notify = function(job) {
	var opts = job.opts;
	
	if (opts['callback_urls'] instanceof Array) {
	  for (var u in opts['callback_urls']) {
	    util.log('Callback URL: ' + opts['callback_urls'][u]);
	    try {
	      var obj = url.parse(opts['callback_urls'][u]);
	      var data = JSON.stringify(job);
	      var urlOpts = {
	        method: 'PUT',
	        port: obj.port,
	        host: obj.hostname,
	        path: [obj.pathname, obj.search].join(''),
	        headers: { 'Content-Type': 'application/json',
	                   'Accept': 'application/json',
	                   'Content-Length': data.length
	        }
	      };
				var req = http.request(urlOpts, function(res) {
	        util.log('Notification completed with HTTP status code: ' + res.statusCode);
	      }).on('error', function(err) {
						util.log("Failed delivering notification due to connection error: " + err);
				});
	      req.write(data);
	      req.end();
	    } catch (error) {
	      util.log("Failed delivering notification: " + error);
	    }
	  }
	}
}
