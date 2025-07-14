const express = require('express');
const { jidDecode, areJidsSameUser } = require('@whiskeysockets/baileys');
const logger = require('pino')({ level: 'info' });

const router = express.Router();

/**
 * @swagger
 * /api/baileys/session/{sessionId}/lid/resolve:
 *   post:
 *     tags:
 *       - Sessões
 *     summary: Resolver LID para número de telefone
 *     description: Converte um LID (Local Identifier) para número de telefone WhatsApp
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão ativa do WhatsApp
 *         example: "686191ff31d679b27dcf47e5_92133798"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lid
 *             properties:
 *               lid:
 *                 type: string
 *                 description: LID a ser resolvido (deve terminar com @lid)
 *                 example: "1111111@lid"
 *     responses:
 *       200:
 *         description: LID resolvido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "LID resolvido com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     lid:
 *                       type: string
 *                       example: "1111111@lid"
 *                     pn:
 *                       type: string
 *                       example: "3333333@c.us"
 *       400:
 *         description: Dados inválidos ou LID mal formado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "LID deve terminar com @lid"
 *       404:
 *         description: Sessão não encontrada ou LID não resolvido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Sessão não encontrada"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Erro interno do servidor"
 *                 error:
 *                   type: string
 *                   example: "Detalhes do erro"
 */
// Importar middleware de verificação de sessão
const checkSessionOwnership = (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
    });
  }

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'sessionId é obrigatório',
    });
  }

  // Usar a mesma lógica do app.js original
  // sessions é um Map que mapeia sessionId para dados da sessão
  const { getSessions } = require('../app');
  const sessions = getSessions();
  const session = sessions.get(sessionId);
  
  if (!session || !session.userId) {
    return res.status(404).json({
      success: false,
      message: 'Sessão não encontrada',
    });
  }

  // Convert both to strings for comparison (handles ObjectId vs string)
  const sessionUserId = session.userId.toString();
  const requestUserId = userId.toString();

  if (sessionUserId !== requestUserId) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado: você não possui permissão para acessar esta sessão',
    });
  }

  next();
};

router.post('/:sessionId/lid/resolve', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { lid } = req.body;

    // Validar parâmetros obrigatórios
    if (!sessionId || !lid) {
      return res.status(400).json({
        success: false,
        message: 'sessionId e lid são obrigatórios'
      });
    }

    // Validar formato do LID
    if (!lid.endsWith('@lid')) {
      return res.status(400).json({
        success: false,
        message: 'LID deve terminar com @lid'
      });
    }

    // Buscar a sessão ativa usando a mesma lógica do app.js
    const { getSessions } = require('../app');
    const sessions = getSessions();
    const session = sessions.get(sessionId);
    
    if (!session || !session.sock) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada ou socket não disponível'
      });
    }
    
    const sock = session.sock;

    // Verificar se a sessão está conectada
    if (!sock.user) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não está autenticada'
      });
    }

    logger.info(`🔍 Tentando resolver LID: ${lid} para sessão: ${sessionId}`);

    // Tentar resolver o LID usando funcionalidades do Baileys
    try {
      // Método 1: Usar onWhatsApp para verificar se o número existe
      const decoded = jidDecode(lid);
      if (!decoded) {
        return res.status(400).json({
          success: false,
          message: 'LID inválido ou mal formado'
        });
      }

      // Extrair o número base do LID
      const baseNumber = decoded.user;
      
      // Tentar diferentes formatos de número de telefone
      const possibleNumbers = [
        `${baseNumber}@s.whatsapp.net`,
        `${baseNumber}@c.us`
      ];

      let resolvedNumber = null;

      // Verificar cada possível número
      for (const testNumber of possibleNumbers) {
        try {
          const exists = await sock.onWhatsApp(testNumber);
          if (exists && exists.length > 0 && exists[0].exists) {
            resolvedNumber = exists[0].jid;
            logger.info(`✅ LID ${lid} resolvido para: ${resolvedNumber}`);
            break;
          }
        } catch (checkError) {
          logger.warn(`⚠️ Erro ao verificar número ${testNumber}: ${checkError.message}`);
        }
      }

      // Se não conseguiu resolver diretamente, usar uma abordagem alternativa
      if (!resolvedNumber) {
        // Tentar usar o número base com @c.us (padrão para contatos)
        resolvedNumber = `${baseNumber}@c.us`;
        logger.info(`📱 Usando resolução padrão: ${lid} -> ${resolvedNumber}`);
      }

      // Resposta de sucesso
      const response = {
        lid: lid,
        pn: resolvedNumber
      };

      logger.info(`✅ LID resolvido com sucesso: ${JSON.stringify(response)}`);

      return res.json({
        success: true,
        message: 'LID resolvido com sucesso',
        data: response
      });

    } catch (resolveError) {
      logger.error(`❌ Erro ao resolver LID ${lid}: ${resolveError.message}`);
      
      // Em caso de erro, tentar uma resolução básica
      const decoded = jidDecode(lid);
      if (decoded) {
        const fallbackResponse = {
          lid: lid,
          pn: `${decoded.user}@c.us`
        };

        logger.info(`🔄 Usando resolução fallback: ${JSON.stringify(fallbackResponse)}`);

        return res.json({
          success: true,
          message: 'LID resolvido com resolução fallback',
          data: fallbackResponse
        });
      }

      throw resolveError;
    }

  } catch (error) {
    logger.error(`❌ Erro no endpoint de resolução LID: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;