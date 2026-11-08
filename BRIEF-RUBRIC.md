# BRIEF-RUBRIC (phase A) — make this app pass the professor's rubric

You are editing ONE app in this directory only. Read this whole file, then the existing code before changing anything.
Language rule: code, comments, commit messages in English. UI copy: Spanish (neutral Colombian: "agregar", "presiona", never "añadir/pulsa/vosotros") + English.

## Must deliver (all binary, all required)
1. **Spanish is the default language.** Fresh profile (empty storage) opens in Spanish regardless of OS/navigator language. `<html lang>` follows the active language. Switching language must NOT reload the page or lose app state.
2. **Light theme is the default.** Fresh profile opens light. Theme options: Claro / Oscuro / Sistema (Claro default). Persisted.
3. **A real Settings screen** ("Configuración" / "Settings"), reachable from the main navigation with a gear icon, containing at least: Idioma (Español/English), Tema (Claro/Oscuro/Sistema), Inteligencia artificial (on/off + a way to revoke/re-grant consent if the app has consent), Privacidad (what data is kept, delete-all if the app has it), Ayuda (opens level 3 of the guide), "Ver la guía otra vez" (replays level 1). Existing header toggles may stay as shortcuts but Settings is the canonical home.
4. **A three-level guide**, all translated ES/EN:
   - Level 1 — first-run welcome: 3 short screens/cards (what the app is for, the core action, privacy/AI promise), with progress dots, Siguiente/Atrás, Saltar. Shown once on first launch (persist "seen"), replayable from Settings.
   - Level 2 — contextual coach marks: the first time the user reaches each key feature (at least 3 features), a small dismissible tip anchored to it. Each shown once, persisted.
   - Level 3 — a Help/Ayuda screen inside Settings: a FAQ / reference of every feature and every icon/status the app uses (plus a glossary if the app has domain terms).
   The guide must work in the app's real mode, not only in a demo mode. Keyboard accessible: Esc closes, focus is trapped in modal steps and returned afterwards, role=dialog + aria-modal.
5. **No English visible in Spanish and no Spanish visible in English** on every screen you touch, including dynamic strings, aria-labels, placeholders, tooltips, CSS `content:` strings, error messages. Plurals correct in both languages ("1 pendiente" / "2 pendientes", "1 block" / "2 blocks"). Numbers/times formatted with `Intl` for the active locale where numbers are shown.
6. Design: use ONLY the app's existing design tokens/components (read its tokens CSS first). No new raw colors, no new fonts. Light and dark both must look designed, contrast >= 4.5:1 for text. Respect prefers-reduced-motion. Touch/click targets >= 44px.

## Tests
- Add a test file for this phase (follow the style of the existing tests) that asserts items 1-5 in a real browser: fresh profile opens ES + light; Settings reachable and switches language without reload (assert some in-memory state survives); level 1 shows on first run and not on second; a coach mark shows once; Help screen exists; scan visible text in ES for a list of the app's English words and fail if any appear.
- Existing tests that hardcode English as default must be updated to Spanish default; do NOT delete or weaken other assertions.
- Run the FULL existing suite (every test file, see the command below) and keep it green. Paste the final pass counts in your last message.

## Do not
- Do not touch files outside this directory. Do not change the AI backend/server logic, the product concept, or unrelated features.
- No `git push`. Commit in small steps on the current branch with clear English messages (`git add` only the files you changed; never `git add -A`).
- Never pkill/killall; run Electron only via `xvfb-run -a`.

## Final message
List: files changed, each requirement 1-6 with PASS/FAIL and the evidence (test name or file:line), full test-suite counts, anything you could not do.

## App-specific (Hand Hygiene watch, Electron simulator + unit.html; ignore wear/ and android/ for this phase)
- Today: js/i18n.js:28-33 picks navigator language (English on this PC); js/i18n.js:128-133 reloads the page on language change and destroys the demo (must re-render in place instead). Theme defaults to OS.
- Settings must exist in TWO places: (a) on the watch itself as a compact "Ajustes" screen reachable from the watch's local navigation (crown/side button), glanceable, max ~4 words per line, 56px pills; (b) in the desktop page/unit page as a Configuración panel. Both share the same stored values.
- Guide level 1 on the watch = 3 glanceable cards (te aviso con vibración → si dudo te pregunto → solo tú lo ves). Level 3 Help must include the four-vibration vocabulary table (today buried in the "Cómo lee el movimiento" <details>, index.html:177-183), with play buttons.
- Untranslated today: CSS content 'Nothing yet' (css/stage.css:700) — move into JS/i18n; 'Marked' (js/watch.js:710); 'Empty · 24 h' (js/watch.js:346-348); 'Bed 5' (js/story.js:269); storyClock 'over' (js/story.js:378); 'sent via ntfy'/'not sent' (js/wrist.js:125). The Ask input (#askQ, unit.html:72) must be excluded from translation (user text is never rewritten). Numbers via Intl (thousands separators, decimal comma in ES).
- Run: node tests/acceptance.js; xvfb-run -a node tests/electron-smoke.js; node tests/i18n.test.js; every other tests/*.test.js; add a package.json "test" script that runs them all.
