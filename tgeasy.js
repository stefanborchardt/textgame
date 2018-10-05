// configure base game
const options = {
  directory: 'te',
  paramSetSize: 30,
  paramNumCommon: 7,
  paramNumUnique: 2,
  paramUndos: 0,
  paramSelections: 3,
  paramGameName: 'L5-test-other30',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
