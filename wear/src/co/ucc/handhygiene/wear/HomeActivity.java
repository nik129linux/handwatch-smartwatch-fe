package co.ucc.handhygiene.wear;

import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;

/* Home: the 15-moment ring and one gear pill that opens Ajustes. The
   first-run guide opens on top of Home, exactly once. */
public class HomeActivity extends BaseActivity {
    /* The chip's row, as a fraction of the face: its width is the chord
       there, capped at 80% of the face. */
    private static final float GEAR_Y = 0.90f;

    private HomeView ring;

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

        ring = new HomeView(this);
        root.addView(ring, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        /* A 48dp chip, not a quarter-screen bar: the gear icon plus the
           word, wrap-content and capped to the chord at its row. */
        Button gear = Ui.chip(this, str(R.string.home_settings), R.drawable.ic_gear,
                color(R.color.hh_track), color(R.color.hh_text));
        gear.setContentDescription(str(R.string.home_settings_desc));
        gear.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(new Intent(HomeActivity.this, SettingsActivity.class));
            }
        });
        Ui.fit(this, gear, GEAR_Y);
        LinearLayout.LayoutParams gearLp = Ui.roundWrapLp(this, GEAR_Y);
        gearLp.topMargin = dp(6);
        root.addView(gear, gearLp);

        setContentView(root);
        roundInsets(root);
        refreshRing();

        if (!guideSeen()) {
            startActivity(new Intent(this, GuideActivity.class));
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshRing();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (applyExtras(intent)) {
            recreate();
            return;
        }
        refreshRing();
    }

    private void refreshRing() {
        if (ring != null) ring.setState(done(), plan());
    }
}
