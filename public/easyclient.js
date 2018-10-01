(() => {
  const primus = Primus.connect(`${location.origin}`);

  const addMessage = (text) => {
    const newLi = document.createElement('li');
    newLi.innerHTML = text;
    $('#messages').append(newLi);
    newLi.scrollIntoView(false);
    return true;
  };

  // ########################  SVG

  const draw = SVG('drawing').viewbox(0, 0, 100, 100);

  // animation
  const easing = (pos) => {
    if (pos === 1) {
      return 1;
    }
    return Math.sin(pos * Math.PI / 2);
  };

  const ANIMSPD = 100;

  function getGroup(event) {
    const tg = event.target;
    if (tg.firstChild == null) {
      return tg.parentElement.instance;
    }
    return tg.instance;
  }

  const boardImages = new Set();

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
    // reload to restart the game with a new partner
    setTimeout(() => {
      location.reload();
    }, 200);
  });

  // ===========================================
  // =====================  INCOMING WS Handler

  function clickHandler(event) {
    const grp = getGroup(event);
    const rect = grp.node.firstChild.instance;
    const img = grp.node.lastChild.instance;
    const selected = !grp.data('selected');
    grp.data('selected', selected);
    if (selected) {
      grp.animate(ANIMSPD, easing).scale(1.5, 1.5).animate(ANIMSPD, easing).scale(2, 2);
      img.opacity(0.4);
      rect.fill('red');
    } else {
      grp.animate(ANIMSPD, easing).scale(1.5, 1.5).animate(ANIMSPD, easing).scale(2, 2);
      img.opacity(1);
      rect.fill('black');
    }
    primus.write(JSON.stringify({
      act: 'click',
      id: grp.id().substring(3),
      selected,
    }));
  }

  primus.on('data', (data) => {
    // expecting JSON here
    if (typeof data === 'string') {
      return;
    }

    if (data.txt !== undefined) {
      addMessage(`${data.role}: ${data.txt}`);
    } else if (data.msg !== undefined) {
      addMessage(`MODERATOR: ${data.msg}`);
    } else if (data.updSelLeft !== undefined) {
      $('#selects').text(data.updSelLeft);
    } else if (data.turn !== undefined) {
      const imageIds = data.board;
      if (boardImages.size === 0) {
        // first time drawing
        const GRIDDIM = 3;
        const IMGSIZE = 25;
        const MARGIN = 6;
        for (let i = 0; i < imageIds.length; i += 1) {
          const imgId = imageIds[i];
          boardImages.add(imgId);
          const row = Math.trunc(i / GRIDDIM);
          const col = i % GRIDDIM;
          const group = draw.group();
          // rect as selection indicator
          group.rect(IMGSIZE, IMGSIZE);
          group.id(`img${imgId}`);
          group.data('selected', false);
          group.move(col * (IMGSIZE + MARGIN) + MARGIN,
            row * (IMGSIZE + MARGIN) + MARGIN);
          group.on('mouseover', (event) => {
            // TODO also move images at edges a little to center
            const grp = getGroup(event);
            grp.front();
            grp.animate(ANIMSPD, easing).scale(2, 2);
          });
          group.on('mouseout', (event) => {
            const grp = getGroup(event);
            grp.animate(ANIMSPD, easing).scale(1, 1);
          });
          const image = group.image(`g1/${imgId}.jpg`);
          image.size(IMGSIZE, IMGSIZE);
        }
      } else {
        // remove deleted images
        const turnImages = new Set(imageIds);
        boardImages.forEach((elem) => {
          if (!turnImages.has(elem)) {
            const grp = $(`#img${elem}`)[0].instance;
            new Promise(() => {
              grp.animate(250, easing).scale(1.5, 1.5).animate(250, easing).scale(0, 0);
            }).then(() => {
              $(`#img${elem}`).remove();
            });
          }
        });
      }
      if (data.turn) {
        for (let i = 0; i < imageIds.length; i += 1) {
          const group = $(`#img${imageIds[i]}`);
          group.on('click', (event) => { clickHandler(event); });
        }
        $('#endTurn').prop('disabled', false);
        addMessage('Nächster Zug');
      } else {
        for (let i = 0; i < imageIds.length; i += 1) {
          const group = $(`#img${imageIds[i]}`);
          group.off('click');
        }
        $('#endTurn').prop('disabled', true);
      }
      $('#turncount').text(data.turnCount);
      $('#undos').text(data.undosLeft);
      $('#selects').text(data.selectionsLeft);
      $('#unqA').text(data.uniqueLeftA);
      $('#unqB').text(data.uniqueLeftB);
    }
  });
}).call(this);
