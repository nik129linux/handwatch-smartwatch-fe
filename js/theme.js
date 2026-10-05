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

  function toggle() {
    var next = document.documentElement.getAttribute('data-theme') === 'light'
      ? 'dark' : 'light';
    /* 300ms expo crossover while the tokens swap underneath */
    document.documentElement.classList.add('is-switching');
    apply(next);
    save(next);
    window.setTimeout(function () {
      document.documentElement.classList.remove('is-switching');
    }, 340);
    return next;
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
