const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.loggedIn) {
    if (req.session.firstPlayed) {
      // some game has been played before
      res.render('second', {
        title: 'Textgame Level 2',
        intro: 'This time you can <strong>undo the last turn</strong>,'
          + ' if the other player <strong>chooses</strong> it, too.'
          + ' The the extra selections will be lost, though.'
          + ' Again, you have to remove the images the other player shares with you.'
          + ' <strong>Bonus points</strong> will be rewarded for not using the undo.',
      });
    } else {
      // no game played before
      res.redirect('/level1');
    }
  } else {
    res.redirect('/');
  }
});

module.exports = router;
