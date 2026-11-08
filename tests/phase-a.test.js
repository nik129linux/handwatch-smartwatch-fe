/* ==========================================================================
   tests/phase-a.test.js — the rubric gate, in a real browser.
   node tests/phase-a.test.js   (run from the prototype folder)
   Asserts: Spanish + light on a fresh profile, Configuración reachable with a
   gear, language switches in place with app state intact, the three-level
   guide (first-run cards, one coach mark, Help inside Settings), the watch's
   own Ajustes, Intl numbers, and no English visible in Spanish.
   ========================================================================== */

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

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

/* English words that must never survive on a Spanish screen. */
const EN_WORDS = /\b(settings?|language|theme|privacy|help|guide|next|back|skip|done|light|dark|system|consent|granted|revoked|tip|close|open|watch|wash|washes|shift|bed|moments?|reads|week|who|sees|only|you|your|the|and|of|with|not|never)\b/i;

async function englishVisible(page) {
  return page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const out = [];
    const text = document.body.innerText;
    text.split('\n').forEach((line) => {
      const t = line.trim();
      if (t && re.test(t)) out.push(t);
    });
    document.querySelectorAll('[aria-label],[placeholder],[title]').forEach((el) => {
      if (el.offsetParent === null && el.tagName !== 'BODY') return;
      ['aria-label', 'placeholder', 'title'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v && re.test(v)) out.push('@' + v);
      });
    });
    return [...new Set(out)];
  }, EN_WORDS.source);
}

async function contrast(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { missing: s };
    const parse = (c) => {
      let m = (c || '').match(/rgba?\(([^)]+)\)/);
      if (m) {
        const v = m[1].split(',').map((x) => parseFloat(x));
        return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
      }
      m = (c && c.match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/));
      if (m) return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255, parseFloat(m[3]) * 255, 1];
      return null;
    };
    const lin = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const fg = parse(getComputedStyle(el).color);
    let bg = null;
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0.99) { bg = c; break; }
      n = n.parentElement;
    }
    const L1 = lum(fg), L2 = lum(bg || [255, 255, 255, 1]);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return { ratio: (hi + 0.05) / (lo + 0.05) };
  }, sel);
}

