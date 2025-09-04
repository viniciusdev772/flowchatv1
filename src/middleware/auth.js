const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const database = require('../config/database');


const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;


setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      userCache.delete(key);
    }
  }
}, 60000);

const authenticateToken = async (req, res, next) => {
  try {

    let token = req.signedCookies.authToken;

    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const cacheKey = `user:${userId}`;


    const cachedUser = userCache.get(cacheKey);
    if (cachedUser && (Date.now() - cachedUser.timestamp) < CACHE_TTL) {
      req.user = cachedUser.data;
      return next();
    }


    try {
      const db = database.getDb();
      if (!db) {
        throw new Error('Database not available');
      }


      const users = database.getCollection('users');


      let userIdObj = userId;
      try {
        if (typeof userId === 'string' && userId.length === 24) {
          userIdObj = new ObjectId(userId);
        }
      } catch (error) {

      }

      const user = await users.findOne(
        { _id: userIdObj },
        {
          projection: {
            password: 0
          }
        }
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


      userCache.set(cacheKey, {
        data: user,
        timestamp: Date.now()
      });

      req.user = user;
    } catch (dbError) {

      if (process.env.NODE_ENV === 'development') {
        const mockUser = {
          _id: userId,
          name: 'Development User',
          email: 'dev@example.com',
          role: 'user',
          active: true,
          profile: { avatar: null, phone: null, company: null },
          stats: { totalSessions: 0, activeConnections: 0, messagesCount: 0 }
        };


        userCache.set(cacheKey, {
          data: mockUser,
          timestamp: Date.now()
        });

        req.user = mockUser;
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


const clearUserCache = (userId) => {
  const cacheKey = `user:${userId}`;
  userCache.delete(cacheKey);
};


const clearAllCache = () => {
  userCache.clear();
};

module.exports = {
  authenticateToken,
  requireRole,
  clearUserCache,
  clearAllCache
};