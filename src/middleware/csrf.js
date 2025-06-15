const csrf = require('csrf');
const crypto = require('crypto');

class CSRFProtection {
  constructor() {
    this.tokens = csrf();
    this.secret = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
  }

  // Gerar token CSRF
  generateToken(req) {
    if (!req.session) {
      req.session = {};
    }
    
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = this.tokens.secretSync();
    }
    
    return this.tokens.create(req.session.csrfSecret);
  }

  // Middleware para adicionar token CSRF à resposta
  addTokenToResponse() {
    return (req, res, next) => {
      try {
        // Gerar token apenas para GET requests de páginas
        if (req.method === 'GET' && req.path.includes('csrf-token')) {
          const token = this.generateToken(req);
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

  // Middleware para verificar token CSRF
  verifyToken() {
    return (req, res, next) => {
      try {
        // Pular verificação para GET requests
        if (req.method === 'GET') {
          return next();
        }

        // Verificar se é modo desenvolvimento e pular se necessário
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_CSRF === 'true') {
          console.log('⚠️  CSRF verificação pulada em modo desenvolvimento');
          return next();
        }

        // Obter token do header ou body
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

        // Verificar se existe sessão com secret
        if (!req.session || !req.session.csrfSecret) {
          return res.status(403).json({
            success: false,
            message: 'Sessão inválida. Recarregue a página e tente novamente.',
            error: 'INVALID_SESSION'
          });
        }

        // Verificar token
        const isValid = this.tokens.verify(req.session.csrfSecret, token);
        
        if (!isValid) {
          return res.status(403).json({
            success: false,
            message: 'Token CSRF inválido. Possível ataque detectado.',
            error: 'INVALID_CSRF_TOKEN'
          });
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

  // Middleware específico para autenticação (mais rigoroso)
  verifyAuthToken() {
    return (req, res, next) => {
      try {
        if (req.method === 'GET') {
          return next();
        }

        // Em produção, CSRF é obrigatório para auth
        if (process.env.NODE_ENV === 'production') {
          const token = req.headers['x-csrf-token'] || 
                       req.headers['csrf-token'] ||
                       req.body._csrf;

          if (!token) {
            // Log tentativa suspeita
            console.warn(`Tentativa de auth sem CSRF token do IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);
            
            return res.status(403).json({
              success: false,
              message: 'Acesso negado. Token de segurança obrigatório.',
              error: 'CSRF_REQUIRED'
            });
          }

          if (!req.session || !req.session.csrfSecret) {
            console.warn(`Tentativa de auth com sessão inválida do IP: ${req.ip}`);
            
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
        } else {
          // Em desenvolvimento, apenas alertar
          const token = req.headers['x-csrf-token'] || 
                       req.headers['csrf-token'] ||
                       req.body._csrf;
          
          if (!token) {
            console.log('⚠️  Auth request sem CSRF token em modo desenvolvimento');
          }
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

  // Middleware para refresh de token (após uso)
  refreshToken() {
    return (req, res, next) => {
      try {
        // Gerar novo token após operações sensíveis
        if (req.session && req.session.csrfSecret && 
            (req.path.includes('login') || req.path.includes('register'))) {
          
          const newToken = this.generateToken(req);
          
          // Adicionar novo token na resposta
          const originalJson = res.json;
          res.json = function(data) {
            if (data && data.success) {
              data.newCsrfToken = newToken;
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

  // Limpar sessão CSRF
  clearSession() {
    return (req, res, next) => {
      if (req.session) {
        delete req.session.csrfSecret;
      }
      next();
    };
  }
}

// Singleton instance
const csrfProtection = new CSRFProtection();

module.exports = csrfProtection;