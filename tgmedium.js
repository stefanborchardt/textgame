// configure base game
const options = {
  directory: 'tm',
  paramSetSize: 75,
  paramNumCommon: 12,
  paramNumUnique: 4,
  paramUndos: 3,
  paramSelections: 2,
  paramGameName: 'L5-train-flowers75',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
