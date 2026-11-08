/* ==========================================================================
   tests/phase-b.test.js — the strict-professor demo fixes, in a real browser
   (plus the pure modules where the bug lives in logic, not in pixels).
   node tests/phase-b.test.js   (run from the prototype folder)
   ========================================================================== */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const INDEX = pathToFileURL(path.join(ROOT, 'index.html')).href;
const UNIT = pathToFileURL(path.join(ROOT, 'unit.html')).href;

const AI = require('../js/ai.js');
const Ask = require('../js/ask.js');
const Ollama = require('../ai/ollama.js');

let pass = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  ✗ ' + label + (detail ? '\n      ' + detail : ''));
  return false;
}
function head(s) { console.log('\n' + s); }

function seedSeen(ctx) {
  return ctx.addInitScript(() => {
    try {
      localStorage.setItem('handwatch-guide1', 'seen');
      localStorage.setItem('handwatch-tips',
        JSON.stringify(['crown', 'strip', 'free', 'privacy']));
    } catch (e) { /* file storage */ }
  });
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
      m = (c || '').match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/);
      if (m) {
        return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255,
          parseFloat(m[3]) * 255, 1];
      }
      return null;
    };
    const lin = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const fg = parse(getComputedStyle(el).color);
    if (!fg) return { missing: s + ' (unparsable)' };
    let bg = null;
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0.99) { bg = c; break; }
      n = n.parentElement;
    }
    const L1 = lum(fg), L2 = lum(bg || [16, 16, 16, 1]);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return { ratio: (hi + 0.05) / (lo + 0.05) };
  }, sel);
}

