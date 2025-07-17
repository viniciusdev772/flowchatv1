const express = require('express');
const { jidDecode, areJidsSameUser } = require('@whiskeysockets/baileys');
const logger = require('pino')({ level: 'info' });

// Tentar importar USync com diferentes caminhos possíveis
let USyncQuery, USyncUser;
try {
  // Método 1: Importação direta
  const WAUSync = require('@whiskeysockets/baileys/lib/WAUSync');
  USyncQuery = WAUSync.USyncQuery;
  USyncUser = WAUSync.USyncUser;
} catch (e1) {
  try {
    // Método 2: Importação por partes
    USyncQuery = require('@whiskeysockets/baileys/lib/WAUSync/USyncQuery');
    USyncUser = require('@whiskeysockets/baileys/lib/WAUSync/USyncUser');
  } catch (e2) {
    logger.warn('USync classes não disponíveis, usando apenas onWhatsApp');
  }
}

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

    logger.info(`🔍 Resolvendo LID: ${lid} para sessão: ${sessionId}`);
    logger.info(`📱 Sessão user: ${JSON.stringify(sock.user)}`);

    // ESTRATÉGIA PRINCIPAL: Verificar se é o próprio LID da sessão
    if (sock.user.lid === lid) {
      logger.info(`✅ LID é da própria sessão conectada`);
      return res.status(200).json({
        success: true,
        message: 'LID resolvido - é da própria sessão',
        data: {
          lid: lid,
          pn: sock.user.id,
          verified: true,
          method: 'own_session_lid',
          sessionUser: sock.user
        }
      });
    }

    // Decodificar o LID para extrair o número base
    const decoded = jidDecode(lid);
    if (!decoded || decoded.server !== 'lid') {
      return res.status(400).json({
        success: false,
        message: 'LID inválido - deve terminar com @lid'
      });
    }

    const baseNumber = decoded.user;
    logger.info(`📋 Número base extraído do LID: ${baseNumber}`);

    let resolvedData = null;
    let allAttempts = [];

    // ESTRATÉGIA 1: onWhatsApp com o LID direto
    try {
      logger.info(`🎯 Tentativa 1: onWhatsApp com LID direto`);
      const result = await sock.onWhatsApp(lid);
      
      allAttempts.push({
        method: 'onWhatsApp_lid_direct',
        input: lid,
        result: result,
        success: false
      });

      if (result && Array.isArray(result) && result.length > 0) {
        for (const item of result) {
          if (item.exists && item.jid) {
            resolvedData = {
              lid: lid,
              pn: item.jid,
              verified: item.exists,
              method: 'onWhatsApp_lid_direct',
              rawResult: item
            };
            allAttempts[allAttempts.length - 1].success = true;
            logger.info(`✅ SUCESSO via onWhatsApp LID: ${item.jid}`);
            break;
          }
        }
      }
    } catch (error) {
      logger.error(`❌ Erro onWhatsApp LID: ${error.message}`);
      allAttempts.push({
        method: 'onWhatsApp_lid_direct',
        error: error.message
      });
    }

    // ESTRATÉGIA 2: Buscar no contact store por LID
    if (!resolvedData && sock.store && sock.store.contacts) {
      try {
        logger.info(`🎯 Tentativa 2: Contact Store por LID`);
        const contacts = sock.store.contacts;
        
        for (const [jid, contact] of Object.entries(contacts)) {
          if (contact.lid === lid) {
            resolvedData = {
              lid: lid,
              pn: jid,
              verified: true,
              method: 'contact_store_lid',
              contact: contact
            };
            
            allAttempts.push({
              method: 'contact_store_lid',
              jid: jid,
              contact: contact,
              success: true
            });
            
            logger.info(`✅ SUCESSO via Contact Store LID: ${jid}`);
            break;
          }
        }
        
        if (!resolvedData) {
          allAttempts.push({
            method: 'contact_store_lid',
            totalContacts: Object.keys(contacts).length,
            success: false
          });
        }
      } catch (error) {
        logger.error(`❌ Erro Contact Store: ${error.message}`);
        allAttempts.push({
          method: 'contact_store_lid',
          error: error.message
        });
      }
    }

    // ESTRATÉGIA 3: onWhatsApp com variações do número (modo WAHA-style)
    if (!resolvedData) {
      // Implementar múltiplas variações como WAHA faz
      const phoneVariations = [
        baseNumber,
        `+${baseNumber}`,
        `${baseNumber}@c.us`,
        `${baseNumber}@s.whatsapp.net`
      ];

      // Também testar com códigos de país comuns se o número for muito curto
      if (baseNumber.length < 13) {
        phoneVariations.push(
          `55${baseNumber}`, // Brasil
          `+55${baseNumber}`,
          `55${baseNumber}@c.us`,
          `55${baseNumber}@s.whatsapp.net`,
          `1${baseNumber}`, // EUA/Canadá
          `+1${baseNumber}`,
          `1${baseNumber}@c.us`,
          `1${baseNumber}@s.whatsapp.net`
        );
      }

      for (const variation of phoneVariations) {
        if (resolvedData) break;
        
        try {
          logger.info(`🎯 Tentativa 3: onWhatsApp com ${variation}`);
          const result = await sock.onWhatsApp(variation);
          
          allAttempts.push({
            method: 'onWhatsApp_phone_variation',
            input: variation,
            result: result,
            success: false
          });

          if (result && Array.isArray(result) && result.length > 0) {
            for (const item of result) {
              // Aceitar qualquer match válido, não apenas LID exato
              if (item.exists && item.jid) {
                // Se tem LID e combina, é match perfeito
                if (item.lid === lid) {
                  resolvedData = {
                    lid: lid,
                    pn: item.jid,
                    verified: item.exists,
                    method: 'onWhatsApp_phone_variation_perfect',
                    phoneVariation: variation,
                    rawResult: item
                  };
                  allAttempts[allAttempts.length - 1].success = true;
                  logger.info(`✅ SUCESSO PERFEITO via variação ${variation}: ${item.jid} com LID ${item.lid}`);
                  break;
                }
                // Se não tem LID mas número base combina, é match parcial
                else if (!resolvedData && variation.includes(baseNumber)) {
                  resolvedData = {
                    lid: lid,
                    pn: item.jid,
                    verified: item.exists,
                    method: 'onWhatsApp_phone_variation_partial',
                    phoneVariation: variation,
                    confidence: 'medium',
                    note: 'Número encontrado mas LID não confirmado',
                    rawResult: item
                  };
                  allAttempts[allAttempts.length - 1].success = true;
                  logger.info(`🟡 SUCESSO PARCIAL via variação ${variation}: ${item.jid}`);
                }
              }
            }
          }
        } catch (error) {
          logger.error(`❌ Erro variação ${variation}: ${error.message}`);
          allAttempts.push({
            method: 'onWhatsApp_phone_variation',
            input: variation,
            error: error.message
          });
        }
      }
    }

    // ESTRATÉGIA 4: Buscar no contact store por número base
    if (!resolvedData && sock.store && sock.store.contacts) {
      try {
        logger.info(`🎯 Tentativa 4: Contact Store por número base`);
        const contacts = sock.store.contacts;
        
        for (const [jid, contact] of Object.entries(contacts)) {
          if (jid.includes(baseNumber) && contact.lid === lid) {
            resolvedData = {
              lid: lid,
              pn: jid,
              verified: true,
              method: 'contact_store_phone',
              contact: contact
            };
            
            allAttempts.push({
              method: 'contact_store_phone',
              jid: jid,
              contact: contact,
              success: true
            });
            
            logger.info(`✅ SUCESSO via Contact Store Phone: ${jid}`);
            break;
          }
        }
        
        if (!resolvedData) {
          allAttempts.push({
            method: 'contact_store_phone',
            baseNumber: baseNumber,
            success: false
          });
        }
      } catch (error) {
        logger.error(`❌ Erro Contact Store Phone: ${error.message}`);
        allAttempts.push({
          method: 'contact_store_phone',
          error: error.message
        });
      }
    }

    // ESTRATÉGIA 5: Buscar em grupos (como WAHA faz - "refresh groups to populate LID mappings")
    if (!resolvedData && sock.store && sock.store.groupMetadata) {
      try {
        logger.info(`🎯 Tentativa 5: Group Store LID mapping`);
        const groups = sock.store.groupMetadata;
        let foundInGroups = false;
        
        for (const [groupId, group] of Object.entries(groups)) {
          if (resolvedData) break;
          
          if (group.participants) {
            for (const participant of group.participants) {
              // Procurar por LID match nos participantes
              if (participant.lid === lid) {
                resolvedData = {
                  lid: lid,
                  pn: participant.id,
                  verified: true,
                  method: 'group_participant_lid',
                  groupId: groupId,
                  groupSubject: group.subject,
                  participant: participant
                };
                foundInGroups = true;
                logger.info(`✅ SUCESSO via Group LID: ${participant.id} no grupo ${group.subject}`);
                break;
              }
              // Procurar por match de número base
              else if (participant.id && participant.id.includes(baseNumber)) {
                if (!resolvedData) { // Só usar se não tiver algo melhor
                  resolvedData = {
                    lid: lid,
                    pn: participant.id,
                    verified: true,
                    method: 'group_participant_phone',
                    confidence: 'medium',
                    note: 'Encontrado por número base em grupo, LID não confirmado',
                    groupId: groupId,
                    groupSubject: group.subject,
                    participant: participant
                  };
                  foundInGroups = true;
                  logger.info(`🟡 SUCESSO PARCIAL via Group Phone: ${participant.id} no grupo ${group.subject}`);
                }
              }
            }
          }
        }
        
        allAttempts.push({
          method: 'group_store_search',
          totalGroups: Object.keys(groups).length,
          foundInGroups: foundInGroups,
          success: !!resolvedData
        });
        
      } catch (error) {
        logger.error(`❌ Erro Group Store: ${error.message}`);
        allAttempts.push({
          method: 'group_store_search',
          error: error.message
        });
      }
    }

    // Preparar resposta
    const response = {
      success: !!resolvedData,
      message: resolvedData 
        ? `LID resolvido via ${resolvedData.method}` 
        : 'LID não pôde ser resolvido',
      data: resolvedData,
      sessionInfo: {
        sessionId: sessionId,
        sessionUser: sock.user,
        isOwnLid: sock.user.lid === lid
      },
      attempts: allAttempts,
      timestamp: new Date().toISOString()
    };

    const statusCode = resolvedData ? 200 : 404;
    logger.info(`📋 LID Resolution ${resolvedData ? 'SUCESSO' : 'FALHOU'}: ${JSON.stringify(response.data || 'Nenhum resultado')}`);

    return res.status(statusCode).json(response);

  } catch (error) {
    logger.error(`❌ Erro no endpoint de resolução LID: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;