/* global location, WebSocket */
var host = location.origin.replace(/^https/, 'wss')
var primus = Primus.connect(location.origin);

function addMessage(text) {
    let newLi = document.createElement("li");
    newLi.innerHTML = text;
    $('#messages').append(newLi);
}

primus.on('data', function incoming(data) {
    //expecting JSON here
    if ('string' === typeof data) {
        return;
    }

    if (data.hasOwnProperty('txt')) {
        addMessage(data.txt + " / " + data.sid);
    } else if (data.hasOwnProperty('msg')) {
        addMessage(data.msg + " / " + data.sid);
    }
});


$('#send').on("click", function(event) {


    primus.write(JSON.stringify({
        txt: $('#box').val()
    }));

});



primus.on('reconnect', function reconnect() {
    console.log('reconnect', 'Reconnect', 'Starting the reconnect attempt, hopefully we get a connection!');
});
primus.on('online', function online() {
    console.log('network', 'Online', 'We have regained control over our internet connection.');
});
primus.on('offline', function offline() {
    console.log('network', 'Offline', 'We lost our internet connection.');
});
primus.on('open', function open() {
    console.log('open', 'Open', 'The connection has been established.');

});
primus.on('error', function error(err) {
    console.log('error', 'Erorr', 'An unknown error has occured <code>' + err.message + '</code>');
});
primus.on('end', function end() {

    addMessage("connection ended by server");

});
primus.on('close', function end() {
    console.log('close', 'close', 'We\'ve lost the connection to the server.');
});