const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('medium', {
      title: 'Textgame Level 2',
      intro: 'Diesmal können Sie den letzten Zug rückgängig machen, wenn Ihr Mitspieler zustimmt.'
        + ' Wieder müssen Sie die Bilder entfernen, die Ihr Mitspieler auch sieht.'
        + ' Je weniger Züge und Rückgängig gebraucht werden, desto besser.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
