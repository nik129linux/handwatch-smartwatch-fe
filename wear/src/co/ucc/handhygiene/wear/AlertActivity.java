package co.ucc.handhygiene.wear;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.hardware.input.InputManager;
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
    private Vibrator vibrator;
    private Handler handler;
    private LinearLayout root;
    private TextView titleView;
    private TextView bodyView;
    private LinearLayout buttonContainer;
    private final List<Button> buttons = new ArrayList<>();
    private int selectedIndex = 0;
    private String kind = "";
    private float rotaryAccum = 0f;
    private boolean answered = false;  // one alert, one answer

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        handler = new Handler(Looper.getMainLooper());

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.BLACK);

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
        titleView.setTextColor(Color.WHITE);
        titleView.setGravity(Gravity.CENTER);
        titleView.setText("Hand Hygiene");

        bodyView = new TextView(this);
        bodyView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        bodyView.setTextColor(Color.parseColor("#9a9a9a"));
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

        setContentView(root);

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
        String t = intent != null ? intent.getStringExtra("title") : null;
        String b = intent != null ? intent.getStringExtra("body") : null;
        String k = intent != null ? intent.getStringExtra("kind") : null;
        kind = k == null ? "" : k;
        titleView.setText(t == null ? "Hand Hygiene" : t);
        bodyView.setText(b == null ? "Waiting for the shift" : b);
        bodyView.setTextColor(Color.parseColor("#9a9a9a"));
        titleView.setVisibility(View.VISIBLE);
        buttonContainer.setVisibility(View.VISIBLE);
        answered = false;
        buildButtons();
        selectedIndex = 0;
        updateSelection();
        if (!kind.isEmpty()) {
            vibratePattern(kind);
        }
        if (kind.equals("ok") || kind.equals("end")) {
            handler.postDelayed(new Runnable() {
                @Override
                public void run() { finish(); }
            }, 4000);
        }
    }

    private void buildButtons() {
        buttonContainer.removeAllViews();
        buttons.clear();
        if (kind.equals("doubtful")) {
            addButton("Yes, I did", Color.parseColor("#a6ff00"), Color.parseColor("#101010"));
            addButton("Couldn't", Color.parseColor("#333333"), Color.WHITE);
        } else if (kind.equals("reminder")) {
            addButton("Already did it", Color.parseColor("#a6ff00"), Color.parseColor("#101010"));
        }
    }

    private void addButton(String label, int fill, int textColor) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setTextColor(textColor);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        btn.setMinHeight(dp(44));
        btn.setMinimumHeight(dp(44));
        btn.setGravity(Gravity.CENTER);
        btn.setPadding(dp(12), dp(6), dp(12), dp(6));

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
                gd.setStroke(dp(2), Color.WHITE);
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
        String label = sel.getText().toString();
        boolean yes = label.equals("Yes, I did") || label.equals("Already did it");
        if (yes) {
            android.util.Log.i("HHW", "answer=yes");
        } else {
            android.util.Log.i("HHW", "answer=no");
        }
        vibratePattern("ok");
        String msg = yes ? "Noted. Thanks." : "Stays with you.";
        titleView.setVisibility(View.GONE);
        bodyView.setText(msg);
        bodyView.setTextColor(Color.WHITE);
        buttonContainer.setVisibility(View.GONE);
        handler.postDelayed(new Runnable() {
            @Override
            public void run() { finish(); }
        }, 1500);
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