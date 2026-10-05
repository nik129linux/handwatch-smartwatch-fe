/* ==========================================================================
   tests/ai.test.js — rules always work, Ollama is optional and grounded
   node tests/ai.test.js   (run from the prototype folder)
   fetch is injected (fetchImpl): no server, no network.
   ========================================================================== */

const AI = require('../js/ai.js');
const Ollama = require('../ai/ollama.js');

let pass = 0;
function ok(cond, label, detail) {
  if (!cond) {
    console.error('  ✗ ' + label + (detail ? '\n      ' + detail : ''));
    process.exitCode = 1;
    return;
  }
  pass++;
  console.log('  ✓ ' + label);
}
function head(s) { console.log('\n' + s); }

const BLAME = /\b(fail|violat|fault|error|neglig|blam|accus|lazy|careless)\w*\b/i;
const ES = /\b(el|la|los|las|del|una|para|con|por|turno|reloj|lavado|momentos?|cama|paciente|inicio|nadie|quien|tú|usted|gracias)\b/i;

function demoAgg() {
  return {
    unit: '4B',
    moments: [
      { name: 'Before the patient', done: 1284, total: 1362, pct: 94 },
      { name: 'Before a clean procedure', done: 402, total: 451, pct: 89 },
      { name: 'After fluid exposure', done: 191, total: 269, pct: 71 },
      { name: 'After the patient', done: 1188, total: 1381, pct: 86 },
      { name: 'After the surroundings', done: 508, total: 819, pct: 62 }
    ],
    hours: [0, 0, 0, 0, 0, 2, 9, 28, 34, 31, 27, 24, 19,
      14, 11, 12, 16, 21, 26, 33, 29, 12, 5, 1],
    shiftChangeHour: 19,
    corrections: 34
  };
}

