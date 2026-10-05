/* ==========================================================================
   story.js — the event bus, the free-mode console and the guided shift
   The story and the free mode drive exactly the same bus, so what the
   professor sees in the script is what the buttons do.
   ========================================================================== */

var story = (function () {
  'use strict';

  var el = {};
  var logLines = [];
  var running = false;
  var paused = false;
  var stepIx = 0;
  var runToken = 0;
  var waitTimer = null;

  function S() { return window.__storySpeed || 1; }
  function scaled(n) { return Math.max(16, Math.round(n / S())); }

  /* ------------------------------------------------------------ the bus */

  var BUS = {
    /* entering a patient zone: the watch speaks, in silence */
    zona: function (bed) {
      if (watch.isPaused()) {
        pushLog(clockNow(), 'Reminder muted · ' + (bed || watch.state.bed), 'off');
        Log.record(momentFor(''), 'silenced', false);
        return 'swallowed';
      }
      haptics.play('reminder');
      watch.state.pending = true;
      watch.state.lastMoment = 'before-patient';
      watch.addEvent({ text: 'Reminder · ' + (bed || watch.state.bed), kind: 'you' });
      watch.go('recordatorio', 'alert');
      return 'shown';
    },

    /* a wash the watch detected on its own: a seeded stream through the
       on-device classifier, never a canned event */
    lavado: function (opts) {
      if (watch.isPaused()) {
        pushLog(clockNow(), 'Wash logged quietly', 'ok');
        watch.state.done += 1;
        watch.addEvent({ text: 'Wash · ' + watch.state.bed, kind: 'ok' });
        Log.record('before-patient', 'done', false);
        watch.bump();
        return 'quiet';
      }
      var run = Sense.run('wash', { seed: opts && opts.seed, noise: Sense.noise }, true);
      return routeDetection(run, opts || {}, 'before-patient', null);
    },

    /* leaving without washing: a quick gel rub under noise. The classifier
       reads it as unsure, so the watch asks instead of claiming. */
    dudoso: function (when) {
      if (watch.isPaused()) {
        pushLog(clockNow(), 'Doubt muted', 'off');
        Log.record(momentFor(when), 'silenced', false);
        return 'swallowed';
      }
      var run = Sense.run(Sense.DOUBT_SCENARIO,
        { seed: Sense.DOUBT_SEED, noise: Sense.DOUBT_NOISE }, true);
      return routeDetection(run, {}, momentFor(when), when || 'On exit');
    },

    /* a code azul: the watch must shut up */
    codigo: function () {
      watch.pause();
      pushLog(clockNow(), '30-min pause open', 'you');
      return 'paused';
    },

    terminar: function () {
      haptics.play('end');
      pushLog(clockNow(), 'Shift closed · ' + watch.state.done + ' of ' +
        watch.state.opportunities, 'ok');
      watch.go('fin', 'fwd');
      return 'closed';
    },

    reiniciar: function () {
      reset();
      return 'reset';
    }
  };

  function clockNow() { return watch.clock(); }

  /* 'On exit' is the after-patient moment; everything else the watch tracks
     is before the patient. */
  function momentFor(when) {
    return /exit/i.test(when || '') ? 'after-patient' : 'before-patient';
  }

  /* One routing for every detection: the verdict moves the watch. */
  function routeDetection(run, opts, moment, when) {
    if (run.verdict === 'sure') {
      watch.state.pending = false;
      watch.state.lastMoment = moment;
      Log.record(moment, 'done', false);
      watch.startWash(opts || {});
      return 'washing';
    }
    if (run.verdict === 'unsure') {
      watch.state.doubtWhen = when || 'On exit';
      watch.state.lastMoment = moment;
      watch.state.lastWhy = Sense.whyLine();
      haptics.play('doubtful');
      Log.record(moment, 'unsure', false);
      watch.addEvent({
        text: 'Doubt · ' + watch.state.bed,
        kind: 'you'
      });
      watch.go('dudoso', 'alert');
      return 'shown';
    }
    /* nothing readable: stay quiet, unless a moment is still pending */
    if (watch.state.pending) {
      watch.go('recordatorio', 'alert');
      return 'reminded';
    }
    return 'none';
  }

  /* the console indicator follows the watch, not the other way round */
  function mirrorPause(paused) {
    if (!el.freeState) return;
    el.freeState.textContent = paused ? 'muted' : 'active';
    el.freeState.classList.toggle('is-off', paused);
  }

  /* ------------------------------------------------------------ the log */

  function pushLog(time, text, kind) {
    logLines.unshift({ time: time, text: text, kind: kind || 'you' });
    if (logLines.length > 8) logLines.pop();
    renderLog();
  }

  function renderLog() {
    if (!el.log) return;
    el.log.innerHTML = logLines.map(function (l, i) {
      return '<li class="log__row" style="--i:' + i + '">' +
        '<span class="log__time">' + l.time + '</span>' +
        '<span class="log__dot log__dot--' + l.kind + '"></span>' +
        '<span class="log__text">' + l.text + '</span></li>';
    }).join('');
    el.logCount.textContent = String(logLines.length);
  }

  /* ------------------------------------------------------------ fingertip */

  /* The story shows a fingertip landing on "Sí, me lavé" instead of
     teleporting the value — you can see the correction is one tap. */
  function fingertipOn(selector, cb) {
    var btn = document.querySelector(selector);
    if (!btn) { cb(); return; }
    var scr = el.screen.getBoundingClientRect();
    var box = btn.getBoundingClientRect();
    var k = scr.width / el.screen.offsetWidth;
    var tip = el.fingertip;
    tip.style.left = ((box.left + box.width / 2 - scr.left) / k) + 'px';
    tip.style.top = ((box.top + box.height / 2 - scr.top) / k) + 'px';
    tip.classList.remove('is-on');
    void tip.offsetWidth;
    tip.classList.add('is-on');
    window.setTimeout(cb, scaled(760));
  }

  /* ------------------------------------------------------------ the story */

  var BEATS = [
    {
      sub: 'Shift starts.',
      hold: 2400,
      act: function () { watch.setClock(7, 2); watch.home(); }
    },
    {
      sub: 'The watch buzzes. No sound. The patient never notices.',
      hold: 3000,
      act: function () { watch.setClock(7, 4); BUS.zona('Bed 3'); },
      until: function () { return watch.state.screen === 'recordatorio'; }
    },
    {
      sub: 'The wash detects itself. No form exists.',
      hold: 2600,
      act: function () { watch.setClock(7, 5); BUS.lavado({ speed: 5 }); },
      until: function () { return watch.state.screen === 'home' && watch.state.done >= 13; },
      after: function () { watch.setClock(7, 6); }
    },
    {
      sub: 'The watch was wrong. Fixed with one tap, no form.',
      hold: 2600,
      act: function () {
        watch.setClock(7, 14);
        BUS.dudoso('On exit');
      },
      until: function () { return watch.state.screen === 'dudoso'; },
      then: function () {
        fingertipOn('[data-act="doubt-yes"]', function () {
          watch.act('doubt-yes');
        });
      },
      settle: function () { return watch.state.screen === 'home' && watch.state.corrections >= 2; }
    },
    {
      sub: 'In an emergency, the watch stays quiet.',
      hold: 2400,
      act: function () { watch.setClock(7, 21); watch.state.bed = 'Bed 5'; BUS.codigo(); },
      until: function () { return watch.state.screen === 'pausa'; }
    },
    {
      sub: 'The reminder came and stayed logged.',
      hold: 2200,
      act: function () { BUS.zona('Bed 5'); },
      after: function () { watch.back(); },
      settle: function () { return watch.state.screen === 'home'; }
    },
    {
      sub: 'Before entering, the wash anyway.',
      hold: 2400,
      act: function () { watch.startWash({ speed: 5 }); },
      settle: function () { return watch.state.screen === 'home' && watch.state.done >= 15; }
    },
    {
      sub: 'Details are yours. The unit sees totals only.',
      hold: 2800,
      act: function () {
        watch.resume();
        watch.setClock(19, 0);
        watch.state.bed = 'Bed 5';
        BUS.terminar();
      },
      until: function () { return watch.state.screen === 'fin'; }
    },
    {
      sub: '',
      hold: 1800,
      act: function () { watch.go('quien', 'fwd'); },
      until: function () { return watch.state.screen === 'quien'; }
    }
  ];

  function say(text) { el.subtitle.textContent = text || ''; }

  function setControls(runningNow) {
    el.storyPlay.disabled = runningNow;
    el.storyPause.disabled = !runningNow;
    el.storySkip.disabled = !runningNow;
    el.storyPause.textContent = paused ? 'Resume' : 'Pause';
    el.storyPlay.textContent = runningNow ? '▶ Running' : '▶ Guided shift';
    var free = document.querySelectorAll('#freeMode .btn');
    for (var i = 0; i < free.length; i++) free[i].disabled = runningNow;
  }

  /* A beat holds for `hold` (scaled) and then waits for `until` / `settle` to be
     true, so the script never runs ahead of the watch at any speed. */
  function next() {
    if (stepIx >= BEATS.length) { finish(); return; }
    var beat = BEATS[stepIx++];
    var token = runToken;
    say(beat.sub);

    if (beat.act) beat.act();
    if (beat.then) beat.then();
    el.storyClock.textContent = watch.clock();

    var hold = scaled(beat.hold);
    var deadline = Date.now() + hold + 12000;
    var t0 = Date.now();

    var poll = function () {
      if (token !== runToken) return;
      if (paused) { waitTimer = window.setTimeout(poll, 120); return; }
      var held = Date.now() - t0 >= hold;
      var ready = !beat.until || beat.until();
      var settled = !beat.settle || beat.settle();
      if ((held && ready && settled) || Date.now() > deadline) {
        if (beat.after) beat.after();
        next();
        return;
      }
      waitTimer = window.setTimeout(poll, 60);
    };
    waitTimer = window.setTimeout(poll, 60);
  }

  function setPaused(v) {
    paused = v;
    el.storyPause.textContent = v ? 'Resume' : 'Pause';
  }

  function start() {
    stop();
    runToken++;
    reset();
    window.__timeScale = 1 / S();
    running = true;
    stepIx = 0;
    setControls(true);
    next();
  }

  function stop() {
    runToken++;
    if (waitTimer) { window.clearTimeout(waitTimer); waitTimer = null; }
    running = false;
  }

  function finish() {
    stop();
    setControls(false);
    say('');
    el.storyClock.textContent = 'over';
    window.__storyDone = true;
  }

  function skip() {
    stop();
    running = false;
    setControls(false);
    watch.state.done = 15;
    watch.state.corrections = 2;
    watch.state.opportunities = 17;
    watch.setClock(19, 0);
    haptics.play('end');
    watch.go('fin', 'zoom');
    say('');
    el.storyClock.textContent = 'over';
    window.__storyDone = true;
  }

  function togglePause() {
    if (!running) return;
    setPaused(!paused);
  }

  /* ------------------------------------------------------------ reset */

  function reset() {
    var st = watch.state;
    st.done = 12;
    st.plan = 15;
    st.opportunities = 17;
    st.corrections = 1;
    st.bed = 'Bed 3';
    st.doubtWhen = 'On exit';
    st.pausedUntil = 0;
    st.events = [];
    st.speed = 1;
    st.pending = false;
    st.lastMoment = 'before-patient';
    st.lastWhy = '';
    window.__timeScale = 1;
    try {
      if (window.Sense) Sense.reset();
      if (window.Scope) Scope.reset();
    } catch (e) { /* first paint before the modules mount */ }
    watch.el.screen.classList.remove('is-paused');
    logLines.length = 0;
    renderLog();
    stepIx = 0;
    window.__storyDone = false;
    el.storyClock.textContent = 'ready';
    mirrorPause(false);
    watch.home();
  }

  /* ------------------------------------------------------------ mount */

  function mount() {
    el.subtitle = document.getElementById('subtitle');
    el.log = document.getElementById('log');
    el.logCount = document.getElementById('logCount');
    el.freeMode = document.getElementById('freeMode');
    el.freeState = document.getElementById('freeState');
    el.storyPlay = document.getElementById('storyPlay');
    el.storyPause = document.getElementById('storyPause');
    el.storySkip = document.getElementById('storySkip');
    el.storyRestart = document.getElementById('storyRestart');
    el.storyClock = document.getElementById('storyClock');
    el.screen = document.getElementById('screen');
    el.fingertip = document.getElementById('fingertip');

    haptics.mountVocab(document.getElementById('vocab'));
    haptics.resetStrip();

    el.freeMode.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var a = btn.getAttribute('data-act');
      if (a === 'zona') BUS.zona();
      else if (a === 'lavado') BUS.lavado();
      else if (a === 'salir') BUS.dudoso('On exit');
      else if (a === 'dudoso') BUS.dudoso('Doubtful wash');
      else if (a === 'codigo') BUS.codigo();
      else if (a === 'terminar') BUS.terminar();
      else if (a === 'reiniciar') BUS.reiniciar();
    });

    el.storyPlay.addEventListener('click', function () { start(); });
    el.storyRestart.addEventListener('click', function () { reset(); });
    el.storyPause.addEventListener('click', togglePause);
    el.storySkip.addEventListener('click', skip);

    /* the watch's own log feeds the console */
    document.addEventListener('watch:pause', function (ev) {
      mirrorPause(ev.detail.paused);
    });
    document.addEventListener('watch:log', function (ev) {
      pushLog(ev.detail.time, ev.detail.text, ev.detail.kind === 'ok' ? 'ok' : 'you');
    });

    window.addEventListener('resize', function () { watch.fit(); });

    renderLog();
  }

  return { mount: mount, start: start, stop: stop, reset: reset, BUS: BUS, log: logLines };
})();

/* --- bootstrap ---------------------------------------------------------- */

function boot() {
  Log.mount();
  haptics.attach();
  watch.mount();
  story.mount();
  Scope.mount();
  window.__story = story;
  window.__bus = story.BUS;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
