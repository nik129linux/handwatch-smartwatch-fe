/* ==========================================================================
   tests/w1.test.js — signal classifier + data flow in the browser
   node tests/w1.test.js   (run from the prototype folder)
   ========================================================================== */

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } =
  require('/home/nico/.nvm/versions/node/v22.23.2/lib/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const INDEX = pathToFileURL(path.join(ROOT, 'index.html')).href;
const UNIT = pathToFileURL(path.join(ROOT, 'unit.html')).href;

let pass = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  ✗ ' + label + (detail ? '\n      ' + detail : ''));
  return false;
}
function head(s) { console.log('\n' + s); }

function watchErrors(page) {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  return errs;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  await page.evaluate(() => { Log.clear(); });

  /* 1 · the doubtful beat is produced by the classifier ------------------ */
  head('1 · the story doubt comes from the classifier');

  await page.evaluate(() => { window.__timeScale = 0.02; });
  const doubt = await page.evaluate(() => {
    window.__bus.dudoso('On exit');
    const f = document.querySelector('.view[data-screen="dudoso"] [data-features]');
    return {
      screen: document.getElementById('screen').dataset.screen,
      features: f ? f.textContent : ''
    };
  });
  ok(doubt.screen === 'dudoso', 'gel under noise opens Did you wash?');
  ok(/rhythm \d\.\d\d · \d+ of \d+ s · \d\.\d Hz -> unsure/.test(doubt.features),
    'the doubt screen carries the classifier features line', doubt.features);
  const logged = await page.evaluate(() =>
    Log.list().map((e) => e.outcome).join(','));
  ok(/unsure/.test(logged), 'the unsure detection is logged', logged);
  await page.evaluate(() => { watch.home(); });

  /* the guided shift still plays to the end */
  await page.evaluate(() => { Log.clear(); });
  await page.addInitScript(() => {});
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  await page.evaluate(() => { window.__storySpeed = 4; });
  /* catch the doubtful beat mid-flight and read its features line */
  const seen = page.waitForFunction(() => {
    const f = document.querySelector('.view[data-screen="dudoso"] [data-features]');
    return f && f.textContent.length > 10 ? f.textContent : false;
  }, { timeout: 90000 }).then((h) => h.jsonValue()).catch(() => null);
  await page.click('#storyPlay');
  const beatLine = await seen;
  ok(typeof beatLine === 'string' && /-> unsure/.test(beatLine),
    'the story beat shows a classifier unsure line', String(beatLine));
  await page.waitForFunction(() => window.__storyDone === true, { timeout: 90000 });
  ok(true, 'the guided shift reached its last beat');
  const st = await page.evaluate(() => ({
    done: watch.state.done,
    corrections: watch.state.corrections,
    screen: document.getElementById('screen').dataset.screen
  }));
  ok(st.screen === 'quien', 'it ends on Who sees this', st.screen);
  ok(st.done === 15, 'the shift closed with 15 of 17 moments', 'done=' + st.done);
  ok(st.corrections === 2, 'two marks were corrected', 'corrections=' + st.corrections);

  /* 2 · the log ----------------------------------------------------------- */
  head('2 · the event log keeps no person and forgets after 24 h');

  const schema = await page.evaluate(() => {
    Log.clear();
    const e = Log.record('before-patient', 'confirmed', true);
    return { keys: Object.keys(e).sort(), persisted: localStorage.getItem(Log.KEY) };
  });
  ok(JSON.stringify(schema.keys) === JSON.stringify(['corrected', 'id', 'moment', 'outcome', 'ts']),
    'schema is exactly id/ts/moment/outcome/corrected', schema.keys.join(','));
  ok(!/person|name|nurse/i.test(schema.persisted), 'persistence holds no person');

  await page.evaluate(() => {
    Log.clear();
    Log.record('before-patient', 'done', false, Date.now() - 25 * 3600 * 1000);
    Log.record('before-patient', 'done', false);
  });
  ok(await page.evaluate(() => Log.list().length) === 2, 'old event present pre-reload');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  const afterPurge = await page.evaluate(() => Log.list().length);
  ok(afterPurge === 1, 'a 25 h old event detail is purged on load', 'left ' + afterPurge);

  const del = await page.evaluate(() => {
    const e = Log.record('before-patient', 'unsure', false);
    const gone = Log.remove(e.id);
    return { gone, left: Log.list().filter((x) => x.id === e.id).length };
  });
  ok(del.gone === true && del.left === 0, 'delete removes the event');

  /* the unit page reflects a corrected event, with no per-person filter */
  await page.evaluate(() => {
    Log.clear();
    Log.record('before-patient', 'confirmed', true);
  });
  const unitPage = await ctx.newPage();
  const unitErrs = watchErrors(unitPage);
  await unitPage.goto(UNIT, { waitUntil: 'load' });
  await unitPage.waitForSelector('#momentBars .ubar');
  await unitPage.waitForTimeout(1200);
  const corrN = await unitPage.locator('#corrN').getAttribute('data-count');
  ok(corrN === '35', 'unit shows demo 34 + 1 real correction', 'corrN=' + corrN);
  ok((await unitPage.locator('input, select').count()) === 0,
    'the unit page has no filter controls at all');
  const byPerson = await unitPage.evaluate(() =>
    /filter by|per-person(?! filter)|by name|by nurse/i.test(document.body.innerText));
  ok(byPerson === false, 'no way to slice by person', '');
  ok(unitErrs.length === 0, 'unit.html has no console errors', unitErrs.join(' | '));

  /* Who sees this reads the live log */
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  await page.evaluate(() => {
    Log.clear();
    Log.record('before-patient', 'done', false);
    Log.record('after-patient', 'unsure', false);
    watch.go('quien', 'fwd');
  });
  await page.waitForTimeout(400);
  const youRow = await page.locator('.view[data-screen="quien"]').textContent();
  ok(/2 events on this watch/.test(youRow), 'the You row counts the live log',
    youRow.replace(/\s+/g, ' ').slice(0, 120));

  /* 3 · the noise slider --------------------------------------------------- */
  head('3 · the noise slider moves the uncertain rate');

  await page.evaluate(() => { watch.go('home', 'zoom'); });
  const slider = await page.locator('#noiseSlider').count();
  ok(slider === 1, 'a Sensor noise slider 0..1 sits in the scope');
  const rate = await page.evaluate(() => {
    const seeds = [];
    for (let s = 0; s < 20; s++) seeds.push(s);
    const at = (noise) => seeds.filter((s) => {
      const r = Sense.run('wash', { seed: s, noise }, false);
      return r.verdict !== 'sure';
    }).length / seeds.length;
    const calm = at(0);
    /* drive the real slider to 0.8, exactly as a finger would */
    const el = document.getElementById('noiseSlider');
    el.value = '0.8';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const noisy = at(Sense.noise);
    return { calm, noisy, sliderNoise: Sense.noise, why: document.getElementById('scopeWhy').textContent };
  });
  ok(rate.sliderNoise === 0.8, 'the slider sets the sensor noise', String(rate.sliderNoise));
  ok(rate.noisy > rate.calm, 'uncertain rate rises with noise',
    '0 → ' + rate.calm.toFixed(2) + ', 0.8 → ' + rate.noisy.toFixed(2));
  ok(/rhythm/.test(rate.why), 'the why line re-runs under the slider', rate.why);

  ok(errs.length === 0, 'index.html has no console errors', errs.join(' | '));

  await browser.close();

  head('summary');
  if (fails.length) {
    console.log(fails.length + ' failed, ' + pass + ' passed\n');
    fails.forEach((f) => console.log('  ✗ ' + f));
    console.log('');
    process.exit(1);
  }
  console.log('  ' + pass + ' passed, 0 failed\n');
})().catch((err) => {
  console.error('\n  harness error:', err && err.message ? err.message : err);
  process.exit(1);
});
