package co.ucc.handhygiene.wear;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewTreeObserver;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

public class AlertActivity extends Activity {
    private static final String PREFS = "hhw";
    private static final String P_LANG = "lang";
    private static final String P_DONE = "done";
    private static final String P_PLAN = "plan";
    private static final long HOME_DELAY_MS = 2000;

    private Vibrator vibrator;
    private Handler handler;
    private SharedPreferences prefs;
    private LinearLayout root;
    private TextView titleView;
    private TextView bodyView;
    private LinearLayout buttonContainer;
    private HomeView homeView;
    private final List<Button> buttons = new ArrayList<>();
    private int selectedIndex = 0;
    private String kind = "";
    private String lang = Labels.EN;
    private int done = 0;
    private int plan = 15;
    private float rotaryAccum = 0f;
    private boolean answered = false;  // one alert, one answer

    private int colLime;
    private int colTrack;
    private int colText;
    private int colDim;
    private int colOnLime;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        handler = new Handler(Looper.getMainLooper());
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        colLime = getResources().getColor(R.color.hh_lime, getTheme());
        colTrack = getResources().getColor(R.color.hh_track, getTheme());
        colText = getResources().getColor(R.color.hh_text, getTheme());
        colDim = getResources().getColor(R.color.hh_text_dim, getTheme());
        colOnLime = getResources().getColor(R.color.hh_on_lime, getTheme());

        done = clamp(prefs.getInt(P_DONE, 0));
        plan = clamp(prefs.getInt(P_PLAN, 15));
        lang = Labels.normalize(prefs.getString(P_LANG, Labels.EN));

        homeView = new HomeView(this);

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(getResources().getColor(R.color.hh_black, getTheme()));

