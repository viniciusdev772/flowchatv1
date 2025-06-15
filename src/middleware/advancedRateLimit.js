const { RateLimiterMongo } = require('rate-limiter-flexible');
const database = require('../config/database');

class AdvancedRateLimit {
  constructor() {
    this.limiters = {};
    this.initializeLimiters();
  }

  initializeLimiters() {
    // Configurações mais rigorosas para diferentes endpoints
    const limiterConfigs = {
      // Rate limiting global - muito restritivo
      global: {
        keyPrefix: 'global_limit',
        points: 20, // Apenas 20 requests
        duration: 60, // Por minuto
        blockDuration: 300, // Bloqueado por 5 minutos
      },

      // Rate limiting para autenticação - extremamente restritivo
      auth: {
        keyPrefix: 'auth_limit',
        points: 3, // Apenas 3 tentativas
        duration: 900, // Em 15 minutos
        blockDuration: 1800, // Bloqueado por 30 minutos
      },

      // Rate limiting para login - muito cruel
      login: {
        keyPrefix: 'login_limit',
        points: 5, // 5 tentativas de login
        duration: 3600, // Por hora
        blockDuration: 7200, // Bloqueado por 2 horas
      },

      // Rate limiting para registro - restritivo
      register: {
        keyPrefix: 'register_limit',
        points: 2, // Apenas 2 registros
        duration: 3600, // Por hora
        blockDuration: 3600, // Bloqueado por 1 hora
      },

      // Rate limiting por IP para registro - anti-spam
      registerIP: {
        keyPrefix: 'register_ip_limit',
        points: 5, // 5 registros por IP
        duration: 86400, // Por dia
        blockDuration: 86400, // Bloqueado por 1 dia
      },

      // Rate limiting severo para falhas de login
      loginFail: {
        keyPrefix: 'login_fail_limit',
        points: 3, // 3 falhas
        duration: 1800, // Em 30 minutos
        blockDuration: 3600, // Bloqueado por 1 hora
      }
    };

    // Criar limiters com MongoDB quando disponível
    Object.keys(limiterConfigs).forEach(key => {
      const config = limiterConfigs[key];
      
      try {
        const client = database.getClient();
        if (client && database.getDb()) {
          // Usar MongoDB para persistência
          this.limiters[key] = new RateLimiterMongo({
            storeClient: client,
            keyPrefix: config.keyPrefix,
            points: config.points,
            duration: config.duration,
            blockDuration: config.blockDuration,
            execEvenly: true, // Distribuir requests uniformemente
          });
        } else {
          // Fallback para in-memory em desenvolvimento
          const { RateLimiterMemory } = require('rate-limiter-flexible');
          this.limiters[key] = new RateLimiterMemory(config);
        }
      } catch (error) {
        console.warn(`Rate limiter ${key} usando memória devido a erro de DB:`, error.message);
        const { RateLimiterMemory } = require('rate-limiter-flexible');
        this.limiters[key] = new RateLimiterMemory(config);
      }
    });
  }

  // Middleware para rate limiting global
  globalLimit() {
    return async (req, res, next) => {
      try {
        const key = req.ip;
        await this.limiters.global.consume(key);
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.status(429).json({
          success: false,
          message: `Muitas requisições. Tente novamente em ${this.formatTime(secs)}`,
          retryAfter: secs,
          rateLimitInfo: {
            limit: this.limiters.global.points,
            remaining: rejRes.remainingHits || 0,
            resetTime: new Date(Date.now() + rejRes.msBeforeNext),
            retryAfterSeconds: secs
          }
        });
      }
    };
  }

  // Middleware para autenticação (mais severo)
  authLimit() {
    return async (req, res, next) => {
      try {
        const key = req.ip;
        await this.limiters.auth.consume(key);
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.status(429).json({
          success: false,
          message: `Limite de tentativas de autenticação excedido. Conta temporariamente suspensa. Tente novamente em ${this.formatTime(secs)}`,
          retryAfter: secs,
          rateLimitInfo: {
            limit: this.limiters.auth.points,
            remaining: rejRes.remainingHits || 0,
            resetTime: new Date(Date.now() + rejRes.msBeforeNext),
            retryAfterSeconds: secs,
            severity: 'HIGH'
          }
        });
      }
    };
  }

