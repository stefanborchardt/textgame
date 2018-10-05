// configure base game
const options = {
  directory: 'th',
  paramSetSize: 80,
  paramNumCommon: 20,
  paramNumUnique: 5,
  paramUndos: 3,
  paramSelections: 4,
  paramGameName: 'L5-train-2x40',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
