/* global location, WebSocket */
const host = location.origin.replace(/^https/, 'wss');
const primus = Primus.connect(location.origin);

function addMessage(text) {
    const newLi = document.createElement('li');
    newLi.innerHTML = text;
    $('#messages').append(newLi);
}

primus.on('data', (data) => {
    // expecting JSON here
    if (typeof data === 'string') {
        return;
    }

    if (data.hasOwnProperty('txt')) {
        addMessage(`${data.txt} / ${data.sid}`);
    } else if (data.hasOwnProperty('msg')) {
        addMessage(`${data.msg} / ${data.sid}`);
    }
});


$('#send').on('click', (event) => {


    primus.write(JSON.stringify({
        txt: $('#box').val(),
    }));
    $('#box').val("");

});


primus.on('reconnect', () => {
    console.log('reconnect', 'Reconnect', 'Starting the reconnect attempt, hopefully we get a connection!');
});
primus.on('online', () => {
    console.log('network', 'Online', 'We have regained control over our internet connection.');
});
primus.on('offline', () => {
    console.log('network', 'Offline', 'We lost our internet connection.');
});
primus.on('open', () => {
    console.log('open', 'Open', 'The connection has been established.');

});
primus.on('error', (err) => {
    console.log('error', 'Erorr', `An unknown error has occured <code>${err.message}</code>`);
});
primus.on('end', () => {

    addMessage("connection ended by server");

});
primus.on('close', () => {
    console.log('close', 'close', 'We\'ve lost the connection to the server.');
});
