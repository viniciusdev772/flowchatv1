const express = require('express');
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const taskScheduler = require('../scheduler/taskScheduler');

const router = express.Router();

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
      message,
      scheduleType,
      scheduledTime,
      cronExpression,
      isActive,
      addSignature,
      mediaUrl,
      mediaType,
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

    if (!targetId || targetId === 'none') {
      return res.status(400).json({
        success: false,
        message: targetType === 'group' ? 'Selecione um grupo' : 'Informe o contato de destino'
      });
    }

    // Preparar mensagem com assinatura se necessário
    let finalMessage = message;
    if (addSignature) {
      finalMessage += '\n\n_Esta mensagem foi enviada usando o FlowChat Task Runners_';
    }

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
      targetId,
      message: finalMessage,
      originalMessage: message,
      scheduleType,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      cronExpression: cronExpression || null,
      status: scheduledTime && nextExecution ? 'scheduled' : 'active',
      isActive: isActive !== false,
      addSignature: addSignature !== false,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
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
    await tasksCollection.updateOne(
      { _id: new ObjectId(taskId) },
      {
        $set: {
          lastExecution: new Date(),
          updated: new Date()
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
      }
    );

    res.json({
      success: true,
      message: 'Tarefa executada',
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

// Função para executar uma tarefa
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

    let result;

    switch (task.type) {
      case 'send_message':
      case 'group_announcement':
      case 'broadcast_message':
        result = await sock.sendMessage(targetJid, { text: task.message });
        break;

      case 'send_media':
        if (task.mediaUrl) {
          result = await sock.sendMessage(targetJid, {
            image: { url: task.mediaUrl },
            caption: task.message
          });
        } else {
          throw new Error('URL da mídia não fornecida');
        }
        break;

      case 'send_document':
        if (task.mediaUrl) {
          result = await sock.sendMessage(targetJid, {
            document: { url: task.mediaUrl },
            caption: task.message,
            mimetype: task.mediaType || 'application/pdf'
          });
        } else {
          throw new Error('URL do documento não fornecida');
        }
        break;

      default:
        throw new Error(`Tipo de tarefa não suportado: ${task.type}`);
    }

    return {
      success: true,
      message: 'Tarefa executada com sucesso',
      details: {
        messageId: result?.key?.id,
        targetJid,
        timestamp: new Date()
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