# FINDINGS — audit pass (before → after)

Baseline: `node tests/acceptance.js` → 87 passed, 0 failed before any change.
Before shots: `shots/audit-before/{1440,375}-{home,recordatorio,lavando,dudoso,fin,quien,pausa,unit}.png` (viewed).

## F1 · Muted text fails 4.5:1 (grade risk: legibility) — FIXED
What: Fog `#6f6f6f` captions on Void compute to ~4.2:1; Steel `#3d3d3d`
micro-labels to ~1.7:1. Visible in `1440-home` (Turno · Unidad 4B, Últimos 3),
`1440-dudoso` ("No estoy seguro"), `1440-fin` (24 h note), `1440-unit`
(axis, card notes). Sources: `css/watch.css:399-409`, `css/stage.css:150-202`.
Change: `--text-secondary` is now a `color-mix` of Fog toward Paper (≈`#a5a5a5`,
~8.5:1 on Void, ~7.3:1 on Carbon — no new raw hex, palette untouched); every
small-text use of `--text-tertiary` moved to secondary, tertiary kept for
dots/icons only.
Status: fixed.

## F2 · Hardcoded ms bypass the motion tokens — FIXED
What: `240ms` (watch Ko, moon, barPop), `140ms` (shake), `520ms` (ring draw,
cells), `320/380ms` (list rows), `760ms` (bars), stagger delays `34/40/70/14ms`
and an inline `240ms` string in `js/watch.js:504-505` cite no token, so the
"every duration cites a token" rule fails. Sources: `css/watch.css:16,27,242,355,559,720`,
`css/stage.css:168,172,402,624,647`, `js/watch.js:504`.
Change: added `--dur-rise/item/sweep/grow/step/step-sm` to `css/tokens.css`
(easings stay at 2: enter + exit, press reuses enter); all literals replaced,
delays use `var(--dur-step)` / `calc()` multiples. Wash clock keeps its `linear`.
Status: fixed.

## F3 · No kicker tier; kickers speak in body voice (one in lime) — FIXED
What: "Últimos 3" (`js/watch.js:206`), "Al salir" (`js/watch.js:273`), card
labels (`unit.html:39,47,55`, `css/stage.css:565`), note label
(`css/stage.css:190`) are body/secondary voice; panel eyebrow spends lime on a
decorative kicker. Seen in `1440-home`, `1440-dudoso`, `1440-unit`.
Change: new `.label` tier (Inter 500, uppercase, 12px, +0.18em, secondary,
tabular) in both stylesheets + tokens; applied to all kickers; eyebrow lime →
secondary (lime stays rare: actions, ring, done states).
Status: fixed.

## F4 · `tabular-nums` gaps on real numbers — FIXED
What: hero/seconds/counts are tabular, but `/ 15` (`.home__of`), `×5`
(`[data-speed]`), and every caption/note carrying counts ("Cama 3", "1284 de
1362", "14 días", log rows) are proportional, so digits wobble on update.
Sources: `css/watch.css:371-389` (only hero/num covered), `css/stage.css:384,410`.
Change: tabular-nums added to `.caption`, `.home__of`, `[data-speed]`,
`.panel__clock`, `.log__text`, `.ucard__note`, `.note__body`.
Status: fixed.

## F5 · "¿Te lavaste?" does not dominate its screen — FIXED
What: `1440-dudoso` stacks four same-weight lines; the one question the nurse
must answer in a glance competes with context ("Al salir / Cama 3") at 19px vs
19px. Sources: `js/watch.js:272-277`, `css/watch.css:672-678`.
Change: context line becomes the `.label` kicker, the question sets at
`--w-number` (34px). Copy, pills, and flow untouched.
Status: fixed.

## F6 · Ghost pills are 48px tall, under the 56px gloved-hand floor — FIXED
What: `.pill--ghost` (`css/watch.css:459-467`, Home "Pausa 30 min", Fin/Quién
"Volver/Cerrar") is 8px under the BRIEF floor; primary/secondary already 56px.
Change: `min-height: 56px`. No layout shift (foot stacks full-width).
Status: fixed.

## F7 · Verified, no change
`focus-visible`: global rule (`css/stage.css:29`) plus watch rules cover every
interactive (crown, side button, pills, panel buttons, vocab play, links).
Shadows: only the aluminium case (`css/watch.css:72`, outside the screen);
zero shadows on any screen surface. Mobile 375: stage stacks watch-over-panel
(`375-home.png`), panel readable, vocab rows wrap cleanly. Lime otherwise rare.
Haptic table, screens, copy, and `ref/`/`BRIEF.md` untouched.
Status: verified, no change.
