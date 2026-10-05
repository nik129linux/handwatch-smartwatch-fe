/* ==========================================================================
   ai.js — the improvement layer: rules first, model second, rules again.
   Three features share one provider chain:

     deterministic rules (always work, on-device) ->
       Ollama via the Electron main process (aggregates only) ->
         back to rules on ANY failure (down, timeout, bad JSON, failed
         validation, ungrounded numbers).

   1. rulesExplain: one neutral line per moment type (max 140 chars).
   2. rulesFindings: the unit pattern finder over anonymous aggregates.
   3. buildUnitPayload: aggregates-only payload; rejects any key that
      looks like a person, so a name can never leave the process.

   Model output is schema-validated AND grounded: it may only cite
   numbers present in the input payload, otherwise it is discarded.
   Every answer carries a source badge: "Rules" or "Ollama · <model>".
   Works as a plain <script> (window.AI) and under node (require).
   ========================================================================== */

var AI = (function () {
  'use strict';

  var EXPLAIN_MAX = 140;
  var FINDING_MAX = 300;
  var MIN_MOMENT_N = 50;
  var MIN_BUCKET_N = 10;

  /* Words a neutral line may never carry. The watch was wrong; the
     person was not. */
  var BLAME_RE = /\b(fail|violat|fault|error|neglig|blam|accus|lazy|careless|slack)\w*\b/i;

  /* --- anonymity gate -------------------------------------------------- */

  function keyTokens(key) {
    var out = [];
    String(key).split(/[^A-Za-z]+/).forEach(function (part) {
      part.split(/(?=[A-Z])/).forEach(function (w) {
        if (w) out.push(w);
      });
    });
    return out;
  }

  var PERSON_TOKENS = {
    name: 1, names: 1, id: 1, ids: 1, badge: 1, staff: 1,
    nurse: 1, nurses: 1, person: 1, people: 1, user: 1, users: 1,
    employee: 1, owner: 1, who: 1
  };

  function assertAnonymous(value, seen) {
    seen = seen || [];
    if (value && typeof value === 'object') {
      if (seen.indexOf(value) !== -1) return;
      seen.push(value);
      var keys = Array.isArray(value)
        ? value.map(function (_, i) { return String(i); })
        : Object.keys(value);
      for (var i = 0; i < keys.length; i++) {
        var toks = keyTokens(keys[i]);
        for (var t = 0; t < toks.length; t++) {
          if (PERSON_TOKENS[toks[t].toLowerCase()]) {
            throw new Error('ai: payload key looks like a person: ' + keys[i]);
          }
        }
        if (!Array.isArray(value)) assertAnonymous(value[keys[i]], seen);
      }
    }
  }

  /* Aggregates only: compliance by moment and hour bucket, the shift
     change window, the correction count. Anything person-shaped throws. */
  function buildUnitPayload(input) {
    assertAnonymous(input);
    var payload = {
      unit: String((input && input.unit) || '4B'),
      windowDays: 14,
      moments: (input.moments || []).map(function (m) {
        return {
          moment: String(m.name || m.moment),
          done: Number(m.done) || 0,
          total: Number(m.total) || 0,
          pct: Number(m.pct) || 0
        };
      }),
      hours: (input.hours || []).slice(0, 24).map(function (v) {
        return Number(v) || 0;
      }),
      shiftChangeHour: Number(input.shiftChangeHour) || 19,
      corrections: Number(input.corrections) || 0
    };
    assertAnonymous(payload);
    return payload;
  }

  /* The explain call carries three facts and nothing else. */
  function buildExplainInput(entry, lastRun) {
    if (!lastRun || !lastRun.result) return null;
    var conf = Number(lastRun.result.confidence);
    return {
      moment: String((entry && entry.moment) || 'before-patient'),
      confidence: conf < 0.4 ? 'low' : conf < 0.75 ? 'mid' : 'high',
      noise: Math.round(Number(lastRun.noise) * 100) / 100
    };
  }

  /* --- rules: explain -------------------------------------------------- */

  var CANNED = {
    'before-patient': 'The rub was short or broken by noise, so the watch asked instead of deciding.',
    'after-patient': 'Hands were still damp and moving on exit, so the watch asked instead of deciding.',
    'before-clean': 'The rub sat near the unsure line, so the watch asked instead of deciding.',
    'after-fluid': 'Cleanup motion looks like a rub to the sensor, so the watch asked instead of deciding.',
    'after-surroundings': 'A touch of the bedside reads half like a rub, so the watch asked instead of deciding.'
  };
  var CANNED_DEFAULT = 'The signal sat near the unsure line, so the watch asked instead of deciding.';

  function rulesExplain(input) {
    var m = input && input.moment;
    var line = CANNED[m] || CANNED_DEFAULT;
    return line.slice(0, EXPLAIN_MAX);
  }

  /* --- rules: unit pattern finder -------------------------------------- */

  var MOMENT_FIX = [
    [/surrounding/i, 'Move a dispenser to the room exit and recheck at handover.'],
    [/fluid/i, 'Set gloves and gel on one tray so cleanup ends with a rub.'],
    [/clean/i, 'Keep a gel bottle on the procedure cart and recheck next week.'],
    [/before/i, 'Move the reminder 5 min earlier for entries and recheck next week.'],
    [/after/i, 'Place a dispenser at the room exit and recheck at handover.']
  ];
  var HOUR_FIX = 'Shift the reminder 10 min earlier through this window.';
  var SHIFT_FIX = 'Add a 2 min handover overlap at shift change and recheck next week.';

  function momentFix(name) {
    for (var i = 0; i < MOMENT_FIX.length; i++) {
      if (MOMENT_FIX[i][0].test(name)) return MOMENT_FIX[i][1];
    }
    return 'Nudge the reminder earlier for this moment and recheck next week.';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* Lowest compliance moment vs the unit mean, min sample size. */
  function momentFinding(moments) {
    var pool = moments.filter(function (m) { return m.total >= MIN_MOMENT_N; });
    if (pool.length < 2) return null;
    var done = 0;
    var total = 0;
    pool.forEach(function (m) { done += m.done; total += m.total; });
    var mean = Math.round((done / Math.max(1, total)) * 100);
    var low = pool.slice().sort(function (a, b) { return a.pct - b.pct; })[0];
    if (mean - low.pct < 3) return null;
    return low.moment + ' reads ' + low.pct + '% vs ' + mean + '% unit mean' +
      ' (' + low.done + ' of ' + low.total + '). ' + momentFix(low.moment);
  }

  /* Quietest 3-hour bucket vs the hourly mean, min sample size. */
  function hourFinding(hours) {
    if (!hours || hours.length < 24) return null;
    var buckets = [];
    for (var b = 0; b < 8; b++) {
      var t = 0;
      for (var h = 0; h < 3; h++) t += hours[b * 3 + h] || 0;
      buckets.push({ from: b * 3, total: t });
    }
    var grand = 0;
    hours.forEach(function (v) { grand += v; });
    var mean = grand / 24;
    var ok = buckets.filter(function (x) { return x.total >= MIN_BUCKET_N; });
    if (!ok.length || mean <= 0) return null;
    var low = ok.slice().sort(function (a, b) { return a.total - b.total; })[0];
    var perHour = Math.round(low.total / 3);
    if (mean - perHour < 2) return null;
    return pad2(low.from) + ':00-' + pad2((low.from + 3) % 24) + ':00 averages ' +
      perHour + ' washes per hour vs ' + Math.round(mean) + ' unit mean' +
      ' (' + low.total + ' total). ' + HOUR_FIX;
  }

  /* The shift-change window vs the rest of the day. */
  function shiftFinding(hours, at) {
    if (!hours || hours.length < 24) return null;
    var win = 0;
    for (var h = at - 1; h <= at + 1; h++) win += hours[(h + 24) % 24] || 0;
    var rest = 0;
    hours.forEach(function (v) { rest += v; });
    rest -= win;
    var winMean = win / 3;
    var restMean = rest / 21;
    if (restMean - winMean < 2) return null;
    return 'Around ' + pad2(at) + ':00 the unit averages ' + Math.round(winMean) +
      ' washes per hour vs ' + Math.round(restMean) + ' otherwise' +
      ' (' + win + ' in 3 h). ' + SHIFT_FIX;
  }

  function rulesFindings(payload) {
    var out = [];
    var m = momentFinding(payload.moments || []);
    if (m) out.push(m.slice(0, FINDING_MAX));
    if (out.length < 2) {
      var h = hourFinding(payload.hours || []);
      if (h) out.push(h.slice(0, FINDING_MAX));
    }
    if (out.length < 2) {
      var s = shiftFinding(payload.hours || [], payload.shiftChangeHour || 19);
      if (s && out.indexOf(s) === -1) out.push(s.slice(0, FINDING_MAX));
    }
    return out.slice(0, 2).map(function (text) { return { text: text }; });
  }

  /* --- model prompts --------------------------------------------------- */

  function findingsPrompt(payload) {
    /* The evidence line carries the rounded numbers the detector found,
       so a model that cites them passes grounding honestly. */
    var evidence = [];
    var m = momentFinding(payload.moments || []);
    if (m) evidence.push('lowest moment: ' + m);
    var h = hourFinding(payload.hours || []);
    if (h) evidence.push('quietest window: ' + h);
    return 'Unit hand-hygiene aggregates (anonymous, 14 days): ' +
      JSON.stringify(payload) +
      (evidence.length ? ' Evidence: ' + evidence.join(' ') : '') +
      ' Propose 1-2 SYSTEM fixes ' +
      '(dispenser placement, reminder timing, handover overlap), never ' +
      'about people. Reply JSON only: {"findings": [{"text": "..."}]}. ' +
      'Each text: max 300 chars, cites only numbers from the aggregates ' +
      'and evidence above, names the evidence numbers.';
  }

  function explainPrompt(input) {
    return 'A hand-hygiene watch flagged a moment and the wearer corrected ' +
      'it. Facts: ' + JSON.stringify(input) + ' Reply JSON only: ' +
      '{"explanation": "..."}. One neutral line, max 140 chars, about the ' +
      'watch or the signal, never about the person. Cite no numbers ' +
      'outside the facts.';
  }

  /* --- validation + grounding ------------------------------------------ */

  /* Grounded = every number in the answer also appears in the prompt
     (which carries the full payload plus the rounded evidence). */
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

  function parseFindings(text, ctx) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    if (!data || !Array.isArray(data.findings)) return null;
    if (!data.findings.length || data.findings.length > 2) return null;
    var allowed = promptNumbers(ctx && ctx.prompt);
    var out = [];
    for (var i = 0; i < data.findings.length; i++) {
      var f = data.findings[i];
      if (!f || typeof f.text !== 'string' || !f.text.trim()) return null;
      if (BLAME_RE.test(f.text)) return null;
      if (!grounded(f.text, allowed)) return null;
      out.push({ text: f.text.trim().slice(0, FINDING_MAX) });
    }
    return out;
  }

  function parseExplanation(text, ctx) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    if (!data || typeof data.explanation !== 'string') return null;
    var line = data.explanation.trim();
    if (!line) return null;
    if (BLAME_RE.test(line)) return null;
    if (!grounded(line, promptNumbers(ctx && ctx.prompt))) return null;
    return line.slice(0, EXPLAIN_MAX);
  }

  /* --- the provider chain ---------------------------------------------- */

  function rulesSource() { return 'Rules'; }

  function ollamaSource(model) { return 'Ollama · ' + model; }

  /* deps: { transport, consent: 'yes'|'no'|null,
             onConsent: async (payload) -> 'yes'|'no' } */
  async function chain(prompt, ctx, parse, rules, deps) {
    deps = deps || {};
    var transport = deps.transport || null;
    if (!transport) return { value: rules(), source: rulesSource() };
    var consent = deps.consent || null;
    if (consent !== 'yes') {
      if (consent === 'no' || typeof deps.onConsent !== 'function') {
        return { value: rules(), source: rulesSource() };
      }
      var answer = 'no';
      /* The consent screen shows this exact payload: nothing else leaves. */
      try { answer = await deps.onConsent(ctx.payload); } catch (e) { answer = 'no'; }
      if (answer !== 'yes') return { value: rules(), source: rulesSource() };
    }
    try {
      var res = await transport.query(prompt);
      if (!res || !res.ok || typeof res.text !== 'string' || !res.model) {
        return { value: rules(), source: rulesSource() };
      }
      var parsed = parse(res.text, ctx);
      if (!parsed) return { value: rules(), source: rulesSource() };
      return { value: parsed, source: ollamaSource(res.model) };
    } catch (e) {
      return { value: rules(), source: rulesSource() };
    }
  }

  async function requestFindings(agg, deps) {
    var payload = buildUnitPayload(agg);
    var prompt = findingsPrompt(payload);
    var ctx = { payload: payload, prompt: prompt };
    var r = await chain(prompt, ctx, parseFindings,
      function () { return rulesFindings(payload); }, deps);
    return { findings: r.value, source: r.source, payload: payload };
  }

  async function requestExplain(input, lastRun, deps) {
    /* No live run behind the entry: nothing real to send, rules answer. */
    var facts = buildExplainInput(input, lastRun);
    if (!facts) {
      var fallback = { moment: String((input && input.moment) || 'before-patient') };
      return { line: rulesExplain(fallback), source: rulesSource(), payload: fallback };
    }
    var r = await chain(explainPrompt(facts),
      { payload: facts, prompt: explainPrompt(facts) }, parseExplanation,
      function () { return rulesExplain(facts); }, deps);
    return { line: r.value, source: r.source, payload: facts };
  }

  /* --- consent: the exact payload before the first model call ----------- */

  /* One remembered answer per page load. The sheet shows the exact JSON
     that would leave the process — aggregates only, by construction —
     with Allow / Not now buttons (no inputs, so unit-page anonymity
     assertions about filter controls keep holding). Node has no
     document: decline, rules answer. */
  var consentMemory = null;

  function requestConsent(payload) {
    if (consentMemory) return Promise.resolve(consentMemory);
    if (typeof document === 'undefined') return Promise.resolve('no');
    return new Promise(function (resolve) {
      var host = document.createElement('div');
      host.className = 'ai-consent';
      host.innerHTML =
        '<div class="ai-consent__card" role="dialog" aria-label="Share anonymous totals">' +
        '<p class="ai-consent__title">Share anonymous totals?</p>' +
        '<p class="ai-consent__body">Only this leaves the page ' +
        '(no names, no people, no free text). The model may only cite ' +
        'these numbers back.</p>' +
        '<pre class="ai-consent__payload"></pre>' +
        '<div class="ai-consent__row">' +
        '<button class="ai-ghost" type="button" data-ai-no>Not now</button>' +
        '<button class="ai-ok" type="button" data-ai-yes>Allow once</button>' +
        '</div></div>';
      host.querySelector('.ai-consent__payload').textContent =
        JSON.stringify(payload, null, 2);
      function done(answer) {
        consentMemory = answer;
        try { host.parentNode.removeChild(host); } catch (e) {}
        resolve(answer);
      }
      host.querySelector('[data-ai-no]').addEventListener('click', function () {
        done('no');
      });
      host.querySelector('[data-ai-yes]').addEventListener('click', function () {
        done('yes');
      });
      document.body.appendChild(host);
      var ok = host.querySelector('[data-ai-yes]');
      if (ok && ok.focus) { try { ok.focus(); } catch (e) {} }
    });
  }

  /* The renderer bridge: prompts go to Electron main, which asks Ollama
     on localhost. Absent in a plain browser — then pages use rules only. */
  function browserTransport() {
    try {
      if (typeof window !== 'undefined' && window.__aiAPI && window.__aiAPI.query) {
        return { query: function (prompt) { return window.__aiAPI.query(prompt); } };
      }
    } catch (e) { /* plain browser — rules only */ }
    return null;
  }

  return {
    EXPLAIN_MAX: EXPLAIN_MAX,
    FINDING_MAX: FINDING_MAX,
    buildUnitPayload: buildUnitPayload,
    buildExplainInput: buildExplainInput,
    rulesExplain: rulesExplain,
    rulesFindings: rulesFindings,
    findingsPrompt: findingsPrompt,
    explainPrompt: explainPrompt,
    parseFindings: parseFindings,
    parseExplanation: parseExplanation,
    requestFindings: requestFindings,
    requestExplain: requestExplain,
    requestConsent: requestConsent,
    browserTransport: browserTransport
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AI;
}
