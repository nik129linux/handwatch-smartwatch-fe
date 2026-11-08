/* ==========================================================================
   unit.js — the infection-control view. All of it is demo data.
   The page is anonymous by construction: there is no person field anywhere,
   so there is nothing to filter by.
   ========================================================================== */

var unit = (function () {
  'use strict';

  /* --- demo data --------------------------------------------------------- */

  /* One seeded six-week history feeds every figure on this page: the bars,
     the heatmap, the corrections and the charts. No card carries its own
     invented numbers, so the bars' mean and the last week of the trend are
     the same number. */
  var SEED = 7;

  /* The ripple starts at the shift-change hour: --i is the distance
     |hour - 19|, so the stagger delay is monotonic in distance outward. */
  var SHIFT_CHANGE = 19;

  var FALLBACK = {
    moments: [
      { name: 'Before the patient',        done: 1284, total: 1362, pct: 94 },
      { name: 'Before a clean procedure', done: 402, total: 451, pct: 89 },
      { name: 'After fluid exposure', done: 191, total: 269, pct: 71 },
      { name: 'After the patient',      done: 1188, total: 1381, pct: 86 },
      { name: 'After the surroundings',       done: 508, total: 819, pct: 62 }
    ],
    hours: [
      0, 0, 0, 0, 0, 2, 9,
      28, 34, 31, 27, 24, 19,
      14, 11, 12, 16, 21, 26,
      33, 29, 12, 5, 1
    ],
    corrections: 34
  };

  function demoData() {
    try {
      if (typeof Dataset === 'undefined' || !Dataset.generate) return null;
      var data = Dataset.generate(SEED);
      var lastWeek = data.events.filter(function (e) {
        return e.week === Dataset.WEEKS - 1;
      });
      var byMoment = Dataset.byMoment(lastWeek);
      var moments = byMoment.map(function (m) {
        return {
          name: m.label,
          done: m.done,
          total: m.total,
          pct: Math.round(m.done / Math.max(1, m.total) * 100)
        };
      });
      var hours = [];
      for (var h = 0; h < 24; h++) hours.push(0);
      lastWeek.forEach(function (e) { hours[e.hour] += 1; });
      return {
        moments: moments,
        hours: hours,
        corrections: Dataset.corrections(data.events)
      };
    } catch (e) { return null; }
  }

  var DEMO = demoData() || FALLBACK;
  var MOMENTS = DEMO.moments;
  var HOURS = DEMO.hours;
  var CORRECTIONS = DEMO.corrections;
  var MAX_HOUR = Math.max.apply(null, HOURS);

  /* --- render ------------------------------------------------------------ */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function heatStep(v) {
    if (v === 0) return 1;
    var r = v / MAX_HOUR;
    if (r < 0.25) return 2;
    if (r < 0.5) return 3;
    if (r < 0.8) return 4;
    return 5;
  }

  function num(v) {
    return (typeof I18N !== 'undefined' && I18N.num) ? I18N.num(v) : String(v);
  }
  function tr(s) {
    return (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(s) : s;
  }

  /* Answers cite totals: format them for the active locale before they reach
     the page. The user's own question is never rewritten. */
  function formatAnswer(s) {
    try {
      if (typeof Insights !== 'undefined' && Insights.formatNumbers) {
        return Insights.formatNumbers(s);
      }
    } catch (e) { /* keep the plain text */ }
    return s;
  }

  function momentBars() {
    var host = document.getElementById('momentBars');
    if (!host) return;
    host.setAttribute('data-io', '');
    host.classList.add('is-in');
    host.innerHTML = MOMENTS.map(function (m, i) {
      return '<div class="ubar" data-io style="--i:' + i + '">' +
        '<div class="ubar__top">' +
          '<span class="ubar__name">' + esc(m.name) + '</span>' +
          '<span class="ubar__val">' + m.pct + '%<small>' +
            num(m.done) + ' ' + tr('of') + ' ' + num(m.total) + '</small></span>' +
        '</div>' +
        '<div class="ubar__track">' +
          '<span class="ubar__fill" style="--i:' + i + ';--pct:' + m.pct + '%"></span>' +
        '</div>' +
      '</div>';
    }).join('');
    observeNew(host);
  }

  function heatmap() {
    var host = document.getElementById('heat');
    if (!host) return;
    var cells = HOURS.map(function (v, i) {
      return '<span class="uheat__cell" style="--i:' + Math.abs(i - SHIFT_CHANGE) +
        ';background:var(--heat-' + heatStep(v) + ')" ' +
        'title="' + pad2(i) + ':00 · ' + num(v) + ' ' + tr('washes') + '"></span>';
    }).join('');

    host.innerHTML =
      '<div class="uheat uheat__cells-host" data-io>' +
      '<div class="uheat__cells">' + cells + '</div>' +
      '<div class="uheat__axis"><span>00</span><span>06</span><span>12</span>' +
        '<span>18</span><span>23</span></div>' +
      '<div class="uheat__marker">19:00 · Shift change: the highest peak ' +
        'and the highest risk of a skipped wash.</div></div>';
    observeNew(host);
  }

  /* Rows rendered after stage.js already ran its first IO pass still need
     observing; under reduced motion everything shows immediately. */
  function observeNew(host) {
    var els = host.querySelectorAll('[data-io]');
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      for (var a = 0; a < els.length; a++) els[a].classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    for (var i = 0; i < els.length; i++) io.observe(els[i]);
  }

  function corrections() {
    var n = document.getElementById('corrN');
    var total = aggregateCorrections(CORRECTIONS, realCorrected());
    if (n) {
      var t0 = performance.now();
      (function step(t) {
        var p = Math.min(1, (t - t0) / 700);
        n.textContent = num(Math.round(total * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
      n.setAttribute('data-count', String(total));
    }
    var word = document.getElementById('corrWord');
    if (word) {
      word.textContent = 'corrections in 14 days.';
    }
  }

  /* corrected:true events from the real on-watch log. Same storage key as
     the watch page, so a correction made on the watch shows up here. */
  function realCorrected() {
    try {
      if (typeof Log !== 'undefined' && Log.correctedCount) {
        return Log.correctedCount();
      }
    } catch (e) { /* plain file without the log — demo data stands alone */ }
    return 0;
  }

  /* demo history plus the real log: never empty, corrections always from
     corrected:true events. Pure — the node test drives it directly. */
  function aggregateCorrections(demo, real) {
    return (demo || 0) + (real || 0);
  }

  /* --- system fixes: rules first, model only with consent ---------------- */

  /* Aggregates only — the same anonymous totals the bars already show. */
  function aggregates() {
    return {
      unit: '4B',
      moments: MOMENTS.map(function (m) {
        return { name: m.name, done: m.done, total: m.total, pct: m.pct };
      }),
      hours: HOURS.slice(),
      shiftChangeHour: SHIFT_CHANGE,
      corrections: aggregateCorrections(CORRECTIONS, realCorrected())
    };
  }

  function paintFixes(findings, source) {
    var host = document.getElementById('fixList');
    if (host) {
      host.innerHTML = findings.map(function (f, i) {
        return '<li class="fix__item" style="--i:' + i + '">' + esc(f.text) + '</li>';
      }).join('');
      observeNew(host);
    }
    var badge = document.getElementById('fixBadge');
    if (badge) badge.textContent = source;
  }

  function fixes() {
    var agg, payload, first;
    try {
      agg = aggregates();
      payload = AI.buildUnitPayload(agg);
      first = AI.rulesFindings(payload);
    } catch (e) { return; }
    if (!first.length) return;
    paintFixes(first, 'Rules');
    /* The model button exists only where the Electron bridge does:
       plain browsers stay rules-only, with no dead control. */
    var btn = document.getElementById('fixModel');
    if (!btn) return;
    var transport = null;
    try { transport = AI.browserTransport(); } catch (e) { transport = null; }
    if (!transport) return;
    btn.hidden = false;
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      AI.requestFindings(agg, {
        transport: transport,
        consent: (typeof AIPrefs !== 'undefined') ? AIPrefs.consent() : null,
        onConsent: (typeof AIPrefs !== 'undefined') ? AIPrefs.ask : AI.requestConsent
      }).then(function (r) {
        if (r && r.findings && r.findings.length) paintFixes(r.findings, r.source);
      }).catch(function () { /* rules already on screen — keep them */ })
        .then(function () { btn.disabled = false; });
    });
  }

  /* Data-science layer (dataset + stats + charts) paints its own
     sections; the demo bars above never wait for it. */
  function datascience() {
    try {
      if (typeof Insights !== 'undefined' && Insights.mount) return Insights.mount();
    } catch (e) { /* demo bars already on screen — keep them */ }
    return null;
  }

  /* --- ask the unit: rules answer offline; with the Electron bridge and
     consent, the model answers from the same facts, grounded or dropped -- */
  function ask(analysis) {
    if (typeof Ask === 'undefined') return;
    var form = document.getElementById('askForm');
    var input = document.getElementById('askInput');
    var box = document.getElementById('askAnswer');
    if (!form || !input || !box) return;
    var facts;
    try {
      var extra = {};
      if (analysis) {
        extra.weeks = analysis.weeks;
        extra.trend = analysis.trend && analysis.trend.verdict;
        extra.forecast = analysis.forecast && analysis.forecast.point;
        if (analysis.evaluation) {
          extra.model = { accuracy: analysis.evaluation.accuracy,
            baseline: analysis.evaluation.baseline, streams: analysis.evaluation.streams };
        }
      }
      facts = Ask.buildFacts(aggregates(), extra);
    } catch (e) { return; }
    var transport = null;
    try { transport = AI.browserTransport(); } catch (e) { transport = null; }
    var lang = (typeof I18N !== 'undefined') ? I18N.lang : 'en';
    var send = form.querySelector('.ask__send');
    var busy = false;

    function show(q, text, source, loading, failed) {
      box.hidden = false;
      box.classList.toggle('is-loading', !!loading);
      document.getElementById('askQ').textContent = q;
      document.getElementById('askA').textContent = formatAnswer(text);
      document.getElementById('askBadge').textContent = source;
      var fb = document.getElementById('askFallback');
      if (fb) {
        fb.hidden = !failed;
        if (failed) fb.textContent = tr('I could not use the model; the watch rules answered.');
      }
      if (!loading) lastAsk = { q: q, facts: facts };
    }

    function hideEmpty() {
      var e = document.getElementById('askEmpty');
      if (e) e.hidden = true;
    }

    function run(q) {
      q = String(q || '').trim();
      if (!q || busy) return;
      busy = true;
      hideEmpty();
      if (send) send.disabled = true;
      show(q, tr('Reading the totals…'), '…', true, false);
      Ask.request(q, facts, {
        transport: transport,
        consent: (typeof AIPrefs !== 'undefined') ? AIPrefs.consent() : null,
        onConsent: (typeof AIPrefs !== 'undefined') ? AIPrefs.ask : AI.requestConsent
      }, lang).then(function (r) {
        show(q, r.answer, r.source, false, !!r.modelFailed);
      }).catch(function () {
        show(q, Ask.rulesAnswer(facts, Ask.intent(q), lang, q), 'Rules', false, true);
      }).then(function () {
        busy = false;
        if (send) send.disabled = false;
      });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!String(input.value || '').trim()) {
        var e = document.getElementById('askEmpty');
        if (e) {
          e.textContent = tr('Write a question about the moments or the hours.');
          e.hidden = false;
        }
        input.focus();
        return;
      }
      run(input.value);
    });
    var chips = document.querySelectorAll('#askChips .ask__chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function (ev) {
        var q = ev.currentTarget.textContent;
        input.value = q;
        run(q);
      });
    }
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* Re-render everything that carries a number or a translated word; the
     underlying demo data and the real log are untouched. */
  var lastAsk = null;

  function refresh() {
    momentBars();
    heatmap();
    corrections();
    try {
      if (typeof Insights !== 'undefined' && Insights.mount) Insights.mount();
    } catch (e) { /* the bars above already repainted */ }
    try { fixes(); } catch (e) { /* rules stay on screen */ }
    /* The answered question keeps its place: re-answer it in the new
       language from the same facts, never from the network. */
    var box = document.getElementById('askAnswer');
    if (box && !box.hidden && lastAsk && typeof Ask !== 'undefined') {
      var lang = (typeof I18N !== 'undefined') ? I18N.lang : 'en';
      var a = document.getElementById('askA');
      if (a) a.textContent = formatAnswer(Ask.rulesAnswer(lastAsk.facts, Ask.intent(lastAsk.q), lang, lastAsk.q));
      var badge = document.getElementById('askBadge');
      if (badge) badge.textContent = 'Rules';
    }
  }

  function mount() {
    momentBars();
    heatmap();
    corrections();
    fixes();
    ask(datascience());
    /* Esc goes back to the watch, like Esc on the watch itself. Not while
       the consent sheet is open or the question field has focus. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return;
      if (document.querySelector('.ai-consent')) return;
      var a = document.activeElement;
      if (a && a.id === 'askInput') { a.blur(); return; }
      var back = document.querySelector('.unit__back');
      if (back) window.location.href = back.getAttribute('href');
    });
    /* Language changes repaint every figure in place: no reload, no loss. */
    document.addEventListener('i18n:change', function () {
      refresh();
      if (typeof I18N !== 'undefined') I18N.apply(document.body);
    });
    /* the Electron file copy can land after first paint — re-count then */
    if (typeof document !== 'undefined') {
      document.addEventListener('watch:log-sync', corrections);
    }
  }

  return {
    mount: mount,
    refresh: refresh,
    MOMENTS: MOMENTS,
    HOURS: HOURS,
    CORRECTIONS: CORRECTIONS,
    aggregateCorrections: aggregateCorrections
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = unit;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', unit.mount);
  } else {
    unit.mount();
  }
}
