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

      // Use default MongoDB URI if not provided
      const mongoUri = process.env.MONGODB_URI || 'mongodb://mongouser:mongopassword@localhost:27017/baileys?authSource=admin';
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
      
      // Test the connection
      await this.client.db(dbName).admin().ping();
      
      this.db = this.client.db(dbName);
      
      console.log('✅ Connected to MongoDB successfully');
      console.log(`📂 Database: ${dbName}`);
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      
      console.log('⚠️  Using memory store for sessions (no database connection)');
      console.log('💡 To use MongoDB persistence, start with:');
      console.log('   docker run -d --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=mongouser -e MONGO_INITDB_ROOT_PASSWORD=mongopassword mongo:7-jammy');
      
      // Always continue without database - use memory store
      return null;
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
    return this.db; // Return null if not connected, let caller handle
  }

  getClient() {
    return this.client; // Return client for session store
  }
  
  isConnected() {
    return this.db !== null;
  }

  // Helper method to get a collection
  getCollection(name) {
    const db = this.getDb();
    if (!db) {
      throw new Error('Database not connected');
    }
    return db.collection(name);
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;