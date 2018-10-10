const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('easy', {
      title: 'Textgame Level 1',
      intro: 'You and the other player see the same images - almost. Find the differences'
        + ' by taking turns in <strong>removing all the shared images</strong>. Less turns are better. Click on'
        + ' <strong>End Turn</strong> to take turns. In case you selected a unique image'
        + ' you can <strong>remove extra images</strong> in the next turn. A result of <strong>100 points</strong> is good.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
