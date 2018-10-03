// configure base game
const options = {
  directory: 'tm',
  paramSetSize: 200,
  paramNumCommon: 20,
  paramNumUnique: 5,
  paramUndos: 3,
  paramSelections: 4,
  paramGameName: 'L5-train-flowers200',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
