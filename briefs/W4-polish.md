# W4: polish from review of shots/app-doubt.png and app-light.png (post W2). Read /home/nico/pf/MOTION-BIBLE.md.

1. ABOVE THE FOLD: at 1440x900 and 1280x720 (the Electron window sizes) the WHOLE watch (case + both band stubs) and the
   Guided shift button must be visible without scrolling. Today the headline pushes the watch below the fold and it is
   clipped at ~867px. Put the headline smaller or beside/over the watch (e.g. headline left-top at 56-72px, watch
   centered-left at ~70% of viewport height, controls right), keep the poster serif feel. Assert with the Electron
   window at 1280x720 and 1440x900: watch rect fully inside the viewport and Guided shift visible.
2. The "why" diagnostic line (e.g. "rhythm 0.67 · 8 of 8 s · 4.6 Hz -> unsure") is rendered ON the watch face on the
   Did-you-wash screen. The watch copy rule is <= 4 words per line and nothing accusatory. Remove it from the watch;
   keep that line ONLY on the stage scope panel. Assert the watch screen text lines are <= 4 words each on every screen.
3. app-doubt.png caught a cross-fade frame (Did-you-wash text over the Home ring). Screenshot tests must wait for
   transitions to end (await transitionend or the screen router's settled event); also assert that only ONE screen
   is opaque at settle.
4. Re-run all tests, regenerate dark/light screenshots of stage (idle, doubtful, wash in progress) and unit page and LOOK.
Commit "watch: polish". Then `mkdir -p .stage && touch .stage/W4-polish`. Report <= 5 lines.
