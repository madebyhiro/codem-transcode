var dbHandler = require('../lib/db-handler.js'),
    Job = require('../lib/job.js');

describe("A database handler", function() {
  it("should be able to prepare the database", function() {
    var db = dbHandler.getDatabase(':memory:');
    var callback = jasmine.createSpy();
    
    spyOn(db, 'run');

    dbHandler.prepareDatabase(':memory:', callback);
    
    expect(db.run).toHaveBeenCalledWith("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, status TEXT, progress REAL, duration INTEGER, filesize INTEGER, opts TEXT, message TEXT, created_at INTEGER, updated_at INTEGER);");
    expect(db.run).toHaveBeenCalledWith("UPDATE jobs SET status='failed', message='transcoder quit unexpectedly', updated_at=strftime('%s', 'now') WHERE status LIKE 'processing';", callback);
  });
  
  it("should be able to insert a job", function() {
    var db = dbHandler.getDatabase(':memory:');

    var callbackSpy = jasmine.createSpy("callback");
    var runSpy = jasmine.createSpy("run");
    
    spyOn(db, 'prepare').andReturn({ run: runSpy });
    spyOn(Job, 'generateId').andReturn('the_id');
    
    var job = new Job({ foo: 'bar' });
    
    dbHandler.insertJob(job, callbackSpy);
    
    expect(db.prepare).toHaveBeenCalledWith("INSERT INTO jobs VALUES (?,?,?,?,?,?,?,strftime('%s', 'now'),strftime('%s', 'now'))");
    expect(runSpy).toHaveBeenCalled();
  });
  
  it("should be able to find a job", function() {
    // pending
  });
  
  it("should be able to update a job", function() {
    // pending
  });
  
  it("should be able to close the database", function() {
    // pending
  });
});