const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.loggedIn) {
    res.render('stage', {
      title: 'Textgame',
      game: 'Stage',
    });
  } else {
    res.redirect('/');
  }
});

module.exports = router;
