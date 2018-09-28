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
  return `${identifier}`;
}

/** reset pairedWith and partnerSpkId for session ID  in store */
function resetSessionToUnpaired(sessionId, sStore) {
  const jSession = JSON.parse(syncSession(sessionId, sStore));
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
    common: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    uniqueA: new Set([12, 13, 14, 15]),
    uniqueB: new Set([16, 17, 18, 19]),
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
              resetSessionToUnpaired(reqSid, sStore);
              resetSessionToUnpaired(sessId, sStore);
              gameStates.del(gameStateId);
            } else {
              // re-establish partners, update sparks
              logger.info(`re-establish pair ${existingState.id}`);

              existingState[reqSid].spark = spk;
              existingState[reqSid].sparkId = spk.id;
              existingState[sessId].spark = foundPartnerSpark;
              existingState[sessId].sparkId = foundPartnerSpark.id;

              gameState = existingState;
              gameStates.set(gameStateId, existingState);
            }
          } else {
            // new pair or expired game state
            const logName = getLogname(reqSid, sessId);
            logger.info(`new pair ${logName}`);

            jPartner.pairedWith = logName;
            jRequesterCopy.pairedWith = logName;

            // init game state
            const initialBoard = createInitialState();
            gameState = {
              id: logName,
              [reqSid]: {
                sessionId: reqSid,
                partnerSid: sessId,
                spark: spk,
                sparkId: spk.id,
                role: 'A',
                board: initialBoard.A,
              },
              [sessId]: {
                sessionId: sessId,
                partnerSid: reqSid,
                spark: foundPartnerSpark,
                sparkId: foundPartnerSpark.id,
                role: 'B',
                board: initialBoard.B,
              },
              gameId: 0,
              common: initialBoard.common,
              uniqueA: initialBoard.uniqueA,
              uniqueB: initialBoard.uniqueB,
              turn: reqSid,
              turnCount: 0,
              undosLeft: 2,
              currentSelection: new Set(),
            };
            gameStates.set(logName, gameState);
          }

          // save new pair
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
  if (gameStateId === 'noone' || gameStateId == null) {
    logger.info('session not paired');
    return { state: 'noone' };
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
    const requester = state[ownSid];
    const ownturn = state.turn === ownSid;
    return {
      state, partner, requester, ownturn,
    };
  }
  return { state: 'partnerdisconnected' };
}


function checkTurnConditions(state) {
  if (state.turnCount === 0) {
    if (state.currentSelection.size === 4) {
      return null;
    }
    return 'select 4';
  }
  if (state.currentSelection.size === 2) {
    return null;
  }
  return 'select 2';
}

function writeMsg(sprk, msg, info) {
  sprk.write({ msg, info });
}

