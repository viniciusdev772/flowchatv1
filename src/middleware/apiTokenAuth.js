const database = require('../config/database');

/**
 * Middleware to authenticate requests using an API token.
 * It checks for a 'Bearer' token in the 'Authorization' header,
 * validates it against the database, and attaches the user and token
 * information to the request object.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
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

    const token = authHeader.substring(7);
    console.log('🔍 Received token:', token.substring(0, 20) + '...');

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

    if (tokenDoc.expiresAt && new Date() > tokenDoc.expiresAt) {
      return res.status(401).json({
        success: false,
        message: 'Token de API expirado'
      });
    }

    const user = await db.collection('users').findOne({
      _id: tokenDoc.userId
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    await db.collection('api_tokens').updateOne(
      { _id: tokenDoc._id },
      { $set: { lastUsedAt: new Date() } }
    );

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