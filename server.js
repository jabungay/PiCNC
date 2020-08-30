////////////////////
// Used Libraries
////////////////////
var express    = require('express');
var bodyParser = require('body-parser');
var formidable = require('formidable');
var fs         = require('fs');
var SerialPort = require('serialport');
var { time }   = require('console');
var { format } = require('path');

////////////////////
// JSON Files
////////////////////
// Settings
var settingsRaw = fs.readFileSync('./settings.json');
var settings = JSON.parse(settingsRaw);
// Uploaded files
var filedataRaw = fs.readFileSync('./filedata.json');
var filedata = JSON.parse(filedataRaw);

////////////////////
// Serial Port Config
////////////////////
var connectedToSerial = false;
var sendingGcodeFile = false; // Flag if a file send is in progress (false == paused OR stopped), depending on length of send buffer
var serialBufferRx    = [];	  // Rx buffer from serial port
var gcodeFileTxBuffer = [];   // Tx buffer of current gcode file to serial port
var strRx = "";
const port = new SerialPort(settings.port, { baudRate: settings["baud-rate"] }, (err) => {
	if (!err)
	{
		console.log("Connected to " + settings.port);
		connectedToSerial = true;

		port.on('readable', () => { // Event listener to add new data to buffer
			let buf = port.read();

			strRx += buf.toString();

			if (strRx.indexOf('\n') == -1) { return; }
			let command = strRx.substring(0, strRx.indexOf('\n')); // Get current command
			strRx = strRx.slice(strRx.indexOf('\n') + 1); // Update rx buffer

			console.log("Complete command: " + command);

			if (sendingGcodeFile && command.indexOf("ok") != -1) 
			{
				sendGcodeLine();
				if (gcodeFileTxBuffer.length == 0) { sendingGcodeFile = false; console.log("Gcode finished!"); }
			}

		});
	}
	else
	{
		console.log("Could not connect to " + settings.port);
	}
});

module.exports = port;

////////////////////
// Functions
////////////////////

// Pad strings of length 1 with a leading 0 (for date/time)
function padStr(i) 
{
	return (`0${i}`).slice(-2);
}

// Write some json data to a json file
function writeJSON(jsonFile, jsonData)
{
	let jsonStr = JSON.stringify(jsonData);

	fs.writeFile(jsonFile, jsonStr, (err) => {
		if (err) console.error(err);
	});

}

function separateLines(string)
{
	let lineArr = [];

	while (string.indexOf("\n") != -1)
	{
		let line = string.slice(0, string.indexOf("\n"));

		line = removeComment(line);

		lineArr.push(line);



		string = string.slice(string.indexOf("\n") + 1); // Trim the gcode string

	}
	return lineArr;
}

function sendGcodeLine()
{
	console.log("Sending line: " + gcodeFileTxBuffer[0]);

	let dataToSend = gcodeFileTxBuffer[0] + '\n'; // Newline at the end for process

	if (connectedToSerial)
	{
		port.write(dataToSend, (err) => {
			if (err) 
			{
				console.error(err);
				return;
			}
			console.log("Waiting for reply from serial...");
		});
	}
	else
	{
		console.log("Serial port not available");
	}
	gcodeFileTxBuffer = gcodeFileTxBuffer.splice(1);
}

const e = require('express');
const { strict } = require('assert');

////////////////////
// App Config
////////////////////
var app = express();
app.set('view engine', 'pug');	// Use PUG for HTML
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false })); // Parse URL POST requests

////////////////////
// HTTP Request Handlers
////////////////////

// App main page
app.get('/', function(req, res) {
	res.render('index', {
		title: 'PiCNC Controller'
	});
	console.log(settings);
});

// Send list of files to client 
app.post('/get-file-list', (req, res) => {

	res.status(200);
	res.send(filedata);

	res.end();
});

