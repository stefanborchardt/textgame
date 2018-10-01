// base module
const g = require('./tgame')('tg');

// provide shorthands for frequently used functions
const { logger, gameStates, writeMsg } = g;

const SET_SIZE = 39;
const NUM_UNIQUE = 10;
const UNDOS = 3;
const SELECTIONS = 5;

/** TODO */
function createInitialState() {
  // first digit of photo indicates category
  const allImages = new Set();
  while (allImages.size < (SET_SIZE + 2 * NUM_UNIQUE)) {
    // photo file names 100..599
    allImages.add(Math.floor(Math.random() * 500 + 100).toString());
  }

  // game state will be stored as sets,
  // arrays used for indexed access and shuffling
  const allImagesArray = Array.from(allImages);
  // hidden from players:
  const common = allImagesArray.slice(0, SET_SIZE);
  const uniqueA = allImagesArray.slice(SET_SIZE, SET_SIZE + NUM_UNIQUE);
  const uniqueB = allImagesArray.slice(SET_SIZE + NUM_UNIQUE,
    SET_SIZE + 2 * NUM_UNIQUE);
  // visible to respective player:
  const boardA = g.shuffle(common.concat(uniqueA));
  const boardB = g.shuffle(common.concat(uniqueB));

  return {
    A: new Set(boardA),
    B: new Set(boardB),
    common: new Set(common),
    uniqueA: new Set(uniqueA),
    uniqueB: new Set(uniqueB),
  };
}

// ======================================================

/** finds another user without partner or the former partner and
 * initialises the game state */
function findPartnerCheckConnection(spk, reqSid, jRequester, sStore) {
  let gameState = null;
  const gameStateId = jRequester.pairedWith;
  // iterate sessions
  sStore.rforEach((session, sessId) => {
    if (gameState == null) {
      const jPartner = JSON.parse(session);
      // an other session that is not paired or is paired with requester
      if (sessId !== reqSid && jPartner.pairedWith === gameStateId) {
        // found unpaired or former partner, check if connected
        const foundPartnerSpark = g.findPartnerSpark(spk, sessId);
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
              g.resetSessionToUnpaired(reqSid, sStore);
              g.resetSessionToUnpaired(sessId, sStore);
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
            const logName = g.getLogname(reqSid, sessId);
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
              name: 'L5-test-5x100',
              common: initialBoard.common,
              turn: reqSid,
              turnCount: 0,
              undosLeft: UNDOS,
              selectionsLeft: SELECTIONS,
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
          sStore.set(sessId, JSON.stringify(jPartner), g.maxAge);
          sStore.set(reqSid, JSON.stringify(jRequesterCopy), g.maxAge);
        } else {
          // former partner not connected
        }
      } else {
        // this session is not available as partner
      }
    }
  });
  return gameState;
}

// ends requesters turn in session store
// assumes that the partner connection has been checked
function endTurn(state, partner, requester, ownTurn) {
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

  const stateToUpdate = gameStates.get(state.id);
  const unqLeftPrevious = g.getUniqueLeft(state, state.playerA)
    + g.getUniqueLeft(state, state.playerB);
  // remove selection from player boards
  state.currentSelection.forEach((val) => {
    stateToUpdate[requester.sessionId].board.delete(val);
    stateToUpdate[partner.sessionId].board.delete(val);
  });
  const playerAUqLeftNow = g.getUniqueLeft(stateToUpdate, stateToUpdate.playerA);
  const playerBUqLeftNow = g.getUniqueLeft(stateToUpdate, stateToUpdate.playerB);
  // calculate unique images lost in this turn
  const unqLeftNow = playerAUqLeftNow + playerBUqLeftNow;
  if (unqLeftPrevious - unqLeftNow > 0) {
    stateToUpdate.extras.incSelection = true;
    if (stateToUpdate.undosLeft > 0) {
      stateToUpdate.extras.undo = true;
    }
    writeMsg(requester.spark, 'Zusatzaktionen verfügbar. Zum aktivieren bei das gleiche auswählen.');
  } else {
    stateToUpdate.extras.incSelection = false;
    stateToUpdate.extras.undo = false;
  }
  // TODO calculate remaining selection with respect to board size
  stateToUpdate.selectionsLeft = SELECTIONS;

  stateToUpdate.previousSelection = state.currentSelection;
  stateToUpdate.currentSelection.clear();
  stateToUpdate.turnCount += 1;
  stateToUpdate.turn = partner.sessionId;

  gameStates.set(state.id, stateToUpdate);
  g.writeLog(state.id, g.getGameData(stateToUpdate, requester, partner, !ownTurn));
  g.broadcastTurn(stateToUpdate, requester, partner, !ownTurn);
}

