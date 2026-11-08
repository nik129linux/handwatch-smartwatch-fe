package co.ucc.handhygiene.wear;

import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/* Ajustes: language endonyms, replay the guide, Ayuda and wipe my data.
   Reached from the gear pill on Home; the crown scrolls the list. */
public class SettingsActivity extends BaseActivity {
    private TextView status;

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

        TextView title = Ui.text(this, str(R.string.settings_title), 16, color(R.color.hh_text));
        root.addView(title, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(content, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        bindRotaryScroll(scroll);

        content.addView(Ui.text(this, str(R.string.settings_language), 13,
                color(R.color.hh_text_dim)), rowParams(dp(8)));

        LinearLayout languages = new LinearLayout(this);
        languages.setOrientation(LinearLayout.HORIZONTAL);
        final boolean spanish = Lang.ES.equals(Lang.lang(this));
        Button es = languagePill(str(R.string.lang_es), spanish);
        Button en = languagePill(str(R.string.lang_en), !spanish);
        LinearLayout.LayoutParams halfLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        halfLp.rightMargin = dp(4);
        languages.addView(es, halfLp);
        LinearLayout.LayoutParams halfLp2 = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        halfLp2.leftMargin = dp(4);
        languages.addView(en, halfLp2);
        content.addView(languages, rowParams(dp(10)));

        Button replay = rowButton(str(R.string.settings_replay_guide));
        Button help = rowButton(str(R.string.settings_help));
        Button delete = rowButton(str(R.string.settings_delete));
        content.addView(replay, rowParams(dp(8)));
        content.addView(help, rowParams(dp(8)));
        content.addView(delete, rowParams(dp(8)));

        status = Ui.text(this, "", 13, color(R.color.hh_text_dim));
        content.addView(status, rowParams(dp(6)));

        Button close = Ui.pill(this, str(R.string.settings_close),
                color(R.color.hh_track), color(R.color.hh_text), Ui.MIN_TOUCH_DP);
        LinearLayout.LayoutParams closeLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        closeLp.topMargin = dp(10);
        root.addView(close, closeLp);

        es.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                setLanguage(Lang.ES);
            }
        });
        en.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                setLanguage(Lang.EN);
            }
        });
        replay.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(new Intent(SettingsActivity.this, GuideActivity.class));
            }
        });
        help.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(new Intent(SettingsActivity.this, HelpActivity.class));
            }
        });
        delete.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                /* My data, not my language: counters and guide progress go. */
                prefs.edit().remove(P_DONE).remove(P_GUIDE).apply();
                status.setText(str(R.string.delete_done));
            }
        });
        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                finish();
            }
        });

        setContentView(root);
        roundInsets(root);
    }

    private Button languagePill(String label, boolean active) {
        int fill = color(active ? R.color.hh_lime : R.color.hh_track);
        int text = color(active ? R.color.hh_on_lime : R.color.hh_text);
        return Ui.pill(this, label, fill, text, Ui.MIN_TOUCH_DP);
    }

    private Button rowButton(String label) {
        Button button = Ui.pill(this, label, color(R.color.hh_track),
                color(R.color.hh_text), Ui.ROW_DP);
        button.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        button.setPadding(dp(16), 0, dp(16), 0);
        return button;
    }

    private LinearLayout.LayoutParams rowParams(int topMargin) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = topMargin;
        return lp;
    }

    private void setLanguage(String language) {
        if (language.equals(Lang.lang(this))) return;
        prefs.edit().putString(P_LANG, language).apply();
        /* The desktop must not re-flip the choice with a stale extra. */
        if (getIntent() != null) getIntent().removeExtra("lang");
        recreate();
    }
}