(async () => {
  const browser = await chromium.launch();

  /* ------------------------------------------------- A · fresh profile */
  head('A · a fresh profile opens Spanish + light');
  /* default locale: en-US on purpose, the OS must not decide */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    window.__vibe = [];
    try {
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: function (p) { window.__vibe.push(Array.from(p)); return true; }
      });
    } catch (e) { /* keep the engine's own */ }
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');

  ok(await page.evaluate(() => document.documentElement.lang) === 'es',
    'fresh profile: html lang is es');
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light',
    'fresh profile: light theme');
  ok(await page.evaluate(() => document.title) === 'Reloj de Higiene de Manos',
    'fresh profile: Spanish window title');

  head('B · guide level 1: three cards, once, replayable');
  await page.waitForSelector('#guideLayer .guide[role="dialog"]', { timeout: 4000 });
  ok(await page.locator('#guideLayer .guide[aria-modal="true"]').count() === 1,
    'level 1 is a role=dialog with aria-modal');
  ok(await page.locator('.guide__card').count() === 3, 'three welcome cards');
  ok(await page.locator('.guide__dot').count() === 3, 'three progress dots');
  const nextLabel = (await page.locator('[data-guide-next]').textContent()).trim();
  const backLabel = (await page.locator('[data-guide-back]').textContent()).trim();
  const skipLabel = (await page.locator('[data-guide-skip]').textContent()).trim();
  ok(nextLabel === 'Siguiente' && backLabel === 'Atrás' && skipLabel === 'Saltar',
    'buttons read Siguiente / Atrás / Saltar', [nextLabel, backLabel, skipLabel].join(' / '));
  ok(await page.evaluate(() => {
    const box = document.querySelector('#guideLayer .guide');
    return box.contains(document.activeElement);
  }), 'focus starts inside the modal (trapped)');
  const bodyText = await page.evaluate(() => document.getElementById('guideLayer').textContent);
  ok(/Te aviso con vibración/.test(bodyText) &&
    /Si dudo, te pregunto/.test(bodyText) && /Solo tú lo ves/.test(bodyText),
    'the three watch cards carry the promised lines');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('guideLayer').hidden) === true,
    'Esc closes level 1');
  ok(await page.evaluate(() => localStorage.getItem('handwatch-guide1')) === 'seen',
    'the first-run guide is persisted as seen');

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() =>
    document.querySelector('#guideLayer:not([hidden])') === null),
    'second launch: level 1 does not show again');

  head('C · guide level 2: a coach mark, once');
  await page.waitForSelector('#guideTip', { timeout: 4000 });
  const tipText = (await page.locator('#guideTip .tip__text').textContent()).trim();
  ok(/Gira la corona/.test(tipText), 'the crown coach mark appears in Spanish', tipText);
  ok(await page.locator('#guideTip[role="dialog"]').count() === 1,
    'the coach mark is a dismissible dialog');
  await page.click('#guideTip .tip__close');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => Prefs.tipSeen('crown')) === true,
    'a dismissed coach mark is persisted');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  await page.waitForTimeout(1500);
  const tip2 = await page.evaluate(() => {
    const t = document.getElementById('guideTip');
    return t ? t.innerText : '';
  });
  ok(!/Gira la corona/.test(tip2), 'the same coach mark never shows twice', tip2);

  head('D · Configuración: gear, language in place, theme, state survives');
  ok(await page.locator('#settingsOpen[aria-label="Configuración"]').count() === 1,
    'the header holds a gear labelled Configuración');
  await page.evaluate(() => {
    window.__alive = true;
    watch.state.done = 9;
    watch.go('home', 'zoom');
  });
  await page.click('#settingsOpen');
  await page.waitForSelector('#settingsLayer .settings[role="dialog"]');
  ok(await page.locator('#settingsLayer .settings[aria-modal="true"]').count() === 1,
    'Configuración is a role=dialog with aria-modal');
  const setText = await page.evaluate(() => document.querySelector('.settings').textContent);
  ['Idioma', 'Tema', 'Inteligencia artificial', 'Privacidad', 'Guía'].forEach((w) => {
    ok(setText.indexOf(w) !== -1, 'Configuración includes ' + w);
  });
  ['Claro', 'Oscuro', 'Sistema'].forEach((w) => {
    ok(setText.indexOf(w) !== -1, 'theme option ' + w);
  });
  ok(await page.locator('[data-ai-toggle][role="switch"]').count() === 1,
    'AI has an on/off switch');
  ok(await page.locator('[data-ai-grant]').count() === 1 &&
    await page.locator('[data-ai-revoke]').count() === 1,
    'AI consent can be granted and revoked');
  ok(await page.locator('[data-delete]').count() === 1,
    'Privacidad offers delete-all');

  /* keyboard: Tab stays inside, Esc closes and returns focus to the gear */
  for (let i = 0; i < 10; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => {
    const box = document.querySelector('#settingsLayer .settings');
    return box.contains(document.activeElement);
  }), 'Tab is trapped inside Configuración');

  await page.click('[data-lang="en"]');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__alive === true),
    'switching language does not reload the page');
  ok(await page.evaluate(() => document.documentElement.lang) === 'en',
    'Settings switches to English in place');
  ok(await page.evaluate(() => watch.state.done) === 9,
    'in-memory watch state survives the switch');
  ok(/Settings/.test(await page.evaluate(() => document.querySelector('.settings').innerText)),
    'the panel is English right away');
  const enAll = await page.evaluate(() => document.body.innerText);
  ok(/Day shift on Unit 4B/.test(enAll), 'the page copy follows the switch');
  await page.click('[data-lang="es"]');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.documentElement.lang) === 'es',
    'and back to Spanish in place');
  ok(/Turno de día en la Unidad 4B/.test(await page.evaluate(() => document.body.innerText)),
    'the headline is Spanish again');

  /* theme options actually apply and persist */
  await page.click('[data-theme-choice="dark"]');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark',
    'Oscuro applies the dark theme');
  ok(await page.evaluate(() => localStorage.getItem('handwatch-theme')) === 'dark',
    'the theme choice is persisted');
  await page.click('[data-theme-choice="system"]');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => localStorage.getItem('handwatch-theme')) === 'system',
    'Sistema is a stored choice');
  await page.click('[data-theme-choice="light"]');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light',
    'Claro is back');

  head('E · guide level 3: Help lives inside Configuración');
  await page.click('[data-tab="help"]');
  await page.waitForTimeout(400);
  const helpText = await page.evaluate(() => document.querySelector('[data-panel="help"]').textContent);
  ok(/Respuestas rápidas/.test(helpText), 'Help opens the FAQ');
  ok(/Vocabulario de vibraciones/.test(helpText), 'Help documents the vibration vocabulary');
  ok(/Íconos y estados/.test(helpText), 'Help references every icon and status');
  ok(/Glosario/.test(helpText), 'Help includes the glossary');
  ok(await page.locator('#helpVocab .vocab__row').count() === 4,
    'the four-vibration table is there');
  ok(await page.locator('#helpVocab .vocab__play').count() === 4,
    'every pattern has a play button');
  await page.evaluate(() => { window.__vibe = []; });
  await page.click('#helpVocab [data-play="reminder"]');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__vibe.length) === 1,
    'the play button really plays the pattern');

  /* replay level 1 from Settings, Esc returns focus to the gear */
  await page.click('[data-tab="general"]');
  await page.waitForTimeout(200);
  await page.click('[data-replay]');
  await page.waitForTimeout(400);
  ok(await page.locator('#guideLayer .guide[aria-modal="true"]').count() === 1,
    '"Ver la guía otra vez" replays level 1');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.activeElement &&
    document.activeElement.id === 'settingsOpen'),
    'focus returns to the gear after the modal closes');

  /* Esc closes Settings and returns focus to the gear */
  await page.click('#settingsOpen');
  await page.waitForSelector('#settingsLayer .settings');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('settingsLayer').hidden) === true,
    'Esc closes Configuración');
  ok(await page.evaluate(() => document.activeElement &&
    document.activeElement.id === 'settingsOpen'),
    'focus returns to the gear after Settings closes');

  head('F · the watch has its own compact Ajustes');
  await page.evaluate(() => watch.go('home', 'zoom'));
  await page.waitForTimeout(400);
  ok(await page.locator('#screen [data-act="settings"]').count() === 1,
    'Home offers the Ajustes pill (crown-scrollable, side-button reachable)');
  await page.click('#screen [data-act="settings"]');
  await page.waitForTimeout(700);
  ok(await page.locator('#statusTitle').textContent() === 'Ajustes',
    'the watch screen is titled Ajustes');
  const watchLines = await page.evaluate(() =>
    document.getElementById('screen').innerText.split('\n').map((l) => l.trim()).filter(Boolean));
  const long = watchLines.filter((l) => l.split(/\s+/).length > 4);
  ok(long.length === 0, 'every line stays within ~4 words', long.join(' // '));
  const pillMin = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.set-watch__row')).minHeight);
  ok(parseFloat(pillMin) >= 56, 'Ajustes rows are 56px pills', pillMin);
  const adjText = watchLines.join(' | ');
  ok(/Idioma/.test(adjText) && /Tema/.test(adjText) && /IA/.test(adjText) &&
    /Guía/.test(adjText) && /Ayuda/.test(adjText),
    'Ajustes holds Idioma, Tema, IA, Guía and Ayuda', adjText);
  /* the watch writes the same stored language */
  await page.click('#screen [data-act="cfg-lang"]');
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.documentElement.lang) === 'en',
    'the watch toggles the shared language');
  await page.click('#screen [data-act="cfg-lang"]');
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.documentElement.lang) === 'es',
    'and back to Spanish');

  head('G · no English is visible on any Spanish screen');
  await page.evaluate(() => watch.go('home', 'zoom'));
  await page.waitForTimeout(400);
  let leaks = await englishVisible(page);
  ok(leaks.length === 0, 'stage: no English words', leaks.slice(0, 6).join(' // '));
  await page.evaluate(() => Settings.open('general'));
  await page.waitForTimeout(300);
  leaks = await englishVisible(page);
  ok(leaks.length === 0, 'Configuración: no English words', leaks.slice(0, 6).join(' // '));
  await page.evaluate(() => Settings.open('help'));
  await page.waitForTimeout(400);
  leaks = await englishVisible(page);
  ok(leaks.length === 0, 'Ayuda: no English words', leaks.slice(0, 6).join(' // '));
  await page.evaluate(() => Settings.close());
  await page.evaluate(() => watch.go('ajustes', 'zoom'));
  await page.waitForTimeout(600);
  leaks = await englishVisible(page);
  ok(leaks.length === 0, 'Ajustes: no English words', leaks.slice(0, 6).join(' // '));

  head('G2 · plurals are correct in Spanish');
  await page.evaluate(() => {
    Log.clear();
    Log.record('before-patient', 'done', false);
    Settings.open('general');
  });
  await page.waitForTimeout(300);
  ok(/1 evento, 24 h/.test(await page.evaluate(() =>
    document.querySelector('[data-panel="general"]').textContent)),
    'one event reads "1 evento, 24 h"');
  await page.evaluate(() => {
    Log.record('before-patient', 'done', false);
    Settings.paint();
  });
  await page.waitForTimeout(200);
  ok(/2 eventos, 24 h/.test(await page.evaluate(() =>
    document.querySelector('[data-panel="general"]').textContent)),
    'two events read "2 eventos, 24 h"');
  await page.evaluate(() => { Log.clear(); Settings.close(); });

  head('H · touch targets, contrast, reduced motion');
  await page.evaluate(() => Settings.open('general'));
  await page.waitForTimeout(650);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.settings__tab, .set__choice, .settings__close')]
      .filter((b) => b.getBoundingClientRect().height < 43.5)
      .map((b) => b.textContent.trim() || b.className));
  ok(small.length === 0, 'every Settings target is at least 44px', small.join(' // '));
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => window.__setTheme(t), theme);
    await page.waitForTimeout(400);
    const r1 = await contrast(page, '.settings__title');
    const r2 = await contrast(page, '.set__hint');
    ok(r1.ratio >= 4.5, 'settings title contrast ≥ 4.5:1 in ' + theme,
      r1.ratio ? r1.ratio.toFixed(2) : 'missing');
    ok(r2.ratio >= 4.5, 'settings hint contrast ≥ 4.5:1 in ' + theme,
      r2.ratio ? r2.ratio.toFixed(2) : 'missing');
  }
  await page.evaluate(() => window.__setTheme('light'));
  await page.evaluate(() => Settings.close());

  /* Intl numbers on the unit page, and the same Settings there */
  await page.evaluate(() => { I18N.set('es'); });
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  ok(await page.evaluate(() => localStorage.getItem('handwatch-lang')) === 'es',
    'language is persisted across reload');
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light',
    'theme is persisted across reload');

  const unit = await ctx.newPage();
  unit.on('pageerror', (e) => errors.push('unit: ' + e));
  await unit.goto(UNIT, { waitUntil: 'load' });
  await unit.waitForTimeout(2200);
  ok(await unit.locator('#settingsOpen[aria-label="Configuración"]').count() === 1,
    'unit.html also has the Configuración gear');
  ok(/1\.284 de 1\.362/.test(await unit.evaluate(() => document.body.innerText)),
    'unit numbers use Intl for Spanish');
  ok(/Brier 0,002/.test(await unit.evaluate(() => document.body.innerText)),
    'Spanish decimals use a comma');
  await unit.click('#settingsOpen');
  await unit.waitForTimeout(300);
  ok(await unit.locator('#settingsLayer .settings[aria-modal="true"]').count() === 1,
    'the unit panel opens Configuración');
  await unit.keyboard.press('Escape');

  /* reduced motion: the modal does not animate */
  const rmCtx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce'
  });
  const rm = await rmCtx.newPage();
  await rm.goto(INDEX, { waitUntil: 'load' });
  await rm.waitForSelector('#guideLayer .guide');
  ok(await rm.evaluate(() =>
    getComputedStyle(document.querySelector('.guide')).animationName) === 'none',
    'prefers-reduced-motion turns the modal animation off');
  await rmCtx.close();

  ok(errors.length === 0, 'zero console errors in the whole phase', errors.slice(0, 3).join(' // '));

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
