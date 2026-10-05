/* ==========================================================================
   insights.js — the data-science view model for the unit page.
   The statistics come from stats.js / timeseries.js / eval.js; this
   file only shapes them into ranked cards and canvas charts, and
   offers a grounded plain-language rewrite of the top 3 cards:

     deterministic templates (always work, on-device) ->
       Ollama via the Electron bridge (card numbers only) ->
         back to templates on ANY failure.

   A rewrite may only cite numbers present in the cards; anything
   else is discarded. Every answer carries a source badge.
   Anonymous by construction: cards hold aggregates only.
   Works as a plain <script> (window.Insights) and under node (require).
   ========================================================================== */

var Insights = (function () {
  'use strict';

  var SEED = 7;
  var REWRITE_MAX = 300;

  var BLAME_RE = /\b(fail|violat|fault|error|neglig|blam|accus|lazy|careless|slack)\w*\b/i;

  function loadLibs() {
    if (typeof Dataset !== 'undefined' && typeof Stats !== 'undefined' &&
      typeof Timeseries !== 'undefined' && typeof Eval !== 'undefined') {
      return { Dataset: Dataset, Stats: Stats, Timeseries: Timeseries, Eval: Eval };
    }
    if (typeof require === 'function') {
      return {
        Dataset: require('./dataset.js'),
        Stats: require('./stats.js'),
        Timeseries: require('./timeseries.js'),
        Eval: require('./eval.js')
      };
    }
    throw new Error('insights: dataset, stats, timeseries and eval are required');
  }

  function pct(v) {
    return Math.round(v * 100) + '%';
  }

  function fmtP(p) {
    if (!(p >= 0)) return 'p —';
    if (p < 0.001) return 'p<0.001';
    return 'p=' + p.toFixed(3);
  }

  /* --- analysis: one deterministic pass over the seeded history --------- */

  function buildAnalysis(seed) {
    var L = loadLibs();
    var data = L.Dataset.generate(seed === undefined ? SEED : seed);
    var buckets = L.Dataset.byHourBucket(data.events);
    var tested = L.Stats.analyzeBuckets(buckets);
    var weeks = L.Timeseries.weeklyRates(data.events);
    var change = L.Timeseries.cusumChange(weeks);
    var fc = L.Timeseries.forecastNext(weeks);
    var trendR = L.Timeseries.trend(weeks);
    var evaluation = L.Eval.runEval({ seed: 11 });
    var study = L.Eval.correctionStudy(23);

    var cards = [];
    tested.forEach(function (b) {
      if (b.status !== 'worse' && b.status !== 'better') return;
      var rest = b.total ? (b.done / b.total) : 0;
      var elsewhere = null;
      var rd = 0;
      var rt = 0;
      tested.forEach(function (o) {
        if (o.key === b.key || o.total < L.Stats.MIN_N) return;
        rd += o.done;
        rt += o.total;
      });
      elsewhere = rt ? rd / rt : rest;
      var body = b.status === 'worse' ?
        b.label + ' reads ' + pct(b.rate) + ' (' + b.done + ' of ' + b.total +
        ', 95% CI ' + pct(b.lo) + '-' + pct(b.hi) + ') against ' +
        pct(elsewhere) + ' elsewhere; ' + fmtP(b.pAdj) +
        ' after correction. Move a dispenser to cover this window and recheck at handover.' :
        b.label + ' reads ' + pct(b.rate) + ' (' + b.done + ' of ' + b.total +
        ', 95% CI ' + pct(b.lo) + '-' + pct(b.hi) + ') against ' +
        pct(elsewhere) + ' elsewhere; ' + fmtP(b.pAdj) +
        ' after correction. Keep the current setup here and recheck next week.';
      cards.push({
        id: 'bucket-' + b.key,
        kind: 'bucket',
        title: b.status === 'worse' ? 'Weak window: ' + b.label : 'Strong window: ' + b.label,
        body: body.slice(0, REWRITE_MAX),
        n: b.total,
        rate: b.rate,
        lo: b.lo,
        hi: b.hi,
        pAdj: b.pAdj,
        h: b.h,
        status: b.status
      });
    });

    if (change.significant) {
      var totalChecks = weeks.reduce(function (s, w) { return s + w.total; }, 0);
      var postW = weeks[change.index];
      cards.push({
        id: 'trend-change',
        kind: 'change',
        title: 'Shift at week ' + (change.week + 1),
        body: ('Compliance moved from ' + pct(change.pre) + ' to ' +
          pct(change.post) + ' starting week ' + (change.week + 1) +
          ' (' + totalChecks + ' checks, ' + fmtP(change.p) +
          '). Keep the handover overlap and recheck in two weeks.'
        ).slice(0, REWRITE_MAX),
        n: totalChecks,
        rate: change.post,
        lo: postW ? postW.lo : change.post,
        hi: postW ? postW.hi : change.post,
        pAdj: change.p,
        h: L.Stats.cohensH(change.post, change.pre),
        status: change.direction === 'up' ? 'better' : 'worse'
      });
    }

    /* ranked: flagged first, then by adjusted p, then by |effect| */
    cards.sort(function (a, b) {
      if (a.pAdj !== b.pAdj) return a.pAdj - b.pAdj;
      return Math.abs(b.h) - Math.abs(a.h);
    });

    return {
      seed: data.seed,
      total: data.events.length,
      corrections: L.Dataset.corrections(data.events),
      buckets: tested,
      weeks: weeks,
      change: change,
      forecast: fc,
      trend: trendR,
      cards: cards,
      evaluation: evaluation,
      study: study
    };
  }

  /* --- grounded rewrite of the top 3 cards ------------------------------- */

  function promptNumbers(prompt) {
    var nums = {};
    var hits = String(prompt).match(/\d+(?:\.\d+)?/g) || [];
    hits.forEach(function (n) { nums[String(Number(n))] = 1; });
    return nums;
  }

  function grounded(text, allowed) {
    var hits = String(text).match(/\d+(?:\.\d+)?/g) || [];
    for (var i = 0; i < hits.length; i++) {
      if (!allowed[String(Number(hits[i]))]) return false;
    }
    return true;
  }

  function rewritePrompt(top) {
    return 'Unit hand-hygiene findings (anonymous aggregates): ' +
      JSON.stringify(top) + ' Rewrite each finding in plain words. ' +
      'Reply JSON only: {"rewrites": [{"id": "...", "text": "..."}]}. ' +
      'One rewrite per finding, same order, same id. Each text: max ' +
      REWRITE_MAX + ' chars, cites only numbers shown in the findings, ' +
      'keeps every number it cites exact, about the process never people.';
  }

  function parseRewrites(text, ctx) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    if (!data || !Array.isArray(data.rewrites)) return null;
    if (!data.rewrites.length || data.rewrites.length > 3) return null;
    var allowed = promptNumbers(ctx && ctx.prompt);
    var wantIds = {};
    (ctx && ctx.top || []).forEach(function (c) { wantIds[c.id] = 1; });
    var out = [];
    for (var i = 0; i < data.rewrites.length; i++) {
      var r = data.rewrites[i];
      if (!r || typeof r.text !== 'string' || !r.text.trim()) return null;
      if (!wantIds[r.id]) return null;
      if (BLAME_RE.test(r.text)) return null;
      if (!grounded(r.text, allowed)) return null;
      out.push({ id: r.id, text: r.text.trim().slice(0, REWRITE_MAX) });
    }
    return out;
  }

  function rulesRewrites(top) {
    return top.map(function (c) { return { id: c.id, text: c.body }; });
  }

  /* deps: { transport, consent: 'yes'|'no'|null,
             onConsent: async (payload) -> 'yes'|'no' } */
  async function rewriteTop3(cards, deps) {
    var top = (cards || []).slice(0, 3);
    var rules = function () { return rulesRewrites(top); };
    deps = deps || {};
    var transport = deps.transport || null;
    if (!top.length) return { rewrites: [], source: 'Rules' };
    if (!transport) return { rewrites: rules(), source: 'Rules' };
    var consent = deps.consent || null;
    if (consent !== 'yes') {
      if (consent === 'no' || typeof deps.onConsent !== 'function') {
        return { rewrites: rules(), source: 'Rules' };
      }
      var answer = 'no';
      try { answer = await deps.onConsent(top); } catch (e) { answer = 'no'; }
      if (answer !== 'yes') return { rewrites: rules(), source: 'Rules' };
    }
    try {
      var prompt = rewritePrompt(top);
      var res = await transport.query(prompt);
      if (!res || !res.ok || typeof res.text !== 'string' || !res.model) {
        return { rewrites: rules(), source: 'Rules' };
      }
      var parsed = parseRewrites(res.text, { prompt: prompt, top: top });
      if (!parsed || parsed.length !== top.length) {
        return { rewrites: rules(), source: 'Rules' };
      }
      return { rewrites: parsed, source: 'Ollama · ' + res.model };
    } catch (e) {
      return { rewrites: rules(), source: 'Rules' };
    }
  }

  /* --- canvas charts ------------------------------------------------------ */

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      if (v && v.trim()) return v.trim();
    } catch (e) { /* node or plain contexts — fall through */ }
    return fallback;
  }

  function fitCanvas(canvas, height) {
    var dpr = 1;
    try { dpr = window.devicePixelRatio || 1; } catch (e) { dpr = 1; }
    var w = canvas.clientWidth || 600;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: height };
  }

  function paintTrend(canvas, weeks, change, fc) {
    if (!canvas || !canvas.getContext) return;
    var pad = { l: 40, r: 12, t: 12, b: 26 };
    var g = fitCanvas(canvas, 220);
    var ctx = g.ctx;
    var W = g.w;
    var H = g.h;
    var ink = cssVar('--text-primary', '#fdfdfd');
    var faint = cssVar('--text-tertiary', '#6f6f6f');
    var lime = cssVar('--color-primary-500', '#a6ff00');
    var line = cssVar('--border-subtle', '#333333');
    var n = weeks.length;
    function x(i) {
      return pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n);
    }
    function y(v) {
      var lo = 0.55;
      var hi = 1.0;
      var c = Math.min(hi, Math.max(lo, v));
      return pad.t + (1 - (c - lo) / (hi - lo)) * (H - pad.t - pad.b);
    }
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    [0.6, 0.7, 0.8, 0.9, 1.0].forEach(function (v) {
      ctx.beginPath();
      ctx.moveTo(pad.l, y(v));
      ctx.lineTo(W - pad.r, y(v));
      ctx.stroke();
      ctx.fillStyle = faint;
      ctx.font = '11px monospace';
      ctx.fillText(Math.round(v * 100) + '%', 4, y(v) + 4);
    });
    /* CI band */
    ctx.beginPath();
    weeks.forEach(function (wk, i) {
      if (i === 0) ctx.moveTo(x(i), y(wk.hi));
      else ctx.lineTo(x(i), y(wk.hi));
    });
    for (var j = n - 1; j >= 0; j--) ctx.lineTo(x(j), y(weeks[j].lo));
    ctx.closePath();
    ctx.fillStyle = cssVar('--bg-raised', '#171717');
    ctx.fill();
    /* weekly line */
    ctx.beginPath();
    weeks.forEach(function (wk, i) {
      if (i === 0) ctx.moveTo(x(i), y(wk.rate));
      else ctx.lineTo(x(i), y(wk.rate));
    });
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    /* CI whiskers + dots */
    weeks.forEach(function (wk, i) {
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x(i), y(wk.hi));
      ctx.lineTo(x(i), y(wk.lo));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x(i), y(wk.rate), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.fillStyle = faint;
      ctx.font = '11px monospace';
      ctx.fillText('W' + (wk.week + 1), x(i) - 8, H - 8);
    });
    /* change-point marker */
    if (change && change.significant && change.index >= 0 && change.index < n) {
      ctx.strokeStyle = lime;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x(change.index), pad.t);
      ctx.lineTo(x(change.index), H - pad.b);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lime;
      ctx.font = '11px monospace';
      ctx.fillText('shift', x(change.index) + 5, pad.t + 12);
    }
    /* forecast: hollow dot + interval */
    if (fc) {
      var fx = x(n);
      ctx.strokeStyle = lime;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx, y(fc.hi));
      ctx.lineTo(fx, y(fc.lo));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx, y(fc.point), 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = faint;
      ctx.font = '11px monospace';
      ctx.fillText('next', fx - 10, H - 8);
    }
  }

  function paintBuckets(canvas, buckets) {
    if (!canvas || !canvas.getContext) return;
    var g = fitCanvas(canvas, 24 + buckets.length * 26);
    var ctx = g.ctx;
    var W = g.w;
    var H = g.h;
    var ink = cssVar('--text-primary', '#fdfdfd');
    var faint = cssVar('--text-tertiary', '#6f6f6f');
    var lime = cssVar('--color-primary-500', '#a6ff00');
    var track = cssVar('--bar-track', '#333333');
    ctx.clearRect(0, 0, W, H);
    var labelW = 86;
    var valW = 46;
    buckets.forEach(function (b, i) {
      var top = 14 + i * 26;
      ctx.fillStyle = faint;
      ctx.font = '11px monospace';
      ctx.fillText(b.label, 0, top + 10);
      var bx = labelW;
      var bw = W - labelW - valW;
      ctx.fillStyle = track;
      ctx.fillRect(bx, top, bw, 10);
      ctx.fillStyle = b.status === 'worse' ? lime : ink;
      ctx.fillRect(bx, top, Math.max(2, bw * b.rate), 10);
      /* CI whisker */
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      var cx0 = bx + bw * b.lo;
      var cx1 = bx + bw * b.hi;
      ctx.beginPath();
      ctx.moveTo(cx0, top - 2);
      ctx.lineTo(cx1, top - 2);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fillText(pct(b.rate), bx + bw + 6, top + 10);
    });
  }

  function paintMatrix(canvas, evaluation) {
    if (!canvas || !canvas.getContext || !evaluation) return;
    var g = fitCanvas(canvas, 190);
    var ctx = g.ctx;
    var W = g.w;
    var H = g.h;
    var ink = cssVar('--text-primary', '#fdfdfd');
    var faint = cssVar('--text-tertiary', '#6f6f6f');
    var lime = cssVar('--color-primary-500', '#a6ff00');
    var track = cssVar('--bg-raised', '#171717');
    var labels = evaluation.labels;
    var m = evaluation.matrix;
    var max = 1;
    m.forEach(function (row) {
      row.forEach(function (v) { if (v > max) max = v; });
    });
    ctx.clearRect(0, 0, W, H);
    var head = 22;
    var cell = Math.min((W - head) / 3, (H - head) / 3);
    var short = ['wash', 'gel', 'other'];
    ctx.font = '11px monospace';
    for (var c = 0; c < 3; c++) {
      ctx.fillStyle = faint;
      ctx.fillText(short[c], head + c * cell + cell / 2 - 14, 14);
      ctx.fillText(short[c], 2, head + c * cell + cell / 2 + 4);
    }
    for (var r = 0; r < 3; r++) {
      for (var q = 0; q < 3; q++) {
        var x0 = head + q * cell;
        var y0 = head + r * cell;
        ctx.fillStyle = track;
        ctx.fillRect(x0 + 1, y0 + 1, cell - 2, cell - 2);
        if (r === q && m[r][q] > 0) {
          ctx.fillStyle = lime;
          ctx.globalAlpha = 0.15 + 0.55 * (m[r][q] / max);
          ctx.fillRect(x0 + 1, y0 + 1, cell - 2, cell - 2);
          ctx.globalAlpha = 1;
        }
        if (m[r][q] > 0) {
          ctx.fillStyle = ink;
          ctx.font = '600 13px monospace';
          var s = String(m[r][q]);
          ctx.fillText(s, x0 + cell / 2 - s.length * 4, y0 + cell / 2 + 5);
          ctx.font = '11px monospace';
        }
      }
    }
  }

  function paintReliability(canvas, evaluation) {
    if (!canvas || !canvas.getContext || !evaluation) return;
    var pad = { l: 40, r: 12, t: 12, b: 26 };
    var g = fitCanvas(canvas, 190);
    var ctx = g.ctx;
    var W = g.w;
    var H = g.h;
    var ink = cssVar('--text-primary', '#fdfdfd');
    var faint = cssVar('--text-tertiary', '#6f6f6f');
    var lime = cssVar('--color-primary-500', '#a6ff00');
    var line = cssVar('--border-subtle', '#333333');
    function x(v) { return pad.l + v * (W - pad.l - pad.r); }
    function y(v) { return pad.t + (1 - v) * (H - pad.t - pad.b); }
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.l, pad.t, W - pad.l - pad.r, H - pad.t - pad.b);
    /* diagonal: perfect calibration */
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    ctx.lineTo(x(1), y(1));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = faint;
    ctx.font = '11px monospace';
    ctx.fillText('0', pad.l - 12, y(0) + 4);
    ctx.fillText('1', pad.l - 12, y(1) + 4);
    ctx.fillText('stated', W - 52, y(0.06));
    ctx.fillText('hit rate', 4, pad.t + 4);
    evaluation.reliability.forEach(function (bin) {
      if (!bin.n) return;
      var radius = 3 + 9 * Math.sqrt(bin.n / evaluation.streams);
      ctx.beginPath();
      ctx.arc(x(bin.meanConf), y(bin.acc), radius, 0, Math.PI * 2);
      ctx.fillStyle = lime;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.fillText('n=' + bin.n, x(bin.meanConf) + radius + 3,
        y(bin.acc) + 4);
    });
  }

  /* --- page wiring ---------------------------------------------------------- */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function statLine(c) {
    return 'n=' + c.n + ' · rate ' + pct(c.rate) +
      ' · CI ' + pct(c.lo) + '-' + pct(c.hi) +
      ' · ' + fmtP(c.pAdj) + ' · effect ' + (c.h >= 0 ? '+' : '') + c.h.toFixed(2);
  }

  function paintCards(cards) {
    var host = document.getElementById('insightList');
    if (!host) return;
    host.innerHTML = cards.map(function (c, i) {
      return '<li class="insight__item" style="--i:' + i + '">' +
        '<p class="insight__title">' + esc(c.title) + '</p>' +
        '<p class="insight__body" data-insight-id="' + esc(c.id) + '">' +
        esc(c.body) + '</p>' +
        '<p class="insight__stats">' + esc(statLine(c)) + '</p>' +
        '</li>';
    }).join('');
  }

  function paintModelQuality(analysis) {
    var ev = analysis.evaluation;
    var note = document.getElementById('evalNote');
    if (note) {
      note.textContent = ev.streams + ' seeded streams at noise ' +
        ev.noise + ': accuracy ' + pct(ev.accuracy) + ', Brier ' +
        ev.brier.toFixed(3) + '. Rows are truth, columns are predictions.';
    }
    var table = document.getElementById('modelTable');
    if (table) {
      var html = '<tr><th scope="col">Moment</th>' +
        '<th scope="col">Precision</th><th scope="col">Recall</th>' +
        '<th scope="col">F1</th><th scope="col">Checks</th></tr>';
      ev.perClass.forEach(function (c) {
        html += '<tr><th scope="row">' + esc(c.label) + '</th><td>' +
          c.precision.toFixed(2) + '</td><td>' + c.recall.toFixed(2) +
          '</td><td>' + c.f1.toFixed(2) + '</td><td>' + c.support + '</td></tr>';
      });
      table.innerHTML = html;
    }
    var calib = document.getElementById('calibNote');
    if (calib) {
      var st = analysis.study;
      calib.textContent = 'After ' + st.corrections + ' corrections: ' +
        st.sweepAfter + ' of 20 borderline flags still surface (was ' +
        st.sweepBefore + '), ' + st.solidHeld + ' of ' + st.solidTotal +
        ' solid detections held, and all ' + st.realFlaggedAfter +
        ' real flagged streams still surface.';
    }
    var fc = document.getElementById('forecastNote');
    if (fc) {
      fc.textContent = 'Next week reads near ' + pct(analysis.forecast.point) +
        ' (interval ' + pct(analysis.forecast.lo) + '-' +
        pct(analysis.forecast.hi) + '). Trend: ' + analysis.trend.verdict + '.';
    }
  }

  function paintBadge(source) {
    var badge = document.getElementById('insightBadge');
    if (badge) badge.textContent = source;
  }

  function applyRewrites(rewrites) {
    rewrites.forEach(function (r) {
      var el = document.querySelector('[data-insight-id="' + r.id + '"]');
      if (el) el.textContent = r.text;
    });
  }

  function wireRewrite(analysis) {
    var btn = document.getElementById('insightModel');
    if (!btn) return;
    var transport = null;
    try {
      if (typeof AI !== 'undefined' && AI.browserTransport) {
        transport = AI.browserTransport();
      }
    } catch (e) { transport = null; }
    if (!transport) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      btn.disabled = true;
      var consent = null;
      var onConsent = null;
      try {
        if (typeof AI !== 'undefined' && AI.requestConsent) {
          onConsent = AI.requestConsent;
        }
      } catch (e) { onConsent = null; }
      rewriteTop3(analysis.cards, {
        transport: transport,
        consent: consent,
        onConsent: onConsent
      }).then(function (r) {
        if (r && r.rewrites && r.rewrites.length) {
          applyRewrites(r.rewrites);
          paintBadge(r.source);
        }
      }).catch(function () { /* templates already on screen */ })
        .then(function () { btn.disabled = false; });
    });
  }

  function mount() {
    if (typeof document === 'undefined') return null;
    var analysis;
    try {
      analysis = buildAnalysis(SEED);
    } catch (e) { return null; }
    try { paintTrend(document.getElementById('trendCanvas'), analysis.weeks, analysis.change, analysis.forecast); } catch (e) { /* keep going */ }
    try { paintBuckets(document.getElementById('bucketCanvas'), analysis.buckets); } catch (e) { /* keep going */ }
    try { paintCards(analysis.cards); } catch (e) { /* keep going */ }
    try {
      paintMatrix(document.getElementById('matrixCanvas'), analysis.evaluation);
      paintReliability(document.getElementById('relCanvas'), analysis.evaluation);
      paintModelQuality(analysis);
    } catch (e) { /* keep going */ }
    paintBadge('Rules');
    try { wireRewrite(analysis); } catch (e) { /* rules stay */ }
    return analysis;
  }

  return {
    SEED: SEED,
    REWRITE_MAX: REWRITE_MAX,
    buildAnalysis: buildAnalysis,
    rewriteTop3: rewriteTop3,
    rewritePrompt: rewritePrompt,
    parseRewrites: parseRewrites,
    mount: mount
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Insights;
}
