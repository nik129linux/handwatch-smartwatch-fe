# FINDINGS pass: smartwatch (frontend quality is the #1 grade; due tomorrow)

Goal: audit the existing prototype like a senior designer, write ranked findings, fix them. Do not rebuild.
Stay inside THIS directory. Read BRIEF.md (original spec, still binding), TESTING.md, tests/acceptance.js first.

## Method (in order)
1. Run `node tests/acceptance.js` -> must pass before you touch anything.
2. Screenshot every watch screen + unit.html at 1440 and 375 wide into `shots/audit-before/`. LOOK at them.
3. Write `FINDINGS.md`: max 8 findings ranked by impact on the grade/legibility. Each = what is wrong (cite the
   screenshot + file:line), the change, status. Audit these axes: visual hierarchy at 2-second glance; motion
   system (cap at 3 easings: enter expo `cubic-bezier(0.16,1,0.3,1)`, exit, press; every duration/ease cites a
   token); a small tracked "label" tier for kickers (Inter 500, uppercase, ~12px, +0.18em) instead of body voice;
   `font-variant-numeric: tabular-nums` on every number (ring count, seconds, unit.html figures);
   contrast >= 4.5:1 for small text over any surface; `:focus-visible` on every interactive; mobile (375) layout
   of the stage; hit targets >= 56px on the watch; Stryds fidelity (lime rare, no shadows in the watch).
4. Implement each finding. Rules that still hold: all raw colors only in css/tokens.css (the professor changes
   the primary color and checks nothing old remains), no `linear` except the wash ring, no sound, Spanish
   neutral Colombian copy with no voseo, nothing the watch says reads as accusation.
5. For every fix add an assertion to `tests/acceptance.js`. Re-run until it passes. Screenshots again into
   `shots/audit-after/` and compare with before.

## Do NOT
Add dependencies/frameworks/CDN JS, touch `ref/` or `BRIEF.md`, add new screens, change the haptic table, or add
glow/glass effects.

## Done when (binary)
FINDINGS.md exists; acceptance passes including new assertions; before/after shots exist; `git diff --stat`
shows only files in the deliverable list + FINDINGS.md + tests. Commit with message "watch: findings pass".
Report in <= 10 lines: findings fixed, findings skipped with reason, anything you could not verify.
