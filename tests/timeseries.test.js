/* ==========================================================================
   tests/timeseries.test.js — weekly trend, CUSUM change point and
   forecast over the seeded history. Asserts the planted intervention
   week is recovered within 1 week, and flat histories honestly read
   "no significant change".
   node tests/timeseries.test.js   (run from the prototype folder)
   ========================================================================== */

const Dataset = require('../js/dataset.js');
const Timeseries = require('../js/timeseries.js');

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

function flatWeeks() {
  /* a flat unit: six weeks near 85%, no intervention anywhere */
  const done = [84, 86, 85, 84, 86, 85];
  return done.map((d, w) => ({ week: w, done: d, total: 100, rate: d / 100, lo: 0.76, hi: 0.92 }));
}

/* 1 · the planted intervention week is recovered -------------------------- */

head('1 · CUSUM finds the intervention week');
{
  const data = Dataset.generate(7);
  const weeks = Timeseries.weeklyRates(data.events);
  ok(weeks.length === 6, 'six weekly rates', String(weeks.length));
  ok(weeks.every((w) => w.lo <= w.rate && w.rate <= w.hi),
    'every week carries a Wilson interval');
  const found = Timeseries.cusumChange(weeks);
  const truth = data.truth.interventionWeek;
  ok(Math.abs(found.index - truth) <= 1,
    'change-point lands within 1 week of the planted start',
    'found week ' + (found.index + 1) + ', planted week ' + (truth + 1));
  ok(found.significant === true, 'the lift is significant',
    'p=' + found.p.toExponential(1));
  ok(found.direction === 'up', 'the direction reads up');
  ok(found.post > found.pre, 'post rate beats pre rate',
    (found.pre * 100).toFixed(1) + '% -> ' + (found.post * 100).toFixed(1) + '%');
}

/* 2 · flat histories stay honest ------------------------------------------- */

head('2 · no significant change on a flat unit');
{
  const found = Timeseries.cusumChange(flatWeeks());
  ok(found.significant === false, 'no change is claimed', 'p=' + found.p.toFixed(2));
  const trend = Timeseries.trend(flatWeeks());
  ok(trend.significant === false, 'the trend is not significant');
  ok(trend.verdict === 'no significant change', 'the verdict says so',
    trend.verdict);
  const rising = Timeseries.trend(Timeseries.weeklyRates(Dataset.generate(7).events));
  ok(rising.significant === true && rising.verdict === 'improving',
    'the planted lift reads improving', rising.verdict);
  ok(Timeseries.cusumChange([]).significant === false,
    'too few weeks never claim a change');
}

/* 3 · EWMA is deterministic ------------------------------------------------- */

head('3 · EWMA smoothing');
{
  const a = Timeseries.ewma([0.5, 0.6], 0.5);
  ok(JSON.stringify(a) === JSON.stringify([0.5, 0.55]),
    'one step halves toward the new value');
  const b = Timeseries.ewma([0.8, 0.82, 0.84, 0.81, 0.83]);
  const c = Timeseries.ewma([0.8, 0.82, 0.84, 0.81, 0.83]);
  ok(JSON.stringify(b) === JSON.stringify(c), 'same input, same smoothing');
  ok(b.every((v) => v >= 0.8 && v <= 0.84), 'the level tracks the series');
}

/* 4 · the forecast carries an interval -------------------------------------- */

head('4 · next-week forecast');
{
  const weeks = Timeseries.weeklyRates(Dataset.generate(7).events);
  const fc = Timeseries.forecastNext(weeks);
  ok(fc.point >= 0 && fc.point <= 1, 'the point sits in [0, 1]',
    fc.point.toFixed(3));
  ok(fc.lo <= fc.point && fc.point <= fc.hi, 'the interval holds the point',
    fc.lo.toFixed(2) + '-' + fc.hi.toFixed(2));
  ok(fc.hi - fc.lo > 0 && fc.hi - fc.lo < 0.5, 'the interval has honest width',
    'width ' + (fc.hi - fc.lo).toFixed(3));
  const flat = Timeseries.forecastNext(flatWeeks());
  ok(Math.abs(flat.point - 0.85) < 0.02, 'a flat unit forecasts flat',
    flat.point.toFixed(3));
}

console.log('\n  ' + pass + ' passed, 0 failed\n');
