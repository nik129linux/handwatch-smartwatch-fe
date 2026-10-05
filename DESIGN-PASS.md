# DESIGN PASS: remove the generic "AI slop" look from the stage and unit.html. Keep behavior, copy and tests.

Today the page around the watch is a column of identical bordered rounded cards (Turno guiado, Modo libre,
Vocabulario, Registro, Por qué cuatro), 10 same-weight pill buttons, tracked-caps labels everywhere. That is the slop.
Study these references FIRST (read-only, absolute paths; read the CSS/JS and screenshot them with Playwright) and
copy their language, not their content:
- /home/nico/Desktop/me/lifemax/domains/aiservices/fe/mostar/{index.html,styles.css,script.js}: cinematic editorial
  type, layered depth, pointer/scroll driving CSS vars, `transition: transform 640ms cubic-bezier(0.22,1,0.36,1)`.
- /home/nico/Desktop/me/lifemax/domains/aiservices/fe/gravity/index.html: mono micro-labels (JetBrains Mono 10-11px),
  glass chrome used sparingly, cursor parallax with lerp, one expo ease.
- /home/nico/Desktop/me/lifemax/domains/aiservices/fe/space/index.html: blur-in word-by-word headline reveal
  (opacity+blur+translateY, 100ms stagger, easeOut 0.7-0.9s).

## Scope
THE WATCH SCREENS THEMSELVES DO NOT CHANGE (watchOS fidelity, Stryds, 56px targets, copy, haptic table all stay).
Redesign only: index.html stage, the simulator panel, the haptic strip, and unit.html.

## Changes
1. **Stage composition.** The watch is the hero, large and centered-left over a real atmosphere: layered radial
   gradients built from token colors, a 4% grain overlay (inline SVG feTurbulence), and a soft light bloom behind the
   case that follows the pointer (lerp 0.08, +-12px, desktop + no-preference only). Page headline "Turno en la
   Unidad 4B" in a high-contrast serif (Instrument Serif or Fraunces) at 64-110px with the blur-in word reveal.
2. **Simulator panel = quiet control strip, not 5 cards.** One column, whitespace + single hairlines between
   groups, group titles in mono 11px, Turno guiado as ONE lime pill, Modo libre as a compact two-column list of
   text buttons (no borders until hover/focus), Vocabulario rows without card chrome. Registro as a plain mono log.
3. **Haptic strip** becomes a wide, minimal waveform under the watch (bars drawn directly on the stage, no box),
   with the "Sin sonido. Nunca." tag in mono.
4. **unit.html**: poster-scale serif statement "Mide el proceso, no a las personas." (el proceso in Paper, rest in
   Fog), data cards reduced to whitespace-separated blocks with one hairline each, mono axis labels, bars/heatmap
   keep their meaning. Keep the fixed "sin nombres" notice and the "Datos de demostración" badge.
5. **Motion:** one master ease `cubic-bezier(0.16,1,0.3,1)` (max 3 easings total, already in tokens), staggered
   entrances 60ms, everything off under prefers-reduced-motion. Do not touch the wash ring's `linear`.
6. **Color discipline:** tokens architecture unchanged (the professor changes `--color-primary-500` and checks
   nothing old remains). Lime stays rare. New tints only via `color-mix()` or new tokens in css/tokens.css.

## Done when
`node tests/acceptance.js` passes (update selectors if you rename; never delete an assertion; add assertions for
the blur-in headline existing, and for the simulator panel having no `.card`-style bordered boxes: assert the
count of elements with a visible border in the panel is <= 4). No raw colors outside tokens.css, no voseo.
Screenshots at 1440 and 375 of home, dudoso, unit.html into shots/ and LOOK at them: if a view still looks like
uniform rounded cards, redo it. Commit "watch: design pass". Report in <= 8 lines, naming which reference gave
which technique.
