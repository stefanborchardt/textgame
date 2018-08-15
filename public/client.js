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

class DragHandler {
  static sendDrag(event) {
    const elem = event.target;
    primus.write(JSON.stringify({
      act: 'drag',
      elem: elem.id,
      x: Math.round(elem.x.baseVal.value),
      y: Math.round(elem.y.baseVal.value),
    }));
  }

  static sendDragMove(event) {
    const elem = event.target;
    // console.log(Math.round(elem.x.baseVal.value));
    primus.write(JSON.stringify({
      act: 'drgmv',
      elem: elem.id,
      x: Math.round(elem.x.baseVal.value),
      y: Math.round(elem.y.baseVal.value),
    }));
  }

  static enableDrag(elem) {
    elem.draggable();
    elem.draggable(dragArea);
    elem.on('dragend', (event) => { DragHandler.sendDrag(event); });
    elem.on('dragmove', _.throttle(event => DragHandler.sendDragMove(event), 150, { leading: true }));
  }

  static disableDrag(elem) {
    elem.off('dragmove');
    elem.off('dragend');
    elem.draggable(false);
  }
}

const rect1 = draw.rect(10, 10).id('rect1').move(40, 50).attr({ fill: '#f06' });
const rect2 = draw.rect(20, 20).id('rect2').move(20, 5).attr({ fill: '#f60' });
const rect3 = draw.rect(10, 10).id('rect3').move(5, 20).attr({ fill: '#6f0' });

const allObjects = draw.set();
allObjects.add(rect1).add(rect2).add(rect3);

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

$('#endTurn').on('click', () => { TurnHandler.send(); });

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
  } else if (data.act !== undefined) {
    SVG.get(data.elem).move(data.x, data.y);
  } else if (data.turnover !== undefined) {
    if (data.turnover) {
      DragHandler.enableDrag(allObjects);
      $('#endTurn').prop('disabled', false);
      addMessage('YOUR TURN');
    } else {
      $('#endTurn').prop('disabled', true);
      DragHandler.disableDrag(allObjects);
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
