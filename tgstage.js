// configure base game
const options = {
  directory: 'stage',
  paramSetSize: 75,
  paramNumCommon: 20,
  paramNumUnique: 5,
  paramUndo: true,
  paramJoker: true,
  paramSelections: 4,
  paramGameName: 'L5-train-3x25',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
