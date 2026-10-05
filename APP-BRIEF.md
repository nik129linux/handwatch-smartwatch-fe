# APP PASS: English UI, light/dark switch, real desktop app (Electron). Keep behavior and keep tests green.

The demo is shown from a PC as an APP, not by opening index.html. BRIEF.md (original spec) is overridden ONLY on
language and theme; everything else still binds (tokens, haptic table, no sound, no accusation wording).

## 1. English
Translate ALL user-visible copy to natural English: stage, simulator panel, story subtitles, unit.html, aria-labels,
toasts, empty states. Watch lines stay <= 4 words. Suggested: Inicio->Home, Recordatorio->Reminder, Lavando->
Washing, "¿Te lavaste?"->"Did you wash?", "Sí, me lavé"->"Yes, I did", "No alcancé"->"Couldn't", "Anotado.
Gracias."->"Noted. Thanks.", "Queda solo para ti."->"Stays with you.", Fin de turno->"Shift over", "Quién ve
esto"->"Who sees this" (rows: You / Infection control / No one), Pausa->Pause. Haptic names: reminder, ok,
doubtful, end (keep the exact vibration arrays and the WKHapticType comments). Unit page statement: "Measure
the process, not the people." (the process in Paper, rest in Fog). Times 24h. `<html lang="en">`.
Update tests/acceptance.js to English selectors/text; replace the voseo/"incumplimiento" grep with an English
banned-words check on watch copy ("failure", "violation", "non-compliance", "fault", "error", "negligence") and a
check that no Spanish stopwords remain in quoted UI strings. Never lose an assertion.

## 2. Light / dark switch
Theme toggle (sun/moon inline SVG, aria-label "Switch theme") on the stage top-right and on unit.html. Default =
prefers-color-scheme; persisted in localStorage (try/catch), shared between index.html and unit.html. Implement
via `:root[data-theme="light"]` overriding SEMANTIC tokens in css/tokens.css only. THE WATCH SCREEN STAYS PURE
BLACK IN BOTH THEMES (OLED convention; only the case/bezel may adapt slightly). Light stage/unit = warm paper
(`#fdf1e1` family), ink text, same editorial serif; atmosphere/grain/bloom retuned for light. Lime on light has
poor contrast: keep lime as fill with ink text, and use `color-mix(in srgb, var(--color-primary-500) 55%, black)`
for any lime line/dot/text on light surfaces. 300ms expo transition on theme change. Contrast >= 4.5:1 for
representative text in both themes (assert 6 elements per theme). Token test must pass in BOTH themes
(primary -> #ff0000, nothing keeps rgb(166, 255, 0)).

## 3. Real desktop app (Electron, already installed in this folder)
- `main.js`: BrowserWindow 1440x900 (min 1100x760), autoHideMenuBar, title "Hand Hygiene Watch",
  contextIsolation true, loadFile('index.html'). Accelerators: Ctrl+Shift+L theme (call a `window.__toggleTheme`
  hook), F11 fullscreen. The "see what Infection Control sees" link navigates inside the same window and unit.html
  has a "Back to the watch" link. Bundle the Google fonts locally in `fonts/` (curl woff2 from fonts.gstatic.com;
  system fallbacks if it fails) so it works offline.
- `handwatch.desktop` launcher (Name=Hand Hygiene Watch, Exec=sh -c "cd /home/nico/pf/smartwatch && npm start",
  Terminal=false, Icon=`build/icon.svg` you draw: a hand/ring glyph, lime on ink); install copies to
  `~/.local/share/applications/` and `~/Desktop/HandHygieneWatch.desktop` (chmod +x).
- `tests/electron-smoke.js` using playwright `_electron.launch({args:['.']})`: window opens, title correct, theme
  toggle flips data-theme, free-mode "Doubtful wash" shows the confirm screen, screenshot saved. Use
  `--ozone-platform=x11` or xvfb-run if Wayland blocks it and say so.

## Done when
`node tests/acceptance.js` and `node tests/electron-smoke.js` pass; screenshots of the app window in DARK and
LIGHT (stage + unit page) in shots/ and you LOOKED at them; grep proof that no Spanish remains. Commit
"watch: english, light mode, electron app". Report <= 8 lines.
