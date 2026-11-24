package co.ucc.handhygiene.wear;

import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/* First-run guide (level 1): three cards, dots, one primary pill and Saltar
   as a caption text button under them. The crown, a vertical swipe or the
   pill move between cards. Seen once; replayable from Ajustes.

   Everything lives in one measured vertical stack (kicker, title, 12dp gap,
   dots, counter, Saltar, pill). There is no weighted, centered sub-view and
   no fixed y offset: the title auto-sizes down from 18sp to 10sp until the
   measured stack fits the face, so the dots can never overlap its last line
   at 227dp (454 px) or at the smallest 192dp (384 px) round. */
public class GuideActivity extends BaseActivity {
    private static final int TITLE_SP_MAX = 18;
    private static final int TITLE_SP_MIN = 10;
    private static final int TITLE_LINES_MAX = 2;
    private static final int TITLE_GAP_DP = 12;

    /* Free bands of the fixed stack, as a fraction of the face width. */
    private static final float GUIDE_TOP_BAND = 0.01f;
    private static final float GUIDE_BOTTOM_BAND = 0.04f;

    private static final int[] KICKERS = {
            R.string.guide_kicker_1, R.string.guide_kicker_2, R.string.guide_kicker_3
    };
    private static final int[] BODIES = {
            R.string.guide_body_1, R.string.guide_body_2, R.string.guide_body_3
    };

    private int card = 0;
    private int titleSizeSp = TITLE_SP_MAX;
    private TextView kicker;
    private TextView title;
    private TextView counter;
    private LinearLayout dots;
    private LinearLayout stack;
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
        root.setGravity(Gravity.CENTER_HORIZONTAL | Gravity.CENTER_VERTICAL);
        root.setBackgroundColor(color(R.color.hh_black));

        /* One stack: every row is measured, then the stack is centred as a
           whole. Nothing has weight, so a long title can push the rows below
           it instead of growing over them. */
        stack = new LinearLayout(this);
        stack.setOrientation(LinearLayout.VERTICAL);
        stack.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(stack, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        kicker = Ui.text(this, "", 12, color(R.color.hh_text_dim));
        LinearLayout.LayoutParams kickerLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        kickerLp.bottomMargin = dp(2);
        stack.addView(kicker, kickerLp);

        title = Ui.text(this, "", TITLE_SP_MAX, color(R.color.hh_text));
        title.setMaxLines(TITLE_LINES_MAX);
        title.setSingleLine(false);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleLp.bottomMargin = dp(TITLE_GAP_DP);
        stack.addView(title, titleLp);

        dots = new LinearLayout(this);
        dots.setOrientation(LinearLayout.HORIZONTAL);
        dots.setGravity(Gravity.CENTER);
        stack.addView(dots, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        counter = Ui.text(this, "", 12, color(R.color.hh_text_dim));
        LinearLayout.LayoutParams counterLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        counterLp.topMargin = dp(2);
        stack.addView(counter, counterLp);

        /* Saltar sits under the dots as a caption-sized text button: 48dp of
           touch target, no fill, so the pill below stays the only primary
           action. Its width is capped to the circle chord at its measured
           row after the first layout. */
        skip = Ui.textButton(this, str(R.string.guide_skip), color(R.color.hh_text_dim));
        LinearLayout.LayoutParams skipLp = Ui.wrapLp(this);
        stack.addView(skip, skipLp);

        next = Ui.pill(this, str(R.string.guide_next),
                color(R.color.hh_lime), color(R.color.hh_on_lime), Ui.MIN_TOUCH_DP);
        LinearLayout.LayoutParams nextLp = Ui.rowLp(this);
        nextLp.topMargin = dp(4);
        stack.addView(next, nextLp);

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

        /* The size is chosen from measured text once, before the first
           layout. Changing text size at runtime leaves stale measured heights
           that squeeze the last pill, so the whole guide commits to one
           size that fits the largest of the three card titles. */
        titleSizeSp = chooseTitleSize();
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, titleSizeSp);

        setContentView(root);
        /* Tight bands: the guide is a fixed stack, not a list, and its two
           bottom controls sit close to the caps. */
        setVerticalBands(GUIDE_TOP_BAND, GUIDE_BOTTOM_BAND);
        roundInsets(root);

        /* After layout the chips are capped to the chord at their measured
           rows (top and bottom edges), never to a hardcoded y. */
        View.OnLayoutChangeListener fitChips = new View.OnLayoutChangeListener() {
            @Override
            public void onLayoutChange(View view, int left, int top, int right, int bottom,
                                       int oldLeft, int oldTop, int oldRight, int oldBottom) {
                placeChips(root);
            }
        };
        root.addOnLayoutChangeListener(fitChips);
        title.addOnLayoutChangeListener(fitChips);

        show(0);
    }

