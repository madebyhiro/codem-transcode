var logger       = require('./logger'), 
		server       = require('./server'),
		config       = require('./config').load(),
		Job          = require('./job');

var Transcoder = function() {
}

Transcoder.prototype.boot = function() {
  this.addSignalHandlers();
  Job.prepareDatabase(function (err) {
    if (err) {
      // something went wrong
      logger.log("Error while preparing database for the transcoder.");
      process.exit(-1);
    }
  });
  server.launch();
}

Transcoder.prototype.addSignalHandlers = function() {
  var transcoder = this;

  process.on('uncaughtException', function onException(err) { logger.log('Caught exception: ' + err); });
  
  process.on('SIGTERM', function onSigTerm() { transcoder.shutdown('SIGTERM'); });
  process.on('SIGINT',  function onSigInt()  { transcoder.shutdown('SIGINT'); });
  process.on('SIGUSR1', function onSigUsr1() { server.relaunch(); });
  
  process.on('exit', function onExit() { logger.flush(); logger.stop(); });  
}

Transcoder.prototype.shutdown = function(signal) {
  logger.log('Received ' + signal);
  process.exit(0);
}

module.exports = Transcoder;