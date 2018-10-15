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
    // method not allowed
    res.sendStatus(405);
  }

  const sess = req.session;
  const mapping = req.app.get(sess.map);

  const { imageId } = req.params;

  const decipheredImgId = decipherImgId(imageId, sess.offset, sess.setSize);
  const imagePath = mapping[decipheredImgId];

  const imgPath = path.join(rootPath, imagePath);

  // disable cache because the same image url will point to another image
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');

  res.sendFile(imgPath);
});
