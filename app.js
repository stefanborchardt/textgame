const express = require('express');
const helmet = require('helmet');
const path = require('path');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const Primus = require('primus');
const config = require('config');
const https = require('https');
const fs = require('fs');

/**
 * The app.
 */
const app = express();

/**
 * Create HTTPS server.
 */
const options = {
  cert: fs.readFileSync(config.get('ssl.certificate')),
  key: fs.readFileSync(config.get('ssl.key')),
  rejectUnauthorized: false,
};
const server = https.createServer(options, app);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', config.get('https.port'));
app.use(express.json());
app.use(express.urlencoded({
  extended: false,
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());

// for authentication we use a session cookie with an TTL of 1 hour
const maxAge = parseInt(config.get('cookie.maxage'), 10);
const sessionStore = new MemoryStore({
  checkPeriod: 2 * maxAge, // prune expired entries every 2h
});
app.use(session({
  resave: true, // websocket does not implement touch
  saveUninitialized: false,
  secret: config.get('session.secret'),
  cookie: {
    secure: true,
    maxAge,
    sameSite: 'strict',
  },
  store: sessionStore,
}));

// ###################### websockets

const primusLarge = new Primus(server, {
  transformer: 'websockets',
  pathname: '/tg',
  parser: 'json',
});

const largeSocket = require('./tglarge')(sessionStore.store);
// this way sessionStore is available to tgSocket
// so that websocket and http sessions can be matched
primusLarge.on('connection', largeSocket);
// enable once for client JS creation
// primusLarge.save('public/external/primuslarge.js');

const primusEasy = new Primus(server, {
  transformer: 'websockets',
  pathname: '/te',
  parser: 'json',
});

const easySocket = require('./tgeasy')(sessionStore.store);

primusEasy.on('connection', easySocket);
// enable once for client JS creation
// primusEasy.save('public/external/primuseasy.js');

const primusMedium = new Primus(server, {
  transformer: 'websockets',
  pathname: '/tm',
  parser: 'json',
});
const mediumSocket = require('./tgmedium')(sessionStore.store);

primusMedium.on('connection', mediumSocket);
// primusMedium.save('public/external/primusmedium.js');


const primusThree = new Primus(server, {
  transformer: 'websockets',
  pathname: '/th',
  parser: 'json',
});
const threeSocket = require('./tgthree')(sessionStore.store);

primusThree.on('connection', threeSocket);
// primusThree.save('public/external/primusthree.js');

// ##################  routers for https connections
const indexRouter = require('./routes/large');
const easyRouter = require('./routes/easy');
const mediumRouter = require('./routes/medium');
const threeRouter = require('./routes/three');
const loginRouter = require('./routes/login');

app.use('/', loginRouter);
app.use('/login', loginRouter);
app.use('/level1', easyRouter);
app.use('/level2', mediumRouter);
app.use('/level3', threeRouter);
app.use('/level4', indexRouter);

// when the index router detects an unauthenticated user it redirects
// to the login page. after sending the login form, we do a basic authentication here
app.post('/login', (req, res) => {
  let pwd = config.get('login.password');
  if (typeof pwd === 'number') {
    pwd = pwd.toString(10);
  }
  if (pwd === req.body.password) {
    req.session.pairedWith = 'noone';
    // first page after login
    res.redirect('/level1');
  } else {
    res.redirect('/login');
  }
});

// no router found, 404 and forward to error handler
app.use((_req, res) => {
  res.sendStatus(404);
});

// error handler
app.use((err, _req, res) => {
  res.sendStatus(err.status || 500);
});

module.exports = {
  app,
  server,
  config,
};
