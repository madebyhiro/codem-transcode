var sqlite3 = require('sqlite3');

var db = null;

exports.prepareDatabase = function(dbfile, callback) {
  db = this.getDatabase(dbfile);
  // set up database and create tables
  db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, status TEXT, progress REAL, duration INTEGER, filesize INTEGER, opts TEXT, message TEXT, created_at INTEGER, updated_at INTEGER);");
    db.run("UPDATE jobs SET status='failed', message='transcoder quit unexpectedly', updated_at=strftime('%s', 'now') WHERE status LIKE 'processing';", callback);
  });
}

exports.insertJob = function(job, callback) {
  var stmt = db.prepare("INSERT INTO jobs VALUES (?,?,?,?,?,?,?,strftime('%s', 'now'),strftime('%s', 'now'))");
  stmt.run(job.id, job.status, job.progress, job.duration, job.filesize, JSON.stringify(job.opts), job.message, callback);
}

exports.updateJob = function(job, callback) {
  var stmt = db.prepare("UPDATE jobs SET status=?, progress=?, duration=?, filesize=?, message=?, updated_at=strftime('%s', 'now') WHERE id LIKE ?");
  stmt.run(job.status, job.progress, job.duration, job.filesize, job.message, job.id, callback);
}

exports.getJob = function(id, callback) {
  var stmt = db.prepare("SELECT * FROM jobs WHERE id LIKE ? LIMIT 1");
  stmt.get(id, callback);
}

exports.closeDatabase = function() {
  db.close();
}

exports.getDatabase = function(dbfile) {
  if (db == null) {
    db = new sqlite3.Database(dbfile);
  }
  return db;
}