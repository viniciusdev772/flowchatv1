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

    // Método de debug: primeiro verificar todas as possibilidades e capturar tudo
    try {
      logger.info(`🔍 Iniciando debug completo de LID: ${lid}`);
      
      let resolvedData = null;
      let allResolutionData = [];
      let debugInfo = {
        lidDecoded: null,
        sockMethods: [],
        contactsAnalysis: null,
        rawResults: []
      };

      // Debug 1: Analisar estrutura do LID
      const decoded = jidDecode(lid);
      debugInfo.lidDecoded = decoded;
      
      if (!decoded) {
        return res.status(400).json({
          success: false,
          message: 'LID inválido ou mal formado',
          debug: debugInfo
        });
      }

      const baseNumber = decoded.user;
      logger.info(`📋 LID decodificado: ${JSON.stringify(decoded)}`);

      // Debug 2: Verificar métodos disponíveis no socket
      debugInfo.sockMethods = Object.getOwnPropertyNames(sock).filter(name => 
        typeof sock[name] === 'function' && 
        (name.includes('contact') || name.includes('whatsapp') || name.includes('sync') || name.includes('user'))
      );
      logger.info(`🔧 Métodos disponíveis no socket: ${debugInfo.sockMethods.join(', ')}`);

      // Método 1: onWhatsApp com LID direto - capturar tudo
      try {
        logger.info(`🔧 Método 1: onWhatsApp("${lid}")`);
        
        const lidResult = await sock.onWhatsApp(lid);
        const rawData = {
          method: 'onWhatsApp_lid_direct',
          input: lid,
          output: lidResult,
          outputType: typeof lidResult,
          isArray: Array.isArray(lidResult),
          length: lidResult?.length
        };
        
        debugInfo.rawResults.push(rawData);
        allResolutionData.push(rawData);
        
        logger.info(`📊 Resultado bruto onWhatsApp(LID): ${JSON.stringify(lidResult, null, 2)}`);
        
        if (lidResult && Array.isArray(lidResult) && lidResult.length > 0) {
          for (const item of lidResult) {
            logger.info(`🔍 Analisando item: ${JSON.stringify(item)}`);
            
            // Aceitar qualquer JID válido, mesmo que seja igual ao LID
            if (item.exists && item.jid) {
              resolvedData = {
                lid: lid,
                pn: item.jid,
                verified: true,
                method: 'onWhatsApp_lid_direct',
                rawItem: item
              };
              logger.info(`✅ LID ${lid} resolvido para: ${item.jid}`);
              break;
            }
          }
        }
      } catch (lidError) {
        logger.error(`❌ Erro onWhatsApp(LID): ${lidError.message}`);
        allResolutionData.push({ 
          method: 'onWhatsApp_lid_direct', 
          error: lidError.message,
          stack: lidError.stack
        });
      }

      // Método 2: onWhatsApp com número base em diferentes formatos
      if (!resolvedData) {
        const testNumbers = [
          baseNumber,
          `+${baseNumber}`,
          `${baseNumber}@s.whatsapp.net`,
          `${baseNumber}@c.us`,
          `${baseNumber}@lid`
        ];

        for (const testNumber of testNumbers) {
          try {
            logger.info(`🔧 Método 2: onWhatsApp("${testNumber}")`);
            
            const result = await sock.onWhatsApp(testNumber);
            const rawData = {
              method: 'onWhatsApp_variations',
              input: testNumber,
              output: result,
              outputType: typeof result,
              isArray: Array.isArray(result),
              length: result?.length
            };
            
            debugInfo.rawResults.push(rawData);
            allResolutionData.push(rawData);
            
            logger.info(`📊 Resultado onWhatsApp(${testNumber}): ${JSON.stringify(result, null, 2)}`);
            
            if (result && Array.isArray(result) && result.length > 0) {
              for (const item of result) {
                if (item.exists && item.jid) {
                  resolvedData = {
                    lid: lid,
                    pn: item.jid,
                    verified: true,
                    method: 'onWhatsApp_variations',
                    testNumber: testNumber,
                    rawItem: item
                  };
                  logger.info(`✅ Número ${testNumber} resolvido para: ${item.jid}`);
                  break;
                }
              }
            }
            
            if (resolvedData) break;
          } catch (error) {
            logger.error(`❌ Erro onWhatsApp(${testNumber}): ${error.message}`);
            allResolutionData.push({ 
              method: 'onWhatsApp_variations',
              input: testNumber,
              error: error.message 
            });
          }
        }
      }

      // Método 3: Tentar buscar contatos se disponível
      try {
        if (sock.store && sock.store.contacts) {
          logger.info(`🔧 Método 3: Análise de contatos locais`);
          
          const contacts = sock.store.contacts;
          debugInfo.contactsAnalysis = {
            totalContacts: Object.keys(contacts).length,
            lidContacts: []
          };
          
          // Procurar por contatos com LID
          for (const [jid, contact] of Object.entries(contacts)) {
            if (contact.lid && (contact.lid === lid || jid.includes(baseNumber))) {
              debugInfo.contactsAnalysis.lidContacts.push({
                jid,
                contact: contact,
                hasLid: !!contact.lid,
                lidValue: contact.lid
              });
              
              if (!resolvedData && contact.lid === lid) {
                resolvedData = {
                  lid: lid,
                  pn: jid,
                  verified: true,
                  method: 'local_contacts',
                  contact: contact
                };
              }
            }
          }
          
          logger.info(`📊 Análise de contatos: ${JSON.stringify(debugInfo.contactsAnalysis, null, 2)}`);
        }
      } catch (contactError) {
        logger.error(`❌ Erro análise contatos: ${contactError.message}`);
        debugInfo.contactsAnalysis = { error: contactError.message };
      }

      // Sempre retornar dados completos, mesmo se não resolveu
      const response = {
        success: !!resolvedData,
        message: resolvedData 
          ? `LID resolvido via ${resolvedData.method}` 
          : 'LID não foi resolvido, mas dados de debug estão disponíveis',
        data: resolvedData ? {
          lid: resolvedData.lid,
          pn: resolvedData.pn,
          verified: resolvedData.verified,
          method: resolvedData.method,
          rawItem: resolvedData.rawItem,
          testNumber: resolvedData.testNumber,
          contact: resolvedData.contact
        } : null,
        debug: debugInfo,
        resolutionAttempts: allResolutionData,
        timestamp: new Date().toISOString()
      };

      logger.info(`📋 Resultado completo: ${JSON.stringify(response, null, 2)}`);

      return res.status(resolvedData ? 200 : 404).json(response);

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