const { MongoClient } = require('mongodb');
require('dotenv').config();

class Database {
  constructor() {
    this.client = null;
    this.db = null;
  }

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

  getDb() {
    return this.db;
  }

  getClient() {
    return this.client;
  }

  isConnected() {
    return this.db !== null;
  }


  getCollection(name) {
    const db = this.getDb();
    if (!db) {
      throw new Error('Database not connected');
    }
    return db.collection(name);
  }
}


const database = new Database();

module.exports = database;