function writeLog(logName, jContent) {
  const logPath = `logs${path.sep}${logName}.log`;
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


function getTurnData(player, state, turn) {
  return {
    turn,
    gameId: state.gameId,
    board: player.board,
    undosLeft: state.undosLeft,
    turnCount: state.turnCount,
    role: player.role,
  };
}

function getGameData(state, requester, partner, ownTurn) {
  return {
    [requester.role]: {
      board: requester.board,
    },
    [partner.role]: {
      board: partner.board,
    },
    gameId: state.gameId,
    common: Array.from(state.common),
    uniqueA: Array.from(state.uniqueA),
    uniqueB: Array.from(state.uniqueB),
    turn: (ownTurn) ? requester.role : partner.role,
    turnCount: state.turnCount,
    undosLeft: state.undosLeft,
    currentSelection: Array.from(state.currentSelection),
  };
}

function registerClick(state, requester, partner, ownTurn, id, selected) {
  const selToUpdate = new Set(state.currentSelection);
  if (selected && !selToUpdate.has(id)) {
    selToUpdate.add(id);
  } else if (!selected && selToUpdate.has(id)) {
    selToUpdate.delete(id);
  } else {
    logger.warn(`selection by ${requester.sessionId} in game ${state.id} not allowed`);
  }
  const stateToUpdate = gameStates.get(state.id);
  stateToUpdate.currentSelection = selToUpdate;
  gameStates.set(state.id, stateToUpdate);
  writeLog(state.id, getGameData(stateToUpdate, requester, partner, ownTurn));
}

function broadcastTurn(state, requester, partner, ownTurn) {
  requester.spark.write(getTurnData(requester, state, ownTurn));
  partner.spark.write(getTurnData(partner, state, !ownTurn));
  writeLog(state.id, getGameData(state, requester, partner, ownTurn));
}

// ends requesters turn in session store
// assumes that the partner connection has been checked
function endTurn(state, partner, requester, ownTurn) {
  if (!ownTurn) {
    logger.warn(`ending turn by ${requester.sessionId} in game ${state.id} not allowed`);
  }
  const checkResult = checkTurnConditions(state);
  if (checkResult != null) {
    writeMsg(requester.spark, checkResult, '');
    return;
  }

  const stateToUpdate = gameStates.get(state.id);

  stateToUpdate.turnCount += 1;

  const rBoard = [];
  state[requester.sessionId].board.forEach((elem) => {
    if (!state.currentSelection.has(elem)) {
      rBoard.push(elem);
    }
  });
  const pBoard = [];
  state[partner.sessionId].board.forEach((elem) => {
    if (!state.currentSelection.has(elem)) {
      pBoard.push(elem);
    }
  });

  stateToUpdate.currentSelection.clear();
  stateToUpdate[requester.sessionId].board = rBoard;
  stateToUpdate[partner.sessionId].board = pBoard;
  stateToUpdate.turn = partner.sessionId;
  gameStates.set(state.id, stateToUpdate);
  writeLog(state.id, getGameData(stateToUpdate, requester, partner, !ownTurn));
  broadcastTurn(stateToUpdate, requester, partner, !ownTurn);
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
    const requester = gameState[requesterSid];
    writeMsg(requester.spark, 'FOUND', `${requester.role}// game ${gameState.id}//${gameState.gameId}`);
    writeMsg(partner.spark, 'FOUND', `${partner.role}// game ${gameState.id}//${gameState.gameId}`);
    // initialize client boards
    broadcastTurn(gameState, requester, partner, gameState.turn === requesterSid);
  } else {
    // reset in case of a retrieved session where partner is not connected
    // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    // no partner found yet
    writeMsg(spark, 'waitforpartner:wait TODOnew', '');
  }

  // ======================================================

  spark.on('data', (packet) => {
    if (!packet) return;

    const {
      state, partner, requester, ownturn,
    } = getStateCheckPartner(spark, sessionStore);

    if (state === 'noone') {
      writeMsg(spark, 'unpaired:reload', '');
      writeLog(state.id, { resetBy: 'unpaired' });
      const ownSid = extractSid(spark.headers.cookie);
      resetSessionToUnpaired(ownSid, sessionStore);
    } else if (state === 'partnerdisconnected') {
      writeMsg(spark, 'partnerdisconnected:wait or reset', '');
    } else {
      const data = JSON.parse(packet);

      if (data.txt !== undefined) {
        broadcastWithLog(spark, partner.spark, data, requester.role, state.id);
      } else if (data.act !== undefined) {
        // only click
        if (data.act === 'click') {
          registerClick(state, requester, partner, ownturn, data.id, data.selected);
        }
      } else if (data.endturn !== undefined) {
        endTurn(state, partner, requester, ownturn);
      } else if (data.reset !== undefined) {
        logger.info(`resetting pair ${state.id}`);
        writeLog(state.id, { resetBy: requester.role });
        resetSessionToUnpaired(requester.sessionId, sessionStore);
        resetSessionToUnpaired(partner.sessionId, sessionStore);
        gameStates.del(state.id);
        writeMsg(spark, 'resetdone:reload', '');
        writeMsg(partner.spark, 'resetdone:reload', '');
      } else if (data.msg !== undefined) {
        // TODO
      }
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
    const {
      partner,
    } = getStateCheckPartner(spark, sessionStore);
    if (partner != null) {
      writeMsg(partner.spark, 'partnerdisconnected:wait TODOnew', spark.id);
      // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    }
  });
  spark.on('close', () => {

  });
};

module.exports = tg;
