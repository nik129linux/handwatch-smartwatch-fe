/* ==========================================================================
   tests/model.test.js — the trained gesture model (softmax regression)
   node tests/model.test.js   (run from the prototype folder)
   Pass lines were fixed before the first training run:
     - held-out accuracy >= 0.92 at noise 0.35
     - train and test seeds never overlap
     - retraining reproduces the shipped weights exactly
   ========================================================================== */

const Signal = require('../js/signal.js');
const Classifier = require('../js/classifier.js');
const Model = require('../js/model.js');
const Weights = require('../js/model-weights.js');

let pass = 0;
function ok(cond, label, detail) {
  if (!cond) {
    console.error('  ✗ ' + label + (detail !== undefined ? '\n      ' + detail : ''));
    process.exitCode = 1;
    return;
  }
  pass++;
  console.log('  ✓ ' + label);
}
function head(s) { console.log('\n' + s); }

head('1 · the math');
{
  const p = Model.predict([0, 0, 0, 0, 0, 0, 0], Weights);
  const sum = p.wash + p.gel + p.other;
  ok(Math.abs(sum - 1) < 1e-9, 'probabilities sum to 1', sum);
  ok(p.wash >= 0 && p.gel >= 0 && p.other >= 0, 'probabilities are non-negative');

  /* a toy separable set trains to 100% */
  const X = [[0, 0], [0, 1], [5, 5], [5, 6], [-5, 5], [-6, 5]];
  const y = [2, 2, 0, 0, 1, 1];
  const w = Model.train(X, y, { epochs: 400, lr: 0.5, l2: 0 });
  const hits = X.filter((x, i) => Model.argmax(Model.forward(x, w)) === y[i]).length;
  ok(hits === X.length, 'a separable toy set trains to 100%', hits + '/' + X.length);
}

head('2 · honest split');
{
  const tr = Weights.meta.trainSeeds;
  const te = Model.TEST_SEEDS;
  ok(tr.from < tr.to, 'train range recorded in the weights', JSON.stringify(tr));
  ok(te.from > tr.to || te.to < tr.from, 'test seeds never overlap train seeds',
    JSON.stringify({ tr, te }));
  ok(Weights.meta.trainSize >= 1000, 'trained on at least 1000 streams', Weights.meta.trainSize);
}

head('3 · held-out quality (seeds the model never saw)');
{
  const r = Model.heldOut({ noise: 0.35, perScenario: 40 });
  ok(r.accuracy >= 0.92, 'held-out accuracy >= 0.92 at noise 0.35', r.accuracy.toFixed(3));
  ok(r.n === 240, 'held-out set is 6 scenarios x 40', r.n);
  ok(typeof r.baseline === 'number', 'hand-written rules scored on the same set',
    r.baseline);
  console.log('      model ' + r.accuracy.toFixed(3) + ' vs rules ' + r.baseline.toFixed(3));
}

head('4 · the classifier decides with the model');
{
  const w = Classifier.classify(Signal.generate('wash', { seed: 7, noise: 0 }));
  ok(w.engine === 'model', 'classify reports the model engine', w.engine);
  ok(w.label === 'wash' && w.confidence >= 0.85, 'clean wash is a sure wash',
    w.label + ' ' + w.confidence.toFixed(3));
  const g = Classifier.classify(Signal.generate('gel', { seed: 7, noise: 0 }));
  ok(g.label === 'gel', 'clean gel reads as gel', g.label);
  const d = Classifier.classify(Signal.generate('door', { seed: 7, noise: 0 }));
  ok(Classifier.verdict(d) === 'none', 'a door is nothing', d.label);
  ok(w.probs && Math.abs(w.probs.wash + w.probs.gel + w.probs.other - 1) < 1e-9,
    'classify exposes the three probabilities');
}

head('5 · reproducible');
{
  const again = Model.trainFromSignal(Weights.meta);
  const same = JSON.stringify(again.W) === JSON.stringify(Weights.W) &&
    JSON.stringify(again.b) === JSON.stringify(Weights.b);
  ok(same, 'retraining with the recorded recipe reproduces the shipped weights');
}

console.log('\n  ' + pass + ' passed, ' + (process.exitCode ? 'some' : 0) + ' failed\n');
