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
    /* Inner padding of the haptic cards: their play button is that much
       narrower than the column. */
    private static final int CARD_PAD_DP = 12;

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
        centerList(scroll, content);

        TextView lede = Ui.text(this, str(R.string.help_lede), 13, color(R.color.hh_text_dim));
        LinearLayout.LayoutParams ledeLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        ledeLp.topMargin = dp(8);
        ledeLp.bottomMargin = dp(6);
        content.addView(lede, ledeLp);

        for (int i = 0; i < KINDS.length; i++) {
            content.addView(hapticRow(i), rowParams(dp(6)));
        }

        /* Atrás ends the list instead of hovering over it: the old fixed pill
           covered the last card's play button. */
        Button back = Ui.pill(this, str(R.string.help_back),
                color(R.color.hh_track), color(R.color.hh_text), Ui.MIN_TOUCH_DP);
        LinearLayout.LayoutParams backLp = Ui.rowLp(this);
        backLp.topMargin = dp(12);
        content.addView(back, backLp);
        back.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                finish();
            }
        });

        setContentView(root);
        roundInsets(root);
    }

    /* One card per pattern: name + line on top, play button below.
       A side-by-side row squeezed "Recordatorio" into a hyphenated stub
       on the 336 px round-safe column, so every card stacks vertically. */
    private View hapticRow(final int index) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(Ui.rounded(this, color(R.color.hh_track), 14));
        card.setPadding(dp(CARD_PAD_DP), dp(10), dp(CARD_PAD_DP), dp(10));

        card.addView(Ui.text(this, str(NAMES[index]), 15, color(R.color.hh_text)),
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams lineLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lineLp.topMargin = dp(2);
        card.addView(Ui.text(this, str(LINES[index]), 12, color(R.color.hh_text_dim)), lineLp);

        Button play = Ui.pill(this, str(R.string.help_play),
                color(R.color.hh_lime), color(R.color.hh_on_lime), Ui.MIN_TOUCH_DP);
        play.setContentDescription(getString(R.string.help_play_desc, str(NAMES[index])));
        play.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Haptics.play(HelpActivity.this, KINDS[index]);
            }
        });
        LinearLayout.LayoutParams playLp = Ui.innerLp(this, CARD_PAD_DP);
        playLp.topMargin = dp(8);
        card.addView(play, playLp);
        return card;
    }

    private LinearLayout.LayoutParams rowParams(int topMargin) {
        LinearLayout.LayoutParams lp = Ui.rowLp(this);
        lp.topMargin = topMargin;
        return lp;
    }
}
