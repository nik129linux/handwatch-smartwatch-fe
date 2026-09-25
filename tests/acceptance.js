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
  'css/tokens.css', 'css/watch.css', 'css/stage.css',
  'js/haptics.js', 'js/watch.js', 'js/story.js', 'js/unit.js'
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
  recordatorio: [60, 120, 60],
  ok: [35],
  dudoso: [30, 70, 45, 70, 65],
  fin: [400]
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
    'the watch boots on Inicio');

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
  ok(true, 'Entrar a zona → Recordatorio visible');
  await settle(page, 400);
  ok(await page.locator('.pill[data-act="done"]').count() === 1,
    'Recordatorio offers one pill: "Ya lo hice"');

  await freeMode(page, 'lavado');
  await page.waitForSelector('.view[data-screen="lavando"]', { timeout: 4000 });
  ok(true, 'Lavado detectado → Lavando visible');
  await page.waitForSelector('.view[data-screen="home"]', { timeout: 6000 });
  await settle(page, 300);
  const after = parseInt(await page.locator('.hero-num').getAttribute('data-count'), 10);
  ok(after === before + 1,
    'Inicio counter incremented by 1 after the wash',
    'before ' + before + ', after ' + after);

  await freeMode(page, 'dudoso');
  await page.waitForSelector('.view[data-screen="dudoso"]', { timeout: 4000 });
  ok(true, 'Lavado dudoso → ¿Te lavaste? visible');
  const q = await page.locator('.doubt__q').textContent();
  ok(q.trim() === '¿Te lavaste?', 'the screen asks "¿Te lavaste?"', q);
  const pills = await page.locator('.view[data-screen="dudoso"] .pill').count();
  ok(pills === 2, 'two pills, no form fields', 'found ' + pills);
  ok((await page.locator('.view[data-screen="dudoso"] input').count()) === 0,
    'no input fields on the correction screen');

  await page.click('.pill[data-act="doubt-yes"]');
  await page.waitForSelector('.toast.is-on', { timeout: 4000 });
  const toast = (await page.locator('#toastText').textContent()).trim();
  ok(toast === 'Anotado. Gracias.', 'toast says "Anotado. Gracias."', toast);
  await page.waitForSelector('.view[data-screen="home"]', { timeout: 4000 });
  await settle(page, 400);
  ok(await screenIs(page, 'dudoso') === false, 'the doubt screen closes after one tap');

  /* =============================================================== 3. pause */
  head('3 · a code azul silences the reminders');

  await freeMode(page, 'codigo');
  await page.waitForSelector('.view[data-screen="pausa"]', { timeout: 4000 });
  ok(true, 'Código azul → Pausa visible');
  ok(await page.locator('#screen.is-paused').count() === 1,
    'a moon glyph shows in the status bar while paused');

  await page.click('.pill[data-act="back"]');
  await page.waitForSelector('.view[data-screen="home"]', { timeout: 4000 });
  await freeMode(page, 'zona');
  await settle(page, 700);
  ok(await screenIs(page, 'recordatorio') === false,
    'Entrar a zona while paused does NOT show Recordatorio');
  const logText = await page.locator('#log').textContent();
  ok(/silenciado/i.test(logText), 'the swallowed reminder is logged as "silenciado"',
    logText.slice(0, 120));

  /* =============================================================== 4. end of shift */
  head('4 · end of shift and privacy');

  await freeMode(page, 'terminar');
  await page.waitForSelector('.view[data-screen="fin"]', { timeout: 4000 });
  ok(true, 'Terminar turno → Fin de turno visible');
  const finText = await page.locator('.view[data-screen="fin"]').textContent();
  ok(/momentos/i.test(finText), 'Fin de turno shows the moment count');
  ok(/corregidos\s*por\s*ti/i.test(finText.replace(/\s+/g, ' ')),
    'Fin de turno shows how many she corrected herself');
  ok(/24 h/.test(finText), 'Fin de turno states the 24 h window');

  await page.click('#sideButton');
  await page.waitForSelector('.view[data-screen="quien"]', { timeout: 4000 });
  ok(true, 'the side button opens Quién ve esto');
  const who = (await page.locator('.view[data-screen="quien"]').textContent()).replace(/\s+/g, ' ');
  ok(/Tú/.test(who) && /Control de infecciones/.test(who) && /Nadie/.test(who),
    'three rows: Tú · Control de infecciones · Nadie', who.slice(0, 160));
  ok(/sin nombres/.test(who), 'the unit sees totals without names');

  /* =============================================================== 6. haptics */
  head('6 · the vibration vocabulary reaches navigator.vibrate');

  const vibe = await page.evaluate(() => {
    window.__vibe = [];
    ['recordatorio', 'ok', 'dudoso', 'fin'].forEach(n => haptics.play(n));
    return window.__vibe;
  });
  eq(vibe, [VIBE.recordatorio, VIBE.ok, VIBE.dudoso, VIBE.fin],
    'each pattern plays its exact ms array');
  const rows = await page.locator('.vocab__row').count();
  ok(rows === 4, 'the panel documents 4 patterns', 'found ' + rows);
  const strip = await page.locator('.haptic-strip').textContent();
  ok(/Sin sonido\. Nunca\./.test(strip), 'the strip states: Sin sonido. Nunca.');

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
  ['js/haptics.js', 'js/watch.js', 'js/story.js', 'js/unit.js'].forEach(f => {
    stripComments(read(f)).split('\n').forEach((line, i) => {
      if (linRe.test(line)) linOffenders.push(f + ':' + (i + 1) + ' → ' + line.trim());
    });
  });
  ok(linOffenders.length === 0, '"linear" appears only in the wash ring rule',
    linOffenders.slice(0, 4).join(' | '));

  /* 8c — no voseo anywhere */
  const voseo = /\b(tocá|mirá|podés|tenés|querés|acordate|entrás|decís|vos)\b/i;
  const vOffenders = [];
  SCANNED.forEach(f => {
    stripComments(read(f)).split('\n').forEach((line, i) => {
      if (voseo.test(line)) vOffenders.push(f + ':' + (i + 1) + ' → ' + line.trim());
    });
  });
  ok(vOffenders.length === 0, 'no voseo in the source', vOffenders.slice(0, 4).join(' | '));

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
  [/\bincumplimiento\b/i, /\bfalta\b/i, /\berror\b/i, /\bviolaci/i, /\bsancion/i]
    .forEach(re => { if (re.test(watchCopy)) bad.push(re.source); });
  ok(bad.length === 0,
    'no watch screen says incumplimiento / falta / error / sanción', bad.join(', '));
  const allCopy = watchCopy + '\n' + (await page.evaluate(() => document.body.innerText));
  ok(!/\b(tocá|mirá|podés|tenés|querés|acordate)\b/i.test(allCopy),
    'all UI copy is neutral Colombian ("tú")');

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
  await rmPage.evaluate(() => haptics.play('dudoso'));
  await settle(rmPage, 300);
  const rmBars = await rmPage.locator('.haptic-strip__bars .haptic-bar').count();
  ok(rmBars === 3, 'reduced motion still draws the static bars', 'bars: ' + rmBars);
  ok(rmErrs.length === 0, 'index.html has no console errors under reduced motion',
    rmErrs.join(' | '));
  await rmPage.screenshot({ path: shot('reduced-motion.png') });
  await rmCtx.close();

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
  ok(fold0.overflow > 20, 'Inicio has content below the fold',
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
    ['Lavado · Cama 3', 'Corregido por ti · Cama 3', 'Marcado por ti · Cama 5',
      'Lavado · Cama 5', 'Corregido por ti · Cama 5']
      .forEach(t => { watch.addEvent({ text: t, kind: 'ok' }); watch.bump(); });
  });
  await settle(kPage, 500);
  const fold1 = await measure();
  ok(fold1.rows === 3, 'Inicio shows the last 3 events', 'rows ' + fold1.rows);
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
  ok(await screenIs(kPage, 'home'), 'Esc goes back to Inicio');
  ok((await kPage.locator('#freeMode button:not([disabled])').count()) === 7,
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
  ok(true, 'the story shows a one-line Spanish subtitle');
  const sub = await subPage.locator('#subtitle').textContent();
  ok(!/\b(tocá|mirá|podés|tenés|querés)\b/i.test(sub), 'the subtitle is neutral Colombian', sub);
  await subPage.waitForSelector('[data-speed]', { timeout: 20000 });
  const speed = await subPage.locator('[data-speed]').textContent();
  ok(speed.trim() === '×5', 'the wash runs at ×5 in the story and says so', speed);
  await subPage.close();
  await kPage.close();
  ok(kErrs.length === 0, 'no console errors while driving the crown and keys',
    kErrs.join(' | '));

  const storyPage = await ctx.newPage();
  const storyErrs = watchErrors(storyPage);
  await storyPage.addInitScript(() => { window.__storySpeed = 20; });
  await storyPage.goto(INDEX, { waitUntil: 'load' });
  await storyPage.waitForSelector('.view[data-screen="home"]');
  await storyPage.click('#storyPlay');
  await storyPage.waitForFunction(() => window.__storyDone === true, { timeout: 90000 });
  ok(true, 'the guided shift reached its last beat');
  await settle(storyPage, 400);
  ok(await screenIs(storyPage, 'quien'), 'it ends on Quién ve esto');
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
  await storyPage.close();

  /* =============================================================== screenshots */
  head('screenshots');

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

  for (const [name, drive] of shots) {
    const sp = await ctx.newPage();
    const errs = watchErrors(sp);
    await sp.goto(INDEX, { waitUntil: 'load' });
    await sp.waitForSelector('.view[data-screen="home"]');
    await sp.evaluate(() => { window.__timeScale = 1; });
    await settle(sp, 1100);
    await drive(sp);
    await settle(sp, 700);
    await sp.locator('#watch').screenshot({ path: shot('watch-' + name + '.png') });
    ok(errs.length === 0, 'no console errors while shooting ' + name,
      errs.join(' | '));
    await sp.close();
  }

  /* the whole stage, with the story mid-flight */
  const fullPage = await ctx.newPage();
  await fullPage.goto(INDEX, { waitUntil: 'load' });
  await fullPage.waitForSelector('.view[data-screen="home"]');
  await settle(fullPage, 1400);
  await fullPage.screenshot({ path: shot('index.png'), fullPage: true });
  await fullPage.close();

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
