const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.pairedWith) {
    res.render('easy', {
      title: 'Textgame Level 1',
      intro: 'Sie und Ihr Mitspieler sehen die gleichen Bilder - fast. Finden Sie die Unterschiede,'
        + ' indem Sie abwechselnd alle gleichen entfernen. Je weniger Züge, desto besser.',
    });
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
