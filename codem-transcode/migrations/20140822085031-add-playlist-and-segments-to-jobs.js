module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here
    migration.addColumn('Jobs', 'playlist', { type: DataTypes.STRING, defaultValue: null }).complete(done);
    migration.addColumn('Jobs', 'segments', { type: DataTypes.TEXT, defaultValue: null }).complete(done);
  },
  down: function(migration, DataTypes, done) {
    // add reverting commands here
    migration.removeColumn('Jobs', 'playlist').complete(done);
    migration.removeColumn('Jobs', 'segments').complete(done);
  }
}
