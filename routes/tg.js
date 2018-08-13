'use strict';

const config = require('config');
const maxAge = parseInt(config.get('cookie.maxage'));

const winston = require('winston');
// const logger = winston.createLogger({
// 	transports: [
// 		new winston.transports.File({
// 			filename: 'logs/combined.log'
// 		})
// 	]
// });

const crypto = require('crypto');


// Extract session ID from the cookie string
const extractSid = function(cookie) {
	if (undefined == cookie) {
		return null;
	}
	let indexEq = cookie.indexOf('=');
	let indexDot = cookie.indexOf('.', indexEq);
	return cookie.substring(indexEq + 5, indexDot);
}

// check sessionID against sessionStore and
// return 'noone' or SID of former partner
const syncSession = function(reqSid, sStore) {
	let storedSid = sStore.get(reqSid);
	if (undefined != storedSid) {
		return storedSid;
	}
	// client with old sessionid reconnecting 
	// after server restart
	// creating session store entry from sid
	sStore.set(reqSid, JSON.stringify({
		cookie: {
			originalMaxAge: maxAge,
			expires: new Date(Date.now() + maxAge).toISOString(),
			secure: true,
			httpOnly: true,
			path: "/",
			sameSite: "strict"
		},
		pairedWith: "noone"
	}), maxAge);
	return sStore.get(reqSid);

}

// find the spark for the partner session ID
const findPartnerSpark = function(sprk, partnerSid) {
	let partnerSpark = null;
	sprk.primus.forEach((spk, spkId, cons) => {
		if (null == partnerSpark) {
			if (spkId != sprk.id) {
				let otherSid = extractSid(spk.headers.cookie);
				if (partnerSid == otherSid) {
					partnerSpark = spk;
				}
			}
		}
	});
	return partnerSpark;
}

// finds another user without partner and 
// sets current requester as other user's partner
const findPartnerCheckConnection = function(spk, reqSid, jStrSid, sStore) {
	// iterate sessions
	let foundPartner = null;
	sStore.rforEach((session, sessId, cache) => {
		if (null == foundPartner) {
			let jSession = JSON.parse(session);
			let pw = jSession.pairedWith;
			if ("noone" == pw && reqSid != sessId) {
				// found unpaired session, check if connected
				let partnerSpark = findPartnerSpark(spk, sessId);
				if (null != partnerSpark) {
					foundPartner = {};
					foundPartner.sessionId = sessId;
					foundPartner.spark = partnerSpark;
					foundPartner.sparkId = partnerSpark.id;

					jSession.pairedWith = reqSid;
					jSession.partnerSpkId = spk.id;
					sStore.set(sessId, JSON.stringify(jSession), maxAge);
				}
			}
		}
	});
	return foundPartner;
}

// find the spark of the partner 
// after a connection has been established
// returns null if not paired in session store
// or partner not in primus connections
const getPartnerSpark = function(sprk, sStore) {
	let ownSid = extractSid(sprk.headers.cookie);
	let jOwnSid = JSON.parse(syncSession(ownSid, sStore));

	let partnerSid = jOwnSid.pairedWith;
	if ("noone" == partnerSid) {
		return null;
	}

	let partnerSpkId = jOwnSid.partnerSpkId;
	let partnerSpark = null;
	sprk.primus.forEach((spk, id, cons) => {
		if (null == partnerSpark) {
			if (id == partnerSpkId) {
				partnerSpark = spk;
			}
		}
	});
	return partnerSpark;
}

// reset pairedWith and partnerSpkId for session ID  in store
const resetSessionPartner = function(jStSid, reqSid, sStore) {
	jStSid.pairedWith = "noone";
	jStSid.partnerSpkId = "";
	sStore.set(reqSid, JSON.stringify(jStSid), maxAge);
}

const writeMsg = function(sprk, text, info) {
	sprk.write({
		msg: text,
		sid: info
	});
}
//======================================================

var tg = function connection(spark) {
	// we have the sessionStore as 'this.store'  
	const sessionStore = this.store;
	// we use the browser session to identify a user
	// expiration of session can be configured in the properties
	// a user session can span multiple sparks (websocket connections)
	let reqSid = extractSid(spark.headers.cookie)
	if (null == reqSid) {
		writeMsg(spark, 'needscookies', "");
		return;
	}
	let jStoredSid = JSON.parse(syncSession(reqSid, sessionStore));

	writeMsg(spark, 'welcome', reqSid + "//" + spark.id);

	if ("noone" == jStoredSid.pairedWith) {
		// new connection or server restart
		// going to find new partner
		writeMsg(spark, 'finding...', reqSid + spark.id);
	} else {
		// unexpired session connecting again
		// going to check if former partner is still there
		writeMsg(spark, 'retrieving...', "");
	}

	let foundPartner = findPartnerCheckConnection(spark, reqSid, jStoredSid, sessionStore);

	if (null != foundPartner) {
		// it's a match
		jStoredSid.pairedWith = foundPartner.sessionId;
		jStoredSid.partnerSpkId = foundPartner.sparkId;
		sessionStore.set(reqSid, JSON.stringify(jStoredSid), maxAge);

		writeMsg(spark, 'FOUND', foundPartner.sessionId + "//" + foundPartner.sparkId);
		writeMsg(foundPartner.spark, 'FOUND', reqSid + "//" + spark.id);
	} else {
		// reset in case of a retrieved session where partner has expired
		resetSessionPartner(jStoredSid, reqSid, sessionStore);
		// no partner found yet
		writeMsg(spark, 'waitforpartner', "");
	}



	let hash = crypto.createHash('sha256').update(reqSid).digest('base64').substring(5, 20);



	spark.on('data', function data(packet) {
		if (!packet) return;
		let data = JSON.parse(packet);

		if (data.hasOwnProperty('txt')) {
			let pSpark = getPartnerSpark(spark, sessionStore);
			if (null != pSpark) {
				pSpark.write({
					txt: data.txt,
					sid: spark.id
				});
				spark.write({
					txt: data.txt,
					sid: spark.id
				});
			} else {
				// lost connection
				resetSessionPartner(jStoredSid, reqSid, sessionStore);
				writeMsg(spark, 'waitpartnernotfound', "");
			}
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