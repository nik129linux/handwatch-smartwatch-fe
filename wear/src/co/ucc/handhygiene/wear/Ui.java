package co.ucc.handhygiene.wear;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.TextView;

/* Small view factory. Colors always come from R.color tokens (colors.xml)
   and every tappable control is at least 48dp tall. */
final class Ui {
    static final int MIN_TOUCH_DP = 48;
    static final int ROW_DP = 56;

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

    static TextView text(Context context, CharSequence label, int sizeSp, int color) {
        TextView view = new TextView(context);
        view.setText(label);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        return view;
    }
}
