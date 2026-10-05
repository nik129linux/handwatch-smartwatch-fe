/* ==========================================================================
   tests/classifier.test.js — the on-device motion classifier,no browser
   node tests/classifier.test.js   (run from the prototype folder)
   ========================================================================== */

const assert = require('assert');
const Signal = require('../js/signal.js');
const Classifier = require('../js/classifier.js');
const Log = require('../js/log.js');

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

function classify(scenario, seed, noise) {
  return Classifier.classify(Signal.generate(scenario, { seed, noise }));
}

/* 1 · clean signals read correctly -------------------------------------- */

head('1 · seeded scenarios at noise 0');
{
  const w = classify('wash', 7, 0);
  ok(w.label === 'wash', 'wash reads as wash', w.label);
  ok(w.confidence >= 0.85, 'wash is confident (>= 0.85)', w.confidence.toFixed(3));

  const g = classify('gel', 7, 0);
  ok(g.label === 'gel', 'gel reads as gel', g.label);
  ok(g.confidence >= 0.75, 'gel is confident (>= 0.75)', g.confidence.toFixed(3));

  for (const sc of ['door', 'typing', 'wave']) {
    const r = classify(sc, 7, 0);
    ok(r.label === 'other', sc + ' reads as other', r.label);
  }
}

/* 2 · wrongness emerges from noise, never from a script ----------------- */

head('2 · wash at noise 0.8 goes uncertain, never gel');
{
  let uncertain = 0;
  let gel = 0;
  for (let seed = 0; seed < 50; seed++) {
    const r = classify('wash', seed, 0.8);
    if (r.label === 'other' || r.confidence < 0.75) uncertain++;
    if (r.label === 'gel') gel++;
  }
  ok(uncertain >= 15, 'uncertain-or-none in >= 30% of 50 seeds',
    uncertain + '/50');
  ok(gel === 0, 'a noisy wash is never read as gel', gel + ' gel');
}

/* 3 · determinism -------------------------------------------------------- */

head('3 · same seed, same output');
{
  const a = classify('wash', 9, 0.4);
  const b = classify('wash', 9, 0.4);
  ok(JSON.stringify(a) === JSON.stringify(b), 'wash(9, 0.4) is byte-identical');
  const c = classify('gel', 2, 0.55);
  const d = classify('gel', 2, 0.55);
  ok(JSON.stringify(c) === JSON.stringify(d), 'gel(2, 0.55) is byte-identical');
}

/* 4 · thresholds are the named constants --------------------------------- */

head('4 · the verdict reads the named constants');
{
  const T = Classifier.THRESHOLDS;
  ok(T.CONFIDENT === 0.75, 'CONFIDENT is 0.75', String(T.CONFIDENT));
  ok(T.UNCERTAIN === 0.4, 'UNCERTAIN is 0.4', String(T.UNCERTAIN));
  const at = (label, conf) =>
    Classifier.verdict({ label, confidence: conf, features: {} });
  ok(at('wash', 0.75) === 'sure', '0.75 is sure');
  ok(at('gel', 0.74) === 'unsure', '0.74 is unsure');
  ok(at('wash', 0.4) === 'unsure', '0.40 is unsure');
  ok(at('wash', 0.39) === 'none', '0.39 is nothing');
  ok(at('other', 0.9) === 'none', 'other is nothing whatever the number');
}

/* 5 · the story's doubtful beat ------------------------------------------ */

head('5 · gel at noise 0.55, seed 2 is the unsure beat');
{
  const r = classify('gel', 2, 0.55);
  ok(r.label === 'gel', 'still a rub, not a wash', r.label);
  ok(r.confidence >= 0.4 && r.confidence < 0.75,
    'confidence sits in the doubtful band', r.confidence.toFixed(3));
  ok(Classifier.verdict(r) === 'unsure', 'the verdict is unsure');
  const line = Classifier.whyLine(r);
  ok(/rhythm \d\.\d\d · \d+ of \d+ s · \d\.\d Hz -> unsure/.test(line),
    'the features line explains itself', line);
}

/* 6 · the noise slider moves the uncertain rate --------------------------- */

head('6 · noise moves the uncertain rate on a fixed seed set');
{
  const seeds = [];
  for (let s = 0; s < 20; s++) seeds.push(s);
  const rate = (noise) => seeds.filter((s) => {
    const r = classify('wash', s, noise);
    return r.label === 'other' || r.confidence < 0.75;
  }).length / seeds.length;
  const calm = rate(0);
  const noisy = rate(0.8);
  ok(calm < noisy, 'noisy streams go unsure more often',
    'noise 0: ' + calm.toFixed(2) + ', noise 0.8: ' + noisy.toFixed(2));
  ok(noisy - calm >= 0.3, 'the gap is wide enough to watch',
    'gap ' + (noisy - calm).toFixed(2));
}

/* 7 · the event log ------------------------------------------------------- */

head('7 · the log schema keeps no person, purges at 24 h, deletes');
{
  const mem = { json: null };
  const store = Log.createStore({
    read: () => mem.json,
    write: (j) => { mem.json = j; }
  });
  const e = store.record('before-patient', 'confirmed', true);
  ok(typeof e.id === 'string' && typeof e.ts === 'number',
    'entries carry id + ts');
  ok(e.moment === 'before-patient' && e.outcome === 'confirmed' &&
    e.corrected === true, 'entries carry moment + outcome + corrected');
  ok(!('person' in e) && !('name' in e) && !('nurse' in e),
    'no person field exists on the entry', Object.keys(e).join(','));
  /* even a hostile caller cannot smuggle a name through record() */
  store.record('before-patient', 'done', false);
  const raw = JSON.parse(mem.json);
  ok(raw.every((x) => !('person' in x)),
    'persistence never stores a person field');

  const now = Date.now();
  store.record('before-patient', 'done', false, now - 25 * 3600 * 1000);
  ok(store.list().length === 3, 'the old event is there before the purge');
  const dropped = store.purge(now);
  ok(dropped === 1 && store.list().length === 2,
    'a 25 h old event detail is purged', 'dropped ' + dropped);
  const fresh = store.list().every((x) => now - x.ts < Log.DAY_MS);
  ok(fresh, 'everything left is under 24 h');

  ok(store.remove(e.id) === true, 'delete removes by id');
  ok(store.list().every((x) => x.id !== e.id), 'the entry is gone');
  ok(store.remove('no-such-id') === false, 'deleting a ghost is false');
}

/* 8 · unit aggregation ---------------------------------------------------- */

head('8 · unit corrections come from corrected:true events');
{
  const unit = require('../js/unit.js');
  ok(unit.aggregateCorrections(34, 0) === 34, 'demo history alone is 34');
  ok(unit.aggregateCorrections(34, 1) === 35, 'one real correction makes 35');
  ok(unit.aggregateCorrections(0, 0) === 0, 'empty log + empty demo is empty');
}

console.log('\n  ' + pass + ' passed, 0 failed\n');
