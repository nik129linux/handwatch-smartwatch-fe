/* ==========================================================================
   haptics.js — the vibration vocabulary
   A deliverable in its own right (case.md): "acuérdate" and "esto quedó mal
   registrado" must not feel the same, so the four patterns are shaped so that
   the nurse can tell them apart with the screen in her pocket, in silence.

   The channel is the body. Sound: never.
   ========================================================================== */

var haptics = (function () {
  'use strict';

  /* --- Vocabulary ---------------------------------------------------------
     `pulse` heights are hand-set: the "dudoso" pattern is the only rising one
     (three taps, each longer than the last) because it asks instead of
     accuses. `recordatorio` is two equal soft taps: "that is due, it did not
     happen". `ok` is a single short tick. `fin` is one long close.
  */
  var VOCAB = {
    reminder: {
      label: 'Reminder',
      meaning: 'Due and missed',
      watchos: 'WKHapticTypeNotification (.notification)',
      pattern: [60, 120, 60],
      heights: [0.5, 0.5]
    },
    ok: {
      label: 'Ok',
      meaning: 'Wash logged',
      watchos: 'WKHapticTypeSuccess (.success)',
      pattern: [35],
      heights: [0.34]
    },
    doubtful: {
      label: 'Doubtful',
      meaning: 'Watch is unsure',
      watchos: 'WKHapticTypeRetry (.retry)',
      pattern: [30, 70, 45, 70, 65],
      heights: [0.3, 0.5, 0.72]
    },
    end: {
      label: 'End',
      meaning: 'Shift over',
      watchos: 'WKHapticTypeStop (.stop)',
      pattern: [400],
      heights: [0.92]
    }
  };

  var ORDER = ['reminder', 'ok', 'doubtful', 'end'];

  var strip = null;      // .haptic-strip
  var barsEl = null;     // container the bars are drawn into
  var nameEl = null;     // pattern name label
  var watchEl = null;    // the watch body, for the shake
  var log = [];          // every pattern played, for the acceptance test
  var liveTimer = null;

  /* Colors are read from CSS, never written here (tokens.css is the only
     place a raw value is allowed to live). */
  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function attach() {
    strip = document.querySelector('.haptic-strip');
    if (!strip) return;
    barsEl = strip.querySelector('.haptic-strip__bars');
    nameEl = strip.querySelector('.haptic-strip__name');
    watchEl = document.getElementById('watch');
  }

  /* Even indices of a vibrate pattern are pulses; odd indices are the silences
     between them. Gaps become spacing, not bars. */
  function pulses(name) {
    var v = VOCAB[name];
    var out = [];
    for (var i = 0; i < v.pattern.length; i += 2) {
      out.push({ ms: v.pattern[i], at: startOf(v.pattern, i), h: v.heights[(i / 2) | 0] || 0.5 });
    }
    return out;
  }

  function startOf(pattern, index) {
    var t = 0;
    for (var i = 0; i < index; i++) t += pattern[i];
    return t;
  }

  function duration(name) {
    return VOCAB[name].pattern.reduce(function (a, b) { return a + b; }, 0);
  }

  /* --- The strip ---------------------------------------------------------- */

  function drawStrip(name, playing) {
    if (!strip) return;
    var v = VOCAB[name];
    var ps = pulses(name);
    var maxMs = 400;
    var accent = token('--color-primary-500');

    strip.dataset.pattern = name;
    if (nameEl) {
      nameEl.innerHTML =
        '<span class="haptic-strip__name-k">Live vibration</span>' +
        '<span class="haptic-strip__name-m">' + v.label + ' · ' + v.meaning + '</span>';
    }
    if (!barsEl) return;

    barsEl.classList.remove('is-idle');
    barsEl.innerHTML = '';
    ps.forEach(function (p) {
      var bar = document.createElement('span');
      bar.className = 'haptic-bar';
      /* width = duration (scaled), height = how the pattern rises */
      bar.style.width = Math.max(6, (p.ms / maxMs) * 84) + 'px';
      bar.style.height = Math.round(p.h * 100) + '%';
      bar.style.setProperty('--at', p.at + 'ms');
      if (playing && accent) bar.style.setProperty('--live', accent);
      barsEl.appendChild(bar);
    });

    strip.classList.toggle('is-playing', !!playing);
  }

  /* Idle: a thin flat line. The strip shows only the pattern in flight;
     at rest the watch is silent, so the strip is too. */
  function resetStrip() {
    if (!strip) return;
    strip.dataset.pattern = '';
    strip.classList.remove('is-playing');
    if (nameEl) {
      nameEl.innerHTML =
        '<span class="haptic-strip__name-k">Live vibration</span>' +
        '<span class="haptic-strip__name-m"></span>';
    }
    if (barsEl) {
      barsEl.classList.add('is-idle');
      barsEl.innerHTML = '<span class="haptic-bar haptic-bar--flat"></span>';
    }
  }

  /* --- The shake ---------------------------------------------------------- */
  /* translate only, <= 2px per pulse. Never a sound, never a colour flash. */

  function shake(pulseCount) {
    if (!watchEl) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    watchEl.classList.remove('watch--shake');
    void watchEl.offsetWidth; // restart the animation
    watchEl.style.setProperty('--pulses', String(Math.min(3, Math.max(1, pulseCount))));
    watchEl.classList.add('watch--shake');
    window.setTimeout(function () { watchEl.classList.remove('watch--shake'); }, 700);
  }

  /* --- Play --------------------------------------------------------------- */

  function play(name) {
    var v = VOCAB[name];
    if (!v) return null;

    log.push({ name: name, pattern: v.pattern.slice() });
    window.__hapticLog = log;

    if (navigator.vibrate) {
      try { navigator.vibrate(v.pattern.slice()); } catch (e) { /* no motor */ }
    }

    drawStrip(name, true);
    markRow(name);
    shake(v.heights.length);

    if (liveTimer) window.clearTimeout(liveTimer);
    var settle = Math.round((duration(name) + 260) * (window.__timeScale || 1));
    liveTimer = window.setTimeout(function () {
      resetStrip();
    }, Math.max(120, settle));

    return v.pattern.slice();
  }

  /* highlight the row of the vocabulary that is speaking */
  function markRow(name) {
    var rows = document.querySelectorAll('.vocab__row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('is-active', rows[i].dataset.pattern === name);
    }
  }

  /* --- Vocabulario rows --------------------------------------------------- */

  function mountVocab(root) {
    if (!root) return;
    root.innerHTML = '';
    ORDER.forEach(function (name) {
      var v = VOCAB[name];
      var row = document.createElement('li');
      row.className = 'vocab__row';
      row.dataset.pattern = name;

      var wave = pulses(name).map(function (p) {
        return '<span class="vocab__wave-bar" style="height:' + Math.round(p.h * 100) + '%"></span>';
      }).join('');

      row.innerHTML =
        '<button class="vocab__play" type="button" data-play="' + name + '" ' +
          'aria-label="Play ' + v.label + '">' +
          '<svg viewBox="0 0 10 12" aria-hidden="true" focusable="false">' +
            '<path class="vocab__tri" d="M1 1.5 L8.5 6 L1 10.5 Z" />' +
          '</svg>' +
        '</button>' +
        '<div class="vocab__body">' +
          '<div class="vocab__name">' + v.label + '</div>' +
          '<div class="vocab__meaning">' + v.meaning + '</div>' +
          '<div class="vocab__wave">' + wave + '</div>' +
          '<div class="vocab__os">' + v.watchos + '</div>' +
        '</div>' +
        '<div class="vocab__pattern" aria-label="' + v.pattern.join(', ') + '">' +
          v.pattern.join(' · ') +
        '</div>';

      root.appendChild(row);
    });

    root.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-play]');
      if (!btn) return;
      play(btn.getAttribute('data-play'));
    });
  }

  return {
    VOCAB: VOCAB,
    ORDER: ORDER,
    play: play,
    token: token,
    pulses: pulses,
    duration: duration,
    attach: attach,
    mountVocab: mountVocab,
    resetStrip: resetStrip,
    log: log
  };
})();
