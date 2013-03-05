module.exports = {
  up: function(migration, DataTypes) {
    // add altering commands here
    migration.createTable('jobs',
      {
        id:          { type: DataTypes.INTEGER, primaryKey: true },
        internalId:  { type: DataTypes.STRING, defaultValue: null },
        status:      { type: [ "success", "failed", "processing", "unknown" ], defaultValue: "processing" },
        progress:    { type: DataTypes.FLOAT, defaultValue: 0.0 },
        duration:    { type: DataTypes.INTEGER, defaultValue: 0 },
        filesize:    { type: DataTypes.INTEGER, defaultValue: 0 },
        opts:        { type: DataTypes.TEXT, defaultValue: null },
        message:     { type: DataTypes.TEXT, defaultValue: null },
        createdAt:   DataTypes.DATE,
        updatedAt:   DataTypes.DATE
      }
    )
    migration.addIndex('jobs', ['internalId'])
  },
  down: function(migration) {
    // add reverting commands here
    migration.dropTable('jobs')
  }
}