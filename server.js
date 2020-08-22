var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var formidable = require('formidable');
var fs = require('fs');

// Load settings JSON file
var settingsRaw = fs.readFileSync('./settings.json');
var settings = JSON.parse(settingsRaw);

// Load file JSON file
var filedataRaw = fs.readFileSync('./filedata.json');
var filedata = JSON.parse(filedataRaw);

const SerialPort = require('serialport');
const { time } = require('console');
const { format } = require('path');

var connectedToSerial = false;
const port = new SerialPort(settings.port, { baudRate: settings["baud-rate"] }, (err) => {
	if (!err)
	{
		console.log("Connected to " + settings.port);
		connectedToSerial = true;
	}
	else
	{
		console.log("Could not connect to " + settings.port);
	}
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

// Function to pad strings to two characters for dates and times
function padStr(i) 
{
	return (`0${i}`).slice(-2);
}

app.post('/upload-file', (req,res) => {


		
	console.log(req);

	var form = new formidable.IncomingForm();

	form.parse(req, (err, fields, files) => {
		// Put the file in the correct file (TODO:deal with files of the same name)
		var oldpath = files.gcodefile.path;
		var newpath = "./gcode/" + files.gcodefile.name;

		// Get and format the date
		let timestamp = Date.now();
		let currentDate = new Date(timestamp);
		// Date
		let day   = padStr(currentDate.getDate());
		let month = padStr(currentDate.getMonth() + 1);
		let year  = '20' + padStr(currentDate.getFullYear());
		// Time
		let hour   = currentDate.getHours();
		let minute = padStr(currentDate.getMinutes());
		let second = padStr(currentDate.getSeconds());

		let formattedDate = `${hour}:${minute}:${second} ${day}-${month}-${year}`;

		console.log(formattedDate);
		
		fs.rename(oldpath, newpath, (err) => {
			if (err) throw err;

		});

	});

	res.status(200);
	res.end();
});

app.post('/setdistance', (req,res) => {
	console.log(parseFloat(req.body.dist));

	if (!isNaN(req.body.dist))
	{
		settings["travel-distance"] = parseFloat(req.body.dist);

		let settingsToWrite = JSON.stringify(settings);
		fs.writeFile('./settings.json', settingsToWrite, (err) => {
			if (err) throw err;
			console.log("Wrote to \'settings.json\'")
		});
		
		res.send(toString(settings["travel-distance"])); // Echo the set value to the client
		res.status(201);
	}
	else
	{
		res.send(toString(settings["travel-distance"])); // Echo the set value to the client
		res.status(500);
	}
	res.end();
});

app.post('/movedir', (req,res) => {
	console.log(req.body);
	// console.log(res);
	// port.write('Hello, world!');
	res.end();
});

app.listen(8080, function() {
	console.log('Listening on port 8080');
});
