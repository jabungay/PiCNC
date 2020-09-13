
getFileData().then(function(data) {
  getServerStatus().then(function(stats) {
    let serialStatus = document.getElementById("connection-status");
    let fileStatus = document.getElementById("file-active");
  
    serialStatus.innerHTML = "Serial Connection: ";
    serialStatus.innerHTML += stats.isConnected?"Connected":"Disconnected";
  
    let paused = !stats.isActive && stats.activeFile != "";

    let btnResume = document.getElementById("btnResume");
    let btnPause  = document.getElementById("btnPause");
    let btnStop   = document.getElementById("btnStop");

    if (stats.isActive)
    {
      // Enable pause and stop buttons
      btnResume.style.display = "none";
      btnPause.style.display  = "inline";
      btnStop.style.display   = "inline";
      fileStatus.innerHTML = "Active File: " + stats.activeFile;
    }
    else if (paused)
    {
      // enable resume and stop buttons
      btnResume.style.display = "inline";
      btnPause.style.display  = "none";
      btnStop.style.display   = "inline";
      fileStatus.innerHTML = "Active File: " + stats.activeFile + " (paused)";
    }
    else 
    {
      // disable all buttons
      btnResume.style.display = "none";
      btnPause.style.display  = "none";
      btnStop.style.display   = "none";
      fileStatus.innerHTML = "Active File: None";
    }

    let fileList = data.filelist;

    let fileListDiv = document.getElementById("filelist");

    fileList.forEach(file => {
        var fileDiv = document.createElement("div");
        fileDiv.className = "file-div";

        var fileName = document.createElement("p");
        fileName.className = "file-name";
        fileName.innerText = file.name;
        fileDiv.appendChild(fileName);

        var fileDate = document.createElement("p");
        fileDate.className = "file-date";
        fileDate.innerHTML = "Uploaded on: " + file.uploadDate;
        fileDiv.appendChild(fileDate);

        var fileSizeP = document.createElement("p");
        fileSizeP.className = "file-size";

        let fileSize = file.size;
        let fileSizeStr = fileSize + " B";
        if (fileSize >= 1048576) // Greater than 1 MB
        {
          fileSize /= 1048576;
          fileSizeStr = fileSize.toFixed(2) + " MB";
        }
        else if (fileSize >= 1024) // Greater than 1 KB
        {
          fileSize /= 1024;
          fileSizeStr = fileSize.toFixed(2) + " KB";
        }
        fileSizeP.innerHTML = "Size: " + fileSizeStr;
        fileDiv.appendChild(fileSizeP);

        var startBtn = document.createElement("button");
        startBtn.className = "ctrlbtn";
        startBtn.innerHTML = "Start";
        if (paused || stats.isActive) // disable start buttons if there is a file in progress
        {
          startBtn.disabled = true;
        }
        startBtn.addEventListener("click", function() {
          if (confirm("Start " + file.name + "?"))
          {
            $.post("/start-file", {fileName: file.name}, (data, status) => {
              location.reload(); // Reload the page to refresh all data
            });
          }
        });
        fileDiv.appendChild(startBtn);

        var deleteBtn = document.createElement("button");
        deleteBtn.className = "ctrlbtn";
        deleteBtn.innerHTML = "Delete";
        deleteBtn.addEventListener("click", function() {
          deleteFile(false, file.name);
        });
        fileDiv.appendChild(deleteBtn);

        var downloadBtn = document.createElement("button");
        downloadBtn.className = "ctrlbtn";
        downloadBtn.innerHTML = "Download";
        downloadBtn.addEventListener("click", function() {
          location.href = "/download-file?fileName=" + file.name; 
        });
        fileDiv.appendChild(downloadBtn);

        fileListDiv.prepend(fileDiv);
    });
  });
});



function getServerStatus() {
  // Use a promise to make sure that the file is recieved before continuing
  return new Promise(function(resolve, reject) {
    $.get('/get-status', function(json_data) {
      if (json_data != undefined) {
        resolve(json_data);
      } else {
        reject(json_data);
      }
    });
  });
}

function getFileData() {
    // Use a promise to make sure that the file is recieved before continuing
    return new Promise(function(resolve, reject) {
      $.post('/get-file-list', function(json_data) {
        if (json_data != undefined) {
          resolve(json_data);
        } else {
          reject(json_data);
        }
      });
    });
  }