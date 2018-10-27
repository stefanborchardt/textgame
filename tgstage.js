const path = require('path');

// configure base game
const options = {
  directory: 'stage',
  paramSetSize: 16,
  paramNumCommon: 0, // set in createInitialState()
  paramNumUnique: 0, // set in createInitialState()
  paramUndo: false,
  paramJoker: false,
  paramSelections: 1,
  paramGameName: 'stage:restaurant',
};

const getImageMapping = () => {
  const mapping = {
    for: options.paramGameName,
    100: path.join('r', 'address.png'),
    101: path.join('r', 'day', 'fri.jpg'),
    102: path.join('r', 'day', 'mon.jpg'),
    103: path.join('r', 'day', 'sat.jpg'),
    104: path.join('r', 'time', 'afternoon.png'),
    105: path.join('r', 'time', 'evening.png'),
    106: path.join('r', 'time', 'noon.jpg'),
    107: path.join('r', 'table', 'two.jpg'),
    108: path.join('r', 'table', 'four.jpg'),
    109: path.join('r', 'table', 'six.jpg'),
    110: path.join('r', 'special', 'alcohol', 'noalcohol.jpg'),
    111: path.join('r', 'special', 'alcohol', 'alcohol.png'),
    112: path.join('r', 'special', 'noise', 'loud.png'),
    113: path.join('r', 'special', 'noise', 'quiet.png'),
    114: path.join('r', 'special', 'diet', 'nowheat.jpg'),
    115: path.join('r', 'special', 'diet', 'veg.jpg'),
  };
  return mapping;
};

/** return random number (string) between lower and upper inclusive */
const rndm = (lower, upper) => (Math.floor(Math.random() * (upper - lower + 1)) + lower).toString();
/** return two random numbers (array of string) between lower and upper inclusive */
const twoRndm = (lower, upper) => {
  const two = new Set();
  while (two.size < 2) {
    // photo file names 100..999
    two.add(rndm(lower, upper));
  }
  return Array.from(two);
};

/** Shuffles array in place */
const shuffle = (a) => {
  const r = a;
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

const flatten = arr => arr.reduce(
  (a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [],
);

const createInitialState = () => {
  const buildBoardA = flatten(['100', // address
    twoRndm(101, 103), // 2 days
    twoRndm(104, 106), // 2 times
    rndm(107, 109), // 1 table
    rndm(110, 111), rndm(112, 113), rndm(114, 115)]); // 3 specials

  const buildBoardB = flatten(['100', // address
    twoRndm(101, 103), // 2 days
    rndm(104, 106), // 1 time
    twoRndm(107, 109), // 2 tables
    rndm(110, 111), rndm(112, 113), rndm(114, 115)]); // 3 specials

  const common = buildBoardA.filter(val => buildBoardB.includes(val));
  options.paramNumCommon = common.length;
  options.paramNumUnique = 9 - common.length;
  const uniqueA = buildBoardA.filter(val => !common.includes(val));
  const uniqueB = buildBoardB.filter(val => !common.includes(val));

  // visible to respective player:
  const boardA = shuffle(buildBoardA);
  const boardB = shuffle(buildBoardB);

  return {
    A: new Set(boardA),
    B: new Set(boardB),
    common: new Set(common),
    uniqueA: new Set(uniqueA),
    uniqueB: new Set(uniqueB),
  };
};

const g = require('./tgbase')(options);
// ======================================================
// hand sessionStore and game custom implementations of functions to base game
module.exports = (app, sessionStore) => {
  const imageMap = getImageMapping();
  app.set(options.directory, imageMap);
  // spark => g.connectionHandler(spark, sessionStore)
  return spark => g.connectionHandler(spark, sessionStore, imageMap, createInitialState);
};
