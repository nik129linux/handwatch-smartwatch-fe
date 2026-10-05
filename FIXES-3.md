# FIXES round 3 (after the design pass): stage only, keep tests green and the look.

Seen in shots/index.png at 1440 wide:
1. The watch is SMALL next to the 110px headline; it is the product and must be the hero. Scale the watch so its
   case height is ~62-68% of the viewport height (clamp so the whole watch + band stays visible, no cropping)
   and move the headline block so it does not compete: headline left-top, watch large centered-left below/beside it.
2. The hint "Gira la corona con la rueda del mouse..." overlaps the bottom band stub. Give it 24px clear space
   under the band and put it in the mono label voice, one line.
3. The haptic strip ("Vocabulario / Toca para sentir" with 4 green blocks) duplicates the Vocabulario list in the
   right column. Rename the strip to "Vibración en vivo" and show ONLY the pattern currently playing (idle state:
   a thin flat line + "Sin sonido. Nunca."), no static 4-block row.
4. Right column "Reiniciar" appears twice (Turno guiado row and Modo libre list). Keep one global Reiniciar.
5. Check 375 wide: watch above panel, no horizontal scroll, headline wraps without orphan words.

Update/add assertions (watch case height >= 55% of viewport at 1440x900; hint rect not intersecting band rect;
single Reiniciar). Screenshots 1440 + 375 into shots/ and LOOK. Commit "watch: stage polish". Report <= 5 lines.
