/* ==========================================================================
   tests/ask.test.js — "Ask the unit": questions over anonymous totals
   node tests/ask.test.js   (run from the prototype folder)
   Pass lines fixed before writing js/ask.js:
     - rules route >= 9 of 10 held-out questions (EN + ES) to the right topic
     - a question about a person is refused locally: the transport is
       never called
     - a model answer citing a number that is not in the facts is dropped
       and the rules answer instead
     - every rules answer cites only numbers that are in the facts
   ========================================================================== */

const Ask = require('../js/ask.js');

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

const AGG = {
  unit: '4B',
  moments: [
    { name: 'Before the patient', done: 1284, total: 1362, pct: 94 },
    { name: 'Before a clean procedure', done: 402, total: 451, pct: 89 },
    { name: 'After fluid exposure', done: 191, total: 269, pct: 71 },
    { name: 'After the patient', done: 1188, total: 1381, pct: 86 },
    { name: 'After the surroundings', done: 508, total: 819, pct: 62 }
  ],
  hours: [0, 0, 0, 0, 0, 2, 9, 28, 34, 31, 27, 24, 19, 14, 11, 12, 16, 21, 26, 33, 29, 12, 5, 1],
  shiftChangeHour: 19,
  corrections: 37
};
const EXTRA = {
  weeks: [0.84, 0.845, 0.85, 0.82, 0.93, 0.93].map((r, i) => ({ week: i, rate: r })),
  trend: 'improving',
  forecast: 0.89,
  model: { accuracy: 0.994, baseline: 0.978, streams: 360 }
};
const facts = Ask.buildFacts(AGG, EXTRA);

function numbersIn(text) {
  return (String(text).match(/\d+(?:\.\d+)?/g) || []).map((n) => String(Number(n)));
}
const factNums = new Set(numbersIn(JSON.stringify(facts)));

head('1 · facts are anonymous aggregates');
{
  ok(facts.unitMeanPct > 0 && facts.unitMeanPct < 100, 'unit mean is a percent', facts.unitMeanPct);
  ok(facts.weakest.moment === 'After the surroundings', 'weakest moment found', facts.weakest.moment);
  ok(facts.hourBuckets.length === 8, 'eight 3-hour buckets', facts.hourBuckets.length);
  ok(!/name|nurse|person|staff/i.test(JSON.stringify(Object.keys(facts))), 'no person-shaped keys');
  let threw = false;
  try { Ask.buildFacts(Object.assign({}, AGG, { nurse: 'Ana' }), EXTRA); } catch (e) { threw = true; }
  ok(threw, 'a person field in the input throws');
}

head('2 · routing on held-out questions (EN + ES)');
{
  const cases = [
    ['¿Dónde se cae más el proceso?', 'weakest'],
    ['Which moment is weakest?', 'weakest'],
    ['¿A qué hora se lavan menos las manos?', 'hours'],
    ['When does the unit wash the least?', 'hours'],
    ['¿Estamos mejorando estas semanas?', 'trend'],
    ['Is compliance improving?', 'trend'],
    ['¿Qué tan seguido se equivoca el reloj?', 'watch'],
    ['¿Cómo va después del entorno?', 'moment'],
    ['¿Qué arreglo pruebo primero?', 'fix'],
    ['What is the best moment?', 'strongest']
  ];
  let hits = 0;
  const misses = [];
  cases.forEach(([q, want]) => {
    const got = Ask.intent(q);
    if (got === want) hits++; else misses.push(q + ' -> ' + got);
  });
  ok(hits >= 9, 'rules route >= 9 of 10 questions', hits + '/10 ' + misses.join(' | '));
}

head('2b · the five suggested questions route right, both languages');
{
  const chips = [
    ['Where does the process slip?', 'weakest'], ['¿Dónde se cae el proceso?', 'weakest'],
    ['When do we wash least?', 'hours'], ['¿A qué hora nos lavamos menos?', 'hours'],
    ['Are we improving?', 'trend'], ['¿Estamos mejorando?', 'trend'],
    ['How reliable is the watch?', 'watch'], ['¿Qué tan confiable es el reloj?', 'watch'],
    ['What should we fix first?', 'fix'], ['¿Qué arreglamos primero?', 'fix']
  ];
  chips.forEach(([q, want]) => ok(Ask.intent(q) === want, q + ' -> ' + want, Ask.intent(q)));
}

