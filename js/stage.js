/* ==========================================================================
   stage.js — the page around the watch: atmosphere, headline, entrances
   - pointer bloom (slow lerp) + state-driven bloom (pulse/breathe/muted)
   - the watch as a physical object: pointer tilt via a damped spring
     (+-8deg), specular glare that follows the pointer. Desktop pointers
     and full motion only; hidden tabs pause every loop.
   - Mostar-style scroll choreography: [data-io] reveals, staggered by
     the same 60ms token step; the unit notice docks after first scroll.
   ========================================================================== */

(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  /* --- blur-in headline: one span per word, staggered by token step --- */
  function splitWords(el) {
    var words = (el.textContent || '').trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'blur-word';
      s.style.setProperty('--i', String(i));
      s.textContent = w;
      el.appendChild(s);
      el.appendChild(document.createTextNode(' '));
    });
  }

  /* Rich word split: same blur-word spans, but keeps inline markup
     (the unit statement colors "the process" differently). */
  function splitWordsRich(el) {
    var i = 0;
    function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (kid) {
        if (kid.nodeType === 3) {
          var frag = document.createDocumentFragment();
          String(kid.textContent).split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
            } else {
              var s = document.createElement('span');
              s.className = 'blur-word';
              s.style.setProperty('--i', String(i++));
              s.textContent = part;
              frag.appendChild(s);
            }
          });
          node.replaceChild(frag, kid);
        } else if (kid.nodeType === 1) {
          walk(kid);
        }
      });
    }
    walk(el);
  }

  function revealSoon() {
    var els = document.querySelectorAll('[data-blur]');
    for (var i = 0; i < els.length; i++) splitWords(els[i]);
    var rich = document.querySelectorAll('[data-words]');
    for (var k = 0; k < rich.length; k++) splitWordsRich(rich[k]);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.add('is-ready');
      });
    });
  }

  /* --- bloom follows the pointer: slow lerp, small travel --- */
  function bloom() {
    var node = document.getElementById('bloom');
    if (!node || reduce || !fine) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, on = false;
    window.addEventListener('pointermove', function (ev) {
      tx = ev.clientX / window.innerWidth - 0.5;
      ty = ev.clientY / window.innerHeight - 0.5;
      if (!on) { on = true; tick(); }
    }, { passive: true });
    function tick() {
      if (document.hidden) { on = false; return; }
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      node.style.setProperty('--bx', (cx * 24).toFixed(2) + 'px');
      node.style.setProperty('--by', (cy * 24).toFixed(2) + 'px');
      if (Math.abs(tx - cx) > 0.0004 || Math.abs(ty - cy) > 0.0004) {
        requestAnimationFrame(tick);
      } else { on = false; }
    }
  }

  /* --- the watch as a physical object ------------------------------------
     One smoothed value per input axis, written to --rx/--ry/--gx/--gy.
     A hand-written damped spring (stiffness/damping, semi-implicit Euler):
     critically-damped-ish, so it settles without oscillating. Max +-8deg.
     Reduced motion, coarse pointers and hidden tabs: no tilt, static glare.
     Exposes window.__tilt for the acceptance run. */
  function tilt() {
    var frame = document.getElementById('stageWatch');
    var watchEl = document.getElementById('watch');
    var screen = document.getElementById('screen');
    if (!frame || !watchEl || reduce || !fine) return;

    var DEG = 8;
    var K = 120;    /* stiffness */
    var C = 16;     /* damping (near-critical for this stiffness) */

    var st = { x: 0, vx: 0, y: 0, vy: 0, gx: 32, gy: 18, vgx: 0, vgy: 0 };
    var tx = 0, ty = 0, tgx = 32, tgy = 18;
    var raf = null;
    var last = 0;

    function targets(ev) {
      var r = watchEl.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = (ev.clientX - cx) / Math.max(1, window.innerWidth / 2);
      var dy = (ev.clientY - cy) / Math.max(1, window.innerHeight / 2);
      dx = Math.max(-1, Math.min(1, dx));
      dy = Math.max(-1, Math.min(1, dy));
      /* rotate toward the pointer, capped at +-8deg */
      tx = (dx * DEG).toFixed(3);
      ty = (-dy * DEG).toFixed(3);
      /* glare center drifts across the glass with the pointer */
      tgx = 32 + dx * 36;
      tgy = 18 + dy * 30;
    }

    function step(t) {
      if (document.hidden) { raf = null; return; }
      var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      var settled = true;

      [['x', 'vx', tx], ['y', 'vy', ty]].forEach(function (a) {
        var k = a[0], v = a[1], tgt = parseFloat(a[2]);
        var f = -K * (st[k] - tgt) - C * st[v];
        st[v] += f * dt;
        st[k] += st[v] * dt;
        if (Math.abs(st[k] - tgt) > 0.01 || Math.abs(st[v]) > 0.01) settled = false;
      });
      [['gx', 'vgx', tgx], ['gy', 'vgy', tgy]].forEach(function (a) {
        var k = a[0], v = a[1], tgt = a[2];
        var f = -K * (st[k] - tgt) - C * st[v];
        st[v] += f * dt;
        st[k] += st[v] * dt;
        if (Math.abs(st[k] - tgt) > 0.05 || Math.abs(st[v]) > 0.05) settled = false;
      });

      watchEl.style.setProperty('--ry', st.x.toFixed(3) + 'deg');
      watchEl.style.setProperty('--rx', st.y.toFixed(3) + 'deg');
      if (screen) {
        screen.style.setProperty('--gx', st.gx.toFixed(2) + '%');
        screen.style.setProperty('--gy', st.gy.toFixed(2) + '%');
      }
      if (!settled) {
        raf = requestAnimationFrame(step);
      } else { raf = null; }
    }

    function kick(ev) {
      targets(ev);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    }

    window.addEventListener('pointermove', kick, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !raf &&
        (Math.abs(st.x - parseFloat(tx)) > 0.01 || Math.abs(st.y - parseFloat(ty)) > 0.01)) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    });
    window.__tilt = st;
  }

  /* --- state-driven atmosphere -------------------------------------------
     ok -> one soft primary pulse. doubtful -> slow neutral breathe while
     the doubt screen is open. paused -> desaturated. end of shift ->
     the bloom settles. No red, ever: only primary + neutral tokens. */
  function atmosphere() {
    var node = document.getElementById('bloom');
    if (!node) return;

    function pulse() {
      if (reduce) return;
      node.classList.remove('is-pulse');
      void node.offsetWidth;
      node.classList.add('is-pulse');
      window.setTimeout(function () { node.classList.remove('is-pulse'); }, 950);
    }
    document.addEventListener('haptic:play', function (ev) {
      var name = ev.detail && ev.detail.name;
      if (name === 'ok') pulse();
      if (name === 'doubtful' && !reduce) node.classList.add('is-breathe');
      if (name === 'end') {
        node.classList.remove('is-breathe', 'is-muted');
        node.classList.add('is-settled');
      }
    });
    document.addEventListener('watch:screen', function (ev) {
      var s = ev.detail && ev.detail.screen;
      if (s === 'home' || s === 'quien') node.classList.remove('is-breathe');
      if (s !== 'fin') node.classList.remove('is-settled');
    });
    document.addEventListener('watch:pause', function (ev) {
      node.classList.toggle('is-muted', !!(ev.detail && ev.detail.paused));
    });
  }

  /* --- Mostar scroll choreography: IO-driven reveals --------------------- */
  function reveals() {
    var els = document.querySelectorAll('[data-io]');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (var k = 0; k < els.length; k++) io.observe(els[k]);
  }

  /* --- the "no names" notice slides in after the first scroll ------------ */
  function notice() {
    var n = document.querySelector('.unotice');
    if (!n) return;
    if (reduce) { n.classList.add('is-docked'); return; }
    function dock() {
      if (window.scrollY > 40) {
        n.classList.add('is-docked');
        window.removeEventListener('scroll', dock);
      }
    }
    if (window.scrollY > 40) n.classList.add('is-docked');
    else window.addEventListener('scroll', dock, { passive: true });
  }

  function boot() {
    revealSoon();
    bloom();
    tilt();
    atmosphere();
    reveals();
    notice();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
