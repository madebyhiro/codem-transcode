var Job = require('../lib/job.js'),
    dbHandler = require('../lib/db-handler.js'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    child_process = require('child_process');

describe("A job", function() {
  describe("when initialized", function() {
    var job;

    beforeEach(function() {
      job = new Job({});

      this.addMatchers({
        toBeNaN: function() { return isNaN(this.actual); }
      });
    });

    it("should have the correct default values", function() {
      expect(job.filesize).toBeNaN();
      expect(job.duration).toBeNaN();
      expect(job.progress).toBeNaN();
      expect(job.status).toEqual('processing');
      expect(job.message).toBeNull();
      expect(job.opts).toEqual({});
    });

    it("should generate an ID", function() {
      var id = Job.generateId();
      expect(id.length).toEqual(40);
    });

    describe("with some initial values", function() {
      beforeEach(function() {
        job.filesize = 666;
        job.duration = 12;
        job.progress = 0.6;
        job.message = 'foo';
      });

      it("should return the correct JSON representation", function() {
        expect(JSON.stringify(job)).toMatch(/\{"id":"\w{40}","status":"processing","progress":0.6,"duration":12,"filesize":666,"message":"foo"\}/);
      });
    });
  });

  describe("when finding", function() {
    it("should call the dbhandler", function() {
      spyOn(dbHandler, "getJob");
      var callbackSpy = jasmine.createSpy("callback");
      
      Job.find('1234', callbackSpy);

      expect(dbHandler.getJob).toHaveBeenCalled();
    });
  });

  describe("when created", function() {
    beforeEach(function() {
      this.addMatchers({
        toBeInstanceOf: function(the_type) { return this.actual instanceof the_type; }
      });
    });

    it("should insert the job into the database", function() {
      spyOn(Job.prototype, "prepare");
      spyOn(dbHandler, "insertJob");

      var job = Job.create({}, null);

      expect(dbHandler.insertJob).toHaveBeenCalled();
      expect(job.prepare).toHaveBeenCalled();
      expect(job).toBeInstanceOf(Job);
    });
  });

  describe("when received progress", function() {
    var job;

    beforeEach(function() {
      job = new Job({});
      spyOn(job, "update");
      spyOn(job, "extractDuration");
      spyOn(job, "extractProgress");
    });

    describe("without a duration", function() {
      it("should extract the duration", function() {
        job.progressHandler("foo");

        expect(job.extractDuration).toHaveBeenCalledWith("foo");
        expect(job.extractProgress).not.toHaveBeenCalled();
        expect(job.lastMessage).toEqual("foo");
      });
    });

    describe("with a duration", function() {
      it("should extract the progress", function() {
        job.duration = 12;
        job.progressHandler("bar");

        expect(job.extractDuration).not.toHaveBeenCalled();
        expect(job.extractProgress).toHaveBeenCalledWith("bar");
        expect(job.lastMessage).toEqual("bar");      
      });    
    });
  });

  describe("when prepared", function() {
    var job;

    beforeEach(function() {
      var opts = { source_file: __dirname + '/fixtures/bar.wmv', destination_file: __dirname + '/fixtures/bar.mp4' };
      job = new Job(opts);
      spyOn(job, "spawn");
      spyOn(job, "exitHandler");
      spyOn(fs, "stat");
      spyOn(mkdirp, "mkdirp");
    });

    it("should see if the input file is available", function() {
      job.prepare();
      expect(fs.stat).toHaveBeenCalled();
    });

    it("should see if the output directory is available", function() {
      job.prepare();
      expect(mkdirp.mkdirp).toHaveBeenCalled();
    });
  });
  
  describe("when spawned", function() {
    var job;
    
    beforeEach(function() {
      spyOn(Job, "generateId").andReturn('id');

      var opts = { source_file: __dirname + '/fixtures/bar.wmv', destination_file: __dirname + '/fixtures/bar.mp4' };
      job = new Job(opts);
      var mock_process = { stderr: { on: function(arg1,arg2) {} }, on: function(arg1,arg2) {} };
      
      spyOn(child_process, "spawn").andReturn(mock_process);
    });
    
    describe("without options", function() {
      it("should not spawn a child process", function() {
        job.spawn();
        expect(child_process.spawn).not.toHaveBeenCalled();
      });
    });
    
    describe("with options", function() {
      it("should spawn a child process", function() {
        job.hasInput = true;
        job.hasOutputDir = true;
        job.opts = { source_file: '/foo/bar.wmv', destination_file: '/foo/bar.mp4', encoder_options: 'baz' };
        job.spawn();
        expect(child_process.spawn).toHaveBeenCalledWith('ffmpeg', [ '-i', '/foo/bar.wmv', 'baz', '/tmp/id.mp4' ]);
      });
    });
  });
  
  describe("when finalized", function() {
    var job;
    
    beforeEach(function() {
      job = new Job({});
      spyOn(fs, "rename");
      spyOn(job, "exitHandler");
    });
    
    describe("with normal exit code", function() {
      it("should attempt to move the file to the destination", function() {
        job.finalize(0, 'foo');
        expect(fs.rename).toHaveBeenCalled();
        expect(job.exitHandler).not.toHaveBeenCalled();
      });
    });
    
    describe("with abnormal exit code", function() {
      it("should should generate an error", function() {
        job.finalize(-1, 'foo');
        expect(fs.rename).not.toHaveBeenCalled();        
        expect(job.exitHandler).toHaveBeenCalled();
      });      
    });
  });
});
