const csrf = require('csrf');
const crypto = require('crypto');

class CSRFProtection {
  constructor() {
    this.tokens = csrf();
    this.secret = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
  }


  generateToken(req) {
    if (!req.session) {
      req.session = {};
    }

    if (!req.session.csrfSecret) {
      req.session.csrfSecret = this.tokens.secretSync();
    }

    return this.tokens.create(req.session.csrfSecret);
  }

  addTokenToResponse() {
    return (req, res, next) => {
      try {

        if (req.method === 'GET' && req.path.includes('csrf-token')) {
          const token = this.generateToken(req);


          res.header('Access-Control-Expose-Headers', 'X-CSRF-Token');
          res.header('X-CSRF-Token', token);

          return res.json({
            success: true,
            csrfToken: token,
            message: 'Token CSRF gerado com sucesso'
          });
        }
        next();
      } catch (error) {
        console.error('Erro ao gerar token CSRF:', error);
        res.status(500).json({
          success: false,
          message: 'Erro interno do servidor'
        });
      }
    };
  }

  verifyToken() {
    return (req, res, next) => {
      try {

        if (req.method === 'GET') {
          return next();
        }


        const token = req.headers['x-csrf-token'] ||
                     req.headers['csrf-token'] ||
                     req.body._csrf ||
                     req.query._csrf;

        if (!token) {
          return res.status(403).json({
            success: false,
            message: 'Token CSRF ausente. Requisição rejeitada por segurança.',
            error: 'CSRF_TOKEN_MISSING'
          });
        }


        if (!req.session || !req.session.csrfSecret) {
          return res.status(403).json({
            success: false,
            message: 'Sessão inválida. Recarregue a página e tente novamente.',
            error: 'INVALID_SESSION'
          });
        }


        const isValid = this.tokens.verify(req.session.csrfSecret, token);

        if (!isValid) {
          return res.status(403).json({
            success: false,
            message: 'Token CSRF inválido. Possível ataque detectado.',
            error: 'INVALID_CSRF_TOKEN'
          });
        }


        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Token CSRF validado com sucesso');
        }

        next();
      } catch (error) {
        console.error('Erro na verificação CSRF:', error);
        res.status(500).json({
          success: false,
          message: 'Erro interno do servidor',
          error: 'CSRF_VERIFICATION_ERROR'
        });
      }
    };
  }

  verifyAuthToken() {
    return (req, res, next) => {
      try {
        if (req.method === 'GET') {
          return next();
        }


        const token = req.headers['x-csrf-token'] ||
                     req.headers['csrf-token'] ||
                     req.body._csrf;

        if (!token) {

          console.warn(`Tentativa de auth sem CSRF token do IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

          return res.status(403).json({
            success: false,
            message: 'Acesso negado. Token de segurança obrigatório.',
            error: 'CSRF_REQUIRED'
          });
        }

        if (!req.session || !req.session.csrfSecret) {
          console.warn(`Tentativa de auth com sessão inválida do IP: ${req.ip}`);
          console.warn('Debug session:', {
            hasSession: !!req.session,
            sessionId: req.session?.id,
            hasCsrfSecret: !!(req.session?.csrfSecret),
            cookies: req.headers.cookie,
            origin: req.headers.origin || req.headers.referer
          });

          return res.status(403).json({
            success: false,
            message: 'Sessão de segurança inválida. Acesso negado.',
            error: 'INVALID_SECURITY_SESSION'
          });
        }

        const isValid = this.tokens.verify(req.session.csrfSecret, token);

        if (!isValid) {
          console.warn(`Token CSRF inválido em tentativa de auth do IP: ${req.ip}`);

          return res.status(403).json({
            success: false,
            message: 'Token de segurança inválido. Possível ataque detectado.',
            error: 'SECURITY_VIOLATION'
          });
        }


        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Token CSRF validado com sucesso para auth');
        }

        next();
      } catch (error) {
        console.error('Erro na verificação CSRF de auth:', error);
        res.status(500).json({
          success: false,
          message: 'Erro interno de segurança',
          error: 'AUTH_CSRF_ERROR'
        });
      }
    };
  }

  refreshToken() {
    return (req, res, next) => {
      try {

        if (req.session && req.session.csrfSecret &&
            (req.path.includes('login') || req.path.includes('register'))) {

          const newToken = this.generateToken(req);


          const originalJson = res.json;
          res.json = function(data) {
            if (data && data.success) {
              data.newCsrfToken = newToken;

              res.header('X-New-CSRF-Token', newToken);
            }
            return originalJson.call(this, data);
          };
        }

        next();
      } catch (error) {
        console.error('Erro ao refresh CSRF token:', error);
        next();
      }
    };
  }


  clearSession() {
    return (req, res, next) => {
      if (req.session) {
        delete req.session.csrfSecret;
      }
      next();
    };
  }
}


const csrfProtection = new CSRFProtection();

module.exports = csrfProtection;