/* mock transport: tags list + canned generate body */
function mockFetch(models, response, opts) {
  opts = opts || {};
  return async (url, init) => {
    /* A hanging server: never answers, but honors the abort signal,
       exactly like a real fetch would under the 8 s timeout. */
    if (opts.hang) {
      return new Promise((_, reject) => {
        const sig = init && init.signal;
        if (!sig) return;
        if (sig.aborted) reject(new Error('aborted'));
        else sig.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
    if (String(url).endsWith('/api/tags')) {
      if (opts.tagsThrow) throw new Error('no route');
      if (opts.tagsBroken) {
        return { ok: true, json: async () => { throw new Error('bad'); } };
      }
      return { ok: true, json: async () => ({ models }) };
    }
    if (String(url).endsWith('/api/generate')) {
      if (opts.genThrow) throw new Error('no route');
      return { ok: true, json: async () => ({ response }) };
    }
    throw new Error('unexpected url ' + url);
  };
}

function transportFor(fetchImpl, timeoutMs) {
  return {
    query: (prompt) => Ollama.query(prompt, { fetchImpl, timeoutMs })
  };
}

const EXPLAIN_OK = JSON.stringify({
  explanation: 'The rub was short and the sensor stayed unsure, so the watch asked.'
});

(async () => {

  /* 1 · rules explain: one neutral line per moment ---------------------- */
  head('1 · rules explain a correction in one neutral line');
  {
    const seen = {};
    for (const m of ['before-patient', 'after-patient', 'before-clean',
      'after-fluid', 'after-surroundings', 'whatever']) {
      const line = AI.rulesExplain({ moment: m });
      ok(typeof line === 'string' && line.length > 0 && line.length <= 140,
        'canned line for ' + m + ' fits 140 (' + line.length + ')', line);
      ok(!BLAME.test(line), 'never accusatory: ' + m, line);
      ok(!ES.test(line), 'English only: ' + m, line);
      seen[m] = line;
    }
    ok(new Set(Object.values(seen)).size >= 3,
      'lines vary by moment type, with a default fallback');
  }

  /* 2 · rules findings: deterministic, numbered, system fixes ------------ */
  head('2 · rules find where the process slips');
  {
    const payload = AI.buildUnitPayload(demoAgg());
    const a = AI.rulesFindings(payload);
    const b = AI.rulesFindings(payload);
    ok(a.length >= 1 && a.length <= 2, 'one or two system fixes', String(a.length));
    ok(JSON.stringify(a) === JSON.stringify(b), 'deterministic across runs');
    a.forEach((f, i) => {
      ok(f.text.length <= 300, 'fix ' + i + ' fits 300 (' + f.text.length + ')');
      ok(/\d/.test(f.text), 'fix ' + i + ' carries evidence numbers', f.text);
      ok(!BLAME.test(f.text), 'fix ' + i + ' blames the system, never a person', f.text);
    });
    ok(/surroundings/i.test(a[0].text), 'the worst moment is named first', a[0].text);
  }

  /* 3 · the payload gate rejects person-shaped keys ---------------------- */
  head('3 · only aggregates leave the process');
  {
    AI.buildUnitPayload(demoAgg());
    ok(true, 'clean aggregates build fine');
    for (const bad of [{ staffId: 1 }, { nurseName: 'x' }, { badge: '1' },
      { person: 'x' }, { a: { ownerId: 2 } }, { byNurse: [] }]) {
      let threw = false;
      try { AI.buildUnitPayload({ ...demoAgg(), ...bad }); } catch (e) { threw = true; }
      ok(threw, 'rejected: ' + Object.keys(bad).join(','));
    }
    ok(AI.buildExplainInput({ moment: 'x' }, null) === null,
      'no live run behind the entry means nothing to send');
    const facts = AI.buildExplainInput({ moment: 'before-patient' },
      { result: { confidence: 0.5 }, noise: 0.55 });
    ok(facts && facts.moment === 'before-patient' && facts.confidence === 'mid' &&
      facts.noise === 0.55, 'explain facts are moment + buckets only',
      JSON.stringify(facts));
    ok(!('name' in facts) && !('id' in facts),
      'explain facts carry no person-shaped key');
  }

  /* 4 · Ollama up: valid grounded JSON wins with a badge ----------------- */
  head('4 · Ollama up');
  {
    const payload = AI.buildUnitPayload(demoAgg());
    const text = JSON.stringify({ findings: [{ text: AI.rulesFindings(payload)[0].text }] });
    const t = transportFor(mockFetch([{ name: 'gemma4:31b-cloud' }], text));
    const r = await AI.requestFindings(demoAgg(),
      { transport: t, consent: 'yes' });
    ok(r.source === 'Ollama · gemma4:31b-cloud', 'source badge names the model', r.source);
    ok(r.findings.length === 1, 'the model findings are used');
  }

  /* 4b · gemma wraps JSON in code fences: still accepted ------------------ */
  head('4b · fenced JSON');
  {
    const payload = AI.buildUnitPayload(demoAgg());
    const body = JSON.stringify({ findings: [{ text: AI.rulesFindings(payload)[0].text }] });
    const t = transportFor(mockFetch([{ name: 'gemma4:31b-cloud' }], '```json\n' + body + '\n```'));
    const r = await AI.requestFindings(demoAgg(), { transport: t, consent: 'yes' });
    ok(r.source === 'Ollama · gemma4:31b-cloud', 'fenced JSON still reads as the model', r.source);
  }

  /* 5 · Ollama down: back to rules --------------------------------------- */
  head('5 · Ollama down');
  {
    const t = transportFor(mockFetch([], null, { tagsThrow: true }));
    const r = await AI.requestFindings(demoAgg(), { transport: t, consent: 'yes' });
    ok(r.source === 'Rules', 'tags failing reads as Rules', r.source);
    ok(r.findings.length >= 1, 'rules still propose a fix');
  }

  /* 6 · invalid JSON: back to rules -------------------------------------- */
  head('6 · invalid JSON');
  {
    const t = transportFor(mockFetch([{ name: 'gemma4:31b-cloud' }], 'not json {'));
    const r = await AI.requestFindings(demoAgg(), { transport: t, consent: 'yes' });
    ok(r.source === 'Rules', 'garbage JSON reads as Rules', r.source);
  }

  /* 7 · hallucinated number: discarded ----------------------------------- */
  head('7 · hallucinated number rejected');
  {
    const text = JSON.stringify({ findings: [{ text: 'After the surroundings reads 41% vs 97% unit mean. Move a dispenser.' }] });
    const t = transportFor(mockFetch([{ name: 'gemma4:31b-cloud' }], text));
    const r = await AI.requestFindings(demoAgg(), { transport: t, consent: 'yes' });
    ok(r.source === 'Rules', 'ungrounded numbers fall back to rules', r.source);
    ok(/62%/.test(r.findings[0].text), 'the rules fix cites the real number');
  }

  /* 8 · cloud-tagged-only list is valid ---------------------------------- */
  head('8 · cloud-tagged-only model list');
  {
    const models = [{ name: 'gemma4:31b-cloud', remote_host: 'https://x' }];
    ok(Ollama.pickModel(models) === 'gemma4:31b-cloud',
      'the only model is picked, cloud tag and all');
    ok(Ollama.pickModel([{ name: 'qwen:4b' }, { name: 'gemma4:31b-cloud', remote_host: 'h' }]) === 'gemma4:31b-cloud',
      'gemma wins over another local model');
    ok(Ollama.pickModel([{ name: 'qwen:4b' }]) === null, 'no gemma means rules, never qwen');
    const t = transportFor(mockFetch(models, EXPLAIN_OK));
    const r = await AI.requestExplain({ moment: 'before-patient' },
      { result: { confidence: 0.5 }, noise: 0.55 },
      { transport: t, consent: 'yes' });
    ok(r.source === 'Ollama · gemma4:31b-cloud',
      'explain works on the cloud-tagged model', r.source);
    ok(r.line.length <= 140, 'the line still fits 140');
  }

  /* 9 · consent + timeout ------------------------------------------------- */
  head('9 · consent and timeout');
  {
    let asked = null;
    const t = transportFor(mockFetch([{ name: 'gemma4:31b-cloud' }], EXPLAIN_OK));
    const declined = await AI.requestExplain({ moment: 'before-patient' },
      { result: { confidence: 0.5 }, noise: 0.55 },
      { transport: t, consent: null, onConsent: async (p) => { asked = p; return 'no'; } });
    ok(declined.source === 'Rules', 'declining consent stays on rules');
    ok(asked && asked.moment === 'before-patient',
      'consent shows the exact payload first', JSON.stringify(asked));

    const hanging = transportFor(mockFetch([{ name: 'q' }], EXPLAIN_OK, { hang: true }), 30);
    const slow = await AI.requestExplain({ moment: 'before-patient' },
      { result: { confidence: 0.5 }, noise: 0.55 },
      { transport: hanging, consent: 'yes' });
    ok(slow.source === 'Rules', 'an 8 s-class timeout falls back to rules');

    const none = await AI.requestFindings(demoAgg(), { transport: null });
    ok(none.source === 'Rules', 'browser build without a bridge is rules only');
  }

  console.log('\n  ' + pass + ' passed, 0 failed\n');
})().catch((e) => {
  console.error('\n  harness error:', e && e.message ? e.message : e);
  process.exit(1);
});
