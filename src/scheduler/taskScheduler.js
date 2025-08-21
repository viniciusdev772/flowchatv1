const cron = require('node-cron');
const database = require('../config/database');
const { ObjectId } = require('mongodb');

class TaskScheduler {
  constructor() {
    this.scheduledTasks = new Map(); // Map to store cron job references
    this.isInitialized = false;
  }

  // Initialize the scheduler and load existing tasks
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🕐 Inicializando Task Scheduler...');
    
    try {
      await this.loadScheduledTasks();
      
      // Schedule periodic check for tasks (every minute)
      cron.schedule('* * * * *', async () => {
        await this.checkAndExecuteTasks();
      });
      
      this.isInitialized = true;
      console.log('✅ Task Scheduler inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Task Scheduler:', error);
    }
  }

  // Load all scheduled tasks from database and create cron jobs
  async loadScheduledTasks() {
    try {
      const db = database.getDb();
      if (!db) return;

      const tasksCollection = db.collection('whatsapp_tasks');
      const scheduledTasks = await tasksCollection.find({
        status: { $in: ['active', 'scheduled'] },
        isActive: true,
        $or: [
          { scheduleType: { $in: ['daily', 'weekly', 'monthly'] } },
          { cronExpression: { $exists: true, $ne: null } }
        ]
      }).toArray();

      console.log(`📋 Carregando ${scheduledTasks.length} tarefas agendadas`);

      for (const task of scheduledTasks) {
        this.scheduleTask(task);
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas agendadas:', error);
    }
  }

  // Create a cron job for a specific task
  scheduleTask(task) {
    try {
      const taskId = task._id.toString();
      
      // Remove existing cron job if it exists
      this.unscheduleTask(taskId);

      let cronExpression = this.generateCronExpression(task);
      
      if (!cronExpression) {
        console.log(`⚠️ Não foi possível gerar expressão cron para tarefa ${task.title}`);
        return;
      }

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        console.error(`❌ Expressão cron inválida para tarefa ${task.title}: ${cronExpression}`);
        return;
      }

      console.log(`📅 Agendando tarefa "${task.title}" com cron: ${cronExpression}`);

      const cronJob = cron.schedule(cronExpression, async () => {
        console.log(`🚀 Executando tarefa agendada: ${task.title}`);
        await this.executeScheduledTask(task);
      }, {
        scheduled: true,
        timezone: task.timezone || 'America/Sao_Paulo'
      });

      this.scheduledTasks.set(taskId, cronJob);
    } catch (error) {
      console.error(`Erro ao agendar tarefa ${task.title}:`, error);
    }
  }

  // Generate cron expression based on task schedule
  generateCronExpression(task) {
    if (task.cronExpression) {
      return task.cronExpression;
    }

    if (!task.scheduledTime) {
      return null;
    }

    const scheduledDate = new Date(task.scheduledTime);
    const minute = scheduledDate.getMinutes();
    const hour = scheduledDate.getHours();
    const dayOfMonth = scheduledDate.getDate();
    const dayOfWeek = scheduledDate.getDay();

    switch (task.scheduleType) {
      case 'once':
        // For one-time tasks, we'll handle them in checkAndExecuteTasks
        return null;
      
      case 'daily':
        return `${minute} ${hour} * * *`;
      
      case 'weekly':
        return `${minute} ${hour} * * ${dayOfWeek}`;
      
      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth} * *`;
      
      default:
        return null;
    }
  }

  // Execute a scheduled task
  async executeScheduledTask(task) {
    try {
      const db = database.getDb();
      if (!db) return;

      const tasksCollection = db.collection('whatsapp_tasks');
      
      // Check if task is still active
      const currentTask = await tasksCollection.findOne({
        _id: new ObjectId(task._id),
        status: { $in: ['active', 'scheduled'] },
        isActive: true
      });

      if (!currentTask) {
        console.log(`⚠️ Tarefa ${task.title} não está mais ativa, removendo do agendamento`);
        this.unscheduleTask(task._id.toString());
        return;
      }

      // Execute the task
      const executionResult = await this.executeTask(currentTask);

      // Update task execution log
      const updateData = {
        $set: {
          lastExecution: new Date(),
          updated: new Date(),
          status: currentTask.scheduleType === 'once' ? 'completed' : 'active'
        },
        $inc: {
          executionCount: 1
        },
        $push: {
          executionLog: {
            timestamp: new Date(),
            status: executionResult.success ? 'success' : 'error',
            message: executionResult.message,
            details: executionResult.details || null
          }
        }
      };

      // For recurring tasks, calculate next execution
      if (currentTask.scheduleType !== 'once') {
        updateData.$set.nextExecution = this.calculateNextExecution(currentTask);
      }

      await tasksCollection.updateOne(
        { _id: new ObjectId(task._id) },
        updateData
      );

      // If it's a one-time task, unschedule it
      if (currentTask.scheduleType === 'once') {
        this.unscheduleTask(task._id.toString());
      }

      console.log(`✅ Tarefa ${task.title} executada: ${executionResult.success ? 'Sucesso' : 'Erro'}`);
    } catch (error) {
      console.error(`❌ Erro ao executar tarefa agendada ${task.title}:`, error);
    }
  }

  // Calculate typing delay based on message length (simulate human typing)
  calculateTypingDelay(message) {
    const baseDelay = 1000; // 1 second base delay
    const wordsPerMinute = 60; // Average typing speed
    const charactersPerSecond = (wordsPerMinute * 5) / 60; // ~5 chars per word
    
    const messageLength = message ? message.length : 0;
    const typingTime = Math.max(messageLength / charactersPerSecond * 1000, baseDelay);
    
    // Add some randomness to make it more human-like (±20%)
    const randomFactor = 0.8 + (Math.random() * 0.4);
    return Math.floor(typingTime * randomFactor);
  }

  // Simulate typing presence
  async simulateTyping(sock, targetJid, duration) {
    try {
      console.log(`🔤 Simulando digitação por ${duration}ms para ${targetJid}`);
      
      // Send typing indicator
      await sock.sendPresenceUpdate('composing', targetJid);
      
      // Wait for the calculated duration
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Stop typing indicator
      await sock.sendPresenceUpdate('paused', targetJid);
      
      // Small pause before sending message
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
      
    } catch (error) {
      console.warn('Erro ao simular digitação:', error.message);
      // Continue even if typing simulation fails
    }
  }

  // Execute task logic with anti-ban measures and multiple targets support
  async executeTask(task) {
    try {
      const sessions = global.whatsappSessions;
      
      if (!sessions || !sessions.has(task.sessionId)) {
        return {
          success: false,
          message: 'Sessão não encontrada ou não conectada'
        };
      }

      const session = sessions.get(task.sessionId);
      if (!session.isConnected) {
        return {
          success: false,
          message: 'Sessão não está conectada'
        };
      }

      const sock = session.sock;
      
      // Support both single target (targetId) and multiple targets (targetIds)
      let finalTargetIds = [];
      if (task.targetIds && Array.isArray(task.targetIds) && task.targetIds.length > 0) {
        finalTargetIds = task.targetIds.filter(id => id && id !== 'none');
      } else if (task.targetId && task.targetId !== 'none') {
        finalTargetIds = [task.targetId];
      }
      
      if (finalTargetIds.length === 0) {
        return {
          success: false,
          message: 'Nenhum destino válido encontrado'
        };
      }

      console.log(`🎯 [SCHEDULER] Executando tarefa para ${finalTargetIds.length} destino(s):`, finalTargetIds.map(id => id.split('@')[0]));
      
      const results = [];
      const successCount = { value: 0 };
      const errorCount = { value: 0 };
      
      // Execute for each target with anti-spam delays
      for (let i = 0; i < finalTargetIds.length; i++) {
        const targetId = finalTargetIds[i];
        let targetJid = targetId;

        // Format JID if necessary
        if (task.targetType === 'group' && !targetJid.includes('@g.us')) {
          targetJid = `${targetJid}@g.us`;
        }
        if (task.targetType === 'contact' && !targetJid.includes('@s.whatsapp.net')) {
          targetJid = `${targetJid}@s.whatsapp.net`;
        }

        console.log(`📱 [SCHEDULER] [${i + 1}/${finalTargetIds.length}] Processando destino: ${targetJid}`);
        
        try {
          const executionResult = await this.executeSingleTarget(sock, task, targetJid);
          results.push(executionResult);
          
          if (executionResult.success) {
            successCount.value++;
            console.log(`✅ [SCHEDULER] [${i + 1}/${finalTargetIds.length}] Sucesso para ${targetJid}`);
          } else {
            errorCount.value++;
            console.log(`❌ [SCHEDULER] [${i + 1}/${finalTargetIds.length}] Erro para ${targetJid}: ${executionResult.message}`);
          }
          
          // Anti-spam delay between targets (but not after the last one)
          if (i < finalTargetIds.length - 1) {
            const delayMs = 2000 + Math.random() * 3000; // 2-5 seconds
            console.log(`⏳ [SCHEDULER] Aguardando ${Math.round(delayMs)}ms antes do próximo destino...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
        } catch (targetError) {
          console.error(`❌ [SCHEDULER] Erro na execução para ${targetJid}:`, targetError);
          errorCount.value++;
          results.push({
            success: false,
            targetJid,
            message: targetError.message,
            details: { error: targetError.message }
          });
        }
      }
      
      // Summary of execution results
      const overallSuccess = successCount.value > 0;
      const totalTargets = finalTargetIds.length;
      
      console.log(`🏁 [SCHEDULER] Execução completa: ${successCount.value}/${totalTargets} sucessos, ${errorCount.value}/${totalTargets} erros`);

      return {
        success: overallSuccess,
        message: overallSuccess 
          ? `Tarefa executada para ${successCount.value}/${totalTargets} destinos com sucesso`
          : `Falha na execução da tarefa para todos os ${totalTargets} destinos`,
        details: {
          totalTargets,
          successCount: successCount.value,
          errorCount: errorCount.value,
          results,
          timestamp: new Date()
        }
      };

    } catch (error) {
      console.error('[SCHEDULER] Erro na execução da tarefa:', error);
      return {
        success: false,
        message: error.message,
        details: {
          error: error.message,
          timestamp: new Date()
        }
      };
    }
  }

  // Helper function to execute task for a single target
  async executeSingleTarget(sock, task, targetJid) {
    const fs = require('fs');
    const { delay } = require('@whiskeysockets/baileys');
    
    try {
      // Calculate typing delay based on message content
      const typingDelay = this.calculateTypingDelay(task.message);
      
      // Simulate typing for all message types (but media will have specific handling)
      if (['send_message', 'group_announcement', 'broadcast_message'].includes(task.type)) {
        await this.simulateTyping(sock, targetJid, typingDelay);
      } else if (['send_media', 'send_document'].includes(task.type)) {
        // Detect media type for proper presence simulation
        const isVideo = task.mediaType && task.mediaType.startsWith('video/');
        const isAudio = task.mediaType && task.mediaType.startsWith('audio/');
        const isImage = task.mediaType && (task.mediaType.startsWith('image/') || !task.mediaType);
        const isDocument = task.type === 'send_document';
        
        // Use appropriate presence type based on media
        let presenceType = 'composing'; // default
        let mediaTypeText = 'mídia';
        
        if (isVideo) {
          mediaTypeText = 'vídeo';
          presenceType = 'composing';
        } else if (isAudio) {
          mediaTypeText = 'áudio';
          presenceType = 'recording';
        } else if (isImage) {
          mediaTypeText = 'imagem';
          presenceType = 'composing';
        } else if (isDocument) {
          mediaTypeText = 'documento';
          presenceType = 'composing';
        }
        
        console.log(`📤 [SCHEDULER] Simulando ${presenceType} de ${mediaTypeText} para ${targetJid}`);
        await sock.sendPresenceUpdate(presenceType, targetJid);
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2500));
        await sock.sendPresenceUpdate('paused', targetJid);
      }

      let result;

      switch (task.type) {
        case 'send_message':
        case 'group_announcement':
        case 'broadcast_message':
          result = await sock.sendMessage(targetJid, { text: task.message });
          break;

        case 'send_media':
          if (task.mediaUrl || task.mediaPath) {
            let mediaSource;
            
            if (task.mediaPath) {
              // Check if file exists
              if (!fs.existsSync(task.mediaPath)) {
                throw new Error(`Arquivo não encontrado: ${task.mediaPath}`);
              }
              
              // Get file stats for additional validation
              const stats = fs.statSync(task.mediaPath);
              console.log(`📁 [SCHEDULER] Arquivo encontrado - Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
              
              if (stats.size === 0) {
                throw new Error(`Arquivo está vazio: ${task.mediaPath}`);
              }
              
              // Use file path for Baileys (fixed format)
              mediaSource = { url: task.mediaPath };
              console.log(`📁 [SCHEDULER] Usando arquivo local: ${task.mediaPath}`);
            } else {
              mediaSource = { url: task.mediaUrl };
              console.log(`🔗 [SCHEDULER] Usando URL externa: ${task.mediaUrl}`);
            }
            
            // Additional typing simulation for caption if present
            if (task.message && task.message.trim()) {
              console.log(`✍️ [SCHEDULER] Simulando digitação da caption: "${task.message.substring(0, 30)}..."`);
              await this.simulateTyping(sock, targetJid, this.calculateTypingDelay(task.message));
            }
            
            // Detect media type and send accordingly (proper media type handling)
            const isVideo = task.mediaType && task.mediaType.startsWith('video/');
            const isAudio = task.mediaType && task.mediaType.startsWith('audio/');
            const isSticker = task.mediaType && task.mediaType === 'image/webp';
            
            console.log(`📤 [SCHEDULER] Enviando mídia tipo: ${isVideo ? 'video' : isAudio ? 'audio' : isSticker ? 'sticker' : 'image'} para ${targetJid}`);
            
            if (isVideo) {
              console.log(`🎥 [SCHEDULER] Enviando vídeo com caption: "${task.message || 'sem caption'}"`);
              result = await sock.sendMessage(targetJid, {
                video: mediaSource,
                caption: task.message || '',
                ...(task.mediaPath && { mimetype: task.mediaType })
              });
            } else if (isAudio) {
              console.log(`🔊 [SCHEDULER] Enviando áudio (${task.mediaType})`);
              result = await sock.sendMessage(targetJid, {
                audio: mediaSource,
                mimetype: task.mediaType,
                ptt: false
              });
              
              // Audio doesn't support caption, send separate message if there's text
              if (task.message && task.message.trim()) {
                console.log(`📝 [SCHEDULER] Enviando texto separado para áudio: "${task.message}"`);
                await delay(500);
                result = await sock.sendMessage(targetJid, {
                  text: task.message
                });
              }
            } else if (isSticker) {
              console.log(`🎯 [SCHEDULER] Enviando sticker`);
              result = await sock.sendMessage(targetJid, {
                sticker: mediaSource
              });
              
              // Sticker doesn't support caption, send separate message if there's text
              if (task.message && task.message.trim()) {
                console.log(`📝 [SCHEDULER] Enviando texto separado para sticker: "${task.message}"`);
                await delay(500);
                result = await sock.sendMessage(targetJid, {
                  text: task.message
                });
              }
            } else {
              // Default to image
              console.log(`🖼️ [SCHEDULER] Enviando imagem com caption: "${task.message || 'sem caption'}"`);
              result = await sock.sendMessage(targetJid, {
                image: mediaSource,
                caption: task.message || '',
                ...(task.mediaPath && { mimetype: task.mediaType })
              });
            }
          } else {
            throw new Error('URL ou arquivo da mídia não fornecida');
          }
          break;

        case 'send_document':
          if (task.mediaUrl || task.mediaPath) {
            let mediaSource;
            
            if (task.mediaPath) {
              if (!fs.existsSync(task.mediaPath)) {
                throw new Error(`Arquivo não encontrado: ${task.mediaPath}`);
              }
              
              // Get file stats for additional validation
              const stats = fs.statSync(task.mediaPath);
              console.log(`📁 [SCHEDULER] Documento encontrado - Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
              
              if (stats.size === 0) {
                throw new Error(`Documento está vazio: ${task.mediaPath}`);
              }
              
              // Use file path for Baileys (fixed format)
              mediaSource = { url: task.mediaPath };
              console.log(`📁 [SCHEDULER] Usando documento local: ${task.mediaPath}`);
            } else {
              mediaSource = { url: task.mediaUrl };
              console.log(`🔗 [SCHEDULER] Usando documento URL: ${task.mediaUrl}`);
            }
            
            // Additional typing simulation for document caption if present
            if (task.message && task.message.trim()) {
              console.log(`✍️ [SCHEDULER] Simulando digitação da caption do documento: "${task.message.substring(0, 30)}..."`);
              await this.simulateTyping(sock, targetJid, this.calculateTypingDelay(task.message));
            }
            
            console.log(`📄 [SCHEDULER] Enviando documento para ${targetJid}`);
            
            result = await sock.sendMessage(targetJid, {
              document: mediaSource,
              caption: task.message || '',
              mimetype: task.mediaType || 'application/pdf',
              fileName: task.fileName || 'document.pdf'
            });
            console.log(`✅ [SCHEDULER] Documento enviado com sucesso:`, result?.key);
          } else {
            throw new Error('URL ou arquivo do documento não fornecida');
          }
          break;

        default:
          throw new Error(`Tipo de tarefa não suportado: ${task.type}`);
      }

      console.log(`🎯 [SCHEDULER] Tarefa executada com sucesso para ${targetJid}:`, {
        taskType: task.type,
        hasMedia: !!(task.mediaPath || task.mediaUrl),
        messageId: result?.key?.id,
        targetJid
      });

      return {
        success: true,
        message: 'Tarefa executada com sucesso',
        details: {
          messageId: result?.key?.id,
          targetJid,
          timestamp: new Date(),
          typingDelay: typingDelay
        }
      };

    } catch (error) {
      console.error('[SCHEDULER] Erro na execução da tarefa:', error);
      return {
        success: false,
        message: error.message,
        details: {
          error: error.message,
          timestamp: new Date()
        }
      };
    }
  }

  // Check for one-time tasks that need to be executed
  async checkAndExecuteTasks() {
    try {
      const db = database.getDb();
      if (!db) return;

      const tasksCollection = db.collection('whatsapp_tasks');
      const now = new Date();

      // Find one-time tasks that should be executed now
      const tasksToExecute = await tasksCollection.find({
        scheduleType: 'once',
        status: { $in: ['active', 'scheduled'] },
        isActive: true,
        scheduledTime: { $lte: now },
        $or: [
          { lastExecution: { $exists: false } },
          { lastExecution: null }
        ]
      }).toArray();

      for (const task of tasksToExecute) {
        console.log(`🕐 Executando tarefa única: ${task.title}`);
        await this.executeScheduledTask(task);
      }
    } catch (error) {
      console.error('Erro ao verificar tarefas para execução:', error);
    }
  }

  // Calculate next execution time for recurring tasks
  calculateNextExecution(task) {
    if (task.scheduleType === 'once') return null;
    if (!task.scheduledTime) return null;

    const now = new Date();
    const scheduled = new Date(task.scheduledTime);
    let next = new Date(scheduled);

    switch (task.scheduleType) {
      case 'daily':
        while (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;
      case 'weekly':
        while (next <= now) {
          next.setDate(next.getDate() + 7);
        }
        break;
      case 'monthly':
        while (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
    }

    return next;
  }

  // Remove a scheduled task
  unscheduleTask(taskId) {
    const cronJob = this.scheduledTasks.get(taskId);
    if (cronJob) {
      cronJob.stop();
      cronJob.destroy();
      this.scheduledTasks.delete(taskId);
      console.log(`🗑️ Tarefa ${taskId} removida do agendamento`);
    }
  }

  // Reschedule a task (useful when task is updated)
  async rescheduleTask(taskData) {
    const taskId = taskData._id ? taskData._id.toString() : taskData.id;
    
    // Remove existing schedule
    this.unscheduleTask(taskId);
    
    // Add new schedule if task is active
    if (taskData.status === 'active' && taskData.isActive) {
      this.scheduleTask(taskData);
    }
  }

  // Get scheduler statistics
  getStats() {
    return {
      scheduledTasksCount: this.scheduledTasks.size,
      isInitialized: this.isInitialized,
      scheduledTaskIds: Array.from(this.scheduledTasks.keys())
    };
  }

  // Stop all scheduled tasks
  stopAll() {
    console.log('🛑 Parando todos os agendamentos...');
    for (const [taskId, cronJob] of this.scheduledTasks) {
      cronJob.stop();
      cronJob.destroy();
    }
    this.scheduledTasks.clear();
    this.isInitialized = false;
    console.log('✅ Todos os agendamentos foram parados');
  }
}

// Create singleton instance
const taskScheduler = new TaskScheduler();

module.exports = taskScheduler;