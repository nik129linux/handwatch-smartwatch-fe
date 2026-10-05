# W3: QA like a hostile user, then write the demo script. Read /home/nico/pf/MOTION-BIBLE.md.

1. Drive the real Electron app (playwright `_electron`) through: guided story to the end, every free-mode scenario in
   every order that could break state (code blue mid-wash, noise slider at extremes, end shift then wash, double
   clicks, Esc, crown wheel on every screen, side button spam), tab through the whole UI, at 1100x760, 1440x900,
   1920x1080, dark and light. Fix every bug, overflow, clipped text, dead control, console error, focus trap.
2. Re-verify the case rules by test: no accusation wording on the watch (red color never used, banned words absent),
   no sound ever, the unit page has no per-person view, haptic arrays exact.
3. Accessibility: contrast >= 4.5:1 sampled across 12 elements per theme, logical tab order, aria-labels, reduced motion.
4. Add a regression test per bug fixed.
5. Write `DEMO.md` (English, <= 1 page): launch (launcher + `npm start`), a 2-minute presenter script with exact
   clicks and what to say at each beat (lead with: the watch WILL be wrong, here is how a wrong mark is corrected
   with one tap and never shown as an accusation), what is real vs simulated (classifier is real over simulated
   sensor data), and 3 anticipated professor questions with honest answers. Write `README.md`.
6. Final: `node tests/acceptance.js`, `node tests/classifier.test.js`, `node tests/electron-smoke.js` green. Commit
   "watch: qa and demo". Report <= 8 lines: bugs found/fixed (count + nastiest), anything unfixed.
