const path = require('path');

// configure base game
const options = {
  directory: 'second',
  paramSetSize: 45,
  paramNumCommon: 11,
  paramNumUnique: 5,
  paramUndo: true,
  paramJoker: true,
  paramSelections: 2,
  paramGameName: 'second:L5-train-25xBird100Dog425Berry500',
};

const g = require('./tgbase')(options);

/** Map an image id from 100 to at least 100+paramSetSize to a file path.
 * This will be stored in the express application for use in routes/images
 * and be written to the beginning of the game log file */
const getImageMapping = () => {
  const mapping = {
    for: options.paramGameName,
  };
  for (let i = 100; i < 115; i += 1) {
    mapping[i] = path.join('bird', `${i}_256.jpg`);
  }
  for (let i = 115; i < 130; i += 1) {
    mapping[i] = path.join('dog', `${i + 310}_256.jpg`);
  }
  for (let i = 130; i < 145; i += 1) {
    mapping[i] = path.join('berry', `${i + 370}_256.jpg`);
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
