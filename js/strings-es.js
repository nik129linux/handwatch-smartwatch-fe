/* ==========================================================================
   strings-es.js — Spanish (neutral Colombian, "tú") for every UI string.
   English source text is the key, so the code stays in English and every
   translatable string lives in this one file.
     exact     whole-string matches (whitespace collapsed)
     patterns  strings with numbers or nested parts; a function gets the
               match groups plus tr() to translate nested pieces
   Watch lines stay <= 4 words in Spanish too (acceptance checks it).
   ========================================================================== */

var STRINGS_ES = (function () {
  'use strict';

  var exact = {
    /* --- page chrome --- */
    'Hand Hygiene Watch': 'Reloj de Higiene de Manos',
    'Prototype · Unit 4B': 'Prototipo · Unidad 4B',
    'Day shift on Unit 4B': 'Turno de día en la Unidad 4B',
    'The watch taps, never sounds. Fix a mark with one tap.':
      'El reloj vibra, nunca suena. Corriges una marca con un toque.',
    'Switch theme': 'Cambiar tema',
    'Switch language': 'Cambiar idioma',
    'Watch': 'Reloj',
    'Simulator': 'Simulador',
    'Digital crown: scroll with the wheel, press for Home':
      'Corona digital: gira con la rueda, presiona para Inicio',
    'Side button: who sees this': 'Botón lateral: quién ve esto',
    'Turn the crown with the mouse wheel · the side button opens privacy':
      'Gira la corona con la rueda del mouse · el botón lateral abre la privacidad',

    /* --- simulator panel --- */
    'Guided shift': 'Turno guiado',
    '▶ Guided shift': '▶ Turno guiado',
    '▶ Running': '▶ En curso',
    'ready': 'listo',
    'Pause': 'Pausa',
    'Resume': 'Seguir',
    'Skip': 'Saltar',
    'Reset': 'Reiniciar',
    'Free mode': 'Modo libre',
    'active': 'activo',
    'Enter patient zone': 'Entrar a zona del paciente',
    'Wash detected': 'Lavado detectado',
    'Leave without washing': 'Salir sin lavarse',
    'Doubtful wash': 'Lavado dudoso',
    'Code blue': 'Código azul',
    'End shift': 'Terminar turno',
    'Real watch': 'Reloj real',
    'Send to my wrist': 'Enviar a mi muñeca',
    'on': 'sí',
    'off': 'no',
    'Phone on USB with the Hand Hygiene app: straight to the watch. No phone: the ntfy topic':
      'Teléfono por USB con la app Hand Hygiene: directo al reloj. Sin teléfono: el tema de ntfy',
    'How it reads motion': 'Cómo lee el movimiento',
    'signal · vibrations': 'señal · vibraciones',
    'Motion signal': 'Señal de movimiento',
    'Accelerometer waveform': 'Onda del acelerómetro',
    'Sensor noise': 'Ruido del sensor',
    'Run a motion to see why': 'Corre un movimiento para ver el porqué',
    'Vocabulary': 'Vocabulario',
    'Haptic vocabulary': 'Vocabulario de vibraciones',
    'four patterns': 'cuatro patrones',
    'Log': 'Registro',
    'Event log': 'Registro de eventos',
    'Nothing yet': 'Nada todavía',
    'See what Infection Control sees': 'Ver lo que ve Control de Infecciones',
    'Live vibration': 'Vibración en vivo',
    'No sound. Ever.': 'Sin sonido. Nunca.',
    'Why four': 'Por qué cuatro',
    'The alert goes to the body, not the screen. No pattern ever sounds: the buzz reaches the wrist, never in front of the patient.':
      'El aviso va al cuerpo, no a la pantalla. Ningún patrón suena: la vibración llega a la muñeca, nunca frente al paciente.',
    '“Reminder” and “this was logged wrong” cannot feel the same, so they do not look the same either. And a wrong mark is not a data point: it is her call to make, with one tap.':
      '“Acuérdate” y “esto quedó mal registrado” no pueden sentirse igual, así que tampoco se ven igual. Y una marca equivocada no es un dato: la decide quien la vive, con un toque.',
    'Why': 'Por qué',
    'Rules': 'Reglas',

    /* --- haptic vocabulary --- */
    'Reminder': 'Recordatorio',
    'Ok': 'Ok',
    'Doubtful': 'Dudoso',
    'End': 'Fin',
    'Due and missed': 'Tocaba y no pasó',
    'Wash logged': 'Lavado anotado',
    'Watch is unsure': 'El reloj duda',
    'Shift over': 'Fin de turno',
    'WKHapticTypeNotification (.notification)': 'WKHapticTypeNotification (.notification)',

    /* --- watch screens (<= 4 words) --- */
    'Home': 'Inicio',
    'Moments': 'Momentos',
    'moments': 'momentos',
    'Shift · Unit 4B': 'Turno · Unidad 4B',
    'Learning · fewer marks': 'Aprendiendo · menos marcas',
    'Last 3': 'Últimos 3',
    'All quiet': 'Todo tranquilo',
    'Pause 30 min': 'Pausa 30 min',
    'Bed 3': 'Cama 3',
    'Already did it': 'Ya lo hice',
    'Before the patient': 'Antes del paciente',
    'Before a clean procedure': 'Antes de procedimiento limpio',
    'After fluid exposure': 'Tras exposición a fluidos',
    'After the patient': 'Después del paciente',
    'After the surroundings': 'Después del entorno',
    'Washing': 'Lavando',
    'Done': 'Listo',
    'Confirm': 'Confirmar',
    'Did you wash?': '¿Te lavaste?',
    'Not sure': 'El reloj duda',
    'On exit': 'Al salir',
    'Yes, I did': 'Sí, me lavé',
    "Couldn't": 'No alcancé',
    'Noted. Thanks.': 'Anotado. Gracias.',
    'Stays with you.': 'Queda solo para ti.',
    'Only you see this.': 'Solo tú lo ves.',
    'Gone in 24 h.': 'Dura solo 24 h.',
    'Who sees this': 'Quién ve esto',
    'You': 'Tú',
    'Infection control': 'Control de infecciones',
    'unit totals, no names': 'totales, sin nombres',
    'No one': 'Nadie',
    'your location': 'tu ubicación',
    'Silence 30 min': 'Silenciar 30 min',
    'For emergencies': 'Para emergencias',
    'Resume alerts': 'Reanudar avisos',
    'Reset learning': 'Reiniciar aprendizaje',
    'Back': 'Atrás',
    'Close': 'Cerrar',
    'fixed': 'corregido',
    'by you': 'por ti',
    'muted': 'silenciado',
    'Alerts back on.': 'Avisos activos.',
    'Learning reset.': 'Aprendizaje reiniciado.',
    'Back to start': 'Volver al inicio',

    /* --- log + scope words --- */
    'wash': 'lavado',
    'gel': 'gel',
    'other': 'otro',
    'idle': 'quieto',
    'sure': 'seguro',
    'unsure': 'dudoso',
    'none': 'nada',
    'Doubt': 'Duda',
    'Fixed': 'Corregido',
    'Yours': 'Tuyo',
    'Wash': 'Lavado',
    'Reminder muted': 'Recordatorio silenciado',
    'Wash logged quietly': 'Lavado anotado en silencio',
    'Doubt muted': 'Duda silenciada',
    '30-min pause open': 'Pausa de 30 min activa',
    'Shift closed': 'Turno cerrado',

    /* --- guided story subtitles --- */
    'Shift starts.': 'Empieza el turno.',
    'The watch buzzes. No sound. The patient never notices.':
      'El reloj vibra. No suena. El paciente no se entera.',
    'The wash detects itself. No form exists.':
      'El lavado se detecta solo. No hay formulario.',
    'The watch was wrong. Fixed with one tap, no form.':
      'El reloj se equivocó. Se corrige con un toque, sin formulario.',
    'The watch was wrong. Answer on your wrist: one tap, no form.':
      'El reloj se equivocó. Responde en tu muñeca: un toque, sin formulario.',
    'In an emergency, the watch stays quiet.': 'En una emergencia, el reloj se calla.',
    'The reminder came and stayed logged.': 'El recordatorio llegó y quedó anotado.',
    'Before entering, the wash anyway.': 'Antes de entrar, el lavado igual.',
    'Details are yours. The unit sees totals only.':
      'El detalle es tuyo. La unidad solo ve totales.',

    /* --- real-watch alerts (title <= 4 words) --- */
    'Wash hands': 'Lávate las manos',
    'Moment due': 'Toca un momento',
    'Noted': 'Anotado',
    'Before patient': 'Antes del paciente',
    'Before clean task': 'Antes de tarea limpia',
    'After fluids': 'Tras fluidos',
    'After patient': 'Después del paciente',
    'After surroundings': 'Después del entorno',

    /* --- unit page --- */
    'Unit 4B · Infection control': 'Unidad 4B · Control de infecciones',
    'Unit 4B': 'Unidad 4B',
    'Infection Control': 'Control de Infecciones',
    'Demo data': 'Datos de demostración',
    'Unit': 'Unidad',
    'Measure': 'Mide',
    'the process': 'el proceso',
    ', not the people.': ', no a las personas.',
    'Back to the watch': 'Volver al reloj',
    'Compliance by moment': 'Cumplimiento por momento',
    'The five WHO moments': 'Los cinco momentos de la OMS',
    'Average of the last 14 days. A measure of the unit process, not of any person.':
      'Promedio de los últimos 14 días. Mide el proceso de la unidad, no a ninguna persona.',
    'Behavior by hour': 'Comportamiento por hora',
    'When the unit washes': 'Cuándo se lava la unidad',
    'Washes per hour, shift average. Stronger color means more washes.':
      'Lavados por hora, promedio del turno. Color más intenso, más lavados.',
    '19:00 · Shift change: the highest peak and the highest risk of a skipped wash.':
      '19:00 · Cambio de turno: el pico más alto y el mayor riesgo de saltarse un lavado.',
    'Trends': 'Tendencias',
    'Six weeks, one line': 'Seis semanas, una línea',
    'Weekly compliance with 95% intervals. The marker shows where the trend shifted; the hollow dot is next week forecast.':
      'Cumplimiento semanal con intervalos del 95%. La marca muestra dónde cambió la tendencia; el punto hueco es el pronóstico de la próxima semana.',
    'Weekly compliance trend with shift marker and forecast':
      'Tendencia semanal de cumplimiento con marca de cambio y pronóstico',
    'Insights': 'Hallazgos',
    'What the numbers support': 'Lo que los números sostienen',
    'Ranked by significance and effect size. Small samples are reported as not enough data, never as findings.':
      'Ordenados por significancia y tamaño del efecto. Las muestras pequeñas se reportan como datos insuficientes, nunca como hallazgos.',
    'Compliance rate by three-hour window with intervals':
      'Tasa de cumplimiento por ventana de tres horas con intervalos',
    'Model quality': 'Calidad del modelo',
    'How the watch reads motion': 'Cómo lee el reloj el movimiento',
    'Rows are truth, columns are predictions.': 'Filas: la verdad. Columnas: la predicción.',
    'Stated certainty against observed hit rate; dot size is sample count.':
      'Certeza declarada contra acierto observado; el tamaño del punto es el número de muestras.',
    'Confusion matrix of predicted against true motion':
      'Matriz de confusión del movimiento predicho contra el real',
    'Reliability curve of stated against observed accuracy':
      'Curva de confiabilidad de la certeza declarada contra la observada',
    'Precision recall and F1 by moment type': 'Precisión, recall y F1 por tipo de movimiento',
    'Moment': 'Movimiento',
    'Precision': 'Precisión',
    'Recall': 'Recall',
    'F1': 'F1',
    'Checks': 'Casos',
    'System fixes': 'Arreglos del sistema',
    'Where the process slips': 'Dónde se cae el proceso',
    'From anonymous totals only: the weakest moment and the quietest hours, with the numbers behind each fix.':
      'Solo con totales anónimos: el momento más débil y las horas más quietas, con los números detrás de cada arreglo.',
    'Improve with Ollama': 'Mejorar con IA',
    'Rewrite with Ollama': 'Reescribir con IA',
    'Staff corrections': 'Correcciones del personal',
    'The watch was wrong': 'El reloj se equivocó',
    'corrections in 14 days.': 'correcciones en 14 días.',
    'How often the watch was wrong and someone fixed it.':
      'Cuántas veces el reloj se equivocó y alguien lo corrigió.',
    'Measures the watch, not the people.': 'Mide al reloj, no a la gente.',
    'This view has no names.': 'Esta vista no tiene nombres.',
    'There is no per-person filter.': 'No existe un filtro por persona.',
    'Synthetic data: it measures the model against the simulator, not a ward.':
      'Datos sintéticos: mide el modelo contra el simulador, no contra una sala real.',

    /* --- rules AI lines --- */
    'The rub was short or broken by noise, so the watch asked instead of deciding.':
      'La fricción fue corta o tuvo ruido, así que el reloj preguntó en vez de decidir.',
    'Hands were still damp and moving on exit, so the watch asked instead of deciding.':
      'Las manos seguían húmedas y en movimiento al salir, así que el reloj preguntó en vez de decidir.',
    'The rub sat near the unsure line, so the watch asked instead of deciding.':
      'La fricción quedó cerca de la línea de duda, así que el reloj preguntó en vez de decidir.',
    'Cleanup motion looks like a rub to the sensor, so the watch asked instead of deciding.':
      'Limpiar se parece a frotarse para el sensor, así que el reloj preguntó en vez de decidir.',
    'A touch of the bedside reads half like a rub, so the watch asked instead of deciding.':
      'Tocar la cama se lee casi como frotarse, así que el reloj preguntó en vez de decidir.',
    'The signal sat near the unsure line, so the watch asked instead of deciding.':
      'La señal quedó cerca de la línea de duda, así que el reloj preguntó en vez de decidir.',
    'Move a dispenser to the room exit and recheck at handover.':
      'Mueve un dispensador a la salida de la habitación y revisa en el cambio de turno.',
    'Set gloves and gel on one tray so cleanup ends with a rub.':
      'Pon guantes y gel en una misma bandeja para que la limpieza termine con fricción.',
    'Keep a gel bottle on the procedure cart and recheck next week.':
      'Deja un frasco de gel en el carro de procedimientos y revisa la próxima semana.',
    'Move the reminder 5 min earlier for entries and recheck next week.':
      'Adelanta 5 min el recordatorio al entrar y revisa la próxima semana.',
    'Place a dispenser at the room exit and recheck at handover.':
      'Pon un dispensador en la salida de la habitación y revisa en el cambio de turno.',
    'Shift the reminder 10 min earlier through this window.':
      'Adelanta 10 min el recordatorio en esta franja.',
    'Add a 2 min handover overlap at shift change and recheck next week.':
      'Suma 2 min de traslape en el cambio de turno y revisa la próxima semana.',
    'Nudge the reminder earlier for this moment and recheck next week.':
      'Adelanta un poco el recordatorio de este momento y revisa la próxima semana.',
    'Move a dispenser to cover this window and recheck at handover.':
      'Mueve un dispensador para cubrir esta franja y revisa en el cambio de turno.',
    'Keep the current setup here and recheck next week.':
      'Mantén la configuración actual y revisa la próxima semana.',
    'Keep the handover overlap and recheck in two weeks.':
      'Mantén el traslape del cambio de turno y revisa en dos semanas.',

    /* --- consent sheet --- */
    'Share anonymous totals': 'Compartir totales anónimos',
    'Share anonymous totals?': '¿Compartir totales anónimos?',
    'Only this leaves this computer, for the Ollama model (local, or ollama.com for -cloud models). No names, no people. The model may only cite these numbers back.':
      'Solo esto sale de este computador, hacia el modelo de Ollama (local, u ollama.com en los modelos -cloud). Sin nombres, sin personas. El modelo solo puede citar estos números.',
    'Not now': 'Ahora no',
    'Allow once': 'Permitir una vez',

    /* --- ask the unit --- */
    'Ask the unit': 'Pregúntale a la unidad',
    'Ask in plain words': 'Pregunta con tus palabras',
    'Answers use only the anonymous totals on this page. A question about a person is refused here, before anything leaves.':
      'Las respuestas usan solo los totales anónimos de esta página. Una pregunta sobre una persona se rechaza aquí, antes de que salga nada.',
    'Your question': 'Tu pregunta',
    'Ask': 'Preguntar',
    'Where does the process slip?': '¿Dónde se cae el proceso?',
    'When do we wash least?': '¿A qué hora nos lavamos menos?',
    'Are we improving?': '¿Estamos mejorando?',
    'How reliable is the watch?': '¿Qué tan confiable es el reloj?',
    'What should we fix first?': '¿Qué arreglamos primero?',

    /* --- canvas labels --- */
    'W': 'S',
    'shift': 'cambio',
    'next': 'próx',
    'stated': 'declarada',
    'hit rate': 'acierto',

    /* --- trend verdicts --- */
    'improving': 'mejorando',
    'declining': 'empeorando',
    'no significant change': 'sin cambio significativo'
  };

  /* pattern list: [regex, replacement(groups..., tr)] — first hit wins */
  function g(fn) { return fn; }
  var patterns = [
    [/^(\d+) of (\d+)$/, g(function (m, a, b) { return a + ' de ' + b; })],
    [/^(\d+) of (\d+) moments$/, g(function (m, a, b) { return a + ' de ' + b + ' momentos'; })],
    [/^(\d+) events?, 24 h$/, g(function (m, a) { return a + (a === '1' ? ' evento' : ' eventos') + ', 24 h'; })],
    [/^(\d\d:\d\d) · (\d+) washes$/, g(function (m, h, n) { return h + ' · ' + n + ' lavados'; })],
    [/^Play (.+)$/, g(function (m, a, tr) { return 'Reproducir ' + tr(a); })],
    [/^(\d+) s$/, g(function (m, a) { return a + ' s'; })],
    [/^Weak window: (.+)$/, g(function (m, a) { return 'Franja débil: ' + a; })],
    [/^Strong window: (.+)$/, g(function (m, a) { return 'Franja fuerte: ' + a; })],
    [/^Shift at week (\d+)$/, g(function (m, a) { return 'Cambio en la semana ' + a; })],
    [/^(.+?) reads (\d+%) \((\d+) of (\d+), 95% CI (\d+%)-(\d+%)\) against (\d+%) elsewhere; (.+?) after correction\. (.+)$/,
      g(function (m, w, r, d, t, lo, hi, el, p, fix, tr) {
        return w + ' marca ' + r + ' (' + d + ' de ' + t + ', IC 95% ' + lo + '-' + hi +
          ') frente a ' + el + ' en el resto; ' + p + ' tras la corrección. ' + tr(fix);
      })],
    [/^Compliance moved from (\d+%) to (\d+%) starting week (\d+) \((\d+) checks, (.+?)\)\. (.+)$/,
      g(function (m, a, b, w, n, p, fix, tr) {
        return 'El cumplimiento pasó de ' + a + ' a ' + b + ' desde la semana ' + w +
          ' (' + n + ' casos, ' + p + '). ' + tr(fix);
      })],
    [/^n=(\d+) · rate (\d+%) · CI (\d+%)-(\d+%) · (.+?) · effect ([+-][\d.]+)$/,
      g(function (m, n, r, lo, hi, p, e) {
        return 'n=' + n + ' · tasa ' + r + ' · IC ' + lo + '-' + hi + ' · ' + p + ' · efecto ' + e;
      })],
    [/^Next week reads near (\d+%) \(interval (\d+%)-(\d+%)\)\. Trend: (.+)\.$/,
      g(function (m, a, lo, hi, v, tr) {
        return 'La próxima semana rondaría ' + a + ' (intervalo ' + lo + '-' + hi + '). Tendencia: ' + tr(v) + '.';
      })],
    [/^After (\d+) corrections: (\d+) of 20 borderline flags still surface \(was (\d+)\), (\d+) of (\d+) solid detections held, and all (\d+) real flagged streams still surface\.$/,
      g(function (m, c, a, b, h, t, r) {
        return 'Tras ' + c + ' correcciones: ' + a + ' de 20 marcas límite siguen saliendo (antes ' + b +
          '), ' + h + ' de ' + t + ' detecciones sólidas se mantienen y las ' + r +
          ' señales reales marcadas siguen saliendo.';
      })],
    [/^Trained model \(softmax regression, (\d+) synthetic training streams\) on (\d+) streams it never saw, noise ([\d.]+): accuracy (\d+%) vs (\d+%) for the hand-written rules\. Brier ([\d.]+)\. (.+)$/,
      g(function (m, n, t, nz, a, b, br, rest, tr) {
        return 'Modelo entrenado (regresión softmax, ' + n + ' señales sintéticas de entrenamiento) sobre ' + t +
          ' señales que nunca vio, ruido ' + nz + ': exactitud ' + a + ' frente a ' + b +
          ' de las reglas escritas a mano. Brier ' + br + '. ' + tr(rest);
      })],
    [/^(.+?) reads (\d+)% vs (\d+)% unit mean \((\d+) of (\d+)\)\. (.+)$/,
      g(function (m, w, a, b, d, t, fix, tr) {
        return tr(w) + ' marca ' + a + '% frente a ' + b + '% de media de la unidad (' + d + ' de ' + t + '). ' + tr(fix);
      })],
    [/^(\d\d:\d\d-\d\d:\d\d) averages (\d+) washes per hour vs (\d+) unit mean \((\d+) total\)\. (.+)$/,
      g(function (m, w, a, b, t, fix, tr) {
        return w + ' promedia ' + a + ' lavados por hora frente a ' + b + ' de media (' + t + ' en total). ' + tr(fix);
      })],
    [/^Around (\d\d:\d\d) the unit averages (\d+) washes per hour vs (\d+) otherwise \((\d+) in 3 h\)\. (.+)$/,
      g(function (m, h, a, b, t, fix, tr) {
        return 'Cerca de las ' + h + ' la unidad promedia ' + a + ' lavados por hora frente a ' + b +
          ' el resto del día (' + t + ' en 3 h). ' + tr(fix);
      })],
    [/^rhythm ([\d.]+) · (\d+) of (\d+) s · ([\d.]+) Hz -> (\w+)$/,
      g(function (m, r, a, b, hz, v, tr) {
        return 'ritmo ' + r + ' · ' + a + ' de ' + b + ' s · ' + hz + ' Hz -> ' + tr(v);
      })],
    [/^Ollama · (.+)$/, g(function (m, a) { return 'IA · ' + a; })]
  ];

  return { exact: exact, patterns: patterns };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = STRINGS_ES;
}
