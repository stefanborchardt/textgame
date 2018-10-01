const gParamCommon = 7;
const gParamUnique = 2;
const gParamUndos = 1;
const gParamSelections = 3;

// configure base game
const g = require('./tgame')('te',
  200, gParamCommon, gParamUnique, gParamUndos, gParamSelections);

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

  const unqLeftPrevious = g.getUniqueLeft(state, state.playerA)
    + g.getUniqueLeft(state, state.playerB);

  // remove selection from player boards
  const stateToUpdate = gameStates.get(state.id);
  state.currentSelection.forEach((val) => {
    stateToUpdate[requester.sessionId].board.delete(val);
    stateToUpdate[partner.sessionId].board.delete(val);
  });

  // calculate the number of shared images left
  const commonLeftNow = g.getCommonLeft(stateToUpdate);
  // calculate unique images lost in this turn
  const playerAUqLeftNow = g.getUniqueLeft(stateToUpdate, stateToUpdate.playerA);
  const playerBUqLeftNow = g.getUniqueLeft(stateToUpdate, stateToUpdate.playerB);
  const unqLeftNow = playerAUqLeftNow + playerBUqLeftNow;

  if (commonLeftNow === 0 || unqLeftNow === 0) {
    // game ends
    // broadcast end
    writeMsg(requester.spark, 'ENDE');

  }

  if (unqLeftPrevious - unqLeftNow > 0) {
    stateToUpdate.extras.incSelection = true;
    if (stateToUpdate.undosLeft > 0) {
      stateToUpdate.extras.undo = true;
    }
    writeMsg(requester.spark, 'Zusatzaktionen verfügbar. Zum aktivieren beide das gleiche auswählen.');
  } else {
    stateToUpdate.extras.incSelection = false;
    stateToUpdate.extras.undo = false;
  }

  // calculate number of selections for next turn
  stateToUpdate.selectionsLeft = commonLeftNow < gParamSelections ? commonLeftNow : gParamSelections;

  stateToUpdate.previousSelection = state.currentSelection;
  stateToUpdate.currentSelection.clear();
  stateToUpdate.turnCount += 1;
  stateToUpdate.turn = partner.sessionId;

  gameStates.set(state.id, stateToUpdate);
  g.writeLog(state.id, g.getGameData(stateToUpdate, requester, partner, !ownTurn));
  g.broadcastTurn(stateToUpdate, requester, partner, !ownTurn);
};

// ======================================================
// hand sessionStore and implementation of endTurn() to base game
module.exports = sessionStore => (spark => g.connectionHandler(spark, endTurn, sessionStore));
