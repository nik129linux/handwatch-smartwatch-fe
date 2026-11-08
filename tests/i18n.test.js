/* ==========================================================================
   tests/i18n.test.js — the Spanish build, in a browser
   node tests/i18n.test.js   (run from the prototype folder)
   Spanish is the default on a fresh profile, whatever the OS locale says.
   Pass lines fixed before the run: zero English text nodes left on either
   page across every watch screen, watch lines <= 4 words in Spanish, no
   text overflowing the watch screen, and the EN | ES switch flips in place
   without a reload.
   ========================================================================== */

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const ES = require('../js/strings-es.js');

const ROOT = path.resolve(__dirname, '..');
const INDEX = pathToFileURL(path.join(ROOT, 'index.html')).href;
const UNIT = pathToFileURL(path.join(ROOT, 'unit.html')).href;

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

/* English words that never survive a translation */
const EN_RE = /\b(the|and|you|your|watch|wash|washes|shift|of|with|not|never|bed|moments?|reads|week|only|who|sees)\b/i;

async function leftovers(page) {
  return page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const out = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.trim();
      if (!t || n.parentElement.closest('script,style,pre,code,[data-no-i18n]')) continue;
      /* language pickers are endonyms by design ("Español" / "English") */
      if (n.parentElement.closest('[lang]:not(html)')) continue;
      if (re.test(t)) out.add(t);
    }
    document.querySelectorAll('[aria-label]').forEach((el) => {
      if (el.closest('[lang]:not(html)')) return;
      const a = el.getAttribute('aria-label');
      if (re.test(a)) out.add('@' + a);
    });
    return [...out];
  }, EN_RE.source);
}

/* the guide is verified by phase-a.test.js: keep this file on the app copy */
async function quietGuide(ctx) {
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('handwatch-guide1', 'seen');
      localStorage.setItem('handwatch-tips',
        JSON.stringify(['crown', 'strip', 'free', 'privacy']));
    } catch (e) { /* file:// storage is fine; this is a safety net */ }
  });
}

