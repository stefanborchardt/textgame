// configure base game
const g = require('./tgbase')(
  'tm', 200, 20, 5, 2, 4, 'L5-train-1x200',
);

// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = sessionStore => (
  spark => g.connectionHandler(spark, sessionStore)
  // spark => g.connectionHandler(spark, endTurn, applyExtra, sessionStore)
);