  // Middleware para login específico
  loginLimit() {
    return async (req, res, next) => {
      try {
        const email = req.body.email;
        const ip = req.ip;
        
        // Aplicar limite por email E por IP
        const emailKey = `email:${email}`;
        const ipKey = `ip:${ip}`;

        await Promise.all([
          this.limiters.login.consume(emailKey),
          this.limiters.login.consume(ipKey)
        ]);
        
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.status(429).json({
          success: false,
          message: `Muitas tentativas de login. Por segurança, o acesso foi temporariamente bloqueado. Tente novamente em ${this.formatTime(secs)}`,
          retryAfter: secs,
          rateLimitInfo: {
            limit: this.limiters.login.points,
            remaining: rejRes.remainingHits || 0,
            resetTime: new Date(Date.now() + rejRes.msBeforeNext),
            retryAfterSeconds: secs,
            severity: 'HIGH'
          }
        });
      }
    };
  }

  // Middleware para registro
  registerLimit() {
    return async (req, res, next) => {
      try {
        const email = req.body.email;
        const ip = req.ip;
        
        // Limite por email, IP e limite geral de IP
        const emailKey = `email:${email}`;
        const ipKey = `ip:${ip}`;

        await Promise.all([
          this.limiters.register.consume(emailKey),
          this.limiters.register.consume(ipKey),
          this.limiters.registerIP.consume(ip)
        ]);
        
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.status(429).json({
          success: false,
          message: `Limite de registros excedido. Para prevenir spam, novos cadastros foram temporariamente bloqueados. Tente novamente em ${this.formatTime(secs)}`,
          retryAfter: secs,
          rateLimitInfo: {
            limit: this.limiters.register.points,
            remaining: rejRes.remainingHits || 0,
            resetTime: new Date(Date.now() + rejRes.msBeforeNext),
            retryAfterSeconds: secs,
            severity: 'MEDIUM'
          }
        });
      }
    };
  }

  // Penalizar falhas de login
  async penalizeFailedLogin(email, ip) {
    try {
      const emailKey = `email:${email}`;
      const ipKey = `ip:${ip}`;
      
      await Promise.all([
        this.limiters.loginFail.consume(emailKey),
        this.limiters.loginFail.consume(ipKey)
      ]);
    } catch (rejRes) {
      // Login falhou muitas vezes, aplicar penalidade severa
      console.warn(`IP ${ip} e email ${email} penalizados por múltiplas falhas de login`);
      throw new Error('Conta temporariamente bloqueada por múltiplas tentativas de login inválidas');
    }
  }

  // Resetar limite para um usuário específico (admin only)
  async resetUserLimit(identifier, limiterType = 'auth') {
    try {
      if (this.limiters[limiterType]) {
        await this.limiters[limiterType].delete(identifier);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao resetar limite do usuário:', error);
      return false;
    }
  }

  // Formatar tempo de forma amigável
  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.ceil(seconds / 3600);
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    }
  }

  // Obter informações de rate limit
  async getRateLimitInfo(identifier, limiterType = 'auth') {
    try {
      if (this.limiters[limiterType]) {
        const res = await this.limiters[limiterType].get(identifier);
        return {
          totalHits: res?.totalHits || 0,
          remainingPoints: res?.remainingPoints || this.limiters[limiterType].points,
          msBeforeNext: res?.msBeforeNext || 0,
          isBlocked: (res?.remainingPoints || this.limiters[limiterType].points) <= 0
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter info de rate limit:', error);
      return null;
    }
  }
}

// Singleton instance
const advancedRateLimit = new AdvancedRateLimit();

module.exports = advancedRateLimit;