const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('large', {
      title: 'Textgame Level 4',
      intro: 'Good luck. Only two out of three images are shared in this level.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
