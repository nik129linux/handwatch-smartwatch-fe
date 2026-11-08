/* ==========================================================================
   wrist.js — the real-watch bridge
   The test watch (an "8 Ultra" clone) runs closed firmware: it cannot install
   an app, but it mirrors phone notifications and buzzes. So every haptic the
   simulator plays can also go out as a short ntfy.sh push: phone (ntfy app)
   → companion app (Wearfit Pro / FitPro) → wrist.

   What leaves the page: a title (≤ 4 words), one short line, a priority.
   No names, no free text, no log rows. Off by default.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.wrist = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var KEY = 'hhw.wrist';
  var HOST = 'https://ntfy.sh/';
  var TOPIC_RE = /^[a-z0-9_-]{8,64}$/;

  var MOMENTS = {
    'before-patient': 'Before patient',
    'before-clean': 'Before clean task',
    'after-fluid': 'After fluids',
    'after-patient': 'After patient',
    'after-surroundings': 'After surroundings'
  };

  /* Pure: haptic name + watch state → the push. null = nothing to send.
     Priorities follow ntfy: 4 buzzes the phone, 2 arrives quietly. */
  function int(v, fallback) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : fallback;
  }

  /* The alert follows the page language (I18N), English when absent.
     The watch app also needs the language and the Home counters, so every
     message carries lang/done/plan (main.js re-checks them before adb). */
  function message(name, s) {
    s = s || {};
    var m = messageEn(name, s);
    if (!m) return m;
    var lang = (typeof I18N !== 'undefined' && I18N.lang === 'es') ? 'es' : 'en';
    var out = lang === 'es'
      ? { title: I18N.t(m.title), body: I18N.t(m.body), priority: m.priority }
      : m;
    out.lang = lang;
    out.done = int(s.done, 0);
    out.plan = int(s.plan, 15);
    return out;
  }

  function messageEn(name, s) {
    s = s || {};
    var bed = typeof s.bed === 'string' ? s.bed : '';
    switch (name) {
      case 'reminder':
        return { title: 'Wash hands', body: [MOMENTS[s.lastMoment] || 'Moment due', bed].filter(Boolean).join(' · '), priority: 4 };
      case 'doubtful':
        return { title: 'Did you wash?', body: ['Not sure', bed].filter(Boolean).join(' · '), priority: 4 };
      case 'ok':
        return { title: 'Wash logged', body: 'Noted', priority: 2 };
      case 'end':
        return {
          title: 'Shift over',
          body: (Number(s.done) || 0) + ' of ' + (Number(s.opportunities) || 0) + ' moments',
          priority: 3
        };
      default:
        return null;
    }
  }

  function randomTopic() {
    var a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var out = 'hhw-';
    for (var i = 0; i < 12; i++) out += a.charAt(Math.floor(Math.random() * a.length));
    return out;
  }

  /* --- persisted setting (per viewer; storage may be blocked) ------------ */
  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && TOPIC_RE.test(v.topic)) return { on: !!v.on, topic: v.topic };
    } catch (e) { /* private window, blocked storage */ }
    return { on: false, topic: randomTopic() };
  }
  function save(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* fine */ }
  }

  var cfg = null;
  var sent = [];   /* every push attempted, for the acceptance test */

  function post(topic, msg) {
    /* Electron: main does the request. Browser: ntfy allows CORS. */
    if (typeof window !== 'undefined' && window.__wristAPI) {
      return window.__wristAPI.send(topic, msg);
    }
    if (typeof fetch !== 'function') return Promise.resolve({ ok: false });
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, 4000) : null;
    return fetch(HOST + topic, {
      method: 'POST',
      body: msg.body,
      headers: { Title: msg.title, Priority: String(msg.priority) },
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) { return { ok: r.ok }; })
      .catch(function () { return { ok: false }; })
      .then(function (r) { if (t) clearTimeout(t); return r; });
  }

  function onHaptic(ev) {
    if (!cfg || !cfg.on) return;
    var name = ev && ev.detail && ev.detail.name;
    var msg = message(name, window.watch && window.watch.state);
    if (!msg) return;
    msg.kind = name;
    sent.push({ name: name, title: msg.title, body: msg.body, priority: msg.priority });
    window.__wristSent = sent;
    post(cfg.topic, msg).then(function (r) {
      paintStatus(r && r.ok ? 'sent via ' + (r.route || 'ntfy') : 'not sent');
    });
  }

  /* An answer from the wrist side closes the open question on the watch,
     exactly like tapping its pill. Anything else on screen: ignored. */
  function applyAnswer(value, from) {
    var w = window.watch;
    if (!w || !w.state) return false;
    var screen = w.state.screen;
    if (screen === 'dudoso') w.act(value === 'yes' ? 'doubt-yes' : 'doubt-no');
    else if (screen === 'recordatorio' && value === 'yes') w.act('done');
    else return false;
    paintStatus('answered on the ' + (from === 'wear' ? 'watch' : 'phone') + ' · ' + (value === 'yes' ? 'yes' : 'no'));
    return true;
  }

  /* --- panel row --------------------------------------------------------- */
  var el = {};
  function paintStatus(text) { if (el.status) el.status.textContent = text; }
  function paint() {
    if (!el.toggle) return;
    el.toggle.setAttribute('aria-checked', cfg.on ? 'true' : 'false');
    el.topic.textContent = cfg.topic;
    el.help.hidden = !cfg.on;
    paintStatus(cfg.on ? 'on' : 'off');
  }

  function init() {
    cfg = load();
    el.toggle = document.getElementById('wristToggle');
    el.topic = document.getElementById('wristTopic');
    el.help = document.getElementById('wristHelp');
    el.status = document.getElementById('wristStatus');
    document.addEventListener('haptic:play', onHaptic);
    if (window.__wristAPI && window.__wristAPI.onAnswer) {
      window.__wristAPI.onAnswer(function (value, from) { applyAnswer(value, from); });
    }
    if (!el.toggle) return;
    el.toggle.addEventListener('click', function () {
      cfg.on = !cfg.on;
      save(cfg);
      paint();
    });
    paint();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  return { isOn: function () { return !!(cfg && cfg.on); }, applyAnswer: applyAnswer, message: message, TOPIC_RE: TOPIC_RE, HOST: HOST, randomTopic: randomTopic };
});
