const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('three', {
      title: 'Textgame Level 3',
      intro: 'Wieder müssen Sie die Bilder entfernen, die Ihr Mitspieler auch sieht.'
        + ' Aber das es sind jetzt mehr. Dafür können Sie einen Joker einsetzen.'
        + ' Je weniger Züge und Rückgängig gebraucht werden, desto besser.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
