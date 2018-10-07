const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('three', {
      title: 'Textgame Level 3',
      intro: 'Jetzt sind mehr Bilder zu entfernen, die Ihr Mitspieler auch sieht.'
        + ' Zum Ausgleich können Sie einen <strong>Joker</strong> einsetzen,'
        + ' der zwei gleiche Bilder entfernt. Aber nur vor dem letzten Zug.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
