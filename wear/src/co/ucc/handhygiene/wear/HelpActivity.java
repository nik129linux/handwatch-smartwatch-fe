package co.ucc.handhygiene.wear;

import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/* Ayuda: the four vibrations of the desktop vocabulary, name plus one line,
   and a play button that runs the same VibrationEffect waveform the alerts
   use. The crown scrolls the list. */
public class HelpActivity extends BaseActivity {
    private static final String[] KINDS = {
            Haptics.REMINDER, Haptics.OK, Haptics.DOUBTFUL, Haptics.END
    };
    private static final int[] NAMES = {
            R.string.haptic_reminder, R.string.haptic_ok,
            R.string.haptic_doubtful, R.string.haptic_end
    };
    private static final int[] LINES = {
            R.string.haptic_reminder_line, R.string.haptic_ok_line,
            R.string.haptic_doubtful_line, R.string.haptic_end_line
    };

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (applyExtras(getIntent())) {
            recreate();
            return;
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(color(R.color.hh_black));

        root.addView(Ui.text(this, str(R.string.help_title), 16, color(R.color.hh_text)),
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(content, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        bindRotaryScroll(scroll);

        TextView lede = Ui.text(this, str(R.string.help_lede), 13, color(R.color.hh_text_dim));
        LinearLayout.LayoutParams ledeLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        ledeLp.topMargin = dp(8);
        ledeLp.bottomMargin = dp(6);
        content.addView(lede, ledeLp);

        for (int i = 0; i < KINDS.length; i++) {
            content.addView(hapticRow(i), rowParams(dp(6)));
        }

        Button back = Ui.pill(this, str(R.string.help_back),
                color(R.color.hh_track), color(R.color.hh_text), Ui.MIN_TOUCH_DP);
        LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        backLp.topMargin = dp(10);
        root.addView(back, backLp);
        back.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                finish();
            }
        });

        setContentView(root);
        roundInsets(root);
    }

    private View hapticRow(final int index) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setBackground(Ui.rounded(this, color(R.color.hh_track), 14));
        row.setPadding(dp(12), dp(8), dp(8), dp(8));

        LinearLayout labels = new LinearLayout(this);
        labels.setOrientation(LinearLayout.VERTICAL);
        labels.addView(Ui.text(this, str(NAMES[index]), 15, color(R.color.hh_text)));
        LinearLayout.LayoutParams lineLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lineLp.topMargin = dp(2);
        labels.addView(Ui.text(this, str(LINES[index]), 12, color(R.color.hh_text_dim)), lineLp);
        row.addView(labels, new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        Button play = Ui.pill(this, str(R.string.help_play),
                color(R.color.hh_lime), color(R.color.hh_on_lime), Ui.MIN_TOUCH_DP);
        play.setContentDescription(getString(R.string.help_play_desc, str(NAMES[index])));
        play.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Haptics.play(HelpActivity.this, KINDS[index]);
            }
        });
        row.addView(play, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return row;
    }

    private LinearLayout.LayoutParams rowParams(int topMargin) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = topMargin;
        return lp;
    }
}
