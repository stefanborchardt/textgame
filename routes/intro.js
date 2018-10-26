const express = require('express');

const router = express.Router();

// a request for /intro/{foobar} will cause
// the intro to be skipped at the next visit to login - "/"
router.get('/:seen', (req, res) => {
  if (req.params.seen) {
    req.session.introSeen = true;
  }
  if (!req.session.firstPlayed) {
    res.redirect('/level1');
  } else {
    res.redirect('/level2');
  }
});

router.get('/*', (req, res) => {
  res.render('intro2', {
    title: 'Intro',
  });
});

module.exports = router;
