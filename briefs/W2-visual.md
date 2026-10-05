# W2: visual signature, fe/-level motion. Read /home/nico/pf/MOTION-BIBLE.md and study fe/mostar, fe/gravity, fe/space in depth.

Watch SCREENS keep watchOS fidelity (black OLED, 56px targets, copy). Everything around and inside the motion is craft.
1. **The watch as a physical object**: pointer-driven 3D tilt (perspective, spring-damped, +-8deg), a specular glare
   on the glass that follows the pointer, crown rotation with inertia on wheel, side-button press depth. Reduced
   motion: no tilt, static glare.
2. **State-driven atmosphere**: the stage bloom behind the watch reacts: ok -> a soft primary pulse once; doubtful ->
   a slow neutral breathe; paused -> desaturate; end of shift -> bloom settles. No red, ever.
3. **Haptic strip as a physical waveform**: bars animate with spring physics when a pattern plays, the watch body
   shakes per pulse with a spring (not linear), and the oscilloscope from W1 gets smooth trace + glow on the
   detection window.
4. **Entrance choreography**: headline blur-in word by word, watch rises into place (700ms expo), panel items
   stagger 60ms; total <= 1.4s, controls usable immediately.
5. **Screen transitions inside the watch** feel like watchOS: zoom alerts, directional pushes, ring segments draw,
   count-ups, the check draws itself, toasts slide with a spring settle.
6. **unit.html scroll choreography** (Mostar): IntersectionObserver-driven reveals, bars grow with stagger, the 24-cell
   heatmap ripples outward from the shift-change hour, the big "Measure the process, not the people." statement
   word-reveals; sticky "no names" notice slides in after the first scroll.
7. **Theme switch**: circular View Transition from the toggle (fallback fade). Both themes crafted; watch screen stays black.

## Acceptance
Existing tests green; new: tilt transform changes with pointer and resets under reduced motion; no long task > 100ms
during the guided story; heatmap ripple delay is monotonic in distance from the shift-change cell; theme transition
cleans up; token test passes in both themes. Screenshots of 6 key moments x 2 themes in shots/ and you LOOKED at
them; redo anything flat or generic. Commit "watch: visual signature". Report <= 8 lines naming the reference per technique.
