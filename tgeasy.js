// configure base game
const g = require('./tgbase')(
  'te', 200, 7, 2, 1, 3, 'L5-test-other200',
);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