    private void show(int index) {
        card = Math.max(0, Math.min(BODIES.length - 1, index));
        kicker.setText(str(KICKERS[card]));
        title.setText(str(BODIES[card]));
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
        stack.requestLayout();
    }

    /* The measured height of a run of text at a size and width, with the
       same font padding/line spacing the TextView uses. This is the measure
       that decides the guide's spacing, not a fixed y offset. */
    private int textHeight(int sp, CharSequence text, int width, int maxLines) {
        if (text == null || text.length() == 0 || width <= 0) return 0;
        TextPaint paint = new TextPaint(title.getPaint());
        paint.setTextSize(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_SP, sp, getResources().getDisplayMetrics()));
        StaticLayout layout = StaticLayout.Builder
                .obtain(text, 0, text.length(), paint, width)
                .setMaxLines(maxLines)
                .setIncludePad(title.getIncludeFontPadding())
                .setLineSpacing(title.getLineSpacingExtra(), title.getLineSpacingMultiplier())
                .build();
        return layout.getHeight();
    }

    /* The stack's height without the title, plus the title's own margins.
       The buttons keep their 48dp floor; only the title ever shrinks. */
    private int fixedHeight(int width) {
        int kickerHeight = 0;
        for (int i = 0; i < KICKERS.length; i++) {
            kickerHeight = Math.max(kickerHeight,
                    textHeight(12, getString(KICKERS[i]), width, 1));
        }
        int counterHeight = textHeight(12,
                getString(R.string.guide_position, BODIES.length, BODIES.length), width, 1);
        int fixed = kickerHeight;
        fixed += dp(7);                                  /* dots */
        fixed += counterHeight;
        fixed += dp(Ui.MIN_TOUCH_DP) * 2;                /* Saltar + pill */
        fixed += dp(2 + TITLE_GAP_DP + 2 + 0 + 4);       /* row gaps */
        return fixed;
    }

    /* Pick the largest title size whose measured stack (the longest of the
       three card titles) fits between the round insets. Computed once,
       before the first layout, so no measured height can go stale. */
    private int chooseTitleSize() {
        int faceWidth = Ui.faceWidth(this);
        int faceHeight = Ui.faceHeight(this);
        int width = Ui.columnWidth(this);
        int available = faceHeight
                - (int) (faceWidth * GUIDE_TOP_BAND)
                - (int) (faceWidth * GUIDE_BOTTOM_BAND);
        int fixed = fixedHeight(width);
        int safety = dp(8);
        /* Keep a little air on each side of the title, so the chosen size
           does not sit flush against the round-safe column. */
        int titleWidth = Math.max(0, width - dp(16));
        for (int sp = TITLE_SP_MAX; sp >= TITLE_SP_MIN; sp -= 1) {
            int worst = 0;
            for (int i = 0; i < BODIES.length; i++) {
                worst = Math.max(worst,
                        textHeight(sp, getString(BODIES[i]), titleWidth, TITLE_LINES_MAX));
            }
            if (fixed + worst <= available - safety) return sp;
        }
        return TITLE_SP_MIN;
    }

    /* Each control is as wide as the narrowest circle chord across its
       measured row (top and bottom edge, not a guessed y), so a 48dp pill
       whose bottom sits near a cap cannot poke through the round mask. */
    private void placeChips(View root) {
        if (root.getHeight() <= 0) return;
        capToChord(next, root, false);
        capToChord(skip, root, true);
    }

    private void capToChord(TextView chip, View root, boolean wrap) {
        int face = root.getHeight();
        int rowTop = stack.getTop() + chip.getTop();
        int rowBottom = stack.getTop() + chip.getBottom();
        int width = Math.min(
                Ui.roundSafeWidth(this, rowTop / (float) face),
                Ui.roundSafeWidth(this, rowBottom / (float) face));
        if (wrap) {
            if (chip.getMaxWidth() != width) chip.setMaxWidth(width);
            return;
        }
        LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) chip.getLayoutParams();
        if (lp.width != width) {
            lp.width = width;
            chip.setLayoutParams(lp);
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
