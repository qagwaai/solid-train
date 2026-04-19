'use strict';

const mongoose = require('mongoose');

/**
 * Mongoose connection management for MongoDB
 */
class MongoConnection {
  constructor(options = {}) {
    this.mongoUri = options.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/solid-train';
    this.options = options.mongooseOptions || {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 5000
    };
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected) {
      console.log('[db] Already connected to MongoDB');
      return;
    }

    try {
      await mongoose.connect(this.mongoUri, this.options);
      this.isConnected = true;
      console.log(`[db] Connected to MongoDB at ${this.mongoUri}`);
    } catch (error) {
      console.error('[db] Failed to connect to MongoDB:', error.message);
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
      console.log('[db] Disconnected from MongoDB');
    } catch (error) {
      console.error('[db] Error disconnecting from MongoDB:', error.message);
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
  MongoConnection
};