(async () => {
  const browser = await chromium.launch();

  /* ============================================================ 1 · cap */
  head('1 · the counter never passes the plan');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForSelector('.view[data-screen="home"]');
    await page.evaluate(() => { window.__timeScale = 0.01; });
    for (let i = 0; i < 6; i++) {
      await page.click('#freeMode [data-act="lavado"]');
      await page.waitForFunction((n) => {
        return watch.state.events.length >= n && watch.state.screen === 'home';
      }, i + 1, { timeout: 5000 });
    }
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({
      done: watch.state.done,
      plan: watch.state.plan,
      shown: document.querySelector('.ring__center').innerText,
      events: watch.state.events.length
    }));
    ok(st.done === 15 && st.plan === 15, 'six washes clamp to 15 / 15',
      JSON.stringify(st));
    ok(/15\s*\/\s*15/.test(st.shown), 'Home literally shows "15 / 15"', st.shown);
    ok(st.events === 6, 'every extra wash still logs an event',
      'events=' + st.events);
    await ctx.close();
  }

  /* ====================================================== 2 · wash timer */
  head('2 · a wash timer dies with its screen');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForSelector('.view[data-screen="home"]');

    /* path A: Skip while a wash is still counting */
    await page.evaluate(() => {
      window.__timeScale = 1;
      watch.state.washMs = 700;
      watch.startWash({ speed: 1 });
    });
    await page.waitForSelector('.view[data-screen="lavando"]');
    await page.evaluate(() => window.__story.skip());
    await page.waitForSelector('.view[data-screen="fin"]');
    const skipDone = await page.evaluate(() => watch.state.done);
    await page.waitForTimeout(2600);
    const afterSkip = await page.evaluate(() => ({
      screen: watch.state.screen, done: watch.state.done
    }));
    ok(afterSkip.screen === 'fin' && afterSkip.done === skipDone,
      'Skip: no late endWash jumps back Home', JSON.stringify(afterSkip));

    /* path B: End shift while a wash is still counting */
    await page.evaluate(() => { watch.home(); watch.state.washMs = 700; });
    await page.waitForSelector('.view[data-screen="home"]');
    await page.evaluate(() => watch.startWash({ speed: 1 }));
    await page.waitForSelector('.view[data-screen="lavando"]');
    const beforeEnd = await page.evaluate(() => watch.state.done);
    await page.click('#freeMode [data-act="terminar"]');
    await page.waitForSelector('.view[data-screen="fin"]');
    await page.waitForTimeout(2600);
    const afterEnd = await page.evaluate(() => ({
      screen: watch.state.screen, done: watch.state.done
    }));
    ok(afterEnd.screen === 'fin' && afterEnd.done === beforeEnd,
      'End shift: the cancelled wash adds no 16th moment', JSON.stringify(afterEnd));
    await ctx.close();
  }

  /* ==================================================== 3 · story timing */
  head('3 · every guided beat advances, total 60–75 s');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__storySpeed = 1;
      window.__beats = [];
      document.addEventListener('story:beat', (e) => window.__beats.push(e.detail));
      document.addEventListener('story:done', (e) => { window.__doneAt = e.detail.time; });
    });
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForSelector('.view[data-screen="home"]');
    await page.click('#storyPlay');
    await page.waitForFunction(() => window.__storyDone === true, null, { timeout: 95000 });
    const timing = await page.evaluate(() => ({
      beats: window.__beats,
      doneAt: window.__doneAt
    }));
    const times = timing.beats.map((b) => b.time);
    const gaps = [];
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
    gaps.push(timing.doneAt - times[times.length - 1]);
    const total = timing.doneAt - times[0];
    ok(timing.beats.length === 9, 'nine beats ran', String(timing.beats.length));
    ok(Math.max(...gaps) <= 8000, 'no beat holds longer than 8 s',
      'max ' + Math.max(...gaps) + 'ms');
    ok(total >= 60000 && total <= 75000, 'the full story takes 60–75 s',
      total + 'ms');
    ok(await page.evaluate(() => watch.state.screen) === 'quien',
      'it still ends on Who sees this');
    await ctx.close();
  }

  /* ============================================================ 4 · reset */
  head('4 · Reset also clears the log and the learning');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForSelector('.view[data-screen="home"]');
    await page.evaluate(() => {
      Log.record('before-patient', 'done', false);
      Log.record('after-patient', 'confirmed', true);
      Calibrate.correct({ moment: 'before-patient', noise: 0.2 });
      watch.go('home', 'zoom');
    });
    await page.waitForTimeout(400);
    const learningBefore = await page.evaluate(() =>
      document.querySelector('#screen').innerText);
    ok(/Aprendiendo/.test(learningBefore), 'Home shows the learning line first',
      learningBefore.slice(0, 80));
    await page.evaluate(() => window.__story.reset());
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      text: document.querySelector('#screen').innerText,
      events: Log.count(),
      learning: Calibrate.active()
    }));
    ok(!/Aprendiendo/.test(after.text), 'after Reset Home has no learning line',
      after.text.slice(0, 80));
    ok(after.events === 0 && !after.learning,
      'the log is empty and the learning is gone', JSON.stringify(after));
    await page.evaluate(() => Settings.open('general'));
    await page.waitForTimeout(400);
    const inv = await page.evaluate(() =>
      document.getElementById('settingsInventory').textContent);
    ok(/0 eventos, 24 h/.test(inv), 'Privacidad reads 0 eventos, 24 h', inv);
    await ctx.close();
  }

  /* ============================================================ 5 · pause */
  head('5 · Pause asks before it mutes');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForSelector('.view[data-screen="home"]');

    await page.click('.pill[data-act="pause"]');
    await page.waitForSelector('.view[data-screen="pausa"]');
    ok(await page.evaluate(() => !watch.isPaused()),
      'opening Pause does not mute yet');
    ok(await page.locator('.pill[data-act="pause-confirm"]').count() === 1,
      'Pause offers an explicit "Silenciar 30 min" pill');
    await page.click('.pill[data-act="back"]');
    await page.waitForSelector('.view[data-screen="home"]');
    ok(await page.evaluate(() => !watch.isPaused()), 'Atrás does NOT mute');

    await page.click('.pill[data-act="pause"]');
    await page.waitForSelector('.view[data-screen="pausa"]');
    await page.click('.pill[data-act="pause-confirm"]');
    await page.waitForFunction(() => {
      const views = document.querySelectorAll('#viewport .view');
      return watch.state.screen === 'home' && views.length === 1;
    }, null, { timeout: 5000 });
    ok(await page.evaluate(() => watch.isPaused()), 'the confirm pill does mute');
    const foot = await page.evaluate(() =>
      document.querySelector('.view[data-screen="home"] .screen__foot').innerText);
    ok(/Reanudar avisos/.test(foot), 'Home shows "Reanudar avisos" while muted', foot);
    await ctx.close();
  }

  /* ============================================================= 6 · why */
  head('6 · the explanation uses the real signal');
  {
    const lowNoise = AI.rulesExplain({ moment: 'before-patient', confidence: 'low', noise: 0.1 });
    const highNoise = AI.rulesExplain({ moment: 'before-patient', confidence: 'low', noise: 0.9 });
    ok(lowNoise !== highNoise, 'noise 0.1 and 0.9 give different explanations',
      lowNoise + ' // ' + highNoise);
    ok(/short/.test(lowNoise) && !/noise was high/.test(lowNoise),
      'a short rub with little noise says so', lowNoise);
    ok(/noise was high/.test(highNoise), 'high noise is named', highNoise);
    ok(/broken/.test(AI.rulesExplain({ moment: 'before-patient', confidence: 'mid', noise: 0.2 })),
      'a broken rhythm is named');
    ok(/low and steady/.test(AI.rulesExplain({ moment: 'before-patient', confidence: 'high', noise: 0.2 })),
      'low motion is named');
    ok([lowNoise, highNoise].every((l) => l.length <= 140), 'lines stay within 140 chars');
  }

  /* ========================================================= 7 · AI down */
  head('7 · a down model is named, and never opens the consent sheet');
  {
    const old = process.env.OLLAMA_URL;
    process.env.OLLAMA_URL = 'http://127.0.0.1:1';
    const health = await Ollama.listModels({ timeoutMs: 500 });
    if (old === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = old;
    ok(!health.ok && health.reason === 'down',
      'OLLAMA_URL pointing at a dead port reads as down', JSON.stringify(health));

    let asked = 0;
    const dead = {
      health: async () => ({ ok: false }),
      query: async () => { throw new Error('should not be called'); }
    };
    const facts = Ask.buildFacts({
      moments: [{ name: 'Before the patient', done: 8, total: 10, pct: 80 }],
      hours: new Array(24).fill(1),
      corrections: 2
    });
    const r = await Ask.request('¿Dónde se cae el proceso?', facts, {
      transport: dead,
      onConsent: async () => { asked++; return 'yes'; }
    }, 'es');
    ok(r.modelFailed === true && r.source === 'Rules',
      'the answer falls back to the rules with modelFailed', JSON.stringify(r));
    ok(asked === 0, 'the consent sheet was never requested', 'asked=' + asked);

    let asked2 = 0;
    const failing = {
      health: async () => ({ ok: true }),
      query: async () => ({ ok: false, reason: 'down' })
    };
    const r2 = await Ask.request('¿Dónde se cae el proceso?', facts, {
      transport: failing,
      consent: 'yes',
      onConsent: async () => { asked2++; return 'yes'; }
    }, 'es');
    ok(r2.modelFailed === true && asked2 === 0,
      'a server that dies mid-query is named too', JSON.stringify(r2));

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    await ctx.addInitScript(() => {
      window.__aiAPI = {
        health: () => Promise.resolve({ ok: false }),
        query: () => Promise.resolve({ ok: false })
      };
    });
    const page = await ctx.newPage();
    await page.goto(UNIT, { waitUntil: 'load' });
    await page.waitForSelector('#askForm');
    await page.fill('#askInput', '¿Dónde se cae el proceso?');
    await page.click('.ask__send');
    await page.waitForSelector('#askAnswer:not([hidden])');
    await page.waitForFunction(() =>
      document.getElementById('askFallback') &&
      !document.getElementById('askFallback').hidden, null, { timeout: 5000 });
    const line = await page.locator('#askFallback').textContent();
    ok(/No pude usar el modelo; respondieron las reglas del reloj\./.test(line),
      'one honest line sits under the answer', line);
    ok(await page.locator('.ai-consent').count() === 0,
      'the consent sheet never opened');

    await page.fill('#askInput', '   ');
    await page.click('.ask__send');
    const empty = await page.locator('#askEmpty');
    ok(await empty.isVisible() &&
      /Escribe una pregunta sobre los momentos o las horas\./.test(await empty.textContent()),
      'an empty submit shows the inline message', await empty.textContent());
    await ctx.close();
  }

  /* ========================================================== 8 · guards */
  head('8 · the app vocabulary is not a person');
  {
    ok(Ask.guard('¿Cuál es el momento Antes del paciente?') === null,
      'a moment name is allowed');
    ok(Ask.guard('What does Infection Control think?') === null,
      'Infection Control is allowed');
    ok(Ask.guard('¿Quién se lava menos?') === 'person',
      'a real person question is still refused');
    const ctx = { facts: {}, question: '' };
    ok(Ask.parse(JSON.stringify({ answer: 'La enfermera falló en ese momento.' }), ctx) === null,
      'Spanish blame with a person subject is dropped');
    ok(Ask.parse(JSON.stringify({ answer: 'El proceso falló en ese momento.' }), ctx) !== null,
      'the process may still be named');
  }

  /* ========================================================= 9 · contrast */
  head('9 · dark insight text clears 4.5:1');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.goto(UNIT, { waitUntil: 'load' });
    await page.waitForSelector('#momentBars .ubar');
    await page.evaluate(() => window.__setTheme('dark'));
    await page.waitForTimeout(600);
    for (const sel of ['.insight__stats', '.model__cap']) {
      const r = await contrast(page, sel);
      ok(!r.missing && r.ratio >= 4.5, 'dark contrast ≥ 4.5:1 — ' + sel,
        r.missing ? 'missing' : 'ratio ' + r.ratio.toFixed(2) + ':1');
    }
    await ctx.close();
  }

  /* ====================================================== 10 · narrow unit */
  head('10 · the unit page fits 390px and still works at 1440px');
  {
    for (const [w, h] of [[390, 844], [1440, 1000]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      await seedSeen(ctx);
      const page = await ctx.newPage();
      await page.goto(UNIT, { waitUntil: 'load' });
      await page.waitForSelector('#momentBars .ubar');
      await page.waitForTimeout(1200);
      const m = await page.evaluate(() => {
        const head = document.querySelector('.unit__head').getBoundingClientRect();
        const back = document.querySelector('.unit__back').getBoundingClientRect();
        const wrap = document.querySelector('.model__table-wrap');
        const notice = document.querySelector('.unotice');
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          headRight: head.right,
          backBottom: back.bottom,
          firstCardTop: document.querySelector('.ucard').getBoundingClientRect().top,
          tableScroll: wrap.scrollWidth > wrap.clientWidth,
          hint: getComputedStyle(document.querySelector('.model__scrollhint')).display,
          padding: parseFloat(getComputedStyle(document.querySelector('.unit')).paddingBottom),
          noticeH: notice.offsetHeight
        };
      });
      ok(m.overflow <= 1, w + 'px: no horizontal scroll', 'overflow ' + m.overflow + 'px');
      ok(m.headRight <= w + 1, w + 'px: the header wraps inside the viewport');
      ok(m.backBottom <= m.firstCardTop + 1,
        w + 'px: the fixed back pill clears the content');
      ok(m.padding >= m.noticeH,
        w + 'px: content has room above the fixed notice',
        'padding ' + m.padding + ' vs notice ' + m.noticeH);
      if (w === 390) {
        ok(m.tableScroll, '390px: the model table scrolls sideways');
        ok(m.hint !== 'none', '390px: a visible scroll cue is shown', m.hint);
      } else {
        ok(!m.tableScroll, '1440px: the model table fits without scrolling');
        ok(m.hint === 'none', '1440px: no scroll cue');
      }
      await ctx.close();
    }
  }

  /* ==================================================== 11 · accessibility */
  head('11 · screen name, ring, consent and touch targets');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForSelector('.view[data-screen="home"]');
    ok(await page.locator('#screen[aria-live="polite"]').count() === 1,
      '#screen is a polite live region');
    const announceHome = await page.locator('#screenAnnounce').textContent();
    ok(announceHome.trim() === 'Inicio', 'the short announcement is "Inicio"', announceHome);
    const ring = await page.evaluate(() => {
      const r = document.querySelector('.ring[role="progressbar"]');
      return r && {
        now: r.getAttribute('aria-valuenow'),
        max: r.getAttribute('aria-valuemax')
      };
    });
    ok(ring && ring.now === '12' && ring.max === '15',
      'the ring is a progressbar with values', JSON.stringify(ring));
    await page.evaluate(() => watch.go('quien', 'zoom'));
    await page.waitForTimeout(300);
    ok((await page.locator('#screenAnnounce').textContent()).trim() === 'Quién ve esto',
      'changing screen changes the announcement');

    await page.evaluate(() => {
      const d = document.querySelector('details');
      if (d) d.open = true;
    });
    await page.waitForTimeout(300);
    const small = await page.evaluate(() =>
      ['.ctl-btn', '.vocab__play', '.details__summary'].map((s) => {
        const el = document.querySelector(s);
        return { s: s, h: el ? el.getBoundingClientRect().height : 0 };
      }).filter((x) => x.h < 43.5));
    ok(small.length === 0, 'simulator controls clear 44px', JSON.stringify(small));

    const unit = await ctx.newPage();
    await unit.goto(UNIT, { waitUntil: 'load' });
    await unit.waitForSelector('#askInput');
    await unit.focus('#askInput');
    await unit.evaluate(() => { window.__consent = AI.requestConsent({ unit: '4B' }); });
    await unit.waitForSelector('.ai-consent [role="dialog"]');
    ok(await unit.locator('.ai-consent [aria-modal="true"]').count() === 1,
      'the consent dialog is aria-modal');
    ok(await unit.evaluate(() =>
      document.querySelector('.ai-consent').contains(document.activeElement)),
      'focus starts inside the consent dialog');
    await unit.keyboard.press('Tab');
    await unit.keyboard.press('Tab');
    ok(await unit.evaluate(() =>
      document.querySelector('.ai-consent').contains(document.activeElement)),
      'Tab stays trapped in the dialog');
    await unit.keyboard.press('Escape');
    await unit.waitForTimeout(200);
    ok(await unit.locator('.ai-consent').count() === 0, 'Esc closes the dialog');
    ok(await unit.evaluate(() =>
      document.activeElement && document.activeElement.id === 'askInput'),
      'focus returns to the Ask field');
    ok(await unit.evaluate(() => window.__consent) === 'no',
      'Esc reads as "not now"');
    await ctx.close();
  }

  /* ===================================================== 12 · data honesty */
  head('12 · the bars and the trend tell the same story');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await seedSeen(ctx);
    const page = await ctx.newPage();
    await page.goto(UNIT, { waitUntil: 'load' });
    await page.waitForSelector('#momentBars .ubar');
    await page.waitForTimeout(1400);
    const d = await page.evaluate(() => {
      const done = unit.MOMENTS.reduce((s, m) => s + m.done, 0);
      const total = unit.MOMENTS.reduce((s, m) => s + m.total, 0);
      const barMean = done / total * 100;
      const weeks = Insights.buildAnalysis(7).weeks;
      const lastWeek = weeks[weeks.length - 1].rate * 100;
      const cards = [...document.querySelectorAll('.insight__item')];
      const tags = cards.map((c) => c.querySelector('.insight__demo'));
      return {
        barMean: barMean,
        lastWeek: lastWeek,
        cards: cards.length,
        tagged: tags.filter((t) => t && /Datos de demostración/.test(t.textContent)).length
      };
    });
    ok(Math.abs(d.barMean - d.lastWeek) <= 1,
      'the bars mean matches the last trend week within 1 point',
      d.barMean.toFixed(1) + '% vs ' + d.lastWeek.toFixed(1) + '%');
    ok(d.cards > 0 && d.tagged === d.cards,
      'every insight card carries "Datos de demostración"',
      d.tagged + '/' + d.cards);
    await ctx.close();
  }

  /* ====================================================== 13 · hygiene */
  head('13 · local fonts, no dead state, docs match code');
  {
    const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const f of ['index.html', 'unit.html']) {
      ok(!/fonts\.googleapis|fonts\.gstatic/.test(read(f)),
        f + ' has no remote Google Fonts link');
    }
    ok(!/lastWhy/.test(read('js/watch.js')) && !/lastWhy/.test(read('js/story.js')),
      'the dead lastWhy state is gone');
    const testDoc = read('TESTING.md');
    ok(!/\.nvm\/versions/.test(testDoc) && /require\('playwright'\)/.test(testDoc),
      'TESTING.md points at the local Playwright');
    ok(/1100x640/.test(read('APP-BRIEF.md')),
      'APP-BRIEF documents the real 640px minimum height');
  }

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
