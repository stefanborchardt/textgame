const config = require('config');
const winston = require('winston');
const cache = require('lru-cache');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = (directory,
  gameSetSize, gameNumCommon, gameNumUnique, gameUndos, gameSelections) => {
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

  /** TODO */
  const createInitialState = () => {
    // first digit of photo indicates category
    const allImages = new Set();
    while (allImages.size < (gameNumCommon + 2 * gameNumUnique)) {
      // photo file names 100..599
      allImages.add(Math.floor(Math.random() * gameSetSize + 100).toString());
    }

    // game state will be stored as sets,
    // arrays used for indexed access and shuffling
    const allImagesArray = Array.from(allImages);
    // hidden from players:
    const common = allImagesArray.slice(0, gameNumCommon);
    const uniqueA = allImagesArray.slice(gameNumCommon, gameNumCommon + gameNumUnique);
    const uniqueB = allImagesArray.slice(gameNumCommon + gameNumUnique,
      gameNumCommon + 2 * gameNumUnique);
    // visible to respective player:
    const boardA = shuffle(common.concat(uniqueA));
    const boardB = shuffle(common.concat(uniqueB));

    return {
      A: new Set(boardA),
      B: new Set(boardB),
      common: new Set(common),
      uniqueA: new Set(uniqueA),
      uniqueB: new Set(uniqueB),
    };
  };

  /** finds another user without partner or the former partner and
 * initialises the game state */
  const findPartnerCheckConnection = (spk, reqSid, jRequester, sStore) => {
    let gameState = null;
    const gameStateId = jRequester.pairedWith;
    // iterate sessions
    sStore.rforEach((session, sessId) => {
      if (gameState == null) {
        const jPartner = JSON.parse(session);
        // an other session that is not paired or is paired with requester
        if (sessId !== reqSid && jPartner.pairedWith === gameStateId) {
          // found unpaired or former partner, check if connected
          const foundPartnerSpark = findPartnerSpark(spk, sessId);
          if (foundPartnerSpark != null) {
            // partner connection exists
            const jRequesterCopy = Object.assign({}, jRequester);
            const existingState = gameStates.get(gameStateId);
            if (existingState != null) {
              // verify existing game state
              if (existingState[sessId] === undefined || existingState[reqSid] === undefined) {
                // session IDs in game state do not match session data of partners
                // this would be unexpected
                logger.warn(`resetting pair ${gameStateId} : ${jRequester.pairedWith} + ${jPartner.pairedWith}`);
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
                  unique: initialBoard.uniqueA,
                  messageCount: 0,
                },
                [sessId]: {
                  sessionId: sessId,
                  partnerSid: reqSid,
                  spark: foundPartnerSpark,
                  sparkId: foundPartnerSpark.id,
                  role: 'B',
                  board: initialBoard.B,
                  unique: initialBoard.uniqueB,
                  messageCount: 0,
                },
                name: 'L5-test-other200',
                common: initialBoard.common,
                turn: reqSid,
                turnCount: 0,
                undosLeft: gameUndos,
                selectionsLeft: gameSelections,
                extras: {
                  undo: false,
                  incSelection: false,
                },
                currentSelection: new Set(),
                previousSelection: new Set(),
                playerA: reqSid,
                playerB: sessId,
              };
              gameStates.set(logName, gameState);
            }

            // save new pair
            sStore.set(sessId, JSON.stringify(jPartner), maxAge);
            sStore.set(reqSid, JSON.stringify(jRequesterCopy), maxAge);
          } else {
            // former partner not connected
          }
        } else {
          // this session is not available as partner
        }
      }
    });
    return gameState;
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
    const logPath = `logs${path.sep}${directory}${path.sep}${logName}.log`;
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
  const getGameData = (state, requester, partner, isReqTurn) => (
    {
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
    }
  );

  // =============================== selection

  /** game state for selection logging */
  const getShortGameData = (state, requester, partner, ownTurn) => (
    {
      turnCount: state.turnCount,
      turn: (ownTurn) ? requester.role : partner.role,
      selectionsLeft: state.selectionsLeft,
      currentSelection: Array.from(state.currentSelection),
      [requester.role]: {
        board: Array.from(requester.board),
      },
    }
  );

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

  /** @returns the number of unique images that the player has left */
  const getUniqueLeft = (state, player) => (
    Array.from(state[player].unique)
      .filter(val => state[player].board.has(val)).length
  );

  /** @returns the number of shared images that the players have left */
  const getCommonLeft = state => (
    Array.from(state.common)
      .filter(val => state[state.playerA].board.has(val)).length
  );

  /** game state suitable for sending to the player */
  const getTurnData = (player, state, turn) => (
    {
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
    }
  );

  /** sends the current game state to the players */
  const broadcastTurn = (state, requester, partner, isReqTurn) => {
    requester.spark.write(getTurnData(requester, state, isReqTurn));
    partner.spark.write(getTurnData(partner, state, !isReqTurn));
    writeLog(state.id, getGameData(state, requester, partner, isReqTurn));
  };

  const connectionHandler = (spark, endTurn, sessionStore) => {
    // we use the browser session to identify a user
    // expiration of session can be configured in the properties
    // a user session can span multiple sparks (websocket connections)
    const requesterSid = extractSid(spark.headers.cookie);
    if (requesterSid == null) {
      logger.info('connection without cookie');
      writeMsg(spark, 'Cookies bitte zulassen.');
      return;
    }
    const jRequesterSession = JSON.parse(syncSession(requesterSid, sessionStore));

    writeMsg(spark, 'Willkommen!');
    logger.info('new connection');

    if (jRequesterSession.pairedWith === 'noone') {
      // new connection or server restart
      // going to find new partner
      writeMsg(spark, 'Suche neuen Mitspieler...');
    } else {
      // unexpired session connecting again
      // going to check if former partner is still there
      writeMsg(spark, 'Versuche letzen Mitspieler zu finden, ggf. "Neuer Partner" klicken');
    }

    // try to find a partner
    const gameState = findPartnerCheckConnection(spark, requesterSid,
      jRequesterSession, sessionStore);

    if (gameState != null) {
      // it's a match
      const partner = getPartner(requesterSid, gameState);
      const requester = gameState[requesterSid];
      writeMsg(requester.spark, 'Mitspieler gefunden.');
      writeMsg(partner.spark, 'Mitspieler gefunden.');
      // initialize client boards
      broadcastTurn(gameState, requester, partner, gameState.turn === requesterSid);
    } else {
      // no partner found yet
      writeMsg(spark, 'Warten auf Mitspieler...');
    }

    // ====================================================== handler incoming requests

    spark.on('data', (packet) => {
      if (!packet) return;

      const reqSid = extractSid(spark.headers.cookie);

      const {
        state, partner, requester, ownturn,
      } = checkPartnerGetState(spark, reqSid, sessionStore);

      if (state === 'noone') {
        // game reset by partner
        logger.warn(`resetting partner ${reqSid}`);
        writeMsg(spark, 'UNPAIRED PARTNER COMMUNICATING');
      } else if (state === 'partnerdisconnected') {
        const data = JSON.parse(packet);
        if (data.reset !== undefined) {
          logger.info(`resetting partner ${reqSid}`);
          const jSession = JSON.parse(syncSession(reqSid, sessionStore));
          gameStates.del(jSession.pairedWith);
          resetSessionToUnpaired(reqSid, sessionStore);
          writeMsg(spark, 'Spiel wurde verlassen.');
        } else {
          writeMsg(spark, 'Mitspieler nicht erreichbar, warten oder "Neuer Partner" klicken');
        }
      } else if (state === 'reset') {
        // handled in checkPartnerGetState()
      } else {
        const data = JSON.parse(packet);

        if (data.txt !== undefined) {
          broadcastMessage(state, requester, partner, data);
        } else if (data.act !== undefined) {
          if (data.act === 'click') {
            registerClick(state, requester, partner, ownturn, data.id, data.selected);
          }
        } else if (data.endturn !== undefined) {
          endTurn(state, partner, requester, ownturn);
        } else if (data.reset !== undefined) {
          logger.info(`resetting pair ${state.id}`);
          writeLog(state.id, { resetBy: requester.role });
          gameStates.del(state.id);
          resetSessionToUnpaired(requester.sessionId, sessionStore);
          writeMsg(spark, 'Spiel wurde verlassen.');
          spark.end();
          writeMsg(partner.spark, 'Mitspieler hat das Spiel verlassen, ggf. "Neuer Partner" klicken');
        } else if (data.msg !== undefined) {
          // TODO
        }
      }
    });
  };

  return {
    connectionHandler,
    logger,
    gameStates,
    writeMsg,
    writeLog,
    getUniqueLeft,
    getCommonLeft,
    getGameData,
    broadcastTurn,
  };
};
