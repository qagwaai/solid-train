'use strict';

const mongoose = require('mongoose');
const { createLogger } = require('../logging/logger');

/**
 * Mongoose connection management for MongoDB
 */
class MongoConnection {
  constructor(options = {}) {
    this.mongoUri =
      options.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/solid-train';
    this.options = options.mongooseOptions || {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 5000,
    };
    this.logger =
      options.logger ||
      createLogger({ minLevel: options.logLevel || process.env.LOG_LEVEL || 'info' });
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected) {
      this.logger.debug('[db] Already connected to MongoDB');
      return;
    }

    try {
      await mongoose.connect(this.mongoUri, this.options);
      this.isConnected = true;
      this.logger.info(`[db] Connected to MongoDB at ${this.mongoUri}`);
    } catch (error) {
      this.logger.error(`[db] Failed to connect to MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      this.logger.info('[db] Disconnected from MongoDB');
    } catch (error) {
      this.logger.error(`[db] Error disconnecting from MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current connection status
   * @returns {boolean}
   */
  getConnectionStatus() {
    return this.isConnected;
  }
}

module.exports = {
  MongoConnection,
};
