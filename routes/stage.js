const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.loggedIn) {
    res.render('stage', {
      title: 'Make a restaurant reservation with the information you and the other person share.',
      game: 'Stage',
    });
  } else {
    res.redirect('/');
  }
});

module.exports = router;
