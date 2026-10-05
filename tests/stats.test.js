/* ==========================================================================
   tests/stats.test.js — Wilson intervals, z-tests, BH correction and
   the planted truths: the shift-change dip is significant after
   correction, null buckets are NOT flagged, small n is not a finding.
   node tests/stats.test.js   (run from the prototype folder)
   ========================================================================== */

const Dataset = require('../js/dataset.js');
const Stats = require('../js/stats.js');

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
function close(a, b, tol) { return Math.abs(a - b) <= tol; }

/* 1 · Wilson intervals read correctly ----------------------------------- */

head('1 · Wilson 95% intervals');
{
  const w = Stats.wilson(60, 100);
  ok(close(w.rate, 0.6, 1e-9), 'rate is 60/100');
  ok(close(w.lo, 0.502, 0.005), 'lower bound near 0.502', w.lo.toFixed(4));
  ok(close(w.hi, 0.691, 0.005), 'upper bound near 0.691', w.hi.toFixed(4));
  ok(w.lo < w.rate && w.rate < w.hi, 'the rate sits inside its interval');
  const empty = Stats.wilson(0, 0);
  ok(empty.lo === 0 && empty.hi === 1, 'no data reads as the full interval');
  const edge = Stats.wilson(756, 756);
  ok(edge.rate === 1 && edge.lo < 1, 'a perfect rate still has width below');
}

/* 2 · the z-test separates signal from noise ---------------------------- */

head('2 · two-proportion z-test');
{
  const same = Stats.twoPropZ(50, 100, 50, 100);
  ok(same.p > 0.99, 'identical rates read p near 1', same.p.toFixed(3));
  const diff = Stats.twoPropZ(30, 100, 70, 100);
  ok(diff.p < 0.001 && diff.diff < 0, '30% vs 70% is significant and negative',
    'p=' + diff.p.toExponential(1));
  const nodata = Stats.twoPropZ(0, 0, 5, 10);
  ok(nodata.p === 1, 'missing counts never claim significance');
}

/* 3 · effect size and BH correction -------------------------------------- */

head('3 · effect size and Benjamini-Hochberg');
{
  ok(Stats.cohensH(0.5, 0.5) === 0, 'identical rates have zero effect');
  ok(Math.abs(Stats.cohensH(0.69, 0.89)) > 0.4,
    'the planted dip is a medium-plus effect',
    Stats.cohensH(0.69, 0.89).toFixed(2));
  ok(JSON.stringify(Stats.bhAdjust([])) === '[]', 'empty in, empty out');
  const adj = Stats.bhAdjust([0.001, 0.5, 0.6]);
  ok(adj[0] < 0.05, 'the small p survives correction', adj[0].toExponential(1));
  ok(adj[1] >= 0.05 && adj[2] >= 0.05, 'null p values stay null',
    adj[1].toFixed(2) + ', ' + adj[2].toFixed(2));
  const mono = Stats.bhAdjust([0.03, 0.01, 0.02]);
  ok(mono[1] <= mono[2] && mono[2] <= mono[0],
    'adjusted values stay monotone in raw rank');
}

/* 4 · the planted dip is recovered, null buckets stay quiet -------------- */

head('4 · planted truth: the shift-change dip');
{
  const data = Dataset.generate(7);
  const buckets = Dataset.byHourBucket(data.events);
  const tested = Stats.analyzeBuckets(buckets);
  const dip = tested.filter((b) => b.key === String(data.truth.dipBucket))[0];
  ok(dip.status === 'worse', 'bucket ' + dip.label + ' is flagged worse');
  ok(dip.pAdj < 0.05, 'the dip survives BH correction',
    'pAdj=' + dip.pAdj.toExponential(1));
  ok(Math.abs(dip.h) >= Stats.MIN_H, 'the dip carries a real effect',
    'h=' + dip.h.toFixed(2));
  ok(tested[0].key === String(data.truth.dipBucket),
    'the dip ranks first by significance and effect');
  const others = tested.filter((b) => b.key !== String(data.truth.dipBucket));
  ok(others.every((b) => b.status !== 'worse' && b.status !== 'better'),
    'null buckets are NOT flagged (' +
    others.map((b) => b.label + ':' + b.status).join(' ') + ')');
  others.forEach((b) => {
    ok(b.lo <= b.rate && b.rate <= b.hi,
      b.label + ' carries a sane interval');
  });
}

/* 5 · small n is reported, never a finding -------------------------------- */

head('5 · minimum-sample rule');
{
  const tiny = Stats.analyzeBuckets([
    { key: 'a', label: 'tiny', done: 0, total: 5 },
    { key: 'b', label: 'solid', done: 90, total: 100 },
    { key: 'c', label: 'solid2', done: 88, total: 100 }
  ]);
  const a = tiny.filter((b) => b.key === 'a')[0];
  ok(a.status === 'not-enough-data', 'n=5 is reported, never a finding');
  const data = Dataset.generate(7);
  const byMoment = Stats.analyzeBuckets(Dataset.byMoment(data.events));
  ok(byMoment.every((b) => b.status === 'same'),
    'moment types stay quiet: small offsets do not survive correction');
}

/* 6 · anonymous by construction, deterministic --------------------------- */

head('6 · anonymity and determinism');
{
  const data = Dataset.generate(7);
  const keys = Object.keys(data.events[0]).sort();
  ok(JSON.stringify(keys) === JSON.stringify(
    ['bucket', 'corrected', 'day', 'done', 'hour', 'moment', 'shift', 'week']),
    'events carry aggregates only', keys.join(','));
  const raw = JSON.stringify(data.events);
  ok(!/person|nurse|staff|name|badge|owner|user/i.test(raw),
    'no person-shaped value anywhere in the history');
  const again = Dataset.generate(7);
  ok(JSON.stringify(again) === JSON.stringify(data),
    'the same seed yields the same history');
  const other = Dataset.generate(8);
  ok(JSON.stringify(other) !== JSON.stringify(data),
    'a different seed yields a different history');
}

console.log('\n  ' + pass + ' passed, 0 failed\n');
