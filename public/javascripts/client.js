/* global location, WebSocket */
var host = location.origin.replace(/^https/, 'wss')
var primus = Primus.connect(location.origin);


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
primus.on('data', function incoming(data) {
    console.log(performance.now());
    console.log('data', 'Received data', 'string' === typeof data ? data : '<pre><code>' + JSON.stringify(data, null, 2) + '</code></pre>');
});
primus.on('end', function end() {
    console.log('end', 'End', 'The connection has ended.');

});
primus.on('close', function end() {
    console.log('close', 'close', 'We\'ve lost the connection to the server.');
});



$('#send').on("click", function(event) {
    console.log('submit');
    console.log(performance.now());
    primus.write('message');
});