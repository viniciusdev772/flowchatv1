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

  // Execute task logic with anti-ban measures
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
      let targetJid = task.targetId;

      // Format JID if necessary
      if (task.targetType === 'group' && !targetJid.includes('@g.us')) {
        targetJid = `${targetJid}@g.us`;
      }
      if (task.targetType === 'contact' && !targetJid.includes('@s.whatsapp.net')) {
        targetJid = `${targetJid}@s.whatsapp.net`;
      }

      // Calculate typing delay based on message content
      const typingDelay = this.calculateTypingDelay(task.message);
      
      // Simulate typing for text-based messages
      if (['send_message', 'group_announcement', 'broadcast_message'].includes(task.type)) {
        await this.simulateTyping(sock, targetJid, typingDelay);
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
            const mediaSource = task.mediaPath ? { url: `file://${task.mediaPath}` } : { url: task.mediaUrl };
            
            // Simulate typing for media with caption
            if (task.message && task.message.trim()) {
              await this.simulateTyping(sock, targetJid, this.calculateTypingDelay(task.message));
            }
            
            result = await sock.sendMessage(targetJid, {
              image: mediaSource,
              caption: task.message || ''
            });
          } else {
            throw new Error('URL ou arquivo da mídia não fornecida');
          }
          break;

        case 'send_document':
          if (task.mediaUrl || task.mediaPath) {
            const mediaSource = task.mediaPath ? { url: `file://${task.mediaPath}` } : { url: task.mediaUrl };
            
            // Simulate typing for document with caption
            if (task.message && task.message.trim()) {
              await this.simulateTyping(sock, targetJid, this.calculateTypingDelay(task.message));
            }
            
            result = await sock.sendMessage(targetJid, {
              document: mediaSource,
              caption: task.message || '',
              mimetype: task.mediaType || 'application/pdf',
              fileName: task.fileName || 'document.pdf'
            });
          } else {
            throw new Error('URL ou arquivo do documento não fornecida');
          }
          break;

        default:
          throw new Error(`Tipo de tarefa não suportado: ${task.type}`);
      }

      console.log(`✅ Mensagem enviada com sucesso para ${targetJid}`);

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
      console.error('Erro na execução da tarefa:', error);
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