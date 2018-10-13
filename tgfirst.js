// configure base game
const options = {
  directory: 'first',
  paramSetSize: 30,
  paramNumCommon: 7,
  paramNumUnique: 2,
  paramUndo: true,
  paramJoker: false,
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
