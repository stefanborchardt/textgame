const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('index', {
      title: 'Textgame',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
