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

      console.log('🔄 Connecting to MongoDB...');
      console.log(`📍 Connection URI: ${process.env.MONGODB_URI}`);
      
      this.client = new MongoClient(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 8000,
      });

      await this.client.connect();
      
      // Test the connection
      await this.client.db(process.env.DB_NAME).admin().ping();
      
      this.db = this.client.db(process.env.DB_NAME);
      
      console.log('✅ Connected to MongoDB successfully');
      console.log(`📂 Database: ${process.env.DB_NAME}`);
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      
      if (error.message.includes('ECONNREFUSED')) {
        console.log('💡 Make sure MongoDB is running on your system');
        console.log('   - Windows: net start mongodb');
        console.log('   - macOS/Linux: brew services start mongodb-community');
        console.log('   - Docker: docker run -d -p 27017:27017 mongo');
      }
      
      // Don't throw in development, continue without database
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Running without database connection in development mode');
        return null;
      }
      
      throw error;
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