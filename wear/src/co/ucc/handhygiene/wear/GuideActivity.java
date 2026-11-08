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

/* First-run guide (level 1): three cards, dots, one 56dp pill and Saltar.
   The crown, a vertical swipe or the pill move between cards. Seen once;
   replayable from Ajustes. */
public class GuideActivity extends BaseActivity {
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

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.END);
        Button skip = Ui.pill(this, str(R.string.guide_skip),
                color(R.color.hh_track), color(R.color.hh_text), Ui.MIN_TOUCH_DP);
        skip.setMinWidth(dp(72));
        top.addView(skip, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(top, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout mid = new LinearLayout(this);
        mid.setOrientation(LinearLayout.VERTICAL);
        mid.setGravity(Gravity.CENTER);
        kicker = Ui.text(this, "", 13, color(R.color.hh_text_dim));
        body = Ui.text(this, "", 22, color(R.color.hh_text));
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
        counterLp.topMargin = dp(6);
        meta.addView(counter, counterLp);
        root.addView(meta, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        next = Ui.pill(this, str(R.string.guide_next),
                color(R.color.hh_lime), color(R.color.hh_on_lime), Ui.ROW_DP);
        LinearLayout.LayoutParams nextLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        nextLp.topMargin = dp(10);
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
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(9), dp(9));
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
