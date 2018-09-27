const config = require('config');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cache = require('lru-cache');

const maxAge = parseInt(config.get('cookie.maxage'), 10);

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

/** stores the state of the game by log file name.
 * infinite size, pruned regularly */
const gameStates = cache({ maxAge });
setInterval(() => { gameStates.prune(); }, 2 * maxAge);

/** Extract session ID from the cookie string */
function extractSid(cookie) {
  if (undefined === cookie) {
    return null;
  }
  const indexEq = cookie.indexOf('=');
  const indexDot = cookie.indexOf('.', indexEq);
  return cookie.substring(indexEq + 5, indexDot);
}

/** return session from store, if necessary after
restoring from cookie */
function syncSession(reqSid, sStore) {
  const storedSid = sStore.get(reqSid);
  if (undefined !== storedSid) {
    return storedSid;
  }
  // client with old sessionid reconnecting
  // after server restart
  // creating session store entry from sid
  logger.info('restoring session from cookie');
  sStore.set(reqSid, JSON.stringify({
    cookie: {
      originalMaxAge: maxAge,
      expires: new Date(Date.now() + maxAge).toISOString(),
      secure: true,
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
    },
    pairedWith: 'noone',
  }), maxAge);
  return sStore.get(reqSid);
}

/** find the spark for the partner session ID */
function findPartnerSpark(sprk, partnerSid) {
  let partnerSpark = null;
  sprk.primus.forEach((spk, spkId) => {
    if (partnerSpark == null) {
      if (spkId !== sprk.id) {
        const otherSid = extractSid(spk.headers.cookie);
        if (partnerSid === otherSid) {
          partnerSpark = spk;
        }
      }
    }
  });
  return partnerSpark;
}

// create log file name from the hash of two strings and a random number
function getLogname(id1, id2) {
  const clearIdentifier = id1 + Math.random() + id2;
  const hashedIdentifier = crypto.createHash('sha256').update(clearIdentifier).digest('base64');
  const identifier = hashedIdentifier.replace(/\W/g, '');
  return `${identifier}.log`;
}

/** reset pairedWith and partnerSpkId for session ID  in store */
function resetSessionToUnpaired(jSession, sessionId, sStore) {
  logger.info(`resetting session ${jSession.log}`);
  const jSessionCopy = Object.assign({}, jSession);
  jSessionCopy.pairedWith = 'noone';
  sStore.set(sessionId, `${JSON.stringify(jSessionCopy)}\n`, maxAge);
}

/** get the partner from the game state 
 */
function getPartner(sessionId, gameState) {
  return gameState[gameState[sessionId].partnerSid];
}

/** TODO */
function createInitialState() {
  return {
    A: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    B: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19],
  };
}

/** finds another user without partner or former partner and
 * initialises the game state */
function findPartnerCheckConnection(spk, reqSid, jRequester, sStore) {
  let gameState = null;
  const gameStateId = jRequester.pairedWith;
  // iterate sessions
  sStore.rforEach((session, sessId) => {
    if (gameState == null) {
      const jPartner = JSON.parse(session);
      if (sessId !== reqSid && jPartner.pairedWith === gameStateId) {
        // found unpaired or old session, check if connected
        const foundPartnerSpark = findPartnerSpark(spk, sessId);
        if (foundPartnerSpark != null) {
          // partner connection exists
          const jRequesterCopy = Object.assign({}, jRequester);
          const existingState = gameStates.get(gameStateId);
          if (existingState != null) {
            // verify existing game state
            if (existingState[sessId] === undefined || existingState[reqSid] === undefined) {
              // session IDs in game state do not match session data of partners
              logger.warn(`resetting pair ${jRequester.pairedWith} ${jPartner.pairedWith}`);
              resetSessionToUnpaired(jRequester, reqSid, sStore);
              resetSessionToUnpaired(jPartner, sessId, sStore);
              gameStates.del(gameStateId);
            } else {
              // re-establish partners, update sparks
              logger.info(`re-establish pair ${existingState.id}`);

              existingState[reqSid].spark = spk;
              existingState[reqSid].sparkId = spk.id;
              existingState[sessId].spark = foundPartnerSpark;
              existingState[sessId].sparkId = foundPartnerSpark.id;

              gameState = existingState;
              gameStates.set(gameStateId, gameState);
            }
          } else {
            // new pair or expired game state
            const logName = getLogname(reqSid, sessId);
            logger.info(`new pair ${logName}`);

            jPartner.pairedWith = logName;
            jRequesterCopy.pairedWith = logName;

            // save new pair and set return value
            gameState = {
              id: logName,
              [reqSid]: {
                role: 'A',
                partnerSid: sessId,
                spark: spk,
                sparkId: spk.id,
              },
              [sessId]: {
                role: 'B',
                partnerSid: reqSid,
                spark: foundPartnerSpark,
                sparkId: foundPartnerSpark.id,
              },
              turn: reqSid,
              turnCount: 0,
              state: createInitialState(),
              undosLeft: 2,
            };
            gameStates.set(logName, gameState);
          }

          sStore.set(sessId, JSON.stringify(jPartner), maxAge);
          sStore.set(reqSid, JSON.stringify(jRequesterCopy), maxAge);
        }
      }
    }
  });
  return gameState;
}

/** find the spark of the partner
after a connection has been established
@returns null if not paired in session store
or partner not in primus connections */
function getStateCheckPartner(sprk, sStore) {
  const ownSid = extractSid(sprk.headers.cookie);
  const jSession = JSON.parse(syncSession(ownSid, sStore));

  const gameStateId = jSession.pairedWith;
  if (gameStateId === 'noone') {
    logger.info('partner disconnected');
    return null;
  }

  const state = gameStates.get(gameStateId);
  const partner = getPartner(ownSid, state);
  let found = false;
  sprk.primus.forEach((spk, id) => {
    if (!found) {
      if (id === partner.sparkId) {
        found = true;
      }
    }
  });
  if (found) {
    const oneself = state[ownSid];
    const ownturn = state.turn === ownSid;
    return {
      state, partner, oneself, ownturn,
    };
  }
  return null;
}

