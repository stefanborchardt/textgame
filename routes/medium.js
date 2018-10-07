const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('medium', {
      title: 'Textgame Level 2',
      intro: 'Diesmal können Sie einmal den letzten <strong>Zug rückgängig</strong> machen,'
        + ' wenn Ihr Mitspieler das auch <strong>wählt</strong>.'
        + ' Dabei gehen gehen allerdings die zusätzlichen Auswahlen verloren.'
        + ' Wieder müssen Sie die Bilder entfernen, die Ihr Mitspieler auch sieht.'
        + ' Für ein unbenutztes Rückgängig gibt es Bonuspunkte.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
