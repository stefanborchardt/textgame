(() => {
  const ANIMSPD = 150;
  const GRIDDIM = 3;
  const IMGSIZE = 25;
  const MARGIN = 6;
  const CLICKZOOM = 1.1;
  const HOVERZOOM = 1.6;
  const IMGDIR = 'g1';
  const NEXTLVL = 2;

  const primus = Primus.connect(`${location.origin}`);

  const addMessage = (text, className) => {
    const newLi = document.createElement('li');
    newLi.innerHTML = text;
    if (className) {
      newLi.className = className;
    }
    $('#messages').append(newLi);
    newLi.scrollIntoView(false);
    return true;
  };

  // ######################## initially hide control elements

  const hide = elemId => $(`#${elemId}`).css({ visibility: 'hidden' });
  const show = elemId => $(`#${elemId}`).css({ visibility: 'visible' });

  hide('endTurn');
  hide('extras');
  hide('write');
  hide('status');

  // ########################  SVG

  const draw = SVG('drawing').viewbox(0, 0, 100, 100);

  // animation
  const easing = (pos) => {
    if (pos === 1) {
      return 1;
    }
    return Math.sin(pos * Math.PI / 2);
  };

  function getGroup(event) {
    const tg = event.target;
    if (tg.firstChild == null) {
      return tg.parentElement.instance;
    }
    return tg.instance;
  }

  // hold currently displayed image ids
  const boardImages = new Set();

  function drawImage(i, imgId) {
    const row = Math.trunc(i / GRIDDIM);
    const col = i % GRIDDIM;
    const group = draw.group();
    group.id(`img${imgId}`);
    group.data('selected', false);
    group.move(col * (IMGSIZE + MARGIN) + MARGIN, row * (IMGSIZE + MARGIN) + MARGIN);
    // rect as selection indicator
    group.rect(IMGSIZE, IMGSIZE);
    // zoom on hover
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
    const image = group.image(`${IMGDIR}/${imgId}.jpg`);
    image.size(IMGSIZE, IMGSIZE);
    return group;
  }

  function updateImages(imageIds) {
    const turnImages = new Set(imageIds);
    boardImages.forEach((elem) => {
      const grp = SVG.get(`img${elem}`);
      if (!turnImages.has(elem)) {
        // hide
        new Promise((resolve) => {
          grp.animate(ANIMSPD, easing).scale(CLICKZOOM, CLICKZOOM)
            .animate(ANIMSPD, easing).scale(0.1, 0.1);
          grp.select('image').opacity(1);
          grp.select('rect').fill('black');
          resolve();
        }).then(() => {
          grp.hide();
        });
      } else if (!grp.visible()) {
        // show again
        new Promise((resolve) => {
          grp.show();
          resolve(grp);
        }).then(() => {
          grp.animate(ANIMSPD, easing).scale(CLICKZOOM, CLICKZOOM)
            .animate(ANIMSPD, easing).scale(1, 1);
        });
      }
    });
  }

  function clickHandler(event) {
    const grp = getGroup(event);
    const rect = grp.select('rect');
    const img = grp.select('image');
    const selected = !grp.data('selected');
    grp.data('selected', selected);
    if (selected) {
      grp.animate(ANIMSPD, easing).scale(CLICKZOOM, CLICKZOOM)
        .animate(ANIMSPD, easing).scale(HOVERZOOM, HOVERZOOM);
      img.opacity(0.4);
      rect.fill('red');
    } else {
      grp.animate(ANIMSPD, easing).scale(CLICKZOOM, CLICKZOOM)
        .animate(ANIMSPD, easing).scale(HOVERZOOM, HOVERZOOM);
      img.opacity(1);
      rect.fill('black');
    }
    primus.write(JSON.stringify({
      act: 'click',
      id: grp.id().substring(3),
      selected,
    }));
    $('#box').focus();
  }

  // ################  OUTGOING  Chat

  function sendText() {
    const txt = $('#box').val();
    if (txt !== '') {
      primus.write(JSON.stringify({ txt }));
      $('#box').val('');
    }
  }

  $('#sendText').on('click', () => { sendText(); });

  // using a variable in global scope for locking
  window.throttled = false;

  function throttleTyping() {
    if (!window.throttled) {
      window.throttled = true;
      primus.write(JSON.stringify({ act: 'typing' }));
      setTimeout(() => {
        window.throttled = false;
      }, 2000);
    }
  }
  const keyHandler = (evt) => {
    if (evt.which === 13) {
      sendText();
    } else {
      throttleTyping();
    }
  };

  $('#box').on('keypress', evt => keyHandler(evt));

  // TODO escape?
  const filterInput = inpVal => inpVal;
  $('#box').on('keyup', () => $('#box').val(filterInput($('#box').val())));


  // ##################### OUTGOING Turns, Reset

  $('#endTurn').on('click', () => {
    primus.write(JSON.stringify({ endturn: true }));
  });

  $('#sendExtra').on('click', () => {
    const undo = $('#undo').prop('checked');
    const joker = $('#joker').prop('checked');
    primus.write(JSON.stringify({ act: 'extra', extra: { undo, joker } }));
  });

  $('#newPartner').on('click', () => {
    primus.write(JSON.stringify({ reset: true }));
    // reload to restart the game with a new partner
    setTimeout(() => {
      $('#box').val('');
      location.reload();
    }, 200);
  });

  // ########################  SVG Incoming Turn

  function handleTurnData(data) {
    const imageIds = data.board;
    if (boardImages.size === 0) {
      // game state at begin of turn
      show('endTurn');
      show('write');
      show('status');
      // first time drawing
      for (let i = 0; i < imageIds.length; i += 1) {
        const imgId = imageIds[i];
        boardImages.add(imgId);
        drawImage(i, imgId);
      }
    } else {
      // hide or restore deleted images
      updateImages(imageIds);
    }
    // turn specific UI changes
    if (data.turn) {
      for (let i = 0; i < imageIds.length; i += 1) {
        const group = SVG.get(`img${imageIds[i]}`);
        // don't register twice
        group.off('click', clickHandler);
        group.on('click', clickHandler);
      }
      show('endturn');
      $('#active').text('Sie sind am Zug');
      $('#playerturn').attr('class', 'ownTurn');
    }
    else {
      for (let i = 0; i < imageIds.length; i += 1) {
        const group = SVG.get(`img${imageIds[i]}`);
        group.off('click', clickHandler);
      }
      hide('endturn');
      $('#active').text('Ihr Mitspieler ist am Zug');
      $('#playerturn').attr('class', 'partnerTurn');
    }
    // extra actions
    $('.undo').hide();
    $('.joker').hide();
    hide('extras');
    $('#undo').prop('checked', false);
    $('#undo-partner').prop('checked', false);
    $('#joker').prop('checked', false);
    $('#joker-partner').prop('checked', false);
    if (data.extra.undo) {
      $('.undo').show();
      show('extras');
    }
    if (data.extra.joker) {
      $('.joker').show();
      show('extras');
    }
    // status info
    $('#turncount').text(data.turnCount);
    $('#selects').text(data.selectionsLeft);
    $('#unqA').text(data.uniqueLeftA);
    $('#unqB').text(data.uniqueLeftB);
    $('#box').focus();
  }

  // ===========================================
  // =====================  INCOMING WS Handler

  primus.on('data', (data) => {
    // expecting JSON here
    if (typeof data === 'string') {
      return;
    }

    if (data.txt !== undefined) {
      // player messages
      if ($('.partnerTyping').length > 0) {
        $('.partnerTyping').remove();
      }
      const className = (data.ownMsg) ? 'ownMsg' : 'partnerMsg';
      addMessage(`${data.role}: ${data.txt}`, className);
    } else if (data.msg !== undefined) {
      // message from game
      addMessage(`MODERATOR: ${data.msg}`);
    } else if (data.updSelLeft !== undefined) {
      // update selections
      $('#selects').text(data.updSelLeft);
    } else if (data.updExtras !== undefined) {
      // update partner extra selects
      $('#undo-partner').prop('checked', data.extra.undo);
      $('#joker-partner').prop('checked', data.extra.joker);
    } else if (data.ended !== undefined) {
      // TODO
      updateImages(data.board);
      $('#status').hide();
      $('#write').hide();
      $('#extras').hide();
      $('#endTurn').hide();
      $('li').remove();
      addMessage('MODERATOR: Spiel beendet. Das sind die unterschiedlichen Bilder.');
      addMessage(`MODERATOR: ${data.expl}`);
      addMessage(`MODERATOR: Weiter im <a href="/level${NEXTLVL}">nächsten Level.</a>`);
      $('#active').text(`Spielende. ${data.score} Punkte.`);
      $('#playerturn').attr('class', 'ownTurn');
    } else if (data.turn !== undefined) {
      handleTurnData(data);
    } else if (data.typing !== undefined) {
      if ($('.partnerTyping').length === 0) {
        addMessage(`${data.role}: tippt...`, 'partnerTyping');
        setTimeout(() => {
          if ($('.partnerTyping').length > 0) {
            $('.partnerTyping').remove();
          }
        }, 3000);
      }
    }
  });
}).call(this);
