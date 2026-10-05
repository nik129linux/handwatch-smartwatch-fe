/* ==========================================================================
   sense.js — the watch's sense of motion. Every detection runs a seeded
   accelerometer scenario through the on-device classifier; nothing is
   canned. Verdicts follow the named thresholds in Classifier:

     sure   (conf >= 0.75) -> confident: ok haptic, ring +1
     unsure (0.4 - 0.75)   -> doubtful haptic, "Did you wash?" screen
     none   (below 0.4)    -> nothing (a reminder if a moment is pending)

   `run(scenario, opts, drive)` classifies and remembers the run for the
   scope. With drive:true it also moves the watch; with drive:false it only
   feeds the scope (the noise slider re-runs without yanking screens).
   Works as a plain <script> (window.Sense) and under node (require).
   ========================================================================== */

var Sense = (function () {
  'use strict';

  /* the doubtful beat of the story: a quick gel rub under noise that the
     classifier reads as unsure — fixed seed, deterministic every run */
  var DOUBT_SCENARIO = 'gel';
  var DOUBT_SEED = 2;
  var DOUBT_NOISE = 0.55;

  var FIRST_SEED = 7;
  var seedCounter = FIRST_SEED;
  var noise = 0;
  var lastScenario = 'wash';
  var lastSeed = FIRST_SEED;
  var last = null;

  function deps() {
    var S = (typeof Signal !== 'undefined') ? Signal : null;
    var C = (typeof Classifier !== 'undefined') ? Classifier : null;
    if ((!S || !C) && typeof require === 'function') {
      try {
        if (!S) S = require('./signal.js');
        if (!C) C = require('./classifier.js');
      } catch (e) { /* browser without the scripts — error below */ }
    }
    if (!S || !C) {
      throw new Error('sense needs signal.js and classifier.js loaded first');
    }
    return { Signal: S, Classifier: C };
  }

  function nextSeed() {
    var s = seedCounter;
    seedCounter += 1;
    return s >>> 0;
  }

  function reset() {
    seedCounter = FIRST_SEED;
    noise = 0;
    lastScenario = 'wash';
    lastSeed = FIRST_SEED;
    last = null;
  }

  /* Classify one scenario. Never throws on empty input — the classifier
     answers 'other' and the watch stays quiet. */
  function run(scenario, opts, drive) {
    var d = deps();
    opts = opts || {};
    var seed = opts.seed === undefined ? nextSeed() : (opts.seed >>> 0);
    var nz = opts.noise === undefined ? noise : opts.noise;
    lastScenario = scenario;
    lastSeed = seed;
    var stream = d.Signal.generate(scenario, { seed: seed, noise: nz });
    var result = d.Classifier.classify(stream);
    var word = d.Classifier.verdict(result);
    last = { stream: stream, result: result, verdict: word, seed: seed, noise: nz };
    if (typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('sense:run', {
        detail: { scenario: scenario, seed: seed, noise: nz, drive: !!drive }
      }));
    }
    return last;
  }

  function whyLine() {
    if (!last) return '';
    return deps().Classifier.whyLine(last.result);
  }

  return {
    DOUBT_SCENARIO: DOUBT_SCENARIO,
    DOUBT_SEED: DOUBT_SEED,
    DOUBT_NOISE: DOUBT_NOISE,
    run: run,
    whyLine: whyLine,
    nextSeed: nextSeed,
    reset: reset,
    last: function () { return last; },
    get noise() { return noise; },
    set noise(v) {
      if (!(v >= 0)) v = 0;
      if (v > 1) v = 1;
      noise = v;
    },
    get lastScenario() { return lastScenario; },
    get lastSeed() { return lastSeed; }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Sense;
}
