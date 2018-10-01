const config = require('config');
const winston = require('winston');
const cache = require('lru-cache');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = (directory) => {
  const maxAge = parseInt(config.get('cookie.maxage'), 10);

  const logger = winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.simple(),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
    ),
    transports: [
      new winston.transports.File({
        filename: `logs/${directory}/combined.log`,
      }),
    ],
  });

  /** stores the state of the game by log file name.
  * infinite size, pruned regularly */
  const gameStates = cache({ maxAge });
  setInterval(() => { gameStates.prune(); }, 2 * maxAge);

  // ============================================= session and connection

  /** Extract session ID from the cookie string */
  const extractSid = (cookie) => {
    if (undefined === cookie) {
      return null;
    }
    const indexEq = cookie.indexOf('=');
    const indexDot = cookie.indexOf('.', indexEq);
    return cookie.substring(indexEq + 5, indexDot);
  };

  /** return session from store, if necessary after
  restoring from cookie */
  const syncSession = (reqSid, sStore) => {
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
  };

  /** find the spark for the partner session ID */
  const findPartnerSpark = (sprk, partnerSid) => {
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
  };

  /** reset pairedWith and partnerSpkId for session ID  in store */
  const resetSessionToUnpaired = (sessionId, sStore) => {
    const jSession = JSON.parse(syncSession(sessionId, sStore));
    const jSessionCopy = Object.assign({}, jSession);
    jSessionCopy.pairedWith = 'noone';
    sStore.set(sessionId, `${JSON.stringify(jSessionCopy)}\n`, maxAge);
  };

  // ================================================== game setup

  // create log file name from the hash of two strings and a random number
  const getLogname = (id1, id2) => {
    const clearIdentifier = id1 + Math.random() + id2;
    const hashedIdentifier = crypto.createHash('sha256').update(clearIdentifier).digest('base64');
    const identifier = hashedIdentifier.replace(/\W/g, '');
    return `${identifier}`;
  };

  /** Shuffles array in place */
  const shuffle = (a) => {
    const r = a;
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };

  /** get the partner from the game state */
  const getPartner = (sessionId, gameState) => {
    const ownState = gameState[sessionId];
    return gameState[ownState.partnerSid];
  };

  /** find the spark of the partner
  after a connection has been established
  @returns game state info
  @returns an error string if not paired in session store
  or partner not in primus connections */
  const checkPartnerGetState = (sprk, ownSid, sStore) => {
    const jSession = JSON.parse(syncSession(ownSid, sStore));

    const gameStateId = jSession.pairedWith;
    if (gameStateId === 'noone' || gameStateId == null) {
      logger.info('session not paired');
      return { state: 'noone' };
    }

    const state = gameStates.get(gameStateId);
    if (state == null) {
      // former partner has left game
      logger.warn(`resetting partner ${gameStateId}`);
      resetSessionToUnpaired(ownSid, sStore);
      return { state: 'reset' };
    }

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
    logger.info('spark not connected');
    return { state: 'partnerdisconnected' };
  };

  // ====================================================== outgoing messages

  const writeMsg = (sprk, msg) => {
    sprk.write({ msg });
  };

  const writeLog = (logName, jContent) => {
    const logPath = `logs${path.sep}te${path.sep}${logName}.log`;
    fs.open(logPath, 'a', (_err, fd) => {
      fs.appendFile(fd, JSON.stringify(jContent) + os.EOL, (_err) => {
        fs.close(fd, (_err) => { });
      });
    });
  };

  const broadcastMessage = (state, requester, partner, data) => {
    const dataCopy = Object.assign({}, data);
    dataCopy.role = requester.role;
    requester.spark.write(dataCopy);
    partner.spark.write(dataCopy);

    const updState = gameStates.get(state.id);
    updState[requester.sessionId].messageCount += 1;
    gameStates.set(state.id, updState);
    writeLog(state.id, dataCopy);
  };

  /** full game state for logging including the game solution */
  const getGameData = (state, requester, partner, isReqTurn) => {
    return {
      turnCount: state.turnCount,
      turn: (isReqTurn) ? requester.role : partner.role,
      selectionsLeft: state.selectionsLeft,
      currentSelection: Array.from(state.currentSelection),
      [requester.role]: {
        board: Array.from(requester.board),
      },
      [partner.role]: {
        board: Array.from(partner.board),
      },
      undosLeft: state.undosLeft,
      name: state.name,
      common: Array.from(state.common),
      uniqueA: Array.from(state[state.playerA].unique),
      uniqueB: Array.from(state[state.playerB].unique),
    };
  };

  // =============================== selection

  /** game state for selection logging */
  const getShortGameData = (state, requester, partner, ownTurn) => {
    return {
      turnCount: state.turnCount,
      turn: (ownTurn) ? requester.role : partner.role,
      selectionsLeft: state.selectionsLeft,
      currentSelection: Array.from(state.currentSelection),
      [requester.role]: {
        board: Array.from(requester.board),
      },
    };
  };

  const registerClick = (state, requester, partner, ownTurn, id, selected) => {
    const curSel = state.currentSelection;
    const stateToUpdate = gameStates.get(state.id);
    if (selected && !curSel.has(id)) {
      curSel.add(id);
      stateToUpdate.selectionsLeft -= 1;
    } else if (!selected && curSel.has(id)) {
      curSel.delete(id);
      stateToUpdate.selectionsLeft += 1;
    } else {
      logger.warn(`selection by ${requester.sessionId} in game ${state.id} not allowed`);
    }
    stateToUpdate.currentSelection = curSel;
    gameStates.set(state.id, stateToUpdate);
    requester.spark.write({ updSelLeft: stateToUpdate.selectionsLeft });
    writeLog(state.id, getShortGameData(stateToUpdate, requester, partner, ownTurn));
  };

  // ====================================================== turns

  const getUniqueLeft = (state, player) => {
    return Array.from(state[player].unique)
      .filter(val => state[player].board.has(val)).length;
  };

  /** game state suitable for sending to the player */
  const getTurnData = (player, state, turn) => {
    return {
      turn,
      name: state.name,
      board: Array.from(player.board),
      undosLeft: state.undosLeft,
      turnCount: state.turnCount,
      role: player.role,
      selectionsLeft: state.selectionsLeft,
      extra: state.extrass,
      uniqueLeftA: getUniqueLeft(state, state.playerA),
      uniqueLeftB: getUniqueLeft(state, state.playerB),
    };
  };

  /** sends the current game state to the players */
  const broadcastTurn = (state, requester, partner, isReqTurn) => {
    requester.spark.write(getTurnData(requester, state, isReqTurn));
    partner.spark.write(getTurnData(partner, state, !isReqTurn));
    writeLog(state.id, getGameData(state, requester, partner, isReqTurn));
  };

  return {
    logger,
    extractSid,
    syncSession,
    gameStates,
    findPartnerSpark,
    resetSessionToUnpaired,
    getLogname,
    checkPartnerGetState,
    writeMsg,
    shuffle,
    maxAge,
    getUniqueLeft,
    getGameData,
    writeLog,
    broadcastTurn,
    broadcastMessage,
    registerClick,
    getPartner,
  };
};
