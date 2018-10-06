// configure base game
const g = require('./tgbase')({
  directory: 'tg',
  paramSetSize: 500,
  paramNumCommon: 39,
  paramNumUnique: 10,
  paramUndo: true,
  paramJoker: true,
  paramSelections: 5,
  paramGameName: 'L5-test-5x100',
});

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
