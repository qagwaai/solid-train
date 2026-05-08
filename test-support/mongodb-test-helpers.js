'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoConnection } = require('../src/db/connection');
const { DatabaseService } = require('../src/db/service');

async function createMongoTestHarness() {
  const mongoServer = await MongoMemoryServer.create();
  const mongoConnection = new MongoConnection({
    mongoUri: mongoServer.getUri(),
    mongooseOptions: {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    },
  });

  await mongoConnection.connect();

  return {
    mongoServer,
    mongoConnection,
    databaseService: new DatabaseService(),
    async clearDatabase() {
      const collections = Object.values(mongoose.connection.collections);
      await Promise.all(collections.map((collection) => collection.deleteMany({})));
    },
    async teardown() {
      await mongoConnection.disconnect();
      await mongoServer.stop();
    },
  };
}

module.exports = {
  createMongoTestHarness,
};
