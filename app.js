const express = require('express');
const helmet = require('helmet')
const path = require('path');
const session = require('express-session');
const MemoryStore = require('memorystore')(session)
const Primus = require('primus');
const config = require('config')
const https = require('https');
const fs = require('fs');

/**
 * The app.
 */
var app = express();

/**
 * Create HTTPS server.
 */
const options = {
	cert: fs.readFileSync(config.get('ssl.certificate')),
	key: fs.readFileSync(config.get('ssl.key')),
	rejectUnauthorized: false
};
const server = https.createServer(options, app);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', config.get('https.port'));
app.use(express.json());
app.use(express.urlencoded({
	extended: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());

// for authentication we use a session cookie with an TTL of 1 hour
const sessionStore = new MemoryStore({
	checkPeriod: 2 * 3600000 // prune expired entries every 2h
});
app.use(session({
	resave: false, // don't save session if unmodified
	saveUninitialized: false, // don't create session until something stored
	secret: config.get('session.secret'),
	cookie: {
		secure: true,
		maxAge: 3600000,
		sameSite: 'strict'
	},
	store: sessionStore
}));

/**
 * Create Primus websocket
 */
const primus = new Primus(server, {
	transformer: 'websockets',
	pathname: '/tg',
	parser: 'json'
});

const tgSocket = require('./routes/tg');
// this way sessionStore is available to tgSocket 
// so that websocket and http sessions can be matched
primus.on('connection', tgSocket, sessionStore);
// enable once for client JS creation
// primus.save("public/javascripts/primus.js");

const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
app.use('/', indexRouter);
app.use('/login', loginRouter);

// when the index router detects an unauthenticated user it redirects 
// to the login page. after sending the login form, we do a basic authentication here
app.post('/login', function(req, res) {
	if (config.get('login.password') == req.body.pwd) {
		req.session.regenerate(function() {
			req.session.user = 'yes'; // so that session will be kept in store
			res.redirect('/');
		});
	} else {
		res.redirect('/login');
	}
});

// no router found, 404 and forward to error handler
app.use(function(req, res, next) {
	res.sendStatus(404);
});

// error handler
app.use(function(err, req, res, next) {
	res.sendStatus(err.status || 500);
});

module.exports = {
	app: app,
	server: server,
	config: config
};