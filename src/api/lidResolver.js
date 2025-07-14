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

    logger.info(`🔍 Tentando resolver LID: ${lid} para sessão: ${sessionId}`);

    // MÉTODO MÁXIMO: Implementar TODAS as estratégias de resolução LID disponíveis
    try {
      logger.info(`🚀 Iniciando resolução LID MÁXIMA: ${lid}`);
      
      let resolvedData = null;
      let allResolutionData = [];
      let debugInfo = {
        lidDecoded: null,
        sockMethods: [],
        sockProperties: [],
        usyncAvailable: !!USyncQuery,
        contactsAnalysis: null,
        businessProfile: null,
        rawResults: []
      };

      // ANÁLISE 1: Estrutura do LID
      const decoded = jidDecode(lid);
      debugInfo.lidDecoded = decoded;
      
      if (!decoded || decoded.server !== 'lid') {
        return res.status(400).json({
          success: false,
          message: 'LID inválido - deve terminar com @lid',
          debug: debugInfo
        });
      }

      const baseNumber = decoded.user;
      logger.info(`📋 LID analisado: ${JSON.stringify(decoded)}`);

      // ANÁLISE 2: Capacidades do Socket
      debugInfo.sockMethods = Object.getOwnPropertyNames(sock).filter(name => 
        typeof sock[name] === 'function'
      );
      debugInfo.sockProperties = Object.getOwnPropertyNames(sock).filter(name => 
        typeof sock[name] !== 'function'
      );
      
      logger.info(`🔧 Socket tem ${debugInfo.sockMethods.length} métodos e ${debugInfo.sockProperties.length} propriedades`);

      // ESTRATÉGIA 1: onWhatsApp LID Direto
      if (!resolvedData) {
        try {
          logger.info(`🎯 Estratégia 1: onWhatsApp LID direto`);
          
          const lidResult = await sock.onWhatsApp(lid);
          const analysis = {
            method: 'onWhatsApp_lid_direct',
            input: lid,
            output: lidResult,
            success: false,
            details: {
              outputType: typeof lidResult,
              isArray: Array.isArray(lidResult),
              length: lidResult?.length,
              hasResults: !!(lidResult && lidResult.length > 0)
            }
          };
          
          debugInfo.rawResults.push(analysis);
          allResolutionData.push(analysis);
          
          if (lidResult && Array.isArray(lidResult) && lidResult.length > 0) {
            for (const item of lidResult) {
              logger.info(`🔍 Item encontrado: ${JSON.stringify(item)}`);
              
              if (item.exists && item.jid) {
                resolvedData = {
                  lid: lid,
                  pn: item.jid,
                  verified: true,
                  method: 'onWhatsApp_lid_direct',
                  lidFromResult: item.lid,
                  rawItem: item
                };
                analysis.success = true;
                logger.info(`✅ SUCESSO via onWhatsApp LID: ${item.jid}`);
                break;
              }
            }
          }
        } catch (error) {
          logger.error(`❌ Falha Estratégia 1: ${error.message}`);
          allResolutionData.push({ 
            method: 'onWhatsApp_lid_direct', 
            error: error.message 
          });
        }
      }

      // ESTRATÉGIA 2: USync Avançado (se disponível)
      if (!resolvedData && USyncQuery && USyncUser && sock.executeUSyncQuery) {
        try {
          logger.info(`🎯 Estratégia 2: USync protocolo avançado`);
          
          const usyncQuery = new USyncQuery()
            .withLIDProtocol()
            .withContactProtocol()
            .withStatusProtocol();
          
          // Múltiplas tentativas USync
          const usyncAttempts = [
            // Tentativa 1: Com LID + telefone
            () => {
              const query = new USyncQuery()
                .withLIDProtocol()
                .withContactProtocol();
              query.withUser(
                new USyncUser()
                  .withLid(lid)
                  .withPhone(`+${baseNumber}`)
              );
              return query;
            },
            // Tentativa 2: Só com LID  
            () => {
              const query = new USyncQuery().withLIDProtocol();
              query.withUser(new USyncUser().withLid(lid));
              return query;
            },
            // Tentativa 3: Só com telefone
            () => {
              const query = new USyncQuery()
                .withContactProtocol()
                .withLIDProtocol();
              query.withUser(new USyncUser().withPhone(`+${baseNumber}`));
              return query;
            }
          ];
          
          for (let i = 0; i < usyncAttempts.length && !resolvedData; i++) {
            try {
              logger.info(`🔧 USync tentativa ${i + 1}/3`);
              
              const query = usyncAttempts[i]();
              const usyncResult = await sock.executeUSyncQuery(query);
              
              const analysis = {
                method: `usync_attempt_${i + 1}`,
                input: { lid, phone: `+${baseNumber}` },
                output: usyncResult,
                success: false
              };
              
              allResolutionData.push(analysis);
              
              if (usyncResult && usyncResult.list && usyncResult.list.length > 0) {
                for (const result of usyncResult.list) {
                  logger.info(`🔍 USync resultado: ${JSON.stringify(result)}`);
                  
                  if (result.contact && result.id) {
                    resolvedData = {
                      lid: lid,
                      pn: result.id,
                      verified: true,
                      method: `usync_attempt_${i + 1}`,
                      lidFromResult: result.lid,
                      contactExists: result.contact,
                      rawResult: result
                    };
                    analysis.success = true;
                    logger.info(`✅ SUCESSO via USync: ${result.id}`);
                    break;
                  }
                }
              }
            } catch (usyncError) {
              logger.warn(`⚠️ USync tentativa ${i + 1} falhou: ${usyncError.message}`);
              allResolutionData.push({
                method: `usync_attempt_${i + 1}`,
                error: usyncError.message
              });
            }
          }
        } catch (error) {
          logger.error(`❌ Falha Estratégia 2: ${error.message}`);
        }
      }

      // ESTRATÉGIA 3: Variações de Formato
      if (!resolvedData) {
        try {
          logger.info(`🎯 Estratégia 3: Variações de formato`);
          
          const phoneVariations = [
            // Formatos básicos
            baseNumber,
            `+${baseNumber}`,
            // Formatos WhatsApp
            `${baseNumber}@s.whatsapp.net`,
            `${baseNumber}@c.us`,
            // Variações especiais
            `${baseNumber}@lid`,
            // Com códigos de país comuns se não tiver
            baseNumber.length < 10 ? `55${baseNumber}` : null,
            baseNumber.length < 10 ? `+55${baseNumber}` : null,
          ].filter(Boolean);

          for (const variation of phoneVariations) {
            if (resolvedData) break;
            
            try {
              logger.info(`🔧 Testando: ${variation}`);
              
              const result = await sock.onWhatsApp(variation);
              const analysis = {
                method: 'phone_variations',
                input: variation,
                output: result,
                success: false
              };
              
              allResolutionData.push(analysis);
              
              if (result && Array.isArray(result) && result.length > 0) {
                for (const item of result) {
                  if (item.exists && item.jid) {
                    resolvedData = {
                      lid: lid,
                      pn: item.jid,
                      verified: true,
                      method: 'phone_variations',
                      testVariation: variation,
                      lidFromResult: item.lid,
                      rawItem: item
                    };
                    analysis.success = true;
                    logger.info(`✅ SUCESSO via variação ${variation}: ${item.jid}`);
                    break;
                  }
                }
              }
            } catch (error) {
              allResolutionData.push({
                method: 'phone_variations',
                input: variation,
                error: error.message
              });
            }
          }
        } catch (error) {
          logger.error(`❌ Falha Estratégia 3: ${error.message}`);
        }
      }

      // ESTRATÉGIA 4: Contact Store Local
      if (!resolvedData) {
        try {
          logger.info(`🎯 Estratégia 4: Contact Store local`);
          
          if (sock.store && sock.store.contacts) {
            const contacts = sock.store.contacts;
            debugInfo.contactsAnalysis = {
              totalContacts: Object.keys(contacts).length,
              lidMatches: [],
              phoneMatches: []
            };
            
            for (const [jid, contact] of Object.entries(contacts)) {
              // Match exato por LID
              if (contact.lid === lid) {
                debugInfo.contactsAnalysis.lidMatches.push({ jid, contact });
                if (!resolvedData) {
                  resolvedData = {
                    lid: lid,
                    pn: jid,
                    verified: true,
                    method: 'contact_store_lid',
                    contact: contact
                  };
                  logger.info(`✅ SUCESSO via Contact Store LID: ${jid}`);
                }
              }
              
              // Match por número base
              if (jid.includes(baseNumber) || contact.id?.includes(baseNumber)) {
                debugInfo.contactsAnalysis.phoneMatches.push({ jid, contact });
                if (!resolvedData && contact.lid) {
                  resolvedData = {
                    lid: lid,
                    pn: jid,
                    verified: true,
                    method: 'contact_store_phone',
                    contact: contact
                  };
                  logger.info(`✅ SUCESSO via Contact Store Phone: ${jid}`);
                }
              }
            }
            
            allResolutionData.push({
              method: 'contact_store_analysis',
              totalContacts: debugInfo.contactsAnalysis.totalContacts,
              lidMatches: debugInfo.contactsAnalysis.lidMatches.length,
              phoneMatches: debugInfo.contactsAnalysis.phoneMatches.length,
              success: !!resolvedData
            });
          } else {
            debugInfo.contactsAnalysis = { available: false, reason: 'No contact store' };
          }
        } catch (error) {
          logger.error(`❌ Falha Estratégia 4: ${error.message}`);
          debugInfo.contactsAnalysis = { error: error.message };
        }
      }

      // ESTRATÉGIA 5: Business Profile (se aplicável)
      if (!resolvedData && sock.getBusinessProfile) {
        try {
          logger.info(`🎯 Estratégia 5: Business Profile`);
          
          const businessResult = await sock.getBusinessProfile(lid);
          debugInfo.businessProfile = businessResult;
          
          if (businessResult && businessResult.wid) {
            resolvedData = {
              lid: lid,
              pn: businessResult.wid,
              verified: true,
              method: 'business_profile',
              businessData: businessResult
            };
            logger.info(`✅ SUCESSO via Business Profile: ${businessResult.wid}`);
          }
          
          allResolutionData.push({
            method: 'business_profile',
            input: lid,
            output: businessResult,
            success: !!resolvedData
          });
        } catch (error) {
          logger.error(`❌ Falha Estratégia 5: ${error.message}`);
          debugInfo.businessProfile = { error: error.message };
        }
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