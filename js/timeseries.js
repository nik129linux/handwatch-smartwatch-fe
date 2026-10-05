/* ==========================================================================
   timeseries.js — weekly compliance trend over the seeded history.
   Pure JS, no network, no deps, fully deterministic.

     weeklyRates(events)     per-week done/total/rate + Wilson interval
     ewma(values, alpha)     exponentially weighted moving average
     cusumChange(weeks)      CUSUM change-point: cumulative deviations
                             from the mean, change where |S| peaks;
                             significance from a two-proportion z-test
                             of pre vs post counts
     forecastNext(weeks)     next-week forecast from the EWMA level
                             with a residual-based interval
     trend(weeks)            honest verdict: improving | declining |
                             "no significant change"

   The LLM only narrates these results; it never computes them.
   Works as a plain <script> (window.Timeseries) and under node (require).
   ========================================================================== */

var Timeseries = (function () {
  'use strict';

  function loadStats() {
    if (typeof Stats !== 'undefined') return Stats;
    if (typeof require === 'function') return require('./stats.js');
    throw new Error('timeseries: stats.js is required');
  }

  function clamp01(v) {
    if (!(v >= 0)) return 0;
    if (v > 1) return 1;
    return v;
  }

  function mean(values) {
    if (!values.length) return 0;
    var s = 0;
    for (var i = 0; i < values.length; i++) s += values[i];
    return s / values.length;
  }

  function std(values, m) {
    if (values.length < 2) return 0;
    var mu = (m === undefined) ? mean(values) : m;
    var s = 0;
    for (var i = 0; i < values.length; i++) s += (values[i] - mu) * (values[i] - mu);
    return Math.sqrt(s / (values.length - 1));
  }

  /* Per-week aggregates with Wilson intervals, in week order. */
  function weeklyRates(events) {
    var S = loadStats();
    var byWeek = {};
    events.forEach(function (e) {
      var w = Number(e.week) || 0;
      if (!byWeek[w]) byWeek[w] = { done: 0, total: 0 };
      byWeek[w].total++;
      if (e.done) byWeek[w].done++;
    });
    var keys = Object.keys(byWeek).map(Number).sort(function (a, b) { return a - b; });
    return keys.map(function (w) {
      var wi = S.wilson(byWeek[w].done, byWeek[w].total);
      return {
        week: w,
        done: byWeek[w].done,
        total: byWeek[w].total,
        rate: wi.rate,
        lo: wi.lo,
        hi: wi.hi
      };
    });
  }

  /* Exponentially weighted moving average; out[i] tracks values[i]. */
  function ewma(values, alpha) {
    var a = (alpha === undefined) ? 0.4 : Number(alpha);
    if (!(a > 0) || !(a <= 1)) a = 0.4;
    var out = [];
    if (!values || !values.length) return out;
    var level = values[0];
    out.push(level);
    for (var i = 1; i < values.length; i++) {
      level = a * values[i] + (1 - a) * level;
      out.push(level);
    }
    return out;
  }

  /* CUSUM change-point: S_0 = 0, S_i = S_{i-1} + (x_i - mean).
     The change sits right after the index where |S| peaks.
     Significance comes from the raw counts (pre vs post z-test),
     so a wobble on tiny counts never reads as a change. */
  function cusumChange(weeks) {
    var S = loadStats();
    var empty = {
      index: -1, week: -1, direction: 'none',
      significant: false, p: 1, pre: 0, post: 0
    };
    if (!weeks || weeks.length < 3) return empty;
    var rates = weeks.map(function (w) { return w.rate; });
    var mu = mean(rates);
    var best = -1;
    var peak = -1;
    var cum = 0;
    for (var i = 0; i < rates.length; i++) {
      cum += rates[i] - mu;
      if (Math.abs(cum) > peak) {
        peak = Math.abs(cum);
        best = i;
      }
    }
    /* the change is the first week of the new regime */
    var at = Math.min(best + 1, rates.length - 1);
    if (at < 1) at = 1;
    var preDone = 0;
    var preTotal = 0;
    var postDone = 0;
    var postTotal = 0;
    weeks.forEach(function (w, i) {
      if (i < at) { preDone += w.done; preTotal += w.total; }
      else { postDone += w.done; postTotal += w.total; }
    });
    var t = S.twoPropZ(preDone, preTotal, postDone, postTotal);
    var pre = preTotal ? preDone / preTotal : 0;
    var post = postTotal ? postDone / postTotal : 0;
    return {
      index: at,
      week: weeks[at] ? weeks[at].week : at,
      direction: post > pre ? 'up' : post < pre ? 'down' : 'none',
      significant: t.p < S.ALPHA,
      p: t.p,
      pre: pre,
      post: post
    };
  }

  /* Next-week forecast: the EWMA level, with a residual-based interval. */
  function forecastNext(weeks, alpha) {
    var rates = (weeks || []).map(function (w) { return w.rate; });
    if (!rates.length) return { point: 0, lo: 0, hi: 1 };
    var level = ewma(rates, alpha);
    var point = level[level.length - 1];
    var resid = [];
    for (var i = 1; i < rates.length; i++) resid.push(rates[i] - level[i - 1]);
    var se = resid.length > 1 ? std(resid) : 0.03;
    var half = 1.96 * se;
    return {
      point: clamp01(point),
      lo: clamp01(point - half),
      hi: clamp01(point + half)
    };
  }

  /* Least-squares slope over weekly rates + count-based significance.
     Flat histories honestly report "no significant change". */
  function trend(weeks) {
    var S = loadStats();
    var none = {
      slope: 0, significant: false,
      verdict: 'no significant change', p: 1
    };
    if (!weeks || weeks.length < 3) return none;
    var n = weeks.length;
    var mx = (n - 1) / 2;
    var my = mean(weeks.map(function (w) { return w.rate; }));
    var num = 0;
    var den = 0;
    weeks.forEach(function (w, i) {
      num += (i - mx) * (w.rate - my);
      den += (i - mx) * (i - mx);
    });
    var slope = den > 0 ? num / den : 0;
    var half = Math.floor(n / 2);
    var a = { done: 0, total: 0 };
    var b = { done: 0, total: 0 };
    weeks.forEach(function (w, i) {
      var t = i < half ? a : b;
      t.done += w.done;
      t.total += w.total;
    });
    var test = S.twoPropZ(a.done, a.total, b.done, b.total);
    var significant = test.p < S.ALPHA && Math.abs(slope) > 0.002;
    return {
      slope: slope,
      significant: significant,
      verdict: !significant ? 'no significant change' :
        slope > 0 ? 'improving' : 'declining',
      p: test.p
    };
  }

  return {
    weeklyRates: weeklyRates,
    ewma: ewma,
    cusumChange: cusumChange,
    forecastNext: forecastNext,
    trend: trend
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Timeseries;
}
