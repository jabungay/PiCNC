

getFileData().then(function(data) {
    let fileList = data.filelist;

    let fileListDiv = document.getElementById("filelist");

    fileList.forEach(file => {
        var fileDiv = document.createElement("div");

        var fileName = document.createElement("p");
        fileName.innerText = file.name;
        fileDiv.appendChild(fileName);

        var fileDate = document.createElement("p");
        fileDate.innerHTML = file.uploadDate;
        fileDiv.appendChild(fileDate);

        var startBtn = document.createElement("button");
        startBtn.innerHTML = "Start";
        startBtn.addEventListener("click", function() {
          $.post("/start-file", {fileName: file.name}, (data, status) => {

          });
        });
        fileDiv.appendChild(startBtn);

        var deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "Delete";
        deleteBtn.addEventListener("click", function() {
          $.post("/delete-file", {fileName: file.name}, (data, status) => {
            if (data === "delete successful")
            {
              location.reload();
            }
          });
        });
        fileDiv.appendChild(deleteBtn);

        fileListDiv.prepend(fileDiv);
    });
});

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