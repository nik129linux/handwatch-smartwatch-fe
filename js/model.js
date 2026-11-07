/* ==========================================================================
   model.js — trained gesture model: multinomial logistic regression
   (softmax) over the features classifier.js extracts from 1 s windows.

   Why this and not a neural net: 7 features, 3 classes, and it has to run
   on a watch. Softmax regression trains in a second, is fully deterministic
   (zero init, full-batch gradient descent), and its probabilities are
   calibrated enough to drive the sure / unsure / nothing decision.

   Honest split: training streams use seeds TRAIN_FROM.., the held-out test
   uses TEST_SEEDS, which never overlap. The data is synthetic (signal.js),
   so the number measures the model against the simulator, not the ward.

     vectorize(features)   7-number feature vector
     forward(x, w)         softmax probabilities (array, class order)
     predict(x, w)         {wash, gel, other}
     train(X, y, opts)     -> {W, b, mean, std}
     trainFromSignal(meta) the exact recipe behind model-weights.js
     heldOut(opts)         model vs hand-written rules on unseen seeds

   Works as a plain <script> (window.Model) and under node (require).
   ========================================================================== */

var Model = (function () {
  'use strict';

  var LABELS = ['wash', 'gel', 'other'];
  var SCENARIOS = ['wash', 'gel', 'door', 'typing', 'wave', 'idle'];
  var TEST_SEEDS = { from: 500000, to: 500999 };

  function truthIndex(scenario) {
    if (scenario === 'wash') return 0;
    if (scenario === 'gel') return 1;
    return 2;
  }

  /* --- features ------------------------------------------------------------ */

  function vectorize(f) {
    var a = (f.activeSeconds || 0) / 20;
    var fr = ((f.domFreq || 0) - 4.5) / 2.5;
    var frac = f.totalSeconds ? (f.activeSeconds || 0) / f.totalSeconds : 0;
    return [f.rms || 0, f.rhythm || 0, a, a * a, fr, fr * fr, frac];
  }

  /* --- math ---------------------------------------------------------------- */

  function standardize(x, w) {
    var out = new Array(x.length);
    for (var i = 0; i < x.length; i++) {
      out[i] = (x[i] - (w.mean ? w.mean[i] : 0)) / (w.std ? w.std[i] : 1);
    }
    return out;
  }

  function softmax(z) {
    var m = Math.max.apply(null, z);
    var e = z.map(function (v) { return Math.exp(v - m); });
    var s = e.reduce(function (p, v) { return p + v; }, 0);
    return e.map(function (v) { return v / s; });
  }

  function forward(x, w) {
    var xs = standardize(x, w);
    var z = w.W.map(function (row, k) {
      var s = w.b[k];
      for (var i = 0; i < row.length; i++) s += row[i] * xs[i];
      return s;
    });
    return softmax(z);
  }

  function argmax(p) {
    var best = 0;
    for (var i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    return best;
  }

  function predict(x, w) {
    var p = forward(x, w);
    return { wash: p[0], gel: p[1], other: p[2] };
  }

  function round6(v) { return Math.round(v * 1e6) / 1e6; }

  /* Full-batch gradient descent on cross-entropy + L2. Zero init, so the
     same data always yields the same weights. */
  function train(X, y, opts) {
    var o = opts || {};
    var epochs = o.epochs || 600;
    var lr = o.lr || 0.5;
    var l2 = o.l2 === undefined ? 1e-3 : o.l2;
    var K = o.classes || 3;
    var d = X[0].length;
    var n = X.length;

    var mean = new Array(d).fill(0);
    var std = new Array(d).fill(0);
    X.forEach(function (x) { for (var i = 0; i < d; i++) mean[i] += x[i] / n; });
    X.forEach(function (x) {
      for (var i = 0; i < d; i++) std[i] += (x[i] - mean[i]) * (x[i] - mean[i]) / n;
    });
    std = std.map(function (v) { return Math.sqrt(v) || 1; });

    var w = { W: [], b: new Array(K).fill(0), mean: mean, std: std };
    for (var k = 0; k < K; k++) w.W.push(new Array(d).fill(0));
    var Xs = X.map(function (x) { return standardize(x, w); });

    for (var ep = 0; ep < epochs; ep++) {
      var gW = w.W.map(function (row) { return row.map(function () { return 0; }); });
      var gb = new Array(K).fill(0);
      for (var j = 0; j < n; j++) {
        var z = w.W.map(function (row, kk) {
          var s = w.b[kk];
          for (var i = 0; i < d; i++) s += row[i] * Xs[j][i];
          return s;
        });
        var p = softmax(z);
        for (var c = 0; c < K; c++) {
          var g = p[c] - (y[j] === c ? 1 : 0);
          gb[c] += g / n;
          for (var i2 = 0; i2 < d; i2++) gW[c][i2] += g * Xs[j][i2] / n;
        }
      }
      for (var c2 = 0; c2 < K; c2++) {
        w.b[c2] -= lr * gb[c2];
        for (var i3 = 0; i3 < d; i3++) {
          w.W[c2][i3] -= lr * (gW[c2][i3] + l2 * w.W[c2][i3]);
        }
      }
    }
    return w;
  }

  /* --- the recipe behind model-weights.js ----------------------------------- */

  function deps() {
    if (typeof Signal !== 'undefined' && typeof Classifier !== 'undefined') {
      return { Signal: Signal, Classifier: Classifier };
    }
    return { Signal: require('./signal.js'), Classifier: require('./classifier.js') };
  }

  /* noise spread 0..0.6 drawn from the seed, so the set covers a quiet
     ward and a noisy one without a random call */
  function noiseFor(seed) { return ((seed * 7919) % 61) / 100; }

  function trainFromSignal(meta) {
    var m = meta || {};
    var from = (m.trainSeeds && m.trainSeeds.from) || 100000;
    var per = m.perScenario || 300;
    var D = deps();
    var X = [];
    var y = [];
    SCENARIOS.forEach(function (sc) {
      for (var s = 0; s < per; s++) {
        var seed = from + s;
        var f = D.Classifier.extract(D.Signal.generate(sc, { seed: seed, noise: noiseFor(seed) }));
        X.push(vectorize(f));
        y.push(truthIndex(sc));
      }
    });
    var w = train(X, y, { epochs: m.epochs || 600, lr: m.lr || 0.5, l2: m.l2 === undefined ? 1e-3 : m.l2 });
    return {
      W: w.W.map(function (r) { return r.map(round6); }),
      b: w.b.map(round6),
      mean: w.mean.map(round6),
      std: w.std.map(round6),
      meta: {
        labels: LABELS.slice(),
        features: ['rms', 'rhythm', 'active', 'active^2', 'tone', 'tone^2', 'activeFraction'],
        trainSeeds: { from: from, to: from + per - 1 },
        perScenario: per,
        trainSize: per * SCENARIOS.length,
        epochs: m.epochs || 600,
        lr: m.lr || 0.5,
        l2: m.l2 === undefined ? 1e-3 : m.l2,
        noise: '0..0.6 from seed'
      }
    };
  }

  /* model vs the hand-written rules on seeds the model never saw */
  function heldOut(opts) {
    var o = opts || {};
    var noise = o.noise === undefined ? 0.35 : o.noise;
    var per = o.perScenario || 40;
    var D = deps();
    var n = 0;
    var hitModel = 0;
    var hitRules = 0;
    var matrix = LABELS.map(function () { return [0, 0, 0]; });
    SCENARIOS.forEach(function (sc) {
      for (var s = 0; s < per; s++) {
        var stream = D.Signal.generate(sc, { seed: TEST_SEEDS.from + s, noise: noise });
        var t = truthIndex(sc);
        var m = D.Classifier.classify(stream);
        var r = D.Classifier.classifyRules(stream);
        var pm = LABELS.indexOf(m.label);
        matrix[t][pm] += 1;
        if (pm === t) hitModel++;
        if (LABELS.indexOf(r.label) === t) hitRules++;
        n++;
      }
    });
    return { n: n, accuracy: hitModel / n, baseline: hitRules / n, matrix: matrix, noise: noise };
  }

  return {
    LABELS: LABELS,
    TEST_SEEDS: TEST_SEEDS,
    vectorize: vectorize,
    forward: forward,
    predict: predict,
    argmax: argmax,
    train: train,
    trainFromSignal: trainFromSignal,
    heldOut: heldOut
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Model;
}
