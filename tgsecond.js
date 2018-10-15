const path = require('path');

// configure base game
const options = {
  directory: 'second',
  paramSetSize: 75,
  paramNumCommon: 19,
  paramNumUnique: 6,
  paramUndo: true,
  paramJoker: true,
  paramSelections: 3,
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
  for (let i = 100; i < 125; i += 1) {
    mapping[i] = path.join('bird', `${i}_256.jpg`);
  }
  for (let i = 125; i < 150; i += 1) {
    mapping[i] = path.join('dog', `${i + 300}_256.jpg`);
  }
  for (let i = 150; i < 175; i += 1) {
    mapping[i] = path.join('berry', `${i + 350}_256.jpg`);
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
