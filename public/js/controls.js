function moveDir(direction)
{
    $.post("/movedir", {'dir': direction}, (data, status) => {

    });
}

function setDistance(distance)
{
    $.post("/setdistance", {'dist': distance}, (data, status) => {

    });
}