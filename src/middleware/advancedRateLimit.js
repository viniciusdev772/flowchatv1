const { RateLimiterMongo, RateLimiterMemory } = require('rate-limiter-flexible');
const database = require('../config/database');

class AdvancedRateLimit {
  constructor() {
    this.limiters = {};
    this.progressivePenalties = new Map();
    this.dbConnectionRetries = 0;
    this.maxRetries = 10;
    this.initializeLimiters();
    
    // Periodic cleanup and sync
    setInterval(() => {
      this.cleanExpiredPenalties();
      this.syncPenaltiesToDB();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Try to upgrade to MongoDB periodically
    setInterval(() => {
      this.tryUpgradeToMongoDB();
    }, 30 * 1000); // Every 30 seconds
  }
  initializeLimiters() {    // Configurações mais amigáveis para diferentes endpoints
    const limiterConfigs = {
      // Rate limiting global - moderado
      global: {
        keyPrefix: 'global_limit',
        points: 100, // 100 requests
        duration: 60, // Por minuto
        blockDuration: 60, // Bloqueado por 1 minuto
      },

      // Rate limiting para autenticação - moderado
      auth: {
        keyPrefix: 'auth_limit',
        points: 20, // 20 tentativas
        duration: 300, // Em 5 minutos
        blockDuration: 300, // Bloqueado por 5 minutos
      },

      // Rate limiting para login - amigável
      login: {
        keyPrefix: 'login_limit',
        points: 15, // 15 tentativas de login
        duration: 600, // Em 10 minutos
        blockDuration: 300, // Bloqueado por 5 minutos
      },

      // Rate limiting para registro - moderado
      register: {
        keyPrefix: 'register_limit',
        points: 10, // 10 registros
        duration: 3600, // Por hora
        blockDuration: 600, // Bloqueado por 10 minutos
      },

      // Rate limiting por IP para registro - amigável
      registerIP: {
        keyPrefix: 'register_ip_limit',
        points: 20, // 20 registros por IP
        duration: 86400, // Por dia
        blockDuration: 3600, // Bloqueado por 1 hora
      },

      // Rate limiting para falhas de login - amigável
      loginFail: {
        keyPrefix: 'login_fail_limit',
        points: 10, // 10 falhas
        duration: 600, // Em 10 minutos
        blockDuration: 300, // Bloqueado por 5 minutos
      }
    };

    // Try to create limiters with MongoDB first, fallback to memory
    Object.keys(limiterConfigs).forEach(key => {
      const config = limiterConfigs[key];
      
      try {
        const client = database.getClient();
        if (client && database.getDb()) {
          // Use MongoDB for persistence
          this.limiters[key] = new RateLimiterMongo({
            storeClient: client,
            keyPrefix: config.keyPrefix,
            points: config.points,
            duration: config.duration,
            blockDuration: config.blockDuration,
            execEvenly: true, // Distribute requests evenly
          });
          console.log(`✅ Rate limiter ${key} initialized with MongoDB`);
        } else {
          throw new Error('MongoDB not available');
        }
      } catch (error) {
        // Fallback to memory-based rate limiting
        console.log(`⚠️  Rate limiter ${key} falling back to memory (MongoDB unavailable)`);
        this.limiters[key] = new RateLimiterMemory({
          keyPrefix: config.keyPrefix,
          points: config.points,
          duration: config.duration,
          blockDuration: config.blockDuration,
          execEvenly: true,
        });
      }
    });

    // Load penalties from DB if MongoDB is available
    this.loadPenaltiesFromDB().catch(err => {
      console.log('📝 Progressive penalties will use memory only (MongoDB unavailable)');
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
  }  // Middleware para login específico - apenas MongoDB
  loginLimit() {
    return async (req, res, next) => {
      try {
        const email = req.body.email;
        const ip = req.ip;
        
        // Aplicar limite por email E por IP usando apenas MongoDB
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
          message: `Muitas tentativas de login. Tente novamente em ${this.formatTime(secs)}`,
          retryAfter: secs,
          rateLimitInfo: {
            limit: this.limiters.login.points,
            remaining: rejRes.remainingHits || 0,
            resetTime: new Date(Date.now() + rejRes.msBeforeNext),
            retryAfterSeconds: secs
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
    };  }

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
      };        // Atualizar apenas se ainda não estão usando MongoDB
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
  }  async loadPenaltiesFromDB() {
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

      // Initialize progressive penalties map if not exists
      if (!this.progressivePenalties) {
        this.progressivePenalties = new Map();
      }

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

      // Initialize progressive penalties map if not exists
      if (!this.progressivePenalties) {
        this.progressivePenalties = new Map();
        return;
      }

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
  }  calculateProgressivePenalty(level) {
    // Fórmula mais amigável: 5 minutos * level
    // Nível 1: 5 minutos
    // Nível 2: 10 minutos  
    // Nível 3: 15 minutos
    // Nível 4: 20 minutos
    // Nível 5: 25 minutos
    // Máximo: 30 minutos
    
    const baseTime = 5 * 60 * 1000; // 5 minutos em ms
    const maxTime = 30 * 60 * 1000; // 30 minutos em ms
    
    const calculatedTime = baseTime * level;
    return Math.min(calculatedTime, maxTime);
  }// Penalizar falhas de login com sistema progressivo
  async penalizeFailedLogin(email, ip) {
    try {
      const emailKey = `email:${email}`;
      const ipKey = `ip:${ip}`;
      
      await Promise.all([
        this.limiters.loginFail.consume(emailKey),
        this.limiters.loginFail.consume(ipKey)
      ]);
    } catch (rejRes) {      // Login falhou muitas vezes, aplicar penalidade progressiva moderada
      const progressiveKey = `progressive_fail:${email}:${ip}`;
      
      // Initialize progressive penalties map if not exists
      if (!this.progressivePenalties) {
        this.progressivePenalties = new Map();
      }
      
      const currentPenalty = this.progressivePenalties.get(progressiveKey) || { level: 0, attempts: 0 };
      const newLevel = currentPenalty.level + 1;
      const progressiveDuration = this.calculateProgressivePenalty(newLevel); // Sem dobrar
      
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

      console.warn(`⚠️  Penalização por falhas - IP: ${ip}, Email: ${email}, Nível: ${newLevel}, Duração: ${this.formatTime(Math.round(progressiveDuration / 1000))}`);
      throw new Error(`Muitas tentativas de login inválidas. Tente novamente em ${this.formatTime(Math.round(progressiveDuration / 1000))}`);
    }
  }// Resetar limite para um usuário específico (admin only)
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
  }  // Limpar penalizações expiradas (executar periodicamente)
  async cleanExpiredPenalties() {
    // Initialize progressive penalties map if not exists
    if (!this.progressivePenalties) {
      this.progressivePenalties = new Map();
      return;
    }
    
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
      // Initialize progressive penalties map if not exists
      if (!this.progressivePenalties) {
        this.progressivePenalties = new Map();
      }
      
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
        memoryCount: this.progressivePenalties ? this.progressivePenalties.size : 0,
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

  // Try to upgrade rate limiters to MongoDB when it becomes available
  async tryUpgradeToMongoDB() {
    try {
      const client = database.getClient();
      if (!client || !database.getDb()) {
        return; // MongoDB still not available
      }

      // Check if any limiters are still using memory
      let upgraded = false;
      for (const [key, limiter] of Object.entries(this.limiters)) {
        if (limiter instanceof RateLimiterMemory) {
          const config = this.getLimiterConfig(key);
          if (config) {
            // Upgrade to MongoDB
            this.limiters[key] = new RateLimiterMongo({
              storeClient: client,
              keyPrefix: config.keyPrefix,
              points: config.points,
              duration: config.duration,
              blockDuration: config.blockDuration,
              execEvenly: true,
            });
            console.log(`🔄 Upgraded ${key} rate limiter to MongoDB`);
            upgraded = true;
          }
        }
      }

      if (upgraded) {
        console.log('✅ All rate limiters upgraded to MongoDB');
        // Load penalties from DB now that MongoDB is available
        await this.loadPenaltiesFromDB();
      }
    } catch (error) {
      // Silently fail - MongoDB might not be ready yet
    }
  }
  // Get limiter configuration
  getLimiterConfig(key) {
    const configs = {
      global: {
        keyPrefix: 'global_limit',
        points: 100,
        duration: 60,
        blockDuration: 60,
      },
      auth: {
        keyPrefix: 'auth_limit',
        points: 20,
        duration: 300,
        blockDuration: 300,
      },
      login: {
        keyPrefix: 'login_limit',
        points: 15,
        duration: 600,
        blockDuration: 300,
      },
      register: {
        keyPrefix: 'register_limit',
        points: 10,
        duration: 3600,
        blockDuration: 600,
      },
      registerIP: {
        keyPrefix: 'register_ip_limit',
        points: 20,
        duration: 86400,
        blockDuration: 3600,
      },
      loginFail: {
        keyPrefix: 'login_fail_limit',
        points: 10,
        duration: 600,
        blockDuration: 300,
      }
    };
    return configs[key];
  }

  // Limpar TODOS os rate limits (emergência)
  async clearAllLimits() {
    try {
      // Limpar limiters em memória
      for (const [key, limiter] of Object.entries(this.limiters)) {
        try {
          // Reset all keys for this limiter type (this is a brute force approach)
          console.log(`🔄 Limpando limiter: ${key}`);
        } catch (error) {
          console.log(`Erro ao limpar ${key}:`, error.message);
        }
      }

      // Limpar penalizações progressivas da memória
      if (this.progressivePenalties) {
        this.progressivePenalties.clear();
        console.log('🧹 Penalizações progressivas limpas da memória');
      }

      // Limpar do MongoDB se disponível
      try {
        const db = database.getDb();
        if (db) {
          // Limpar coleção de rate limits
          const rateLimitCollections = [
            'global_limit',
            'auth_limit', 
            'login_limit',
            'register_limit',
            'register_ip_limit',
            'login_fail_limit'
          ];

          for (const collectionName of rateLimitCollections) {
            try {
              await db.collection(collectionName).deleteMany({});
              console.log(`🗑️  Coleção ${collectionName} limpa`);
            } catch (error) {
              console.log(`Aviso: Não foi possível limpar ${collectionName}`);
            }
          }

          // Limpar penalizações progressivas
          await db.collection('progressive_penalties').deleteMany({});
          console.log('🗑️  Penalizações progressivas limpas do MongoDB');
        }
      } catch (dbError) {
        console.log('MongoDB não disponível para limpeza:', dbError.message);
      }

      console.log('✅ TODOS os rate limits foram limpos! Sistema resetado.');
      return true;
    } catch (error) {
      console.error('Erro ao limpar rate limits:', error);
      return false;
    }
  }
}

// Singleton instance
const advancedRateLimit = new AdvancedRateLimit();

module.exports = advancedRateLimit;