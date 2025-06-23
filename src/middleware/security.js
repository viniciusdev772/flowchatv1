const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');

class SecurityMiddleware {
  constructor() {
    this.suspiciousIPs = new Set();
    this.trustedOrigins = [
      'http://localhost',
      'https://localhost',
      'http://127.0.0.1',
      'https://127.0.0.1',
      process.env.CORS_ORIGIN,
      process.env.FRONTEND_URL
    ].filter(Boolean);
  }

  // Sanitização de dados MongoDB
  mongoSanitization() {
    return mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        console.warn(`Tentativa de injeção MongoDB detectada - IP: ${req.ip}, Campo: ${key}`);
      }
    });
  }

  // Validações rigorosas para registro
  validateRegistration() {
    return [
      body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Nome deve ter entre 2 e 100 caracteres')
        .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
        .withMessage('Nome deve conter apenas letras e espaços'),
      
      body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email muito longo')
        .custom(async (email) => {
          // Lista de domínios suspeitos
          const suspiciousDomains = [
            'tempmail.org', '10minutemail.com', 'guerrillamail.com',
            'mailinator.com', 'yopmail.com', 'temp-mail.org'
          ];
          
          const domain = email.split('@')[1];
          if (suspiciousDomains.includes(domain)) {
            throw new Error('Domínio de email não permitido');
          }
          return true;
        }),
      
      body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Senha deve ter entre 8 e 128 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
      
      // Verificar se não há campos extras suspeitos
      body().custom((value, { req }) => {
        const allowedFields = ['name', 'email', 'password', '_csrf'];
        const extraFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
        
        if (extraFields.length > 0) {
          console.warn(`Campos suspeitos detectados - IP: ${req.ip}, Campos: ${extraFields.join(', ')}`);
          throw new Error('Requisição contém campos não permitidos');
        }
        return true;
      })
    ];
  }

  // Validações para login
  validateLogin() {
    return [
      body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email muito longo'),
      
      body('password')
        .isLength({ min: 1, max: 128 })
        .withMessage('Senha é obrigatória'),
      
      body('remember')
        .optional()
        .isBoolean()
        .withMessage('Campo remember deve ser boolean'),
      
      // Verificar campos extras
      body().custom((value, { req }) => {
        const allowedFields = ['email', 'password', 'remember', '_csrf'];
        const extraFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
        
        if (extraFields.length > 0) {
          console.warn(`Tentativa de login com campos extras - IP: ${req.ip}, Campos: ${extraFields.join(', ')}`);
          this.flagSuspiciousIP(req.ip);
        }
        return true;
      })
    ];
  }

  // Middleware para verificar resultados de validação
  checkValidationResults() {
    return (req, res, next) => {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg);
        
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos fornecidos',
          errors: errorMessages,
          details: process.env.NODE_ENV === 'development' ? errors.array() : undefined
        });
      }
      
      next();
    };
  }

  // Verificação de origem
  verifyOrigin() {
    return (req, res, next) => {
      const origin = req.headers.origin || req.headers.referer;
      
      // Permitir requisições sem origin (acesso direto, Postman, etc.)
      if (!origin) {
        return next();
      }
      
      // Em produção, verificar origem rigorosamente apenas para requisições com origin
      if (process.env.NODE_ENV === 'production') {
        if (!this.trustedOrigins.some(trusted => trusted && origin.startsWith(trusted))) {
          console.warn(`Requisição de origem não confiável - Origin: ${origin}, IP: ${req.ip}`);
          
          return res.status(403).json({
            success: false,
            message: 'Acesso negado - origem não autorizada',
            error: 'INVALID_ORIGIN'
          });
        }
      }
      
      next();
    };
  }

  // Verificação de User-Agent
  verifyUserAgent() {
    return (req, res, next) => {
      const userAgent = req.headers['user-agent'];
      
      if (!userAgent) {
        console.warn(`Requisição sem User-Agent - IP: ${req.ip}`);
        this.flagSuspiciousIP(req.ip);
        
        return res.status(400).json({
          success: false,
          message: 'User-Agent é obrigatório',
          error: 'MISSING_USER_AGENT'
        });
      }
      
      // Detectar bots maliciosos
      const suspiciousPatterns = [
        /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, 
        /scanner/i, /script/i, /automated/i
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
        console.warn(`User-Agent suspeito detectado - UA: ${userAgent}, IP: ${req.ip}`);
        this.flagSuspiciousIP(req.ip);
        
        return res.status(403).json({
          success: false,
          message: 'Acesso automatizado detectado',
          error: 'AUTOMATED_ACCESS_DENIED'
        });
      }
      
      next();
    };
  }

  // Verificação de headers suspeitos
  detectSuspiciousHeaders() {
    return (req, res, next) => {
      const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-originating-ip',
        'x-remote-ip',
        'x-cluster-client-ip'
      ];
      
      // Verificar se há múltiplos IPs (possível proxy/VPN)
      suspiciousHeaders.forEach(header => {
        if (req.headers[header]) {
          const ips = req.headers[header].split(',');
          if (ips.length > 2) {
            console.warn(`Múltiplos IPs detectados em ${header} - IPs: ${ips.join(', ')}, IP principal: ${req.ip}`);
            this.flagSuspiciousIP(req.ip);
          }
        }
      });
      
      // Verificar headers de desenvolvimento em produção
      if (process.env.NODE_ENV === 'production') {
        const devHeaders = ['x-debug', 'x-test', 'x-dev'];
        devHeaders.forEach(header => {
          if (req.headers[header]) {
            console.warn(`Header de desenvolvimento em produção - Header: ${header}, IP: ${req.ip}`);
            this.flagSuspiciousIP(req.ip);
          }
        });
      }
      
      next();
    };
  }

  // Marcar IP como suspeito
  flagSuspiciousIP(ip) {
    this.suspiciousIPs.add(ip);
    console.warn(`IP ${ip} marcado como suspeito`);
    
    // Limpar após 24 horas
    setTimeout(() => {
      this.suspiciousIPs.delete(ip);
    }, 24 * 60 * 60 * 1000);
  }

  // Bloqueio de IPs suspeitos
  blockSuspiciousIPs() {
    return (req, res, next) => {
      if (this.suspiciousIPs.has(req.ip)) {
        console.warn(`Bloqueando requisição de IP suspeito: ${req.ip}`);
        
        return res.status(403).json({
          success: false,
          message: 'Acesso bloqueado devido a atividade suspeita',
          error: 'IP_BLOCKED'
        });
      }
      
      next();
    };
  }


  // Verificação de integridade da requisição
  verifyRequestIntegrity() {
    return (req, res, next) => {
      // Verificar tamanho do body
      const contentLength = parseInt(req.headers['content-length'] || '0');
      
      if (contentLength > 10 * 1024 * 1024) { // 10MB
        console.warn(`Requisição muito grande - Size: ${contentLength}, IP: ${req.ip}`);
        
        return res.status(413).json({
          success: false,
          message: 'Requisição muito grande',
          error: 'PAYLOAD_TOO_LARGE'
        });
      }
      
      // Verificar Content-Type para POST/PUT
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        
        if (!contentType || !contentType.includes('application/json')) {
          console.warn(`Content-Type suspeito - Type: ${contentType}, IP: ${req.ip}`);
          
          return res.status(400).json({
            success: false,
            message: 'Content-Type deve ser application/json',
            error: 'INVALID_CONTENT_TYPE'
          });
        }
      }
      
      next();
    };
  }

  // Middleware completo de segurança
  fullSecurityStack() {
    return [
      this.detectSuspiciousHeaders(),
      this.blockSuspiciousIPs(),
      this.verifyOrigin(),
      this.verifyUserAgent(),
      this.verifyRequestIntegrity(),
      this.mongoSanitization()
    ];
  }

  // Obter estatísticas de segurança
  getSecurityStats() {
    return {
      suspiciousIPs: Array.from(this.suspiciousIPs),
      suspiciousIPCount: this.suspiciousIPs.size,
      trustedOrigins: this.trustedOrigins
    };
  }
}

// Singleton instance
const securityMiddleware = new SecurityMiddleware();

module.exports = securityMiddleware;