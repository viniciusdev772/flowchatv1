const database = require('../config/database');

/**
 * Middleware to authenticate API tokens for Baileys WhatsApp sessions
 */
const apiTokenAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth header missing or invalid format:', authHeader);
      return res.status(401).json({
        success: false,
        message: 'Token de API requerido'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔍 Received token:', token.substring(0, 20) + '...');
    
    // Check if token starts with baileys_ prefix
    if (!token.startsWith('baileys_')) {
      console.log('❌ Token does not start with baileys_ prefix');
      return res.status(401).json({
        success: false,
        message: 'Token de API inválido'
      });
    }

    const db = database.getDb();
    if (!db) {
      console.log('❌ Database not available');
      return res.status(503).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    // Find the token in database (direct comparison without hashing)
    console.log('🔍 Searching for token in database...');
    const tokenDoc = await db.collection('api_tokens').findOne({
      token: token,
      isActive: true
    });

    console.log('📄 Token found in DB:', !!tokenDoc);
    if (tokenDoc) {
      console.log('📄 Token details - isActive:', tokenDoc.isActive, 'expiresAt:', tokenDoc.expiresAt);
    }

    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Token de API inválido ou inativo'
      });
    }

    // Check if token is expired
    if (tokenDoc.expiresAt && new Date() > tokenDoc.expiresAt) {
      return res.status(401).json({
        success: false,
        message: 'Token de API expirado'
      });
    }

    // Get user information
    const user = await db.collection('users').findOne({
      _id: tokenDoc.userId
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Update last used timestamp
    await db.collection('api_tokens').updateOne(
      { _id: tokenDoc._id },
      { $set: { lastUsedAt: new Date() } }
    );

    // Attach user and token info to request
    req.user = user;
    req.apiToken = tokenDoc;
    
    next();

  } catch (error) {
    console.error('API Token authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = apiTokenAuth;