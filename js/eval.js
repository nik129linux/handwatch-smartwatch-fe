/* ==========================================================================
   eval.js — classifier evaluation on seeded labeled signal streams.
   Pure JS, no network, no deps (signal + classifier + calibrate are
   the only inputs). Fully deterministic for a fixed seed.

     runEval(opts)         confusion matrix, precision/recall/F1 per
                           moment type, reliability curve, Brier score
                           over seeded Signal streams at fixed noise
     correctionStudy(seed) before vs after calibrate.js:
                           - real flagged streams keep flagging
                             (the safety floor holds by design);
                           - a seeded borderline sweep (the unsure band
                             the sensor rarely lands in) is quieted by
                             corrections while solid signals are held.

   Truth mapping: wash -> wash, gel -> gel, every other scenario
   (door, typing, wave, idle) -> other. For wash/gel predictions the
   classifier confidence reads as P(correct). For other predictions it
   measures residual activity instead, so correctness-probability reads
   as 1 - confidence. Brier and the reliability curve use that
   correctness-probability, so a confident wrong answer costs more
   than an unsure one.
   Works as a plain <script> (window.Eval) and under node (require).
   ========================================================================== */

var Eval = (function () {
  'use strict';

  var LABELS = ['wash', 'gel', 'other'];
  var SCENARIOS = ['wash', 'gel', 'door', 'typing', 'wave', 'idle'];
  var MOMENTS = ['before-patient', 'before-clean', 'after-fluid',
    'after-patient', 'after-surroundings'];
  var T0 = 1700000000000;

  function loadDeps() {
    if (typeof Signal !== 'undefined' && typeof Classifier !== 'undefined' &&
      typeof Calibrate !== 'undefined') {
      return { Signal: Signal, Classifier: Classifier, Calibrate: Calibrate };
    }
    if (typeof require === 'function') {
      return {
        Signal: require('./signal.js'),
        Classifier: require('./classifier.js'),
        Calibrate: require('./calibrate.js')
      };
    }
    throw new Error('eval: signal.js, classifier.js and calibrate.js are required');
  }

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

  function truthOf(scenario) {
    if (scenario === 'wash') return 'wash';
    if (scenario === 'gel') return 'gel';
    return 'other';
  }

  function idx(label) {
    return LABELS.indexOf(label);
  }

  /* correctness-probability: confidence for wash/gel reads,
     1 - confidence for other (there confidence is activity evidence) */
  function pCorrect(it) {
    if (it.pred === 'other') return 1 - it.conf;
    return it.conf;
  }

  /* --- main evaluation -------------------------------------------------- */

  function runEval(opts) {
    var D = loadDeps();
    var o = opts || {};
    var seed = (o.seed === undefined) ? 11 : (o.seed >>> 0);
    var perScenario = o.perScenario || 60;
    var noise = (o.noise === undefined) ? 0.35 : Number(o.noise);

    var items = [];
    SCENARIOS.forEach(function (sc) {
      for (var s = 0; s < perScenario; s++) {
        var streamSeed = (seed + s) >>> 0;
        var stream = D.Signal.generate(sc, { seed: streamSeed, noise: noise });
        var result = D.Classifier.classify(stream);
        items.push({
          truth: truthOf(sc),
          scenario: sc,
          seed: streamSeed,
          pred: result.label,
          conf: result.confidence
        });
      }
    });

    var matrix = LABELS.map(function () { return [0, 0, 0]; });
    items.forEach(function (it) {
      matrix[idx(it.truth)][idx(it.pred)] += 1;
    });

    var perClass = LABELS.map(function (label, c) {
      var tp = matrix[c][c];
      var fp = 0;
      var fn = 0;
      for (var r = 0; r < 3; r++) {
        if (r !== c) fn += matrix[c][r];
        if (r !== c) fp += matrix[r][c];
      }
      var support = tp + fn;
      var precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
      var recall = support > 0 ? tp / support : 0;
      var f1 = (precision + recall) > 0 ?
        (2 * precision * recall) / (precision + recall) : 0;
      return { label: label, precision: precision, recall: recall, f1: f1, support: support };
    });

    var correct = items.filter(function (it) { return it.pred === it.truth; }).length;
    var accuracy = items.length ? correct / items.length : 0;

    var brierSum = 0;
    items.forEach(function (it) {
      var y = it.pred === it.truth ? 1 : 0;
      var p = pCorrect(it);
      brierSum += (p - y) * (p - y);
    });
    var brier = items.length ? brierSum / items.length : 0;

    var reliability = [];
    for (var b = 0; b < 5; b++) {
      var lo = b / 5;
      var hi = (b + 1) / 5;
      var bin = items.filter(function (it) {
        var p = pCorrect(it);
        return b === 4 ? (p >= lo && p <= 1) : (p >= lo && p < hi);
      });
      var acc = bin.length ?
        bin.filter(function (it) { return it.pred === it.truth; }).length / bin.length : 0;
      var meanConf = bin.length ?
        bin.reduce(function (s, it) { return s + pCorrect(it); }, 0) / bin.length : (lo + hi) / 2;
      reliability.push({ lo: lo, hi: hi, n: bin.length, meanConf: meanConf, acc: acc });
    }

    return {
      seed: seed,
      noise: noise,
      streams: items.length,
      labels: LABELS.slice(),
      matrix: matrix,
      perClass: perClass,
      accuracy: accuracy,
      brier: brier,
      reliability: reliability
    };
  }

  /* --- before vs after calibrate.js -------------------------------------- */

  function borderlineResult(conf) {
    return {
      label: 'gel',
      confidence: conf,
      seconds: 6,
      features: { rms: 1, domFreq: 5, rhythm: 0.5, activeSeconds: 6, totalSeconds: 7 }
    };
  }

  function correctionStudy(seed) {
    var D = loadDeps();
    var s = (seed === undefined) ? 23 : (seed >>> 0);
    var rng = rng32(s);
    var cal = D.Calibrate.create();

    /* real flagged streams: seeded unsure reads off the sensor */
    var real = [];
    var want = [['gel', 0.55], ['gel', 0.65], ['wash', 0.75]];
    var wi = 0;
    for (var sd = 0; sd < 400 && real.length < 24; sd++) {
      var pick = want[wi++ % want.length];
      var r = D.Classifier.classify(
        D.Signal.generate(pick[0], { seed: (s + sd) >>> 0, noise: pick[1] }));
      if (D.Classifier.verdict(r) === 'unsure') {
        real.push({
          result: r,
          moment: MOMENTS[Math.floor(rng() * MOMENTS.length)],
          noise: pick[1]
        });
      }
    }

    var flaggedBefore = real.filter(function (x) {
      return D.Classifier.verdict(x.result) !== 'none';
    }).length;

    /* one correction tap per flagged stream, as the nurse would */
    real.forEach(function (x, i) {
      cal.correct({ moment: x.moment, noise: x.noise }, T0 + i * 1000);
    });

    var flaggedAfter = real.filter(function (x) {
      return cal.decide(x.result, { moment: x.moment, noise: x.noise },
        T0 + 100000).verdict !== 'none';
    }).length;

    /* borderline sweep: the low unsure band the sensor rarely lands
       in, one fixed context, 8 corrections to the cap */
    var sweepCtx = { moment: 'before-patient', noise: 0.55 };
    var sweep = [];
    for (var i = 0; i < 20; i++) {
      sweep.push(borderlineResult(0.41 + i * 0.005));
    }
    var sweepBefore = sweep.filter(function (r) {
      return D.Calibrate.create().decide(r, sweepCtx, T0).verdict !== 'none';
    }).length;
    /* NOTE: a fresh wrap for the sweep training so the real-stream taps
       above, which live in scattered contexts, cannot move this reading */
    var cal2 = D.Calibrate.create();
    for (var c = 0; c < 8; c++) cal2.correct(sweepCtx, T0 + c * 1000);
    var sweepAfter = sweep.filter(function (r) {
      return cal2.decide(r, sweepCtx, T0 + 8000).verdict !== 'none';
    }).length;

    /* solid signals must survive learning untouched */
    var solid = [];
    for (var s2 = 0; s2 < 200 && solid.length < 20; s2++) {
      var rr = D.Classifier.classify(
        D.Signal.generate(s2 % 2 ? 'wash' : 'gel', { seed: (s + s2) >>> 0, noise: 0 }));
      if (rr.label !== 'other' && rr.confidence >= 0.6) solid.push(rr);
    }
    var held = solid.filter(function (r) {
      return cal2.decide(r, sweepCtx, T0 + 8000).verdict !== 'none';
    }).length;

    return {
      seed: s,
      realStreams: real.length,
      realFlaggedBefore: flaggedBefore,
      realFlaggedAfter: flaggedAfter,
      sweepBefore: sweepBefore,
      sweepAfter: sweepAfter,
      solidTotal: solid.length,
      solidHeld: held,
      corrections: real.length + 8
    };
  }

  return {
    LABELS: LABELS,
    SCENARIOS: SCENARIOS,
    truthOf: truthOf,
    runEval: runEval,
    correctionStudy: correctionStudy
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Eval;
}
