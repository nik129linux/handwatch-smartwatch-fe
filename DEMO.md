# Demo — Hand Hygiene Watch (2 minutes)

## Launch

Double-click **Hand Hygiene Watch** in the dock/launcher, or run `npm start`
from this folder. Everything runs offline in one desktop window.

## Before class (real watch)

Watch paired in its companion app, phone on Wi-Fi with **ntfy** subscribed
to the topic in **Real watch**. Flip **Send to my wrist** on and press
**Doubtful wash** once: the wrist should buzz with *Did you wash?* in ~5 s.

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

**1:50 — The AI that helps the unit.** On the unit page, tap
*Where does the process slip?*: one line with the weakest moment, its
numbers and a dispenser fix. Then type *Which nurse misses the most?*:
refused on the page, "This view has no people". "The AI answers about the
process and cannot answer about a person, because the data has no person."
In the desktop app the first question shows the consent sheet (the exact
totals + question), then gemma answers in ~0.5 s with the badge *IA · gemma*;
any number not in the totals and the rules answer instead.
Model quality card: "The gesture model is trained, not hand-tuned: 99% on
streams it never saw vs 98% for my old rules. Synthetic data, I say it on
the page." Flip **EN | ES** top right: same app in Spanish.

**Show it on a wrist (optional).** With **Send to my wrist** on, every
haptic also reaches the real watch as a notification. "A cheap watch can't
run our app, so the phone relays it. Same words, same silence; the tap
back happens here."

## Real vs simulated

Real: the trained gesture model (`js/model.js`, softmax regression over the
features `js/classifier.js` extracts) decides every wash: probability >= 0.75
sure, 0.4-0.75 unsure, else nothing. Noise makes it wrong, honestly: a quick
gel rub under noise reads as "gel or nothing?" and the watch asks. Real: Ask
the unit (rules offline, gemma with consent, grounded). Real: haptic vocabulary over `navigator.vibrate`, 24 h log
purge, token propagation. Simulated: the sensor stream itself (no hardware),
the shift script, the unit dashboard numbers.

## Questions a strict reviewer will ask

**"Where is the AI, exactly?"** Two places. On the wrist, a trained model
(not if/else) reads the motion: 1,800 training streams, tested on 360 it
never saw, 99% vs 98% for hand rules. For the unit, *Ask the unit* answers
questions with a language model, but only with numbers it was given.

**"Your data is synthetic. So what does 99% prove?"** That the model learned
the simulator, nothing more; the page says so. The pipeline (features,
training, held-out test, calibration) is what transfers to real wrist data.

**"Does the question leave the computer?"** Only after consent, and only with
anonymous totals. Questions about a person are refused before that. The cloud
model is optional; without it the rules answer.

**"Why not just make the classifier accurate?"** Noise is the hospital:
water, gloves, gel all look alike at the wrist. The design assumes error and
puts the nurse as the judge — one tap — instead of chasing 100%.

**"Why no sound at all?"** Sound accuses in front of the patient. Vibration
is private to the body; four patterns feel different so *reminder* and
*unsure* can't be confused with the screen in her pocket.

**"Could the unit page identify someone?"** No. Aggregation counts
`corrected:true` events with no person field (the log schema has none, purge
at 24 h); there is no filter, no search, no per-person view to abuse.
