
function resumeFile(confirmed)
{
  getServerStatus().then(function(stats) {
    if (!confirmed)
    {
      if(confirm("Really resume " + stats.activeFile + "?"))
      {
        resumeFile(true);
      }
      else
      {
        return;  
      }
    }
    else
    {
      $.get("/resume-file", (data, status) => {
        location.reload();
      });
    }
  });
}

function pauseFile(confirmed)
{
  getServerStatus().then(function(stats) {
    if (!confirmed)
    {
      if(confirm("Really pause " + stats.activeFile + "?"))
      {
        pauseFile(true);
      }
      else
      {
        return;  
      }
    }
    else
    {
      $.get("/pause-file", (data, status) => {
        location.reload();
      });
    }
  });
}

function stopFile(confirmed)
{
  getServerStatus().then(function(stats) {
    if (!confirmed)
    {
        if (confirm("Really stop " + stats.activeFile + "?"))
        {
          stopFile(true);
        }
        else
        {
          return;
        }
      
    }
    else
    {
      $.get("/stop-file", (data, status) => {
        location.reload();
      });
    }
  });
}

function deleteFile(confirmed, filename)
{
  if (!confirmed)
  {
      if (confirm("Really delete " + filename + "?"))
      {
        deleteFile(true, filename);
      }
      else
      {
        return;
      }
     
  }
  else
  {
    $.post("/delete-file", {fileName: filename}, (data, status) => {
      if (data === "delete successful")
      {
        location.reload();
      }
    });
  }
}

function moveDir(dir, axis)
{
    $.post("/movedir", {dir: dir, axis: axis}, (data, status) => {

    });
}

function setDistance(distance)
{
    $.post("/setdistance", {'dist': distance}, (data, status) => {

    });
}
