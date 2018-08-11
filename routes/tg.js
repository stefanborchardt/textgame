const winston = require('winston');



const logger = winston.createLogger({
	transports: [
		new winston.transports.File({
			filename: 'logs/combined.log'
		})
	]
});

// const userStore = new memStore({
// 	checkPeriod: 2 * 3600000 // prune expired entries every 2h
// });


// Extract session ID from the cookie string
function extractSid(cookie) {
	let indexEq = cookie.indexOf('=');
	let indexDot = cookie.indexOf('.', indexEq);
	return cookie.substring(indexEq + 5, indexDot);
}


//======================================================

var tg = function connection(spark) {
	let reqSid = extractSid(spark.headers.cookie)

	// we have the sessionStore as store  
	let storedSid = this.store.get(reqSid);

	if (undefined == storedSid) {
		// client with old sessionid reconnecting 
		// close connection
		spark.end();
		return;
	}

	var obj = JSON.parse(storedSid).user;
	
	spark.write({
		msg: 'welcome',
		sid: reqSid
	});

	spark.on('data', function data(packet) {
		if (!packet) return;
		let data = JSON.parse(packet);

		if (data.hasOwnProperty('txt')) {
			spark.write({
				txt: data.txt,
				sid: reqSid
			});
		} else if (data.hasOwnProperty('msg')) {

		}

	});



	// spark.on('open', function data(packet) {
	// 	debugger;
	// });
	// spark.on('reconnect', function reconnect() {
	// 	debugger;
	// });
	// spark.on('online', function online() {
	// 	debugger;
	// });
	// spark.on('offline', function offline() {
	// 	debugger;
	// });
	// spark.on('error', function error(err) {
	// 	debugger;
	// });
	// spark.on('end', function end() {
	// 	debugger;
	// });
	// spark.on('close', function end() {
	// 	debugger;
	// });



}


module.exports = tg;