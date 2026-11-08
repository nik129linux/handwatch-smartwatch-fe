package co.ucc.handhygiene.wear;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/* Small view factory. Colors always come from R.color tokens (colors.xml)
   and every tappable control is at least 48dp tall.

   Round face: the screen is a circle, so a centered row is only safe while
   it is narrower than the chord at its own height. Every chip width comes
   from the helpers below (MAX_WIDTH_FRACTION of the face, never wider than
   that chord, and EDGE_INSET_FRACTION at the caps), and never from a raw
   MATCH_PARENT. */
final class Ui {
    static final int MIN_TOUCH_DP = 48;
    static final int ROW_DP = 56;

    /* Widest chip the face allows at the vertical centre. */
    static final float MAX_WIDTH_FRACTION = 0.80f;

    /* Side inset of the scrolling column and of any row near the caps. */
    static final float EDGE_INSET_FRACTION = 0.12f;

    /* Quiet gap kept between a chip and the round mask. */
    private static final int BEZEL_DP = 4;

    private Ui() { }

    static int dp(Context context, int value) {
        return (int) (value * context.getResources().getDisplayMetrics().density + 0.5f);
    }

    static GradientDrawable rounded(Context context, int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setCornerRadius(dp(context, radiusDp));
        drawable.setColor(color);
        return drawable;
    }

    static Button pill(Context context, CharSequence label, int fill, int textColor, int heightDp) {
        int height = dp(context, Math.max(MIN_TOUCH_DP, heightDp));
        Button button = new Button(context);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(textColor);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(context, 12), 0, dp(context, 12), 0);
        button.setMinHeight(height);
        button.setMinimumHeight(height);
        button.setBackground(rounded(context, fill, Math.max(MIN_TOUCH_DP, heightDp) / 2));
        return button;
    }

    /* A secondary action reads as text (the guide's Skip): 48dp tall, caption
       sized, no fill, so the screen keeps exactly one primary pill. */
    static Button textButton(Context context, CharSequence label, int textColor) {
        int height = dp(context, MIN_TOUCH_DP);
        Button button = new Button(context);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(textColor);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(context, 8), 0, dp(context, 8), 0);
        button.setMinHeight(height);
        button.setMinimumHeight(height);
        button.setBackground(null);
        return button;
    }

    /* A compact 48dp chip with a leading icon (Home's gear). */
    static Button chip(Context context, CharSequence label, int iconRes,
                       int fill, int textColor) {
        Button button = pill(context, label, fill, textColor, MIN_TOUCH_DP);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        button.setPadding(dp(context, 14), 0, dp(context, 16), 0);
        button.setCompoundDrawablePadding(dp(context, 6));
        button.setCompoundDrawablesRelativeWithIntrinsicBounds(iconRes, 0, 0, 0);
        return button;
    }

    static TextView text(Context context, CharSequence label, int sizeSp, int color) {
        TextView view = new TextView(context);
        view.setText(label);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    /* ------------------------------------------------------ round geometry */

    static int faceWidth(Context context) {
        return context.getResources().getDisplayMetrics().widthPixels;
    }

    static int faceHeight(Context context) {
        return context.getResources().getDisplayMetrics().heightPixels;
    }

    /* The circle chord at a vertical position (0 = top edge, 1 = bottom
       edge), minus a bezel so the mask never touches the chip. */
    static int chordWidth(Context context, float centerY) {
        int width = faceWidth(context);
        int height = faceHeight(context);
        float radius = Math.min(width, height) / 2f;
        float dy = Math.abs(centerY * height - height / 2f);
        if (dy >= radius) return 0;
        int chord = Math.round(2f * (float) Math.sqrt(radius * radius - dy * dy));
        return Math.max(0, chord - dp(context, BEZEL_DP));
    }

    /* A chip may never be wider than 80% of the face nor than the chord at
       its row: the smaller of the two always wins. */
    static int roundSafeWidth(Context context, float centerY) {
        int cap = Math.round(faceWidth(context) * MAX_WIDTH_FRACTION);
        int chord = chordWidth(context, centerY);
        return chord > 0 ? Math.min(cap, chord) : cap;
    }

    /* The scroll column: 12% side insets at the top and bottom rows. */
    static int columnWidth(Context context) {
        return Math.round(faceWidth(context) * (1f - 2f * EDGE_INSET_FRACTION));
    }

    /* Params for a chip that fills the round-safe width of its row. */
    static LinearLayout.LayoutParams roundLp(Context context, float centerY) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                roundSafeWidth(context, centerY), LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        return lp;
    }

    /* Params for a chip whose width is its own text (Home's gear chip); the
       cap comes from fit(). */
    static LinearLayout.LayoutParams roundWrapLp(Context context, float centerY) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        return lp;
    }

    /* Caps a wrap-content chip to the round-safe width of its row. */
    static void fit(Context context, TextView view, float centerY) {
        view.setMaxWidth(roundSafeWidth(context, centerY));
    }

    /* A row inside the scrolling column (12% insets, never the full face). */
    static LinearLayout.LayoutParams rowLp(Context context) {
        return new LinearLayout.LayoutParams(
                columnWidth(context), LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    /* One of a pair of chips sharing a column row. */
    static LinearLayout.LayoutParams halfLp(Context context, int gapDp) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.leftMargin = dp(context, gapDp);
        lp.rightMargin = dp(context, gapDp);
        return lp;
    }

    /* A chip inside a card that already sits in the column: the card's own
       padding is the only extra inset. */
    static LinearLayout.LayoutParams innerLp(Context context, int paddingDp) {
        return new LinearLayout.LayoutParams(
                Math.max(0, columnWidth(context) - 2 * dp(context, paddingDp)),
                LinearLayout.LayoutParams.WRAP_CONTENT);
    }
}
