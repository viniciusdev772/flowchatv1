const cron = require('node-cron');
const database = require('../config/database');
const { ObjectId } = require('mongodb');

class TaskScheduler {
  constructor() {
    this.scheduledTasks = new Map();
    this.isInitialized = false;
  }


  async initialize() {
    if (this.isInitialized) return;

    console.log('🕐 Inicializando Task Scheduler...');

    try {
      await this.loadScheduledTasks();


      cron.schedule('* * * * *', async () => {
        await this.checkAndExecuteTasks();
      });

      this.isInitialized = true;
      console.log('✅ Task Scheduler inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Task Scheduler:', error);
    }
  }


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


  scheduleTask(task) {
    try {
      const taskId = task._id.toString();


      this.unscheduleTask(taskId);

      let cronExpression = this.generateCronExpression(task);

      if (!cronExpression) {
        console.log(`⚠️ Não foi possível gerar expressão cron para tarefa ${task.title}`);
        return;
      }


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


  async executeScheduledTask(task) {
    try {
      const db = database.getDb();
      if (!db) return;

      const tasksCollection = db.collection('whatsapp_tasks');


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


      const executionResult = await this.executeTask(currentTask);


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


      if (currentTask.scheduleType !== 'once') {
        updateData.$set.nextExecution = this.calculateNextExecution(currentTask);
      }

      await tasksCollection.updateOne(
        { _id: new ObjectId(task._id) },
        updateData
      );


      if (currentTask.scheduleType === 'once') {
        this.unscheduleTask(task._id.toString());
      }

      console.log(`✅ Tarefa ${task.title} executada: ${executionResult.success ? 'Sucesso' : 'Erro'}`);
    } catch (error) {
      console.error(`❌ Erro ao executar tarefa agendada ${task.title}:`, error);
    }
  }


  calculateTypingDelay(message) {
    const baseDelay = 1000;
    const wordsPerMinute = 60;
    const charactersPerSecond = (wordsPerMinute * 5) / 60;

    const messageLength = message ? message.length : 0;
    const typingTime = Math.max(messageLength / charactersPerSecond * 1000, baseDelay);


    const randomFactor = 0.8 + (Math.random() * 0.4);
    return Math.floor(typingTime * randomFactor);
  }


  async simulateTyping(sock, targetJid, duration) {
    try {
      console.log(`🔤 Simulando digitação por ${duration}ms para ${targetJid}`);


      await sock.sendPresenceUpdate('composing', targetJid);


      await new Promise(resolve => setTimeout(resolve, duration));


      await sock.sendPresenceUpdate('paused', targetJid);


      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

    } catch (error) {
      console.warn('Erro ao simular digitação:', error.message);

    }
  }


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


      for (let i = 0; i < finalTargetIds.length; i++) {
        const targetId = finalTargetIds[i];
        let targetJid = targetId;


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


          if (i < finalTargetIds.length - 1) {
            const delayMs = 2000 + Math.random() * 3000;
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


  async executeSingleTarget(sock, task, targetJid) {
    const fs = require('fs');
    const { delay } = require('@whiskeysockets/baileys');

    try {

      const typingDelay = this.calculateTypingDelay(task.message);


      if (['send_message', 'group_announcement', 'broadcast_message'].includes(task.type)) {
        await this.simulateTyping(sock, targetJid, typingDelay);
      } else if (['send_media', 'send_document'].includes(task.type)) {

        const isVideo = task.mediaType && task.mediaType.startsWith('video/');
        const isAudio = task.mediaType && task.mediaType.startsWith('audio/');
        const isImage = task.mediaType && (task.mediaType.startsWith('image/') || !task.mediaType);
        const isDocument = task.type === 'send_document';


        let presenceType = 'composing';
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

              if (!fs.existsSync(task.mediaPath)) {
                throw new Error(`Arquivo não encontrado: ${task.mediaPath}`);
              }


              const stats = fs.statSync(task.mediaPath);
              console.log(`📁 [SCHEDULER] Arquivo encontrado - Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

              if (stats.size === 0) {
                throw new Error(`Arquivo está vazio: ${task.mediaPath}`);
              }


              mediaSource = { url: task.mediaPath };
              console.log(`📁 [SCHEDULER] Usando arquivo local: ${task.mediaPath}`);
            } else {
              mediaSource = { url: task.mediaUrl };
              console.log(`🔗 [SCHEDULER] Usando URL externa: ${task.mediaUrl}`);
            }


            if (task.message && task.message.trim()) {
              console.log(`✍️ [SCHEDULER] Simulando digitação da caption: "${task.message.substring(0, 30)}..."`);
              await this.simulateTyping(sock, targetJid, this.calculateTypingDelay(task.message));
            }


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


              if (task.message && task.message.trim()) {
                console.log(`📝 [SCHEDULER] Enviando texto separado para sticker: "${task.message}"`);
                await delay(500);
                result = await sock.sendMessage(targetJid, {
                  text: task.message
                });
              }
            } else {

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


              const stats = fs.statSync(task.mediaPath);
              console.log(`📁 [SCHEDULER] Documento encontrado - Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

              if (stats.size === 0) {
                throw new Error(`Documento está vazio: ${task.mediaPath}`);
              }


              mediaSource = { url: task.mediaPath };
              console.log(`📁 [SCHEDULER] Usando documento local: ${task.mediaPath}`);
            } else {
              mediaSource = { url: task.mediaUrl };
              console.log(`🔗 [SCHEDULER] Usando documento URL: ${task.mediaUrl}`);
            }


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


  async checkAndExecuteTasks() {
    try {
      const db = database.getDb();
      if (!db) return;

      const tasksCollection = db.collection('whatsapp_tasks');
      const now = new Date();


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


  unscheduleTask(taskId) {
    const cronJob = this.scheduledTasks.get(taskId);
    if (cronJob) {
      cronJob.stop();
      cronJob.destroy();
      this.scheduledTasks.delete(taskId);
      console.log(`🗑️ Tarefa ${taskId} removida do agendamento`);
    }
  }


  async rescheduleTask(taskData) {
    const taskId = taskData._id ? taskData._id.toString() : taskData.id;


    this.unscheduleTask(taskId);


    if (taskData.status === 'active' && taskData.isActive) {
      this.scheduleTask(taskData);
    }
  }


  getStats() {
    return {
      scheduledTasksCount: this.scheduledTasks.size,
      isInitialized: this.isInitialized,
      scheduledTaskIds: Array.from(this.scheduledTasks.keys())
    };
  }


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


const taskScheduler = new TaskScheduler();

module.exports = taskScheduler;