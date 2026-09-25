# BRIEF — Hand-hygiene watch, smartwatch prototype (Stryds style)

You are the frontend builder. Build a static, no-build prototype in THIS folder.
Read everything in `ref/` first:
- `case.md` — the case. The watch reminds and records hand hygiene in a hospital, in
  silence, on the body. The watch WILL be wrong, and a wrong mark is an automatic
  accusation against a nurse. The design problem is correcting it without a form and
  showing the data as a process indicator, never as surveillance.
- `DESIGN.md`, `variables.css`, `tokens.json` — the **Stryds** design system. It is the
  visual source of truth, adapted to watch scale (rules below).

Frontend quality is the #1 grading criterion. Real Apple Watch fidelity + motion.

## Deliverable files (only these; do not touch `ref/` or this BRIEF)
```
index.html        stage: watch (left) + simulator panel (right) + haptic strip
unit.html         infection-control view (desktop page, anonymous)
css/tokens.css    THE ONLY file with raw color values (see "Tokens")
css/watch.css     watch frame + watch screens + motion
css/stage.css     stage, simulator panel, haptic strip, unit page
js/haptics.js     vibration vocabulary (patterns, visualizer, navigator.vibrate)
js/watch.js       watch screen router, crown/side button, screen renderers
js/story.js       guided-shift script + free-mode event bus
js/unit.js        unit page rendering (demo data)
tests/acceptance.js  Playwright acceptance script (see "Acceptance")
```
Vanilla HTML/CSS/JS. No frameworks, no npm packages, no CDN JS. Google Fonts `<link>` allowed.
Must open by double-clicking `index.html` (file://): no ES modules, plain `<script>` tags.

## Language
- Code, identifiers, comments: English.
- UI copy: Spanish, **neutral Colombian**, "tú" to the nurse. No voseo
  ("tocá", "mirá", "podés", "tenés", "acordate" are WRONG → "toca", "mira", "puedes", "tienes", "acuérdate").
- Watch copy ≤ 4 words per line, readable in a 2-second glance.

## Tokens (the professor WILL test this)
He changes the primary color in one file and checks it propagates to the ENTIRE UI with
nothing of the old color left. So:
- `css/tokens.css` holds every raw hex. No hex/rgb literals anywhere else (CSS, JS, SVG attrs).
  SVG uses `currentColor` or `var(--…)`. JS reads colors with `getComputedStyle`.
- Naming is **pattern-color-weight**, never reversed: `--bg-primary-500`, `--text-neutral-50`,
  `--border-neutral-700`, `--ring-spectrum-1`… Base palette first (`--color-primary-500: #a6ff00`,
  `--color-neutral-950: #101010` …), then semantic tokens that reference it.
- Stryds mapping: primary-500 `#a6ff00` (Electric Lime), neutral-950 `#101010` (Obsidian),
  neutral-900 `#171717` (Carbon), neutral-700 `#333333` (Slate), neutral-600 `#3d3d3d` (Steel),
  neutral-400 `#6f6f6f` (Fog), neutral-50 `#fdfdfd` (Paper), black `#000000` (Void).
- Derived tints of primary (dimmed ring track, pressed state) via `color-mix()` on the
  primary token, so they follow the change.
- Spectrum ring stops are tokens too; stop 1 = primary.

## Stryds at watch scale
- Watch screen background: pure `#000` token (OLED, watchOS convention). Cards on Carbon,
  1px Slate hairlines, **no shadows** inside the watch.
- Lime is rare: only the active action, the progress ring fill, the "done" state.
- Hierarchy by size + Paper/Fog contrast, not by color.
- Type: display = **Inter Tight 600** (SF Pro substitute), body = **Inter 400/500**.
  Watch scale: 14 caption (minimum) / 16 body / 19 title / 34 number / 56 hero number.
  Tight tracking on display (-0.02em).
- Radii: pills 100px, cards 24px on the watch (40px on unit.html).
- Signature: the **spectrum ring** (segmented conic ring with gaps). On the watch it IS the
  shift progress ring on Home. It's the only multicolor/gradient element anywhere.
- Hit targets ≥ 56px tall (gloved hands). Max 2 buttons per screen, full-width pills.

## The watch (index.html, left)
- Apple Watch 46mm: screen 416×496 CSS px, screen corner radius ~96px, inside a rendered
  case (dark aluminium, subtle bezel) with **Digital Crown** and **side button** on the right,
  band stubs top/bottom. Built in CSS/inline SVG, no images. Scale the whole watch with
  `transform: scale()` to fit the viewport; on < 700px wide the watch stacks above the panel.
- Status bar on every screen: time (top-right, watchOS style) + small title top-left.
- **Crown**: wheel over the watch scrolls the current screen; click crown → Home.
  Crown rotates visually with scroll. **Side button**: opens "Quién ve esto".
- Screens (one visible at a time, directional transitions):
  1. **Inicio** — spectrum ring = moments done this shift, hero number `12` over `/15`,
     caption "Turno · Unidad 4B". Below the fold (crown scroll): last 3 events.
  2. **Recordatorio** — "Antes del paciente" / "Cama 3". A small glyph of hands.
     One secondary pill: "Ya lo hice". (Most of the time the nurse never looks: the
     haptic did the work. Screen shows only if wrist is raised.)
  3. **Lavando** — 20 s progress ring (lime) with seconds in the center, caption
     "Lavado detectado". This is the ONLY place `linear` timing is allowed (it's a clock).
     Ends in a check that draws itself (stroke-dashoffset) + "Listo".
  4. **¿Te lavaste?** (uncertain record) — "Al salir · Cama 3" / "No estoy seguro".
     Two pills: primary "Sí, me lavé", secondary "No alcancé". One tap closes it. No form,
     no reason field. After "Sí": toast "Anotado. Gracias." and the event is marked
     "corregido por ti". After "No alcancé": toast "Queda solo para ti." Never red, never
     the word "incumplimiento" / "falta" / "error" on the watch.
  5. **Fin de turno** — "15 de 17 momentos", "2 corregidos por ti", line in Fog:
     "Este detalle solo lo ves tú. Se borra en 24 h."
  6. **Quién ve esto** — three rows: **Tú**: cada evento, 24 horas. **Control de
     infecciones**: totales de la unidad, sin nombres. **Nadie**: tu ubicación.
  7. **Pausa** (from Home, long-press crown or a pill at the bottom of Home): "Silenciar
     30 min" for a code/emergency. While paused, a small moon glyph in the status bar and
     the simulator's reminder events are swallowed (show "silenciado" in the log).

## Vibration vocabulary (js/haptics.js) — a deliverable in itself
Four patterns that must FEEL different (case.md: "acuérdate" ≠ "esto quedó mal registrado").
Mapped to watchOS `WKHapticType` names in comments:
| name | meaning | pattern (ms, navigator.vibrate) | watchOS analog |
|---|---|---|---|
| `recordatorio` | a moment is due and didn't happen | `[60,120,60]` two soft taps | `.notification` |
| `ok` | wash recorded | `[35]` one short tick | `.success` |
| `dudoso` | watch unsure, please confirm | `[30,70,45,70,65]` three rising | `.retry` |
| `fin` | shift closed | `[400]` one long | `.stop` |
- `haptics.play(name)` → calls `navigator.vibrate?.(pattern)` AND visualizes it:
  the watch body does a tiny shake (translate ≤ 2px, per pulse), and the **haptic strip**
  under the watch draws the pattern as bars (width = duration, height grows for rising)
  with the pattern name. Sound: NONE, ever. Show a muted-speaker icon in the strip:
  "Sin sonido. Nunca."
- The simulator panel has a **Vocabulario** section: 4 rows, each with name, meaning,
  mini waveform and a ▶ button that plays it.

## Simulator panel (index.html, right)
- **▶ Turno guiado** button: plays the story (~75 s) with one-line subtitles under the
  watch (Spanish), controls: pause/resume, skip, restart. Story beats:
  1. 07:02 Inicio. "Empieza el turno."
  2. Entra a la zona de la Cama 3 sin lavarse → `recordatorio` → Recordatorio screen.
     Subtitle: "El reloj vibra. No suena. El paciente no se entera."
  3. Se lava → Lavando (run the 20 s ring at 5× speed, label "×5") → `ok` → Inicio, ring +1.
  4. Sale de la Cama 3, usa gel rápido → watch unsure → `dudoso` → ¿Te lavaste? →
     auto-tap "Sí, me lavé" (animate a fingertip) → toast. Subtitle: "El reloj se
     equivocó. Se corrige con un toque, sin formulario."
  5. Código azul en Cama 5 → Pausa 30 min, a reminder arrives and is swallowed.
     Subtitle: "En una emergencia, el reloj se calla."
  6. 19:00 → `fin` → Fin de turno → side button → Quién ve esto.
     Subtitle: "Lo detallado es tuyo. La unidad solo ve totales."
- **Modo libre** buttons (always available when the story isn't playing): Entrar a zona
  de paciente · Lavado detectado · Salir sin lavado · Lavado dudoso · Código azul ·
  Terminar turno · Reiniciar. Each one drives the same event bus the story uses.
- **Registro** list: last events with time, in plain words.
- Link to `unit.html`: "Ver lo que ve Control de infecciones →".

## unit.html — Control de infecciones (desktop, Stryds at full scale)
- Poster-scale header: "Unidad 4B" + statement in the Stryds manifesto style:
  "Mide el proceso, no a las personas." with "el proceso" in Paper, rest in Fog.
- Cards (Carbon, 40px radius, hairline):
  - By WHO moment (5 rows: Antes del paciente, Antes de un procedimiento limpio, Después de
    exposición a fluidos, Después del paciente, Después del entorno): horizontal bars, lime fill.
  - By hour of day: 24-cell heatmap strip (primary tints via `color-mix`), caption points at
    the shift-change hour.
  - "Correcciones del personal": number + line "Cuántas veces el reloj se equivocó y alguien
    lo corrigió. Mide al reloj, no a la gente."
- Fixed notice: "Esta vista no tiene nombres. No existe un filtro por persona." and a badge
  "Datos de demostración".
- All numbers are demo data in `js/unit.js`. Bars animate in (stagger 40ms) on load.

## Motion (Family Values — required)
- Easing enter `cubic-bezier(0.16,1,0.3,1)` 300–400ms; exit `cubic-bezier(0.4,0,1,1)` 200ms;
  press `scale(.97)` 120ms. No `linear` except the wash countdown ring.
- Nothing appears/disappears instantly. Screen changes are directional (deeper = from
  right / from below for alerts, back = reverse), watchOS-like zoom for alerts (scale .92→1 + fade).
- Spectrum ring: segments draw in on load; +1 animates the arc and the number counts up.
- Check mark draws (stroke-dashoffset). Toasts slide from the top of the watch screen.
- hover/active/`:focus-visible` states on every interactive.
- `@media (prefers-reduced-motion: reduce)`: kill transitions/animations, no shake,
  haptic strip still shows static bars.
- Keyboard: every simulator button reachable; Esc = back on the watch.

## Stage
Canvas = neutral-950. Watch centered-left, panel right (max 420px). Short hint line under the
watch: "Gira la corona con la rueda del mouse. El botón lateral abre la privacidad."

## Acceptance (write tests/acceptance.js with Playwright, run it, it must pass)
Read TESTING.md for how to run the browser here. The script must assert:
1. `index.html` and `unit.html` load with zero console errors.
2. Free mode: Entrar a zona → Recordatorio visible; Lavado detectado → Lavando then Inicio
   with the counter incremented by 1; Lavado dudoso → ¿Te lavaste? → click "Sí, me lavé" →
   toast "Anotado. Gracias." visible and screen returns to Inicio.
3. Código azul → Pausa; a following Entrar a zona does NOT show Recordatorio.
4. Terminar turno → Fin de turno; side button → Quién ve esto.
5. Guided story runs to the end (use a test hook `window.__storySpeed = 20`).
6. `haptics.play` calls `navigator.vibrate` with the table's exact arrays (stub it and record).
7. Token test: set `--color-primary-500` to `#ff0000` at runtime; then walk every element
   on both pages and assert no computed color/background/border/fill/stroke equals
   `rgb(166, 255, 0)`.
8. grep: no hex/rgb literals outside `css/tokens.css`; no `linear` outside the wash ring rule;
   no voseo words (tocá|mirá|podés|tenés|querés|acordate); no "incumplimiento" on the watch.
9. Reduced-motion block exists and covers transitions, animations and the shake.
Take screenshots of each watch screen + unit.html into `shots/` (gitignored) and look at
them before you stop. Report what you built in ≤ 10 lines.
