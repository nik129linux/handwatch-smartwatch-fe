/* ==========================================================================
   scope.js — the "Motion signal" bench next to the watch. It shows the
   stream the classifier just read: a canvas waveform with the current
   1 s window highlighted, a confidence meter, and one mono "why" line.
   The noise slider re-runs the last scenario without moving the watch,
   so wrong marks can be watched appearing. Colors come from tokens only
   (read as computed values for the canvas). Honors reduced motion and
   hidden tabs: then the waveform draws once, statically.
   ========================================================================== */

var Scope = (function () {
  'use strict';

  var el = {};
  var raf = null;
  var run = null;

  function cssVar(name) {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch (e) { return ''; }
  }

  function hexToRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function rgba(hex, fallback, alpha) {
    var c = hexToRgb(hex) || hexToRgb(fallback);
    if (!c) return fallback;
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  }

  function reduced() {
    return !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function mag(s) {
    return Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
  }

  /* Draw samples[0..upto], shading the 1 s window that ends at `upto`. */
  function draw(upto) {
    var canvas = el.canvas;
    if (!canvas || !run) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var samples = run.stream.samples;
    var rate = run.stream.rate || 50;
    var n = samples.length;
    if (!n) return;

    var primary = cssVar('--color-primary-500') || '#a6ff00';
    var secondary = cssVar('--text-secondary') || '#a3a3a3';
    var track = cssVar('--bar-track') || '#333333';

    var max = 0.001;
    for (var i = 0; i < n; i++) {
      var m = mag(samples[i]);
      if (m > max) max = m;
    }
    var mid = H / 2;
    var amp = (H / 2 - 6) / max;

    ctx.clearRect(0, 0, W, H);

    /* window shade: the 1 s ending at the playhead */
    var head = Math.min(n - 1, Math.max(0, upto));
    var w0 = Math.max(0, head - rate);
    ctx.fillStyle = rgba(primary, '#a6ff00', 0.14);
    ctx.fillRect((w0 / n) * W, 0, ((head - w0) / n) * W + 1, H);

    /* baseline */
    ctx.strokeStyle = track;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid + 0.5);
    ctx.lineTo(W, mid + 0.5);
    ctx.stroke();

    /* waveform up to the playhead: midpoint-smoothed, no jagged segments */
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    var last = Math.max(1, Math.min(n, upto));
    var px = 0, py = mid - mag(samples[0]) * amp;
    ctx.moveTo(0.5, py);
    for (var x = 1; x < W; x++) {
      var idx = Math.min(last - 1, Math.floor((x / W) * n));
      var y = mid - mag(samples[idx]) * amp;
      var mx = (px + x) / 2 + 0.5, my = (py + y) / 2;
      ctx.quadraticCurveTo(px + 0.5, py, mx, my);
      px = x; py = y;
    }
    ctx.lineTo(W - 0.5, py);
    ctx.stroke();

    /* the motion inside the window, overdrawn in the primary with a glow:
       this is the second the classifier judged */
    ctx.save();
    ctx.strokeStyle = primary;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    var started = false;
    var qx = 0, qy = 0, hasQ = false;
    for (var k = 0; k < W; k++) {
      var j = Math.floor((k / W) * n);
      if (j < w0 || j > head) continue;
      var yy = mid - mag(samples[j]) * amp;
      if (!started) { ctx.moveTo(k + 0.5, yy); started = true; }
      else if (!hasQ) { qx = k; qy = yy; hasQ = true; }
      else {
        ctx.quadraticCurveTo(qx + 0.5, qy, (qx + k) / 2 + 0.5, (qy + yy) / 2);
        qx = k; qy = yy;
      }
    }
    if (hasQ) ctx.lineTo(qx + 0.5, qy);
    ctx.stroke();
    ctx.restore();

    /* playhead */
    ctx.save();
    ctx.fillStyle = primary;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 8;
    ctx.fillRect((head / n) * W - 1, 0, 2, H);
    ctx.restore();
  }

  function stopLoop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  /* One pass over the stream in about a second, then rest on the full
     picture with the last window highlighted. */
  function play() {
    stopLoop();
    if (!run || reduced() || document.hidden) {
      draw(run ? run.stream.samples.length : 0);
      return;
    }
    var n = run.stream.samples.length;
    var t0 = performance.now();
    var dur = Math.min(1400, Math.max(500, (n / 50) * 120));
    (function frame(t) {
      var p = Math.min(1, (t - t0) / dur);
      draw(Math.floor(p * n));
      if (p < 1) raf = requestAnimationFrame(frame);
      else raf = null;
    })(t0);
  }

  function showText() {
    if (!run) return;
    var conf = run.result.confidence;
    if (el.fill) el.fill.style.transform = 'scaleX(' + conf.toFixed(3) + ')';
    if (el.conf) el.conf.textContent = conf.toFixed(2);
    if (el.why) el.why.textContent = Sense.whyLine();
    if (el.label) {
      el.label.textContent = run.stream.scenario + ' · ' +
        Math.round(run.stream.seconds) + ' s · ' + run.verdict;
    }
  }

  function onRun() {
    run = Sense.last();
    if (!run) return;
    showText();
    play();
  }

  function reset() {
    stopLoop();
    run = null;
    if (el.slider) el.slider.value = '0';
    if (el.canvas) {
      el.canvas.getContext('2d').clearRect(0, 0, el.canvas.width, el.canvas.height);
    }
    if (el.fill) el.fill.style.transform = 'scaleX(0)';
    if (el.conf) el.conf.textContent = '0.00';
    if (el.why) el.why.textContent = 'Run a motion to see why';
    if (el.label) el.label.textContent = 'idle';
  }

  function mount() {
    el.canvas = document.getElementById('scopeCanvas');
    el.fill = document.getElementById('scopeFill');
    el.conf = document.getElementById('scopeConf');
    el.why = document.getElementById('scopeWhy');
    el.label = document.getElementById('scopeLabel');
    el.slider = document.getElementById('noiseSlider');
    if (!el.canvas) return;

    document.addEventListener('sense:run', onRun);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && run) draw(run.stream.samples.length);
      else stopLoop();
    });

    if (el.slider) {
      el.slider.addEventListener('input', function () {
        Sense.noise = parseFloat(el.slider.value) || 0;
        /* re-run the last scenario for the scope only: the watch stays
           where it is while the marks change under the slider */
        Sense.run(Sense.lastScenario, { seed: Sense.lastSeed, noise: Sense.noise }, false);
      });
    }
    reset();
  }

  return { mount: mount, reset: reset };
})();
