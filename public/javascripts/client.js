const primus = Primus.connect(location.origin);

const addMessage = (text) => {
  const newLi = document.createElement('li');
  newLi.innerHTML = text;
  $('#messages').append(newLi);
  return true;
};

primus.on('data', (data) => {
  // expecting JSON here
  if (typeof data === 'string') {
    return;
  }
  
  if (data.txt !== undefined) {
    addMessage(`${data.role}: ${data.txt}`);
  } else if (data.msg !== undefined) {
    addMessage(`${data.msg} / ${data.info}`);
  }
});

class Send {
  static text() {
    const txt = $('#box').val();
    if (txt !== '') {
      primus.write(JSON.stringify({ txt }));
      $('#box').val('');
    }
  }
}

$('#sendText').on('click', () => { Send.text(); });
$('#box').on('keypress', (evt) => {
  if (evt.which === 13) {
    Send.text();
  }
});

const filterInput = (inpVal) => {
  return inpVal.replace(/[^A-Za-z0-9äöüÄÖÜß!\'\"\?\,\.\- ]/g, '');
};


$('#box').on('keyup', () => {
  $('#box').val(filterInput($('#box').val()));
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

  addMessage('connection ended by server');
});
primus.on('close', () => {
  console.log('close', 'close', 'We\'ve lost the connection to the server.');
});

// #####################################################

let draw = SVG('drawing').size(300, 300);
let rect = draw.rect(100, 100).attr({ fill: '#f06' });
