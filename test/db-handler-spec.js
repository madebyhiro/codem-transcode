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
    
    spyOn(db, 'run');
    spyOn(Job, 'generateId').andReturn('the_id');
    
    var job = new Job({ foo: 'bar' });
    
    dbHandler.insertJob(job, callbackSpy);
    
    // Nasty expects due to JavaScript behaviour: [] != []
    expect(db.run.mostRecentCall.args[0]).toEqual("INSERT INTO jobs VALUES (?,?,?,?,?,?,?,strftime('%s', 'now'),strftime('%s', 'now'))");
    expect(db.run.mostRecentCall.args[1].toString()).toEqual('the_id,processing,NaN,NaN,NaN,{"foo":"bar"},');
    expect(db.run.mostRecentCall.args[2]).toEqual(callbackSpy);
  });
  
  it("should be able to find a job", function() {
    var db = dbHandler.getDatabase(':memory:');

    var callbackSpy = jasmine.createSpy("callback");
    
    spyOn(db, 'get');
    
    dbHandler.getJob('123', callbackSpy);
    
    expect(db.get).toHaveBeenCalledWith('SELECT * FROM jobs WHERE id LIKE ? LIMIT 1', ['123'], callbackSpy);
  });
  
  it("should be able to update a job", function() {
    var db = dbHandler.getDatabase(':memory:');

    var callbackSpy = jasmine.createSpy("callback");
    
    spyOn(db, 'run');
    spyOn(Job, 'generateId').andReturn('the_id');
    
    var job = new Job({ foo: 'bar' });
    
    dbHandler.updateJob(job, callbackSpy);
    
    // Nasty expects due to JavaScript behaviour: [] != []
    expect(db.run.mostRecentCall.args[0]).toEqual("UPDATE jobs SET status=?, progress=?, duration=?, filesize=?, message=?, updated_at=strftime('%s', 'now') WHERE id LIKE ?");
    expect(db.run.mostRecentCall.args[1].toString()).toEqual('processing,NaN,NaN,NaN,,the_id');
    expect(db.run.mostRecentCall.args[2]).toEqual(callbackSpy);
  });
  
  it("should be able to close the database", function() {
    var db = dbHandler.getDatabase(':memory:');
    spyOn(db, 'close');
    
    dbHandler.closeDatabase();
    
    expect(db.close).toHaveBeenCalled();
  });
});