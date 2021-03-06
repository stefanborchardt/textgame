(() => {
  const ANIMSPD = 120;
  const GRIDDIM = 4;
  const IMGSIZE = 20;
  const MARGIN = 4;
  const CLICKZOOM = 1.1;
  const HOVERZOOM = 1.6;

  const primus = Primus.connect(`${location.origin}`);

  // ######################## initially hide control elements

  $('#endTurn').hide();
  $('#extras').hide();
  $('#write').hide();
  $('#status').hide();
  $('#next').hide();
  $('#skip').hide();
  $('#skip').attr('href', '/level2/back');

  // ######################## some UI functions

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

  // lets an element glow using css animation
  const animate = (selector, style) => {
    $(selector).addClass(style);
    // we could listen for 'animationend' to remove the class,
    // but then we would have to remove the listener afterwards
    setTimeout(() => {
      $(selector).removeClass(style);
    }, 150);
  };

  const glow = (selector) => {
    animate(selector, 'glow');
  };
  const warn = (selector) => {
    animate(selector, 'warn');
  };

  const askPermission = () => {
    if (Notification.permission === 'granted') {
      const notification = new Notification('Notification On');
      setTimeout(notification.close.bind(notification), 2000);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission((permission) => {
        if (permission === 'granted') {
          const notification = new Notification('Notification On');
          setTimeout(notification.close.bind(notification), 2000);
        }
      });
    }
  };
  // delegate event 
  $('#messages').on('click', '#notify', askPermission);

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
    // checkmark as selection indicator
    group.path('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z')
      .size(IMGSIZE * 0.8, IMGSIZE * 0.8);
    // zoom on hover
    group.on('mouseover', (event) => {
      // TODO also move images at edges a little to center
      const grp = getGroup(event);
      grp.front();
      grp.animate(ANIMSPD, easing).scale(HOVERZOOM, HOVERZOOM);
    });
    group.on('mouseout', (event) => {
      const grp = getGroup(event);
      grp.animate(ANIMSPD, easing).scale(1, 1);
    });
    const image = group.image(`img/${imgId}`);
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

  // ##################### OUTGOING Clicks

  function clickHandler(event) {
    const grp = getGroup(event);
    const img = grp.select('image');
    const selected = !grp.data('selected');
    grp.data('selected', selected);
    if (selected) {
      grp.animate(ANIMSPD, easing).scale(CLICKZOOM, CLICKZOOM)
        .animate(ANIMSPD, easing).scale(HOVERZOOM, HOVERZOOM);
      img.opacity(0.62);
    } else {
      grp.animate(ANIMSPD, easing).scale(CLICKZOOM, CLICKZOOM)
        .animate(ANIMSPD, easing).scale(HOVERZOOM, HOVERZOOM);
      img.opacity(1);
    }
    primus.write(JSON.stringify({
      act: 'click',
      id: grp.id().substring(3),
      selected,
    }));
  }

  // ################  OUTGOING  Chat

  function sendText() {
    // xss sanitizing on server
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

  // ##################### OUTGOING Turns, Reset

  $('#endTurn').on('click', () => {
    primus.write(JSON.stringify({ endturn: true }));
  });

  $('#undo').on('change', () => {
    const undo = $('#undo').prop('checked');
    primus.write(JSON.stringify({ act: 'extra', extra: { undo } }));
  });

  $('#joker').on('change', () => {
    const joker = $('#joker').prop('checked');
    primus.write(JSON.stringify({ act: 'extra', extra: { joker } }));
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
      $('#endTurn').show();
      $('#write').show();
      $('#status').show();
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
      $('#endTurn').show();
      $('#active').text('Your turn');
      $('#playerturn').prop('class', 'ownTurn');
    }
    else {
      for (let i = 0; i < imageIds.length; i += 1) {
        const group = SVG.get(`img${imageIds[i]}`);
        group.off('click', clickHandler);
      }
      $('#endTurn').hide();
      $('#active').text('Teammate\'s turn');
      $('#playerturn').prop('class', 'partnerTurn');
    }
    // extra actions
    $('.undo').hide();
    $('.joker').hide();
    $('#extras').hide();
    $('#undo').prop('checked', false);
    $('#undo-partner').prop('checked', false);
    $('#joker').prop('checked', false);
    $('#joker-partner').prop('checked', false);
    if (data.extra.undo) {
      $('.undo').show();
      $('#extras').show();
      glow('.undo');
    }
    if (data.extra.joker) {
      $('.joker').show();
      $('#extras').show();
      glow('.joker');
    }
    // status info
    $('#turncount').text(data.turnCount);
    $('#selects').text(data.selectionsLeft);
    $('#unqPlayer').text(data.playerUniqLeft);
    if (data.playerUniqDown) {
      warn('#unqPlayer');
    }
    $('#unqPartner').text(data.partnerUniqLeft);
    if (data.partnerUniqDown) {
      warn('#unqPartner');
    }
    $('#commonLeft').text(data.commonLeft);
    $('#totalUnique').text(2 * data.numUnique);
    glow('#selects');
    warn('#turncount');
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
      addMessage(`HOST: ${data.msg}`);
    } else if (data.updSelLeft !== undefined) {
      // update selections
      $('#selects').text(data.updSelLeft);
      if (data.updSelLeft === 0) {
        glow('#endTurn');
      } else if (data.updSelLeft < 0) {
        warn('#selects');
      }
    } else if (data.updExtras !== undefined) {
      // update partner extras
      $('#undo-partner').prop('checked', data.extra.undo);
      if (data.extra.undo) {
        glow('#undo-partner');
      } else {
        warn('#undo-partner');
      }
      $('#joker-partner').prop('checked', data.extra.joker);
      if (data.extra.joker) {
        glow('#joker-partner');
      } else {
        warn('#joker-partner');
      }
    } else if (data.ended !== undefined) {
      updateImages(data.board);
      $('#status').hide();
      $('#write').hide();
      $('#extras').hide();
      $('#endTurn').hide();
      $('li').remove();
      addMessage('HOST: Game ended. These are the unique images.');
      addMessage(`HOST: ${data.expl}`);
      addMessage('HOST: Continue in <a href="/level2">level 2</a>.');
      $('#active').text(`End of game. ${data.score} points.`);
      $('#playerturn').prop('class', 'ownTurn');
      $('.nextlink').prop('href', '/level2');
      $('#next').show();
    } else if (data.turn !== undefined) {
      // handle new turns
      handleTurnData(data);
    } else if (data.typing !== undefined) {
      if ($('.partnerTyping').length === 0) {
        addMessage(`${data.role}: typing...`, 'partnerTyping');
        setTimeout(() => {
          if ($('.partnerTyping').length > 0) {
            $('.partnerTyping').remove();
          }
        }, 3000);
      }
    } else if (data.notify !== undefined) {
      // a new game starts
      if (boardImages.size > 0) {
        // reload after server restart
        setTimeout(() => {
          $('#box').val('');
          location.reload();
        }, 200);
      }

      if (Notification.permission === 'granted') {
        const notification = new Notification('Found teammate!',
          { requireInteraction: true });
        // setTimeout(notification.close.bind(notification), 4000);
      }
    }
    $('#box').focus();
  });
}).call(this);
