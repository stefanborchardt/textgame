var createError = require('http-errors');
var express = require('express');
const helmet = require('helmet')
var path = require('path');
var reqLogger = require('morgan');
var session = require('express-session');
var MemoryStore = require('memorystore')(session)
var Primus = require('primus');
let config = require('config')
var winston = require('winston');
const logger = winston.createLogger({
	transports: [
		new winston.transports.File({
			filename: 'logs/combined.log'
		})
	]
});

/**
 * The app.
 */
var app = express();

/**
 * Create HTTPS server.
 */
var https = require('https');
const fs = require('fs');
const options = {
	cert: fs.readFileSync(config.get('ssl.certificate')),
	key: fs.readFileSync(config.get('ssl.key')),
	rejectUnauthorized: false
};
var server = https.createServer(options, app);

/**
 * Create Primus websocket
 */
primus = new Primus(server, {
	transformer: 'websockets',
	pathname: '/tg',
	parser: 'json'
});

// enable once for client JS creation
//primus.save("public/javascripts/primus.js");
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', config.get('https.port'));
app.use(reqLogger('dev'));
app.use(express.json());
app.use(express.urlencoded({
	extended: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());

// for authentication we use a session cookie with an TTL of 1 hour
app.use(session({
	resave: false, // don't save session if unmodified
	saveUninitialized: false, // don't create session until something stored
	secret: config.get('session.secret'),
	cookie: {
		secure: true,
		maxAge: 3600000,
		sameSite: 'strict'
	},
	store: new MemoryStore({
		checkPeriod: 2 * 3600000 // prune expired entries every 2h
	}),
}));

//===============================================================
// simple ws
primus.on('connection', function connection(spark) {
	logger.info('new connection');
	debugger;
	spark.on('data', function data(packet) {
		logger.info('incoming:', packet);
		spark.write('*');
	});
	spark.write('Hello world');
});
//===============================================================

var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
app.use('/', indexRouter);
app.use('/login', loginRouter);

// when the index router detects an unauthenticated user it redirects 
// to the login page. after sending the login form, we do a basic authentication here
app.post('/login', function(req, res) {
	logger.info(config.get('login.password'));
	if (config.get('login.password') == req.body.pwd) {
		req.session.regenerate(function() {
			req.session.user = 'yes';
			res.redirect('/');
		});
	} else {
		res.redirect('/login');
	}
});

// no router found, 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};
	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

module.exports = {
	app: app,
	server: server,
	config: config
};