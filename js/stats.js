/* ==========================================================================
   stats.js — the numbers behind every insight card. The LLM only
   narrates these results; it never computes them.
   Pure JS, no network, no deps, fully deterministic.

     wilson(done, total)      95% Wilson score interval for a rate
     twoPropZ(a, n1, b, n2)   two-proportion z-test, two-sided
     cohensH(p1, p2)          effect size between two rates
     bhAdjust(pvals)          Benjamini-Hochberg adjusted p values
     analyzeBuckets(items)    each bucket vs the pooled rest, ranked;
                              small n reports "not-enough-data",
                              never a finding

   Works as a plain <script> (window.Stats) and under node (require).
   ========================================================================== */

var Stats = (function () {
  'use strict';

  var Z95 = 1.96;
  var ALPHA = 0.05;
  /* a bucket below this n is "not enough data", never a finding */
  var MIN_N = 30;
  /* a flag needs a real effect, not just a small p on a big n */
  var MIN_H = 0.2;

  function clamp01(v) {
    if (!(v >= 0)) return 0;
    if (v > 1) return 1;
    return v;
  }

  /* standard normal CDF via the Abramowitz-Stegun erf approximation */
  function normCDF(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x));
    var d = 0.3989423 * Math.exp(-x * x / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 +
      t * (-1.821256 + t * 1.330274))));
    return x >= 0 ? 1 - p : p;
  }

  /* Wilson score interval for done/total at 95% confidence. */
  function wilson(done, total, z) {
    var n = Number(total) || 0;
    var k = Number(done) || 0;
    if (n <= 0) return { rate: 0, lo: 0, hi: 1 };
    var zz = (z === undefined) ? Z95 : Number(z);
    var p = clamp01(k / n);
    var denom = 1 + (zz * zz) / n;
    var center = (p + (zz * zz) / (2 * n)) / denom;
    var half = (zz / denom) * Math.sqrt(p * (1 - p) / n + (zz * zz) / (4 * n * n));
    return { rate: p, lo: clamp01(center - half), hi: clamp01(center + half) };
  }

  /* Two-proportion z-test (unpooled SE), two-sided p. */
  function twoPropZ(a, n1, b, n2) {
    var x1 = Number(n1) || 0;
    var x2 = Number(n2) || 0;
    if (x1 <= 0 || x2 <= 0) return { diff: 0, z: 0, p: 1 };
    var p1 = clamp01(Number(a) / x1);
    var p2 = clamp01(Number(b) / x2);
    var se = Math.sqrt(p1 * (1 - p1) / x1 + p2 * (1 - p2) / x2);
    if (!(se > 0)) return { diff: p1 - p2, z: 0, p: 1 };
    var z = (p1 - p2) / se;
    return { diff: p1 - p2, z: z, p: 2 * (1 - normCDF(Math.abs(z))) };
  }

  /* Cohen's h between two rates: 0.2 small, 0.5 medium, 0.8 large. */
  function cohensH(p1, p2) {
    function phi(p) {
      var c = clamp01(p);
      return 2 * Math.asin(Math.sqrt(c));
    }
    return phi(p1) - phi(p2);
  }

  /* Benjamini-Hochberg step-up adjusted p values (same order as input).
     Adjusted values are capped at 1 and monotone in rank. */
  function bhAdjust(pvals) {
    var n = pvals.length;
    if (!n) return [];
    var order = pvals.map(function (p, i) { return i; });
    order.sort(function (a, b) { return pvals[a] - pvals[b]; });
    var adj = new Array(n);
    var running = Infinity;
    for (var r = n - 1; r >= 0; r--) {
      var idx = order[r];
      var rank = r + 1;
      var v = (pvals[idx] * n) / rank;
      if (v > 1) v = 1;
      if (v < 0) v = 0;
      running = Math.min(running, v);
      adj[idx] = running;
    }
    return adj;
  }

  /* Each bucket vs the pooled rest. Status is one of:
       worse | better          flagged: pAdj < 0.05 AND |h| >= MIN_H
       same                    tested, no flag
       not-enough-data         total < MIN_N: never a finding
     Ranked: flagged first (by pAdj, then |h|), then the rest. */
  function analyzeBuckets(items, opts) {
    var o = opts || {};
    var minN = (o.minN === undefined) ? MIN_N : o.minN;
    var minH = (o.minH === undefined) ? MIN_H : o.minH;
    var alpha = (o.alpha === undefined) ? ALPHA : o.alpha;

    var tested = [];
    var rawP = [];
    items.forEach(function (it, i) {
      var done = Number(it.done) || 0;
      var total = Number(it.total) || 0;
      var wi = wilson(done, total);
      var rec = {
        key: String(it.key),
        label: String(it.label || it.key),
        done: done,
        total: total,
        rate: wi.rate,
        lo: wi.lo,
        hi: wi.hi,
        z: 0,
        p: 1,
        pAdj: 1,
        h: 0,
        diff: 0,
        status: 'not-enough-data'
      };
      if (total < minN) {
        tested.push(rec);
        return;
      }
      var restDone = 0;
      var restTotal = 0;
      items.forEach(function (other, j) {
        if (j === i) return;
        if ((Number(other.total) || 0) < minN) return;
        restDone += Number(other.done) || 0;
        restTotal += Number(other.total) || 0;
      });
      if (restTotal < minN) {
        tested.push(rec);
        return;
      }
      var t = twoPropZ(done, total, restDone, restTotal);
      var restRate = restDone / restTotal;
      rec.z = t.z;
      rec.p = t.p;
      rec.diff = wi.rate - restRate;
      rec.h = cohensH(wi.rate, restRate);
      rec.status = 'tested';
      tested.push(rec);
      rawP.push({ rec: rec, p: t.p });
    });

    var adj = bhAdjust(rawP.map(function (x) { return x.p; }));
    rawP.forEach(function (x, i) { x.rec.pAdj = adj[i]; });
    tested.forEach(function (rec) {
      if (rec.status === 'not-enough-data') return;
      if (rec.pAdj < alpha && Math.abs(rec.h) >= minH) {
        rec.status = rec.diff < 0 ? 'worse' : 'better';
      } else {
        rec.status = 'same';
      }
    });

    tested.sort(function (a, b) {
      var fa = (a.status === 'worse' || a.status === 'better') ? 0 : 1;
      var fb = (b.status === 'worse' || b.status === 'better') ? 0 : 1;
      if (fa !== fb) return fa - fb;
      if (a.pAdj !== b.pAdj) return a.pAdj - b.pAdj;
      return Math.abs(b.h) - Math.abs(a.h);
    });
    return tested;
  }

  function fmtPct(v) {
    return Math.round(clamp01(v) * 100) + '%';
  }

  return {
    Z95: Z95,
    ALPHA: ALPHA,
    MIN_N: MIN_N,
    MIN_H: MIN_H,
    normCDF: normCDF,
    wilson: wilson,
    twoPropZ: twoPropZ,
    cohensH: cohensH,
    bhAdjust: bhAdjust,
    analyzeBuckets: analyzeBuckets,
    fmtPct: fmtPct
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Stats;
}
