/* ==========================================================================
   ask.js — "Ask the unit": infection control asks in plain words, the
   answer comes only from the anonymous unit totals.

     buildFacts(agg, extra)    the only data any answer may use
     guard(question)           'person' when the question names or seeks
                               a person; it is refused here, nothing leaves
     intent(question)          weakest | strongest | hours | trend | watch |
                               fix | moment | help  (EN + ES keywords)
     rulesAnswer(facts, intent, lang, question)   offline answer
     prompt(facts, question, lang)                model prompt (JSON reply)
     parse(text, ctx)          schema + no-blame + grounding, else null
     request(question, facts, deps, lang)  guard -> consent -> model -> rules

   Grounded = every number in the model's answer appears in the facts or
   the question. Anything else is dropped and the rules answer instead.
   Works as a plain <script> (window.Ask) and under node (require).
   ========================================================================== */

var Ask = (function () {
  'use strict';

  var ANSWER_MAX = 420;
  var MIN_BUCKET_N = 10;

  /* blame words in both languages: the process slips, people do not fail */
  var BLAME_RE = /\b(fail\w*|fault\w*|blam\w*|neglig\w*|lazy|careless|culpa\w*|negligen\w*|incumpl\w*|perezos\w*|descuid\w*|sancion\w*|castig\w*)\b/i;
  var PERSON_KEY_RE = /^(nurse|nurses|person|people|staff|staffid|employee|user|userid|wearer|badge)$/i;

  function strings() {
    if (typeof STRINGS_ES !== 'undefined') return STRINGS_ES;
    if (typeof require === 'function') {
      try { return require('./strings-es.js'); } catch (e) { return null; }
    }
    return null;
  }

  /* Spanish for a known English string, else the string itself */
  function es(s) {
    var S = strings();
    return (S && Object.prototype.hasOwnProperty.call(S.exact, s)) ? S.exact[s] : s;
  }

  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* --- facts ------------------------------------------------------------- */

  function assertAnonymous(v) {
    if (!v || typeof v !== 'object') return;
    Object.keys(v).forEach(function (k) {
      if (PERSON_KEY_RE.test(k)) throw new Error('person-shaped field: ' + k);
      assertAnonymous(v[k]);
    });
  }

  var FIX = [
    [/surrounding/i, 'Move a dispenser to the room exit and recheck at handover.'],
    [/fluid/i, 'Set gloves and gel on one tray so cleanup ends with a rub.'],
    [/clean/i, 'Keep a gel bottle on the procedure cart and recheck next week.'],
    [/before/i, 'Move the reminder 5 min earlier for entries and recheck next week.'],
    [/after/i, 'Place a dispenser at the room exit and recheck at handover.']
  ];
  var HOUR_FIX = 'Shift the reminder 10 min earlier through this window.';

  function fixFor(moment) {
    for (var i = 0; i < FIX.length; i++) if (FIX[i][0].test(moment)) return FIX[i][1];
    return 'Nudge the reminder earlier for this moment and recheck next week.';
  }

  function buildFacts(agg, extra) {
    assertAnonymous(agg);
    assertAnonymous(extra);
    extra = extra || {};
    var moments = (agg.moments || []).map(function (m) {
      return { moment: String(m.name || m.moment), pct: Math.round(Number(m.pct) || 0),
        done: Number(m.done) || 0, total: Number(m.total) || 0 };
    });
    var done = 0, total = 0;
    moments.forEach(function (m) { done += m.done; total += m.total; });
    var mean = total ? Math.round(done / total * 100) : 0;
    moments.forEach(function (m) { m.vsMean = m.pct - mean; });
    var sorted = moments.slice().sort(function (a, b) { return a.pct - b.pct; });

    var hours = (agg.hours || []).slice(0, 24).map(function (v) { return Number(v) || 0; });
    var all = hours.reduce(function (s, v) { return s + v; }, 0);
    var buckets = [];
    for (var b = 0; b < 8; b++) {
      var t = 0;
      for (var h = 0; h < 3; h++) t += hours[b * 3 + h] || 0;
      buckets.push({ window: pad2(b * 3) + ':00-' + pad2((b * 3 + 3) % 24) + ':00',
        washes: t, perHour: Math.round(t / 3) });
    }
    var active = buckets.filter(function (x) { return x.washes >= MIN_BUCKET_N; });
    var quiet = active.slice().sort(function (a, b2) { return a.washes - b2.washes; })[0] || null;
    var busy = active.slice().sort(function (a, b2) { return b2.washes - a.washes; })[0] || null;
    var sc = Number(agg.shiftChangeHour) || 19;
    var scWin = 0;
    for (var k = sc - 1; k <= sc + 1; k++) scWin += hours[(k + 24) % 24] || 0;

    var weeks = (extra.weeks || []).map(function (w, i) {
      return { week: (w.week === undefined ? i : w.week) + 1, compliancePct: Math.round((Number(w.rate) || 0) * 100) };
    });
    var model = extra.model || null;

    var facts = {
      unit: String(agg.unit || '4B'),
      windowDays: 14,
      unitMeanPct: mean,
      moments: moments,
      weakest: sorted.length ? { moment: sorted[0].moment, pct: sorted[0].pct } : null,
      strongest: sorted.length ? { moment: sorted[sorted.length - 1].moment, pct: sorted[sorted.length - 1].pct } : null,
      hourBuckets: buckets,
      unitPerHour: Math.round(all / 24),
      quietestWindow: quiet,
      busiestWindow: busy,
      shiftChange: { at: pad2(sc) + ':00', perHour: Math.round(scWin / 3) },
      weeks: weeks,
      trend: String(extra.trend || 'no significant change'),
      forecastPct: extra.forecast === undefined ? null : Math.round(extra.forecast * 100),
      corrections: Number(agg.corrections) || 0,
      /* the fixes the unit already uses: the model may recommend these */
      playbook: {
        weakestMoment: sorted.length ? fixFor(sorted[0].moment) : null,
        quietWindow: HOUR_FIX
      },
      watchModel: model ? {
        trainedModelAccuracyPct: Math.round(model.accuracy * 100),
        oldHandWrittenRulesAccuracyPct: Math.round(model.baseline * 100),
        unseenTestStreams: Number(model.streams) || 0,
        data: 'synthetic, from the simulator'
      } : null
    };
    assertAnonymous(facts);
    return facts;
  }

  /* --- guard: people are refused before anything leaves ------------------- */

  var ALLOW_CAPS = /^(WHO|OMS|UCI|ICU|AM|PM|OK|I|Unit|Unidad|Ollama|Gemma)$/;

  function guard(question) {
    var q = String(question || '');
    var f = fold(q);
    if (/\b(who|quien(es)?|nombre|nombres|name|names|nurse|nurses|enfermer[oa]s?|persona|personas|person|people|staff|empleado|empleada|which one of them|cual de ellos)\b/.test(f)) {
      /* "WHO moment" is the World Health Organization, not a person */
      var stripped = q.replace(/\bWHO\b/g, '');
      if (/\b(who|quien(es)?|nombre|nombres|name|names|nurse|nurses|enfermer[oa]s?|persona|personas|person|people|staff|empleado|empleada)\b/.test(fold(stripped))) {
        return 'person';
      }
    }
    /* a capitalized word that does not start a sentence reads as a name */
    var tokens = q.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var raw = tokens[i];
      var w = raw.replace(/^[¿¡"'(]+|[?!.,;:"')]+$/g, '');
      if (!w || !/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(w)) continue;
      if (ALLOW_CAPS.test(w)) continue;
      var prev = i ? tokens[i - 1] : '';
      var starts = i === 0 || /^[¿¡]/.test(raw) || /[.?!]$/.test(prev);
      if (!starts) return 'person';
    }
    return null;
  }

  /* --- intent -------------------------------------------------------------- */

  var MOMENT_WORDS = [
    [/antes del paciente|before (the )?patient/, 'Before the patient'],
    [/procedimiento|procedure|clean task/, 'Before a clean procedure'],
    [/fluid|fluidos/, 'After fluid exposure'],
    [/despues del paciente|after (the )?patient/, 'After the patient'],
    [/entorno|surrounding/, 'After the surroundings']
  ];

  function namedMoment(question) {
    var f = fold(question);
    for (var i = 0; i < MOMENT_WORDS.length; i++) {
      if (MOMENT_WORDS[i][0].test(f)) return MOMENT_WORDS[i][1];
    }
    return null;
  }

  function intent(question) {
    var f = fold(question);
    var weak = /(peor|worst|weak|debil|lowest|mas bajo|se cae|slip|falla|flojo)/.test(f);
    var strong = /(best|strongest|highest|mejor momento|el mejor|mas alto|mas fuerte)/.test(f);
    if (namedMoment(question) && !weak && !strong) return 'moment';
    if (/(equivoc|wrong|mistak|correcc|correction|accura|exactitud|precis|modelo|\bmodel\b|false|falso|se confunde|confiab|fiable|reliab|trust)/.test(f)) return 'watch';
    if (/(arregl|\bfix|recomien|recommend|should we|deberia|pruebo|probamos|try first|que hago|que hacemos|\baccion|\baction)/.test(f)) return 'fix';
    if (/(mejorando|improv|trend|tendencia|semana|\bweeks?\b|empeor|declin|evolu|progres|\bvamos\b|\bgoing\b)/.test(f)) return 'trend';
    if (/(hora|hour|when|cuando|noche|night|turno|shift|tarde|manana|morning|afternoon|madrugada)/.test(f)) return 'hours';
    if (strong) return 'strongest';
    if (weak || /(menos|least|lowest|bajo)/.test(f)) return 'weakest';
    return 'help';
  }

  /* --- rules answers --------------------------------------------------------- */

  function trendWord(t, lang) {
    if (lang !== 'es') return t;
    return { improving: 'mejorando', declining: 'empeorando' }[t] || 'sin cambio significativo';
  }

  function rulesAnswer(facts, it, lang, question) {
    var ES = lang === 'es';
    var M = function (m) { return ES ? es(m) : m; };
    var F = function (s) { return ES ? es(s) : s; };
    var w = facts.weakest, s = facts.strongest, q = facts.quietestWindow;
    var mean = facts.unitMeanPct;
    var find = function (name) {
      return facts.moments.filter(function (m) { return m.moment === name; })[0];
    };
    switch (it) {
      case 'weakest': {
        var wm = find(w.moment);
        return ES
          ? M(w.moment) + ' es el momento más débil: ' + w.pct + '% (' + wm.done + ' de ' + wm.total +
            ') frente a ' + mean + '% de la unidad. ' + F(fixFor(w.moment))
          : w.moment + ' is the weakest moment: ' + w.pct + '% (' + wm.done + ' of ' + wm.total +
            ') vs ' + mean + '% for the unit. ' + fixFor(w.moment);
      }
      case 'strongest': {
        var sm = find(s.moment);
        return ES
          ? M(s.moment) + ' es el momento más fuerte: ' + s.pct + '% (' + sm.done + ' de ' + sm.total +
            '). Sirve de modelo para los demás.'
          : s.moment + ' is the strongest moment: ' + s.pct + '% (' + sm.done + ' of ' + sm.total +
            '). Use its setup as the model for the rest.';
      }
      case 'hours':
        if (!q) break;
        return ES
          ? 'La franja con actividad más quieta es ' + q.window + ': ' + q.perHour +
            ' lavados por hora frente a ' + facts.unitPerHour + ' de media. En el cambio de turno (' +
            facts.shiftChange.at + ') sube a ' + facts.shiftChange.perHour + '. ' + F(HOUR_FIX)
          : 'The quietest active window is ' + q.window + ': ' + q.perHour +
            ' washes per hour vs ' + facts.unitPerHour + ' on average. At shift change (' +
            facts.shiftChange.at + ') it rises to ' + facts.shiftChange.perHour + '. ' + HOUR_FIX;
      case 'trend': {
        var ws = facts.weeks;
        if (!ws.length) break;
        var a = { pct: ws[0].compliancePct }, z = { pct: ws[ws.length - 1].compliancePct };
        var fc = facts.forecastPct;
        return ES
          ? 'En ' + ws.length + ' semanas el cumplimiento pasó de ' + a.pct + '% a ' + z.pct +
            '%; la tendencia está ' + trendWord(facts.trend, 'es') + '.' +
            (fc === null ? '' : ' Para la próxima semana se espera cerca de ' + fc + '%.')
          : 'Over ' + ws.length + ' weeks compliance went from ' + a.pct + '% to ' + z.pct +
            '%; the trend reads ' + facts.trend + '.' +
            (fc === null ? '' : ' Next week should land near ' + fc + '%.');
      }
      case 'watch': {
        var wmod = facts.watchModel;
        var base = ES
          ? 'El personal corrigió al reloj ' + facts.corrections + ' veces en ' + facts.windowDays + ' días. Eso mide al reloj, no a la gente.'
          : 'Staff corrected the watch ' + facts.corrections + ' times in ' + facts.windowDays + ' days. That measures the watch, not the people.';
        if (!wmod) return base;
        return base + (ES
          ? ' En ' + wmod.unseenTestStreams + ' señales de prueba que nunca vio, el modelo entrenado acierta ' +
            wmod.trainedModelAccuracyPct + '% frente a ' + wmod.oldHandWrittenRulesAccuracyPct + '% de las reglas a mano (datos sintéticos).'
          : ' On ' + wmod.unseenTestStreams + ' test streams it never saw, the trained model reads ' +
            wmod.trainedModelAccuracyPct + '% vs ' + wmod.oldHandWrittenRulesAccuracyPct + '% for hand-written rules (synthetic data).');
      }
      case 'fix':
        return ES
          ? 'Primero ' + M(w.moment) + ' (' + w.pct + '%): ' + F(fixFor(w.moment)) +
            (q ? ' Después ' + q.window + ': ' + F(HOUR_FIX) : '')
          : 'Start with ' + w.moment + ' (' + w.pct + '%): ' + fixFor(w.moment) +
            (q ? ' Then ' + q.window + ': ' + HOUR_FIX : '');
      case 'moment': {
        var name = namedMoment(question);
        var m = name && find(name);
        if (!m) break;
        var gap = Math.abs(m.vsMean);
        if (gap === 0) {
          return ES
            ? M(m.moment) + ': ' + m.pct + '% (' + m.done + ' de ' + m.total + '), igual a la media de la unidad.'
            : m.moment + ': ' + m.pct + '% (' + m.done + ' of ' + m.total + '), level with the unit mean.';
        }
        return ES
          ? M(m.moment) + ': ' + m.pct + '% (' + m.done + ' de ' + m.total + '), ' + gap + ' puntos ' +
            (m.vsMean < 0 ? 'por debajo' : 'por encima') + ' de la media de ' + mean + '%.' +
            (m.vsMean < 0 ? ' ' + F(fixFor(m.moment)) : '')
          : m.moment + ': ' + m.pct + '% (' + m.done + ' of ' + m.total + '), ' + gap + ' points ' +
            (m.vsMean < 0 ? 'below' : 'above') + ' the ' + mean + '% unit mean.' +
            (m.vsMean < 0 ? ' ' + fixFor(m.moment) : '');
      }
    }
    return ES
      ? 'Respondo con los totales anónimos de la unidad: el momento más débil, las horas más quietas, la tendencia de ' +
        facts.weeks.length + ' semanas, cuántas veces se equivocó el reloj y qué arreglo probar primero.'
      : 'I answer from the anonymous unit totals: the weakest moment, the quietest hours, the ' +
        facts.weeks.length + '-week trend, how often the watch was wrong, and which fix to try first.';
  }

  function refusal(lang) {
    return lang === 'es'
      ? 'Esta vista no tiene personas: el reloj no guarda nombres, así que nadie se puede buscar. Pregunta por un momento, una hora o la tendencia.'
      : 'This view has no people: the watch never stores names, so no one can be looked up. Ask about a moment, an hour or the trend.';
  }

  /* --- model ------------------------------------------------------------------ */

  /* The model sees the facts in the answer language, so it copies Spanish
     names instead of leaking English ones. Numbers are untouched. */
  function localize(facts, lang) {
    if (lang !== 'es') return facts;
    var f = JSON.parse(JSON.stringify(facts));
    f.moments.forEach(function (m) { m.moment = es(m.moment); });
    if (f.weakest) f.weakest.moment = es(f.weakest.moment);
    if (f.strongest) f.strongest.moment = es(f.strongest.moment);
    f.trend = trendWord(f.trend, 'es');
    f.playbook.weakestMoment = es(f.playbook.weakestMoment);
    f.playbook.quietWindow = es(f.playbook.quietWindow);
    if (f.watchModel) f.watchModel.data = 'sintéticos, del simulador';
    return f;
  }

  function prompt(facts, question, lang) {
    facts = localize(facts, lang);
    return 'You answer an infection-control lead about hand hygiene in Unit ' + facts.unit + '. ' +
      'FACTS (anonymous unit totals, ' + facts.windowDays + ' days, synthetic demo data): ' +
      JSON.stringify(facts) + ' QUESTION: ' + JSON.stringify(String(question).slice(0, 200)) + ' ' +
      'Answer in ' + (lang === 'es' ? 'Spanish (Colombia, neutral, use "tú")' : 'English') + ', ' +
      '1-3 short sentences, max 400 characters. Use only numbers that appear in FACTS. ' +
      'Talk about the process (moments, hours, dispensers, reminders, handover), never about ' +
      'individual people, and never blame anyone. If FACTS cannot answer, say which of these it can: ' +
      'weakest moment, quiet hours, trend, watch corrections, first fix. ' +
      'Write moment names and fixes exactly as FACTS words them. ' +
      'Never write the FACTS key names (like forecastPct); say what they mean in plain words. ' +
      'Reply JSON only: {"answer": "..."}';
  }

  function numbers(text) {
    var out = {};
    (String(text).match(/\d+(?:\.\d+)?/g) || []).forEach(function (n) { out[String(Number(n))] = 1; });
    return out;
  }

  function parseJson(text) {
    var t = String(text == null ? '' : text).trim();
    var f = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
    if (f) t = f[1].trim();
    try { return JSON.parse(t); } catch (e) {
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) { return null; } }
      return null;
    }
  }

  function parse(text, ctx) {
    var data = parseJson(text);
    if (!data || typeof data.answer !== 'string') return null;
    var a = data.answer.trim();
    if (!a || a.length > ANSWER_MAX + 40) return null;
    if (BLAME_RE.test(a)) return null;
    /* a leaked JSON key (quietestWindow) means the model echoed the data */
    if (/\b[a-z]+[A-Z][A-Za-z]*\b/.test(a)) return null;
    var allowed = numbers(JSON.stringify(ctx.facts) + ' ' + ctx.question);
    var used = String(a).match(/\d+(?:\.\d+)?/g) || [];
    for (var i = 0; i < used.length; i++) {
      if (!allowed[String(Number(used[i]))]) return null;
    }
    return a.slice(0, ANSWER_MAX);
  }

  /* deps: { transport, consent: 'yes'|'no'|null, onConsent(payload) } */
  async function request(question, facts, deps, lang) {
    deps = deps || {};
    var q = String(question || '').trim().slice(0, 200);
    var it = intent(q);
    var base = { question: q, intent: it, cited: null };
    if (guard(q) === 'person') {
      return Object.assign(base, { answer: refusal(lang), source: 'Rules', refused: true });
    }
    var rules = function () {
      return Object.assign(base, { answer: rulesAnswer(facts, it, lang, q), source: 'Rules', refused: false });
    };
    var transport = deps.transport || null;
    if (!transport || !q) return rules();
    var consent = deps.consent || null;
    if (consent !== 'yes') {
      if (consent === 'no' || typeof deps.onConsent !== 'function') return rules();
      var ans = 'no';
      try { ans = await deps.onConsent({ question: q, facts: facts }); } catch (e) { ans = 'no'; }
      if (ans !== 'yes') return rules();
    }
    try {
      var res = await transport.query(prompt(facts, q, lang));
      if (!res || !res.ok || typeof res.text !== 'string' || !res.model) return rules();
      var a = parse(res.text, { facts: facts, question: q });
      if (!a) return rules();
      return Object.assign(base, { answer: a, source: 'Ollama · ' + res.model, refused: false });
    } catch (e) {
      return rules();
    }
  }

  return {
    ANSWER_MAX: ANSWER_MAX,
    buildFacts: buildFacts,
    guard: guard,
    intent: intent,
    rulesAnswer: rulesAnswer,
    refusal: refusal,
    prompt: prompt,
    parse: parse,
    request: request
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Ask;
}
