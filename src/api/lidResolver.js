const express = require('express');
const { jidDecode, areJidsSameUser } = require('@whiskeysockets/baileys');
const logger = require('pino')({ level: 'info' });

/**
 * @fileoverview This file defines the routes for resolving LIDs (Lightweight Instagram Direct) to phone numbers.
 * @module api/lidResolver
 */

let USyncQuery, USyncUser;
try {

  const WAUSync = require('@whiskeysockets/baileys/lib/WAUSync');
  USyncQuery = WAUSync.USyncQuery;
  USyncUser = WAUSync.USyncUser;
} catch (e1) {
  try {

    USyncQuery = require('@whiskeysockets/baileys/lib/WAUSync/USyncQuery');
    USyncUser = require('@whiskeysockets/baileys/lib/WAUSync/USyncUser');
  } catch (e2) {
    logger.warn('USync classes não disponíveis, usando apenas onWhatsApp');
  }
}

const router = express.Router();

/**
 * Middleware to check if the user owns the WhatsApp session.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
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



  const { getSessions } = require('../app');
  const sessions = getSessions();
  const session = sessions.get(sessionId);

  if (!session || !session.userId) {
    return res.status(404).json({
      success: false,
      message: 'Sessão não encontrada',
    });
  }


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

/**
 * @swagger
 * /lid-resolver/{sessionId}/lid/resolve:
 *   post:
 *     summary: Resolve a LID to a phone number
 *     description: Attempts to resolve a LID to a phone number using various methods.
 *     tags: [LID Resolver]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lid:
 *                 type: string
 *                 description: The LID to resolve.
 *     responses:
 *       '200':
 *         description: The LID was resolved successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or LID not found.
 *       '500':
 *         description: Internal server error.
 */
router.post('/:sessionId/lid/resolve', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { lid } = req.body;


    if (!sessionId || !lid) {
      return res.status(400).json({
        success: false,
        message: 'sessionId e lid são obrigatórios'
      });
    }


    if (!lid.endsWith('@lid')) {
      return res.status(400).json({
        success: false,
        message: 'LID deve terminar com @lid'
      });
    }


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


    if (!sock.user) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não está autenticada'
      });
    }

    logger.info(`🔍 Resolvendo LID: ${lid} para sessão: ${sessionId}`);
    logger.info(`📱 Sessão user: ${JSON.stringify(sock.user)}`);


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


    if (!resolvedData) {

      const phoneVariations = [
        baseNumber,
        `+${baseNumber}`,
        `${baseNumber}@c.us`,
        `${baseNumber}@s.whatsapp.net`
      ];


      if (baseNumber.length < 13) {
        phoneVariations.push(
          `55${baseNumber}`,
          `+55${baseNumber}`,
          `55${baseNumber}@c.us`,
          `55${baseNumber}@s.whatsapp.net`,
          `1${baseNumber}`,
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

              if (item.exists && item.jid) {

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


    if (!resolvedData && sock.store && sock.store.groupMetadata) {
      try {
        logger.info(`🎯 Tentativa 5: Group Store LID mapping`);
        const groups = sock.store.groupMetadata;
        let foundInGroups = false;

        for (const [groupId, group] of Object.entries(groups)) {
          if (resolvedData) break;

          if (group.participants) {
            for (const participant of group.participants) {

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

              else if (participant.id && participant.id.includes(baseNumber)) {
                if (!resolvedData) {
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