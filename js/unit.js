/* ==========================================================================
   unit.js — the infection-control view. All of it is demo data.
   The page is anonymous by construction: there is no person field anywhere,
   so there is nothing to filter by.
   ========================================================================== */

var unit = (function () {
  'use strict';

  /* --- demo data --------------------------------------------------------- */

  var MOMENTS = [
    { name: 'Antes del paciente',        done: 1284, total: 1362, pct: 94 },
    { name: 'Antes de un procedimiento limpio', done: 402, total: 451, pct: 89 },
    { name: 'Después de exposición a fluidos', done: 191, total: 269, pct: 71 },
    { name: 'Después del paciente',      done: 1188, total: 1381, pct: 86 },
    { name: 'Después del entorno',       done: 508, total: 819, pct: 62 }
  ];

  /* Washes per hour of the day (00 → 23). The two spikes are the shift start
     (07) and the shift change (19) — exactly where the unit is weakest. */
  var HOURS = [
    0, 0, 0, 0, 0, 2, 9,
    28, 34, 31, 27, 24, 19,
    14, 11, 12, 16, 21, 26,
    33, 29, 12, 5, 1
  ];

  var CORRECTIONS = 34;
  var MAX_HOUR = Math.max.apply(null, HOURS);

  /* --- render ------------------------------------------------------------ */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function heatStep(v) {
    if (v === 0) return 1;
    var r = v / MAX_HOUR;
    if (r < 0.25) return 2;
    if (r < 0.5) return 3;
    if (r < 0.8) return 4;
    return 5;
  }

  function momentBars() {
    var host = document.getElementById('momentBars');
    if (!host) return;
    host.innerHTML = MOMENTS.map(function (m, i) {
      return '<div class="ubar" style="--i:' + i + '">' +
        '<div class="ubar__top">' +
          '<span class="ubar__name">' + esc(m.name) + '</span>' +
          '<span class="ubar__val">' + m.pct + '%<small>' +
            m.done + ' de ' + m.total + '</small></span>' +
        '</div>' +
        '<div class="ubar__track">' +
          '<span class="ubar__fill" style="--i:' + i + ';--pct:' + m.pct + '%"></span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function heatmap() {
    var host = document.getElementById('heat');
    if (!host) return;
    var cells = HOURS.map(function (v, i) {
      return '<span class="uheat__cell" style="--i:' + i +
        ';background:var(--heat-' + heatStep(v) + ')" ' +
        'title="' + pad2(i) + ':00 · ' + v + ' lavados"></span>';
    }).join('');

    host.innerHTML =
      '<div class="uheat__cells">' + cells + '</div>' +
      '<div class="uheat__axis"><span>00</span><span>06</span><span>12</span>' +
        '<span>18</span><span>23</span></div>' +
      '<div class="uheat__marker">19:00 · Cambio de turno: el pico más alto ' +
        'y el mayor riesgo de salto sin lavado.</div>';
  }

  function corrections() {
    var n = document.getElementById('corrN');
    if (n) {
      var t0 = performance.now();
      (function step(t) {
        var p = Math.min(1, (t - t0) / 700);
        n.textContent = String(Math.round(CORRECTIONS * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
      n.setAttribute('data-count', String(CORRECTIONS));
    }
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function mount() {
    momentBars();
    heatmap();
    corrections();
  }

  return { mount: mount, MOMENTS: MOMENTS, HOURS: HOURS, CORRECTIONS: CORRECTIONS };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', unit.mount);
} else {
  unit.mount();
}
