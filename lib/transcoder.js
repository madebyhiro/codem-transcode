var util         = require('util'), 
		server       = require('./server'),
		dbHandler    = require('./db-handler'),
		config       = require('./config').load();

var Transcoder = function() {
}

Transcoder.prototype.boot = function() {
  dbHandler.prepareDatabase(config['database']);
  this.addSignalHandlers();  
  server.launch();
}

Transcoder.prototype.addSignalHandlers = function() {
  var transcoder = this;

  process.on('uncaughtException', function onException(err) { util.log('Caught exception: ' + err); });
  
  process.on('SIGTERM', function onSigTerm() { transcoder.shutdown('SIGTERM'); });
  process.on('SIGINT',  function onSigInt()  { transcoder.shutdown('SIGINT'); });
  process.on('SIGUSR1', function onSigUsr1() { server.relaunch(); });
  
  process.on('exit', function onExit() { dbHandler.closeDatabase(); });  
}

Transcoder.prototype.shutdown = function(signal) {
  util.log('Received ' + signal);

  // TODO:
  // Stop accepting jobs
  // Wait for all jobs to finish
  
  process.exit(0);
}

module.exports = Transcoder;