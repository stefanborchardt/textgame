const config = require('config');

const maxAge = parseInt(config.get('cookie.maxage'), 10);

// const winston = require('winston');
// const logger = winston.createLogger({
//   transports: [
//     new winston.transports.File({
//       filename: 'logs/combined.log',
//     }),
//   ],
// });

const crypto = require('crypto');


// Extract session ID from the cookie string
function extractSid(cookie) {
  if (undefined === cookie) {
    return null;
  }
  const indexEq = cookie.indexOf('=');
  const indexDot = cookie.indexOf('.', indexEq);
  return cookie.substring(indexEq + 5, indexDot);
}

// check sessionID against sessionStore and
// return 'noone' or SID of former partner
function syncSession(reqSid, sStore) {
  const storedSid = sStore.get(reqSid);
  if (undefined !== storedSid) {
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
      path: '/',
      sameSite: 'strict',
    },
    pairedWith: 'noone',
  }), maxAge);
  return sStore.get(reqSid);
}

// find the spark for the partner session ID
function findPartnerSpark(sprk, partnerSid) {
  let partnerSpark = null;
  sprk.primus.forEach((spk, spkId) => {
    if (partnerSpark == null) {
      if (spkId !== sprk.id) {
        const otherSid = extractSid(spk.headers.cookie);
        if (partnerSid === otherSid) {
          partnerSpark = spk;
        }
      }
    }
  });
  return partnerSpark;
}

// finds another user without partner and
// sets current requester as other user's partner
function findPartnerCheckConnection(spk, reqSid, _jStrSid, sStore) {
  // iterate sessions
  let foundPartner = null;
  sStore.rforEach((session, sessId) => {
    if (foundPartner == null) {
      const jSession = JSON.parse(session);
      const pw = jSession.pairedWith;
      if (pw === 'noone' && reqSid !== sessId) {
        // found unpaired session, check if connected
        const partnerSpark = findPartnerSpark(spk, sessId);
        if (partnerSpark != null) {
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
function getPartnerSpark(sprk, sStore) {
  const ownSid = extractSid(sprk.headers.cookie);
  const jOwnSid = JSON.parse(syncSession(ownSid, sStore));

  const partnerSid = jOwnSid.pairedWith;
  if (partnerSid === 'noone') {
    return null;
  }

  const prtnrSpkId = jOwnSid.partnerSpkId;
  let partnerSpark = null;
  sprk.primus.forEach((spk, id) => {
    if (partnerSpark == null) {
      if (id === prtnrSpkId) {
        partnerSpark = spk;
      }
    }
  });
  return partnerSpark;
}

// reset pairedWith and partnerSpkId for session ID  in store
function resetSessionToUnpaired(jStSid, reqSid, sStore) {
  jStSid.pairedWith = 'noone';
  jStSid.partnerSpkId = '';
  sStore.set(reqSid, JSON.stringify(jStSid), maxAge);
}

function writeMsg(sprk, text, info) {
  sprk.write({
    msg: text,
    sid: info,
  });
}

function getLogname(id1, id2) {
  return crypto.createHash('sha256').update(id1).digest('base64').substring(5, 20)
    + crypto.createHash('sha256').update(id2).digest('base64').substring(5, 20);
}

// ======================================================

const tg = function connection(spark) {
  // we have the sessionStore as 'this.store'
  const sessionStore = this.store;
  // we use the browser session to identify a user
  // expiration of session can be configured in the properties
  // a user session can span multiple sparks (websocket connections)
  const reqSid = extractSid(spark.headers.cookie);
  if (reqSid == null) {
    writeMsg(spark, 'needscookies', '');
    return;
  }
  const jStoredSid = JSON.parse(syncSession(reqSid, sessionStore));

  writeMsg(spark, 'welcome', `${reqSid}//${spark.id}`);

  if (jStoredSid.pairedWith === 'noone') {
    // new connection or server restart
    // going to find new partner
    writeMsg(spark, 'finding...', reqSid + spark.id);
  } else {
    // unexpired session connecting again
    // going to check if former partner is still there
    writeMsg(spark, 'retrieving...', '');
  }

  const foundPartner = findPartnerCheckConnection(spark, reqSid, jStoredSid, sessionStore);

  if (foundPartner != null) {
    // it's a match
    jStoredSid.pairedWith = foundPartner.sessionId;
    jStoredSid.partnerSpkId = foundPartner.sparkId;
    sessionStore.set(reqSid, JSON.stringify(jStoredSid), maxAge);

    writeMsg(spark, 'FOUND', `${foundPartner.sessionId}//${foundPartner.sparkId}`);
    writeMsg(foundPartner.spark, 'FOUND', `${reqSid}//${spark.id}`);

    // const logName = getLogname(reqSid, foundPartner.sessionId);
  } else {
    // reset in case of a retrieved session where partner has expired
    // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    // no partner found yet
    writeMsg(spark, 'waitforpartner:wait TODOnew', '');
  }


  spark.on('data', (packet) => {
    if (!packet) return;
    const data = JSON.parse(packet);

    if (data.hasOwnProperty('txt')) {
      const pSpark = getPartnerSpark(spark, sessionStore);
      if (pSpark != null) {
        pSpark.write({
          txt: data.txt,
          sid: spark.id,
        });
        spark.write({
          txt: data.txt,
          sid: spark.id,
        });
      } else {
        // lost connection
        writeMsg(spark, 'partnernotfound:wait TODOnew', '');
        // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
      }
    } else if (data.hasOwnProperty('msg')) {
      // TODO
    }
  });

  spark.on('open', (_packet) => {

  });
  spark.on('reconnect', () => {

  });
  spark.on('online', () => {

  });
  spark.on('offline', () => {

  });
  spark.on('error', (_err) => {

  });
  spark.on('end', () => {
    // tab closed
    const pSpark = getPartnerSpark(spark, sessionStore);
    if (pSpark != null) {
      writeMsg(pSpark, 'partnerdisconnected:wait TODOnew', spark.id);
      // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    }
  });
  spark.on('close', () => {

  });
};

module.exports = tg;
