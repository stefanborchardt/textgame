// configure base game
const options = {
  directory: 'te',
  paramSetSize: 200,
  paramNumCommon: 7,
  paramNumUnique: 2,
  paramUndos: 2,
  paramSelections: 3,
  paramGameName: 'L5-test-other200',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
