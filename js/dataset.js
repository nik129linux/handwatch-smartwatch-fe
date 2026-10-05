/* ==========================================================================
   dataset.js — seeded 6-week anonymous unit history for the data layer.
   Pure JS, no network, no deps. Every draw comes from one mulberry32
   stream, so the same seed always yields the same history.

   Each event is an aggregate-safe record with NO person field, ever:

     {week, day, hour, bucket, shift, moment, done, corrected}

   Planted truths (see TRUTH) so the analysis can be checked against
   ground truth:
     1. compliance dips inside the shift-change window (bucket 6,
        hours 18-20) by DIP_DELTA;
     2. an intervention at the start of week INTERVENTION_WEEK lifts
        every compliance by LIFT_DELTA for that week onward.
   Moment-type offsets are small on purpose: they must NOT survive
   the multiple-comparison correction (null buckets stay quiet).
   Works as a plain <script> (window.Dataset) and under node (require).
   ========================================================================== */

var Dataset = (function () {
  'use strict';

  var WEEKS = 6;
  var DAYS = 7;
  var HOURS = 24;
  var BUCKET_H = 3;
  var N_BUCKETS = 8;

  /* planted truth: dip bucket 6 = hours 18,19,20 (the 19:00 change) */
  var TRUTH = {
    dipBucket: 6,
    dipHours: [18, 19, 20],
    interventionWeek: 4,
    baseline: 0.86,
    dipDelta: -0.20,
    liftDelta: 0.10
  };

  var MOMENTS = [
    { key: 'before-patient', name: 'Before the patient', w: 0.30, adj: 0.015 },
    { key: 'before-clean', name: 'Before a clean procedure', w: 0.12, adj: -0.015 },
    { key: 'after-fluid', name: 'After fluid exposure', w: 0.08, adj: -0.015 },
    { key: 'after-patient', name: 'After the patient', w: 0.32, adj: 0.01 },
    { key: 'after-surroundings', name: 'After the surroundings', w: 0.18, adj: -0.01 }
  ];

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

  function bucketOf(hour) {
    return Math.floor(hour / BUCKET_H) % N_BUCKETS;
  }

  function shiftOf(hour) {
    if (hour >= 7 && hour < 15) return 'day';
    if (hour >= 15 && hour < 23) return 'evening';
    return 'night';
  }

  function bucketLabel(b) {
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    return pad2(b * BUCKET_H) + ':00-' + pad2((b * BUCKET_H + BUCKET_H) % HOURS) + ':00';
  }

  /* opportunities per hour: a busy unit by day, a quiet one at night */
  function hourlyCount(hour) {
    if (hour >= 6 && hour <= 22) return 6;
    return 1;
  }

  function pickMoment(rng) {
    var r = rng();
    var acc = 0;
    for (var i = 0; i < MOMENTS.length; i++) {
      acc += MOMENTS[i].w;
      if (r < acc) return MOMENTS[i];
    }
    return MOMENTS[MOMENTS.length - 1];
  }

  function clamp01(v) {
    if (!(v >= 0)) return 0;
    if (v > 1) return 1;
    return v;
  }

  /* One seeded history. `events` is in generation order: week, day, hour. */
  function generate(seed) {
    var s = (seed === undefined) ? 7 : (seed >>> 0);
    var rng = rng32(s);
    var events = [];
    for (var week = 0; week < WEEKS; week++) {
      for (var day = 0; day < DAYS; day++) {
        for (var hour = 0; hour < HOURS; hour++) {
          var n = hourlyCount(hour);
          var inDip = TRUTH.dipHours.indexOf(hour) !== -1;
          for (var k = 0; k < n; k++) {
            var m = pickMoment(rng);
            var p = TRUTH.baseline + m.adj;
            if (inDip) p += TRUTH.dipDelta;
            if (week >= TRUTH.interventionWeek) p += TRUTH.liftDelta;
            p = clamp01(p);
            var done = rng() < p;
            /* a missed wash is sometimes fixed on the spot */
            var corrected = (!done) && (rng() < 0.3);
            events.push({
              week: week,
              day: day,
              hour: hour,
              bucket: bucketOf(hour),
              shift: shiftOf(hour),
              moment: m.key,
              done: done,
              corrected: corrected
            });
          }
        }
      }
    }
    return {
      seed: s,
      weeks: WEEKS,
      events: events,
      truth: {
        dipBucket: TRUTH.dipBucket,
        dipHours: TRUTH.dipHours.slice(),
        interventionWeek: TRUTH.interventionWeek,
        baseline: TRUTH.baseline,
        dipDelta: TRUTH.dipDelta,
        liftDelta: TRUTH.liftDelta
      }
    };
  }

  /* --- aggregation (anonymous counts only) ------------------------------- */

  function tally(events, keyFn, keys) {
    var map = {};
    keys.forEach(function (k) { map[k] = { done: 0, total: 0 }; });
    events.forEach(function (e) {
      var k = String(keyFn(e));
      if (!map[k]) map[k] = { done: 0, total: 0 };
      map[k].total++;
      if (e.done) map[k].done++;
    });
    return map;
  }

  function range(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(String(i));
    return out;
  }

  function byHourBucket(events) {
    var map = tally(events, function (e) { return e.bucket; }, range(N_BUCKETS));
    return range(N_BUCKETS).map(function (b) {
      return {
        key: b,
        label: bucketLabel(Number(b)),
        done: map[b].done,
        total: map[b].total
      };
    });
  }

  function byWeek(events) {
    var map = tally(events, function (e) { return e.week; }, range(WEEKS));
    return range(WEEKS).map(function (w) {
      return { key: w, label: 'Week ' + (Number(w) + 1), done: map[w].done, total: map[w].total };
    });
  }

  function byShift(events) {
    var keys = ['day', 'evening', 'night'];
    var map = tally(events, function (e) { return e.shift; }, keys);
    return keys.map(function (k) {
      return { key: k, label: k, done: map[k].done, total: map[k].total };
    });
  }

  function byMoment(events) {
    var keys = MOMENTS.map(function (m) { return m.key; });
    var names = {};
    MOMENTS.forEach(function (m) { names[m.key] = m.name; });
    var map = tally(events, function (e) { return e.moment; }, keys);
    return keys.map(function (k) {
      return { key: k, label: names[k], done: map[k].done, total: map[k].total };
    });
  }

  function corrections(events) {
    return events.filter(function (e) { return e.corrected; }).length;
  }

  return {
    WEEKS: WEEKS,
    N_BUCKETS: N_BUCKETS,
    TRUTH: TRUTH,
    MOMENTS: MOMENTS,
    bucketOf: bucketOf,
    shiftOf: shiftOf,
    bucketLabel: bucketLabel,
    generate: generate,
    byHourBucket: byHourBucket,
    byWeek: byWeek,
    byShift: byShift,
    byMoment: byMoment,
    corrections: corrections
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dataset;
}
