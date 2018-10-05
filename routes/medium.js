const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('medium', {
      title: 'Textgame Level 2',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