(async () => {
  head('0 · dictionary hygiene');
  {
    const bad = Object.entries(ES.exact).filter(([, v]) =>
      /\b(tocá|mirá|podés|tenés|querés|acordate)\b/i.test(v) || /—/.test(v));
    ok(bad.length === 0, 'no voseo and no em dash in Spanish copy', bad.map((b) => b[1]).join(' | '));
    const accuse = Object.values(ES.exact).filter((v) => /incumplimiento|\bfalta\b|\berror\b/i.test(v));
    ok(accuse.length === 0, 'no accusation words in Spanish copy', accuse.join(' | '));
  }

  const browser = await chromium.launch();
  /* No locale override: the default must be Spanish even on an en-US OS. */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await quietGuide(ctx);
  const errors = [];

  head('1 · index.html opens in Spanish');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  ok(await page.evaluate(() => document.documentElement.lang) === 'es', 'html lang is es on a fresh profile');
  ok(await page.evaluate(() => document.title) === 'Reloj de Higiene de Manos', 'window title translated');
  ok(await page.locator('#langToggle').count() === 1, 'EN | ES switch is on the page');

  await page.evaluate(() => { window.__timeScale = 0.05; });
  const names = ['home', 'recordatorio', 'lavando', 'dudoso', 'fin', 'quien', 'pausa', 'ajustes'];
  const longLines = [];
  const overflow = [];
  for (const n of names) {
    await page.evaluate((s) => {
      if (s === 'lavando') { watch.state.washMs = 20000; watch.startWash({}); }
      else watch.go(s, 'zoom');
    }, n);
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const scr = document.getElementById('screen');
      const view = scr.querySelector('.view.is-active') || scr;
      const lines = scr.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
      const wide = [...view.querySelectorAll('*')].filter((el) =>
        el.children.length === 0 && el.textContent.trim() &&
        el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible')
        .map((el) => el.textContent.trim());
      return { lines, wide };
    });
    r.lines.filter((l) => l.split(/\s+/).length > 4).forEach((l) => longLines.push(n + ': ' + l));
    r.wide.forEach((w) => overflow.push(n + ': ' + w));
  }
  ok(longLines.length === 0, 'Spanish watch lines stay <= 4 words', longLines.join(' // '));
  ok(overflow.length === 0, 'no clipped text on any watch screen', overflow.join(' // '));

  for (const act of ['zona', 'lavado', 'dudoso', 'codigo', 'terminar']) {
    await page.click(`#freeMode [data-act="${act}"]`).catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.click('#sideButton').catch(() => {});
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await page.waitForTimeout(600);
  ok((await leftovers(page)).length === 0,
    'no English left on the stage after every event', (await leftovers(page)).join(' // '));

  head('2 · Settings and Help are Spanish too');
  await page.evaluate(() => Settings.open('general'));
  await page.waitForTimeout(300);
  ok((await leftovers(page)).length === 0,
    'no English left in Configuración', (await leftovers(page)).join(' // '));
  await page.evaluate(() => Settings.open('help'));
  await page.waitForTimeout(400);
  ok((await leftovers(page)).length === 0,
    'no English left in Ayuda', (await leftovers(page)).join(' // '));
  ok(await page.locator('#helpVocab .vocab__row').count() === 4,
    'Ayuda holds the four vibration patterns');
  await page.evaluate(() => Settings.close());
  await page.waitForTimeout(300);

  head('3 · unit.html in Spanish');
  const unit = await ctx.newPage();
  unit.on('pageerror', (e) => errors.push('unit: ' + e));
  await unit.goto(UNIT, { waitUntil: 'load' });
  await unit.waitForTimeout(2500);
  const leftU = await leftovers(unit);
  ok(leftU.length === 0, 'no English left on the unit page', leftU.join(' // '));
  ok(/Mide el proceso/.test(await unit.evaluate(() => document.body.innerText)),
    'the manifesto reads "Mide el proceso"');
  ok(/1\.284 de 1\.362/.test(await unit.evaluate(() => document.body.innerText)),
    'numbers are formatted with Intl for Spanish');

  head('4 · the switch works in place and both languages load clean');
  await page.evaluate(() => { window.__alive = true; watch.state.done = 9; });
  await page.click('#langToggle');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => window.__alive === true), 'switching does not reload the page');
  ok(await page.evaluate(() => document.documentElement.lang) === 'en', 'one click switches to English');
  ok(await page.evaluate(() => watch.state.done) === 9, 'in-memory state survives the switch');
  ok(/Day shift on Unit 4B/.test(await page.evaluate(() => document.body.innerText)), 'English copy is back');
  await page.evaluate(() => Settings.open('help'));
  await page.waitForTimeout(400);
  const enLeft = await page.evaluate(() => {
    const re = /\b(el|la|los|las|del|una|para|con|por|turno|reloj|lavado|momentos?|cama|paciente|gracias|ajustes|configuración|ayuda|idioma|tema|privacidad)\b/i;
    return [...document.querySelectorAll('*')]
      .filter((n) => n.children.length === 0 && n.textContent.trim() && re.test(n.textContent))
      .map((n) => n.textContent.trim());
  });
  ok(enLeft.length === 0, 'no Spanish left in English Help', enLeft.join(' // '));
  await page.evaluate(() => Settings.close());
  await unit.reload({ waitUntil: 'load' });
  ok(await unit.evaluate(() => document.documentElement.lang) === 'en', 'the unit page follows the same choice');
  await page.click('#langToggle');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.documentElement.lang) === 'es', 'and back to Spanish');
  ok(await page.evaluate(() => window.__alive === true), 'still no reload on the way back');
  ok(errors.length === 0, 'zero console errors in Spanish', errors.join(' // '));

  await browser.close();
  console.log('\n  ' + pass + ' passed, ' + (process.exitCode ? 'some' : 0) + ' failed\n');
})();
