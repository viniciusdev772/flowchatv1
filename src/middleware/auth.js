const jwt = require('jsonwebtoken');
const database = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    // Try to get token from signed cookies first, then from Authorization header
    let token = req.signedCookies.authToken;
    
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if database is available
    try {
      const db = database.getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      // Get user from database
      const users = database.getCollection('users');
      const user = await users.findOne(
        { _id: decoded.userId },
        { projection: { password: 0 } } // Exclude password
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.active) {
        return res.status(401).json({
          success: false,
          message: 'Account deactivated'
        });
      }

      req.user = user;
    } catch (dbError) {
      // In development mode without database, create a mock user
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Using mock user for development');
        req.user = {
          _id: decoded.userId,
          name: 'Development User',
          email: 'dev@example.com',
          role: 'user',
          active: true
        };
      } else {
        throw dbError;
      }
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};