(() => {
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

  // const dragArea = {
  //   minX: 0,
  //   minY: 0,
  //   maxX: 100,
  //   maxY: 100,
  // };

  // ################  OUTGOING  Chat
  function sendText() {
    const txt = $('#box').val();
    if (txt !== '') {
      primus.write(JSON.stringify({ txt }));
      $('#box').val('');
    }
  }

  $('#sendText').on('click', () => { sendText(); });
  $('#box').on('keypress', (evt) => {
    if (evt.which === 13) {
      sendText();
    }
  });

  const filterInput = inpVal => inpVal.replace(/[^A-Za-z0-9äöüÄÖÜß!'"?,.\- ]/g, '');
  $('#box').on('keyup', () => $('#box').val(filterInput($('#box').val())));


  // ##################### OUTGOING Turns, Reset

  $('#endTurn').prop('disabled', true);

  $('#endTurn').on('click', () => {
    primus.write(JSON.stringify({ endturn: true }));
  });

  $('#newPartner').on('click', () => {
    primus.write(JSON.stringify({ reset: true }));
    // reload will restart the WS connection, which seems necessary
    location.reload();
  });

  // ===========================================
  // =====================  INCOMING WS Handler

  function getGroup(event) {
    const tg = event.target;
    if (tg.firstChild == null) {
      return tg.parentElement.instance;
    }
    return tg.instance;
  }

  const boardImages = new Set();

  function clickHandler(event) {
    const grp = getGroup(event);
    const rect = grp.node.firstChild.instance;
    const img = grp.node.lastChild.instance;
    // img.front();
    const selected = !grp.data('selected');
    grp.data('selected', selected);
    if (selected) {
      img.opacity(0.5);
      rect.fill('red');
    } else {
      img.opacity(1);
      rect.fill('black');
    }
    primus.write(JSON.stringify({
      act: 'click',
      id: grp.id().substring(3),
      selected,
    }));
    // group.on('mouseover', (event) => {
    //   const grp = getGroup(event);
    //   grp.front();
    //   grp.scale(2, 2);
    // });
    // group.on('mouseout', (event) => {
    //   const grp = getGroup(event);
    //   grp.scale(1, 1);
    // });
    // group.draggable(dragArea);
    // group.on('dragstart', (event) => {
    //   event.target.instance.front();
    // });
  }

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
      if (boardImages.size === 0) {
        // first time drawing 
        for (let i = 0; i < imageIds.length; i += 1) {
          const imgId = imageIds[i];
          boardImages.add(imgId);
          const row = Math.trunc(i / 4);
          const col = i % 4;
          const group = draw.group();
          // for contrast and as selection indicator
          group.rect(21, 21);
          group.id(`img${imgId}`);
          group.data('selected', false);
          group.move(col * 25 + 2, row * 25 + 2);
          const image = group.image(`g${data.gameId}/i${imgId}.png`);
          image.size(20, 20).move(0.5, 0.5);
        }
      } else {
        // remove delete images
        const turnImages = new Set(imageIds);
        boardImages.forEach((elem) => {
          if (!turnImages.has(elem)) {
            $(`#img${elem}`).remove();
          }
        });
      }
      if (data.turn) {
        for (let i = 0; i < imageIds.length; i += 1) {
          const group = $(`#img${imageIds[i]}`);
          group.on('click', (event) => { clickHandler(event); });
        }
        $('#endTurn').prop('disabled', false);
      } else {
        for (let i = 0; i < imageIds.length; i += 1) {
          const group = $(`#img${imageIds[i]}`);
          group.off('click');
        }
        $('#endTurn').prop('disabled', true);
      }
      $('#turncount').text(data.turnCount);
      $('#undos').text(data.undosLeft);
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
}).call(this);
