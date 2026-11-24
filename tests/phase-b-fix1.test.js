/* ==========================================================================
   tests/phase-b-fix1.test.js — the 390px unit-page fixes, in a real browser:
   the back control no longer floats over the text, every number follows the
   active locale (prose and stats agree), and the confusion-matrix labels
   stay whole. Pure number normalisation is checked under node too.
   node tests/phase-b-fix1.test.js   (from the prototype folder)
   ========================================================================== */

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const UNIT = pathToFileURL(path.join(ROOT, 'unit.html')).href;

const Insights = require('../js/insights.js');

let pass = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  ✗ ' + label + (detail ? '\n      ' + detail : ''));
  return false;
}
function head(s) { console.log('\n' + s); }

/* Thousands with a comma (English) while the page is Spanish. The leading
   group may not start with 0, so "0,001" stays a decimal. */
function thousandsComma(text) {
  return /(?:^|[^\d,.])([1-9]\d{0,2}(?:,\d{3})+)(?![\d,])/.test(text);
}
/* A dot used as a decimal separator (English habit) in Spanish text.
   "4.578" does not match: the third digit must end the token. */
function decimalDot(text) {
  return /(?:^|[^\d.])\d+\.\d{1,2}(?!\d)/.test(text);
}
/* The mirror checks for English. */
function thousandsDot(text) {
  return /(?:^|[^\d.])([1-9]\d{0,2}(?:\.\d{3})+)(?![\d,.])/.test(text);
}
function decimalComma(text) {
  return /(?:^|[^\d,])\d+,\d{1,2}(?![\d,])/.test(text);
}

/* Visible text nodes plus the spoken attributes, minus code/user text. */
async function visibleCopy(page) {
  return page.evaluate(() => {
    const out = [];
    const skip = 'script,style,pre,code,[data-no-i18n]';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const p = n.parentElement;
      if (!p || (p.closest && p.closest(skip))) continue;
      out.push(n.nodeValue.trim());
    }
    document.querySelectorAll('[aria-label],[title],[placeholder]').forEach((el) => {
      ['aria-label', 'title', 'placeholder'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v) out.push(v);
      });
    });
    return out;
  });
}

