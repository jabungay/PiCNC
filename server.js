var express = require('express');
var app = express();


app.set('view engine', 'pug');
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
	res.render('index', {
		title: 'PiCNC Controller'
	});
});

app.listen(8080, function() {
	console.log('Listening on port 8080');
});
