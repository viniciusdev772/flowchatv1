const { MongoClient } = require('mongodb');
require('dotenv').config();

/**
 * @class Database
 * @classdesc Manages the connection to the MongoDB database. This class follows the singleton pattern to ensure a single database connection.
 */
class Database {
  /**
   * @constructor
   * Initializes the database client and connection to null.
   */
  constructor() {
    this.client = null;
    this.db = null;
  }

  /**
   * Connects to the MongoDB database using the URI and database name from environment variables.
   * If a connection is already established, it returns the existing database instance.
   * @returns {Promise<Db>} A promise that resolves to the database instance.
   * @throws {Error} If the connection to MongoDB fails.
   */
  async connect() {
    try {
      if (this.client) {
        return this.db;
      }


      const mongoUri = process.env.MONGODB_URI || 'mongodb://mongouser:mongopassword@mongodb:27017/baileys?authSource=admin';
      const dbName = process.env.DB_NAME || 'baileys';

      console.log('🔄 Connecting to MongoDB...');
      console.log(`📍 Connection URI: ${mongoUri}`);

      this.client = new MongoClient(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 8000,
      });

      await this.client.connect();


      await this.client.db(dbName).admin().ping();

      this.db = this.client.db(dbName);

      console.log('✅ Connected to MongoDB successfully');
      console.log(`📂 Database: ${dbName}`);
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      console.error('❌ MongoDB é obrigatório para este sistema funcionar!');


      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnects from the MongoDB database.
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        console.log('Disconnected from MongoDB');
      }
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
  }

  /**
   * Gets the database instance.
   * @returns {Db|null} The database instance, or null if not connected.
   */
  getDb() {
    return this.db;
  }

  /**
   * Gets the MongoClient instance.
   * @returns {MongoClient|null} The MongoClient instance, or null if not connected.
   */
  getClient() {
    return this.client;
  }

  /**
   * Checks if the database is connected.
   * @returns {boolean} True if connected, false otherwise.
   */
  isConnected() {
    return this.db !== null;
  }

  /**
   * Gets a collection from the database.
   * @param {string} name - The name of the collection.
   * @returns {Collection} The collection instance.
   * @throws {Error} If the database is not connected.
   */
  getCollection(name) {
    const db = this.getDb();
    if (!db) {
      throw new Error('Database not connected');
    }
    return db.collection(name);
  }
}

/**
 * @type {Database}
 * @description A singleton instance of the Database class.
 */
const database = new Database();

module.exports = database;