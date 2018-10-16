const express = require('express');
const path = require('path');

const router = express.Router();

/** complementary to tgbase.cipherImgIds() */
const decipherImgId = (id, offset, paramSetSize) => (
  ((parseInt(id, 10) + paramSetSize - offset - 100) % paramSetSize) + 100
);

module.exports = rootPath => router.all('/:imageId', (req, res) => {
  // There is a mapping between file system and image ids, which is kept in the app,
  // defined e.g. in tgfirst, and is written to the beginning of the game log file.
  // In addition there is a Ceasar cipher for the image ids/ urls
  // per player, which params are stored in the player session. Two players see the
  // same image with different ids and urls.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.sendStatus(405);
    return;
  }

  // only players in a game need images
  if (!req.session.loggedIn || !req.session.gameStateId || req.session.gameStateId === 'NOGAME') {
    res.sendStatus(401);
    return;
  }

  const { imageId } = req.params;
  // only valid ids have to be handled
  if (Number.isNaN(imageId) || imageId < 100 || imageId >= 100 + req.session.setSize) {
    res.sendStatus(404);
    return;
  }

  const decipheredImgId = decipherImgId(imageId, req.session.offset, req.session.setSize);
  const mapping = req.app.get(req.session.map);
  const imagePath = mapping[decipheredImgId];

  const imgPath = path.join(rootPath, imagePath);
  // disable cache because the same image url will point to another image
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.sendFile(imgPath);
});
