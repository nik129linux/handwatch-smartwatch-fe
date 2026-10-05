/* ==========================================================================
   calibrate.js — on-device learning from one-tap corrections.
   Pure, no network. When the nurse taps "Yes, I did" on a doubt screen
   (a wrong mark: the watch flagged, she had washed), the per-context
   decision threshold lifts a bounded step, so the same borderline
   signal stays quiet next time. Strong signals still surface: the
   lift is capped, so the unsure floor never passes SAFETY_MAX_UNCERTAIN,
   and every lift decays toward the default over days without corrections.

   Context = moment type + noise bucket. Wraps the classifier output;
   classifier.js itself is never touched.
   Works as a plain <script> (window.Calibrate) and under node (require).
   ========================================================================== */

var Calibrate = (function () {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;

  /* The update rule, in one place. STEP: lift per wrong-mark correction.
     MAX_LIFT: the unsure threshold never rises past 0.40 + 0.12 = 0.52,
     so a real missed wash (solid unsure or sure) still flags. HALF_LIFE_D:
     without corrections the lift halves every 2 days, back toward 0. */
  var STEP = 0.02;
  var MAX_LIFT = 0.12;
  var HALF_LIFE_D = 2;
  var BASE_UNCERTAIN = 0.40;
  var CONFIDENT = 0.75;
  var ACTIVE_ABOVE = 0.0015;
  var STORE_KEY = 'handwatch.calibrate.v1';

  function bucket(noise) {
    var n = Number(noise);
    if (!(n >= 0)) n = 0;
    if (n < 0.33) return 'low';
    if (n < 0.66) return 'mid';
    return 'high';
  }

  function key(moment, noise) {
    return String(moment || 'before-patient') + '|' + bucket(noise);
  }

  function decayOf(entry, now) {
    if (!entry) return 0;
    var t = Number(entry.t);
    var age = (Number(now) || 0) - (t || 0);
    if (!(age > 0)) return entry.v;
    var halves = age / (HALF_LIFE_D * DAY_MS);
    return entry.v * Math.pow(0.5, halves);
  }

  function create() {
    var state = {};

    function correct(ctx, now) {
      var k = key(ctx && ctx.moment, ctx && ctx.noise);
      var t = now === undefined ? Date.now() : Number(now);
      var cur = decayOf(state[k], t);
      var next = Math.min(MAX_LIFT, cur + STEP);
      state[k] = { v: next, t: t };
      persist();
      return next;
    }

    function lift(ctx, now) {
      var k = key(ctx && ctx.moment, ctx && ctx.noise);
      var t = now === undefined ? Date.now() : Number(now);
      return decayOf(state[k], t);
    }

    /* Wrap one classifier result for one context. The label and
       confidence are untouched; only the verdict is re-read against
       the lifted threshold. Strong signals keep flagging. */
    function decide(result, ctx, now) {
      var liftV = lift(ctx, now);
      var floor = Math.min(BASE_UNCERTAIN + liftV, BASE_UNCERTAIN + MAX_LIFT);
      var conf = result ? Number(result.confidence) : 0;
      var label = result ? result.label : 'other';
      var verdict = 'none';
      if (label !== 'other' && conf >= CONFIDENT) verdict = 'sure';
      else if (label !== 'other' && conf >= floor) verdict = 'unsure';
      return { verdict: verdict, lift: liftV, adjusted: liftV > ACTIVE_ABOVE };
    }

    function active(now) {
      var t = now === undefined ? Date.now() : Number(now);
      for (var k in state) {
        if (Object.prototype.hasOwnProperty.call(state, k) &&
            decayOf(state[k], t) > ACTIVE_ABOVE) return true;
      }
      return false;
    }

    function reset() {
      state = {};
      persist();
    }

    function serialize() {
      return JSON.stringify(state);
    }

    function load(json) {
      state = {};
      try {
        var parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          for (var k in parsed) {
            if (!Object.prototype.hasOwnProperty.call(parsed, k)) continue;
            var e = parsed[k];
            if (e && typeof e.v === 'number' && e.v >= 0 && e.v <= MAX_LIFT) {
              state[k] = { v: e.v, t: Number(e.t) || 0 };
            }
          }
        }
      } catch (e) { state = {}; }
      return state;
    }

    /* The shared page store persists itself; isolated create() stores
       in node tests never touch storage. */
    function persist() {
      if (api !== singleton) return;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORE_KEY, serialize());
        }
      } catch (e) { /* private mode — learning lasts the session */ }
    }

    var api = {
      STEP: STEP,
      MAX_LIFT: MAX_LIFT,
      HALF_LIFE_D: HALF_LIFE_D,
      BASE_UNCERTAIN: BASE_UNCERTAIN,
      SAFETY_MAX_UNCERTAIN: BASE_UNCERTAIN + MAX_LIFT,
      STORE_KEY: STORE_KEY,
      DAY_MS: DAY_MS,
      bucket: bucket,
      create: create,
      correct: correct,
      lift: lift,
      decide: decide,
      active: active,
      reset: reset,
      serialize: serialize,
      load: load
    };
    return api;
  }

  var singleton = create();

  /* Pick up yesterday's learning on page load. Node has no window. */
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) singleton.load(raw);
    }
  } catch (e) { /* plain session — start uncalibrated */ }

  return singleton;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Calibrate;
}
