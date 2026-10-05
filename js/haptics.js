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
  var springRaf = null;  // the bar-spring loop
  var shakeRaf = null;   // the shake-spring loop
  var REDUCED = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* A hand-written damped spring (semi-implicit Euler), shared by the bars
     and the shake. Underdamped, so it overshoots once and settles — the
     physical read the strip and the case both need. */
  function springStep(s, target, k, c, dt) {
    var f = -k * (s.x - target) - c * s.v;
    s.v += f * dt;
    s.x += s.v * dt;
    return Math.abs(s.x - target) < 0.002 && Math.abs(s.v) < 0.002;
  }

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
    var bars = ps.map(function (p) {
      var bar = document.createElement('span');
      bar.className = 'haptic-bar';
      /* width = duration (scaled), height = how the pattern rises */
      bar.style.width = Math.max(6, (p.ms / maxMs) * 84) + 'px';
      bar.style.height = Math.round(p.h * 100) + '%';
      bar.style.setProperty('--at', p.at + 'ms');
      if (playing && accent) bar.style.setProperty('--live', accent);
      barsEl.appendChild(bar);
      return { node: bar, at: p.at, s: { x: 0.18, v: 0 } };
    });

    strip.classList.toggle('is-playing', !!playing);
    if (playing) springBars(bars);
  }

  /* Bars pop with spring physics, each starting at its own pattern offset.
     Reduced motion: rest state immediately, no loop. */
  function springBars(bars) {
    if (springRaf) { cancelAnimationFrame(springRaf); springRaf = null; }
    if (REDUCED || document.hidden) {
      bars.forEach(function (b) {
        b.node.style.transform = 'scaleY(1)';
        b.node.style.opacity = '1';
      });
      return;
    }
    var t0 = performance.now();
    var scale = window.__timeScale || 1;
    (function frame(t) {
      var dt = Math.min(0.05, (t - (frame.last || t)) / 1000 || 0.016);
      frame.last = t;
      var done = true;
      bars.forEach(function (b) {
        var local = (t - t0) / Math.max(0.05, scale) - b.at;
        if (local < 0) { /* not its turn yet */
          b.node.style.transform = 'scaleY(0.18)';
          b.node.style.opacity = '0.35';
          done = false;
          return;
        }
        if (!springStep(b.s, 1, 170, 13, dt)) done = false;
        b.node.style.transform = 'scaleY(' + Math.max(0.02, b.s.x).toFixed(3) + ')';
        b.node.style.opacity = String(Math.min(1, 0.35 + b.s.x * 0.65).toFixed(3));
      });
      if (!done && strip && strip.classList.contains('is-playing')) {
        springRaf = requestAnimationFrame(frame);
      } else { springRaf = null; }
    })(t0);
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

  /* --- The shake ----------------------------------------------------------
     The case shakes once per pulse (<= 2px), driven by the same damped
     spring as the bars: each pulse kicks the velocity, the spring settles.
     translate (independent property) so tilt (transform) is never disturbed.
     Never a sound, never a colour flash. */

  function shake(pattern) {
    if (!watchEl || REDUCED) return;
    if (shakeRaf) { cancelAnimationFrame(shakeRaf); shakeRaf = null; }
    var s = { x: 0, v: 0 };
    var scale = window.__timeScale || 1;
    var timers = [];
    var alive = true;

    function loop(t) {
      if (!alive || document.hidden) { shakeRaf = null; return; }
      var dt = Math.min(0.05, (t - (loop.last || t)) / 1000 || 0.016);
      loop.last = t;
      var atRest = springStep(s, 0, 220, 11, dt);
      watchEl.style.translate = s.x.toFixed(3) + 'px 0px';
      if (!atRest || loop.kicks > 0) {
        shakeRaf = requestAnimationFrame(loop);
      } else {
        watchEl.style.translate = '0px 0px';
        shakeRaf = null;
      }
    }
    loop.kicks = 0;

    /* one kick per pulse, at the pulse's own offset in the pattern */
    var t = 0;
    for (var i = 0; i < pattern.length; i += 2) {
      (function (at, first) {
        loop.kicks++;
        timers.push(window.setTimeout(function () {
          loop.kicks--;
          /* alternate direction, <= 2px peak: the body answers each tap */
          s.v += first ? -46 : (s.v >= 0 ? -38 : 38);
          if (!shakeRaf && alive) {
            loop.last = performance.now();
            shakeRaf = requestAnimationFrame(loop);
          }
        }, Math.max(16, Math.round(at * scale))));
      })(t, i === 0);
      t += pattern[i] + (pattern[i + 1] || 0);
    }
    timers.push(window.setTimeout(function () {
      alive = false;
      timers.forEach(function (id) { window.clearTimeout(id); });
    }, Math.max(120, Math.round((t + 700) * scale))));
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
    shake(v.pattern.slice());

    try {
      document.dispatchEvent(new CustomEvent('haptic:play', { detail: { name: name } }));
    } catch (e) { /* listeners are decorative */ }

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
