var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var settings = require('./settings.json'); // JSON file used to store all settings

const SerialPort = require('serialport');
const port = new SerialPort(settings.port, {
	baudRate: 115200
});

app.set('view engine', 'pug');	// Use PUG for HTML
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false })); // Parse URL POST requests

app.get('/', function(req, res) {
	res.render('index', {
		title: 'PiCNC Controller'
	});
	console.log(settings);
});

app.post('/test', (req,res) => {
	console.log(req.body);
	// console.log(res);
	// port.write('Hello, world!');
	res.end();
});

app.listen(8080, function() {
	console.log('Listening on port 8080');
});
