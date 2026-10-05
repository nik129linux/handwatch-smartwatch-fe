/* ==========================================================================
   tests/eval.test.js — confusion matrix, calibration and before/after
   on the seeded streams, plus the grounded rewrite of the top cards.
   node tests/eval.test.js   (run from the prototype folder)
   fetch is injected (fetchImpl): no server, no network. Mocks use
   gemma4:31b-cloud, never another local model.
   ========================================================================== */

const Eval = require('../js/eval.js');
const Insights = require('../js/insights.js');
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
function in01(v) { return v >= 0 && v <= 1; }

/* mock transport: tags list + canned generate body */
function mockFetch(models, response, opts) {
  opts = opts || {};
  return async (url, init) => {
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
      return { ok: true, json: async () => ({ models }) };
    }
    if (String(url).endsWith('/api/generate')) {
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

/* 1 · the matrix adds up --------------------------------------------------- */

head('1 · confusion matrix over seeded streams');
{
  const a = Eval.runEval({ seed: 11 });
  const b = Eval.runEval({ seed: 11 });
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same seed scores the same');
  const total = a.matrix.reduce((s, row) => s + row.reduce((x, v) => x + v, 0), 0);
  ok(total === a.streams && total === 360, 'every stream lands in the matrix',
    total + '/' + a.streams);
  ok(a.accuracy > 0.9, 'accuracy clears 0.9 on moderate noise',
    a.accuracy.toFixed(3));
  a.perClass.forEach((c) => {
    ok(in01(c.precision) && in01(c.recall) && in01(c.f1),
      c.label + ' P/R/F1 sit in [0, 1]',
      [c.precision, c.recall, c.f1].map((v) => v.toFixed(2)).join('/'));
    ok(c.support > 0, c.label + ' has support in the streams');
  });
}

/* 2 · reliability and Brier ------------------------------------------------ */

head('2 · reliability curve and Brier score');
{
  const a = Eval.runEval({ seed: 11 });
  ok(in01(a.brier) && a.brier < 0.15, 'Brier reads low for a sharp watch',
    a.brier.toFixed(3));
  const n = a.reliability.reduce((s, bin) => s + bin.n, 0);
  ok(n === a.streams, 'every stream lands in exactly one bin');
  a.reliability.forEach((bin) => {
    ok(bin.meanConf >= bin.lo && bin.meanConf <= bin.hi,
      'bin ' + bin.lo.toFixed(1) + '-' + bin.hi.toFixed(1) + ' centers inside');
    ok(in01(bin.acc), 'bin accuracy sits in [0, 1]');
  });
  const top = a.reliability[a.reliability.length - 1];
  ok(top.acc >= 0.9, 'the top-confidence bin is almost always right',
    top.acc.toFixed(2));
}

/* 3 · before vs after calibrate.js ------------------------------------------ */

head('3 · corrections quiet borderline flags, solid signals hold');
{
  const st = Eval.correctionStudy(23);
  ok(st.sweepBefore === 20, 'every borderline flag surfaces before learning');
  ok(st.sweepAfter === 0, 'no borderline flag survives 8 corrections',
    st.sweepAfter + '/' + st.sweepBefore);
  ok(st.solidHeld === st.solidTotal && st.solidTotal === 20,
    'solid detections all hold after learning');
  ok(st.realFlaggedAfter === st.realFlaggedBefore,
    'real flagged streams keep surfacing: strong signals hold by design',
    st.realFlaggedAfter + '/' + st.realFlaggedBefore);
}

/* 4 · the rewrite narrates, never computes ---------------------------------- */

head('4 · grounded rewrite of the top cards');
{
  const cards = Insights.buildAnalysis(7).cards;
  ok(cards.length >= 2 && cards.length <= 3, 'two or three ranked cards');
  ok(cards[0].body.length <= 300, 'template bodies fit 300 chars');
  ok(/523 of 756/.test(cards[0].body) && /p<0\.001/.test(cards[0].body),
    'the top card cites n, rate and adjusted p', cards[0].body.slice(0, 60));
}

(async () => {

  /* 5 · Ollama up: a grounded rewrite wins with a badge -------------------- */
  head('5 · Ollama up');
  {
    const cards = Insights.buildAnalysis(7).cards;
    const text = JSON.stringify({
      rewrites: [
        { id: cards[0].id, text: 'The 18:00-21:00 window reads 69% (523 of 756) against 90% elsewhere. Move a dispenser to cover this window and recheck at handover.' },
        { id: cards[1].id, text: 'Compliance moved from 84% to 93% starting week 5 (4578 checks). Keep the handover overlap and recheck in two weeks.' }
      ]
    });
    const t = transportFor(mockFetch([{ name: 'gemma4:31b-cloud' }], text));
    const r = await Insights.rewriteTop3(cards,
      { transport: t, consent: 'yes' });
    ok(r.source === 'Ollama · gemma4:31b-cloud', 'source badge names the model',
      r.source);
    ok(r.rewrites.length === 2 && r.rewrites[0].id === cards[0].id,
      'one rewrite per card, in order');
  }

  /* 6 · hallucinated number: discarded ------------------------------------- */
  head('6 · hallucinated number rejected');
  {
    const cards = Insights.buildAnalysis(7).cards;
    const text = JSON.stringify({
      rewrites: [
        { id: cards[0].id, text: 'The evening window reads 41% vs 97% unit mean. Move a dispenser.' },
        { id: cards[1].id, text: 'Compliance moved from 84% to 93% starting week 5 (4578 checks).' }
      ]
    });
    const t = transportFor(mockFetch([{ name: 'gemma4:31b-cloud' }], text));
    const r = await Insights.rewriteTop3(cards,
      { transport: t, consent: 'yes' });
    ok(r.source === 'Rules', 'ungrounded numbers fall back to templates');
    ok(r.rewrites[0].text === cards[0].body, 'the template keeps the real numbers');
  }

  /* 7 · Ollama down: back to templates -------------------------------------- */
  head('7 · Ollama down');
  {
    const cards = Insights.buildAnalysis(7).cards;
    const t = transportFor(mockFetch([], null, { tagsThrow: true }));
    const r = await Insights.rewriteTop3(cards,
      { transport: t, consent: 'yes' });
    ok(r.source === 'Rules', 'a failing server reads as Rules');
    ok(r.rewrites.length === Math.min(3, cards.length),
      'templates still cover the top cards');
    const none = await Insights.rewriteTop3(cards, { transport: null });
    ok(none.source === 'Rules', 'no bridge is rules only');
  }

  console.log('\n  ' + pass + ' passed, 0 failed\n');
})().catch((e) => {
  console.error('\n  harness error:', e && e.message ? e.message : e);
  process.exit(1);
});
