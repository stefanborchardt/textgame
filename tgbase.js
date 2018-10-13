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
    paramUndo, // availability undos
    paramJoker, // availability jokers
    paramSelections, // number of selections per turn
    paramGameName, // how this game is identified in game logs
  } = options;

  const jokerSize = Math.ceil(paramSelections / 2);

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
        filename: `logs/${directory}.log`,
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
  const syncSession = (sessionId, sStore) => {
    const storedSession = sStore.get(sessionId);
    if (undefined !== storedSession) {
      return JSON.parse(storedSession);
    }
    // client with old sessionid reconnecting
    // after server restart
    // creating session store entry from sid
    logger.info('restoring session from cookie');
    sStore.set(sessionId, JSON.stringify({
      cookie: {
        originalMaxAge: maxAge,
        expires: new Date(Date.now() + maxAge).toISOString(),
        secure: true,
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
      },
      gameStateId: 'NOGAME',
      loggedIn: true, // not really protecting anything
    }), maxAge);
    return JSON.parse(sStore.get(sessionId));
  };

  /** find the spark for the partner session ID */
  const findPartnerSpark = (sprk, partnerSid) => {
    let partnerSpark = null;
    // go through all the sparks
    sprk.primus.forEach((spk, spkId) => {
      if (partnerSpark == null) {
        if (spkId !== sprk.id) {
          // check if other spark has the session id we are looking for
          const otherSid = extractSid(spk.headers.cookie);
          if (partnerSid === otherSid) {
            partnerSpark = spk;
          }
        }
      }
    });
    return partnerSpark;
  };

  /** reset gameStateId and partnerSpkId for session ID  in store */
  const resetSessionToUnpaired = (sessionId, sStore) => {
    const jSession = syncSession(sessionId, sStore);
    const jSessionCopy = Object.assign({}, jSession);
    jSessionCopy.gameStateId = 'NOGAME';
    sStore.set(sessionId, `${JSON.stringify(jSessionCopy)}\n`, maxAge);
  };

  /** get the partner from the game state */
  const getPartner = (sessionId, gameState) => {
    const ownState = gameState[sessionId];
    return gameState[ownState.partnerSid];
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
    let newOrExist = null;
    const gameStateId = jRequester.gameStateId;
    // iterate sessions
    sStore.rforEach((session, sessId) => {
      if (gameState == null) {
        const jPartner = JSON.parse(session);
        // an other session that is not paired or is paired with requester
        if (sessId !== reqSid && jPartner.gameStateId === gameStateId) {
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
                logger.warn(`resetting pair ${gameStateId} : ${jRequester.gameStateId} + ${jPartner.gameStateId}`);
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
                newOrExist = 'previous';
              }
            } else {
              // new pair or expired game state
              const logName = getLogname(reqSid, sessId);
              logger.info(`new pair ${logName}`);

              jPartner.gameStateId = logName;
              jRequesterCopy.gameStateId = logName;

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
                  undoUsed: false,
                  joker: paramJoker,
                  jokerUsed: false,
                },
                currentSelection: new Set(),
                previousSelection: new Set(),
                isEnded: false,
                playerA: reqSid,
                playerB: sessId,
              };
              gameStates.set(logName, gameState);
              newOrExist = 'new';
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
    return { newOrExist, gameState };
  };

  /** find the spark of the partner
  after a connection has been established
  @returns game state info
  @returns an error string if not paired in session store
  or partner not in primus connections */
  const checkPartnerGetState = (sprk, reqSid, sStore) => {
    const jSession = syncSession(reqSid, sStore);

    const gameStateId = jSession.gameStateId;
    if (gameStateId === 'NOGAME' || gameStateId == null) {
      logger.info('session not paired');
      return { state: 'NOGAME' };
    }

    const state = gameStates.get(gameStateId);
    if (state == null) {
      // former partner has left game and we know it
      logger.warn(`resetting partner ${gameStateId}`);
      resetSessionToUnpaired(reqSid, sStore);
      return { state: 'reset' };
    }

    const partner = getPartner(reqSid, state);
    let found = false;
    sprk.primus.forEach((spk, id) => {
      if (!found) {
        if (id === partner.sparkId) {
          // check if partner session is still in same game
          // relevant if multiple browser tabs do different things
          const partnerSid = extractSid(spk.headers.cookie);
          const jPartnerSession = syncSession(partnerSid, sStore);
          if (jPartnerSession.gameStateId === gameStateId) {
            found = true;
          } else {
            resetSessionToUnpaired(partnerSid, sStore);
            partner.spark.write({ msg: 'Other player has left the game, click "New Game"' });
          }
        }
      }
    });
    if (found) {
      const requester = state[reqSid];
      const ownturn = state.turn === reqSid;
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
    const dataCopy = {};
    dataCopy.role = requester.role;
    dataCopy.txt = data.txt;
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
        uniqueLeft: Array.from(requester.unique)
          .filter(val => requester.board.has(val)),
      },
      [partner.role]: {
        board: Array.from(partner.board),
        uniqueLeft: Array.from(partner.unique)
          .filter(val => partner.board.has(val)),
      },
      extras: state.extrasAvailable,
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
      extraSelectBy: state[requester.sessionId].role,
      extraSelected: state[requester.sessionId].extraSelected,
    }
  );

  const registerClick = (state, requester, partner, id, selected) => {
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
    partner.spark.write({ updSelLeft: stateToUpdate.selectionsLeft });
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
        joker: state.extrasAvailable.joker,
      },
      uniqueLeftA: getUniqueLeft(state, state.playerA),
      uniqueLeftB: getUniqueLeft(state, state.playerB),
    }
  );

  /** sends the current game state to the players and writes to the log file */
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

  function calculateIncreasedSelections() {
    return Math.ceil(1.3 * paramSelections);
  }

  function calculateScore(state, unqLeftNow) {
    if (unqLeftNow === 0) {
      return 0;
    }
    // roughly estimating impact of unused extras as fraction of saved turns
    const boardSize = (paramNumUnique + paramNumCommon);
    // joker saves one of the selections from the share of common pieces
    const jokerAdjust = jokerSize / paramSelections * paramNumCommon / boardSize;
    // using undo means giving up extra selects
    const incSelectAdjust = calculateIncreasedSelections() / paramSelections;
    // undo saves the share of the unique pieces
    const undoAdjust = incSelectAdjust * paramNumUnique / boardSize;
    const adjustedTurnCount = state.turnCount
      // TODO recheck if we should deduct a full turn if undo has been used
      - (paramUndo && !state.extrasAvailable.undoUsed ? undoAdjust : 1)
      - (paramJoker && !state.extrasAvailable.jokerUsed ? jokerAdjust : 0);
    // the turnratio can be < 1 not only because of unused extras
    // but also because increased selections saved turns
    // but then the quality score will also be < 1
    const baseTurnNumber = Math.ceil(paramNumCommon / paramSelections);
    const turnRatio = adjustedTurnCount / baseTurnNumber;
    // at least some common images must be left, avoiding div by 0 for score
    const qualityScore = unqLeftNow / (2 * paramNumUnique);
    const score = 100 * Math.exp(-1.5 * (turnRatio / qualityScore - 1));
    return Math.floor(score);
  }


  // ends requesters turn in session store
  // assumes that the partner connection has been checked
  const endTurn = (state, partner, requester, ownTurn) => {
    if (!ownTurn) {
      logger.warn(`ending turn by ${requester.sessionId} in game ${state.id} not allowed`);
      return;
    }
    if (state.selectionsLeft < 0) {
      writeMsg(requester.spark, 'Please choose less!');
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

    // clear current turn data
    stateToUpdate.previousSelection = new Set(state.currentSelection);
    stateToUpdate.currentSelection.clear();
    stateToUpdate.turnCount += 1;
    // reset player choices in case extra selection has not been agreed upon
    stateToUpdate.playerA.extraSelected = '';
    stateToUpdate.playerB.extraSelected = '';


    // calculate the number of shared images left
    const commonLeftNow = getCommonLeft(stateToUpdate);
    // calculate unique images lost in this turn
    const playerAUqLeftNow = getUniqueLeft(stateToUpdate, stateToUpdate.playerA);
    const playerBUqLeftNow = getUniqueLeft(stateToUpdate, stateToUpdate.playerB);
    const unqLeftNow = playerAUqLeftNow + playerBUqLeftNow;

    if (commonLeftNow === 0 || unqLeftNow === 0) {
      // game ends
      stateToUpdate.isEnded = true;
      // prepare final log entry
      stateToUpdate.turn = null;
      gameStates.set(state.id, stateToUpdate);

      // calculate score
      const score = calculateScore(state, unqLeftNow);
      const logData = getGameData(stateToUpdate, requester, partner);
      logData.score = score;
      writeLog(state.id, logData);

      // information for players
      let explanation = `After ${stateToUpdate.turnCount} turns ${unqLeftNow} unique images are left,`;
      if (paramUndo) {
        explanation += ` Undo has${!state.extrasAvailable.undoUsed ? ' not' : ''} been used.`;
      }
      if (paramJoker) {
        explanation += ` Joker has${!state.extrasAvailable.jokerUsed ? ' not' : ''} been used.`;
      }

      const dataReq = {
        ended: true,
        board: Array.from(state[requester.sessionId].unique),
        score,
        expl: explanation,
      };
      const dataPartner = {
        ended: true,
        board: Array.from(state[partner.sessionId].unique),
        score,
        expl: explanation,
      };
      requester.spark.write(dataReq);
      partner.spark.write(dataPartner);
      return;
    }

    // if game not ended update number selections for next turn
    const upExtrasAvail = stateToUpdate.extrasAvailable;
    if (unqLeftPrevious - unqLeftNow > 0) {
      // increase available selections
      const increasedSelection = calculateIncreasedSelections();
      stateToUpdate.selectionsLeft = commonLeftNow < increasedSelection
        ? commonLeftNow : increasedSelection;
      writeMsg(requester.spark, 'Removed an unique image - extra Selections available in this turn.');
      writeMsg(partner.spark, 'Removed an unique image - extra Selections available in this turn.');
    } else {
      stateToUpdate.selectionsLeft = commonLeftNow < paramSelections
        ? commonLeftNow : paramSelections;
    }

    if (jokerSize < stateToUpdate.selectionsLeft
      && paramJoker && !upExtrasAvail.jokerUsed) {
      upExtrasAvail.joker = true;
    } else {
      upExtrasAvail.joker = false;
    }
    if (stateToUpdate.turnCount > 0
      && paramUndo && !upExtrasAvail.undoUsed) {
      upExtrasAvail.undo = true;
    }
    stateToUpdate.extrasAvailable = upExtrasAvail;

    // switch player
    stateToUpdate.turn = partner.sessionId;

    gameStates.set(state.id, stateToUpdate);
    broadcastTurn(stateToUpdate, requester, partner);
  };


  /** handle extra choice of players, which occurs during a turn */
  const applyExtra = (state, partner, requester, extra) => {
    // save selection
    const stateToUpdate = gameStates.get(state.id);
    const reqSelected = stateToUpdate[requester.sessionId];
    if (extra.undo && paramUndo && !state.extrasAvailable.undoUsed) {
      reqSelected.extraSelected = 'undo';
      writeMsg(partner.spark, 'Other player chooses "Undo"');
    } else if (extra.joker && paramJoker && !state.extrasAvailable.jokerUsed) {
      reqSelected.extraSelected = 'joker';
      writeMsg(partner.spark, 'Other player chooses "Joker"');
    } else {
      reqSelected.extraSelected = '';
      writeMsg(partner.spark, 'Other player not choosing extra any longer.');
    }
    partner.spark.write({ updExtras: true, extra });
    gameStates.set(state.id, stateToUpdate);
    // make a copy so that further changes to game state don't get logged now
    const shortGData = Object.assign({}, getShortGameData(stateToUpdate, requester, partner));
    writeLog(state.id, shortGData);

    // check for agreement
    if (stateToUpdate[partner.sessionId].extraSelected === '') {
      return;
    }
    if (stateToUpdate[partner.sessionId].extraSelected !== reqSelected.extraSelected) {
      writeMsg(requester.spark, 'No agreement on extra action.');
      writeMsg(partner.spark, 'No agreement on extra action.');
      return;
    }

    const upExtrasAvail = stateToUpdate.extrasAvailable;
    if (reqSelected.extraSelected === 'undo') {
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
      upExtrasAvail.undo = false;
      upExtrasAvail.undoUsed = true;
      // update the remaining selections to the value without extra selections
      const commonLeftNow = getCommonLeft(stateToUpdate);
      stateToUpdate.selectionsLeft = commonLeftNow < paramSelections
        ? commonLeftNow : paramSelections;
      stateToUpdate.selectionsLeft -= state.currentSelection.size;

      // check if joker is available again
      if (paramJoker && !upExtrasAvail.jokerUsed
        && jokerSize < stateToUpdate.selectionsLeft) {
        upExtrasAvail.joker = true;
      } else {
        upExtrasAvail.joker = false;
      }
    } else {
      // joker
      let removed = 0;
      let curSelRemoved = 0;
      // remove jokerSize common images from the boards and selection.
      // extra action should only be available if there are enough images
      // to remove left
      state.common.forEach((val) => {
        if (removed < jokerSize) {
          if (stateToUpdate[requester.sessionId].board.delete(val)) {
            removed += 1;
          }
          if (stateToUpdate.currentSelection.delete(val)) {
            curSelRemoved += 1;
          }
          stateToUpdate[partner.sessionId].board.delete(val);
        }
      });

      stateToUpdate.selectionsLeft -= curSelRemoved;
      upExtrasAvail.joker = false;
      upExtrasAvail.jokerUsed = true;
    }

    stateToUpdate.extrasAvailable = upExtrasAvail;
    // reset extra actions
    stateToUpdate[state.playerA].extraSelected = '';
    stateToUpdate[state.playerB].extraSelected = '';

    gameStates.set(state.id, stateToUpdate);
    broadcastTurn(stateToUpdate, requester, partner);
  };

  // ====================================================== connection handler

  const connectionHandler = (spark, sessionStore) => {
    // we use the browser session to identify a user
    // expiration of session can be configured in the properties
    // a user session can span multiple sparks (websocket connections)
    const requesterSid = extractSid(spark.headers.cookie);
    if (requesterSid == null) {
      logger.info('connection without cookie');
      writeMsg(spark, 'Please allow cookies.');
      return;
    }
    const jRequesterSession = syncSession(requesterSid, sessionStore);
    // logger.info('new connection');

    if (jRequesterSession.gameStateId === 'NOGAME') {
      // new connection or server restart
      // going to find new partner
      writeMsg(spark, 'Welcome! Finding other player ...');
    } else {
      // unexpired session connecting again
      // going to check if former partner is still there
      writeMsg(spark, 'Welcome back! Trying to find previous other player, click "New Game" if taking too long.');
    }

    // try to find a partner and set up game
    const { newOrExist, gameState } = findPartnerCheckConnection(spark, requesterSid,
      jRequesterSession, sessionStore);

    if (gameState != null) {
      // it's a match
      const partner = getPartner(requesterSid, gameState);
      const requester = gameState[requesterSid];
      writeMsg(requester.spark, `Found ${newOrExist} teammate.`);
      writeMsg(partner.spark, `Found ${newOrExist} teammate.`);
      // initialize clients
      broadcastTurn(gameState, requester, partner);
    } else {
      // no partner found yet
      writeMsg(spark, 'Waiting for other player...');
    }

    // ====================================================== handler incoming requests

    spark.on('data', (packet) => {
      if (!packet) return;

      const reqSid = extractSid(spark.headers.cookie);

      // check if partner still available
      const {
        state, partner, requester, ownturn,
      } = checkPartnerGetState(spark, reqSid, sessionStore);

      if (state === 'NOGAME') {
        // game reset by partner
        writeMsg(spark, 'Click "New Game"');
      } else if (state === 'partnerdisconnected') {
        const data = JSON.parse(packet);
        if (data.reset !== undefined) {
          // the second player wants to leave the game
          logger.info(`resetting partner ${reqSid}`);
          const jSession = syncSession(reqSid, sessionStore);
          gameStates.del(jSession.gameStateId);
          resetSessionToUnpaired(reqSid, sessionStore);
          writeMsg(spark, 'Game has been left.');
        } else {
          writeMsg(spark, 'Can\'t reach other player, wait or click "New Game"');
        }
      } else if (state === 'reset') {
        // handled in checkPartnerGetState(), mentioned here to cover all possible return values
      } else {
        const data = JSON.parse(packet);
        if (data.reset !== undefined) {
          // the first player wants to leave the game
          logger.info(`resetting pair ${state.id}`);
          writeLog(state.id, { resetBy: requester.role });
          gameStates.del(state.id);
          resetSessionToUnpaired(requester.sessionId, sessionStore);
          writeMsg(spark, 'Game has been left.');
          spark.end();
          writeMsg(partner.spark, 'Other player has left the game, click "New Game"');
        }
        if (state.isEnded) {
          writeMsg(spark, 'Game ended. Click below for new or other game.');
          return;
        }
        // here we evaluate the type of message
        if (data.txt !== undefined) {
          broadcastMessage(state, requester, partner, data);
        } else if (data.act !== undefined) {
          if (data.act === 'click') {
            registerClick(state, requester, partner, data.id, data.selected);
          } else if (data.act === 'extra') {
            applyExtra(state, partner, requester, data.extra);
          } else if (data.act === 'typing') {
            partner.spark.write({ typing: true, role: requester.role });
          }
        } else if (data.endturn !== undefined) {
          endTurn(state, partner, requester, ownturn);
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
