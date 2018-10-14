// configure base game
const options = {
  directory: 'second',
  paramSetSize: 75,
  paramNumCommon: 19,
  paramNumUnique: 6,
  paramUndo: true,
  paramJoker: true,
  paramSelections: 3,
  paramGameName: 'L5-train-DogBirdBerry75',
};

const g = require('./tgbase')(options);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
