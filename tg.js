const gameUndos = 2;
const gameSelections = 5;

// configure base game
const g = require('./tgame')('tg', 500, 39, 10, gameUndos, gameSelections);

// provide shorthands for frequently used functions
const { logger, gameStates, writeMsg } = g;

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
  stateToUpdate.selectionsLeft = gameSelections;

  stateToUpdate.previousSelection = state.currentSelection;
  stateToUpdate.currentSelection.clear();
  stateToUpdate.turnCount += 1;
  stateToUpdate.turn = partner.sessionId;

  gameStates.set(state.id, stateToUpdate);
  g.writeLog(state.id, g.getGameData(stateToUpdate, requester, partner, !ownTurn));
  g.broadcastTurn(stateToUpdate, requester, partner, !ownTurn);
};

// ====================================================== connection handler

// hand sessionStore and implementation of endTurn() to base game
module.exports = sessionStore => (spark => g.connectionHandler(spark, endTurn, sessionStore));
