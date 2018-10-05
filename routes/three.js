const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('three', {
      title: 'Textgame Level 3',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