// ====================================================== handler pair establishment

const tg = function connection(spark) {
  // we have the sessionStore as 'this.store'
  const sessionStore = this.store;
  // we use the browser session to identify a user
  // expiration of session can be configured in the properties
  // a user session can span multiple sparks (websocket connections)
  const requesterSid = g.extractSid(spark.headers.cookie);
  if (requesterSid == null) {
    logger.info('connection without cookie');
    writeMsg(spark, 'Cookies bitte zulassen.');
    return;
  }
  const jRequesterSession = JSON.parse(g.syncSession(requesterSid, sessionStore));

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
    const partner = g.getPartner(requesterSid, gameState);
    const requester = gameState[requesterSid];
    writeMsg(requester.spark, 'Mitspieler gefunden.');
    writeMsg(partner.spark, 'Mitspieler gefunden.');
    // initialize client boards
    g.broadcastTurn(gameState, requester, partner, gameState.turn === requesterSid);
  } else {
    // no partner found yet
    writeMsg(spark, 'Warten auf Mitspieler...');
  }

  // ====================================================== handler incoming requests

  spark.on('data', (packet) => {
    if (!packet) return;

    const reqSid = g.extractSid(spark.headers.cookie);

    const {
      state, partner, requester, ownturn,
    } = g.checkPartnerGetState(spark, reqSid, sessionStore);

    if (state === 'noone') {
      // game reset by partner
      logger.warn(`resetting partner ${reqSid}`);
      writeMsg(spark, 'UNPAIRED PARTNER COMMUNICATING');
    } else if (state === 'partnerdisconnected') {
      const data = JSON.parse(packet);
      if (data.reset !== undefined) {
        logger.info(`resetting partner ${reqSid}`);
        const jSession = JSON.parse(g.syncSession(reqSid, sessionStore));
        gameStates.del(jSession.pairedWith);
        g.resetSessionToUnpaired(reqSid, sessionStore);
        writeMsg(spark, 'Spiel wurde verlassen.');
      } else {
        writeMsg(spark, 'Mitspieler nicht erreichbar, warten oder "Neuer Partner" klicken');
      }
    } else if (state === 'reset') {
      // handled in checkPartnerGetState()
    } else {
      const data = JSON.parse(packet);

      if (data.txt !== undefined) {
        g.broadcastMessage(state, requester, partner, data);
      } else if (data.act !== undefined) {
        if (data.act === 'click') {
          g.registerClick(state, requester, partner, ownturn, data.id, data.selected);
        }
      } else if (data.endturn !== undefined) {
        endTurn(state, partner, requester, ownturn);
      } else if (data.reset !== undefined) {
        logger.info(`resetting pair ${state.id}`);
        g.writeLog(state.id, { resetBy: requester.role });
        gameStates.del(state.id);
        g.resetSessionToUnpaired(requester.sessionId, sessionStore);
        writeMsg(spark, 'Spiel wurde verlassen.');
        spark.end();
        writeMsg(partner.spark, 'Mitspieler hat das Spiel verlassen, ggf. "Neuer Partner" klicken');
      } else if (data.msg !== undefined) {
        // TODO
      }
    }
  });

  spark.on('open', (_packet) => {
    writeMsg(spark, 'sp_open');
  });
  spark.on('end', () => {
    writeMsg(spark, 'sp_end');
  });
  spark.on('close', () => {
    writeMsg(spark, 'sp_close');
  });
};

module.exports = tg;
