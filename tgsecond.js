// configure base game
const options = {
  directory: 'second',
  paramSetSize: 30,
  paramNumCommon: 7,
  paramNumUnique: 2,
  paramUndo: true,
  paramJoker: false,
  paramSelections: 2,
  paramGameName: 'L5-train-flowers30',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
