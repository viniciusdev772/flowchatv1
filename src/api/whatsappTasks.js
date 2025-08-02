const express = require('express');
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const taskScheduler = require('../scheduler/taskScheduler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { delay } = require('@whiskeysockets/baileys');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../downloads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `task-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
    'text/plain': true,
    'audio/mpeg': true,
    'audio/mp4': true,
    'audio/wav': true,
    'video/mp4': true,
    'video/avi': true,
    'video/mkv': true
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Middleware para verificar autenticação
const checkAuth = (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
  }
  req.userId = userId.toString();
  next();
};

// Middleware para verificar se sessão pertence ao usuário
const checkSessionOwnership = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const userId = req.userId;

    // Verificar se a sessão existe e pertence ao usuário
    const sessions = global.whatsappSessions;
    if (!sessions || !sessions.has(sessionId)) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada'
      });
    }

    const session = sessions.get(sessionId);
    if (session.userId && session.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: você não possui permissão para esta sessão'
      });
    }

    next();
  } catch (error) {
    console.error('Erro na verificação de propriedade da sessão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Função para calcular próxima execução baseada no cronJob
const calculateNextExecution = (task) => {
  const now = new Date();
  
  if (!task.scheduledTime) return null;
  
  const scheduled = new Date(task.scheduledTime);
  
  if (task.scheduleType === 'once') {
    return scheduled > now ? scheduled : null;
  }
  
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
    case 'custom':
      // Para expressões cron personalizadas, implementar parser se necessário
      return null;
  }
  
  return next;
};

// GET /api/baileys/tasks - Listar tarefas do usuário
router.get('/', checkAuth, async (req, res) => {
  try {
    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const tasksCollection = db.collection('whatsapp_tasks');
    
    // Filtros opcionais
    const { status, type, sessionId, limit = 50, offset = 0 } = req.query;
    
    const query = { userId: req.userId };
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (sessionId) query.sessionId = sessionId;

    const tasks = await tasksCollection
      .find(query)
      .sort({ created: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .toArray();

    const total = await tasksCollection.countDocuments(query);

    res.json({
      success: true,
      tasks: tasks.map(task => ({
        ...task,
        id: task._id.toString()
      })),
      total,
      returned: tasks.length
    });

  } catch (error) {
    console.error('Erro ao listar tarefas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/baileys/tasks/upload - Upload de arquivo para tarefa
router.post('/upload', checkAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: `/downloads/${req.file.filename}`
    };

    console.log('📁 Arquivo uploadado:', fileInfo);

    res.json({
      success: true,
      message: 'Arquivo uploadado com sucesso',
      file: fileInfo
    });

  } catch (error) {
    console.error('Erro no upload do arquivo:', error);
    
    // Clean up file if upload failed
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Erro ao limpar arquivo:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno no upload do arquivo'
    });
  }
});

// POST /api/baileys/tasks - Criar nova tarefa
router.post('/', checkAuth, checkSessionOwnership, async (req, res) => {
  try {
    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const {
      title,
      type,
      sessionId,
      targetType,
      targetId,
      targetIds, // New: array of target IDs for multiple destinations
      message,
      scheduleType,
      scheduledTime,
      cronExpression,
      isActive,
      addSignature,
      mediaUrl,
      mediaType,
      mediaPath,
      fileName,
      repeatCount,
      timezone
    } = req.body;

    // Validações obrigatórias
    if (!title || !type || !sessionId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: title, type, sessionId, message'
      });
    }

    // Support both single target (targetId) and multiple targets (targetIds)
    let finalTargetIds = [];
    if (targetIds && Array.isArray(targetIds) && targetIds.length > 0) {
      // Multiple targets mode
      finalTargetIds = targetIds.filter(id => id && id !== 'none');
    } else if (targetId && targetId !== 'none') {
      // Single target mode (backward compatibility)
      finalTargetIds = [targetId];
    }
    
    if (finalTargetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: targetType === 'group' ? 'Selecione pelo menos um grupo' : 'Informe pelo menos um contato de destino'
      });
    }

    // Preparar mensagem com assinatura obrigatória
    let finalMessage = message;
    finalMessage += '\n\n_Esta mensagem foi enviada usando o FlowChat Task Runners v3_';

    const now = new Date();
    const nextExecution = calculateNextExecution({
      scheduledTime,
      scheduleType
    });

    const taskData = {
      userId: req.userId,
      title,
      type,
      sessionId,
      targetType,
      targetId: finalTargetIds[0], // Keep first target for backward compatibility
      targetIds: finalTargetIds, // New: array of all target IDs
      targetCount: finalTargetIds.length, // New: count of targets
      message: finalMessage,
      originalMessage: message,
      scheduleType,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      cronExpression: cronExpression || null,
      status: scheduledTime && nextExecution ? 'scheduled' : 'active',
      isActive: isActive !== false,
      addSignature: true, // Always true now
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      mediaPath: mediaPath || null,
      fileName: fileName || null,
      repeatCount: repeatCount || 1,
      timezone: timezone || 'America/Sao_Paulo',
      created: now,
      updated: now,
      lastExecution: null,
      nextExecution: nextExecution,
      executionCount: 0,
      executionLog: []
    };

    const tasksCollection = db.collection('whatsapp_tasks');
    const result = await tasksCollection.insertOne(taskData);

    const createdTask = {
      ...taskData,
      _id: result.insertedId,
      id: result.insertedId.toString()
    };

    // Agendar tarefa no scheduler se necessário
    if (createdTask.isActive && (createdTask.status === 'active' || createdTask.status === 'scheduled')) {
      try {
        await taskScheduler.rescheduleTask(createdTask);
      } catch (error) {
        console.error('Erro ao agendar tarefa no scheduler:', error);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Tarefa criada com sucesso',
      task: createdTask
    });

  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/baileys/tasks/:taskId - Atualizar tarefa
router.put('/:taskId', checkAuth, async (req, res) => {
  try {
    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const { taskId } = req.params;
    const updateData = { ...req.body };
    delete updateData.userId; // Não permitir alteração do userId
    
    updateData.updated = new Date();

    // Recalcular próxima execução se schedule foi alterado
    if (updateData.scheduledTime || updateData.scheduleType) {
      const nextExecution = calculateNextExecution(updateData);
      updateData.nextExecution = nextExecution;
      
      if (nextExecution && updateData.status !== 'paused') {
        updateData.status = 'scheduled';
      }
    }

    const tasksCollection = db.collection('whatsapp_tasks');
    const result = await tasksCollection.updateOne(
      { 
        _id: new ObjectId(taskId),
        userId: req.userId 
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    // Buscar tarefa atualizada
    const updatedTask = await tasksCollection.findOne({
      _id: new ObjectId(taskId)
    });

    // Reagendar tarefa no scheduler
    try {
      await taskScheduler.rescheduleTask(updatedTask);
    } catch (error) {
      console.error('Erro ao reagendar tarefa no scheduler:', error);
    }

    res.json({
      success: true,
      message: 'Tarefa atualizada com sucesso',
      task: {
        ...updatedTask,
        id: updatedTask._id.toString()
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PATCH /api/baileys/tasks/:taskId/status - Alterar status da tarefa
router.patch('/:taskId/status', checkAuth, async (req, res) => {
  try {
    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const { taskId } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido'
      });
    }

    const tasksCollection = db.collection('whatsapp_tasks');
    const result = await tasksCollection.updateOne(
      { 
        _id: new ObjectId(taskId),
        userId: req.userId 
      },
      { 
        $set: { 
          status,
          updated: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    // Buscar tarefa atualizada e reagendar no scheduler
    const updatedTask = await tasksCollection.findOne({
      _id: new ObjectId(taskId)
    });

    try {
      await taskScheduler.rescheduleTask(updatedTask);
    } catch (error) {
      console.error('Erro ao reagendar tarefa no scheduler:', error);
    }

    res.json({
      success: true,
      message: `Status alterado para ${status}`,
      status
    });

  } catch (error) {
    console.error('Erro ao alterar status da tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/baileys/tasks/:taskId - Excluir tarefa
router.delete('/:taskId', checkAuth, async (req, res) => {
  try {
    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const { taskId } = req.params;

    const tasksCollection = db.collection('whatsapp_tasks');
    const result = await tasksCollection.deleteOne({
      _id: new ObjectId(taskId),
      userId: req.userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    // Remover tarefa do scheduler
    try {
      taskScheduler.unscheduleTask(taskId);
    } catch (error) {
      console.error('Erro ao remover tarefa do scheduler:', error);
    }

    res.json({
      success: true,
      message: 'Tarefa excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/baileys/tasks/:taskId/execute - Executar tarefa manualmente
router.post('/:taskId/execute', checkAuth, async (req, res) => {
  try {
    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const { taskId } = req.params;

    const tasksCollection = db.collection('whatsapp_tasks');
    const task = await tasksCollection.findOne({
      _id: new ObjectId(taskId),
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    // Executar a tarefa
    const executionResult = await executeTask(task);

    // Atualizar contador e log de execução
    const updateData = {
      $set: {
        lastExecution: new Date(),
        updated: new Date()
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

    // Only increment counter if execution was successful
    if (executionResult.success) {
      updateData.$inc = { executionCount: 1 };
    }

    await tasksCollection.updateOne(
      { _id: new ObjectId(taskId) },
      updateData
    );

    res.json({
      success: executionResult.success,
      message: executionResult.success ? 'Tarefa executada com sucesso' : 'Falha na execução da tarefa',
      execution: executionResult
    });

  } catch (error) {
    console.error('Erro ao executar tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Calculate typing delay based on message length (simulate human typing)
function calculateTypingDelay(message) {
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
async function simulateTyping(sock, targetJid, duration) {
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

// Função para executar uma tarefa com medidas anti-ban
async function executeTask(task) {
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

    // Formatar JID se necessário
    if (task.targetType === 'group' && !targetJid.includes('@g.us')) {
      targetJid = `${targetJid}@g.us`;
    }
    if (task.targetType === 'contact' && !targetJid.includes('@s.whatsapp.net')) {
      targetJid = `${targetJid}@s.whatsapp.net`;
    }

    // Calculate typing delay based on message content
    const typingDelay = calculateTypingDelay(task.message);
    
    // Simulate typing for all message types (but media will have specific handling)
    if (['send_message', 'group_announcement', 'broadcast_message'].includes(task.type)) {
      await simulateTyping(sock, targetJid, typingDelay);
    } else if (['send_media', 'send_document'].includes(task.type)) {
      // Detect media type for proper presence simulation
      const isVideo = task.mediaType && task.mediaType.startsWith('video/');
      const isAudio = task.mediaType && task.mediaType.startsWith('audio/');
      const isImage = task.mediaType && (task.mediaType.startsWith('image/') || !task.mediaType);
      const isDocument = task.type === 'send_document';
      
      // Use appropriate presence type based on media (only valid Baileys presence states)
      let presenceType = 'composing'; // default for most media (text-like activity)
      let mediaTypeText = 'mídia';
      
      if (isVideo) {
        mediaTypeText = 'vídeo';
        // For video, use 'composing' to simulate activity
        presenceType = 'composing';
      } else if (isAudio) {
        mediaTypeText = 'áudio';
        // For audio, use 'recording' to simulate voice message recording
        presenceType = 'recording';
      } else if (isImage) {
        mediaTypeText = 'imagem';
        // For images, use 'composing' to simulate activity
        presenceType = 'composing';
      } else if (isDocument) {
        mediaTypeText = 'documento';
        // For documents, use 'composing' to simulate activity
        presenceType = 'composing';
      }
      
      console.log(`📤 Simulando ${presenceType} de ${mediaTypeText} para ${targetJid}`);
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
            console.log(`📁 Arquivo encontrado - Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            
            if (stats.size === 0) {
              throw new Error(`Arquivo está vazio: ${task.mediaPath}`);
            }
            
            // Use file path for Baileys (documentation: { url: "./path/to/file" })
            mediaSource = { url: task.mediaPath };
            console.log(`📁 Usando arquivo local: ${task.mediaPath}`);
          } else {
            mediaSource = { url: task.mediaUrl };
            console.log(`🔗 Usando URL externa: ${task.mediaUrl}`);
          }
          
          // Additional typing simulation for caption if present
          if (task.message && task.message.trim()) {
            console.log(`✍️ Simulando digitação da caption: "${task.message.substring(0, 30)}..."`);
            await simulateTyping(sock, targetJid, calculateTypingDelay(task.message));
          }
          
          // Detect media type and send accordingly
          const isVideo = task.mediaType && task.mediaType.startsWith('video/');
          const isAudio = task.mediaType && task.mediaType.startsWith('audio/');
          const isSticker = task.mediaType && task.mediaType === 'image/webp';
          
          console.log(`📤 Enviando mídia tipo: ${isVideo ? 'video' : isAudio ? 'audio' : isSticker ? 'sticker' : 'image'} para ${targetJid}`);
          console.log(`📄 Detalhes da mídia:`, {
            mediaPath: task.mediaPath,
            mediaUrl: task.mediaUrl,
            mediaType: task.mediaType,
            fileName: task.fileName,
            message: task.message
          });
          
          if (isVideo) {
            console.log(`🎥 Enviando vídeo com caption: "${task.message || 'sem caption'}"`);
            result = await sock.sendMessage(targetJid, {
              video: mediaSource,
              caption: task.message || '',
              ...(task.mediaPath && { mimetype: task.mediaType })
            });
            console.log(`✅ Vídeo enviado com sucesso:`, result?.key);
          } else if (isAudio) {
            console.log(`🔊 Enviando áudio (${task.mediaType})`);
            result = await sock.sendMessage(targetJid, {
              audio: mediaSource,
              mimetype: task.mediaType,
              ptt: false // false = áudio regular, true = mensagem de voz
            });
            console.log(`✅ Áudio enviado com sucesso:`, result?.key);
            
            // Áudio não suporta caption, enviar mensagem separada se houver texto
            if (task.message && task.message.trim()) {
              console.log(`📝 Enviando texto separado para áudio: "${task.message}"`);
              await delay(500); // pequeno delay entre as mensagens
              result = await sock.sendMessage(targetJid, {
                text: task.message
              });
              console.log(`✅ Mensagem de texto enviada:`, result?.key);
            }
          } else if (isSticker) {
            console.log(`🎯 Enviando sticker`);
            result = await sock.sendMessage(targetJid, {
              sticker: mediaSource
            });
            console.log(`✅ Sticker enviado com sucesso:`, result?.key);
            
            // Sticker não suporta caption, enviar mensagem separada se houver texto
            if (task.message && task.message.trim()) {
              console.log(`📝 Enviando texto separado para sticker: "${task.message}"`);
              await delay(500);
              result = await sock.sendMessage(targetJid, {
                text: task.message
              });
              console.log(`✅ Mensagem de texto enviada:`, result?.key);
            }
          } else {
            // Default to image
            console.log(`🖼️ Enviando imagem com caption: "${task.message || 'sem caption'}"`);
            result = await sock.sendMessage(targetJid, {
              image: mediaSource,
              caption: task.message || '',
              ...(task.mediaPath && { mimetype: task.mediaType })
            });
            console.log(`✅ Imagem enviada com sucesso:`, result?.key);
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
            console.log(`📁 Documento encontrado - Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            
            if (stats.size === 0) {
              throw new Error(`Documento está vazio: ${task.mediaPath}`);
            }
            
            // Use file path for Baileys (documentation: { url: "./path/to/file" })
            mediaSource = { url: task.mediaPath };
            console.log(`📁 Usando documento local: ${task.mediaPath}`);
          } else {
            mediaSource = { url: task.mediaUrl };
            console.log(`🔗 Usando documento URL: ${task.mediaUrl}`);
          }
          
          // Additional typing simulation for document caption if present
          if (task.message && task.message.trim()) {
            console.log(`✍️ Simulando digitação da caption do documento: "${task.message.substring(0, 30)}..."`);
            await simulateTyping(sock, targetJid, calculateTypingDelay(task.message));
          }
          
          console.log(`📄 Enviando documento para ${targetJid}`);
          console.log(`📄 Detalhes do documento:`, {
            mediaPath: task.mediaPath,
            mediaUrl: task.mediaUrl,
            mediaType: task.mediaType,
            fileName: task.fileName,
            message: task.message
          });
          
          result = await sock.sendMessage(targetJid, {
            document: mediaSource,
            caption: task.message || '',
            mimetype: task.mediaType || 'application/pdf',
            fileName: task.fileName || 'document.pdf'
          });
          console.log(`✅ Documento enviado com sucesso:`, result?.key);
        } else {
          throw new Error('URL ou arquivo do documento não fornecida');
        }
        break;

      default:
        throw new Error(`Tipo de tarefa não suportado: ${task.type}`);
    }

    console.log(`🎯 Tarefa executada com sucesso para ${targetJid}:`, {
      taskType: task.type,
      hasMedia: !!(task.mediaPath || task.mediaUrl),
      messageId: result?.key?.id,
      targetJid
    });

    // Save execution to MongoDB
    try {
      const db = database.getDb();
      if (db) {
        const executionsCollection = db.collection('task_executions');
        await executionsCollection.insertOne({
          taskId: task._id || task.id,
          taskType: task.type,
          targetJid,
          messageId: result?.key?.id,
          executedAt: new Date(),
          success: true,
          details: {
            typingDelay,
            mediaType: task.mediaType || null,
            hasMedia: !!(task.mediaPath || task.mediaUrl),
            messageText: task.message || null
          }
        });
        console.log(`💾 Execução salva no MongoDB para tarefa ${task._id || task.id}`);
      }
    } catch (dbError) {
      console.warn(`Erro ao salvar execução no MongoDB: ${dbError.message}`);
    }

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
    
    // Save error execution to MongoDB
    try {
      const db = database.getDb();
      if (db) {
        const executionsCollection = db.collection('task_executions');
        await executionsCollection.insertOne({
          taskId: task._id || task.id,
          taskType: task.type,
          targetJid,
          messageId: null,
          executedAt: new Date(),
          success: false,
          error: error.message,
          details: {
            errorStack: error.stack,
            mediaType: task.mediaType || null,
            hasMedia: !!(task.mediaPath || task.mediaUrl),
            messageText: task.message || null
          }
        });
        console.log(`💾 Erro de execução salvo no MongoDB para tarefa ${task._id || task.id}`);
      }
    } catch (dbError) {
      console.warn(`Erro ao salvar erro de execução no MongoDB: ${dbError.message}`);
    }

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

// GET /api/baileys/tasks/stats - Estatísticas das tarefas
router.get('/stats', checkAuth, async (req, res) => {
  try {
    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const tasksCollection = db.collection('whatsapp_tasks');
    
    const pipeline = [
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalExecutions: { $sum: '$executionCount' }
        }
      }
    ];

    const stats = await tasksCollection.aggregate(pipeline).toArray();
    
    const totalTasks = await tasksCollection.countDocuments({ userId: req.userId });
    const totalExecutions = stats.reduce((sum, stat) => sum + stat.totalExecutions, 0);

    const statusCounts = {
      active: 0,
      paused: 0,
      scheduled: 0,
      completed: 0,
      failed: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    res.json({
      success: true,
      stats: {
        total: totalTasks,
        totalExecutions,
        byStatus: statusCounts
      }
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;