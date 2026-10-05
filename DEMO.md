# Demo — Hand Hygiene Watch (2 minutes)

## Launch

Double-click **Hand Hygiene Watch** in the dock/launcher, or run `npm start`
from this folder. Everything runs offline in one desktop window.

## Presenter script

**0:00 — The thesis (Home).** "This watch WILL be wrong — a wrong mark is an
automatic accusation against a nurse. So the whole design is about correcting
it with one tap, and never showing it as an accusation." Point at the ring:
12 of 15 moments, no names anywhere.

**0:20 — Guided shift.** Click **▶ Guided shift**. "The watch taps, never
sounds — the buzz reaches the wrist, never in front of the patient."
Watch beat 2: reminder buzzes, screen shows only *Already did it*.

**0:45 — The wrong mark.** "Here it is — the watch was wrong." The doubt
screen asks *Did you wash?* with two pills, no form, no reason field.
The fingertip taps **Yes, I did** → toast *Noted. Thanks.* "One tap, gone.
Never red, never the word error."

**1:10 — The emergency.** Code blue → *Silence 30 min*, moon in the status
bar. "In an emergency the watch shuts up — the reminder arrives muted."
Click the **side button**: *Who sees this* — You / Infection control /
No one. "Details are yours, gone in 24 h. The unit sees totals only."

**1:35 — Free mode.** "Same engine, your hands." Click **Doubtful wash**,
correct it yourself. Turn the crown with the mouse wheel; **Esc** goes back.
End on **See what Infection Control sees**: bars by WHO moment, no names,
*Measure the process, not the people.*

## Real vs simulated

Real: the on-device classifier (`js/classifier.js` + `js/signal.js`) — every
wash detection runs seeded accelerometer synthesis through feature extraction
(confidence thresholds 0.75/0.4) to a sure/unsure/none verdict; noise makes it
wrong, honestly. Real: haptic vocabulary over `navigator.vibrate`, 24 h log
purge, token propagation. Simulated: the sensor stream itself (no hardware),
the shift script, the unit dashboard numbers.

## 3 questions you'll ask

**"Why not just make the classifier accurate?"** Noise is the hospital:
water, gloves, gel all look alike at the wrist. The design assumes error and
puts the nurse as the judge — one tap — instead of chasing 100%.

**"Why no sound at all?"** Sound accuses in front of the patient. Vibration
is private to the body; four patterns feel different so *reminder* and
*unsure* can't be confused with the screen in her pocket.

**"Could the unit page identify someone?"** No. Aggregation counts
`corrected:true` events with no person field (the log schema has none, purge
at 24 h); there is no filter, no search, no per-person view to abuse.
