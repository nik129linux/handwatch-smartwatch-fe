/* ==========================================================================
   stage.js — the page around the watch: atmosphere, headline, entrances
   Pointer bloom follows with a slow lerp; the serif headline reveals
   word by word (blur + rise). Desktop pointers and full motion only.
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

  function revealSoon() {
    var els = document.querySelectorAll('[data-blur]');
    for (var i = 0; i < els.length; i++) splitWords(els[i]);
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
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      node.style.setProperty('--bx', (cx * 24).toFixed(2) + 'px');
      node.style.setProperty('--by', (cy * 24).toFixed(2) + 'px');
      if (Math.abs(tx - cx) > 0.0004 || Math.abs(ty - cy) > 0.0004) {
        requestAnimationFrame(tick);
      } else { on = false; }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      revealSoon();
      bloom();
    });
  } else {
    revealSoon();
    bloom();
  }
})();
