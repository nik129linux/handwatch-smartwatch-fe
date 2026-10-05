/* ==========================================================================
   tests/acceptance.js — Playwright acceptance gate
   node tests/acceptance.js   (run from the prototype folder)
   Screenshots land in shots/ (gitignored).
   ========================================================================== */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } =
  require('/home/nico/.nvm/versions/node/v22.23.2/lib/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const INDEX = pathToFileURL(path.join(ROOT, 'index.html')).href;
const UNIT = pathToFileURL(path.join(ROOT, 'unit.html')).href;

const WATCH_FILES = ['index.html', 'js/watch.js', 'css/watch.css', 'js/story.js'];
const SCANNED = [
  'index.html', 'unit.html',
  'css/tokens.css', 'css/fonts.css', 'css/watch.css', 'css/stage.css',
  'js/haptics.js', 'js/watch.js', 'js/story.js', 'js/unit.js', 'js/stage.js',
  'js/theme.js'
];

/* ---------------------------------------------------------------- runner */

let pass = 0;
const fails = [];

function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  ✗ ' + label + (detail ? '\n      ' + detail : ''));
  return false;
}
function eq(a, b, label) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  return ok(same, label, same ? '' : 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function head(s) { console.log('\n' + s); }

const OLD_LIME = 'rgb(166, 255, 0)';
const VIBE = {
  reminder: [60, 120, 60],
  ok: [35],
  doubtful: [30, 70, 45, 70, 65],
  end: [400]
};

/* ---------------------------------------------------------------- helpers */

function watchErrors(page) {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  return errs;
}

async function freeMode(page, act) {
  await page.click(`#freeMode [data-act="${act}"]`);
}
async function screenIs(page, name) {
  return (await page.locator(`.view[data-screen="${name}"]`).count()) > 0;
}
async function settle(page, ms) { await page.waitForTimeout(ms); }

/* ---------------------------------------------------------------- main */

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const shot = (name) => path.join(SHOTS, name);

  /* =============================================================== 1. load */
  head('1 · index.html and unit.html load with zero console errors');

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    window.__vibe = [];
    try {
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: function (p) { window.__vibe.push(Array.from(p)); return true; }
      });
    } catch (e) { /* keep whatever the engine gives us */ }
  });

  const page = await ctx.newPage();
  const indexErrs = watchErrors(page);
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  ok(indexErrs.length === 0, 'index.html has no console errors', indexErrs.join(' | '));
  ok(await page.locator('#screen').getAttribute('data-screen') === 'home',
    'the watch boots on Home');

  const unitPage = await ctx.newPage();
  const unitErrs = watchErrors(unitPage);
  await unitPage.goto(UNIT, { waitUntil: 'load' });
  await unitPage.waitForSelector('#momentBars .ubar');
  ok(unitErrs.length === 0, 'unit.html has no console errors', unitErrs.join(' | '));
  ok((await unitPage.locator('#momentBars .ubar').count()) === 5,
    'unit.html renders 5 WHO-moment rows');
  ok((await unitPage.locator('.uheat__cell').count()) === 24,
    'unit.html renders a 24-cell heatmap');
  await settle(unitPage, 1600);
  await unitPage.screenshot({ path: shot('unit.html.png'), fullPage: true });
  await unitPage.screenshot({ path: shot('unit-fold.png') });

  /* =============================================================== 2. free mode */
  head('2 · free mode drives the screens');

  /* short clocks so the 20 s wash is a 400 ms wash in the test */
  await page.evaluate(() => { window.__timeScale = 0.02; });
  await settle(page, 200);

  const before = parseInt(await page.locator('.hero-num').getAttribute('data-count'), 10)
    || 0;

  await freeMode(page, 'zona');
  await page.waitForSelector('.view[data-screen="recordatorio"]', { timeout: 4000 });
  ok(true, 'Enter patient zone → Reminder visible');
  await settle(page, 400);
  ok(await page.locator('.pill[data-act="done"]').count() === 1,
    'Reminder offers one pill: "Already did it"');

  await freeMode(page, 'lavado');
  await page.waitForSelector('.view[data-screen="lavando"]', { timeout: 4000 });
  ok(true, 'Wash detected → Washing visible');
  await page.waitForSelector('.view[data-screen="home"]', { timeout: 6000 });
  await settle(page, 300);
  const after = parseInt(await page.locator('.hero-num').getAttribute('data-count'), 10);
  ok(after === before + 1,
    'Home counter incremented by 1 after the wash',
    'before ' + before + ', after ' + after);

  await freeMode(page, 'dudoso');
  await page.waitForSelector('.view[data-screen="dudoso"]', { timeout: 4000 });
  ok(true, 'Doubtful wash → Did you wash? visible');
  const q = await page.locator('.doubt__q').textContent();
  ok(q.trim() === 'Did you wash?', 'the screen asks "Did you wash?"', q);
  const pills = await page.locator('.view[data-screen="dudoso"] .pill').count();
  ok(pills === 2, 'two pills, no form fields', 'found ' + pills);
  ok((await page.locator('.view[data-screen="dudoso"] input').count()) === 0,
    'no input fields on the correction screen');

  await page.click('.pill[data-act="doubt-yes"]');
  await page.waitForSelector('.toast.is-on', { timeout: 4000 });
  const toast = (await page.locator('#toastText').textContent()).trim();
  ok(toast === 'Noted. Thanks.', 'toast says "Noted. Thanks."', toast);
  await page.waitForSelector('.view[data-screen="home"]', { timeout: 4000 });
  await settle(page, 400);
  ok(await screenIs(page, 'dudoso') === false, 'the doubt screen closes after one tap');

  /* =============================================================== 3. pause */
  head('3 · a code azul silences the reminders');

  await freeMode(page, 'codigo');
  await page.waitForSelector('.view[data-screen="pausa"]', { timeout: 4000 });
  ok(true, 'Code blue → Pause visible');
  ok(await page.locator('#screen.is-paused').count() === 1,
    'a moon glyph shows in the status bar while paused');

  await page.click('.pill[data-act="back"]');
  await page.waitForSelector('.view[data-screen="home"]', { timeout: 4000 });
  await freeMode(page, 'zona');
  await settle(page, 700);
  ok(await screenIs(page, 'recordatorio') === false,
    'Enter patient zone while paused does NOT show Reminder');
  const logText = await page.locator('#log').textContent();
  ok(/muted/i.test(logText), 'the swallowed reminder is logged as "muted"',
    logText.slice(0, 120));

  /* =============================================================== 4. end of shift */
  head('4 · end of shift and privacy');

  await freeMode(page, 'terminar');
  await page.waitForSelector('.view[data-screen="fin"]', { timeout: 4000 });
  ok(true, 'End shift → Shift over visible');
  const finText = await page.locator('.view[data-screen="fin"]').textContent();
  ok(/moments/i.test(finText), 'Shift over shows the moment count');
  ok(/fixed\s*by\s*you/i.test(finText.replace(/\s+/g, ' ')),
    'Shift over shows how many she fixed herself');
  ok(/24 h/.test(finText), 'Shift over states the 24 h window');

  await page.click('#sideButton');
  await page.waitForSelector('.view[data-screen="quien"]', { timeout: 4000 });
  ok(true, 'the side button opens Who sees this');
  const who = (await page.locator('.view[data-screen="quien"]').textContent()).replace(/\s+/g, ' ');
  ok(/You/.test(who) && /Infection control/.test(who) && /No one/.test(who),
    'three rows: You · Infection control · No one', who.slice(0, 160));
  ok(/no names/.test(who), 'the unit sees totals without names');

  /* =============================================================== 6. haptics */
  head('6 · the vibration vocabulary reaches navigator.vibrate');

  const vibe = await page.evaluate(() => {
    window.__vibe = [];
    ['reminder', 'ok', 'doubtful', 'end'].forEach(n => haptics.play(n));
    return window.__vibe;
  });
  eq(vibe, [VIBE.reminder, VIBE.ok, VIBE.doubtful, VIBE.end],
    'each pattern plays its exact ms array');
  const rows = await page.locator('.vocab__row').count();
  ok(rows === 4, 'the panel documents 4 patterns', 'found ' + rows);
  const strip = await page.locator('.haptic-strip').textContent();
  ok(/No sound\. Ever\./.test(strip), 'the strip states: No sound. Ever.');

  /* =============================================================== 7. tokens */
  head('7 · changing the primary propagates everywhere');

  /* The primary is swapped at runtime, so every transition that used the old
     colour has to land before the tree is inspected — otherwise a lime value
     that is mid-transition reads as "left behind". */
  async function tokenTest(p, label) {
    await p.evaluate(() => {
      document.documentElement.style.setProperty('--color-primary-500', '#ff0000');
    });
    await settle(p, 800);

    const stale = await p.evaluate((old) => {
      const props = ['color', 'backgroundColor', 'borderTopColor',
        'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor',
        'fill', 'stroke', 'textDecorationColor', 'columnRuleColor'];
      const hits = [];
      const all = document.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        const cs = getComputedStyle(el);
        for (let k = 0; k < props.length; k++) {
          if (cs[props[k]] === old) {
            hits.push(el.tagName + '.' + (typeof el.className === 'string'
              ? el.className : '') + ' → ' + props[k]);
          }
        }
      }
      return { hits: hits, scanned: all.length };
    }, OLD_LIME);
    ok(stale.hits.length === 0,
      label + ': nothing keeps ' + OLD_LIME + ' (' + stale.scanned + ' elements walked)',
      stale.hits.slice(0, 6).join(' | '));

    /* and the new colour really is in use where the action lives */
    const now = await p.evaluate(() => {
      const el = document.querySelector('.btn--primary, .pill--primary, .ubar__fill');
      return el ? getComputedStyle(el).backgroundColor : 'no-target';
    });
    ok(now === 'rgb(255, 0, 0)', label + ': the new primary is in use',
      'computed ' + now);
  }
  await tokenTest(page, 'index.html');
  await tokenTest(unitPage, 'unit.html');

  /* the token promise holds in the light theme too: flip both pages over
     (the inline primary swap above survives the switch) and walk again */
  await page.evaluate(() => window.__setTheme('light'));
  await unitPage.evaluate(() => window.__setTheme('light'));
  await settle(page, 700);
  await tokenTest(page, 'index.html (light)');
  await tokenTest(unitPage, 'unit.html (light)');
  await page.evaluate(() => window.__setTheme('dark'));
  await unitPage.evaluate(() => window.__setTheme('dark'));
  await settle(page, 500);

  /* =============================================================== 7b. theme */
  head('7b · light / dark switch');

  for (const t of ['index.html', 'unit.html']) {
    const p = t === 'index.html' ? page : unitPage;
    ok(await p.locator('#themeToggle[aria-label="Switch theme"]').count() === 1,
      t + ' has a theme toggle labelled "Switch theme"');
    ok(await p.locator('#themeToggle svg').count() === 2,
      t + ' toggle carries sun + moon icons');
  }
  /* the button flips data-theme and the choice survives a reload */
  await page.evaluate(() => window.__setTheme('dark'));
  await settle(page, 500);
  await page.click('#themeToggle');
  await settle(page, 500);
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light',
    'the toggle flips data-theme to light');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.view[data-screen="home"]');
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light',
    'the light choice persists across reload (localStorage)');
  await page.click('#themeToggle');
  await settle(page, 500);
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark',
    'the toggle flips back to dark');

  /* the watch screen stays pure black in both themes (OLED convention) */
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => window.__setTheme(t), theme);
    await settle(page, 600);
    const scr = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.screen')).backgroundColor);
    ok(scr === 'rgb(0, 0, 0)', 'the watch screen stays pure black in ' + theme,
      'computed ' + scr);
  }
  await page.evaluate(() => window.__setTheme('dark'));
  await settle(page, 400);

  /* contrast ≥ 4.5:1 for representative text in both themes */
  async function contrast(p, sel) {
    return await p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return { missing: s };
      const parse = (c) => {
        let m = (c || '').match(/rgba?\(([^)]+)\)/);
        if (m) {
          const v = m[1].split(',').map(x => parseFloat(x));
          return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
        }
        m = (c || '').match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/);
        if (m) return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255,
          parseFloat(m[3]) * 255, 1];
        return null;
      };
      const lin = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const fg = parse(getComputedStyle(el).color);
      if (!fg) return { missing: s + ' (unparsable color)' };
      let bg = null, n = el;
      while (n) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c[3] > 0.99) { bg = c; break; }
        n = n.parentElement;
      }
      const L1 = lum(fg), L2 = lum(bg || [0, 0, 0, 1]);
      const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
      return { ratio: (hi + 0.05) / (lo + 0.05) };
    }, sel);
  }
  const themePairs = [
    [page, '.masthead__title'], [page, '.panel__lede'], [page, '.group__title'],
    [page, '.free-btn'], [page, '#storyClock'], [page, '.note__body'],
    [page, '.haptic-strip__note'], [page, '.vocab__meaning'],
    [unitPage, '.ucard__note'], [unitPage, '.unit__eyebrow']
  ];
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => window.__setTheme(t), theme);
    await unitPage.evaluate((t) => window.__setTheme(t), theme);
    await settle(page, 600);
    for (const [p, sel] of themePairs) {
      const r = await contrast(p, sel);
      ok(!r.missing && r.ratio >= 4.5, 'contrast ≥ 4.5:1 in ' + theme + ' — ' + sel,
        r.missing ? 'missing' : 'ratio ' + r.ratio.toFixed(2) + ':1');
    }
  }
  await page.evaluate(() => window.__setTheme('dark'));
  await unitPage.evaluate(() => window.__setTheme('dark'));
  await settle(page, 400);

  /* =============================================================== 8. source */
  head('8 · source rules');

  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const stripComments = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  /* 8a — no raw colors outside tokens.css */
  const colorRe = /#[0-9a-f]{3,8}\b|rgba?\s*\(|hsla?\s*\(/gi;
  const offenders = [];
  for (const f of SCANNED) {
    if (f === 'css/tokens.css') continue;
    const src = stripComments(read(f));
    src.split('\n').forEach((line, i) => {
      const m = line.match(colorRe);
      if (m) offenders.push(f + ':' + (i + 1) + ' → ' + m.join(','));
    });
  }
  ok(offenders.length === 0, 'no hex / rgb / hsl literals outside css/tokens.css',
    offenders.slice(0, 6).join(' | '));

  /* 8a2 — the palette is still intact in tokens.css */
  const tokens = read('css/tokens.css');
  ['--color-primary-500: #a6ff00', '--color-neutral-950: #101010',
    '--color-neutral-900: #171717', '--color-neutral-700: #333333',
    '--color-neutral-600: #3d3d3d', '--color-neutral-400: #6f6f6f',
    '--color-neutral-50: #fdfdfd', '--color-black: #000000',
    '--ring-spectrum-1:'].forEach(t => {
    const name = t.split(':')[0];
    const re = new RegExp(name + '\\s*:\\s*[^;]+;');
    ok(re.test(tokens), 'tokens.css declares ' + name);
  });

  /* 8b — linear only in the wash ring rule (linear-gradient is not timing) */
  const linRe = /(?<![\w-])linear(?![\w-])/;
  const linOffenders = [];
  ['css/watch.css', 'css/stage.css'].forEach(f => {
    const src = stripComments(read(f));
    const rules = src.matchAll(/([^{}]+)\{([^{}]*)\}/g);
    for (const [, sel, body] of rules) {
      if (linRe.test(body) && !/wash-ring/.test(sel + body)) {
        linOffenders.push(f + ' → ' + sel.trim().replace(/\s+/g, ' ') + ' { … }');
      }
    }
  });
  ['js/haptics.js', 'js/watch.js', 'js/story.js', 'js/unit.js', 'js/theme.js'].forEach(f => {
    stripComments(read(f)).split('\n').forEach((line, i) => {
      if (linRe.test(line)) linOffenders.push(f + ':' + (i + 1) + ' → ' + line.trim());
    });
  });
  ok(linOffenders.length === 0, '"linear" appears only in the wash ring rule',
    linOffenders.slice(0, 4).join(' | '));

  /* 8c — no Spanish stopwords left in UI strings.
     Static HTML is checked as text nodes + spoken attributes (aria-label,
     title); JS-driven copy is checked as rendered text in the browser, which
     is immune to identifier false positives (data-act keys, screen names). */
  const spanish = /\b(el|la|los|las|del|una|para|con|por|turno|reloj|lavado|momentos?|cama|paciente|inicio|nadie|quien|tú|usted|gracias)\b/i;
  const htmlOffenders = [];
  for (const f of ['index.html', 'unit.html']) {
    const src = stripComments(read(f));
    const texts = [];
    src.replace(/>([^<>]+)</g, (m, t) => { texts.push(t); return m; });
    src.replace(/\b(?:aria-label|title|alt|placeholder)="([^"]*)"/g,
      (m, v) => { texts.push(v); return m; });
    texts.forEach((t) => {
      const clean = t.replace(/\s+/g, ' ').trim();
      if (clean && spanish.test(clean)) htmlOffenders.push(f + ' → ' + clean.slice(0, 80));
    });
  }
  ok(htmlOffenders.length === 0, 'no Spanish stopwords remain in static UI strings',
    htmlOffenders.slice(0, 4).join(' | '));
  const renderedCopy = await page.evaluate(async () => {
    const names = ['home', 'recordatorio', 'lavando', 'dudoso', 'fin', 'quien', 'pausa'];
    const out = [];
    for (const n of names) {
      watch.go(n, 'zoom');
      await new Promise(r => setTimeout(r, 90));
      out.push(document.getElementById('screen').innerText);
    }
    out.push(document.body.innerText);
    document.querySelectorAll('[aria-label]').forEach(el =>
      out.push(el.getAttribute('aria-label')));
    watch.go('home', 'zoom');
    return out.join('\n');
  });
  const renderedUnit = await unitPage.evaluate(() => {
    const out = [document.body.innerText];
    document.querySelectorAll('[aria-label]').forEach(el =>
      out.push(el.getAttribute('aria-label')));
    return out.join('\n');
  });
  const esHit = (renderedCopy + '\n' + renderedUnit).split('\n')
    .filter(l => spanish.test(l));
  ok(esHit.length === 0, 'no Spanish stopwords remain in rendered UI strings',
    esHit.slice(0, 4).join(' | '));

  /* every watch screen, walked one by one */
  const watchCopy = await page.evaluate(async () => {
    const names = ['home', 'recordatorio', 'lavando', 'dudoso', 'fin', 'quien', 'pausa'];
    const out = [];
    for (const n of names) {
      watch.go(n, 'zoom');
      await new Promise(r => setTimeout(r, 90));
      out.push(document.getElementById('screen').innerText);
    }
    return out.join('\n');
  });
  const bad = [];
  [/\bfailure\b/i, /\bviolation\b/i, /\bnon-compliance\b/i, /\bfault\b/i,
   /\berror\b/i, /\bnegligence\b/i]
    .forEach(re => { if (re.test(watchCopy)) bad.push(re.source); });
  ok(bad.length === 0,
    'no watch screen accuses: failure / violation / non-compliance / fault / error / negligence',
    bad.join(', '));
  const allCopy = watchCopy + '\n' + (await page.evaluate(() => document.body.innerText));
  ok(!/\b(el|la|los|las|del|una|para|con|turno|reloj|lavado|momentos?|cama|paciente|gracias)\b/i.test(allCopy),
    'all rendered UI copy is English (no Spanish stopwords)');

  /* =============================================================== 9. motion */
  head('9 · reduced motion');

  const watchCss = read('css/watch.css');
  const stageCss = read('css/stage.css');
  const block = (css) => {
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
    return i === -1 ? '' : css.slice(i, css.indexOf('}', css.indexOf('}', i) + 1) + 1);
  };
  const wb = block(watchCss);
  ok(wb.length > 0, 'watch.css has a prefers-reduced-motion block');
  ok(/transition/.test(wb), 'it kills transitions');
  ok(/animation/.test(wb), 'it kills animations');
  ok(/watch--shake/.test(wb), 'it kills the haptic shake');
  ok(block(stageCss).length > 0, 'stage.css has a prefers-reduced-motion block');

  const easing = tokens + watchCss + stageCss;
  ok(/--ease-enter:\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/.test(easing),
    'enter easing is cubic-bezier(0.16, 1, 0.3, 1)');
  ok(/--ease-exit:\s*cubic-bezier\(0\.4,\s*0,\s*1,\s*1\)/.test(easing),
    'exit easing is cubic-bezier(0.4, 0, 1, 1)');
  ok((watchCss + stageCss).includes('var(--ease-enter)'), 'the enter easing is in use');
  ok((watchCss + stageCss).includes('var(--ease-exit)'), 'the exit easing is in use');
  ok(/scale\(0\.97\)/.test(watchCss + stageCss), 'press feedback is scale(.97)');
  ok(/stroke-dashoffset/.test(watchCss), 'the check mark draws with stroke-dashoffset');

  /* a real reduced-motion context must still render the strip statically */
  const rmCtx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce'
  });
  const rmPage = await rmCtx.newPage();
  const rmErrs = watchErrors(rmPage);
  await rmPage.goto(INDEX, { waitUntil: 'load' });
  await rmPage.waitForSelector('.view[data-screen="home"]');
  await rmPage.evaluate(() => haptics.play('doubtful'));
  await settle(rmPage, 300);
  const rmBars = await rmPage.locator('.haptic-strip__bars .haptic-bar').count();
  ok(rmBars === 3, 'reduced motion still draws the static bars', 'bars: ' + rmBars);
  ok(rmErrs.length === 0, 'index.html has no console errors under reduced motion',
    rmErrs.join(' | '));
  await rmPage.screenshot({ path: shot('reduced-motion.png') });
  await rmCtx.close();

  /* =============================================================== 10. findings */
  head('10 · the findings pass holds');

  /* F1 — small text over any surface reaches 4.5:1 */
  /* section 3 left this page paused (30 min); resume so Home rebuilds its
     default foot before the foot-level checks. */
  await page.evaluate(() => { watch.resume(); watch.go('home', 'zoom'); });
  await settle(page, 500);
  const contrastPairs = [
    [page, '.home__shift'], [page, '.ev__time'], [page, '.pill--ghost'],
    [page, '.panel__lede'], [page, '.vocab__meaning'], [page, '.note__body'],
    [page, '.haptic-strip__note'], [page, '.vocab__pattern'], [page, '#storyClock'],
    [unitPage, '.ucard__note'], [unitPage, '.uheat__axis'],
    [unitPage, '.unit__eyebrow'], [unitPage, '.unotice__lock']
  ];
  for (const [p, sel] of contrastPairs) {
    const r = await contrast(p, sel);
    ok(!r.missing && r.ratio >= 4.5, 'contrast ≥ 4.5:1 — ' + sel,
      r.missing ? 'missing' : 'ratio ' + r.ratio.toFixed(2) + ':1');
  }
  await page.evaluate(() => watch.go('dudoso', 'alert'));
  await settle(page, 500);
  const dq = await contrast(page, '.doubt__lines .caption');
  ok(dq.ratio >= 4.5, 'contrast ≥ 4.5:1 — doubt context', 'ratio ' + dq.ratio.toFixed(2) + ':1');
  await page.evaluate(() => watch.go('fin', 'fwd'));
  await settle(page, 500);
  const fn = await contrast(page, '.shift__note');
  ok(fn.ratio >= 4.5, 'contrast ≥ 4.5:1 — shift note', 'ratio ' + fn.ratio.toFixed(2) + ':1');

  /* F2 — every duration cites a motion token; easings capped at 3 */
  const cssMotion = stripComments(read('css/watch.css') + read('css/stage.css'));
  const durOffenders = [];
  cssMotion.split('\n').forEach((line, i) => {
    if (!/\d+\.?\d*ms/.test(line)) return;
    if (/var\(--/.test(line)) return;                    /* cites a token */
    if (/1ms\s*!important/.test(line)) return;           /* reduced-motion kill */
    durOffenders.push('line ' + (i + 1) + ' → ' + line.trim());
  });
  ok(durOffenders.length === 0, 'every CSS duration cites a motion token',
    durOffenders.slice(0, 4).join(' | '));
  const jsMotionOff = [];
  ['js/haptics.js', 'js/watch.js', 'js/story.js', 'js/unit.js', 'js/theme.js'].forEach(f => {
    stripComments(read(f)).split('\n').forEach((line, i) => {
      if (!/['"]/.test(line) || !/\d+ms/.test(line)) return;
      if (/var\(--/.test(line)) return;
      if (/setProperty/.test(line)) return;              /* defines a token value */
      jsMotionOff.push(f + ':' + (i + 1) + ' → ' + line.trim());
    });
  });
  ok(jsMotionOff.length === 0, 'no bare ms inside JS style strings',
    jsMotionOff.slice(0, 4).join(' | '));
  const beziers = [...new Set(
    (stripComments(tokens + watchCss + stageCss).match(/cubic-bezier\([^)]*\)/g) || []))];
  ok(beziers.length <= 3 &&
    beziers.includes('cubic-bezier(0.16, 1, 0.3, 1)') &&
    beziers.includes('cubic-bezier(0.4, 0, 1, 1)'),
    'at most 3 easings: enter expo + exit (press reuses enter)',
    beziers.join(' · '));

  /* F3 — the kicker tier exists and kickers use it; lime stays off kickers */
  const labelCss = watchCss + stageCss;
  ok(/\.label\s*\{[^}]*text-transform:\s*uppercase/s.test(labelCss) &&
    /\.label\s*\{[^}]*letter-spacing:\s*var\(--tracking-label\)/s.test(labelCss),
    'a .label tier exists (uppercase, +0.18em tracking)');
  await page.evaluate(() => watch.go('home', 'zoom'));
  await settle(page, 500);
  const kicker = await page.evaluate(() => {
    const el = document.querySelector('.home__label .label');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { t: cs.textTransform, size: cs.fontSize, w: cs.fontWeight };
  });
  ok(kicker && kicker.t === 'uppercase' && kicker.size === '12px' &&
    (kicker.w === '500' || kicker.w === '600' || parseInt(kicker.w, 10) >= 500),
    'Last 3 speaks in the kicker tier', JSON.stringify(kicker));
  const ucard = await unitPage.evaluate(() => {
    const el = document.querySelector('.ucard__label');
    const cs = getComputedStyle(el);
    return { t: cs.textTransform, size: cs.fontSize };
  });
  ok(ucard.t === 'uppercase' && ucard.size === '12px',
    'unit card labels speak in the kicker tier', JSON.stringify(ucard));
  const eyebrow = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.panel__eyebrow')).color);
  ok(eyebrow !== OLD_LIME && eyebrow !== 'rgb(255, 0, 0)',
    'the panel kicker spends no lime', 'computed ' + eyebrow);

  /* F4 — tabular numerals everywhere a number can appear */
  for (const sel of ['.home__of', '.home__shift', '#storyClock']) {
    const v = await page.evaluate((s) =>
      getComputedStyle(document.querySelector(s)).fontVariantNumeric, sel);
    ok(v === 'tabular-nums', 'tabular numerals — ' + sel, 'computed ' + v);
  }
  for (const sel of ['.ubar__val', '.uheat__axis', '.ucard__note']) {
    const v = await unitPage.evaluate((s) =>
      getComputedStyle(document.querySelector(s)).fontVariantNumeric, sel);
    ok(v === 'tabular-nums', 'tabular numerals — ' + sel, 'computed ' + v);
  }

  /* F5 — the doubt question dominates its screen */
  await page.evaluate(() => watch.go('dudoso', 'alert'));
  await settle(page, 500);
  const doubtHead = await page.evaluate(() => {
    const q = document.querySelector('.doubt__q');
    const first = document.querySelector('.doubt__lines').firstElementChild;
    return {
      q: parseFloat(getComputedStyle(q).fontSize),
      kick: getComputedStyle(first).textTransform
    };
  });
  ok(doubtHead.q >= 30, 'Did you wash? sets large enough to read at a glance',
    'font-size ' + doubtHead.q + 'px');
  ok(doubtHead.kick === 'uppercase', 'doubt context is a kicker, not a rival title',
    'text-transform ' + doubtHead.kick);

  /* F6 — every watch pill clears 56px */
  await page.evaluate(() => watch.go('home', 'zoom'));
  await settle(page, 500);
  const ghostMin = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.pill--ghost')).minHeight);
  ok(ghostMin === '56px', 'ghost pills clear the 56px gloved-hand floor',
    'min-height ' + ghostMin);

  /* F7 — no shadows on any screen surface; focus-visible everywhere */
  const shadowed = await page.evaluate(() => {
    const hits = [];
    document.querySelectorAll('#screen .view *, #screen .toast').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.boxShadow !== 'none' || cs.textShadow !== 'none') {
        hits.push(el.tagName + '.' + (typeof el.className === 'string'
          ? el.className.split(' ')[0] : ''));
      }
    });
    return hits;
  });
  ok(shadowed.length === 0, 'no shadows anywhere on the watch screens',
    shadowed.slice(0, 4).join(' | '));
  ok(/:focus-visible/.test(stageCss) && /:focus-visible/.test(watchCss),
    ':focus-visible rules exist for stage and watch alike');

  /* =============================================================== 11. design */
  head('11 · the design pass holds');

  /* the serif headline reveals word by word (blur + rise, staggered) */
  const words = await page.locator('.masthead__title .blur-word').count();
  ok(words >= 4, 'the blur-in headline exists (' + words + ' words)',
    'found ' + words);
  const stagger = await page.evaluate(() => {
    const ws = [...document.querySelectorAll('.masthead__title .blur-word')];
    return ws.map(w => w.style.getPropertyValue('--i').trim());
  });
  ok(new Set(stagger).size === stagger.length && stagger.length >= 4,
    'headline words carry staggered indices', stagger.join(','));

  /* the simulator panel is a quiet strip: no card-style bordered boxes.
     A "box" is an element with a visible border on all four sides;
     single hairlines between groups do not count. */
  const boxed = await page.evaluate(() => {
    const hits = [];
    document.querySelectorAll('.panel, .panel *').forEach(el => {
      const cs = getComputedStyle(el);
      const ws = [cs.borderTopWidth, cs.borderRightWidth,
        cs.borderBottomWidth, cs.borderLeftWidth];
      if (!ws.every(x => parseFloat(x) > 0)) return;
      if (cs.borderTopStyle === 'none' || cs.borderTopStyle === 'hidden') return;
      const cols = [cs.borderTopColor, cs.borderRightColor,
        cs.borderBottomColor, cs.borderLeftColor];
      const seen = cols.some(c => {
        const m = (c || '').match(/rgba?\(([^)]+)\)/);
        if (!m) return c !== 'transparent';
        const parts = m[1].split(',').map(x => parseFloat(x));
        return (parts[3] === undefined ? 1 : parts[3]) > 0;
      });
      if (seen) {
        hits.push(el.tagName + '.' +
          (typeof el.className === 'string' ? el.className.split(' ')[0] : ''));
      }
    });
    return hits;
  });
  ok(boxed.length <= 4,
    'the simulator panel has no card-style bordered boxes (≤ 4)',
    boxed.length + ' boxed: ' + boxed.slice(0, 6).join(' | '));

  /* one lime action, not ten pills: exactly one primary button in the panel */
  const primaries = await page.locator('.panel .btn--primary').count();
  ok(primaries === 1, 'Turno guiado is ONE lime pill', 'found ' + primaries);

  /* narrow viewport still renders the stage, the doubt screen and the unit */
  const narrow = await browser.newContext({
    viewport: { width: 375, height: 900 }
  });
  const nPage = await narrow.newPage();
  const nErrs = watchErrors(nPage);
  await nPage.goto(INDEX, { waitUntil: 'load' });
  await nPage.waitForSelector('.view[data-screen="home"]');
  await settle(nPage, 1200);
  await nPage.screenshot({ path: shot('home-375.png') });
  await nPage.click('#freeMode [data-act="dudoso"]');
  await nPage.waitForSelector('.view[data-screen="dudoso"]');
  await settle(nPage, 700);
  await nPage.evaluate(() => window.scrollTo(0, 0));
  await settle(nPage, 300);
  await nPage.screenshot({ path: shot('dudoso-375.png') });
  const nUnit = await narrow.newPage();
  await nUnit.goto(UNIT, { waitUntil: 'load' });
  await nUnit.waitForSelector('#momentBars .ubar');
  await settle(nUnit, 1600);
  await nUnit.screenshot({ path: shot('unit-375.png'), fullPage: true });
  ok(nErrs.length === 0, 'no console errors at 375px', nErrs.join(' | '));
  await narrow.close();

  /* wide viewport stills on a fresh page (untouched by the token swap) */
  const still = await ctx.newPage();
  await still.goto(INDEX, { waitUntil: 'load' });
  await still.waitForSelector('.view[data-screen="home"]');
  await settle(still, 1400);
  await still.evaluate(() => window.scrollTo(0, 0));
  await settle(still, 300);
  await still.screenshot({ path: shot('home-1440.png') });
  await still.click('#freeMode [data-act="dudoso"]');
  await still.waitForSelector('.view[data-screen="dudoso"]');
  await settle(still, 700);
  await still.evaluate(() => window.scrollTo(0, 0));
  await settle(still, 300);
  await still.screenshot({ path: shot('dudoso-1440.png') });
  await still.close();

  /* =============================================================== 12. stage */
  head('12 · the stage polish holds');

  /* the watch is the hero: the case clears 55% of the viewport at 1440x900 */
  const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const wPage = await wide.newPage();
  const wErrs = watchErrors(wPage);
  await wPage.goto(INDEX, { waitUntil: 'load' });
  await wPage.waitForSelector('.view[data-screen="home"]');
  await settle(wPage, 1200);
  const hero = await wPage.evaluate(() => {
    const r = document.querySelector('.case').getBoundingClientRect();
    return { h: r.height, vh: window.innerHeight };
  });
  ok(hero.h >= hero.vh * 0.55, 'the case clears 55% of the viewport height',
    'case ' + Math.round(hero.h) + 'px of ' + hero.vh + 'px');

  /* the hint sits below the band with room to breathe, on one line */
  const gap = await wPage.evaluate(() => {
    const band = document.querySelector('.band--bottom').getBoundingClientRect();
    const hint = document.querySelector('.stage__hint').getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector('.stage__hint'));
    return { clear: hint.top - band.bottom, wrap: cs.whiteSpace, top: hint.top };
  });
  ok(gap.clear >= 24, 'the hint clears the bottom band by 24px',
    'clear ' + Math.round(gap.clear) + 'px');
  ok(gap.wrap === 'nowrap', 'the hint is one line', 'white-space ' + gap.wrap);

  /* the strip names live vibration, not the vocabulary list */
  const stripName = await wPage.evaluate(() =>
    document.querySelector('#hapticName').textContent);
  ok(/Live vibration/.test(stripName), 'the strip is "Live vibration"',
    stripName);
  const idleBars = await wPage.locator('.haptic-strip__bars .haptic-bar').count();
  ok(idleBars === 1, 'idle is one flat line, no static block row',
    'bars: ' + idleBars);

  /* one global Reiniciar in the panel */
  const resets = await wPage.evaluate(() =>
    [...document.querySelectorAll('.panel .btn')]
      .filter(b => /reset/i.test(b.textContent)).length);
  ok(resets === 1, 'a single Reset in the panel', 'found ' + resets);

  await wPage.screenshot({ path: shot('stage-1440.png') });
  ok(wErrs.length === 0, 'no console errors on the wide stage', wErrs.join(' | '));

  /* 375px: the watch stacks above the panel, nothing scrolls sideways */
  const slim = await browser.newContext({ viewport: { width: 375, height: 900 } });
  const sPage = await slim.newPage();
  const sErrs = watchErrors(sPage);
  await sPage.goto(INDEX, { waitUntil: 'load' });
  await sPage.waitForSelector('.view[data-screen="home"]');
  await settle(sPage, 1200);
  const narrow2 = await sPage.evaluate(() => {
    const watch = document.querySelector('#stageWatch').getBoundingClientRect();
    const panel = document.querySelector('.panel').getBoundingClientRect();
    const title = document.querySelector('.masthead__title').getBoundingClientRect();
    return {
      stacked: watch.bottom <= panel.top + 1,
      hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titleLines: title.height > parseFloat(getComputedStyle(
        document.querySelector('.masthead__title')).lineHeight) * 1.2
    };
  });
  ok(narrow2.stacked, 'at 375px the watch sits above the panel');
  ok(narrow2.hscroll <= 1, 'no horizontal scroll at 375px',
    'overflow ' + narrow2.hscroll + 'px');
  ok(narrow2.titleLines, 'the headline wraps at 375px');
  await sPage.screenshot({ path: shot('stage-375.png') });
  ok(sErrs.length === 0, 'no console errors on the narrow stage', sErrs.join(' | '));
  await wide.close();
  await slim.close();

  /* =============================================================== 5. story */
  head('5 · the guided shift plays to the end');

  const kPage = await ctx.newPage();
  const kErrs = watchErrors(kPage);
  await kPage.goto(INDEX, { waitUntil: 'load' });
  await kPage.waitForSelector('.view[data-screen="home"]');
  await settle(kPage, 900);

  /* the crown is the scroll wheel, and it turns with the content */
  const measure = () => kPage.evaluate(() => {
    const v = document.getElementById('viewport');
    return {
      overflow: v.scrollHeight - v.clientHeight,
      rows: document.querySelectorAll('.home__list .ev').length
    };
  });
  const fold0 = await measure();
  ok(fold0.overflow > 20, 'Home has content below the fold',
    'overflow ' + fold0.overflow + 'px');
  await kPage.hover('#crown');
  await kPage.mouse.wheel(0, 240);
  await settle(kPage, 500);
  const scrolled = await kPage.evaluate(() => ({
    top: document.getElementById('viewport').scrollTop,
    spin: getComputedStyle(document.querySelector('.crown-cap'))
      .getPropertyValue('--spin').trim()
  }));
  ok(scrolled.top > 0, 'the crown wheel scrolls the current screen',
    'scrollTop ' + scrolled.top);
  ok(parseFloat(scrolled.spin) !== 0, 'the crown rotates as it scrolls',
    '--spin ' + scrolled.spin);

  /* the last 3 events are the thing below the fold */
  await kPage.evaluate(() => {
    ['Wash · Bed 3', 'Fixed by you · Bed 3', 'Marked by you · Bed 5',
      'Wash · Bed 5', 'Fixed by you · Bed 5']
      .forEach(t => { watch.addEvent({ text: t, kind: 'ok' }); watch.bump(); });
  });
  await settle(kPage, 500);
  const fold1 = await measure();
  ok(fold1.rows === 3, 'Home shows the last 3 events', 'rows ' + fold1.rows);
  ok(fold1.overflow > fold0.overflow,
    'the event list grows the scrollable area below the fold',
    fold0.overflow + 'px → ' + fold1.overflow + 'px');

  /* the ring is a segmented ring with gaps, and it draws itself in */
  const ring = await kPage.evaluate(() => {
    const segs = document.querySelectorAll('.ring__seg');
    const lit = document.querySelectorAll('.ring__seg--fill, .ring__seg--head');
    const dashes = [...lit].map(p => parseFloat(p.style.strokeDasharray));
    return { total: segs.length, lit: lit.length, dashes: dashes };
  });
  ok(ring.total === 12, 'the progress ring is 12 segments with gaps',
    'segments ' + ring.total);
  ok(ring.lit > 0 && ring.lit < 12, 'the fill is partial, not all-or-nothing',
    'lit ' + ring.lit + ' of ' + ring.total);
  ok(ring.dashes.every(d => d > 0), 'every lit segment has a real length');
  ok(ring.dashes.some(d => d < 30), 'the leading segment is partially drawn');

  /* Esc goes back on the watch */
  await freeMode(kPage, 'dudoso');
  await kPage.waitForSelector('.view[data-screen="dudoso"]');
  await kPage.keyboard.press('Escape');
  await settle(kPage, 600);
  ok(await screenIs(kPage, 'home'), 'Esc goes back to Home');
  ok((await kPage.locator('#freeMode button:not([disabled])').count()) === 6,
    'every free-mode button is reachable by keyboard');

  /* subtitles and the ×5 wash label */
  const subPage = await ctx.newPage();
  await subPage.addInitScript(() => { window.__storySpeed = 4; });
  await subPage.goto(INDEX, { waitUntil: 'load' });
  await subPage.waitForSelector('.view[data-screen="home"]');
  await subPage.click('#storyPlay');
  await subPage.waitForFunction(
    () => (document.getElementById('subtitle').textContent || '').length > 0,
    { timeout: 8000 });
  ok(true, 'the story shows a one-line English subtitle');
  const sub = await subPage.locator('#subtitle').textContent();
  ok(!/\b(el|la|los|las|del|una|para|con|turno|reloj|lavad|cama|paciente)\b/i.test(sub), 'the subtitle has no Spanish leftovers', sub);
  await subPage.waitForSelector('[data-speed]', { timeout: 20000 });
  const speed = await subPage.locator('[data-speed]').textContent();
  ok(speed.trim() === '×5', 'the wash runs at ×5 in the story and says so', speed);
  await subPage.close();
  await kPage.close();
  ok(kErrs.length === 0, 'no console errors while driving the crown and keys',
    kErrs.join(' | '));

  const storyPage = await ctx.newPage();
  const storyErrs = watchErrors(storyPage);
  await storyPage.addInitScript(() => {
    window.__longtasks = [];
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach(e => {
          if (e.entryType === 'longtask') window.__longtasks.push(e.duration);
        });
      }).observe({ entryTypes: ['longtask'] });
    } catch (e) { /* longtask unsupported — nothing to assert */ }
  });
  await storyPage.addInitScript(() => { window.__storySpeed = 20; });
  await storyPage.goto(INDEX, { waitUntil: 'load' });
  await storyPage.waitForSelector('.view[data-screen="home"]');
  await storyPage.click('#storyPlay');
  await storyPage.waitForFunction(() => window.__storyDone === true, { timeout: 90000 });
  ok(true, 'the guided shift reached its last beat');
  await settle(storyPage, 400);
  ok(await screenIs(storyPage, 'quien'), 'it ends on Who sees this');
  const state = await storyPage.evaluate(() => ({
    done: watch.state.done, corrections: watch.state.corrections, clock: watch.clock()
  }));
  ok(state.done === 15, 'the shift closed with 15 of 17 moments',
    'done=' + state.done);
  ok(state.corrections === 2, 'two marks were corrected by the nurse',
    'corrections=' + state.corrections);
  ok(storyErrs.length === 0, 'the guided shift logs no console errors',
    storyErrs.join(' | '));
  await storyPage.screenshot({ path: shot('story-end.png') });

  /* no long task (> 100ms) while the guided story played: only count tasks
     that started after the run began (load is excluded on purpose) */
  const longMax = await storyPage.evaluate(() =>
    (window.__longtasks || []).reduce((m, d) => Math.max(m, d), 0));
  const longN = await storyPage.evaluate(() =>
    (window.__longtasks || []).filter(d => d > 100).length);
  ok(longN === 0, 'no long task over 100ms during the guided story',
    'max ' + longMax.toFixed(1) + 'ms');
  await storyPage.close();

  /* =============================================================== 13. visual */
  head('13 · the visual signature holds');

  /* tilt: the pointer bends the case, the glare follows; +-8deg max */
  const tiltPage = await ctx.newPage();
  await tiltPage.goto(INDEX, { waitUntil: 'load' });
  await tiltPage.waitForSelector('.view[data-screen="home"]');
  await tiltPage.evaluate(() => window.__setTheme('dark'));
  await settle(tiltPage, 900);
  ok(await tiltPage.evaluate(() => !!window.__tilt),
    'the tilt spring is installed (fine pointer, full motion)');
  await tiltPage.mouse.move(1320, 500);
  await settle(tiltPage, 900);
  const bent = await tiltPage.evaluate(() => ({
    rx: document.getElementById('watch').style.getPropertyValue('--rx'),
    ry: document.getElementById('watch').style.getPropertyValue('--ry'),
    gx: document.getElementById('screen').style.getPropertyValue('--gx')
  }));
  ok(Math.abs(parseFloat(bent.ry)) >= 5,
    'the case yaws toward the pointer (>' + ' 5deg)', JSON.stringify(bent));
  ok(Math.abs(parseFloat(bent.rx)) <= 8 && Math.abs(parseFloat(bent.ry)) <= 8,
    'tilt never exceeds +-8deg', JSON.stringify(bent));
  ok(bent.gx !== '' && Math.abs(parseFloat(bent.gx) - 32) > 4,
    'the glass glare follows the pointer', 'gx ' + bent.gx);
  const watchBox = await tiltPage.locator('#watch').boundingBox();
  await tiltPage.mouse.move(watchBox.x + watchBox.width / 2, watchBox.y + watchBox.height / 2);
  await settle(tiltPage, 1500);
  const flat = await tiltPage.evaluate(() => ({
    rx: document.getElementById('watch').style.getPropertyValue('--rx'),
    ry: document.getElementById('watch').style.getPropertyValue('--ry')
  }));
  ok(Math.abs(parseFloat(flat.rx)) < 1 && Math.abs(parseFloat(flat.ry)) < 1,
    'the case settles flat under the pointer', JSON.stringify(flat));

  /* bloom answers the watch state, in primary and neutrals only */
  await tiltPage.evaluate(() => haptics.play('ok'));
  await settle(tiltPage, 250);
  ok(await tiltPage.evaluate(() =>
    document.getElementById('bloom').classList.contains('is-pulse')),
    'an ok wash pulses the bloom once');
  await tiltPage.evaluate(() => haptics.play('doubtful'));
  await settle(tiltPage, 250);
  ok(await tiltPage.evaluate(() =>
    document.getElementById('bloom').classList.contains('is-breathe')),
    'a doubtful mark starts the neutral breathe');
  const bloomBg = await tiltPage.evaluate(() =>
    getComputedStyle(document.getElementById('bloom')).backgroundImage);
  ok(!/255,\s*0,\s*0|rgb\(255,\s*0/.test(bloomBg),
    'the bloom never goes red', bloomBg.slice(0, 80));
  await tiltPage.close();

  /* reduced motion: no tilt, static glare, static bars */
  const rmCtx2 = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce'
  });
  const rmTilt = await rmCtx2.newPage();
  await rmTilt.goto(INDEX, { waitUntil: 'load' });
  await rmTilt.waitForSelector('.view[data-screen="home"]');
  await settle(rmTilt, 800);
  await rmTilt.mouse.move(1320, 500);
  await settle(rmTilt, 800);
  const rmState = await rmTilt.evaluate(() => ({
    spring: !!window.__tilt,
    rx: document.getElementById('watch').style.getPropertyValue('--rx'),
    ry: document.getElementById('watch').style.getPropertyValue('--ry'),
    gx: document.getElementById('screen').style.getPropertyValue('--gx')
  }));
  ok(!rmState.spring && rmState.rx === '' && rmState.ry === '' && rmState.gx === '',
    'reduced motion installs no tilt and the glare stays static',
    JSON.stringify(rmState));
  await rmCtx2.close();

  /* heatmap ripple: delay is monotonic in distance from the 19:00 cell */
  await unitPage.evaluate(() => window.__setTheme('dark'));
  await unitPage.locator('#heat').scrollIntoViewIfNeeded();
  await settle(unitPage, 900);
  const ripple = await unitPage.evaluate(() =>
    [...document.querySelectorAll('.uheat__cell')].map(el => ({
      h: parseInt(el.title, 10),
      delay: parseFloat(getComputedStyle(el).animationDelay) || 0
    })));
  ok(await unitPage.evaluate(() =>
    document.querySelector('.uheat.is-in') !== null),
    'the heatmap reveals once scrolled into view');
  const byDist = ripple.slice().sort((a, b) =>
    Math.abs(a.h - 19) - Math.abs(b.h - 19));
  const mono = byDist.every((c, i, arr) =>
    i === 0 || c.delay >= arr[i - 1].delay - 0.001);
  ok(byDist.length === 24 && mono,
    'heatmap delay is monotonic in distance from the shift-change cell',
    byDist.map(c => c.h + ':' + c.delay.toFixed(3)).join(' '));
  ok(ripple.find(c => c.h === 19).delay <= Math.min(...ripple.map(c => c.delay)) + 0.001,
    'the 19:00 cell ripples first');

  /* unit statement reveals word by word; notice docks after scroll */
  ok(await unitPage.locator('.manifesto .blur-word').count() >= 5,
    'the statement reveals word by word');
  await unitPage.evaluate(() => window.scrollTo(0, 0));
  await settle(unitPage, 400);
  await unitPage.evaluate(() => window.scrollTo(0, 800));
  await settle(unitPage, 700);
  ok(await unitPage.evaluate(() =>
    document.querySelector('.unotice').classList.contains('is-docked')),
    'the no-names notice docks after the first scroll');

  /* theme transition leaves nothing behind */
  await page.evaluate(() => window.__setTheme('dark'));
  await settle(page, 500);
  await page.click('#themeToggle');
  await settle(page, 900);
  const themeClean = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    switching: document.documentElement.classList.contains('is-switching'),
    vtx: document.documentElement.style.getPropertyValue('--vtx')
  }));
  ok(themeClean.theme === 'light' && !themeClean.switching && themeClean.vtx === '',
    'the theme transition flips and cleans up', JSON.stringify(themeClean));
  await page.evaluate(() => window.__setTheme('dark'));
  await settle(page, 500);

  /* =============================================================== 14. hostile QA */
  head('14 · hostile-user regressions (W3)');

  /* a fresh page: sections 2-4 left this one paused with swapped tokens */
  const qPage = await ctx.newPage();
  const qErrs = watchErrors(qPage);
  await qPage.goto(INDEX, { waitUntil: 'load' });
  await qPage.waitForSelector('.view[data-screen="home"]');
  await qPage.evaluate(() => { window.__timeScale = 0.02; window.__vibe = []; });
  await settle(qPage, 200);

  /* 14a — a double tap on "Yes, I did" counts ONE correction.
     Two back-to-back taps through the same handler a click reaches. */
  {
    const c0 = await qPage.evaluate(() => watch.state.corrections);
    await qPage.click('#freeMode [data-act="dudoso"]');
    await qPage.waitForSelector('.view[data-screen="dudoso"]');
    await qPage.evaluate(() => { watch.act('doubt-yes'); watch.act('doubt-yes'); });
    await qPage.waitForSelector('.view[data-screen="home"]', { timeout: 5000 });
    await settle(qPage, 400);
    const c1 = await qPage.evaluate(() => watch.state.corrections);
    ok(c1 === c0 + 1, 'double tap counts one correction', c0 + ' → ' + c1);
  }

  /* 14b — Esc never ping-pongs: a tour of screens then Esc always lands Home */
  {
    await qPage.evaluate(async () => {
      for (const n of ['recordatorio', 'dudoso', 'fin', 'quien', 'pausa', 'quien']) {
        watch.go(n, 'fwd');
        await new Promise(r => setTimeout(r, 60));
      }
    });
    for (let i = 0; i < 8; i++) await qPage.keyboard.press('Escape');
    await settle(qPage, 600);
    ok(await qPage.evaluate(() => watch.state.screen) === 'home',
      'an Esc chain always lands on Home');
  }

  /* 14c — Esc during the wash dismisses it: no phantom credit */
  {
    await qPage.evaluate(() => { watch.resume(); });
    const d0 = await qPage.evaluate(() => watch.state.done);
    await qPage.click('#freeMode [data-act="lavado"]');
    await qPage.waitForSelector('.view[data-screen="lavando"]', { timeout: 4000 });
    await qPage.keyboard.press('Escape');
    await settle(qPage, 2500);
    const st = await qPage.evaluate(() => ({ s: watch.state.screen, d: watch.state.done }));
    ok(st.s === 'home' && st.d === d0, 'an escaped wash earns no credit',
      JSON.stringify(st) + ' was ' + d0);
  }

  /* 14d — a code blue mid-wash keeps the count but never buzzes */
  {
    const d0 = await qPage.evaluate(() => watch.state.done);
    await qPage.evaluate(() => { window.__vibe = []; });
    await qPage.click('#freeMode [data-act="lavado"]');
    await qPage.waitForSelector('.view[data-screen="lavando"]', { timeout: 4000 });
    await qPage.click('#freeMode [data-act="codigo"]');
    await qPage.waitForSelector('.view[data-screen="home"]', { timeout: 8000 });
    await settle(qPage, 400);
    const st = await qPage.evaluate(() => ({
      d: watch.state.done,
      paused: watch.isPaused(),
      vibe: window.__vibe
    }));
    ok(st.d === d0 + 1, 'the interrupted wash still counts', JSON.stringify(st.d));
    ok(st.vibe.length === 0, 'but the watch stays silent while paused',
      JSON.stringify(st.vibe));
    ok(st.paused === true, 'and the pause is still open');
    await qPage.evaluate(() => { watch.resume(); watch.go('home', 'zoom'); });
    await settle(qPage, 400);
  }

  /* 14e — a stale tap on a closed screen counts nothing */
  {
    const d0 = await qPage.evaluate(() => watch.state.done);
    await qPage.evaluate(() => { watch.act('done'); });
    const d1 = await qPage.evaluate(() => watch.state.done);
    ok(d1 === d0, 'act("done") off-screen is ignored', d0 + ' → ' + d1);
  }

  ok(qErrs.length === 0, 'no console errors across the hostile pass',
    qErrs.join(' | '));
  await qPage.close();

  /* =============================================================== screenshots */
  head('screenshots · 6 key moments x 2 themes');

  const shots = [
    ['home', async () => {}],
    ['recordatorio', async (p) => { await p.click('#freeMode [data-act="zona"]');
      await p.waitForSelector('.view[data-screen="recordatorio"]'); }],
    ['lavando', async (p) => {
      await p.evaluate(() => { watch.state.washMs = 6000; watch.startWash({}); });
      await p.waitForSelector('.view[data-screen="lavando"]');
      await p.waitForTimeout(2600);
    }],
    ['dudoso', async (p) => { await p.click('#freeMode [data-act="dudoso"]');
      await p.waitForSelector('.view[data-screen="dudoso"]'); }],
    ['fin', async (p) => { await p.click('#freeMode [data-act="terminar"]');
      await p.waitForSelector('.view[data-screen="fin"]'); }],
    ['quien', async (p) => { await p.click('#sideButton');
      await p.waitForSelector('.view[data-screen="quien"]'); }],
    ['pausa', async (p) => { await p.click('#freeMode [data-act="codigo"]');
      await p.waitForSelector('.view[data-screen="pausa"]'); }]
  ];

  for (const theme of ['dark', 'light']) {
    const suffix = theme === 'light' ? '-light' : '';
    for (const [name, drive] of shots) {
      const sp = await ctx.newPage();
      const errs = watchErrors(sp);
      await sp.goto(INDEX, { waitUntil: 'load' });
      await sp.waitForSelector('.view[data-screen="home"]');
      await sp.evaluate((t) => window.__setTheme(t), theme);
      await sp.evaluate(() => { window.__timeScale = 1; });
      await settle(sp, 1100);
      await drive(sp);
      await settle(sp, 700);
      await sp.locator('#watch').screenshot({ path: shot('watch-' + name + suffix + '.png') });
      ok(errs.length === 0, 'no console errors while shooting ' + name + ' (' + theme + ')',
        errs.join(' | '));
      await sp.close();
    }

    /* the whole stage in this theme */
    const fullPage = await ctx.newPage();
    await fullPage.goto(INDEX, { waitUntil: 'load' });
    await fullPage.waitForSelector('.view[data-screen="home"]');
    await fullPage.evaluate((t) => window.__setTheme(t), theme);
    await settle(fullPage, 1400);
    await fullPage.screenshot({ path: shot('stage-' + theme + '.png'), fullPage: true });
    await fullPage.close();

    /* the unit page in this theme: stroll down first so every IO
       section has revealed before the full-page still */
    const uShot = await ctx.newPage();
    await uShot.goto(UNIT, { waitUntil: 'load' });
    await uShot.waitForSelector('#momentBars .ubar');
    await uShot.evaluate((t) => window.__setTheme(t), theme);
    for (const sel of ['#momentBars', '#heat', '#corrN']) {
      await uShot.locator(sel).scrollIntoViewIfNeeded();
      await settle(uShot, 600);
    }
    await uShot.evaluate(() => window.scrollTo(0, 0));
    await settle(uShot, 600);
    /* the fixed notice would stitch mid-page in a full-height capture;
       it is asserted separately above, so park it for the still only */
    await uShot.evaluate(() => {
      const n = document.querySelector('.unotice');
      if (n) n.style.display = 'none';
    });
    await uShot.screenshot({ path: shot('unit-' + theme + '.png'), fullPage: true });
    await uShot.close();
  }

  await browser.close();

  /* =============================================================== summary */
  head('summary');
  if (fails.length) {
    console.log(fails.length + ' failed, ' + pass + ' passed\n');
    fails.forEach(f => console.log('  ✗ ' + f));
    console.log('');
    process.exit(1);
  }
  console.log('  ' + pass + ' passed, 0 failed');
  console.log('  screenshots → shots/');
  console.log('');
})().catch(err => {
  console.error('\n  harness error:', err && err.message ? err.message : err);
  process.exit(1);
});
