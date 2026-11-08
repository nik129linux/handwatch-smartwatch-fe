package co.ucc.handhygiene.wear;

import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/* First-run guide (level 1): three cards, dots, one primary pill and Saltar
   as a caption text button under them. The crown, a vertical swipe or the
   pill move between cards. Seen once; replayable from Ajustes. */
public class GuideActivity extends BaseActivity {
    /* Row heights of the two bottom controls, as a fraction of the face: the
       chip widths are the circle chord at those heights. */
    private static final float SKIP_Y = 0.82f;
    private static final float NEXT_Y = 0.92f;

    private static final int[] KICKERS = {
            R.string.guide_kicker_1, R.string.guide_kicker_2, R.string.guide_kicker_3
    };
    private static final int[] BODIES = {
            R.string.guide_body_1, R.string.guide_body_2, R.string.guide_body_3
    };

    private int card = 0;
    private TextView kicker;
    private TextView body;
    private TextView counter;
    private LinearLayout dots;
    private Button skip;
    private Button next;
    private float rotaryAccum = 0f;
    private float touchStartY = Float.NaN;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (applyExtras(getIntent())) {
            recreate();
            return;
        }
        markGuideSeen();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(color(R.color.hh_black));

        LinearLayout mid = new LinearLayout(this);
        mid.setOrientation(LinearLayout.VERTICAL);
        mid.setGravity(Gravity.CENTER);
        kicker = Ui.text(this, "", 12, color(R.color.hh_text_dim));
        body = Ui.text(this, "", 18, color(R.color.hh_text));
        LinearLayout.LayoutParams kickerLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        kickerLp.bottomMargin = dp(8);
        mid.addView(kicker, kickerLp);
        mid.addView(body, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(mid, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout meta = new LinearLayout(this);
        meta.setOrientation(LinearLayout.VERTICAL);
        meta.setGravity(Gravity.CENTER);
        dots = new LinearLayout(this);
        dots.setOrientation(LinearLayout.HORIZONTAL);
        dots.setGravity(Gravity.CENTER);
        meta.addView(dots, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        counter = Ui.text(this, "", 12, color(R.color.hh_text_dim));
        LinearLayout.LayoutParams counterLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        counterLp.topMargin = dp(4);
        meta.addView(counter, counterLp);
        /* Saltar sits under the dots as a caption-sized text button: 48dp of
           touch target, no fill, so the pill below stays the only primary
           action. It used to be a 56dp pill parked on the top cap. */
        skip = Ui.textButton(this, str(R.string.guide_skip), color(R.color.hh_text_dim));
        Ui.fit(this, skip, SKIP_Y);
        LinearLayout.LayoutParams skipLp = Ui.roundWrapLp(this, SKIP_Y);
        skipLp.topMargin = dp(2);
        meta.addView(skip, skipLp);
        root.addView(meta, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        next = Ui.pill(this, str(R.string.guide_next),
                color(R.color.hh_lime), color(R.color.hh_on_lime), Ui.MIN_TOUCH_DP);
        Ui.fit(this, next, NEXT_Y);
        LinearLayout.LayoutParams nextLp = Ui.roundLp(this, NEXT_Y);
        nextLp.topMargin = dp(6);
        root.addView(next, nextLp);

        skip.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                finish();
            }
        });
        next.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (card >= BODIES.length - 1) {
                    finish();
                } else {
                    show(card + 1);
                }
            }
        });

        root.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View view, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        touchStartY = event.getY();
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!Float.isNaN(touchStartY)) {
                            float dy = event.getY() - touchStartY;
                            touchStartY = Float.NaN;
                            if (Math.abs(dy) > dp(36)) move(dy < 0 ? 1 : -1);
                        }
                        return false;
                    case MotionEvent.ACTION_CANCEL:
                        touchStartY = Float.NaN;
                        return false;
                    default:
                        return false;
                }
            }
        });

        setContentView(root);
        /* Tight bands: the guide is a fixed stack, not a list, and its two
           bottom controls sit close to the caps. */
        setVerticalBands(0.04f, 0.10f);
        roundInsets(root);
        show(0);
    }

    private void show(int index) {
        card = Math.max(0, Math.min(BODIES.length - 1, index));
        kicker.setText(str(KICKERS[card]));
        body.setText(str(BODIES[card]));
        next.setText(str(card == BODIES.length - 1 ? R.string.guide_start : R.string.guide_next));
        counter.setText(getString(R.string.guide_position, card + 1, BODIES.length));
        dots.removeAllViews();
        for (int i = 0; i < BODIES.length; i++) {
            View dot = new View(this);
            GradientDrawable shape = new GradientDrawable();
            shape.setShape(GradientDrawable.OVAL);
            shape.setColor(color(i == card ? R.color.hh_lime : R.color.hh_track));
            dot.setBackground(shape);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(7), dp(7));
            lp.leftMargin = dp(4);
            lp.rightMargin = dp(4);
            dots.addView(dot, lp);
        }
    }

    private void move(int delta) {
        show(card + delta);
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_SCROLL) {
            float delta = 0f;
            if (event.getSource() == InputDevice.SOURCE_ROTARY_ENCODER) {
                delta = event.getAxisValue(MotionEvent.AXIS_SCROLL);
            }
            if (delta == 0f) delta = event.getAxisValue(MotionEvent.AXIS_VSCROLL);
            if (delta != 0f) {
                rotaryAccum += delta;
                if (Math.abs(rotaryAccum) >= 0.5f) {
                    move(rotaryAccum > 0 ? 1 : -1);
                    rotaryAccum = 0f;
                }
                return true;
            }
        }
        return super.onGenericMotionEvent(event);
    }
}
