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


// further app configuration setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', config.get('https.port'));
app.use(express.json());
app.use(express.urlencoded({
  extended: false,
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());

// for authentication we use a session cookie
const maxAge = parseInt(config.get('cookie.maxage'), 10);
const sessionStore = new MemoryStore({
  checkPeriod: 1.1 * maxAge, // prune expired entries
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

const primusFirst = new Primus(server, {
  transformer: 'websockets',
  pathname: '/te',
  parser: 'json',
});

const firstSocket = require('./tgfirst')(app, sessionStore.store);
// this way sessionStore is available to tgSocket
// so that websocket and http sessions can be matched
primusFirst.on('connection', firstSocket);
// enable once for client JS creation:
// primusFirst.save('public/external/primusfirst.js');

const primusSecond = new Primus(server, {
  transformer: 'websockets',
  pathname: '/tm',
  parser: 'json',
});
const secondSocket = require('./tgsecond')(app, sessionStore.store);

primusSecond.on('connection', secondSocket);
// primusSecond.save('public/external/primussecond.js');

const primusStage = new Primus(server, {
  transformer: 'websockets',
  pathname: '/th',
  parser: 'json',
});
const stageSocket = require('./tgstage')(app, sessionStore.store);

primusStage.on('connection', stageSocket);
// primusStage.save('public/external/primusstage.js');

// ################## images

const serveImages = require('./routes/images')(path.join(__dirname, 'public'));

app.use('/img', serveImages);

// ################## middleware for resetting player's game participation

// refresh or entering or clicking an url will leave the current game
// maybe deactivate for developemt
const resetGame = (req, res, next) => {
  req.session.gameStateId = 'NOGAME';
  next();
};
app.use('/', resetGame);

// ##################  routers for https connections
const firstRouter = require('./routes/first');
const secondRouter = require('./routes/second');
const stageRouter = require('./routes/stage');
const loginRouter = require('./routes/login');
const introRouter = require('./routes/intro');

app.use('/', loginRouter);
app.use('/intro', introRouter);
app.use('/level1', firstRouter);
app.use('/level2', secondRouter);
app.use('/stage', stageRouter);

// ##################  login
// when a game router detects an unauthenticated user it redirects
// to the login (=root) page. after sending the login form, we do a basic authentication here
app.post('/login', (req, res) => {
  let pwd = config.get('login.password');
  if (typeof pwd === 'number') {
    pwd = pwd.toString(10);
  }
  if (pwd === req.body.password) {
    // also see syncSession() in module tgbase
    req.session.loggedIn = true;
    // first page after login
    res.redirect('/intro');
  } else {
    res.redirect('/');
  }
});

// ################## error handlers
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