        root.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
            @Override
            public void onGlobalLayout() {
                root.getViewTreeObserver().removeOnGlobalLayoutListener(this);
                int w = root.getWidth();
                if (w <= 0) w = dp(300);
                // Round screen: generous sides, shallow top and bottom, so two
                // stacked pills stay inside the circle.
                int side = (int) (w * 0.14f);
                root.setPadding(side, (int) (w * 0.08f), side, (int) (w * 0.06f));
            }
        });

        titleView = new TextView(this);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        titleView.setTextColor(colText);
        titleView.setGravity(Gravity.CENTER);
        titleView.setText(Labels.get(lang, Labels.APP_NAME));

        bodyView = new TextView(this);
        bodyView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        bodyView.setTextColor(colDim);
        bodyView.setGravity(Gravity.CENTER);

        buttonContainer = new LinearLayout(this);
        buttonContainer.setOrientation(LinearLayout.VERTICAL);
        buttonContainer.setGravity(Gravity.CENTER_HORIZONTAL);

        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleLp.bottomMargin = dp(4);
        root.addView(titleView, titleLp);

        LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bodyLp.bottomMargin = dp(6);
        root.addView(bodyView, bodyLp);

        root.addView(buttonContainer, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        applyIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handler.removeCallbacksAndMessages(null);
        applyIntent(intent);
    }

    private void applyIntent(Intent intent) {
        /* The last intent's language and counters survive relaunch, so Home
           always shows the last known shift. */
        if (intent != null) {
            SharedPreferences.Editor edit = prefs.edit();
            if (intent.hasExtra("lang")) {
                lang = Labels.normalize(intent.getStringExtra("lang"));
                edit.putString(P_LANG, lang);
            }
            if (intent.hasExtra("done")) {
                done = clamp(intent.getIntExtra("done", done));
                edit.putInt(P_DONE, done);
            }
            if (intent.hasExtra("plan")) {
                plan = clamp(intent.getIntExtra("plan", plan));
                edit.putInt(P_PLAN, plan);
            }
            edit.apply();
        }

        String k = intent != null ? intent.getStringExtra("kind") : null;
        kind = k == null ? "" : k;

        /* No kind = the launcher being opened: Home, not an alert. */
        if (kind.isEmpty()) {
            showHome();
            return;
        }

        String t = intent.getStringExtra("title");
        String b = intent.getStringExtra("body");
        titleView.setText(t == null ? Labels.get(lang, Labels.APP_NAME) : t);
        bodyView.setText(b == null ? Labels.get(lang, Labels.IDLE) : b);
        bodyView.setTextColor(colDim);
        titleView.setVisibility(View.VISIBLE);
        buttonContainer.setVisibility(View.VISIBLE);
        answered = false;
        buildButtons();
        selectedIndex = 0;
        updateSelection();
        setContentView(root);
        vibratePattern(kind);
        if (kind.equals("ok") || kind.equals("end")) {
            handler.postDelayed(new Runnable() {
                @Override
                public void run() { showHome(); }
            }, HOME_DELAY_MS);
        }
    }

    private void showHome() {
        handler.removeCallbacksAndMessages(null);
        buttonContainer.removeAllViews();
        buttons.clear();
        answered = true;
        homeView.setState(done, plan, lang);
        setContentView(homeView);
    }

    private void buildButtons() {
        buttonContainer.removeAllViews();
        buttons.clear();
        if (kind.equals("doubtful")) {
            addButton(Labels.get(lang, Labels.YES), "yes", colLime, colOnLime);
            addButton(Labels.get(lang, Labels.NO), "no", colTrack, colText);
        } else if (kind.equals("reminder")) {
            addButton(Labels.get(lang, Labels.ALREADY), "yes", colLime, colOnLime);
        }
    }

    private void addButton(String label, String tag, int fill, int textColor) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setTag(tag);
        btn.setAllCaps(false);
        btn.setTextColor(textColor);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        btn.setMinHeight(dp(44));
        btn.setMinimumHeight(dp(44));
        btn.setGravity(Gravity.CENTER);
        btn.setPadding(dp(12), dp(6), dp(12), dp(6));
        /* One selection system only: the lime-pill outline driven by the crown
           and arrow keys. Native focus would move a second, invisible cursor,
           so Enter could confirm a button the wearer does not see selected. */
        btn.setFocusable(false);
        btn.setFocusableInTouchMode(false);
        btn.setDefaultFocusHighlightEnabled(false);

        GradientDrawable gd = new GradientDrawable();
        gd.setShape(GradientDrawable.RECTANGLE);
        gd.setCornerRadius(dp(22));
        gd.setColor(fill);
        btn.setBackground(gd);

        final int idx = buttons.size();
        buttons.add(btn);
        btn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                selectedIndex = idx;
                updateSelection();
                confirm();
            }
        });

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(6);
        buttonContainer.addView(btn, lp);
    }

    private void updateSelection() {
        for (int i = 0; i < buttons.size(); i++) {
            Button b = buttons.get(i);
            GradientDrawable gd = (GradientDrawable) b.getBackground();
            if (i == selectedIndex) {
                gd.setStroke(dp(2), colText);
            } else {
                gd.setStroke(0, Color.TRANSPARENT);
            }
        }
    }

    private void moveSelection(int delta) {
        if (buttons.isEmpty()) return;
        int next = selectedIndex + delta;
        if (next < 0) next = 0;
        if (next >= buttons.size()) next = buttons.size() - 1;
        if (next != selectedIndex) {
            selectedIndex = next;
            updateSelection();
        }
    }

    private void confirm() {
        if (buttons.isEmpty() || answered) return;
        answered = true;
        Button sel = buttons.get(selectedIndex);
        /* The answer is the button's tag, never its translated label. */
        boolean yes = "yes".equals(sel.getTag());
        if (yes) {
            android.util.Log.i("HHW", "answer=yes");
        } else {
            android.util.Log.i("HHW", "answer=no");
        }
        vibratePattern("ok");
        String msg = yes ? Labels.get(lang, Labels.NOTED) : Labels.get(lang, Labels.STAYS);
        titleView.setVisibility(View.GONE);
        bodyView.setText(msg);
        bodyView.setTextColor(colText);
        buttonContainer.setVisibility(View.GONE);
        handler.postDelayed(new Runnable() {
            @Override
            public void run() { showHome(); }
        }, HOME_DELAY_MS);
    }

    private int clamp(int v) {
        return Math.max(0, Math.min(99, v));
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            // The crown press (STEM_PRIMARY) is reserved by Wear OS for Home and
            // never reaches apps; the second button (STEM_1) does.
            case KeyEvent.KEYCODE_STEM_PRIMARY:
            case KeyEvent.KEYCODE_STEM_1:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                if (!buttons.isEmpty()) { confirm(); return true; }
                break;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                moveSelection(1);
                return true;
            case KeyEvent.KEYCODE_DPAD_UP:
                moveSelection(-1);
                return true;
            default:
                break;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        if (event.getSource() == InputDevice.SOURCE_ROTARY_ENCODER) {
            float delta = event.getAxisValue(MotionEvent.AXIS_SCROLL);
            if (delta == 0f) return true;
            boolean newPositive = delta > 0;
            if (rotaryAccum != 0f && (rotaryAccum > 0) != newPositive) {
                moveSelection(newPositive ? 1 : -1);
                rotaryAccum = delta;
            } else {
                rotaryAccum += delta;
                if (Math.abs(rotaryAccum) >= 0.5f) {
                    moveSelection(rotaryAccum > 0 ? 1 : -1);
                    rotaryAccum = 0f;
                }
            }
            return true;
        }
        // A mouse wheel (scrcpy mirror on the PC) stands in for the crown:
        // wheel down moves the selection down.
        if (event.getAction() == MotionEvent.ACTION_SCROLL
                && event.isFromSource(InputDevice.SOURCE_CLASS_POINTER)) {
            float v = event.getAxisValue(MotionEvent.AXIS_VSCROLL);
            if (v != 0f) moveSelection(v < 0 ? 1 : -1);
            return true;
        }
        return super.onGenericMotionEvent(event);
    }

    private void vibratePattern(String k) {
        long[] base;
        switch (k) {
            case "reminder": base = new long[]{60, 120, 60}; break;
            case "ok": base = new long[]{35}; break;
            case "doubtful": base = new long[]{30, 70, 45, 70, 65}; break;
            case "end": base = new long[]{400}; break;
            default: return;
        }
        long[] timings = new long[base.length + 1];
        timings[0] = 0;
        System.arraycopy(base, 0, timings, 1, base.length);
        try {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
        } catch (Exception ignored) {
        }
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }
}
