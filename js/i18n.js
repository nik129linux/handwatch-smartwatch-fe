/* ==========================================================================
   i18n.js — English / Spanish switch for both pages.
   English is the source language: code and markup stay in English, and
   strings-es.js maps every visible string to Spanish. This script
   translates the static page once, then follows the live DOM
   (MutationObserver) so screens rendered later arrive translated too.

   Language: stored choice, else the browser language (es-* -> es),
   else English. Persisted in localStorage (try/catch), shared by both
   pages. Switching reloads the page, so nothing has to be translated
   back. Exposes window.I18N {lang, t, set, toggle, apply}.
   Load order: strings-es.js, i18n.js, then every other body script.
   ========================================================================== */

var I18N = (function () {
  'use strict';

  var KEY = 'handwatch-lang';
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  var DICT = (typeof STRINGS_ES !== 'undefined') ? STRINGS_ES : { exact: {}, patterns: [] };

  function stored() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { window.localStorage.setItem(KEY, v); } catch (e) { /* private mode */ }
  }
  function detect() {
    var s = stored();
    if (s === 'en' || s === 'es') return s;
    var nav = (typeof navigator !== 'undefined' && (navigator.language || '')) || '';
    return /^es\b/i.test(nav) ? 'es' : 'en';
  }

  var lang = (typeof window !== 'undefined') ? detect() : 'en';

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

  function translateText(node) {
    var v = node.nodeValue;
    if (!v || !/[A-Za-z]/.test(v)) return;
    var r = tr(v);
    if (r == null || r === v.trim()) return;
    var lead = /^\s*/.exec(v)[0];
    var tail = /\s*$/.exec(v)[0];
    node.nodeValue = lead + r + tail;
  }

  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (!a) continue;
      var r = tr(a);
      if (r != null && r !== a) el.setAttribute(ATTRS[i], r);
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

  function observe() {
    if (lang !== 'es' || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function (list) {
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

  function set(next) {
    if (next !== 'en' && next !== 'es') return lang;
    save(next);
    if (next !== lang) window.location.reload();
    return next;
  }

  function toggle() { return set(lang === 'es' ? 'en' : 'es'); }

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
    if (lang === 'es') document.title = t(document.title);
    if (document.body) {
      mountSwitch();
      apply(document.body);
      observe();
    }
  }

  return {
    get lang() { return lang; },
    t: t,
    tr: tr,
    set: set,
    toggle: toggle,
    apply: apply
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18N;
}
