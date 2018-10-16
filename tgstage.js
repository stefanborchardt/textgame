const path = require('path');

// configure base game
const options = {
  directory: 'stage',
  paramSetSize: 300,
  paramNumCommon: 10,
  paramNumUnique: 6,
  paramUndo: false,
  paramJoker: false,
  paramSelections: 1,
  paramGameName: 'second:L5-train-100xFlower600Dog500Berry450',
};

const g = require('./tgbase')(options);

const getImageMapping = () => {
  const mapping = {
    for: options.paramGameName,
  };
  for (let i = 100; i < 200; i += 1) {
    mapping[i] = path.join('flower', `${i + 500}_256.jpg`);
  }
  for (let i = 200; i < 300; i += 1) {
    mapping[i] = path.join('dog', `${i + 300}_256.jpg`);
  }
  for (let i = 300; i < 400; i += 1) {
    mapping[i] = path.join('berry', `${i + 150}_256.jpg`);
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
