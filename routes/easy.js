const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('easy', {
      title: 'Textgame Level 1',
      intro: 'Sie und Ihr Mitspieler sehen die gleichen Bilder - fast. Finden Sie die Unterschiede,'
        + ' indem Sie abwechselnd <strong>alle gleichen entfernen</strong>. Je weniger Züge, desto besser. Klicken Sie'
        + ' auf <strong>Zug beenden</strong>, um sich abzuwechseln. Falls ein falsches Bild ausgewählt wurde,'
        + ' können Sie im nächsten Zug <strong>zusätzliche entfernen</strong>.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
