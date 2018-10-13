const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.loggedIn) {
    if (!req.session.firstPlayed) {
      // first game for player in this session
      res.render('first', {
        title: 'Textgame',
        game: 'Level 1',
      });
    } else {
      // some game played before
      res.redirect('/level2');
    }
  } else {
    res.redirect('/');
  }
});

module.exports = router;
