const config = require('config');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const os = require('os');

const maxAge = parseInt(config.get('cookie.maxage'), 10);

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

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

// return session from store, if necessary after
// restoring from cookie
function syncSession(reqSid, sStore) {
  const storedSid = sStore.get(reqSid);
  if (undefined !== storedSid) {
    return storedSid;
  }
  // client with old sessionid reconnecting
  // after server restart
  // creating session store entry from sid
  logger.info('restoring session from cookie');
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

// create log file name from the hash of two strings and a random number
function getLogname(id1, id2) {
  const clearIdentifier = id1 + Math.random() + id2;
  const hashedIdentifier = crypto.createHash('sha256').update(clearIdentifier).digest('base64');
  const identifier = hashedIdentifier.replace(/\W/g, '');
  return `${identifier}.log`;
}

// reset pairedWith and partnerSpkId for session ID  in store
function resetSessionToUnpaired(jSession, sessionId, sStore) {
  logger.info(`resetting session ${jSession.log}`);
  const jSessionCopy = Object.assign({}, jSession);
  jSessionCopy.pairedWith = 'noone';
  jSessionCopy.partnerSpkId = null;
  jSessionCopy.log = null;
  jSessionCopy.role = null;
  sStore.set(sessionId, `${JSON.stringify(jSessionCopy)}\n`, maxAge);
}

// finds another user without partner or former partner and
// sets current requester other user as each other's partner
// add roles and log file name
function findPartnerCheckConnection(spk, reqSid, jRequester, sStore) {
  // iterate sessions
  let thisResult = null;
  sStore.rforEach((session, sessId) => {
    if (thisResult == null) {
      const jPartner = JSON.parse(session);
      if (sessId !== reqSid && (jPartner.pairedWith === 'noone' || jPartner.pairedWith === reqSid)) {
        // found unpaired session, check if connected
        const foundPartnerSpark = findPartnerSpark(spk, sessId);
        if (foundPartnerSpark != null) {
          if (jPartner.pairedWith === reqSid
            && (jPartner.role === jRequester.role || jPartner.log !== jRequester.log
              || jPartner.turn === jRequester.turn)) {
            // previously paired, but there is something wrong
            logger.warn(`resetting pair ${jRequester.log} ${jPartner.log}`);
            resetSessionToUnpaired(jPartner);
            resetSessionToUnpaired(jRequester);
          } else {
            const jRequesterCopy = Object.assign({}, jRequester);
            if (jPartner.pairedWith === reqSid) {
              // re-establish partners, update sparks
              // and fill requester session from partner in case it was created from cookie
              logger.info(`re-establish pair ${jPartner.log}`);

              jRequesterCopy.logName = jPartner.log;
              if (jPartner.role === 'A') {
                jRequesterCopy.role = 'B';
              } else {
                jRequesterCopy.role = 'A';
              }
              jRequesterCopy.turn = !jPartner.turn;
            } else {
              // new pair
              const logName = getLogname(reqSid, sessId);
              logger.info(`new pair ${logName}`);

              jPartner.pairedWith = reqSid;
              jPartner.partnerSpkId = spk.id;
              jPartner.log = logName;
              jPartner.role = 'A';
              jPartner.turn = true;

              jRequesterCopy.log = logName;
              jRequesterCopy.role = 'B';
              jRequesterCopy.turn = false;
            }
            //
            jPartner.partnerSpkId = spk.id;

            jRequesterCopy.pairedWith = sessId;
            jRequesterCopy.partnerSpkId = foundPartnerSpark.id;

            // save new pair and set return value
            thisResult = {
              requesterRole: jRequesterCopy.role,
              partnerRole: jPartner.role,
              log: jRequesterCopy.log,
              partnerSpark: foundPartnerSpark,
              requesterTurn: jRequesterCopy.turn,
            };
            sStore.set(sessId, JSON.stringify(jPartner), maxAge);
            sStore.set(reqSid, JSON.stringify(jRequesterCopy), maxAge);
          }
        }
      }
    }
  });
  return thisResult;
}

// find the spark of the partner
// after a connection has been established
// returns null if not paired in session store
// or partner not in primus connections
function getPairInfo(sprk, sStore) {
  const ownSid = extractSid(sprk.headers.cookie);
  const jSession = JSON.parse(syncSession(ownSid, sStore));

  const partnerSid = jSession.pairedWith;
  if (partnerSid === 'noone') {
    return null;
  }

  const prtnrSpkId = jSession.partnerSpkId;
  let thisResult = null;
  sprk.primus.forEach((spk, id) => {
    if (thisResult == null) {
      if (id === prtnrSpkId) {
        thisResult = {
          ownSid,
          partnerSpark: spk,
          ownRole: jSession.role,
          ownTurn: jSession.turn,
          log: jSession.log,
        };
      }
    }
  });
  return thisResult;
}

// ends requesters turn in session store
// assumes that the partner connection has been checked
function endTurn(reqSid, sStore) {
  const jreqSession = JSON.parse(syncSession(reqSid, sStore));
  const jpartSession = JSON.parse(syncSession(jreqSession.pairedWith, sStore));
  const jreqSessionCopy = Object.assign({}, jreqSession);
  const jpartSessionCopy = Object.assign({}, jpartSession);
  jreqSessionCopy.turn = false;
  jpartSessionCopy.turn = true;
  sStore.set(reqSid, JSON.stringify(jreqSessionCopy), maxAge);
  sStore.set(jreqSession.pairedWith, JSON.stringify(jpartSessionCopy), maxAge);
}

function writeMsg(sprk, msg, info) {
  sprk.write({ msg, info });
}

function writeLog(logName, jContent) {
  const logPath = `logs${path.sep}${logName}`;
  fs.open(logPath, 'a', (_err, fd) => {
    fs.appendFile(fd, JSON.stringify(jContent) + os.EOL, (_err) => {
      fs.close(fd, (_err) => { });
    });
  });
}

function broadcast(sprk, partnerSprk, data, role) {
  const dataCopy = Object.assign({}, data);
  dataCopy.role = role;
  sprk.write(dataCopy);
  partnerSprk.write(dataCopy);
  return dataCopy;
}

function broadcastWithLog(sprk, partnerSprk, data, role, logName) {
  const dataCopy = broadcast(sprk, partnerSprk, data, role);
  writeLog(logName, dataCopy);
}

function broadcastTurn(sprk, partnerSprk, requesterTurn, requesterRole, logName) {
  sprk.write({ turnover: requesterTurn });
  partnerSprk.write({ turnover: !requesterTurn });
  writeLog(logName, { nextTurn: { role: requesterRole, active: requesterTurn } });
}

// ======================================================

const tg = function connection(spark) {
  // we have the sessionStore as 'this.store'
  const sessionStore = this.store;
  // we use the browser session to identify a user
  // expiration of session can be configured in the properties
  // a user session can span multiple sparks (websocket connections)
  const requesterSid = extractSid(spark.headers.cookie);
  if (requesterSid == null) {
    writeMsg(spark, 'cookie expired or cookies disabled', '');
    return;
  }
  const jRequesterSession = JSON.parse(syncSession(requesterSid, sessionStore));

  writeMsg(spark, 'welcome', `${requesterSid}//${spark.id}`);

  if (jRequesterSession.pairedWith === 'noone') {
    // new connection or server restart
    // going to find new partner
    writeMsg(spark, 'finding...', requesterSid + spark.id);
  } else {
    // unexpired session connecting again
    // going to check if former partner is still there
    writeMsg(spark, 'retrieving...', '');
  }

  const pair = findPartnerCheckConnection(spark, requesterSid, jRequesterSession, sessionStore);

  if (pair != null) {
    // it's a match
    writeMsg(spark, 'FOUND', `${pair.requesterRole}//${pair.log}//${pair.partnerSpark.id}`);
    writeMsg(pair.partnerSpark, 'FOUND', `${pair.partnerRole}//${spark.id}//`);

    broadcastTurn(spark, pair.partnerSpark, pair.requesterTurn, pair.requesterRole, pair.log);
  } else {
    // reset in case of a retrieved session where partner is not connected
    // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    // no partner found yet
    writeMsg(spark, 'waitforpartner:wait TODOnew', '');
  }


  spark.on('data', (packet) => {
    if (!packet) return;

    const result = getPairInfo(spark, sessionStore);
    if (result != null) {
      const data = JSON.parse(packet);

      if (data.txt !== undefined) {
        broadcastWithLog(spark, result.partnerSpark, data, result.ownRole, result.log);
      } else if (data.act !== undefined) {
        if (data.act === 'drag') {
          if (!result.ownTurn) {
            logger.warn('inactive user dragging');
          }
          broadcastWithLog(spark, result.partnerSpark, data, result.ownRole, result.log);
        } else if (data.act === 'drgmv') {
          broadcast(spark, result.partnerSpark, data, result.ownRole);
        }
      } else if (data.turnover !== undefined) {
        if (!result.ownTurn) {
          logger.warn('inactive user handing turn over');
        }
        endTurn(result.ownSid, sessionStore);
        broadcastTurn(spark, result.partnerSpark, false, result.ownRole, result.log);
      } else if (data.msg !== undefined) {
        // TODO
      }
    } else {
      // lost connection
      writeMsg(spark, 'partnernotfound:wait TODOnew', '');
      // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
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
    const result = getPairInfo(spark, sessionStore);
    if (result != null) {
      writeMsg(result.partnerSpark, 'partnerdisconnected:wait TODOnew', spark.id);
      // resetSessionToUnpaired(jStoredSid, reqSid, sessionStore);
    }
  });
  spark.on('close', () => {

  });
};

module.exports = tg;