head('3 · people are refused locally');
{
  ['¿Quién se lava menos?', 'Which nurse misses the most?', '¿Cómo le va a María en la noche?',
    'Show me Carlos Pérez'].forEach((q) => {
    ok(Ask.guard(q) === 'person', 'refused: ' + q, Ask.guard(q));
  });
  ['¿Dónde se cae el proceso?', 'How is the WHO moment before the patient?'].forEach((q) => {
    ok(Ask.guard(q) === null, 'allowed: ' + q, Ask.guard(q));
  });
}

head('4 · rules answers are grounded, both languages');
{
  ['weakest', 'strongest', 'hours', 'trend', 'watch', 'fix', 'moment', 'help'].forEach((it) => {
    ['en', 'es'].forEach((lang) => {
      const q = it === 'moment' ? (lang === 'es' ? 'después del entorno' : 'after the surroundings') : '';
      const a = Ask.rulesAnswer(facts, it, lang, q);
      const stray = numbersIn(a).filter((n) => !factNums.has(n));
      ok(a.length > 20 && stray.length === 0, it + ' (' + lang + ') cites only facts',
        a + (stray.length ? ' STRAY ' + stray.join(',') : ''));
    });
  });
  const es = Ask.rulesAnswer(facts, 'weakest', 'es', '');
  ok(/Después del entorno/.test(es) && /62%/.test(es), 'Spanish names the moment and its number', es);
  ok(!/\b(the|and)\b/.test(es), 'Spanish answer has no English', es);
}

head('5 · the chain: guard, consent, grounding, fallback');
(async () => {
  let called = 0;
  const transport = (text) => ({ query: async () => { called++; return { ok: true, model: 'gemma4:31b-cloud', text }; } });

  const r1 = await Ask.request('¿Quién se lava menos?', facts,
    { transport: transport('{"answer":"x"}'), consent: 'yes' }, 'es');
  ok(r1.refused === true && called === 0, 'a person question never reaches the model', JSON.stringify(r1));
  ok(/no tiene personas/i.test(r1.answer), 'the refusal says why and what to ask', r1.answer);

  const r2 = await Ask.request('¿Dónde se cae el proceso?', facts,
    { transport: transport('{"answer":"Después del entorno marca 62% frente a 83% de la unidad."}'), consent: 'yes' }, 'es');
  ok(r2.source === 'Ollama · gemma4:31b-cloud', 'a grounded model answer is used', r2.source + ' ' + r2.answer);

  const r3 = await Ask.request('¿Dónde se cae el proceso?', facts,
    { transport: transport('{"answer":"Después del entorno marca 47% y bajó 13 puntos."}'), consent: 'yes' }, 'es');
  ok(r3.source === 'Rules' && /62%/.test(r3.answer), 'an invented number drops to rules', r3.answer);

  const r4 = await Ask.request('¿Dónde se cae el proceso?', facts,
    { transport: transport('{"answer":"La enfermera tiene la culpa: 62%."}'), consent: 'yes' }, 'es');
  ok(r4.source === 'Rules', 'blame wording drops to rules', r4.answer);

  const r4b = await Ask.request('When do we wash least?', facts,
    { transport: transport('{"answer":"The quietestWindow is 21:00-00:00 with 6 washes per hour."}'), consent: 'yes' }, 'en');
  ok(r4b.source === 'Rules', 'a leaked JSON key drops to rules', r4b.answer);

  const r5 = await Ask.request('Which moment is weakest?', facts,
    { transport: transport('{"answer":"ok"}'), consent: 'no' }, 'en');
  ok(r5.source === 'Rules' && /After the surroundings/.test(r5.answer), 'no consent, rules answer', r5.answer);

  const r6 = await Ask.request('Which moment is weakest?', facts, {}, 'en');
  ok(r6.source === 'Rules', 'no transport (browser), rules answer');

  const p = Ask.prompt(facts, '¿Dónde se cae el proceso?', 'es');
  ok(/Spanish/.test(p) && /JSON/.test(p), 'the prompt asks for Spanish JSON');

  console.log('\n  ' + pass + ' passed, ' + (process.exitCode ? 'some' : 0) + ' failed\n');
})();
