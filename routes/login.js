const express = require('express');

const router = express.Router();


router.get('/', (req, res) => {
  if (!req.session.loggedIn) {
    res.render('login', {
      title: 'Login',
    });
  } else if (!req.session.introSeen) {
    res.redirect('/intro');
  } else if (!req.session.firstPlayed) {
    res.redirect('/level1');
  } else {
    res.redirect('/level2');
  }
});

module.exports = router;
