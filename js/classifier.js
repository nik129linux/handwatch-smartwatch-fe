/* ==========================================================================
   classifier.js — on-device motion classifier over 1 s windows
   Pure function, no network, no model files. Features per stream:
   RMS energy, dominant frequency in the 2-7 Hz band (small DFT),
   rhythmicity (autocorrelation peak with prominence), sustained-activity
   duration. Thresholds are named constants (see THRESHOLDS).
   Works as a plain <script> (window.Classifier) and under node (require).
   ========================================================================== */

var Classifier = (function () {
  'use strict';

  /* --- decision thresholds: the only numbers the verdict reads ----------- */
  var THRESHOLDS = {
    CONFIDENT: 0.75,     /* confidence >= 0.75 -> confident */
    UNCERTAIN: 0.4,      /* 0.4 - 0.75 -> uncertain; below -> nothing */
    WINDOW_SEC: 1,       /* feature window length */
    SAMPLE_RATE: 50,     /* expected accelerometer rate */
    FREQ_LO: 2,          /* dominant-frequency band, Hz */
    FREQ_HI: 7,
    ENERGY_FLOOR: 0.35,  /* window RMS below this is rest */
    RHYTHM_FLOOR: 0.45,  /* rhythmicity below this is not scrubbing */
    WASH_MIN_SEC: 12,    /* sustained seconds that start to read as a wash */
    WASH_FULL_SEC: 18,   /* sustained seconds that fully read as a wash */
    GEL_IDEAL_SEC: 7,    /* gel rubs live around this long */
    GEL_TOL_SEC: 5,      /* gel duration tolerance */
    WASH_TONE_HZ: 4,     /* scrubbing tone centre */
    GEL_TONE_HZ: 5,      /* rub tone centre */
    TONE_TOL_HZ: 2.5     /* tone tolerance */
  };

  function clamp01(v) {
    if (!(v >= 0)) return 0;
    if (v > 1) return 1;
    return v;
  }

  function axisValues(samples, axis) {
    var v = new Array(samples.length);
    for (var i = 0; i < samples.length; i++) v[i] = samples[i][axis];
    return v;
  }

  /* the axis that moves the most carries the scrubbing tone */
  function bestAxis(samples) {
    var energy = [0, 0, 0];
    for (var i = 0; i < samples.length; i++) {
      energy[0] += samples[i][0] * samples[i][0];
      energy[1] += samples[i][1] * samples[i][1];
      energy[2] += samples[i][2] * samples[i][2];
    }
    var best = 0;
    if (energy[1] > energy[best]) best = 1;
    if (energy[2] > energy[best]) best = 2;
    return best;
  }

  function demean(win) {
    var mean = 0;
    for (var i = 0; i < win.length; i++) mean += win[i];
    mean /= Math.max(1, win.length);
    var out = new Array(win.length);
    for (var j = 0; j < win.length; j++) out[j] = win[j] - mean;
    return out;
  }

  /* dominant frequency in the 2-7 Hz band: brute-force DFT, 0.25 Hz steps */
  function dominantFreq(win, rate) {
    var best = { freq: THRESHOLDS.FREQ_LO, power: -1 };
    for (var f = THRESHOLDS.FREQ_LO; f <= THRESHOLDS.FREQ_HI + 1e-9; f += 0.25) {
      var re = 0;
      var im = 0;
      var w = 2 * Math.PI * f / rate;
      for (var n = 0; n < win.length; n++) {
        re += win[n] * Math.cos(w * n);
        im -= win[n] * Math.sin(w * n);
      }
      var power = re * re + im * im;
      if (power > best.power) best = { freq: f, power: power };
    }
    return best.freq;
  }

  /* rhythmicity: autocorrelation peak in the 2-7 Hz lag range, weighted by
     its prominence so a slow swell (door, wave) does not read as rhythm.
     A peak pinned to the edge of the lag range is a swell, not a tone.
     Normalized per lag, so a clean tone reads near 1 at any lag. */
  function rhythmicity(win, rate) {
    var n = win.length;
    var lo = Math.max(1, Math.round(rate / THRESHOLDS.FREQ_HI));
    var hi = Math.round(rate / THRESHOLDS.FREQ_LO);
    var peak = 0;
    var peakLag = -1;
    var trough = Infinity;
    for (var lag = lo; lag <= hi; lag++) {
      var num = 0;
      var left = 0;
      var right = 0;
      for (var j = 0; j < n - lag; j++) {
        num += win[j] * win[j + lag];
        left += win[j] * win[j];
        right += win[j + lag] * win[j + lag];
      }
      var denom = Math.sqrt(left * right);
      var r = denom < 1e-9 ? 0 : num / denom;
      if (r > peak) { peak = r; peakLag = lag; }
      if (r < trough) trough = r;
    }
    if (trough === Infinity) trough = 0;
    var prominence = Math.max(0, peak - Math.min(trough, peak));
    var rhythm = Math.max(0, peak) * clamp01(prominence / 0.5);
    if (peakLag === lo || peakLag === hi) rhythm *= 0.35;
    return rhythm;
  }

  function median(values) {
    if (!values.length) return 0;
    var s = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  /* lower quartile: the rhythm has to hold across the stream, not flare
     in one window. A wash that falls apart halfway reads as unsure. */
  function lowerQuartile(values) {
    if (!values.length) return 0;
    var s = values.slice().sort(function (a, b) { return a - b; });
    return s[Math.floor((s.length - 1) * 0.25)];
  }

  /* --- public ------------------------------------------------------------ */

  /* Feature extraction only: no decision. Accepts {samples, rate} or a raw
     samples array. Both the trained model and the rules read these. */
  function extract(stream) {
    var T = THRESHOLDS;
    var samples = stream && stream.samples ? stream.samples : stream;
    var rate = (stream && stream.rate) || T.SAMPLE_RATE;
    if (!samples || !samples.length) {
      return { rms: 0, domFreq: 0, rhythm: 0, activeSeconds: 0, totalSeconds: 0 };
    }

    var axis = bestAxis(samples);
    var series = axisValues(samples, axis);
    var per = Math.max(1, Math.round(rate * T.WINDOW_SEC));
    var rmsList = [];
    var freqList = [];
    var rhythmList = [];

    for (var start = 0; start + per <= series.length; start += per) {
      var win = demean(series.slice(start, start + per));
      var energy = 0;
      for (var i = 0; i < win.length; i++) energy += win[i] * win[i];
      var rms = Math.sqrt(energy / win.length);
      if (rms < T.ENERGY_FLOOR) continue;
      rmsList.push(rms);
      freqList.push(dominantFreq(win, rate));
      rhythmList.push(rhythmicity(win, rate));
    }

    var activeSeconds = rmsList.length * T.WINDOW_SEC;
    return {
      rms: rmsList.length ? median(rmsList) : 0,
      domFreq: freqList.length ? median(freqList) : 0,
      rhythm: rhythmList.length ? lowerQuartile(rhythmList) : 0,
      activeSeconds: activeSeconds,
      totalSeconds: samples.length / rate
    };
  }

  /* The hand-written rules: the baseline the trained model is measured
     against. Returns {label, confidence, seconds, features, engine}. */
  function decideRules(features) {
    var T = THRESHOLDS;
    var rms = features.rms;
    var domFreq = features.domFreq;
    var rhythm = features.rhythm;
    var activeSeconds = features.activeSeconds;
    var base = { seconds: activeSeconds, features: features, engine: 'rules' };
    function out(label, confidence) {
      return { label: label, confidence: confidence, seconds: base.seconds,
        features: base.features, engine: base.engine };
    }
    if (!features.totalSeconds) return out('other', 0);

    /* too short, arrhythmic, or pinned to the band edge: nothing to read */
    if (activeSeconds < 3 || rhythm < T.RHYTHM_FLOOR ||
        domFreq < T.FREQ_LO + 0.25 || domFreq > T.FREQ_HI - 0.25) {
      return out('other', clamp01(0.25 * clamp01(rms) + 0.15 * clamp01(activeSeconds / 8)));
    }

    var washDur = clamp01((activeSeconds - T.WASH_MIN_SEC) / (T.WASH_FULL_SEC - T.WASH_MIN_SEC));
    var gelDur = 1 - Math.min(1, Math.abs(activeSeconds - T.GEL_IDEAL_SEC) / T.GEL_TOL_SEC);
    var washTone = 1 - Math.min(1, Math.abs(domFreq - T.WASH_TONE_HZ) / T.TONE_TOL_HZ);
    var gelTone = 1 - Math.min(1, Math.abs(domFreq - T.GEL_TONE_HZ) / T.TONE_TOL_HZ);
    var energy = clamp01((rms - T.ENERGY_FLOOR) / 1.2);

    var washScore = 0.4 * rhythm + 0.22 * washTone + 0.26 * washDur + 0.12 * energy;
    var gelScore = 0.4 * rhythm + 0.22 * gelTone + 0.26 * gelDur + 0.12 * energy;

    var label = washScore >= gelScore ? 'wash' : 'gel';
    var confidence = Math.max(washScore, gelScore);
    if (confidence < T.UNCERTAIN) return out('other', confidence);
    return out(label, confidence);
  }

  /* The trained model (model.js + model-weights.js). Confidence is the
     model's probability for its top class. A wash/gel below the unsure
     floor reads as nothing, same contract as the rules. */
  function decideModel(features, M, W) {
    var x = M.vectorize(features);
    var p = M.predict(x, W);
    var label = 'other';
    if (p.wash >= p.gel && p.wash >= p.other) label = 'wash';
    else if (p.gel >= p.other) label = 'gel';
    var confidence = p[label];
    if (label !== 'other' && confidence < THRESHOLDS.UNCERTAIN) label = 'other';
    return { label: label, confidence: confidence, seconds: features.activeSeconds,
      features: features, engine: 'model', probs: p };
  }

  function loadModel() {
    var M = (typeof Model !== 'undefined') ? Model : null;
    var W = (typeof ModelWeights !== 'undefined') ? ModelWeights : null;
    if ((!M || !W) && typeof require === 'function') {
      try { M = M || require('./model.js'); } catch (e) { M = null; }
      try { W = W || require('./model-weights.js'); } catch (e) { W = null; }
    }
    return (M && W && W.W) ? { M: M, W: W } : null;
  }

  /* Classify one stream with the trained model; the rules answer only if
     the model files are missing. */
  function classify(stream) {
    var features = extract(stream);
    var m = loadModel();
    if (m && features.totalSeconds) return decideModel(features, m.M, m.W);
    return decideRules(features);
  }

  function classifyRules(stream) {
    return decideRules(extract(stream));
  }

  /* verdict word for the scope "why" line */
  function verdict(result) {
    if (!result) return 'none';
    if (result.label === 'other' || result.confidence < THRESHOLDS.UNCERTAIN) return 'none';
    if (result.confidence >= THRESHOLDS.CONFIDENT) return 'sure';
    return 'unsure';
  }

  /* one mono line: rhythm, sustained seconds, tone, verdict */
  function whyLine(result) {
    var f = result.features;
    var v = verdict(result);
    var word = v === 'sure' ? result.label : v;
    return 'rhythm ' + f.rhythm.toFixed(2) + ' · ' +
      Math.round(f.activeSeconds) + ' of ' + Math.round(f.totalSeconds) + ' s · ' +
      f.domFreq.toFixed(1) + ' Hz -> ' + word;
  }

  return {
    THRESHOLDS: THRESHOLDS,
    classify: classify,
    classifyRules: classifyRules,
    extract: extract,
    verdict: verdict,
    whyLine: whyLine
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Classifier;
}
