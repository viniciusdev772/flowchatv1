const express = require('express');
const { jidDecode, areJidsSameUser } = require('@whiskeysockets/baileys');
const { USyncQuery, USyncUser } = require('@whiskeysockets/baileys/lib/WAUSync');
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

    // Tentar resolver o LID usando protocolo USync avançado do Baileys
    try {
      logger.info(`🔍 Iniciando resolução avançada de LID: ${lid}`);
      
      let resolvedData = null;
      let allResolutionData = [];

      // Método 1: USync direto com LID usando protocolo nativo
      try {
        logger.info(`🔧 Tentativa 1: USync query direto com LID ${lid}`);
        
        // Extrair número base para USync query
        const decoded = jidDecode(lid);
        if (!decoded) {
          return res.status(400).json({
            success: false,
            message: 'LID inválido ou mal formado'
          });
        }

        const baseNumber = decoded.user;
        const phone = `+${baseNumber.replace('+', '')}`;
        
        // Criar USync query com protocolos Contact e LID
        const usyncQuery = new USyncQuery()
          .withContactProtocol()
          .withLIDProtocol()
          .withUser(new USyncUser().withPhone(phone));

        // Executar query USync
        const usyncResults = await sock.executeUSyncQuery(usyncQuery);
        allResolutionData.push({ 
          method: 'usync_protocol', 
          query: { phone, lid }, 
          result: usyncResults 
        });

        if (usyncResults && usyncResults.list && usyncResults.list.length > 0) {
          for (const result of usyncResults.list) {
            if (result.contact && result.id && result.id !== lid) {
              resolvedData = {
                lid: lid,
                pn: result.id,
                verified: true,
                method: 'usync_protocol',
                lidFromResult: result.lid || null,
                contactExists: result.contact
              };
              logger.info(`✅ LID ${lid} resolvido via USync para: ${result.id}`);
              break;
            }
          }
        }
      } catch (usyncError) {
        logger.warn(`⚠️ Erro no USync query: ${usyncError.message}`);
        allResolutionData.push({ 
          method: 'usync_protocol', 
          error: usyncError.message 
        });
      }

      // Método 2: onWhatsApp com LID diretamente 
      if (!resolvedData) {
        try {
          logger.info(`🔧 Tentativa 2: onWhatsApp direto com LID ${lid}`);
          
          const lidResult = await sock.onWhatsApp(lid);
          allResolutionData.push({ 
            method: 'onwhatsapp_lid_direct', 
            query: lid, 
            result: lidResult 
          });
          
          if (lidResult && lidResult.length > 0) {
            for (const item of lidResult) {
              if (item.exists && item.jid && item.jid !== lid) {
                resolvedData = {
                  lid: lid,
                  pn: item.jid,
                  verified: true,
                  method: 'onwhatsapp_lid_direct',
                  lidFromResult: item.lid || null
                };
                logger.info(`✅ LID ${lid} resolvido via onWhatsApp direto para: ${item.jid}`);
                break;
              }
            }
          }
        } catch (lidError) {
          logger.warn(`⚠️ Erro no onWhatsApp LID direto: ${lidError.message}`);
          allResolutionData.push({ 
            method: 'onwhatsapp_lid_direct', 
            error: lidError.message 
          });
        }
      }

      // Método 3: onWhatsApp com números baseados no LID
      if (!resolvedData) {
        const decoded = jidDecode(lid);
        const baseNumber = decoded.user;
        logger.info(`🔧 Tentativa 3: onWhatsApp com número base ${baseNumber}`);
        
        // Tentar diferentes formatos de número de telefone
        const possibleNumbers = [
          `+${baseNumber}`,
          `${baseNumber}@s.whatsapp.net`,
          `${baseNumber}@c.us`
        ];

        for (const testNumber of possibleNumbers) {
          try {
            const exists = await sock.onWhatsApp(testNumber);
            allResolutionData.push({ 
              method: 'onwhatsapp_base_number', 
              query: testNumber, 
              result: exists 
            });
            
            if (exists && exists.length > 0) {
              for (const item of exists) {
                if (item.exists && item.jid) {
                  resolvedData = {
                    lid: lid,
                    pn: item.jid,
                    verified: true,
                    method: 'onwhatsapp_base_number',
                    baseNumber: baseNumber,
                    testNumber: testNumber,
                    lidFromResult: item.lid || null
                  };
                  logger.info(`✅ LID ${lid} resolvido via número base ${testNumber} para: ${item.jid}`);
                  break;
                }
              }
            }
            
            if (resolvedData) break;
          } catch (checkError) {
            logger.warn(`⚠️ Erro ao verificar número ${testNumber}: ${checkError.message}`);
            allResolutionData.push({ 
              method: 'onwhatsapp_base_number', 
              query: testNumber, 
              error: checkError.message 
            });
          }
        }
      }

      // Se não conseguiu resolver, retornar erro
      if (!resolvedData) {
        logger.warn(`❌ Não foi possível resolver o LID ${lid}`);
        
        return res.status(404).json({
          success: false,
          message: 'LID não pôde ser resolvido para um número válido',
          data: {
            lid: lid,
            resolutionAttempts: allResolutionData,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Resposta completa com todos os dados
      const response = {
        lid: resolvedData.lid,
        pn: resolvedData.pn,
        verified: resolvedData.verified,
        method: resolvedData.method,
        lidFromResult: resolvedData.lidFromResult,
        contactExists: resolvedData.contactExists,
        baseNumber: resolvedData.baseNumber,
        testNumber: resolvedData.testNumber,
        resolutionAttempts: allResolutionData,
        timestamp: new Date().toISOString()
      };

      logger.info(`✅ LID resolvido: ${JSON.stringify(response, null, 2)}`);

      return res.json({
        success: true,
        message: resolvedData.verified ? 'LID resolvido e verificado com sucesso' : 'LID resolvido com fallback',
        data: response
      });

    } catch (resolveError) {
      logger.error(`❌ Erro ao resolver LID ${lid}: ${resolveError.message}`);
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