/* ==========================================================================
   prefs.js — the preferences both the watch and the pages share.
   Language and theme live in i18n.js / theme.js; this file owns:
     - the AI master switch and the stored consent answer
     - guide progress helpers (seen flags)
     - the data inventory / delete-all used by Privacidad
     - one focus-trap helper for every modal (guide, settings)
   All values persist in localStorage (try/catch) and are shared by
   index.html and unit.html through the same keys.
   Exposes window.AIPrefs and window.Prefs.
   ========================================================================== */

var AIPrefs = (function () {
  'use strict';

  var ON_KEY = 'handwatch-ai';
  var CONSENT_KEY = 'handwatch-ai-consent';

  function read(k, fallback) {
    try { var v = window.localStorage.getItem(k); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function write(k, v) {
    try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ }
  }
  function drop(k) {
    try { window.localStorage.removeItem(k); } catch (e) { /* private mode */ }
  }

  /* The master switch: on by default — the app still asks before the first
     model call, and rules answer whenever consent is missing. */
  function on() { return read(ON_KEY, 'on') !== 'off'; }
  function setOn(v) {
    write(ON_KEY, v ? 'on' : 'off');
    document.dispatchEvent(new CustomEvent('ai:change', { detail: { on: on() } }));
    return on();
  }
  function consentState() {
    var v = read(CONSENT_KEY, 'none');
    return (v === 'granted' || v === 'revoked') ? v : 'none';
  }
  /* chain() contract: 'yes' | 'no' | null (ask the sheet) */
  function consent() {
    if (!on()) return 'no';
    var s = consentState();
    if (s === 'granted') return 'yes';
    if (s === 'revoked') return 'no';
    return null;
  }
  function grant() { write(CONSENT_KEY, 'granted'); return consentState(); }
  function revoke() { write(CONSENT_KEY, 'revoked'); return consentState(); }
  function resetConsent() { drop(CONSENT_KEY); return consentState(); }

  /* The sheet is the grant: whatever the person answers, it is remembered
     until they revoke it in Settings. */
  function ask(payload) {
    if (!on()) return Promise.resolve('no');
    if (typeof AI === 'undefined' || !AI.requestConsent) return Promise.resolve('no');
    return AI.requestConsent(payload).then(function (answer) {
      if (answer === 'yes') grant();
      else revoke();
      return answer;
    }).catch(function () { return 'no'; });
  }

  return {
    ON_KEY: ON_KEY,
    CONSENT_KEY: CONSENT_KEY,
    on: on,
    setOn: setOn,
    consent: consent,
    consentState: consentState,
    grant: grant,
    revoke: revoke,
    resetConsent: resetConsent,
    ask: ask
  };
})();

var Prefs = (function () {
  'use strict';

  var GUIDE_KEY = 'handwatch-guide1';
  var TIPS_KEY = 'handwatch-tips';
  var WRIST_KEY = 'hhw.wrist';

  function read(k, fallback) {
    try { var v = window.localStorage.getItem(k); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function write(k, v) {
    try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ }
  }
  function drop(k) {
    try { window.localStorage.removeItem(k); } catch (e) { /* private mode */ }
  }

  function guideSeen() { return read(GUIDE_KEY, '') === 'seen'; }
  function setGuideSeen(v) { if (v) write(GUIDE_KEY, 'seen'); else drop(GUIDE_KEY); }

  function tipsSeen() {
    try {
      var list = JSON.parse(read(TIPS_KEY, '[]'));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function tipSeen(id) { return tipsSeen().indexOf(id) !== -1; }
  function markTip(id) {
    var list = tipsSeen();
    if (list.indexOf(id) === -1) list.push(id);
    write(TIPS_KEY, JSON.stringify(list));
  }
  function resetTips() { drop(TIPS_KEY); }

  /* Everything the app keeps on this computer, so Privacidad can say it
     and delete it. Language and theme are UI preferences, not data. */
  function inventory() {
    var logCount = 0;
    try { if (typeof Log !== 'undefined' && Log.count) logCount = Log.count(); }
    catch (e) { logCount = 0; }
    return {
      events: logCount,
      guide: guideSeen(),
      tips: tipsSeen().length,
      aiConsent: AIPrefs.consentState(),
      wrist: read(WRIST_KEY, null) !== null
    };
  }

  function deleteAll() {
    try { if (typeof Log !== 'undefined' && Log.clear) Log.clear(); } catch (e) { /* nothing */ }
    drop(GUIDE_KEY);
    drop(TIPS_KEY);
    drop(AIPrefs.ON_KEY);
    drop(AIPrefs.CONSENT_KEY);
    drop(WRIST_KEY);
    try {
      if (typeof Log !== 'undefined' && Log.KEY) drop(Log.KEY);
    } catch (e) { /* nothing */ }
    document.dispatchEvent(new CustomEvent('prefs:deleted'));
    return inventory();
  }

  /* --- one focus trap for every modal -----------------------------------
     Esc closes, Tab cycles inside, focus goes back to the opener.
     Returns { release }. */
  function trapFocus(root, onClose) {
    var opener = document.activeElement;
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function nodes() {
      return Array.prototype.filter.call(root.querySelectorAll(sel), function (n) {
        return n.offsetParent !== null || n === document.activeElement;
      });
    }
    function focusFirst() {
      var list = nodes();
      var first = list.length ? list[0] : root;
      try { first.focus(); } catch (e) { /* no focus */ }
    }
    function onKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        close();
        return;
      }
      if (ev.key !== 'Tab') return;
      var list = nodes();
      if (!list.length) { ev.preventDefault(); root.focus(); return; }
      var first = list[0], last = list[list.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        ev.preventDefault(); last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault(); first.focus();
      }
    }
    var released = false;
    function close() {
      if (released) return;
      released = true;
      document.removeEventListener('keydown', onKey, true);
      try { if (onClose) onClose(); } catch (e) { /* keep closing */ }
      try { if (opener && opener.focus) opener.focus(); } catch (e) { /* gone */ }
    }
    document.addEventListener('keydown', onKey, true);
    focusFirst();
    return { release: close, focusFirst: focusFirst };
  }

  return {
    GUIDE_KEY: GUIDE_KEY,
    TIPS_KEY: TIPS_KEY,
    guideSeen: guideSeen,
    setGuideSeen: setGuideSeen,
    tipsSeen: tipsSeen,
    tipSeen: tipSeen,
    markTip: markTip,
    resetTips: resetTips,
    inventory: inventory,
    deleteAll: deleteAll,
    trapFocus: trapFocus,
    read: read,
    write: write,
    drop: drop
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIPrefs: AIPrefs, Prefs: Prefs };
}
