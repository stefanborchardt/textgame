const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('three', {
      title: 'Textgame Level 3',
      intro: 'This time more images both you and the other player see have to be removed.'
        + ' As a compensation you can use a <strong>Joker</strong>,'
        + ' which removes two shared images. But only before the last turn.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
