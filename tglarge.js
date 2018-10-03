// configure base game
const options = {
  directory: 'tg',
  paramSetSize: 500,
  paramNumCommon: 39,
  paramNumUnique: 10,
  paramUndos: 3,
  paramSelections: 6,
  paramGameName: 'L5-test-5x100',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
