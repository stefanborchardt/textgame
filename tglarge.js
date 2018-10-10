// configure base game
const g = require('./tgbase')({
  directory: 'tg',
  paramSetSize: 500,
  paramNumCommon: 24,
  paramNumUnique: 12,
  paramUndo: true,
  paramJoker: true,
  paramSelections: 3,
  paramGameName: 'L5-test-5x100',
});

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
