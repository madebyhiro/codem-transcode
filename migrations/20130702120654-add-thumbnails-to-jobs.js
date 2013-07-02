module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here
    migration.addColumn('jobs', 'thumbnails', { type: DataTypes.TEXT, defaultValue: null }).complete(done);
  },
  down: function(migration, DataTypes, done) {
    // add reverting commands here
    migration.removeColumn('jobs', 'thumbnails').complete(done);
  }
}