// ends requesters turn in session store
// assumes that the partner connection has been checked
function endTurn(reqSid, sStore) {
  const jreqSession = JSON.parse(syncSession(reqSid, sStore));
  const jpartSession = JSON.parse(syncSession(jreqSession.pairedWith, sStore));
  const jreqSessionCopy = Object.assign({}, jreqSession);
  const jpartSessionCopy = Object.assign({}, jpartSession);
  jreqSessionCopy.turn = false;
  jpartSessionCopy.turn = true;
  sStore.set(reqSid, JSON.stringify(jreqSessionCopy), maxAge);
  sStore.set(jreqSession.pairedWith, JSON.stringify(jpartSessionCopy), maxAge);
}

function writeMsg(sprk, msg, info) {
  sprk.write({ msg, info });
}

function writeLog(logName, jContent) {
  const logPath = `logs${path.sep}${logName}`;
  fs.open(logPath, 'a', (_err, fd) => {
    fs.appendFile(fd, JSON.stringify(jContent) + os.EOL, (_err) => {
      fs.close(fd, (_err) => { });
    });
  });
}

function broadcast(sprk, partnerSprk, data, role) {
  const dataCopy = Object.assign({}, data);
  dataCopy.role = role;
  sprk.write(dataCopy);
  partnerSprk.write(dataCopy);
  return dataCopy;
}

function broadcastWithLog(sprk, partnerSprk, data, role, logName) {
  const dataCopy = broadcast(sprk, partnerSprk, data, role);
  writeLog(logName, dataCopy);
}

function broadcastTurn(sprk, partnerSprk, requesterTurn, requesterRole, logName) {
  sprk.write({ turnover: requesterTurn });
  partnerSprk.write({ turnover: !requesterTurn });
  writeLog(logName, { nextTurn: { role: requesterRole, active: requesterTurn } });
}

// ======================================================

const tg = function connection(spark) {
  // we have the sessionStore as 'this.store'
  const sessionStore = this.store;
  // we use the browser session to identify a user
  // expiration of session can be configured in the properties
  // a user session can span multiple sparks (websocket connections)
  const requesterSid = extractSid(spark.headers.cookie);
  if (requesterSid == null) {
    logger.info('connection without cookie');
    writeMsg(spark, 'cookie expired or cookies disabled', '');
    return;
  }
  const jRequesterSession = JSON.parse(syncSession(requesterSid, sessionStore));

  writeMsg(spark, 'welcome', `${requesterSid}//${spark.id}`);
  logger.info('new connection');

  if (jRequesterSession.pairedWith === 'noone') {
    // new connection or server restart
    // going to find new partner
    writeMsg(spark, 'finding...', requesterSid + spark.id);
  } else {
    // unexpired session connecting again
    // going to check if former partner is still there
    writeMsg(spark, 'retrieving...', '');
  }

  const gameState = findPartnerCheckConnection(spark, requesterSid,
    jRequesterSession, sessionStore);

  if (gameState != null) {
    // it's a match
    const partner = getPartner(requesterSid, gameState);
    const oneself = gameState[requesterSid];
    writeMsg(oneself.spark, 'FOUND', `${oneself.role}// game ${gameState.id}//${partner.sparkId}`);
    writeMsg(partner.spark, 'FOUND', `${partner.role}// game ${gameState.id}//${oneself.sparkId}`);

    broadcastTurn(oneself.spark, partner.spark, gameState.turn === requesterSid,
      oneself.role, gameState.id);
  } else {
    // reset in case of a retrieved session where partner is not connected
    // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    // no partner found yet
    writeMsg(spark, 'waitforpartner:wait TODOnew', '');
  }


  spark.on('data', (packet) => {
    if (!packet) return;

    const {
      state, partner, oneself, ownturn,
    } = getStateCheckPartner(spark, sessionStore);
    if (state != null) {
      const data = JSON.parse(packet);

      if (data.txt !== undefined) {
        broadcastWithLog(spark, partner.spark, data, oneself.role, state.id);
      } else if (data.act !== undefined) {
        if (data.act === 'drag') {
          if (!ownturn) {
            logger.warn('inactive user dragging');
          }
          broadcastWithLog(spark, partner.spark, data, oneself.role, state.id);
        } else if (data.act === 'drgmv') {
          broadcast(spark, partner.spark, data, oneself.role);
        }
      } else if (data.turnover !== undefined) {
        if (!ownturn) {
          logger.warn('inactive user handing turn over');
        }
        endTurn(oneself.sid, sessionStore);
        broadcastTurn(spark, partner.spark, false, oneself.role, state.id);
      } else if (data.msg !== undefined) {
        // TODO
      }
    } else {
      // lost connection
      writeMsg(spark, 'partnernotfound:wait TODOnew', '');
      // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    }
  });

  spark.on('open', (_packet) => {

  });
  spark.on('reconnect', () => {

  });
  spark.on('online', () => {

  });
  spark.on('offline', () => {

  });
  spark.on('error', (_err) => {

  });
  spark.on('end', () => {
    // tab closed
    const result = getStateCheckPartner(spark, sessionStore);
    if (result != null) {
      writeMsg(result.partnerSpark, 'partnerdisconnected:wait TODOnew', spark.id);
      // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    }
  });
  spark.on('close', () => {

  });
};

module.exports = tg;
