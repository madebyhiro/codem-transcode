var jobHandler = require('../lib/job-handler.js'),
    Job = require('../lib/job.js');

describe("A job handler", function() {
  it("should be able to find a job", function() {
    spyOn(Job, "find");
    var callbackSpy = jasmine.createSpy("callback");
    
    jobHandler.find('123', callbackSpy);
    
    expect(Job.find).toHaveBeenCalledWith('123', callbackSpy);
  });
  
  it("should be able to return the free slots", function() {
    
  });
  
  it("should process a job request", function() {
    
  });
});