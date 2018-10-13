const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.loggedIn) {
    if (req.session.firstPlayed) {
      // some game has been played before
      res.render('second', {
        title: 'Textgame',
        game: 'Level 2',
      });
    } else {
      // no game played before
      res.redirect('/level1');
    }
  } else {
    res.redirect('/');
  }
});

module.exports = router;
