const { RateLimiterMongo } = require('rate-limiter-flexible');
const database = require('../config/database');

class AdvancedRateLimit {  constructor() {
    this.limiters = {};
    this.progressivePenalties = new Map(); // Cache em memória para performance
    this.dbConnectionRetries = 0;
    this.maxRetries = 10;
    this.initializeLimiters();
    
    // Aguardar conexão do MongoDB antes de carregar penalizações
    this.waitForDBAndLoad();
    
    // Limpar penalizações expiradas a cada 5 minutos
    setInterval(() => {
      this.cleanExpiredPenalties();
    }, 5 * 60 * 1000);
    
    // Sincronizar com MongoDB a cada 1 minuto
    setInterval(() => {
      this.syncPenaltiesToDB();
    }, 60 * 1000);
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
  // Middleware para login específico com penalização progressiva
  loginLimit() {
    return async (req, res, next) => {
      try {
        const email = req.body.email;
        const ip = req.ip;
        
        // Aplicar limite por email E por IP
        const emailKey = `email:${email}`;
        const ipKey = `ip:${ip}`;        // Verificar se já há penalização progressiva ativa
        const progressiveKey = `progressive:${email}:${ip}`;
        const currentPenalty = this.progressivePenalties.get(progressiveKey);
        
        if (currentPenalty && Date.now() < currentPenalty.expiry) {
          // Usuário ainda está sob penalização progressiva
          const remainingMs = currentPenalty.expiry - Date.now();
          const secs = Math.round(remainingMs / 1000);
          
          // AUMENTAR AINDA MAIS a penalização se tentar novamente
          const newLevel = currentPenalty.level + 1;
          const newDuration = this.calculateProgressivePenalty(newLevel);
          const newExpiry = Date.now() + newDuration;
          
          const updatedPenalty = {
            level: newLevel,
            expiry: newExpiry,
            attempts: currentPenalty.attempts + 1,
            email: email,
            ip: ip,
            createdAt: currentPenalty.createdAt || new Date(),
            lastUpdated: new Date()
          };

          this.progressivePenalties.set(progressiveKey, updatedPenalty);
          
          // Salvar imediatamente no MongoDB
          await this.savePenaltyToDB(progressiveKey, updatedPenalty);

          console.warn(`🚨 PENALIZAÇÃO PROGRESSIVA AUMENTADA - IP: ${ip}, Email: ${email}, Nível: ${newLevel}, Tentativas: ${updatedPenalty.attempts}`);
          
          return res.status(429).json({
            success: false,
            message: `ACESSO NEGADO! Múltiplas tentativas detectadas. Penalização aumentada para ${this.formatTime(Math.round(newDuration / 1000))}. Cada nova tentativa DOBRA o tempo de bloqueio!`,
            retryAfter: Math.round(newDuration / 1000),
            rateLimitInfo: {
              limit: this.limiters.login.points,
              remaining: 0,
              resetTime: new Date(newExpiry),
              retryAfterSeconds: Math.round(newDuration / 1000),
              severity: 'CRITICAL',
              penaltyLevel: newLevel,
              totalAttempts: updatedPenalty.attempts,
              escalated: true,
              persistedToDB: true
            }
          });
        }

        await Promise.all([
          this.limiters.login.consume(emailKey),
          this.limiters.login.consume(ipKey)
        ]);
          // Se passou, limpar penalização progressiva
        this.progressivePenalties.delete(progressiveKey);
        await this.removePenaltyFromDB(progressiveKey);
        next();
      } catch (rejRes) {
        const email = req.body.email;
        const ip = req.ip;
        const progressiveKey = `progressive:${email}:${ip}`;
          // Iniciar ou escalar penalização progressiva
        const currentPenalty = this.progressivePenalties.get(progressiveKey) || { level: 0, attempts: 0 };
        const newLevel = currentPenalty.level + 1;
        const progressiveDuration = this.calculateProgressivePenalty(newLevel);
        const progressiveExpiry = Date.now() + progressiveDuration;
        
        const newPenalty = {
          level: newLevel,
          expiry: progressiveExpiry,
          attempts: currentPenalty.attempts + 1,
          email: email,
          ip: ip,
          createdAt: currentPenalty.createdAt || new Date(),
          lastUpdated: new Date()
        };

        this.progressivePenalties.set(progressiveKey, newPenalty);
        
        // Salvar imediatamente no MongoDB
        await this.savePenaltyToDB(progressiveKey, newPenalty);

        console.warn(`🚨 RATE LIMIT ATIVADO + PENALIZAÇÃO PROGRESSIVA - IP: ${ip}, Email: ${email}, Nível: ${newLevel}`);
        
        const secs = Math.round(progressiveDuration / 1000);
        res.status(429).json({
          success: false,
          message: `Muitas tentativas de login. Por segurança, o acesso foi temporariamente bloqueado. Tente novamente em ${this.formatTime(secs)}. ⚠️ ATENÇÃO: Novas tentativas aumentarão exponencialmente o tempo de bloqueio!`,
          retryAfter: secs,
          rateLimitInfo: {
            limit: this.limiters.login.points,
            remaining: rejRes.remainingHits || 0,
            resetTime: new Date(progressiveExpiry),
            retryAfterSeconds: secs,
            severity: 'HIGH',
            penaltyLevel: newLevel,
            totalAttempts: newPenalty.attempts,
            escalated: false,
            persistedToDB: true
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
  // Aguardar conexão do MongoDB e carregar penalizações
  async waitForDBAndLoad() {
    const maxWaitTime = 30000; // 30 segundos máximo
    const checkInterval = 1000; // Verificar a cada 1 segundo
    let elapsed = 0;

    console.log('🔄 Aguardando conexão do MongoDB para carregar penalizações...');

    const checkConnection = async () => {
      try {
        const db = database.getDb();
        const client = database.getClient();
        
        if (db && client && client.topology && client.topology.isConnected()) {
          console.log('✅ MongoDB conectado - carregando penalizações progressivas...');
          await this.loadPenaltiesFromDB();
          await this.updateLimitersWithMongo();
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    };

    // Verificar imediatamente
    if (await checkConnection()) {
      return;
    }

    // Aguardar conexão com retry
    const interval = setInterval(async () => {
      elapsed += checkInterval;
      
      if (await checkConnection()) {
        clearInterval(interval);
        return;
      }
      
      if (elapsed >= maxWaitTime) {
        clearInterval(interval);
        console.log('⚠️  Timeout aguardando MongoDB - continuando apenas com memória');
        console.log('💡 As penalizações serão salvas quando o MongoDB estiver disponível');
      }
    }, checkInterval);
  }

  // Atualizar limiters para usar MongoDB quando conectado
  async updateLimitersWithMongo() {
    try {
      const client = database.getClient();
      if (!client || !database.getDb()) {
        return;
      }

      // Recriar limiters com MongoDB
      const limiterConfigs = {
        global: {
          keyPrefix: 'global_limit',
          points: 20,
          duration: 60,
          blockDuration: 300,
        },
        auth: {
          keyPrefix: 'auth_limit',
          points: 3,
          duration: 900,
          blockDuration: 1800,
        },
        login: {
          keyPrefix: 'login_limit',
          points: 5,
          duration: 3600,
          blockDuration: 7200,
        },
        register: {
          keyPrefix: 'register_limit',
          points: 2,
          duration: 3600,
          blockDuration: 3600,
        },
        registerIP: {
          keyPrefix: 'register_ip_limit',
          points: 5,
          duration: 86400,
          blockDuration: 86400,
        },
        loginFail: {
          keyPrefix: 'login_fail_limit',
          points: 3,
          duration: 1800,
          blockDuration: 3600,
        }
      };

      // Atualizar apenas se ainda não estão usando MongoDB
      for (const [key, config] of Object.entries(limiterConfigs)) {
        if (this.limiters[key] && !this.limiters[key].storeClient) {
          this.limiters[key] = new RateLimiterMongo({
            storeClient: client,
            keyPrefix: config.keyPrefix,
            points: config.points,
            duration: config.duration,
            blockDuration: config.blockDuration,
            execEvenly: true,
          });
        }
      }

      console.log('🔄 Rate limiters atualizados para usar MongoDB');
    } catch (error) {
      console.error('Erro ao atualizar limiters com MongoDB:', error.message);
    }
  }
  async loadPenaltiesFromDB() {
    try {
      const db = database.getDb();
      if (!db) {
        console.log('⚠️  MongoDB não disponível - penalizações apenas em memória');
        return;
      }

      const penaltiesCollection = db.collection('progressive_penalties');
      const now = new Date();
      
      // Buscar apenas penalizações não expiradas
      const activePenalties = await penaltiesCollection.find({
        expiry: { $gt: now }
      }).toArray();

      // Carregar para memória
      activePenalties.forEach(penalty => {
        this.progressivePenalties.set(penalty._id, {
          level: penalty.level,
          expiry: penalty.expiry.getTime(),
          attempts: penalty.attempts,
          email: penalty.email,
          ip: penalty.ip,
          createdAt: penalty.createdAt,
          lastUpdated: penalty.lastUpdated
        });
      });

      // Remover penalizações expiradas do banco
      await penaltiesCollection.deleteMany({
        expiry: { $lte: now }
      });

      console.log(`✅ ${activePenalties.length} penalizações progressivas carregadas do MongoDB`);
    } catch (error) {
      console.error('Erro ao carregar penalizações do MongoDB:', error.message);
    }
  }

  // Sincronizar penalizações da memória para MongoDB
  async syncPenaltiesToDB() {
    try {
      const db = database.getDb();
      if (!db) return;

      const penaltiesCollection = db.collection('progressive_penalties');
      const now = Date.now();

      for (const [key, penalty] of this.progressivePenalties.entries()) {
        // Pular se expirado
        if (now >= penalty.expiry) continue;

        const doc = {
          _id: key,
          level: penalty.level,
          expiry: new Date(penalty.expiry),
          attempts: penalty.attempts,
          email: penalty.email || key.split(':')[1],
          ip: penalty.ip || key.split(':')[2],
          createdAt: penalty.createdAt || new Date(),
          lastUpdated: new Date(),
          type: key.includes('progressive_fail') ? 'login_fail' : 'login_attempt'
        };

        // Upsert (insert ou update)
        await penaltiesCollection.replaceOne(
          { _id: key },
          doc,
          { upsert: true }
        );
      }
    } catch (error) {
      console.error('Erro ao sincronizar penalizações com MongoDB:', error.message);
    }
  }

  // Salvar penalização específica no MongoDB imediatamente
  async savePenaltyToDB(key, penalty) {
    try {
      const db = database.getDb();
      if (!db) return;

      const penaltiesCollection = db.collection('progressive_penalties');
      
      const doc = {
        _id: key,
        level: penalty.level,
        expiry: new Date(penalty.expiry),
        attempts: penalty.attempts,
        email: penalty.email || key.split(':')[1],
        ip: penalty.ip || key.split(':')[2],
        createdAt: penalty.createdAt || new Date(),
        lastUpdated: new Date(),
        type: key.includes('progressive_fail') ? 'login_fail' : 'login_attempt'
      };

      await penaltiesCollection.replaceOne(
        { _id: key },
        doc,
        { upsert: true }
      );

      console.log(`💾 Penalização salva no MongoDB: ${key} - Nível ${penalty.level}`);
    } catch (error) {
      console.error('Erro ao salvar penalização no MongoDB:', error.message);
    }
  }

  // Remover penalização do MongoDB
  async removePenaltyFromDB(key) {
    try {
      const db = database.getDb();
      if (!db) return;

      const penaltiesCollection = db.collection('progressive_penalties');
      await penaltiesCollection.deleteOne({ _id: key });
      
      console.log(`🗑️  Penalização removida do MongoDB: ${key}`);
    } catch (error) {
      console.error('Erro ao remover penalização do MongoDB:', error.message);
    }
  }
  calculateProgressivePenalty(level) {
    // Fórmula: 2 horas * (2^level)
    // Nível 1: 2 horas
    // Nível 2: 4 horas  
    // Nível 3: 8 horas
    // Nível 4: 16 horas
    // Nível 5: 32 horas (1.3 dias)
    // Nível 6: 64 horas (2.6 dias)
    // Nível 7: 128 horas (5.3 dias)
    // Máximo: 7 dias
    
    const baseTime = 2 * 60 * 60 * 1000; // 2 horas em ms
    const maxTime = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms
    
    const calculatedTime = baseTime * Math.pow(2, level - 1);
    return Math.min(calculatedTime, maxTime);
  }
  // Penalizar falhas de login com sistema progressivo
  async penalizeFailedLogin(email, ip) {
    try {
      const emailKey = `email:${email}`;
      const ipKey = `ip:${ip}`;
      
      await Promise.all([
        this.limiters.loginFail.consume(emailKey),
        this.limiters.loginFail.consume(ipKey)
      ]);
    } catch (rejRes) {
      // Login falhou muitas vezes, aplicar penalidade progressiva severa
      const progressiveKey = `progressive_fail:${email}:${ip}`;
      const currentPenalty = this.progressivePenalties.get(progressiveKey) || { level: 0, attempts: 0 };
      const newLevel = currentPenalty.level + 1;
      const progressiveDuration = this.calculateProgressivePenalty(newLevel) * 2; // Dobrar para falhas
      
      const newPenalty = {
        level: newLevel,
        expiry: Date.now() + progressiveDuration,
        attempts: currentPenalty.attempts + 1,
        email: email,
        ip: ip,
        createdAt: currentPenalty.createdAt || new Date(),
        lastUpdated: new Date()
      };

      this.progressivePenalties.set(progressiveKey, newPenalty);
      
      // Salvar imediatamente no MongoDB
      await this.savePenaltyToDB(progressiveKey, newPenalty);

      console.error(`🚨 PENALIZAÇÃO SEVERA POR FALHAS - IP: ${ip}, Email: ${email}, Nível: ${newLevel}, Duração: ${this.formatTime(Math.round(progressiveDuration / 1000))}`);
      throw new Error(`Conta temporariamente bloqueada por múltiplas tentativas de login inválidas. Bloqueio de ${this.formatTime(Math.round(progressiveDuration / 1000))}`);
    }
  }  // Resetar limite para um usuário específico (admin only)
  async resetUserLimit(identifier, limiterType = 'auth') {
    try {
      if (this.limiters[limiterType]) {
        await this.limiters[limiterType].delete(identifier);
        
        // Também remover penalizações progressivas relacionadas
        const keysToRemove = [];
        for (const [key, value] of this.progressivePenalties.entries()) {
          if (key.includes(identifier)) {
            keysToRemove.push(key);
          }
        }
        
        // Remover da memória
        keysToRemove.forEach(key => {
          this.progressivePenalties.delete(key);
        });
        
        // Remover do MongoDB
        if (keysToRemove.length > 0) {
          try {
            const db = database.getDb();
            if (db) {
              const penaltiesCollection = db.collection('progressive_penalties');
              await penaltiesCollection.deleteMany({
                $or: [
                  { email: identifier },
                  { ip: identifier },
                  { _id: { $in: keysToRemove } }
                ]
              });
              console.log(`🔧 Reset completo para ${identifier}: ${keysToRemove.length} penalizações removidas`);
            }
          } catch (dbError) {
            console.error('Erro ao resetar penalizações no MongoDB:', dbError.message);
          }
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao resetar limite do usuário:', error);
      return false;
    }
  }
  // Limpar penalizações expiradas (executar periodicamente)
  async cleanExpiredPenalties() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, penalty] of this.progressivePenalties.entries()) {
      if (now >= penalty.expiry) {
        expiredKeys.push(key);
      }
    }
    
    // Remover da memória
    expiredKeys.forEach(key => {
      this.progressivePenalties.delete(key);
    });
    
    // Remover do MongoDB
    if (expiredKeys.length > 0) {
      try {
        const db = database.getDb();
        if (db) {
          const penaltiesCollection = db.collection('progressive_penalties');
          await penaltiesCollection.deleteMany({
            expiry: { $lte: new Date(now) }
          });
          console.log(`🧹 ${expiredKeys.length} penalizações expiradas removidas (memória + MongoDB)`);
        }
      } catch (error) {
        console.error('Erro ao limpar penalizações expiradas do MongoDB:', error.message);
      }
    }
  }

  // Obter estatísticas das penalizações
  async getPenaltyStatistics() {
    try {
      const memoryCount = this.progressivePenalties.size;
      let dbCount = 0;
      let totalBlocked = 0;
      let highestLevel = 0;
      
      const db = database.getDb();
      if (db) {
        const penaltiesCollection = db.collection('progressive_penalties');
        dbCount = await penaltiesCollection.countDocuments();
        
        const stats = await penaltiesCollection.aggregate([
          {
            $group: {
              _id: null,
              totalBlocked: { $sum: 1 },
              highestLevel: { $max: '$level' },
              averageLevel: { $avg: '$level' },
              totalAttempts: { $sum: '$attempts' }
            }
          }
        ]).toArray();
        
        if (stats.length > 0) {
          totalBlocked = stats[0].totalBlocked;
          highestLevel = stats[0].highestLevel;
        }
      }
      
      return {
        memoryCount,
        dbCount,
        totalBlocked,
        highestLevel,
        isMongoConnected: !!db,
        lastSync: new Date()
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error.message);
      return {
        memoryCount: this.progressivePenalties.size,
        dbCount: 0,
        error: error.message
      };
    }
  }
  getProgressivePenaltyInfo(email, ip) {
    const progressiveKey = `progressive:${email}:${ip}`;
    const penalty = this.progressivePenalties.get(progressiveKey);
    
    if (!penalty || Date.now() >= penalty.expiry) {
      return null;
    }
    
    return {
      level: penalty.level,
      attempts: penalty.attempts,
      remainingMs: penalty.expiry - Date.now(),
      remainingSeconds: Math.round((penalty.expiry - Date.now()) / 1000),
      active: true
    };
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