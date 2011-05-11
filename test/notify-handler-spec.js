var Job = require('../lib/job.js'),
    notifyHandler = require('../lib/notify-handler.js'),
    http = require('http'),
    url  = require('url'),
    util = require('util');
    
describe("Notifications handler", function() {
  var job;
  
  beforeEach(function () {
    job = new Job({});
    spyOn(http, "request").andReturn({});
    spyOn(util, "log");
  });
  
  describe("without callback urls", function() {
    it("should not do anything", function() {
      notifyHandler.notify(job);
      expect(http.request).not.toHaveBeenCalled();
    });
  });
  
  describe("with callback urls", function() {
    it("should notify the URL's", function() {
      spyOn(url, "parse").andReturn({ port: 1234, hostname: 'foo', pathname: '/', search: 'bar' });
      job.opts = { callback_urls: ['url1', 'url2'] };
      
      notifyHandler.notify(job);
      expect(http.request).toHaveBeenCalled();
      expect(http.request.callCount).toEqual(2);
    });
  });
});