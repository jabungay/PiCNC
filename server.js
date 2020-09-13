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
var serialData = {
	isConnected: false,		// Are we connected to the port? 
	isSendingGcode: false,	// Is there a gcode file in the process if being sent? (false = paused if bufferTx is not empty, false = stopped if bufferTx is empty)
	activeFile: "",
	bufferRx: "",			// Receive buffer is a string so that we can properly split the data into commands (separated by \r\n)
	bufferTx: []			// Bufer of commands to be sent
}

const port = new SerialPort(settings.port, { baudRate: settings["baud-rate"] }, (err) => {
	if (!err)
	{
		console.log("Connected to " + settings.port);
		serialData.isConnected = true;

		port.on('readable', () => { // Event listener to process Rx data
			serialData.bufferRx += port.read().toString(); // Read the data and append it to the Rx buffer as a string

			// Get the locations of CR LF characters in the buffer
			let indexCR = serialData.bufferRx.indexOf('\r');
			let indexLF = serialData.bufferRx.indexOf('\n');

			if (indexCR == -1 || indexLF == -1) { console.log("Buffer does not contain CRLF, returning (buf=" + serialData.bufferRx + ")"); return; } // CRLF is not present, return and wait for more data

			let command = serialData.bufferRx.substring(0, indexCR); // Get current command
			serialData.bufferRx = serialData.bufferRx.slice(indexLF + 1); // Update rx buffer

			if (command === "") { return; }

			console.log("Command: \"" + command + "\"");

			if (serialData.isSendingGcode && command.indexOf("ok") != -1) 
			{
				sendGcodeLine();
				if (serialData.bufferTx.length == 0) 
				{ 
					serialData.isSendingGcode = false; 
					serialData.activeFile = "";
					console.log("Gcode finished!"); 
				}
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

// Remove a comment from a line of gcode (starts with ; and ends at the end of the line)
function removeComment(string)
{
	if (string.indexOf(";") == -1) { return string; }

	return string.slice(0, string.indexOf(";"));
}

function sendGcodeCmd(command)
{
	if (serialData.isConnected)
	{
		port.write(command, (err) => {
			if (err) 
			{
				console.error(err);
				return;
			}
			console.log("Sent: " + command);
		});
	}
	else
	{
		console.log("Serial port not available CMD: " + command);
	}
}

function sendGcodeLine()
{
	let dataToSend = serialData.bufferTx[0] + '\n'; // Newline at the end for process

	sendGcodeCmd(dataToSend);

	serialData.bufferTx = serialData.bufferTx.splice(1);
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
});

app.get('/get-status', (req, res) => {

	let dataToSend = {
		port: settings.port,
		isConnected: serialData.isConnected,
		isActive: serialData.isSendingGcode,
		activeFile: serialData.activeFile
	};
	res.send(dataToSend);
	res.end();
});

// Send list of files to client 
app.post('/get-file-list', (req, res) => {

	res.status(200);
	res.send(filedata);

	res.end();
});

app.post('/send-cmd', (req, res) => {
	let form = new formidable.IncomingForm();

	form.parse(req, (err, fields) => {
		if (err) { console.error(err); }

		let command = fields.gcodeCommand.trim().toUpperCase(); // Remove unneeded whitespace and make uppercase

		sendGcodeCmd(command + "\n"); // Grbl requires \n to process command
	});

	res.writeHead(301, { Location: '/'} );
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
			uploadDate: formattedDate,
			size: files.gcodefile.size
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

// TODO: This is dangerously written, disable relative paths somehow?
app.get('/download-file', (req, res) => {
	let file = "gcode/" + req.query.fileName;
	console.log(file);
	res.download(file);
	// res.end();
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


app.post('/start-file', (req, res) => {
	console.log("Start " + req.body.fileName);
	let gcodeFileRaw = fs.readFileSync('./gcode/' + req.body.fileName);
	let gcode = gcodeFileRaw.toString();

	serialData.bufferTx = serialData.bufferTx.concat(separateLines(gcode));
	serialData.activeFile = req.body.fileName.toString();
	serialData.isSendingGcode = true;

	sendGcodeLine();
	
	res.end();
});

app.get('/stop-file', (req, res) => {
	serialData.bufferTx = []; // Empty the tx buffer
	serialData.isSendingGcode = false;
	serialData.activeFile = "";

	res.end();
});

// Halt the sending of gcode but don't clear the buffer
app.get('/pause-file', (req, res) => {
	serialData.isSendingGcode = false;

	res.end();
});

// Resume operation of gcode sending
app.get('/resume-file', (req, res) => {
	serialData.isSendingGcode = true;

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