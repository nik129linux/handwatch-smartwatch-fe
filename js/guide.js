/* ==========================================================================
   guide.js — the three-level guide.
   Level 1: three welcome cards on first launch (once, replayable).
   Level 2: one small coach mark the first time each key feature is seen.
   Level 3: the Help/Ayuda reference rendered inside Settings.
   Everything is built in English and translated by i18n.js; the guide
   works on the real app (no demo mode). Modal steps are role=dialog +
   aria-modal, trap focus, close on Esc and return focus to the opener.
   Exposes window.Guide.
   ========================================================================== */

var Guide = (function () {
  'use strict';

  var CARDS = [
    {
      title: 'What this is',
      body: 'I warn you with vibration.',
      note: 'A hand-hygiene watch for one shift. No forms, no names.'
    },
    {
      title: 'The core action',
      body: 'If I doubt, I ask you.',
      note: 'One tap answers. One tap also fixes a wrong mark.'
    },
    {
      title: 'Privacy and AI',
      body: 'Only you see this.',
      note: 'AI is optional: you decide, and you can revoke it.'
    }
  ];

  var TIPS = [
    { id: 'crown', anchor: '#crown', text: 'Turn the crown to scroll. Press it for Home.' },
    { id: 'strip', anchor: '.haptic-strip', text: 'Four vibrations, no sound. Press play to feel one.' },
    { id: 'free', anchor: '#freeMode', text: 'Free mode: run any moment by hand.' },
    { id: 'privacy', anchor: '#sideButton', text: 'The side button shows who sees this.' }
  ];

  var TIP_IDS = TIPS.map(function (t) { return t.id; });

  var layer = null;
  var cardIx = 0;
  var trap = null;
  var tipOpen = null;
  var tipTrap = null;
  var observer = null;

  function buildLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'guide-layer';
    layer.id = 'guideLayer';
    layer.hidden = true;
    document.body.appendChild(layer);
    return layer;
  }

  function cardsHTML() {
    return CARDS.map(function (c, i) {
      return '<article class="guide__card" data-card="' + i + '"' +
        (i === cardIx ? '' : ' hidden') + '>' +
        '<p class="label guide__step">' + (i + 1) + ' / ' + CARDS.length + '</p>' +
        '<h3 class="guide__card-title">' + c.title + '</h3>' +
        '<p class="guide__body">' + c.body + '</p>' +
        '<p class="guide__note">' + c.note + '</p>' +
        '</article>';
    }).join('');
  }

  function dotsHTML() {
    return CARDS.map(function (_, i) {
      return '<span class="guide__dot' + (i === cardIx ? ' is-on' : '') + '"></span>';
    }).join('');
  }

  function paint() {
    var host = layer.querySelector('.guide__cards');
    var dots = layer.querySelector('.guide__dots');
    var prog = layer.querySelector('.guide__progress');
    var back = layer.querySelector('[data-guide-back]');
    var next = layer.querySelector('[data-guide-next]');
    if (host) host.innerHTML = cardsHTML();
    if (dots) dots.innerHTML = dotsHTML();
    if (prog) prog.textContent = (cardIx + 1) + ' of ' + CARDS.length;
    if (back) back.disabled = cardIx === 0;
    if (next) next.textContent = cardIx === CARDS.length - 1 ? 'Done' : 'Next';
    if (typeof I18N !== 'undefined') I18N.apply(layer);
  }

  function closeLevel1(skipped) {
    if (!layer || layer.hidden) return;
    if (trap) { trap.release(); trap = null; }
    layer.hidden = true;
    layer.innerHTML = '';
    Prefs.setGuideSeen(true);
    /* a replay is still "seen": the first-run promise is kept */
    if (skipped) { /* nothing else to do */ }
    startTips();
  }

  function openLevel1(card) {
    buildLayer();
    cardIx = Math.max(0, Math.min(CARDS.length - 1, card || 0));
    layer.innerHTML =
      '<div class="guide" role="dialog" aria-modal="true" aria-labelledby="guideTitle" tabindex="-1">' +
        '<header class="guide__head">' +
          '<h2 class="guide__title" id="guideTitle">Quick guide</h2>' +
          '<button class="guide__skip" type="button" data-guide-skip ' +
            'aria-label="Skip the guide">Skip</button>' +
        '</header>' +
        '<div class="guide__cards"></div>' +
        '<p class="guide__progress" aria-live="polite"></p>' +
        '<div class="guide__dots" aria-hidden="true"></div>' +
        '<div class="guide__foot">' +
          '<button class="guide__btn" type="button" data-guide-back>Back</button>' +
          '<button class="guide__btn guide__btn--primary" type="button" data-guide-next>Next</button>' +
        '</div>' +
      '</div>';
    layer.hidden = false;
    paint();
    var box = layer.querySelector('.guide');
    trap = Prefs.trapFocus(box, function () { closeLevel1(true); });
    layer.querySelector('[data-guide-skip]').addEventListener('click', function () {
      closeLevel1(true);
    });
    layer.querySelector('[data-guide-next]').addEventListener('click', function () {
      if (cardIx >= CARDS.length - 1) { closeLevel1(false); return; }
      cardIx += 1;
      paint();
    });
    layer.querySelector('[data-guide-back]').addEventListener('click', function () {
      if (cardIx <= 0) return;
      cardIx -= 1;
      paint();
    });
  }

  /* ------------------------------------------------------------- level 2 */

  function positionTip(anchor) {
    var tip = tipOpen && tipOpen.node;
    if (!tip || !anchor) return;
    var r = anchor.getBoundingClientRect();
    var tw = tip.offsetWidth || 260;
    var th = tip.offsetHeight || 96;
    var left = Math.max(12, Math.min(window.innerWidth - tw - 12,
      r.left + r.width / 2 - tw / 2));
    var top = r.bottom + 12;
    if (top + th > window.innerHeight - 12) top = Math.max(12, r.top - th - 12);
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  function closeTip(mark) {
    if (!tipOpen) return;
    var node = tipOpen.node;
    if (mark) Prefs.markTip(tipOpen.id);
    tipOpen = null;
    if (tipTrap) { tipTrap.release(); tipTrap = null; }
    node.hidden = true;
    if (node.parentNode) node.parentNode.removeChild(node);
    window.removeEventListener('scroll', onTipScroll, true);
    window.removeEventListener('resize', onTipScroll);
    document.removeEventListener('keydown', onTipEsc, true);
    scheduleNextTip();
  }

  function onTipScroll() {
    if (!tipOpen) return;
    var a = document.querySelector(tipOpen.anchor);
    positionTip(a);
  }
  function onTipEsc(ev) {
    if (ev.key === 'Escape' && tipOpen) {
      ev.preventDefault();
      ev.stopPropagation();
      closeTip(true);
    }
  }

  function showTip(def) {
    if (!def || tipOpen) return false;
    var anchor = document.querySelector(def.anchor);
    if (!anchor) { Prefs.markTip(def.id); return false; }
    var node = document.createElement('div');
    node.className = 'tip';
    node.id = 'guideTip';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', 'Tip');
    node.innerHTML =
      '<p class="tip__text"></p>' +
      '<button class="tip__close" type="button" aria-label="Close tip">×</button>';
    node.querySelector('.tip__text').textContent = def.text;
    document.body.appendChild(node);
    tipOpen = { id: def.id, anchor: def.anchor, node: node, def: def };
    node.querySelector('.tip__close').addEventListener('click', function () { closeTip(true); });
    positionTip(anchor);
    window.addEventListener('scroll', onTipScroll, true);
    window.addEventListener('resize', onTipScroll);
    document.addEventListener('keydown', onTipEsc, true);
    var btn = node.querySelector('.tip__close');
    try { btn.focus({ preventScroll: true }); } catch (e) { /* no focus */ }
    if (typeof I18N !== 'undefined') I18N.apply(node);
    return true;
  }

  var tipTimer = null;
  function scheduleNextTip() {
    if (tipTimer) window.clearTimeout(tipTimer);
    tipTimer = window.setTimeout(function () {
      if (tipOpen) return;
      var next = TIPS.filter(function (t) { return !Prefs.tipSeen(t.id); })[0];
      if (!next) return;
      var a = document.querySelector(next.anchor);
      if (!a) return;
      var r = a.getBoundingClientRect();
      var visible = r.bottom > 0 && r.top < window.innerHeight;
      if (visible) showTip(next);
      else if (!observer) observeAnchors();
    }, 700);
  }

  /* First time the person reaches a feature: a tip waits until the anchor
     is on screen. One at a time, each shown once, persisted. */
  function observeAnchors() {
    if (observer || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(function (entries) {
      if (tipOpen) return;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var def = TIPS.filter(function (t) { return t.anchor === '#' + e.target.id; })[0];
        if (!def && e.target.classList.contains('haptic-strip')) {
          def = TIPS.filter(function (t) { return t.id === 'strip'; })[0];
        }
        if (def && !Prefs.tipSeen(def.id)) showTip(def);
      });
    }, { threshold: 0.4 });
    TIPS.forEach(function (t) {
      var a = document.querySelector(t.anchor);
      if (a) observer.observe(a);
    });
  }

  function startTips() {
    if (typeof document === 'undefined') return;
    if (!document.querySelector('.stage')) return;
    if (TIPS.every(function (t) { return Prefs.tipSeen(t.id); })) return;
    scheduleNextTip();
  }

  /* ------------------------------------------------------------- level 3 */

  var FAQ = [
    ['What is this app for?', 'A hand-hygiene watch for one shift. It counts moments and asks when it is unsure.'],
    ['Why does it never make a sound?', 'It taps your wrist. Nothing plays out loud in front of a patient.'],
    ['What happens when it doubts?', 'It asks one short question. One tap answers it.'],
    ['Can I fix a wrong mark?', 'Yes. One tap corrects it, and the watch learns from that tap.'],
    ['Who sees my data?', 'Only you. Infection control sees anonymous unit totals, never names.'],
    ['When does the AI run?', 'Only if you allow it in Settings. Without consent, the written rules answer.'],
    ['How long is data kept?', 'Event detail is deleted after 24 hours. Beds and people are never stored.'],
    ['How do I wipe everything?', 'Settings, then Privacy, then Delete all data.']
  ];

  var FEATURES = [
    ['Guided shift', 'Plays the whole story: reminder, wash, correction, pause and end.'],
    ['Free mode', 'Runs any moment by hand, without the script.'],
    ['Haptics', 'Four distinct vibration patterns, never a sound.'],
    ['Log', 'Every event of this shift, in order, with no names.'],
    ['Settings', 'Language, theme, AI, privacy and this help, in one place.'],
    ['Privacy peek', 'The side button shows who sees what, at any time.'],
    ['Unit view', 'The anonymous report for Infection Control.'],
    ['Ask the unit', 'Questions answered from anonymous totals only.'],
    ['Send to my wrist', 'Mirrors each buzz to your phone and watch over ntfy.']
  ];

  var ICONS = [
    ['Gear', 'Settings: language, theme, AI, privacy and help.'],
    ['Crown', 'Turn it to scroll. Press it for Home.'],
    ['Side button', 'Opens Who sees this.'],
    ['Moon', 'Alerts are paused.'],
    ['Segmented ring', 'Moments met this shift.'],
    ['Lime dot', 'Yours: a correction or a pause.'],
    ['Check', 'The wash is done.'],
    ['Lock', 'This view keeps no names.']
  ];

  var STATUSES = [
    ['ready', 'The guided shift is ready to start.'],
    ['active', 'Free mode is live.'],
    ['muted', 'A pause silenced the alerts.'],
    ['on', 'The wrist bridge is sending.'],
    ['off', 'The wrist bridge is idle.'],
    ['over', 'The guided shift ended.'],
    ['learning', 'The watch is learning from your corrections.']
  ];

  var GLOSSARY = [
    ['Moment', 'One of the five WHO hand-hygiene moments.'],
    ['Compliance', 'Washes done out of the moments that came up.'],
    ['Correction', 'One tap that says the watch was wrong.'],
    ['Doubtful wash', 'A signal too weak to call, so the watch asks.'],
    ['Shift', 'One nurse, one stretch of work; nothing else is stored.'],
    ['Unit totals', 'Anonymous sums for the whole unit.']
  ];

  function listHTML(list) {
    return list.map(function (row) {
      return '<li class="help__row">' +
        '<p class="help__name">' + row[0] + '</p>' +
        '<p class="help__desc">' + row[1] + '</p></li>';
    }).join('');
  }

  function faqHTML() {
    return FAQ.map(function (row) {
      return '<div class="help__qa">' +
        '<dt class="help__q">' + row[0] + '</dt>' +
        '<dd class="help__a">' + row[1] + '</dd></div>';
    }).join('');
  }

  function helpHTML() {
    return '<div class="help">' +
      '<p class="help__lede">Every screen, every icon and every word, in one place.</p>' +

      '<h3 class="help__h">Quick answers</h3>' +
      '<dl class="help__faq">' + faqHTML() + '</dl>' +

      '<h3 class="help__h">Vibration vocabulary</h3>' +
      '<p class="help__p">Four patterns. No sound, ever. Press play to feel one.</p>' +
      '<ul class="vocab help__vocab" id="helpVocab"></ul>' +

      '<h3 class="help__h">Features</h3>' +
      '<ul class="help__list">' + listHTML(FEATURES) + '</ul>' +

      '<h3 class="help__h">Icons and status</h3>' +
      '<ul class="help__list">' + listHTML(ICONS) + '</ul>' +
      '<ul class="help__list">' + listHTML(STATUSES) + '</ul>' +

      '<h3 class="help__h">Glossary</h3>' +
      '<ul class="help__list">' + listHTML(GLOSSARY) + '</ul>' +

      '<h3 class="help__h">Privacy and AI</h3>' +
      '<p class="help__p">Only anonymous totals leave this computer, and only if you allow the model.</p>' +
      '<p class="help__p">No names, no beds, no location. The watch has no person field.</p>' +
      '</div>';
  }

  function fillHelp(root) {
    if (!root) return;
    root.innerHTML = helpHTML();
    try {
      if (typeof haptics !== 'undefined' && haptics.mountVocab) {
        haptics.mountVocab(root.querySelector('#helpVocab'));
      }
    } catch (e) { /* the table still reads */ }
    if (typeof I18N !== 'undefined') I18N.apply(root);
  }

  /* --------------------------------------------------------------- mount */

  function refresh() {
    if (layer && !layer.hidden) paint();
    if (tipOpen) {
      var t = tipOpen.node.querySelector('.tip__text');
      if (t) t.textContent = tipOpen.def.text;
      if (typeof I18N !== 'undefined') I18N.apply(tipOpen.node);
      onTipScroll();
    }
  }

  function boot() {
    if (typeof document === 'undefined' || !document.querySelector('.stage')) return;
    if (window.__noGuide) return;
    if (!Prefs.guideSeen()) openLevel1(0);
    else startTips();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
    document.addEventListener('i18n:change', refresh);
  }

  return {
    CARDS: CARDS,
    TIPS: TIPS,
    TIP_IDS: TIP_IDS,
    openLevel1: openLevel1,
    closeLevel1: closeLevel1,
    showTip: showTip,
    closeTip: closeTip,
    startTips: startTips,
    helpHTML: helpHTML,
    fillHelp: fillHelp,
    refresh: refresh
  };
})();
