const path = require('path');

// configure base game
const options = {
  directory: 'first',
  paramSetSize: 30,
  paramNumCommon: 7,
  paramNumUnique: 2,
  paramUndo: true,
  paramJoker: false,
  paramSelections: 2,
  paramGameName: 'first:L5-train-flower500berry450',
};

const g = require('./tgbase')(options);

/** Map an image id from 100 to at least 100+paramSetSize to a file path.
 * This will be stored in the express application for use in routes/images
 * and be written to the beginning of the game log file */
const getImageMapping = () => {
  const mapping = {
    for: options.paramGameName,
  };
  for (let i = 100; i < 120; i += 1) {
    mapping[i] = path.join('flower', `${i + 400}_256.jpg`);
  }
  for (let i = 120; i < 130; i += 1) {
    mapping[i] = path.join('berry', `${i + 330}_256.jpg`);
  }
  return mapping;
};


// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = (app, sessionStore) => {
  const imageMap = getImageMapping();
  app.set(options.directory, imageMap);
  // spark => g.connectionHandler(spark, sessionStore)
  return spark => g.connectionHandler(spark, sessionStore, imageMap);
};
