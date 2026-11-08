package co.ucc.handhygiene.wear;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Insets;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.widget.ScrollView;

/* Shared base: forced locale, stored shift counters, round-screen insets and
   rotary scrolling for lists. A gesture back is the framework default. */
abstract class BaseActivity extends Activity {
    static final String PREFS = "hhw";
    static final String P_LANG = "lang";
    static final String P_DONE = "done";
    static final String P_PLAN = "plan";
    static final String P_GUIDE = "guide_seen";
    static final int PLAN_DEFAULT = 15;

    SharedPreferences prefs;
    private String shownLang;
    private int insetL;
    private int insetT;
    private int insetR;
    private int insetB;
    private ScrollView scrollTarget;

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(Lang.wrap(base));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        shownLang = Lang.lang(this);
        getWindow().setStatusBarColor(color(R.color.hh_black));
        getWindow().setNavigationBarColor(color(R.color.hh_black));
    }

    @Override
    protected void onResume() {
        super.onResume();
        /* Ajustes changed the language while this screen sat underneath. */
        if (!shownLang.equals(Lang.lang(this))) recreate();
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        if (scrollTarget != null && event.getAction() == MotionEvent.ACTION_SCROLL) {
            float delta = event.getAxisValue(MotionEvent.AXIS_SCROLL);
            if (delta == 0f) delta = event.getAxisValue(MotionEvent.AXIS_VSCROLL);
            if (delta != 0f) {
                scrollTarget.scrollBy(0, Math.round(delta * dp(48)));
                return true;
            }
        }
        return super.onGenericMotionEvent(event);
    }

    /** The crown / mouse wheel scrolls this list. */
    void bindRotaryScroll(ScrollView view) {
        scrollTarget = view;
    }

    int color(int id) {
        return getResources().getColor(id, getTheme());
    }

    String str(int id) {
        return getString(id);
    }

    /** Done moments clamped to the plan: the ring never reads 16 / 15. */
    int done() {
        return Math.min(plan(), Math.max(0, prefs.getInt(P_DONE, 0)));
    }

    int plan() {
        return Math.max(1, Math.min(99, prefs.getInt(P_PLAN, PLAN_DEFAULT)));
    }

    void addDone() {
        prefs.edit().putInt(P_DONE, Math.min(plan(), done() + 1)).apply();
    }

    void markGuideSeen() {
        prefs.edit().putBoolean(P_GUIDE, true).apply();
    }

    boolean guideSeen() {
        return prefs.getBoolean(P_GUIDE, false);
    }

    /**
     * Reads the desktop bridge extras (lang, done, plan) and persists them.
     *
     * @return true when the language changed, so the caller can recreate().
     */
    boolean applyExtras(Intent intent) {
        if (intent == null) return false;
        SharedPreferences.Editor edit = prefs.edit();
        boolean langChanged = false;
        if (intent.hasExtra("lang")) {
            String next = Lang.normalize(intent.getStringExtra("lang"));
            if (!next.equals(prefs.getString(P_LANG, Lang.ES))) {
                edit.putString(P_LANG, next);
                langChanged = true;
            }
        }
        if (intent.hasExtra("done")) {
            edit.putInt(P_DONE, Math.max(0, intent.getIntExtra("done", done())));
        }
        if (intent.hasExtra("plan")) {
            edit.putInt(P_PLAN, Math.max(1, intent.getIntExtra("plan", plan())));
        }
        edit.apply();
        return langChanged;
    }

    int dp(int value) {
        return Ui.dp(this, value);
    }

    /* Round screen: generous sides, shallow top and bottom, and never less
       than the system bars or a display cutout ask for. The base padding is
       set immediately from the display width (listeners alone proved too
       late on the emulator: content rendered edge-to-edge, pills and long
       lines clipped by the round mask), then raised to the system insets. */
    void roundInsets(final View root) {
        padBase(root);
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                insetL = bars.left;
                insetT = bars.top;
                insetR = bars.right;
                insetB = bars.bottom;
                pad(root);
                return insets;
            }
        });
        root.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
            @Override
            public void onLayoutChange(View view, int left, int top, int right, int bottom,
                                       int oldLeft, int oldTop, int oldRight, int oldBottom) {
                pad(root);
            }
        });
        root.requestApplyInsets();
    }

    private void padBase(View view) {
        int width = getResources().getDisplayMetrics().widthPixels;
        if (width <= 0) width = dp(227);
        int side = (int) (width * 0.13f);
        view.setPadding(side, (int) (width * 0.05f), side, (int) (width * 0.04f));
    }

    private void pad(View view) {
        int width = view.getWidth();
        if (width <= 0) return;
        int side = Math.max((int) (width * 0.13f), Math.max(insetL, insetR));
        int top = Math.max((int) (width * 0.05f), insetT);
        int bottom = Math.max((int) (width * 0.04f), insetB);
        view.setPadding(side, top, side, bottom);
    }
}
