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

/* Language pickers are endonyms by design: "Español" and "English" are the
   same two labels in both UIs, so the scanners skip them. */
const ENDONYMS = ['Español', 'English'];

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
  }, EN_WORDS.source).then((list) => list.filter((t) => !ENDONYMS.includes(t.replace(/^@/, ''))));
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

  head('B · guide level 1: on the watch face, three glanceable cards');
  await page.waitForSelector('#guideLayer .guide[role="dialog"]', { timeout: 4000 });
  ok(await page.evaluate(() => {
    const g = document.getElementById('guideLayer');
    return !!g && g.closest('#screen') === document.getElementById('screen');
  }), 'level 1 renders inside the watch screen');
  ok(await page.locator('.guide-layer:not([hidden])').count() === 0 &&
    await page.locator('body > #guideLayer').count() === 0,
    'no desktop guide modal covers the watch');
  ok(await page.evaluate(() => {
    const scr = document.getElementById('screen').getBoundingClientRect();
    const pts = [[0.5, 0.5], [0.2, 0.25], [0.8, 0.25], [0.2, 0.8], [0.8, 0.8]];
    return pts.every(([x, y]) => {
      const el = document.elementFromPoint(scr.left + scr.width * x, scr.top + scr.height * y);
      return !!el && el.closest('#screen') === document.getElementById('screen');
    });
  }), 'the watch screen is not covered by any overlay during level 1');
  ok(await page.locator('#guideLayer .guide[aria-modal="true"]').count() === 1,
    'level 1 is a role=dialog with aria-modal');
  ok(await page.locator('#guideCaption').isVisible(),
    'the stage shows only a small caption next to the watch');
  ok((await page.locator('#guideCaption').textContent()).trim() ===
    'Guía en el reloj · 1 de 3', 'the caption reads "Guía en el reloj · 1 de 3"',
    (await page.locator('#guideCaption').textContent()).trim());
  ok(await page.evaluate(() => !document.getElementById('watch')
    .contains(document.getElementById('guideCaption'))),
    'the caption lives on the desk, outside the watch');
  ok(await page.locator('#guideLayer .guide__card').count() === 3, 'three welcome cards');
  ok(await page.locator('#guideLayer .guide__card:not([hidden])').count() === 1,
    'one card is shown at a time');
  ok(await page.locator('#guideLayer .guide__dot').count() === 3, 'three progress dots');
  ok(await page.locator('#guideLayer [data-guide-count]').count() === 1,
    'one counter, not two');
  ok((await page.locator('#guideLayer [data-guide-count]').textContent()).trim() === '1 de 3',
    'the single counter reads "1 de 3"');
  ok(!/\b1\s*\/\s*3\b/.test(await page.evaluate(() =>
    document.querySelector('#guideLayer .guide').innerText)),
    'no duplicate "1 / 3" counter at the top');
  const nextLabel = (await page.locator('[data-guide-next]').textContent()).trim();
  const backLabel = (await page.locator('[data-guide-back]').textContent()).trim();
  const skipLabel = (await page.locator('[data-guide-skip]').textContent()).trim();
  ok(nextLabel === 'Siguiente' && backLabel === 'Atrás' && skipLabel === 'Saltar',
    'buttons read Siguiente / Atrás / Saltar', [nextLabel, backLabel, skipLabel].join(' / '));
  ok(await page.evaluate(() => {
    const b = document.querySelector('[data-guide-next]');
    return parseFloat(getComputedStyle(b).minHeight) >= 56;
  }), 'the Siguiente pill is 56px tall');
  ok(await page.evaluate(() => {
    const b = document.querySelector('[data-guide-skip]');
    const r = b.getBoundingClientRect();
    return r.width > 0 && getComputedStyle(b).minHeight !== '0px';
  }), 'Saltar is reachable on the watch');
  ok(await page.locator('[data-guide-back]').isDisabled(),
    'Atrás is disabled on the first card');
  ok(await page.evaluate(() => {
    const box = document.querySelector('#guideLayer .guide');
    return box.contains(document.activeElement);
  }), 'focus starts inside the modal (trapped)');
  const card1 = await page.evaluate(() =>
    document.querySelector('#guideLayer .guide__card:not([hidden])').innerText);
  ok(/Te aviso con vibración/.test(card1), 'card 1: "Te aviso con vibración."', card1);

  await page.click('[data-guide-next]');
  await page.waitForTimeout(200);
  const card2 = await page.evaluate(() =>
    document.querySelector('#guideLayer .guide__card:not([hidden])').innerText);
  ok(/Si dudo, te pregunto/.test(card2), 'card 2: "Si dudo, te pregunto."', card2);
  ok((await page.locator('[data-guide-count]').textContent()).trim() === '2 de 3',
    'the counter advances to "2 de 3"');
  ok(await page.locator('[data-guide-back]').isEnabled(), 'Atrás wakes up on card 2');

  /* the crown (wheel) goes back; the caption follows */
  await page.hover('#crown');
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(250);
  ok((await page.locator('[data-guide-count]').textContent()).trim() === '1 de 3',
    'the crown goes back to the first card');
  ok((await page.locator('#guideCaption').textContent()).trim() ===
    'Guía en el reloj · 1 de 3', 'the caption follows the card');

  /* a swipe also moves between cards */
  const gbox = await page.locator('#guideLayer .guide').boundingBox();
  await page.mouse.move(gbox.x + gbox.width / 2, gbox.y + gbox.height * 0.72);
  await page.mouse.down();
  await page.mouse.move(gbox.x + gbox.width / 2, gbox.y + gbox.height * 0.28, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  ok((await page.locator('[data-guide-count]').textContent()).trim() === '2 de 3',
    'a vertical swipe advances a card');

  await page.click('[data-guide-next]');
  await page.waitForTimeout(200);
  const card3 = await page.evaluate(() =>
    document.querySelector('#guideLayer .guide__card:not([hidden])').innerText);
  ok(/Solo tú lo ves/.test(card3), 'card 3: "Solo tú lo ves."', card3);
  ok((await page.locator('[data-guide-next]').textContent()).trim() === 'Empezar',
    'the last card offers "Empezar"');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(await page.locator('#guideLayer').count() === 0, 'Esc closes level 1');
  ok(await page.evaluate(() => document.getElementById('guideCaption').hidden) === true,
    'the desk caption goes away with it');
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
  ok(await page.evaluate(() => Guide.TIPS.length >= 3), 'at least three key features get a tip');
  ok(await page.evaluate(() => Guide.TIPS.every((t) => !!document.querySelector(t.anchor))),
    'every tip is anchored to a real feature');
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
  ok((await page.locator('.settings__title').textContent()).trim() === 'Configuración',
    'the Settings title is Configuración');
  ok(await page.locator('#settingsLayer .settings__head .label').count() === 0,
    'the header has no duplicate CONFIGURACIÓN kicker');
  const setText = await page.evaluate(() => document.querySelector('.settings').textContent);
  ['Idioma', 'Tema', 'Inteligencia artificial', 'Privacidad', 'Guía'].forEach((w) => {
    ok(setText.indexOf(w) !== -1, 'Configuración includes ' + w);
  });
  ['Claro', 'Oscuro', 'Sistema'].forEach((w) => {
    ok(setText.indexOf(w) !== -1, 'theme option ' + w);
  });

  /* language names are endonyms in both UIs, each tagged with its lang */
  const langNames = await page.evaluate(() => [...document.querySelectorAll('#settingsLayer [data-lang]')]
    .map((b) => ({ v: b.getAttribute('data-lang'), t: b.textContent.trim(), l: b.getAttribute('lang') })));
  ok(JSON.stringify(langNames) === JSON.stringify([
    { v: 'es', t: 'Español', l: 'es' }, { v: 'en', t: 'English', l: 'en' }]),
    'Idioma reads Español / English with lang="es" / lang="en"', JSON.stringify(langNames));

  /* one AI control: the switch owns consent, one line explains the state */
  ok(await page.locator('[data-ai-toggle][role="switch"]').count() === 1,
    'AI has one on/off switch');
  ok((await page.locator('[data-ai-toggle] .set__switch-label').textContent()).trim() ===
    'Usar el modelo', 'the switch is labelled "Usar el modelo"');
  ok(await page.locator('[data-ai-grant]').count() === 0 &&
    await page.locator('[data-ai-revoke]').count() === 0,
    'the two separate consent buttons are gone');
  ok(await page.locator('[data-ai-status]').count() === 1,
    'AI has exactly one status line');
  ok((await page.locator('[data-ai-status]').textContent()).trim() ===
    'Encendido: te muestro qué se envía antes de cada consulta',
    'on reads "Encendido: te muestro qué se envía antes de cada consulta"',
    (await page.locator('[data-ai-status]').textContent()).trim());
  await page.click('[data-ai-toggle]');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector('[data-ai-toggle]')
    .getAttribute('aria-checked')) === 'false', 'clicking off turns the model off');
  ok((await page.locator('[data-ai-status]').textContent()).trim() ===
    'Apagado: responden las reglas del reloj',
    'off reads "Apagado: responden las reglas del reloj"',
    (await page.locator('[data-ai-status]').textContent()).trim());
  ok(await page.evaluate(() => AIPrefs.consentState()) === 'revoked',
    'turning the switch off revokes consent');
  await page.click('[data-ai-toggle]');
  await page.waitForTimeout(300);
  ok((await page.locator('[data-ai-status]').textContent()).trim() ===
    'Encendido: te muestro qué se envía antes de cada consulta',
    'clicking on explains what happens before each query');
  ok(await page.evaluate(() => AIPrefs.consentState()) === 'granted',
    'turning the switch on grants consent');
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
  const langNamesEn = await page.evaluate(() => [...document.querySelectorAll('#settingsLayer [data-lang]')]
    .map((b) => ({ v: b.getAttribute('data-lang'), t: b.textContent.trim(), l: b.getAttribute('lang') })));
  ok(JSON.stringify(langNamesEn) === JSON.stringify([
    { v: 'es', t: 'Español', l: 'es' }, { v: 'en', t: 'English', l: 'en' }]),
    'the endonyms stay Español / English in the English UI', JSON.stringify(langNamesEn));
  ok((await page.locator('[data-ai-status]').textContent()).trim() ===
    'On: I show you what is sent before each query',
    'the AI status line is English too',
    (await page.locator('[data-ai-status]').textContent()).trim());
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

  /* Esc closes Settings and returns focus to the gear. Retire the remaining
     coach marks first so a tip cannot steal focus mid-assertion. */
  await page.evaluate(() => {
    Guide.TIP_IDS.forEach((id) => Prefs.markTip(id));
    if (document.getElementById('guideTip')) Guide.closeTip(false);
  });
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

  /* walk there with the watch's own controls only: side button opens
     privacy, the crown scrolls, the Ajustes pill is a watch tap. No JS
     route and no desktop gear are used. */
  await page.click('#sideButton');
  await page.waitForTimeout(600);
  ok((await page.locator('#statusTitle').textContent()).trim() === 'Quién ve esto',
    'the side button opens the watch privacy screen');
  await page.hover('#crown');
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(300);
  const watchSettingsPill = page.locator('#screen [data-act="settings"]');
  ok(await watchSettingsPill.count() === 1,
    'the privacy screen reaches Ajustes from the watch itself');
  await watchSettingsPill.click();
  await page.waitForTimeout(700);
  ok(await page.locator('#statusTitle').textContent() === 'Ajustes',
    'the watch walks to Ajustes with crown / side button only');
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
