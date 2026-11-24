/* ==========================================================================
   theme.js — Claro / Oscuro / Sistema
   Default = light on a fresh profile (never the OS). The choice is stored
   as 'light' | 'dark' | 'system' in localStorage (try/catch) and shared by
   index.html and unit.html through the same key. 'system' follows
   prefers-color-scheme live.
   Runs synchronously in <head> so the first paint already has the theme.
   Exposes window.__toggleTheme (Electron accelerator / header shortcut),
   window.__setTheme (light|dark|system, used by tests and Settings) and
   window.__themePref (the stored choice).
   ========================================================================== */

(function () {
  'use strict';

  var KEY = 'handwatch-theme';
  var DEFAULT = 'light';
  var mq = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)')) || null;

  function stored() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { window.localStorage.setItem(KEY, v); } catch (e) { /* private mode */ }
  }
  function system() { return (mq && mq.matches) ? 'light' : 'dark'; }
  function pref() {
    var s = stored();
    return (s === 'light' || s === 'dark' || s === 'system') ? s : DEFAULT;
  }
  function current() {
    var p = pref();
    return p === 'system' ? system() : p;
  }

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
    }
    document.dispatchEvent(new CustomEvent('theme:change', {
      detail: { theme: t, pref: pref() }
    }));
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

  /* Settings uses this: light | dark | system, persisted as chosen. */
  function setTheme(v) {
    if (v !== 'light' && v !== 'dark' && v !== 'system') return pref();
    save(v);
    apply(v === 'system' ? system() : v);
    return v;
  }

  apply(current());

  /* 'Sistema' means live: follow the OS while it is selected. */
  try {
    var onSystem = function () { if (pref() === 'system') apply(system()); };
    if (mq && mq.addEventListener) mq.addEventListener('change', onSystem);
    else if (mq && mq.addListener) mq.addListener(onSystem);
  } catch (e) { /* older engine — the stored value still applies */ }

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
  window.__setTheme = setTheme;
  window.__themePref = pref;
})();
