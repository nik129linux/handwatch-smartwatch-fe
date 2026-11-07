/* ==========================================================================
   tests/fold.test.js — the Home foot pill is never cut by the screen edge
   node tests/fold.test.js   (run from the prototype folder)
   Pass line: across 0-3 events x learning on/off x EN/ES, the pill is
   either on screen or wholly below the fold (crown scrolls to it).
   ========================================================================== */

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const INDEX = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
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

(async () => {
  const b = await chromium.launch();
  for (const loc of ['en-US', 'es-CO']) {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: loc })).newPage();
    await p.goto(INDEX);
    await p.waitForSelector('.view[data-screen="home"]');
    for (const learn of [false, true]) {
      for (const rows of [0, 1, 2, 3]) {
        const r = await p.evaluate(async ({ learn, rows }) => {
          Calibrate.active = () => learn;
          watch.state.events = [];
          for (let i = 0; i < rows; i++) watch.addEvent({ text: 'Fixed · Bed 3', kind: 'ok' });
          watch.go('home', 'zoom');
          await new Promise((res) => setTimeout(res, 900));
          const scr = document.getElementById('screen').getBoundingClientRect();
          const pill = [...document.querySelectorAll('#screen .screen__foot .pill')].pop().getBoundingClientRect();
          return { cut: pill.top < scr.bottom && pill.bottom > scr.bottom + 2,
            top: Math.round(pill.top - scr.top), bottom: Math.round(pill.bottom - scr.top), h: Math.round(scr.height) };
        }, { learn, rows });
        ok(!r.cut, `${loc} · learning ${learn ? 'on' : 'off'} · ${rows} events: pill not cut`, JSON.stringify(r));
      }
    }
  }
  await b.close();
  console.log('\n  ' + pass + ' passed, ' + (process.exitCode ? 'some' : 0) + ' failed\n');
})();
