var express = require('express');
var session = require('express-session');
var router = express.Router();


router.get('/', function(req, res, next) {
	if (req.session.user) {
		res.render('index', {
			title: 'Textgame'
		});
	} else {
		res.redirect('/login');
	}

});

module.exports = router;