/* ==========================================================================
   watch.js — screen router, crown / side button, screen renderers
   The watch owns its state and its screens. story.js drives it through a bus.
   ========================================================================== */

var watch = (function () {
  'use strict';

  var REDUCED = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var PAUSE_MS = 30 * 60 * 1000;
  var HOME_RING = { size: 196, r: 82, w: 15, n: 12 };
  var EX = 240;   /* exit duration, mirrors --dur-exit */

  var state = {
    screen: 'home',
    done: 12,            /* moments met this shift  */
    plan: 15,            /* expected moments — the Home denominator */
    opportunities: 17,   /* moments that actually arose */
    corrections: 1,      /* wrong marks the nurse fixed herself */
    bed: 'Cama 3',
    doubtWhen: 'Al salir',
    pausedUntil: 0,
    events: [],
    now: Date.now(),
    washMs: 20000,
    speed: 1
  };

  var el = {};
  var current = null;
  var ticker = null;
  var washInt = null;
  var scaleVal = 1;
  var extraSpin = 0;     /* decaying extra crown rotation from wheel input */
  var spinRaf = null;

  /* ---------------------------------------------------------------- utils */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  /* `__timeScale` lets the guided story (and the acceptance run) compress the
     shift without changing a single duration constant. */
  function ms(n) {
    var s = window.__timeScale || 1;
    return REDUCED ? Math.min(n, 40) : Math.max(16, Math.round(n * s));
  }

  function clock() {
    var d = new Date(state.now);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function setClock(hh, mm) {
    var d = new Date(state.now);
    d.setHours(hh, mm, 0, 0);
    state.now = d.getTime();
    if (el.time) el.time.textContent = clock();
  }
  function isPaused() { return Date.now() < state.pausedUntil; }
  function pauseMs() { return window.__pauseMs || PAUSE_MS; }

  /* ---------------------------------------------------------------- glyphs */

  var GLYPH = {
    hands:
      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M4 30v-6a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v3"/>' +
      '<path d="M15 27v-8a3 3 0 0 1 6 0"/>' +
      '<path d="M21 27v-6a3 3 0 0 1 6 0"/>' +
      '<path d="M44 30v-6a3 3 0 0 0-3-3h-5a3 3 0 0 0-3 3v3"/>' +
      '<path d="M33 27v-8a3 3 0 0 0-6 0"/>' +
      '<path d="M27 27v-6a3 3 0 0 0-6 0"/>' +
      '<path d="M24 6s-5 6-5 8.6A5 5 0 0 0 24 19a5 5 0 0 0 5-4.4C29 12 24 6 24 6z" ' +
      'fill="currentColor" stroke="none"/></svg>',
    moon:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">' +
      '<path d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4 8.6 8.6 0 1 0 20.6 14.2z"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path class="check" d="M4 12.6 9.4 18 20 6.4"/></svg>',
    bell:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M6.5 17.4V11a5.5 5.5 0 1 1 11 0v6.4l1.8 2.2H4.7z"/>' +
      '<path d="M10 20.4a2.2 2.2 0 0 0 4 0"/></svg>',
    lock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<rect x="4.5" y="10.5" width="15" height="10" rx="3"/>' +
      '<path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>'
  };

  /* ---------------------------------------------------------------- rings */

  /* Segmented conic ring with gaps — the Stryds signature. Each segment is an
     arc that starts at 12 o'clock and is rotated into place, so the fill can
     animate segment by segment. */
  function segRing(o) {
    var size = o.size, r = o.r, w = o.w, n = o.n;
    var gapDeg = 7;
    var c = 2 * Math.PI * r;
    var stepDeg = 360 / n;
    var drawn = (c / n) * (1 - gapDeg / stepDeg);
    var cx = size / 2;

    function path(rotDeg) {
      var a1 = drawn / r;                       /* arc length → radians */
      var x0 = cx + r, y0 = cx;
      var x1 = cx + r * Math.cos(a1), y1 = cx + r * Math.sin(a1);
      return 'd="M' + x0.toFixed(2) + ' ' + y0.toFixed(2) +
        ' A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + '"' +
        ' transform="rotate(' + rotDeg.toFixed(2) + ' ' + cx + ' ' + cx + ')"';
    }

    var out = '<svg class="ring__svg" viewBox="0 0 ' + size + ' ' + size + '" ' +
      'aria-hidden="true" focusable="false">';
    for (var i = 0; i < n; i++) {
      out += '<path class="ring__seg ring__seg--track" ' +
        path(-90 + i * stepDeg) + ' stroke-width="' + w + '"></path>';
    }
    out += '</svg>';
    return { markup: out, drawn: drawn, n: n, circ: c };
  }

  /* The wash ring: a single circle. The only `linear` timing in the build lives
     in the CSS rule .wash-ring__arc, because this is a clock, not an animation. */
  function washRing(size, r, w) {
    var c = 2 * Math.PI * r;
    var cx = size / 2;
    return {
      circ: c,
      markup:
        '<svg class="ring__svg" viewBox="0 0 ' + size + ' ' + size + '" ' +
        'aria-hidden="true" focusable="false">' +
        '<circle class="ring__seg ring__seg--track" cx="' + cx + '" cy="' + cx + '" r="' + r +
        '" stroke-width="' + w + '" transform="rotate(-90 ' + cx + ' ' + cx + ')"></circle>' +
        '<circle class="ring__seg wash-ring__arc" cx="' + cx + '" cy="' + cx + '" r="' + r +
        '" stroke-width="' + w + '" transform="rotate(-90 ' + cx + ' ' + cx + ')" ' +
        'style="stroke-dasharray:' + c.toFixed(2) + ';--circ:' + c.toFixed(2) + '">' +
        '</circle></svg>'
    };
  }

  /* how much of segment i is lit, 0..1, and what it should be called */
  function fillOf(st, s, i) {
    return Math.max(0, Math.min(1, st.done / st.plan * s.n - i));
  }
  function segClass(f, isHead) {
    if (f <= 0) return 'ring__seg--track';
    return isHead ? 'ring__seg--head' : 'ring__seg--fill';
  }

  function countTo(node, to) {
    var from = parseInt(node.getAttribute('data-count') || '0', 10) || 0;
    node.setAttribute('data-count', String(to));
    if (from === to || REDUCED) { node.textContent = String(to); return; }
    var t0 = performance.now();
    (function step(t) {
      var p = Math.min(1, (t - t0) / 520);
      node.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------------------------------------------------------------- views */

  var VIEWS = {};

  /* 1 — Inicio */
  VIEWS.home = {
    title: 'Inicio',
    anim: 'zoom',
    build: function () {
      var s = segRing(HOME_RING);
      var recent = state.events.slice(-3).reverse();
      var rows = recent.length
        ? recent.map(function (e, i) {
            return '<li class="ev" style="--i:' + i + '">' +
              '<span class="ev__time">' + esc(e.time) + '</span>' +
              '<span class="ev__dot ev__dot--' + (e.kind === 'ok' ? 'ok' : 'you') + '"></span>' +
              '<span class="ev__text">' + esc(e.text) + '</span></li>';
          }).join('')
        : '<li class="ev" style="--i:0"><span class="ev__time">' + clock() + '</span>' +
          '<span class="ev__dot"></span><span class="ev__text">Sin novedades</span></li>';

      var foot = isPaused()
        ? '<button class="pill pill--secondary" data-act="resume">Reanudar avisos</button>'
        : '<button class="pill pill--ghost" data-act="pause">Pausa 30 min</button>';

      return '<div class="home__hero">' +
          '<div class="ring" style="--ring-size:' + HOME_RING.size + 'px">' + s.markup +
            '<div class="ring__center">' +
              '<div class="hero-num" data-count="' + state.done + '">' + state.done + '</div>' +
              '<div class="home__of">/ ' + state.plan + '</div>' +
            '</div></div>' +
          '<div class="home__headline">Momentos</div>' +
          '<div class="caption home__shift">Turno · Unidad 4B</div>' +
        '</div>' +
        '<div class="home__below">' +
          '<div class="home__label caption"><span>Últimos 3</span><span class="rule"></span></div>' +
          '<ul class="home__list">' + rows + '</ul>' +
        '</div>' +
        '<div class="screen__foot">' + foot + '</div>';
    },
    after: function (node) {
      var s = segRing(HOME_RING);
      el.count = node.querySelector('.hero-num');
      var paths = node.querySelectorAll('.ring__seg');
      var head = Math.ceil(state.done / state.plan * s.n) - 1;
      var i, f;
      /* start empty, then let the transition draw the segments in */
      for (i = 0; i < paths.length; i++) {
        f = fillOf(state, s, i);
        paths[i].setAttribute('class', 'ring__seg ' + segClass(f, i === head));
        paths[i].style.strokeDasharray = '0 ' + s.drawn.toFixed(2);
      }
      for (i = 0; i < paths.length; i++) void paths[i].getBoundingClientRect();
      for (i = 0; i < paths.length; i++) {
        f = fillOf(state, s, i);
        paths[i].style.strokeDasharray =
          (s.drawn * f).toFixed(2) + ' ' + s.drawn.toFixed(2);
      }
    }
  };

  /* 2 — Recordatorio */
  VIEWS.recordatorio = {
    title: 'Recordatorio',
    anim: 'alert',
    build: function () {
      return '<div class="alert__glyph">' + GLYPH.hands + '</div>' +
        '<div class="alert__lines">' +
          '<div class="title">Antes del paciente</div>' +
          '<div class="caption">' + esc(state.bed) + '</div>' +
        '</div>' +
        '<div class="screen__foot">' +
          '<button class="pill pill--primary" data-act="done">Ya lo hice</button>' +
        '</div>';
    }
  };

  /* 3 — Lavando */
  VIEWS.lavando = {
    title: 'Lavando',
    anim: 'fwd',
    build: function () {
      var w = washRing(240, 104, 9);
      return '<div class="wash">' +
          '<div class="ring wash-ring" style="--ring-size:240px">' + w.markup +
            '<div class="ring__center"><div class="wash__sec" data-secs>20</div></div>' +
          '</div>' +
          '<div class="caption wash__cap">Lavado detectado</div>' +
          (state.speed > 1
            ? '<div class="caption caption--dim" data-speed>×' + state.speed + '</div>'
            : '') +
        '</div>' +
        '<div class="screen__foot" id="washFoot"></div>';
    }
  };

  /* 4 — ¿Te lavaste? */
  VIEWS.dudoso = {
    title: 'Confirmar',
    anim: 'alert',
    build: function () {
      return '<div class="doubt__lines">' +
          '<div class="title">' + esc(state.doubtWhen) + '</div>' +
          '<div class="caption">' + esc(state.bed) + '</div>' +
          '<div class="doubt__q">¿Te lavaste?</div>' +
          '<div class="caption caption--dim">No estoy seguro</div>' +
        '</div>' +
        '<div class="screen__foot">' +
          '<button class="pill pill--primary" data-act="doubt-yes">Sí, me lavé</button>' +
          '<button class="pill pill--secondary" data-act="doubt-no">No alcancé</button>' +
        '</div>';
    }
  };

  /* 5 — Fin de turno */
  VIEWS.fin = {
    title: 'Fin de turno',
    anim: 'fwd',
    build: function () {
      var one = state.corrections === 1;
      return '<div class="caption caption--center">Turno · Unidad 4B</div>' +
        '<div class="shift__rows">' +
          '<div class="shift__row">' +
            '<span class="num">' + state.done + ' de ' + state.opportunities + '</span>' +
            '<span class="caption">momentos</span></div>' +
          '<div class="shift__row">' +
            '<span class="num num--accent">' + state.corrections + '</span>' +
            '<span class="caption">' + (one ? 'corregido' : 'corregidos') +
            '<br>por ti</span></div>' +
        '</div>' +
        '<div class="shift__note caption">Este detalle solo lo ves tú. Se borra en 24 h.</div>' +
        '<div class="screen__foot">' +
          '<button class="pill pill--ghost" data-act="home">Volver al inicio</button>' +
        '</div>';
    }
  };

  /* 6 — Quién ve esto */
  VIEWS.quien = {
    title: 'Quién ve esto',
    anim: 'fwd',
    build: function () {
      var rows = [
        ['Tú', 'cada evento, 24 horas', 'you'],
        ['Control de infecciones', 'totales de la unidad, sin nombres', ''],
        ['Nadie', 'tu ubicación', '']
      ];
      return '<div class="who__rows">' +
          rows.map(function (r, i) {
            return '<div class="who' + (r[2] ? ' who--' + r[2] : '') + '" style="--i:' + i + '">' +
              '<span class="who__mark"></span><span class="who__body">' +
              '<span class="who__who">' + esc(r[0]) + '</span>' +
              '<span class="who__what">' + esc(r[1]) + '</span></span></div>';
          }).join('') +
        '</div>' +
        '<div class="screen__foot">' +
          '<button class="pill pill--ghost" data-act="back">Cerrar</button>' +
        '</div>';
    }
  };

  /* 7 — Pausa */
  VIEWS.pausa = {
    title: 'Pausa',
    anim: 'fwd',
    build: function () {
      return '<div class="pause__glyph">' + GLYPH.bell + '</div>' +
        '<div class="doubt__lines">' +
          '<div class="title">Silenciar 30 min</div>' +
          '<div class="caption">Para un código o una emergencia</div>' +
          '<div class="pause__count" data-pausecount>30:00</div>' +
        '</div>' +
        '<div class="screen__foot">' +
          '<button class="pill pill--primary" data-act="back">Volver</button>' +
        '</div>';
    },
    tick: function (node) {
      var n = node.querySelector('[data-pausecount]');
      if (!n) return;
      var left = Math.max(0, state.pausedUntil - Date.now());
      n.textContent = pad2(Math.floor(left / 60000)) + ':' + pad2(Math.floor(left / 1000) % 60);
    }
  };

  /* ---------------------------------------------------------------- router */

  function animateIn(node, dir) {
    node.style.position = 'absolute';
    node.style.inset = '0';
    node.style.zIndex = '2';
    node.setAttribute('data-anim', 'in-' + dir);
    window.setTimeout(function () {
      if (!node.isConnected) return;
      node.style.position = '';
      node.style.inset = '';
      node.style.zIndex = '';
      node.removeAttribute('data-anim');
    }, ms(480));
  }

  function go(name, dir, opts) {
    var def = VIEWS[name];
    if (!def) return null;
    opts = opts || {};
    var from = current;
    var prevScreen = state.screen;

    if (prevScreen !== name && name !== 'home') {
      pushTrail(prevScreen);
    } else if (name === 'home') {
      trail.length = 0;
    }

    state.screen = name;
    el.screen.dataset.screen = name;
    el.title.textContent = def.title;
    syncPaused();

    var node = document.createElement('section');
    node.className = 'view';
    node.setAttribute('data-screen', name);
    node.setAttribute('data-title', def.title);
    node.innerHTML = def.build();

    el.viewport.appendChild(node);
    if (def.after) def.after(node);

    if (from) {
      from.setAttribute('data-anim', 'out-' + (dir || def.anim || 'zoom'));
      window.setTimeout(function () {
        if (from.parentNode) from.parentNode.removeChild(from);
      }, ms(EX + 20));
    }

    animateIn(node, dir || def.anim || 'zoom');
    if (from && opts.keepScroll) el.viewport.scrollTop = opts.keepScroll;
    else el.viewport.scrollTop = 0;
    current = node;

    if (ticker) { window.clearInterval(ticker); ticker = null; }
    if (def.tick) ticker = window.setInterval(function () { def.tick(node); }, 250);

    document.dispatchEvent(new CustomEvent('watch:screen', {
      detail: { screen: name, from: prevScreen }
    }));
    return node;
  }

  /* the back trail. Named `trail` so it cannot shadow window.history. */
  var trail = [];
  function pushTrail(s) {
    if (trail[trail.length - 1] !== s) trail.push(s);
    if (trail.length > 8) trail.shift();
  }

  function back() {
    if (state.screen === 'home') return;
    var prev = null;
    while (trail.length) {
      var cand = trail.pop();
      if (cand !== state.screen && VIEWS[cand]) { prev = cand; break; }
    }
    go(prev || 'home', 'back');
  }

  function home() { trail.length = 0; go('home', 'zoom'); }

  function refresh() { return go(state.screen, 'zoom', { keepScroll: el.viewport.scrollTop }); }

  /* Ring +1 (and the newest event) without rebuilding the screen. */
  function bump() {
    if (state.screen !== 'home' || !current) { refresh(); return; }
    var s = segRing(HOME_RING);
    var paths = current.querySelectorAll('.ring__seg');
    var head = Math.ceil(state.done / state.plan * s.n) - 1;
    for (var i = 0; i < paths.length; i++) {
      var f = fillOf(state, s, i);
      paths[i].setAttribute('class', 'ring__seg ' + segClass(f, i === head));
      paths[i].style.strokeDasharray =
        (s.drawn * f).toFixed(2) + ' ' + s.drawn.toFixed(2);
    }
    el.count = current.querySelector('.hero-num');
    if (el.count) countTo(el.count, state.done);

    var list = current.querySelector('.home__list');
    var last = state.events[state.events.length - 1];
    if (list && last) {
      var li = document.createElement('li');
      li.className = 'ev';
      li.innerHTML = '<span class="ev__time"></span><span class="ev__dot ev__dot--ok"></span>' +
        '<span class="ev__text"></span>';
      li.querySelector('.ev__time').textContent = last.time;
      li.querySelector('.ev__text').textContent = last.text;
      list.insertBefore(li, list.firstChild);
      var rows = list.querySelectorAll('.ev');
      for (var k = 0; k < rows.length; k++) rows[k].style.setProperty('--i', String(k));
      while (list.querySelectorAll('.ev').length > 3) {
        list.removeChild(list.querySelector('.ev:last-child'));
      }
    }
  }

  /* ---------------------------------------------------------------- wash */

  function startWash(opts) {
    opts = opts || {};
    state.speed = opts.speed || 1;
    var dur = ms(state.washMs / state.speed);
    var node = go('lavando', opts.dir || 'fwd');
    var arc = node.querySelector('.wash-ring__arc');
    var secs = node.querySelector('[data-secs]');
    var foot = node.querySelector('#washFoot');
    if (secs) secs.textContent = String(Math.round(dur / 1000));
    if (arc) arc.style.setProperty('--wash-dur', dur + 'ms');

    if (washInt) window.clearInterval(washInt);
    var t0 = Date.now();
    washInt = window.setInterval(function () {
      var left = dur - (Date.now() - t0);
      if (secs) secs.textContent = String(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        window.clearInterval(washInt);
        washInt = null;
        endWash(node, foot, arc);
      }
    }, 100);
    return node;
  }

  function endWash(node, foot, arc) {
    if (arc) arc.classList.add('wash-ring__arc--done');
    var wrap = node.querySelector('.wash-ring');
    if (wrap) {
      wrap.style.transition =
        'opacity 240ms var(--ease-exit), transform 240ms var(--ease-exit)';
      wrap.style.transform = 'scale(0.84)';
      wrap.style.opacity = '0';
    }
    if (foot) {
      foot.innerHTML = '<div class="wash__done"><span class="wash__check">' +
        GLYPH.check + '</span><span class="title">Listo</span></div>';
    }
    window.setTimeout(function () {
      var c = foot && foot.querySelector('.check');
      if (c) c.classList.add('is-drawn');
    }, ms(60));
    window.setTimeout(function () {
      haptics.play('ok');
      state.done += 1;
      addEvent({ text: 'Lavado · ' + state.bed, kind: 'ok' });
      bump();
    }, ms(820));
    window.setTimeout(function () { home(); }, ms(1560));
  }

  /* ---------------------------------------------------------------- events */

  function addEvent(ev) {
    var e = { time: clock(), text: ev.text, kind: ev.kind || 'you' };
    state.events.push(e);
    document.dispatchEvent(new CustomEvent('watch:log', { detail: e }));
  }

  function toast(msg) {
    el.toastText.textContent = msg;
    el.toast.classList.add('is-on');
    if (el.toastTimer) window.clearTimeout(el.toastTimer);
    el.toastTimer = window.setTimeout(function () {
      el.toast.classList.remove('is-on');
    }, 2600);
  }

  function pause() {
    state.pausedUntil = Date.now() + pauseMs();
    syncPaused();
    go('pausa', 'fwd');
  }
  function resume() {
    state.pausedUntil = 0;
    syncPaused();
  }
  /* one place that owns the paused look: the moon in the status bar, the Home
     pill, and the console indicator all follow this. */
  function syncPaused() {
    var on = isPaused();
    el.screen.classList.toggle('is-paused', on);
    document.dispatchEvent(new CustomEvent('watch:pause', { detail: { paused: on } }));
  }

  /* ---------------------------------------------------------------- crown */

  function paintSpin() {
    if (!el.crownCap) return;
    var base = el.viewport ? el.viewport.scrollTop * 0.42 : 0;
    el.crownCap.style.setProperty('--spin', (base + extraSpin).toFixed(2) + 'deg');
  }
  function decaySpin() {
    if (Math.abs(extraSpin) < 0.3) { extraSpin = 0; paintSpin(); spinRaf = null; return; }
    extraSpin *= 0.9;
    paintSpin();
    spinRaf = requestAnimationFrame(decaySpin);
  }
  function kick(delta) {
    if (REDUCED) return;
    extraSpin += delta;
    if (!spinRaf) spinRaf = requestAnimationFrame(decaySpin);
  }

  function scrollBy(px) {
    var v = el.viewport;
    var before = v.scrollTop;
    var max = v.scrollHeight - v.clientHeight;
    v.scrollTop = Math.max(0, Math.min(max, before + px));
    paintSpin();
    if (Math.abs(v.scrollTop - before) < 0.5) kick(px > 0 ? 14 : -14);
  }

  function bindCrown() {
    el.crown.addEventListener('click', function () { home(); });
    el.crown.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      scrollBy(ev.deltaY > 0 ? 30 : -30);
    }, { passive: false });
    el.crown.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); scrollBy(52); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); scrollBy(-52); }
    });
    el.crown.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    el.screen.addEventListener('wheel', function (ev) {
      if (ev.ctrlKey) return;
      scrollBy(ev.deltaY);
    }, { passive: true });
    el.viewport.addEventListener('scroll', paintSpin, { passive: true });
  }

  /* ---------------------------------------------------------------- actions */

  function act(name) {
    switch (name) {
      case 'done':
        state.done += 1;
        addEvent({ text: 'Marcado por ti · ' + state.bed, kind: 'ok' });
        toast('Anotado. Gracias.');
        haptics.play('ok');
        home();
        break;
      case 'doubt-yes':
        state.done += 1;
        state.corrections += 1;
        addEvent({ text: 'Corregido por ti · ' + state.bed, kind: 'ok' });
        haptics.play('ok');
        toast('Anotado. Gracias.');
        window.setTimeout(function () { home(); }, ms(460));
        break;
      case 'doubt-no':
        addEvent({ text: 'Solo para ti · ' + state.bed, kind: 'you' });
        toast('Queda solo para ti.');
        window.setTimeout(function () { home(); }, ms(460));
        break;
      case 'pause':
        pause();
        break;
      case 'resume':
        resume();
        toast('Avisos de nuevo.');
        home();
        break;
      case 'home':
        home();
        break;
      case 'back':
        back();
        break;
      case 'privacy':
        go('quien', 'fwd');
        break;
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------- mount */

  function mount() {
    el.watch = document.getElementById('watch');
    el.frame = document.getElementById('watchFrame');
    el.screen = document.getElementById('screen');
    el.viewport = document.getElementById('viewport');
    el.title = document.getElementById('statusTitle');
    el.time = document.getElementById('statusTime');
    el.toast = document.getElementById('toast');
    el.toastText = document.getElementById('toastText');
    el.crown = document.getElementById('crown');
    el.crownCap = document.querySelector('.crown-cap');
    el.side = document.getElementById('sideButton');

    if (el.time) el.time.textContent = clock();
    window.setInterval(function () {
      state.now += 30000;
      if (el.time) el.time.textContent = clock();
      syncPaused();
    }, 30000);

    bindCrown();

    el.screen.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (btn) act(btn.getAttribute('data-act'));
    });
    el.side.addEventListener('click', function () { go('quien', 'fwd'); });

    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      var t = ev.target && ev.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA') return;
      back();
    });

    go('home', 'zoom');
    paintSpin();
    fit();
  }

  /* Fit the whole watch into the stage with one transform. */
  function fit() {
    if (!el.watch || !el.frame) return;
    var needW = el.watch.offsetWidth / scaleVal;
    var needH = el.watch.offsetHeight / scaleVal;
    var availW = el.frame.clientWidth - 8;
    var availH = window.innerHeight - 300;
    scaleVal = Math.max(0.5, Math.min(1, availW / needW, availH / needH));
    el.frame.style.setProperty('--scale', scaleVal.toFixed(3));
  }

  return {
    state: state,
    GLYPH: GLYPH,
    VIEWS: VIEWS,
    mount: mount,
    fit: fit,
    go: go,
    back: back,
    home: home,
    refresh: refresh,
    bump: bump,
    act: act,
    pause: pause,
    resume: resume,
    toast: toast,
    addEvent: addEvent,
    startWash: startWash,
    isPaused: isPaused,
    syncPaused: syncPaused,
    setClock: setClock,
    clock: clock,
    el: el
  };
})();
