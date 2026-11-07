/* ==========================================================================
   tests/i18n.test.js — the Spanish build, in a browser (es-CO locale)
   node tests/i18n.test.js   (run from the prototype folder)
   Pass lines fixed before the run: zero English text nodes left on either
   page across every watch screen, watch lines <= 4 words in Spanish, no
   text overflowing the watch screen, the EN | ES switch persists.
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
      if (re.test(t)) out.add(t);
    }
    document.querySelectorAll('[aria-label]').forEach((el) => {
      const a = el.getAttribute('aria-label');
      if (re.test(a)) out.add('@' + a);
    });
    return [...out];
  }, EN_RE.source);
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO' });
  const errors = [];

  head('1 · index.html in Spanish');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  ok(await page.evaluate(() => document.documentElement.lang) === 'es', 'html lang is es');
  ok(await page.evaluate(() => document.title) === 'Reloj de Higiene de Manos', 'window title translated');
  ok(await page.locator('#langToggle').count() === 1, 'EN | ES switch is on the page');

  await page.evaluate(() => { window.__timeScale = 0.05; });
  const names = ['home', 'recordatorio', 'lavando', 'dudoso', 'fin', 'quien', 'pausa'];
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
  const left = await leftovers(page);
  ok(left.length === 0, 'no English left on the stage after every event', left.join(' // '));

  head('2 · unit.html in Spanish');
  const unit = await ctx.newPage();
  unit.on('pageerror', (e) => errors.push('unit: ' + e));
  await unit.goto(UNIT, { waitUntil: 'load' });
  await unit.waitForTimeout(2500);
  const leftU = await leftovers(unit);
  ok(leftU.length === 0, 'no English left on the unit page', leftU.join(' // '));
  ok(/Mide el proceso/.test(await unit.evaluate(() => document.body.innerText)),
    'the manifesto reads "Mide el proceso"');

  head('3 · the switch persists and both languages load clean');
  await page.click('#langToggle');
  await page.waitForLoadState('load');
  await page.waitForSelector('.view[data-screen="home"]');
  ok(await page.evaluate(() => document.documentElement.lang) === 'en', 'one click switches to English');
  ok(/Day shift on Unit 4B/.test(await page.evaluate(() => document.body.innerText)), 'English copy is back');
  await unit.reload({ waitUntil: 'load' });
  ok(await unit.evaluate(() => document.documentElement.lang) === 'en', 'the unit page follows the same choice');
  await page.click('#langToggle');
  await page.waitForLoadState('load');
  ok(await page.evaluate(() => document.documentElement.lang) === 'es', 'and back to Spanish');
  ok(errors.length === 0, 'zero console errors in Spanish', errors.join(' // '));

  await browser.close();
  console.log('\n  ' + pass + ' passed, ' + (process.exitCode ? 'some' : 0) + ' failed\n');
})();
