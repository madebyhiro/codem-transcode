var logger       = require('./logger'), 
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

  process.on('uncaughtException', function onException(err) { logger.log('Caught exception: ' + err); });
  
  process.on('SIGTERM', function onSigTerm() { transcoder.shutdown('SIGTERM'); });
  process.on('SIGINT',  function onSigInt()  { transcoder.shutdown('SIGINT'); });
  process.on('SIGUSR1', function onSigUsr1() { server.relaunch(); });
  
  process.on('exit', function onExit() { dbHandler.closeDatabase(); logger.flush(); logger.stop(); });  
}

Transcoder.prototype.shutdown = function(signal) {
  logger.log('Received ' + signal);
  process.exit(0);
}

module.exports = Transcoder;