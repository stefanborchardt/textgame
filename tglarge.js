// configure base game
const g = require('./tgbase')('tg', 500, 39, 10, 3, 6, 'L5-test-5x100');

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
