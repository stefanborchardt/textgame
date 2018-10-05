const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('easy', {
      title: 'Textgame Level 1',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
