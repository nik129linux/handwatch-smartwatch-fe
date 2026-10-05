/* ==========================================================================
   tests/electron-smoke.js — the desktop app boots and behaves
   node tests/electron-smoke.js   (run from the prototype folder;
   under Wayland use: xvfb-run -a node tests/electron-smoke.js)
   Screenshots land in shots/app-*.png.
   ========================================================================== */

const path = require('path');
const fs = require('fs');
const { _electron } =
  require('/home/nico/.nvm/versions/node/v22.23.2/lib/node_modules/playwright');
const electronPath = require('electron');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');

let pass = 0;
const fails = [];

function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  ✗ ' + label + (detail ? '\n      ' + detail : ''));
  return false;
}
function head(s) { console.log('\n' + s); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  head('electron · Hand Hygiene Watch boots as a desktop app');

  const app = await _electron.launch({
    executablePath: electronPath,
    args: [ROOT],
    env: { ...process.env, ELECTRON_DISABLE_GPU: '1' }
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('.view[data-screen="home"]', { timeout: 15000 });

  ok(await window.title() === 'Hand Hygiene Watch',
    'window title is "Hand Hygiene Watch"', await window.title());

  const errs = [];
  window.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  window.on('pageerror', e => errs.push(e.message));

  /* theme toggle flips data-theme inside the app window */
  ok(await window.locator('#themeToggle[aria-label="Switch theme"]').count() === 1,
    'the app window has a theme toggle');
  const before = await window.evaluate(() => document.documentElement.dataset.theme);
  await window.locator('#themeToggle').click();
  await window.waitForTimeout(600);
  const after = await window.evaluate(() => document.documentElement.dataset.theme);
  ok(before !== after && (after === 'light' || after === 'dark'),
    'the toggle flips data-theme (' + before + ' → ' + after + ')');

  await window.evaluate(() => window.__setTheme('dark'));
  await window.waitForTimeout(600);
  await window.screenshot({ path: path.join(SHOTS, 'app-dark.png') });
  await window.evaluate(() => window.__setTheme('light'));
  await window.waitForTimeout(600);
  await window.screenshot({ path: path.join(SHOTS, 'app-light.png') });
  ok(fs.existsSync(path.join(SHOTS, 'app-dark.png')) &&
    fs.existsSync(path.join(SHOTS, 'app-light.png')),
    'dark + light stage screenshots saved');

  /* free mode: Doubtful wash opens the confirm screen */
  await window.evaluate(() => window.__setTheme('dark'));
  await window.waitForTimeout(400);
  await window.locator('#freeMode [data-act="dudoso"]').click();
  await window.waitForSelector('.view[data-screen="dudoso"]', { timeout: 5000 });
  const q = (await window.locator('.doubt__q').textContent()).trim();
  ok(q === 'Did you wash?', 'Doubtful wash shows the confirm screen', q);
  await window.screenshot({ path: path.join(SHOTS, 'app-doubt.png') });

  /* the Infection Control link navigates inside the same window */
  await window.evaluate(() => { watch.home(); });
  await window.waitForSelector('.view[data-screen="home"]', { timeout: 5000 });
  await window.locator('.panel__link').click();
  await window.waitForSelector('#momentBars .ubar', { timeout: 5000 });
  ok(/Unit 4B/.test(await window.title()) || (await window.locator('.unit__name').count()) === 1,
    'the unit page opens inside the same window');
  await window.evaluate(() => window.__setTheme('dark'));
  await window.waitForTimeout(1200);
  await window.screenshot({ path: path.join(SHOTS, 'app-unit-dark.png'), fullPage: true });
  await window.evaluate(() => window.__setTheme('light'));
  await window.waitForTimeout(1200);
  await window.screenshot({ path: path.join(SHOTS, 'app-unit-light.png'), fullPage: true });

  /* back to the watch */
  await window.evaluate(() =>
    document.querySelector('.unit__back').scrollIntoView({ block: 'center' }));
  await window.waitForTimeout(600);
  await window.locator('.unit__back').click({ force: true });
  await window.waitForSelector('.view[data-screen="home"]', { timeout: 5000 });
  ok(true, 'unit page links back to the watch');

  ok(errs.length === 0, 'no console errors inside the app window',
    errs.slice(0, 3).join(' | '));

  await app.close();

  head('summary');
  if (fails.length) {
    console.log(fails.length + ' failed, ' + pass + ' passed\n');
    process.exit(1);
  }
  console.log('  ' + pass + ' passed, 0 failed');
  console.log('  screenshots → shots/app-*.png');
  console.log('');
})().catch(err => {
  console.error('\n  harness error:', err && err.message ? err.message : err);
  process.exit(1);
});
