var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var reqLogger = require('morgan');

var Primus = require('primus');


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
	cert: fs.readFileSync('./sslcert/textga.me_ssl_certificate.cer'),
	key: fs.readFileSync('./sslcert/textga.me_private_key.key'),
	rejectUnauthorized: false
};

var server = https.createServer(options, app);
logger.info('server');

/**
 * Create Websocket server.
 */
// var webSocket = require('ws');
// var wsServer = new webSocket.Server({
// 	server
// });

primus = new Primus(server, {
	transformer: 'websockets',
	pathname: '/tg',
	parser: 'json'
});

//primus.save("public/javascripts/primus.js");

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', 3000);

app.use(reqLogger('dev'));
app.use(express.json());
app.use(express.urlencoded({
	extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// simple ws
primus.on('connection', function connection(spark) {
 logger.info('new connection');

  spark.on('data', function data(packet) {
  	logger.info('incoming:', packet);
    spark.write('*');
  });
  spark.write('Hello world');
});


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
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
	server: server
};