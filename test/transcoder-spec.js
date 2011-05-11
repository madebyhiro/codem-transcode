var Transcoder = require('../lib/transcoder.js'),
    dbHandler = require('../lib/db-handler.js'),
    server = require('../lib/server.js'),
    util = require('util');

describe("A transcoder", function() {
  var transcoder;
  
  beforeEach(function() {
    transcoder = new Transcoder();
  });
  
  it("should be able to boot", function() {
    spyOn(dbHandler, "prepareDatabase");
    spyOn(transcoder, "addSignalHandlers");
    spyOn(server, "launch");

    transcoder.boot();
    
    expect(dbHandler.prepareDatabase).toHaveBeenCalled();
    expect(transcoder.addSignalHandlers).toHaveBeenCalled();
    expect(server.launch).toHaveBeenCalled();
  });
  
  it("should be able to add process listeners", function() {
    spyOn(process, "on");
    
    transcoder.addSignalHandlers();

    expect(process.on).toHaveBeenCalled();
    expect(process.on.callCount).toEqual(5);
  });
  
  it("should be able to shutdown", function() {
    spyOn(process, "exit");
    spyOn(util, "log");
    
    transcoder.shutdown();
    
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});