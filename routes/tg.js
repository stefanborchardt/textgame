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
function extractSid(cookie) {
	let indexEq = cookie.indexOf('=');
	let indexDot = cookie.indexOf('.', indexEq);
	return cookie.substring(indexEq + 5, indexDot);
}

// check sessionID against sessionStore and
// return 'noone' or SID of former partner
function syncSession(reqSid, sStore) {
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

// finds another user without partner and 
// sets current requester as other user's partner
function findPartnerBySession(spk, reqSid, sStore) {
	let foundPartner = "";
	sStore.rforEach((val, key, cache) => {
		if ("" == foundPartner) {
			let jVal = JSON.parse(val);
			let pw = jVal.pairedWith;
			if ("noone" == pw && reqSid != key) {
				foundPartner = key;
				jVal.pairedWith = reqSid;
				jVal.partnerSpkId = spk.id;
				sStore.set(key, JSON.stringify(jVal), maxAge);;
			}
		}
	});
	return foundPartner;
}

// find the spark for the partner session ID
function findPartnerSpark(sprk, partnerSid) {
	let partnerSpark = null;
	sprk.primus.forEach((spk, id, cons) => {
		if (null == partnerSpark) {
			if (id != sprk.id) {
				let otherSid = extractSid(spk.headers.cookie)
				if (partnerSid == otherSid) {
					partnerSpark = spk;
				}
			}
		}
	});
	return partnerSpark;
}

// find the spark of the partner 
// after a connection has been established
// returns null if not paired in session store
// or partner not in primus connections
function getPartnerSpark(sprk, sStore) {
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
function resetSessionPartner(jStSid, reqSid, sStore) {
	jStSid.pairedWith = "noone";
	jStSid.partnerSpkId = "";
	sStore.set(reqSid, JSON.stringify(jStSid), maxAge);
}
//======================================================

var tg = function connection(spark) {
	// we have the sessionStore as 'this.store'  
	const sessionStore = this.store;
	let reqSid = extractSid(spark.headers.cookie)

	
	let jStoredSid = JSON.parse(syncSession(reqSid, sessionStore));

	spark.write({
		msg: 'welcome',
		sid: reqSid + "//" + spark.id
	});

	if ("noone" == jStoredSid.pairedWith) {
		// new connection or server restart
		// find new partner
		spark.write({
			msg: 'find',
			sid: reqSid + spark.id
		});
	} else {
		// unexpired session connecting again
		// check if former partner is still there
		spark.write({
			msg: 'retrieve',
			sid: ""
		});
	}


	let foundPartner = findPartnerBySession(spark, reqSid, sessionStore);

	if ("" != foundPartner) {

		let partnerSpark = findPartnerSpark(spark, foundPartner);

		if (null != partnerSpark) {

			jStoredSid.pairedWith = foundPartner;
			jStoredSid.partnerSpkId = partnerSpark.id;
			sessionStore.set(reqSid, JSON.stringify(jStoredSid), maxAge);

			spark.write({
				msg: 'FOUND',
				sid: reqSid + "//" + spark.id + "//" + foundPartner + "//" + partnerSpark
			});
			partnerSpark.write({
				msg: 'FOUND',
				sid: foundPartner + "//" + partnerSpark.id + "//" + reqSid + "//" + spark.id
			});

		} else {
			// session without socket
			resetSessionPartner(jStoredSid, reqSid, sessionStore);
			// TODO maybe reset partner session 
			spark.write({
				msg: 'waitpartnersparknotfound',
				sid: reqSid + "//" + spark.id + "//" + foundPartner
			});
		}
	} else {
		// reset in case of retrieved session where partner has expired
		resetSessionPartner(jStoredSid, reqSid, sessionStore);

		// no partner found yet
		spark.write({
			msg: 'waitnotfound',
			sid: ""
		});
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
					sid: reqSid + jStoredSid.pairedWith
				});
			} else {
				// lost connection
				resetSessionPartner(jStoredSid, reqSid, sessionStore);
				spark.write({
					msg: 'waitpartnernotfound',
					sid: ""
				});
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