(async () => {
  const browser = await chromium.launch();

  /* ================================================== 1 · the back control */
  head('1 · the back control never sits on top of text at 390px');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(UNIT, { waitUntil: 'load' });
    await page.waitForSelector('#matrixCanvas');
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__setTheme('dark'));

    const pos = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.unit__back')).position);
    ok(pos === 'static', '390px: the back control is part of the static header', pos);

    const max = await page.evaluate(() =>
      document.documentElement.scrollHeight - window.innerHeight);
    const stops = [];
    for (let i = 0; i < 10; i++) stops.push(Math.round(max * i / 9));

    for (const y of stops) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(120);
      const r = await page.evaluate(() => {
        const back = document.querySelector('.unit__back').getBoundingClientRect();
        const hits = [];
        const skip = '.unit__back,script,style,noscript,canvas,[data-no-i18n]';
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!n.nodeValue.trim()) continue;
          const p = n.parentElement;
          if (!p || (p.closest && p.closest(skip))) continue;
          const cs = getComputedStyle(p);
          if (cs.display === 'none' || cs.visibility === 'hidden' ||
            parseFloat(cs.opacity) === 0) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const box of range.getClientRects()) {
            const ox = Math.min(back.right, box.right) - Math.max(back.left, box.left);
            const oy = Math.min(back.bottom, box.bottom) - Math.max(back.top, box.top);
            if (ox > 1 && oy > 1) {
              hits.push({ text: n.nodeValue.trim().slice(0, 40),
                back: { l: back.left, t: back.top, r: back.right, b: back.bottom },
                text_box: { l: box.left, t: box.top, r: box.right, b: box.bottom } });
              break;
            }
          }
        }
        return { hits: hits.slice(0, 2), scrollY: window.scrollY };
      });
      ok(r.hits.length === 0,
        '390px: no text under the back control at scroll ' + y,
        JSON.stringify(r.hits));
    }

    /* Desktop keeps the shortcut reachable in the viewport. */
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(200);
    ok(await page.evaluate(() =>
      getComputedStyle(document.querySelector('.unit__back')).position) === 'fixed',
      '1440px: the back control stays a fixed shortcut');
    await ctx.close();
  }

  /* ======================================================== 2 · numbers */
  head('2 · every number follows the active locale, prose and stats agree');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(UNIT, { waitUntil: 'load' });
    await page.waitForSelector('#matrixCanvas');
    await page.waitForTimeout(1200);
    ok(await page.evaluate(() => I18N.lang) === 'es', 'a fresh profile is Spanish');

    const esCopy = (await visibleCopy(page)).join('\n');
    ok(!thousandsComma(esCopy), 'ES: no thousands written with a comma',
      (esCopy.match(/[^\n]*\d,\d{3}[^\n]*/) || [''])[0]);
    ok(!decimalDot(esCopy), 'ES: no decimals written with a dot',
      (esCopy.match(/[^\n]*\d\.\d{1,2}[^\n]*/) || [''])[0]);

    const agree = await page.evaluate(() => {
      const item = [...document.querySelectorAll('.insight__item')]
        .find((x) => /casos/.test(x.innerText));
      if (!item) return null;
      return {
        body: item.querySelector('.insight__body').textContent,
        stats: item.querySelector('.insight__stats').textContent
      };
    });
    ok(agree, 'ES: the change card is on screen');
    if (agree) {
      ok(/\(\d{1,3}(?:\.\d{3})+\s+casos, p<0,001\)/.test(agree.body),
        'ES prose: "4.578 casos, p<0,001"', agree.body);
      ok(/n=\d{1,3}(?:\.\d{3})+/.test(agree.stats) && /p<0,001/.test(agree.stats),
        'ES stats line: "n=4.578 … p<0,001"', agree.stats);
      ok(!/p<0\.001/.test(agree.stats) && !/p<0\.001/.test(agree.body),
        'ES: no dot-decimal p value in the same card');
    }

    const fmt = await page.evaluate(() =>
      Insights.formatNumbers('4,578 casos, p<0.001 · 18:00-21:00 · 0.35'));
    ok(fmt === '4.578 casos, p<0,001 · 18:00-21:00 · 0,35',
      'ES: model text is re-formatted before it is inserted', fmt);

    await page.evaluate(() => I18N.set('en'));
    await page.waitForTimeout(900);
    const enCopy = (await visibleCopy(page)).join('\n');
    ok(!thousandsDot(enCopy), 'EN: no thousands written with a dot',
      (enCopy.match(/[^\n]*\d\.\d{3}[^\n]*/) || [''])[0]);
    ok(!decimalComma(enCopy), 'EN: no decimals written with a comma',
      (enCopy.match(/[^\n]*\d,\d{1,2}[^\n]*/) || [''])[0]);
    ok(/\(4,578 checks, p<0\.001\)/.test(enCopy),
      'EN prose: "4,578 checks, p<0.001"');
    await ctx.close();

    /* Grounding compares normalised numbers, whatever separator the model uses. */
    const top = [{ id: 'trend-change' }];
    const prompt = 'total 4.578 casos, p<0.001, rate 93%';
    const good = Insights.parseRewrites(JSON.stringify({
      rewrites: [{ id: 'trend-change', text: 'Hubo 4,578 casos con p<0,001.' }]
    }), { prompt: prompt, top: top });
    ok(good !== null, 'grounding accepts 4,578 for a prompt that says 4.578');
    const bad = Insights.parseRewrites(JSON.stringify({
      rewrites: [{ id: 'trend-change', text: 'Hubo 9.999 casos con p<0,001.' }]
    }), { prompt: prompt, top: top });
    ok(bad === null, 'grounding still rejects a number the prompt never had');
    ok(Insights.formatNumbers('4,578 casos') === '4,578 casos' &&
      Insights.formatNumbers('0.001') === '0.001',
      'node (no I18N): English formatting is the default');
  }

  /* ======================================================= 3 · the matrix */
  head('3 · the confusion matrix labels are whole and inside the viewport');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(UNIT, { waitUntil: 'load' });
    await page.waitForSelector('#matrixCanvas');
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__setTheme('dark'));

    const m = await page.evaluate(() => {
      const canvas = document.getElementById('matrixCanvas');
      return {
        rect: canvas.getBoundingClientRect().toJSON(),
        layout: JSON.parse(canvas.getAttribute('data-matrix-layout') || 'null'),
        expected: Insights.buildAnalysis(7).evaluation.labels.map((l) => I18N.t(l)),
        vw: window.innerWidth
      };
    });
    ok(m.layout && m.layout.rows && m.layout.rows.length === 3,
      'the matrix publishes its rendered label boxes');
    ok(m.rect.left >= 0 && m.rect.right <= m.vw + 0.5,
      '390px: the matrix canvas fits the viewport',
      m.rect.left + '..' + m.rect.right + ' of ' + m.vw);
    if (m.layout) {
      ok(JSON.stringify(m.layout.labels) === JSON.stringify(m.expected),
        'every matrix label is the full word, not a truncation',
        JSON.stringify(m.layout.labels) + ' vs ' + JSON.stringify(m.expected));
      ok(m.layout.gutter >= 10 && m.layout.cellsX >= m.layout.gutter,
        'the labels get a gutter before the cells', JSON.stringify({
          gutter: m.layout.gutter, cellsX: m.layout.cellsX
        }));
      m.layout.rows.forEach((r) => {
        const left = m.rect.left + r.x;
        const right = left + r.w;
        ok(r.x >= 0 && r.x + r.w <= m.layout.width,
          'matrix row "' + r.text + '" is inside the canvas',
          'x ' + r.x + ' + w ' + r.w + ' > ' + m.layout.width);
        ok(left >= 0 && right <= m.vw + 0.5,
          'matrix row "' + r.text + '" is fully inside the viewport',
          left.toFixed(1) + '..' + right.toFixed(1) + ' of ' + m.vw);
        ok(r.x + r.w <= m.layout.cellsX,
          'matrix row "' + r.text + '" is not painted over by a cell',
          r.x + r.w + ' > ' + m.layout.cellsX);
      });
    }
    await ctx.close();
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
