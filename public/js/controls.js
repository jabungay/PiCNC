
function pressdir(direction)
{
    $.post("/test", {'dir': direction}, function(data, status) {
        console.log(direction);
    });
}
