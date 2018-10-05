const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('large', {
      title: 'Textgame Level 4',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