// Upload a gcode file (TODO: check if the file is actually GCODE)
app.post('/upload-file', (req,res) => {

	var form = new formidable.IncomingForm();

	form.parse(req, (err, fields, files) => {
		var oldpath = files.gcodefile.path;

		
		var extensionIndex = files.gcodefile.name.lastIndexOf("."); 	 // Where does the file name start and the file extension begin?
		var fileName = files.gcodefile.name.substr(0, extensionIndex);   // Part of file up to but not including the final dot (.)
		var fileExtension = files.gcodefile.name.substr(extensionIndex); // Part of the file from the final dot to the end
		let fileNameFull = fileName + fileExtension;					 // The two above vars combined back together

		// If file(s) already exist with the same name, keep 
		// incrementing until a number is found that does not 
		// overlap with an existing file
		// e.g. file.gcode -> file-1.gcode
		let numExisting = 0;
		while(fs.existsSync("./gcode/" + fileNameFull))
		{
			numExisting++;
			fileNameFull = fileName + "-" + numExisting + fileExtension; // Append number to file name and try again to see if it exists
		}

		var newpath = "./gcode/" + fileNameFull; // Place all files in the gcode folder

		// Get and format the date
		let timestamp   = Date.now(); // Unix timecode
		let currentDate = new Date(timestamp); // Convert timecode into date object
		// Date
		let day   = padStr(currentDate.getDate());
		let month = padStr(currentDate.getMonth() + 1);
		let year  = '20' + padStr(currentDate.getFullYear());
		// Time
		let hour   = currentDate.getHours();
		let minute = padStr(currentDate.getMinutes());
		let second = padStr(currentDate.getSeconds());

		let formattedDate = `${hour}:${minute}:${second} ${day}-${month}-${year}`; // Date formatted as a string

		let file = { // Create new JSON entry
			name: fileNameFull,
			uploadDate: formattedDate
		};

		filedata.filelist.push(file); // Append the new file to the JSON file

		// Try to move the file from the temp folder to the gcode folder (with new name)
		fs.rename(oldpath, newpath, (err) => {
			if (err)
			{
				console.error(err);
				res.status(500); // Internal server error
				res.end();
			}
			else
			{
				writeJSON("./filedata.json", filedata); // Onlt write json file if the file move was successful
				res.writeHead(301, { Location: '/'} );
				res.end();
			}
		});

		

	});

});

// Delete a file from the database
app.post('/delete-file', (req, res) => {
	fileName = req.body.fileName;
	try
	{
		fs.unlinkSync("./gcode/" + fileName); // Remove the file from the file system
		
		for (var i = 0; i < filedata.filelist.length; i++)
		{
			if (filedata.filelist[i].name == fileName)
			{
				filedata.filelist.splice(i, 1);
				break;
			}
		}

		writeJSON('./filedata.json', filedata);

		res.send("delete successful");
	}
	catch (err) // Can't delete file (probably doesn't actually exist or something)
	{
		console.error(err);
		res.send("delete failed");
	}
	res.end();
});


function removeComment(string)
{
	if (string.indexOf(";") == -1) { return string; }

	return string.slice(0, string.indexOf(";"));
}



// TODO: start sending gcode
app.post('/start-file', (req, res) => {
	console.log("Start " + req.body.fileName);
	let gcodeFileRaw = fs.readFileSync('./gcode/' + req.body.fileName);
	let gcode = gcodeFileRaw.toString();

	gcodeFileTxBuffer = gcodeFileTxBuffer.concat(separateLines(gcode));
	sendingGcodeFile = true;
	sendGcodeLine();
	res.end();
});

// Set the distance that the move commands will move the axis
app.post('/setdistance', (req,res) => {

	if (!isNaN(req.body.dist)) // Is the value actually a number?
	{
		settings["travel-distance"] = parseFloat(req.body.dist);

		writeJSON("./settings.json", settings);

		res.send(toString(settings["travel-distance"])); // Echo the set value to the client
		res.status(201);
	}
	else
	{
		res.send(toString(settings["travel-distance"])); // Echo the saved value to the client
		res.status(500);
	}
	res.end();
});

// Move the axis (TODO)
app.post('/movedir', (req,res) => {
	console.log(req.body);
	// console.log(res);
	// port.write('Hello, world!');
	res.end();
});

// Start the server
app.listen(8080, function() {
	console.log('Listening on port 8080');
});