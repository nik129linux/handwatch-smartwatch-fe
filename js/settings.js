/* ==========================================================================
   settings.js — Configuración / Settings, the canonical home for language,
   theme, AI consent, privacy data and the guide.
   One gear button in the page header (index.html and unit.html) opens a
   modal panel: role=dialog + aria-modal, focus trapped, Esc closes, focus
   returns to the gear. All values are the shared stored prefs: the watch's
   own Ajustes screen writes the same keys, so both views agree.
   Built in English, translated by i18n.js. Exposes window.Settings.
   ========================================================================== */

var Settings = (function () {
  'use strict';

  var layer = null;
  var trap = null;
  var gear = null;
  var view = 'general';
  var deleteMessage = '';
  var built = false;

  function t(s) { return (typeof I18N !== 'undefined') ? I18N.t(s) : s; }
  function num(v) { return (typeof I18N !== 'undefined') ? I18N.num(v) : String(v); }

  function themePref() {
    try { return window.__themePref ? window.__themePref() : 'light'; }
    catch (e) { return 'light'; }
  }

  function inventoryLine() {
    var inv = Prefs.inventory();
    var events = inv.events === 1
      ? '1 ' + t('event, 24 h')
      : num(inv.events) + ' ' + t('events, 24 h');
    var tips = inv.tips === 1 ? '1 ' + t('tip') : num(inv.tips) + ' ' + t('tips');
    var guide = t(inv.guide ? 'guide seen' : 'guide not seen');
    return events + ' · ' + tips + ' · ' + guide;
  }

  function choice(attr, value, label, active, extra) {
    return '<button class="set__choice" type="button" ' + attr + '="' + value + '" ' +
      (extra || '') + ' aria-pressed="' + (active ? 'true' : 'false') + '">' +
      label + '</button>';
  }

  function generalHTML() {
    var aiOn = AIPrefs.on();
    return '<section class="set">' +
        '<h3 class="set__title">Language</h3>' +
        '<p class="set__hint">Applies right away. No reload.</p>' +
        '<div class="set__choices">' +
          choice('data-lang', 'es', 'Español', (typeof I18N !== 'undefined' && I18N.lang === 'es'),
            ' lang="es" data-no-i18n') +
          choice('data-lang', 'en', 'English', (typeof I18N !== 'undefined' && I18N.lang === 'en'),
            ' lang="en" data-no-i18n') +
        '</div>' +
      '</section>' +

      '<section class="set">' +
        '<h3 class="set__title">Theme</h3>' +
        '<p class="set__hint">Light is the default on a new profile.</p>' +
        '<div class="set__choices">' +
          choice('data-theme-choice', 'light', t('Light'), themePref() === 'light') +
          choice('data-theme-choice', 'dark', t('Dark'), themePref() === 'dark') +
          choice('data-theme-choice', 'system', t('System'), themePref() === 'system') +
        '</div>' +
      '</section>' +

      '<section class="set">' +
        '<h3 class="set__title">Artificial intelligence</h3>' +
        '<button class="set__switch" type="button" data-ai-toggle role="switch" ' +
          'aria-checked="' + (aiOn ? 'true' : 'false') + '" aria-label="' + t('Use the model') + '">' +
          '<span class="set__switch-label">' + t('Use the model') + '</span>' +
          '<span class="set__switch-track" aria-hidden="true">' +
            '<span class="set__switch-knob"></span></span>' +
        '</button>' +
        '<p class="set__state" data-ai-status>' +
          t(aiOn ? 'On: I show you what is sent before each query'
                 : 'Off: the watch rules answer') +
        '</p>' +
      '</section>' +

      '<section class="set">' +
        '<h3 class="set__title">Privacy</h3>' +
        '<p class="set__hint">This computer keeps the event log for 24 h, your ' +
          'guide progress and your AI choice. It keeps no names.</p>' +
        '<p class="set__state" id="settingsInventory">' + inventoryLine() + '</p>' +
        '<div class="set__choices">' +
          '<button class="set__choice set__choice--danger" type="button" data-delete>' +
            t('Delete all data') + '</button>' +
        '</div>' +
        '<p class="set__state" role="status">' + deleteMessage + '</p>' +
      '</section>' +

      '<section class="set">' +
        '<h3 class="set__title">Guide</h3>' +
        '<p class="set__hint">Three welcome cards, plus a tip the first time you reach a feature.</p>' +
        '<div class="set__choices">' +
          '<button class="set__choice" type="button" data-replay>' + t('Play the guide again') + '</button>' +
          '<button class="set__choice" type="button" data-help>' + t('Open help') + '</button>' +
        '</div>' +
      '</section>';
  }

  function paint() {
    if (!layer) return;
    var host = layer.querySelector('[data-panel="general"]');
    if (host) host.innerHTML = generalHTML();
    var help = layer.querySelector('[data-panel="help"]');
    if (help) {
      help.hidden = view !== 'help';
      if (view === 'help' && typeof Guide !== 'undefined') Guide.fillHelp(help);
    }
    var tabs = layer.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('aria-current', tabs[i].getAttribute('data-tab') === view ? 'true' : 'false');
    }
    if (typeof I18N !== 'undefined') I18N.apply(layer);
  }

  function build() {
    if (built) return;
    built = true;
    layer = document.createElement('div');
    layer.className = 'settings-layer';
    layer.id = 'settingsLayer';
    layer.hidden = true;
    layer.innerHTML =
      '<div class="settings" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" tabindex="-1">' +
        '<header class="settings__head">' +
          '<div>' +
            '<h2 class="settings__title" id="settingsTitle">Settings</h2>' +
          '</div>' +
          '<button class="settings__close" type="button" data-settings-close ' +
            'aria-label="Close settings">×</button>' +
        '</header>' +
        '<div class="settings__tabs">' +
          '<button class="settings__tab" type="button" data-tab="general" aria-current="true">General</button>' +
          '<button class="settings__tab" type="button" data-tab="help">Help</button>' +
        '</div>' +
        '<div class="settings__body" data-panel="general"></div>' +
        '<div class="settings__body" data-panel="help" hidden></div>' +
      '</div>';
    document.body.appendChild(layer);

    layer.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-settings-close')) { close(); return; }
      if (b.hasAttribute('data-tab')) { view = b.getAttribute('data-tab'); paint(); return; }
      if (b.hasAttribute('data-lang')) {
        if (typeof I18N !== 'undefined') I18N.set(b.getAttribute('data-lang'));
        return;
      }
      if (b.hasAttribute('data-theme-choice')) {
        window.__setTheme(b.getAttribute('data-theme-choice'));
        paint();
        return;
      }
      if (b.hasAttribute('data-ai-toggle')) {
        /* one control owns both the switch and consent: on = grant,
           off = revoke. No second pair of consent buttons. */
        var next = !AIPrefs.on();
        AIPrefs.setOn(next);
        if (next) AIPrefs.grant();
        else AIPrefs.revoke();
        paint();
        return;
      }
      if (b.hasAttribute('data-delete')) {
        Prefs.deleteAll();
        deleteMessage = t('All data deleted.');
        paint();
        return;
      }
      if (b.hasAttribute('data-replay')) {
        close();
        if (typeof Guide !== 'undefined') Guide.openLevel1(0);
        return;
      }
      if (b.hasAttribute('data-help')) { view = 'help'; paint(); return; }
    });
  }

  function setGear(expanded) {
    if (gear) gear.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function open(which) {
    build();
    if (trap) { trap.release(); trap = null; }
    view = which === 'help' ? 'help' : 'general';
    deleteMessage = '';
    layer.hidden = false;
    setGear(true);
    paint();
    var box = layer.querySelector('.settings');
    trap = Prefs.trapFocus(box, function () {
      layer.hidden = true;
      setGear(false);
    });
  }

  function close() {
    if (!layer || layer.hidden) return;
    if (trap) { trap.release(); trap = null; } else { layer.hidden = true; setGear(false); }
  }

  function makeGear() {
    if (gear) return;
    var head = document.querySelector('.masthead__top') || document.querySelector('.unit__eyebrow');
    var theme = head && head.querySelector('.theme-toggle');
    if (!head) return;
    gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'settings-open';
    gear.id = 'settingsOpen';
    gear.setAttribute('aria-label', 'Settings');
    gear.setAttribute('aria-expanded', 'false');
    gear.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="3.2"/>' +
      '<path d="M19.4 13.6a7.6 7.6 0 0 0 0-3.2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-2.8-1.6L13.8 2h-3.6l-.4 2.5a7.6 7.6 0 0 0-2.8 1.6l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3.2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 2.8 1.6l.4 2.5h3.6l.4-2.5a7.6 7.6 0 0 0 2.8-1.6l2.4 1 2-3.4-2-1.5z"/>' +
      '</svg>';
    gear.addEventListener('click', function () {
      if (layer && !layer.hidden) close();
      else open('general');
    });
    head.insertBefore(gear, theme || null);
    if (typeof I18N !== 'undefined') I18N.apply(gear);
  }

  function boot() {
    if (typeof document === 'undefined' || !document.body) return;
    makeGear();
    document.addEventListener('i18n:change', function () {
      if (layer) paint();
      if (gear && typeof I18N !== 'undefined') I18N.apply(gear);
    });
    document.addEventListener('theme:change', function () { if (layer && !layer.hidden) paint(); });
    document.addEventListener('ai:change', function () { if (layer && !layer.hidden) paint(); });
    document.addEventListener('prefs:deleted', function () { /* the click repaints */ });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  return {
    open: open,
    close: close,
    paint: paint
  };
})();
