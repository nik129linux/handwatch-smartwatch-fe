/* ==========================================================================
   signal.js — deterministic seeded 50 Hz 3-axis accelerometer streams
   Pure JS, no network, no model files. Every scenario is a function of
   (scenario, seed, noise), so the same seed always yields the same stream
   and wrongness comes from sensor noise, never from a script.
   Works as a plain <script> (window.Signal) and under node (require).
   ========================================================================== */

var Signal = (function () {
  'use strict';

  var RATE = 50;
  var TAU = Math.PI * 2;

  /* --- seeded PRNG (mulberry32) ----------------------------------------- */

  function rng32(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* gaussian from two uniform draws */
  function gauss(rng) {
    var u = 0;
    var v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function sineBank(t, f, amp, env) {
    return [
      amp * env * Math.sin(TAU * f * t),
      0.8 * amp * env * Math.sin(TAU * f * t + 1.1),
      amp * env * (0.55 * Math.sin(TAU * 2 * f * t + 0.4) +
        0.15 * Math.sin(TAU * f * 0.5 * t))
    ];
  }

  /* --- scenario bodies (zero-mean, pre-noise) ---------------------------- */

  function bodyWash(rng, n, dur) {
    var f = 3 + rng() * 2;                 /* rhythmic 3-5 Hz scrubbing */
    var amp = 1.7;
    var p1 = 0.36 + rng() * 0.1;           /* rinse pauses */
    var p2 = 0.64 + rng() * 0.1;
    var w1 = 1.2 + rng() * 0.6;
    var w2 = 1.2 + rng() * 0.6;
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = i / RATE;
      var env = Math.min(1, t / 2);
      if (t > dur - 1) env *= Math.max(0, (dur - t) / 1);
      var g1 = Math.exp(-Math.pow((t - p1 * dur) / (w1 / 2), 2));
      var g2 = Math.exp(-Math.pow((t - p2 * dur) / (w2 / 2), 2));
      env *= (1 - 0.88 * Math.max(g1, g2));
      out.push(sineBank(t, f, amp, env));
    }
    return { samples: out, freq: f };
  }

  function bodyGel(rng, n, dur) {
    var f = 4 + rng() * 2;                 /* quick 4-6 Hz rub */
    var amp = 1.5;
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = i / RATE;
      var env = Math.min(1, t / 0.6);
      if (t > dur - 1.2) env *= Math.max(0, (dur - t) / 1.2);
      out.push(sineBank(t, f, amp, env));
    }
    return { samples: out, freq: f };
  }

  function bodyDoor(rng, n) {
    var out = [];
    var spikes = [];
    var count = rng() < 0.5 ? 2 : 1;
    for (var k = 0; k < count; k++) {
      spikes.push({
        at: 0.5 + rng() * 3,
        amp: 2.4 + rng() * 0.8,
        wide: 0.05 + rng() * 0.03
      });
    }
    for (var i = 0; i < n; i++) {
      var t = i / RATE;
      var v = [0, 0, 0];
      for (var s = 0; s < spikes.length; s++) {
        var sp = spikes[s];
        var d = (t - sp.at) / sp.wide;
        var hit = sp.amp * Math.exp(-d * d);
        var ring = 0.3 * sp.amp * Math.exp(-d * d / 4) * Math.sin(TAU * 9 * t);
        v[0] += hit + ring;
        v[1] += -0.6 * hit + 0.5 * ring;
        v[2] += 0.4 * hit;
      }
      out.push(v);
    }
    return { samples: out, freq: 0 };
  }

  function bodyTyping(rng, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push([0, 0, 0]);
    var bursts = 10 + Math.floor(rng() * 6);
    for (var b = 0; b < bursts; b++) {
      var start = rng() * 7.4;
      var len = 0.15 + rng() * 0.2;
      var f = 6 + rng() * 3;
      var amp = 0.5 + rng() * 0.3;
      var ph = rng() * TAU;
      var i0 = Math.floor(start * RATE);
      var i1 = Math.min(n - 1, Math.floor((start + len) * RATE));
      for (var i = i0; i <= i1; i++) {
        var t = i / RATE - start;
        var env = Math.sin(Math.PI * (i - i0) / Math.max(1, i1 - i0));
        out[i][0] += amp * env * Math.sin(TAU * f * t + ph);
        out[i][1] += 0.7 * amp * env * Math.sin(TAU * f * t + ph + 0.7);
        out[i][2] += 0.4 * amp * env * Math.sin(TAU * f * t + ph + 1.9);
      }
    }
    return { samples: out, freq: 0 };
  }

  function bodyWave(rng, n) {
    var f = 0.6 + rng() * 0.3;             /* one low-frequency swing */
    var amp = 2.2;
    var mid = n / RATE / 2;
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = i / RATE;
      var env = Math.exp(-Math.pow((t - mid) / 0.9, 2));
      out.push([
        amp * env * Math.sin(TAU * f * t),
        0.5 * amp * env * Math.sin(TAU * f * t + 0.4),
        0.25 * amp * env * Math.sin(TAU * f * t + 0.9)
      ]);
    }
    return { samples: out, freq: f };
  }

  function bodyIdle(rng, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push([0, 0, 0]);
    return { samples: out, freq: 0 };
  }

  var DURATIONS = {
    wash: function (rng) { return 20 + rng() * 5; },
    gel: function (rng) { return 6 + rng() * 3; },
    door: function () { return 4; },
    typing: function () { return 8; },
    wave: function () { return 4; },
    idle: function () { return 4; }
  };

  /* --- public ------------------------------------------------------------ */

  function clampNoise(noise) {
    if (!(noise >= 0)) return 0;
    if (noise > 1) return 1;
    return noise;
  }

  /* Deterministic stream for (scenario, seed, noise). `samples` is an array
     of [x, y, z] triples at RATE Hz. */
  function generate(scenario, opts) {
    opts = opts || {};
    var seed = (opts.seed === undefined) ? 1 : (opts.seed >>> 0);
    var noise = clampNoise(opts.noise === undefined ? 0 : opts.noise);
    if (!DURATIONS[scenario]) throw new Error('unknown scenario: ' + scenario);

    var rng = rng32(seed);
    var dur = DURATIONS[scenario](rng);
    var n = Math.max(1, Math.round(dur * RATE));

    var body;
    if (scenario === 'wash') body = bodyWash(rng, n, dur);
    else if (scenario === 'gel') body = bodyGel(rng, n, dur);
    else if (scenario === 'door') body = bodyDoor(rng, n);
    else if (scenario === 'typing') body = bodyTyping(rng, n);
    else if (scenario === 'wave') body = bodyWave(rng, n);
    else body = bodyIdle(rng, n);

    var samples = body.samples;

    /* sensor floor: faint drift + device tremor, always present */
    for (var i = 0; i < n; i++) {
      var t = i / RATE;
      samples[i][0] += 0.03 * Math.sin(TAU * 0.23 * t) + 0.015 * gauss(rng);
      samples[i][1] += 0.03 * Math.sin(TAU * 0.19 * t + 1) + 0.015 * gauss(rng);
      samples[i][2] += 0.03 * Math.sin(TAU * 0.27 * t + 2) + 0.015 * gauss(rng);
    }

    /* sensor noise: hiss grows with `noise` */
    if (noise > 0) {
      var sigma = noise * 0.85;
      for (var j = 0; j < n; j++) {
        samples[j][0] += sigma * gauss(rng);
        samples[j][1] += sigma * gauss(rng);
        samples[j][2] += sigma * gauss(rng);
      }
      /* drops of signal: flat stretches where the rhythm falls apart */
      var drops = Math.round(noise * dur * 1.1);
      for (var d = 0; d < drops; d++) {
        var at = Math.floor(rng() * n);
        var len = Math.floor((0.15 + rng() * 0.35) * RATE);
        var keep = 1 - 0.9 * noise;
        for (var m = at; m < Math.min(n, at + len); m++) {
          samples[m][0] *= keep;
          samples[m][1] *= keep;
          samples[m][2] *= keep;
        }
      }
    }

    return {
      samples: samples,
      rate: RATE,
      scenario: scenario,
      seed: seed,
      noise: noise,
      seconds: n / RATE,
      toneHz: body.freq
    };
  }

  return {
    RATE: RATE,
    SCENARIOS: ['wash', 'gel', 'door', 'typing', 'wave', 'idle'],
    generate: generate
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Signal;
}
