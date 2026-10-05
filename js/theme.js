/* ==========================================================================
   theme.js — light / dark switch
   Default = prefers-color-scheme; persisted in localStorage (try/catch);
   shared between index.html and unit.html through the same key.
   Runs synchronously in <head> so the first paint already has the theme.
   Exposes window.__toggleTheme (used by the Electron accelerator) and
   window.__setTheme (used by the acceptance run).
   ========================================================================== */

(function () {
  'use strict';

  var KEY = 'handwatch-theme';

  function stored() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { window.localStorage.setItem(KEY, v); } catch (e) { /* private mode */ }
  }
  function system() {
    return (window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  function current() {
    var s = stored();
    return (s === 'light' || s === 'dark') ? s : system();
  }

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
    }
  }

  /* Circular reveal from the toggle point (View Transitions API);
     falls back to the 300ms expo crossover. Always cleans up: no class,
     no inline var left behind. */
  function toggle(ev) {
    var next = document.documentElement.getAttribute('data-theme') === 'light'
      ? 'dark' : 'light';

    var x = window.innerWidth - 60, y = 60;
    try {
      var btn = (ev && ev.currentTarget) ||
        document.querySelector('.theme-toggle');
      if (btn && btn.getBoundingClientRect) {
        var r = btn.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
    } catch (e) { /* fallback point stands */ }

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduce && document.startViewTransition) {
      document.documentElement.style.setProperty('--vtx', Math.round(x) + 'px');
      document.documentElement.style.setProperty('--vty', Math.round(y) + 'px');
      var tr = document.startViewTransition(function () {
        apply(next);
        save(next);
      });
      tr.finished.then(cleanupVT, cleanupVT);
      return next;
    }

    /* fallback: 300ms expo crossover while the tokens swap underneath */
    document.documentElement.classList.add('is-switching');
    apply(next);
    save(next);
    window.setTimeout(function () {
      document.documentElement.classList.remove('is-switching');
    }, 340);
    return next;
  }

  function cleanupVT() {
    try {
      document.documentElement.style.removeProperty('--vtx');
      document.documentElement.style.removeProperty('--vty');
    } catch (e) { /* already clean */ }
  }

  apply(current());

  function bind() {
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', toggle);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.__toggleTheme = toggle;
  window.__setTheme = function (t) {
    if (t !== 'light' && t !== 'dark') return current();
    apply(t);
    save(t);
    return t;
  };
})();
