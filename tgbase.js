const config = require('config');
const winston = require('winston');
const cache = require('lru-cache');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = (options) => {
  const {
    directory,
    paramSetSize, // number of images available in the file system
    // must be named 100.jpg .. {setsize+99}.jpg, not tested for >900
    paramNumCommon, // number of shared images
    paramNumUnique, // unique images for each player
    paramUndos, // number of undos
    paramSelections, // number of selections per turn
    paramGameName, // how this game is identified in game logs
  } = options;

  const maxAge = parseInt(config.get('cookie.maxage'), 10);

  // general application logger, not the game logs
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
   * The player browser session holds the reference to a game state in this list.
   * Entries of the list hold information as in findPartnerCheckConnection().
   * Cache has infinite size, pruned regularly */
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
    while (allImages.size < (paramNumCommon + 2 * paramNumUnique)) {
      // photo file names 100..599
      allImages.add(Math.floor(Math.random() * paramSetSize + 100).toString());
    }

    // game state will be stored as sets,
    // arrays used for indexed access and shuffling
    const allImagesArray = Array.from(allImages);
    // hidden from players:
    const common = allImagesArray.slice(0, paramNumCommon);
    const uniqueA = allImagesArray.slice(paramNumCommon, paramNumCommon + paramNumUnique);
    const uniqueB = allImagesArray.slice(paramNumCommon + paramNumUnique,
      paramNumCommon + 2 * paramNumUnique);
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
                  extraSelected: '',
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
                  extraSelected: '',
                },
                name: paramGameName,
                common: initialBoard.common,
                turn: reqSid,
                turnCount: 0,
                selectionsLeft: paramSelections,
                extrasAvailable: {
                  undo: false, // nothing to undo in first turn
                  undosLeft: paramUndos,
                  // incSelection: false,
                  // incSelectLeft: paramUndos,
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
    dataCopy.ownMsg = true;
    requester.spark.write(dataCopy);
    dataCopy.ownMsg = false;
    partner.spark.write(dataCopy);
    delete dataCopy.ownMsg;

    const updState = gameStates.get(state.id);
    updState[requester.sessionId].messageCount += 1;
    gameStates.set(state.id, updState);

    dataCopy.playerMsgNumber = updState[requester.sessionId].messageCount;
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
        uniqueLeft: Array.from(state[state.playerA].unique)
          .filter(val => state[state.playerA].board.has(val)),
      },
      [partner.role]: {
        board: Array.from(partner.board),
        uniqueLeftB: Array.from(state[state.playerB].unique)
          .filter(val => state[state.playerB].board.has(val)),
      },
      extras: {
        undosLeft: state.extrasAvailable.undosLeft,
        // incSelectLeft: state.extrasAvailable.incSelectLeft,
      },
      name: state.name,
      common: Array.from(state.common),
      uniqueA: Array.from(state[state.playerA].unique),
      uniqueB: Array.from(state[state.playerB].unique),
    }
  );

  // =============================== selection

  /** game state for selection logging */
  const getShortGameData = (state, requester, partner) => (
    {
      turnCount: state.turnCount,
      turn: (state.turn === requester.sessionId) ? requester.role : partner.role,
      selectionsLeft: state.selectionsLeft,
      currentSelection: Array.from(state.currentSelection),
      extrasAvailable: state.extrasAvailable,
      extraSelected: state[requester.sessionId].extraSelected,
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
    writeLog(state.id, getShortGameData(stateToUpdate, requester, partner));
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
      role: player.role,
      board: Array.from(player.board),
      turnCount: state.turnCount,
      selectionsLeft: state.selectionsLeft,
      extra: {
        undo: state.extrasAvailable.undo,
        undosLeft: state.extrasAvailable.undosLeft,
        // incSelection: state.extrasAvailable.incSelection,
        // incSelectLeft: state.extrasAvailable.incSelectLeft,
      },
      uniqueLeftA: getUniqueLeft(state, state.playerA),
      uniqueLeftB: getUniqueLeft(state, state.playerB),
    }
  );

  /** sends the current game state to the players */
  const broadcastTurn = (state, requester, partner) => {
    const isReqTurn = state.turn === requester.sessionId;
    requester.spark.write(getTurnData(requester, state, isReqTurn));
    partner.spark.write(getTurnData(partner, state, !isReqTurn));
    writeLog(state.id, getGameData(state, requester, partner, isReqTurn));
  };

  // ======================================================
  // high potential for game specific implementation: hand in as
  // module exports parameters
  // ======================================================

  // ends requesters turn in session store
  // assumes that the partner connection has been checked
  const endTurn = (state, partner, requester, ownTurn) => {
    if (!ownTurn) {
      logger.warn(`ending turn by ${requester.sessionId} in game ${state.id} not allowed`);
    }
    if (state.selectionsLeft < 0) {
      writeMsg(requester.spark, 'Bitte weniger auswählen!');
      return;
    }
    if (state.currentSelection.size === 0) {
      writeMsg(requester.spark, 'Mindestens eins auswählen!');
      return;
    }

    const unqLeftPrevious = getUniqueLeft(state, state.playerA)
      + getUniqueLeft(state, state.playerB);

    // remove selection from player boards
    const stateToUpdate = gameStates.get(state.id);
    state.currentSelection.forEach((val) => {
      stateToUpdate[requester.sessionId].board.delete(val);
      stateToUpdate[partner.sessionId].board.delete(val);
    });

    // calculate the number of shared images left
    const commonLeftNow = getCommonLeft(stateToUpdate);
    // calculate unique images lost in this turn
    const playerAUqLeftNow = getUniqueLeft(stateToUpdate, stateToUpdate.playerA);
    const playerBUqLeftNow = getUniqueLeft(stateToUpdate, stateToUpdate.playerB);
    const unqLeftNow = playerAUqLeftNow + playerBUqLeftNow;

    if (commonLeftNow === 0 || unqLeftNow === 0) {
      // game ends
      // broadcast end
      // TODO
      writeMsg(requester.spark, 'ENDE');
      writeMsg(partner.spark, 'ENDE');
      gameStates.set(state.id, stateToUpdate);
      writeLog(state.id, getGameData(stateToUpdate, requester, partner));
      broadcastTurn(stateToUpdate, requester, partner);
      return;
    }

    const upExtrasAvail = stateToUpdate.extrasAvailable;
    if (unqLeftPrevious - unqLeftNow > 0) {
      // make extra actions available
      // if (upExtrasAvail.incSelectLeft > 0 && commonLeftNow > 0) {
      // upExtrasAvail.incSelection = true;
      // }
      const increasedSelection = Math.ceil(1.3 * paramSelections);
      stateToUpdate.selectionsLeft = commonLeftNow < increasedSelection
        ? commonLeftNow : increasedSelection;
      writeMsg(requester.spark, 'Falsches Bild gelöscht - in diesem Zug mehr Entfernen verfügbar.');
      writeMsg(partner.spark, 'Falsches Bild gelöscht - in diesem Zug mehr Entfernen verfügbar.');
    } else {
      stateToUpdate.selectionsLeft = commonLeftNow < paramSelections
        ? commonLeftNow : paramSelections;
      //   upExtrasAvail.incSelection = false;
      //   upExtrasAvail.undo = false;
    }
    if (upExtrasAvail.undosLeft > 0) {
      upExtrasAvail.undo = true;
    }
    stateToUpdate.extrasAvailable = upExtrasAvail;

    // calculate number of selections for next turn

    // clear current turn data
    stateToUpdate.previousSelection = new Set(state.currentSelection);
    stateToUpdate.currentSelection.clear();
    stateToUpdate.turnCount += 1;
    // reset player choices in case extra selection was not finished
    stateToUpdate.playerA.extraSelected = '';
    stateToUpdate.playerB.extraSelected = '';
    // switch player
    stateToUpdate.turn = partner.sessionId;

    gameStates.set(state.id, stateToUpdate);
    writeLog(state.id, getGameData(stateToUpdate, requester, partner));
    broadcastTurn(stateToUpdate, requester, partner);
  };


  /** handle extra choice of players */
  const applyExtra = (state, partner, requester, extra) => {
    // if ((!extra.undo && !extra.incSel) || (extra.undo && extra.incSel)) {
    //   writeMsg(requester.spark, 'Bitte eins auswählen.');
    //   return;
    // }

    // save selection
    const stateToUpdate = gameStates.get(state.id);
    const reqSelected = stateToUpdate[requester.sessionId];
    if (extra.undo) {
      reqSelected.extraSelected = 'undo';
      writeMsg(partner.spark, 'Mitspieler wählt "Rückgängig".');
    } else {
      reqSelected.extraSelected = '';
      writeMsg(partner.spark, '"Rückgängig" von Mitspieler abgewählt.');
    }
    // else {
    //   reqSelected.extraSelected = 'incSelection';
    //   writeMsg(partner.spark, 'Mitspieler wählt "extra Auswahl".');
    // }
    gameStates.set(state.id, stateToUpdate);
    writeLog(state.id, getShortGameData(stateToUpdate, requester, partner));

    // check for agreement
    if (stateToUpdate[partner.sessionId].extraSelected !== '') {
      if (stateToUpdate[partner.sessionId].extraSelected === reqSelected.extraSelected) {
        // if (extra.incSel) {
        //   stateToUpdate.selectionsLeft += 1;
        //   stateToUpdate.extrasAvailable.incSelectLeft -= 1;
        // } else {

        // undo
        stateToUpdate.previousSelection.forEach((val) => {
          if (state.common.has(val)) {
            stateToUpdate[state.playerA].board.add(val);
            stateToUpdate[state.playerB].board.add(val);
          }
          if (state[state.playerA].unique.has(val)) {
            stateToUpdate[state.playerA].board.add(val);
          }
          if (state[state.playerB].unique.has(val)) {
            stateToUpdate[state.playerB].board.add(val);
          }
        });
        stateToUpdate.extrasAvailable.undosLeft -= 1;
        // }

        // reset available extra actions
        stateToUpdate[state.playerA].extraSelected = '';
        stateToUpdate[state.playerB].extraSelected = '';
        stateToUpdate.extrasAvailable.undo = false;
        // stateToUpdate.extrasAvailable.incSelection = false;

        gameStates.set(state.id, stateToUpdate);
        writeLog(state.id, getGameData(stateToUpdate, requester, partner));
        broadcastTurn(stateToUpdate, requester, partner);
      } else {
        writeMsg(requester.spark, 'Keine Übereinstimmung bei Zusatzaktion.');
        writeMsg(partner.spark, 'Keine Übereinstimmung bei Zusatzaktion.');
      }
    }
  };

  // ====================================================== connection handler

  const connectionHandler = (spark, sessionStore) => {
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
    logger.info('new connection');

    if (jRequesterSession.pairedWith === 'noone') {
      // new connection or server restart
      // going to find new partner
      writeMsg(spark, 'Willkommen! Suche neuen Mitspieler...');
    } else {
      // unexpired session connecting again
      // going to check if former partner is still there
      writeMsg(spark, 'Willkommen zurück! Versuche letzen Mitspieler zu finden, ggf. "Neuer Partner" klicken');
    }

    // try to find a partner and set up game
    const gameState = findPartnerCheckConnection(spark, requesterSid,
      jRequesterSession, sessionStore);

    if (gameState != null) {
      // it's a match
      const partner = getPartner(requesterSid, gameState);
      const requester = gameState[requesterSid];
      writeMsg(requester.spark, 'Mitspieler gefunden.');
      writeMsg(partner.spark, 'Mitspieler gefunden.');
      // initialize client boards
      broadcastTurn(gameState, requester, partner);
    } else {
      // no partner found yet
      writeMsg(spark, 'Warten auf Mitspieler...');
    }

    // ====================================================== handler incoming requests

    spark.on('data', (packet) => {
      if (!packet) return;

      const reqSid = extractSid(spark.headers.cookie);

      // check if partner still available
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
          // the second player wants to leave the game
          logger.info(`resetting partner ${reqSid}`);
          const jSession = JSON.parse(syncSession(reqSid, sessionStore));
          gameStates.del(jSession.pairedWith);
          resetSessionToUnpaired(reqSid, sessionStore);
          writeMsg(spark, 'Spiel wurde verlassen.');
        } else {
          writeMsg(spark, 'Mitspieler nicht erreichbar, warten oder "Neuer Partner" klicken');
        }
      } else if (state === 'reset') {
        // handled in checkPartnerGetState(), mentioned here to cover all possible return values
      } else {
        const data = JSON.parse(packet);
        // here we evaluate the type of message
        if (data.txt !== undefined) {
          broadcastMessage(state, requester, partner, data);
        } else if (data.act !== undefined) {
          if (data.act === 'click') {
            registerClick(state, requester, partner, ownturn, data.id, data.selected);
          } else if (data.act === 'extra') {
            applyExtra(state, partner, requester, data.extra);
          } else if (data.act === 'typing') {
            partner.spark.write({ typing: true, role: requester.role });
          }
        } else if (data.endturn !== undefined) {
          endTurn(state, partner, requester, ownturn);
        } else if (data.reset !== undefined) {
          // the first player wants to leave the game
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

  // ======================================================
  return {
    connectionHandler,
    logger,
    gameStates,
    writeMsg,
    writeLog,
    getUniqueLeft,
    getCommonLeft,
    getGameData,
    getShortGameData,
    broadcastTurn,
  };
};
