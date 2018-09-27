const primus = Primus.connect(location.origin);

const addMessage = (text) => {
  const newLi = document.createElement('li');
  newLi.innerHTML = text;
  $('#messages').append(newLi);
  newLi.scrollIntoView(false);
  return true;
};

// ########################  SVG

const draw = SVG('drawing').viewbox(0, 0, 100, 100);

const dragArea = {
  minX: 0,
  minY: 0,
  maxX: 100,
  maxY: 100,
};

// ################  OUTGOING  Chat
class TextHandler {
  static send() {
    const txt = $('#box').val();
    if (txt !== '') {
      primus.write(JSON.stringify({ txt }));
      $('#box').val('');
    }
  }
}
$('#sendText').on('click', () => { TextHandler.send(); });
$('#box').on('keypress', (evt) => {
  if (evt.which === 13) {
    TextHandler.send();
  }
});

const filterInput = inpVal => inpVal.replace(/[^A-Za-z0-9äöüÄÖÜß!'"?,.\- ]/g, '');
$('#box').on('keyup', () => $('#box').val(filterInput($('#box').val())));


// ##################### OUTGOING Turns
class TurnHandler {
  static send() {
    primus.write(JSON.stringify({ turnover: true }));
  }
}

$('#endTurn').on('click', () => { primus.write(JSON.stringify({ endturn: true })); });
$('#newPartner').on('click', () => { primus.write(JSON.stringify({ reset: true })); });

// ===========================================
// =====================  INCOMING WS Handler
primus.on('data', (data) => {
  // expecting JSON here
  if (typeof data === 'string') {
    return;
  }

  if (data.txt !== undefined) {
    addMessage(`${data.role}: ${data.txt}`);
  } else if (data.msg !== undefined) {
    addMessage(`${data.msg} / ${data.info}`);
  } else if (data.turn !== undefined) {
    const imageIds = data.board;
    for (let i = 0; i < imageIds.length; i += 1) {
      const row = Math.trunc(i / 4);
      const col = i % 4;
      const imgId = imageIds[i];
      const group = draw.group();
      const rect = group.rect(21, 21);
      const image = group.image(`g${data.gameId}/i${imgId}.png`);
      image.data('id', imgId);
      image.data('selected', false);
      image.size(20, 20).move(0.5, 0.5);
      group.move(col * 25 + 2, row * 25 + 2);
      group.on('click', (event) => {
        const img = event.target.instance;
        // img.front();
        const selected = !img.data('selected');
        img.data('selected', selected);
        if (selected) {
          img.opacity(0.5);
          event.target.parentElement.firstChild.instance.fill('red');
        } else {
          img.opacity(1);
          event.target.parentElement.firstChild.instance.fill('black');
        }
        primus.write(JSON.stringify({
          act: 'click',
          elem: img.data('id'),
          selected,
        }));
      });
      // group.draggable(dragArea);
      // group.on('dragstart', (event) => {
      //   event.target.instance.front();
      // });
    }
  } else if (data.act !== undefined) {
    SVG.get(data.elem).move(data.x, data.y);
  } else if (data.turnover !== undefined) {
    if (data.turnover) {
      $('#endTurn').prop('disabled', false);
      addMessage('YOUR TURN');
    } else {
      $('#endTurn').prop('disabled', true);
      addMessage('TURN ENDED');
    }
  }
});

// =========================== further WS handlers

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
