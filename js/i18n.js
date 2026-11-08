/* ==========================================================================
   i18n.js — English / Spanish switch for both pages.
   English is the source language: code and markup stay in English, and
   strings-es.js maps every visible string to Spanish. This script
   translates the static page once, then follows the live DOM
   (MutationObserver) so screens rendered later arrive translated too.

   Language: Spanish is the default on a fresh profile, always — the OS or
   navigator language never decides. The stored choice wins when it exists.
   Persisted in localStorage (try/catch), shared by both pages.

   Switching NEVER reloads the page: every text node and spoken attribute
   we translated keeps its English original in a WeakMap, so going back to
   English restores it in place; going to Spanish translates again. App
   state (the watch, the story, the log) is untouched. Screens that build
   strings in code re-render on the `i18n:change` event.

   Exposes window.I18N {lang, t, tr, set, toggle, apply, num, time, onChange}.
   Load order: strings-es.js, i18n.js, then every other body script.
   ========================================================================== */

var I18N = (function () {
  'use strict';

  var KEY = 'handwatch-lang';
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  var DICT = (typeof STRINGS_ES !== 'undefined') ? STRINGS_ES : { exact: {}, patterns: [] };
  var DEFAULT_LANG = 'es';

  function stored() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { window.localStorage.setItem(KEY, v); } catch (e) { /* private mode */ }
  }
  /* A fresh profile is Spanish, whatever the OS says. */
  function detect() {
    var s = stored();
    return (s === 'en' || s === 'es') ? s : DEFAULT_LANG;
  }

  var lang = (typeof window !== 'undefined') ? detect() : DEFAULT_LANG;
  var TITLE = (typeof document !== 'undefined') ? document.title : '';

  var origText = new WeakMap();     /* text node -> the English it had */
  var wroteText = new WeakMap();    /* text node -> the Spanish we wrote */
  var origAttrs = new WeakMap();    /* element -> {attr: English} */
  var wroteAttrs = new WeakMap();   /* element -> {attr: Spanish} */
  var listeners = [];

  /* translate one string; null when there is no Spanish for it */
  function tr(src) {
    if (src == null) return null;
    var key = String(src).replace(/\s+/g, ' ').trim();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(DICT.exact, key)) return DICT.exact[key];
    for (var i = 0; i < DICT.patterns.length; i++) {
      var p = DICT.patterns[i];
      var m = p[0].exec(key);
      if (m) {
        var args = Array.prototype.slice.call(m);
        args.push(function (x) { var r = tr(x); return r == null ? x : r; });
        return p[1].apply(null, args);
      }
    }
    /* "A · B" labels: translate each part when the whole is not listed */
    if (key.indexOf(' · ') > 0) {
      var parts = key.split(' · ');
      var any = false;
      var out = parts.map(function (part) {
        var r = tr(part);
        if (r != null && r !== part) { any = true; return r; }
        return part;
      });
      if (any) return out.join(' · ');
    }
    return null;
  }

  /* public: t('English text') in code that builds strings off the DOM */
  function t(src) {
    if (lang !== 'es') return src;
    var r = tr(src);
    return r == null ? src : r;
  }

  function locale() { return lang === 'es' ? 'es-CO' : 'en-US'; }

  /* Numbers and clock times follow the active locale (1.284 / 1,284). */
  function num(v) {
    try { return new Intl.NumberFormat(locale()).format(Number(v) || 0); }
    catch (e) { return String(v); }
  }
  function time(d) {
    try {
      return new Intl.DateTimeFormat(locale(), {
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(d);
    } catch (e) { return String(d); }
  }

  function translateText(node) {
    if (lang !== 'es') return;
    var v = node.nodeValue;
    if (!v || !/[A-Za-z]/.test(v)) return;
    if (wroteText.get(node) === v) return;   /* our own write, not new copy */
    var r = tr(v);
    if (r == null || r === v.trim()) return;
    var lead = /^\s*/.exec(v)[0];
    var tail = /\s*$/.exec(v)[0];
    var out = lead + r + tail;
    origText.set(node, v);
    wroteText.set(node, out);
    node.nodeValue = out;
  }

  function restoreText(node) {
    var orig = origText.get(node);
    if (orig == null) return;
    if (node.nodeValue === wroteText.get(node)) node.nodeValue = orig;
  }

  function translateAttrs(el) {
    if (lang !== 'es') return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var v = el.getAttribute(a);
      if (!v) continue;
      var w = wroteAttrs.get(el);
      if (w && w[a] === v) continue;         /* our own write */
      var r = tr(v);
      if (r == null || r === v) continue;
      var o = origAttrs.get(el) || {};
      o[a] = v;
      origAttrs.set(el, o);
      w = wroteAttrs.get(el) || {};
      w[a] = r;
      wroteAttrs.set(el, w);
      el.setAttribute(a, r);
    }
  }

  function restoreAttrs(el) {
    var o = origAttrs.get(el);
    if (!o) return;
    var w = wroteAttrs.get(el) || {};
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (o[a] == null) continue;
      if (el.getAttribute(a) === w[a]) el.setAttribute(a, o[a]);
    }
  }

  function apply(root) {
    if (lang !== 'es' || !root) return;
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1) return;
    if (/^(SCRIPT|STYLE|PRE|CODE)$/.test(root.nodeName) || root.hasAttribute('data-no-i18n')) return;
    translateAttrs(root);
    var kids = root.childNodes;
    for (var i = 0; i < kids.length; i++) apply(kids[i]);
  }

  /* English again: put every original back, in place. */
  function restore(root) {
    if (!root) return;
    if (root.nodeType === 3) { restoreText(root); return; }
    if (root.nodeType !== 1) return;
    if (/^(SCRIPT|STYLE|PRE|CODE)$/.test(root.nodeName)) return;
    restoreAttrs(root);
    var kids = root.childNodes;
    for (var i = 0; i < kids.length; i++) restore(kids[i]);
  }

  function observe() {
    if (typeof MutationObserver === 'undefined') return;
    new MutationObserver(function (list) {
      if (lang !== 'es') return;
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'characterData') {
          var p = m.target.parentNode;
          if (p && p.closest && p.closest('[data-no-i18n], pre, code')) continue;
          translateText(m.target);
        } else if (m.type === 'attributes') {
          translateAttrs(m.target);
        } else {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            var host = n.parentNode;
            if (host && host.closest && host.closest('[data-no-i18n], pre, code')) continue;
            apply(n);
          }
        }
      }
    }).observe(document.documentElement, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  function syncSwitch() {
    var btns = document.querySelectorAll('.lang-toggle');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.setAttribute('aria-label', lang === 'es' ? 'Cambiar idioma' : 'Switch language');
      b.innerHTML = '<span' + (lang === 'en' ? ' aria-current="true"' : '') + '>EN</span>' +
        '<span' + (lang === 'es' ? ' aria-current="true"' : '') + '>ES</span>';
    }
  }

  /* Switch language in place: no reload, no state loss. */
  function set(next) {
    if (next !== 'en' && next !== 'es') return lang;
    save(next);
    if (next === lang) return next;
    lang = next;
    document.documentElement.setAttribute('lang', lang);
    if (lang === 'es') {
      document.title = tr(TITLE) || TITLE;
      apply(document.body);
    } else {
      document.title = TITLE;
      restore(document.body);
    }
    syncSwitch();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](lang); } catch (e) { /* one bad listener */ }
    }
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
    return next;
  }

  function toggle() { return set(lang === 'es' ? 'en' : 'es'); }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  /* the EN | ES switch sits right before the theme toggle */
  function mountSwitch() {
    var theme = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < theme.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-toggle';
      b.id = i === 0 ? 'langToggle' : 'langToggle' + i;
      b.setAttribute('aria-label', lang === 'es' ? 'Cambiar idioma' : 'Switch language');
      b.innerHTML = '<span' + (lang === 'en' ? ' aria-current="true"' : '') + '>EN</span>' +
        '<span' + (lang === 'es' ? ' aria-current="true"' : '') + '>ES</span>';
      b.addEventListener('click', toggle);
      theme[i].parentNode.insertBefore(b, theme[i]);
    }
  }

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
    if (lang === 'es') document.title = tr(TITLE) || TITLE;
    if (document.body) {
      mountSwitch();
      apply(document.body);
      observe();
    }
  }

  return {
    get lang() { return lang; },
    DEFAULT_LANG: DEFAULT_LANG,
    t: t,
    tr: tr,
    set: set,
    toggle: toggle,
    apply: apply,
    num: num,
    time: time,
    locale: locale,
    onChange: onChange
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18N;
}
