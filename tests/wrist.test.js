/* ==========================================================================
   tests/wrist.test.js — the real-watch bridge
   node tests/wrist.test.js   (run from the prototype folder)
   Pure: each haptic maps to a short push with no names or free text.
   Browser: off = zero requests to ntfy.sh; on = one POST per haptic.
   ========================================================================== */

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const Wrist = require('../js/wrist.js');

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

console.log('\npure mapping');
const S = { bed: 'Bed 3', lastMoment: 'before-patient', done: 15, opportunities: 17, nurse: 'Ana' };
const r = Wrist.message('reminder', S);
ok(r.title === 'Wash hands' && r.body === 'Before patient · Bed 3' && r.priority === 4, 'reminder', JSON.stringify(r));
const d = Wrist.message('doubtful', S);
ok(d.title === 'Did you wash?' && d.priority === 4, 'doubtful asks, buzzes', JSON.stringify(d));
ok(Wrist.message('ok', S).priority === 2, 'ok arrives quietly');
ok(Wrist.message('end', S).body === '15 of 17 moments', 'end carries the totals only');
ok(Wrist.message('nope', S) === null, 'unknown pattern sends nothing');
const all = ['reminder', 'doubtful', 'ok', 'end'].map((n) => JSON.stringify(Wrist.message(n, S))).join(' ');
ok(!/Ana/.test(all), 'state fields beyond bed/moment/totals never leave');
ok(!/failure|violation|error|fault|missed/i.test(all), 'no accusation wording');
ok(['reminder', 'doubtful', 'ok', 'end'].every((n) => Wrist.message(n, S).title.split(' ').length <= 4),
  'titles are glanceable (≤ 4 words)');
ok(Wrist.TOPIC_RE.test(Wrist.randomTopic()), 'random topic is valid');

(async () => {
  console.log('\nbrowser');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const hits = [];
  await page.route('https://ntfy.sh/**', (route) => {
    const req = route.request();
    hits.push({ method: req.method(), url: req.url(), title: req.headers()['title'], body: req.postData() });
    route.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => { try { localStorage.removeItem('hhw.wrist'); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(800);

  ok(await page.getAttribute('#wristToggle', 'aria-checked') === 'false', 'off by default');
  await page.evaluate(() => haptics.play('doubtful'));
  await page.waitForTimeout(400);
  ok(hits.length === 0, 'off: zero network calls', JSON.stringify(hits));

  await page.click('#wristToggle');
  ok(await page.getAttribute('#wristToggle', 'aria-checked') === 'true', 'toggle turns on');
  ok(await page.isVisible('#wristHelp'), 'topic shown when on');
  await page.evaluate(() => haptics.play('doubtful'));
  await page.waitForTimeout(600);
  ok(hits.length === 1 && hits[0].method === 'POST', 'on: one POST per haptic', JSON.stringify(hits));
  ok(hits[0] && hits[0].title === 'Did you wash?', 'title reaches ntfy', hits[0] && hits[0].title);
  const topic = await page.textContent('#wristTopic');
  ok(hits[0] && hits[0].url === 'https://ntfy.sh/' + topic, 'posts to the shown topic');
  ok(/sent/.test(await page.textContent('#wristStatus')), 'status says sent');

  await page.reload();
  await page.waitForTimeout(600);
  ok(await page.getAttribute('#wristToggle', 'aria-checked') === 'true', 'setting persists');
  ok(await page.textContent('#wristTopic') === topic, 'topic persists');

  console.log('\nguided shift waits for the wrist');
  await page.evaluate(() => { window.__storySpeed = 6; });
  await page.click('#storyPlay');
  await page.waitForFunction(() => watch.state.screen === 'dudoso', null, { timeout: 30000 });
  ok(/Answer on your wrist/.test(await page.textContent('#subtitle')), 'subtitle asks for the wrist',
    await page.textContent('#subtitle'));
  await page.waitForTimeout(14000);
  ok(await page.evaluate(() => watch.state.screen) === 'dudoso', 'still waiting after the old 12 s deadline');
  await page.evaluate(() => wrist.applyAnswer('no', 'wear'));
  await page.waitForFunction(() => watch.state.screen === 'pausa', null, { timeout: 20000 })
    .then(() => ok(true, 'answer from the wrist moves the story on'))
    .catch(() => ok(false, 'answer from the wrist moves the story on'));

  await browser.close();
  console.log('\n' + pass + ' passed' + (process.exitCode ? ', some failed' : ''));
})();
