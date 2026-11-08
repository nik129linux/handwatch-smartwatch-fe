package co.ucc.handhygiene.wear;

import android.content.Intent;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/* One alert, one answer. The desktop (or adb) sends title/body/kind; the
   launcher with no kind opens Home. Every control is at least 48dp. */
public class AlertActivity extends BaseActivity {
    private static final long HOME_DELAY_MS = 2000;

    private Handler handler;
    private LinearLayout root;
    private TextView titleView;
    private TextView bodyView;
    private LinearLayout buttonContainer;
    private final List<Button> buttons = new ArrayList<>();
    private int selectedIndex = 0;
    private String kind = "";
    private float rotaryAccum = 0f;
    private boolean answered = false;

    private int colLime;
    private int colTrack;
    private int colText;
    private int colDim;
    private int colOnLime;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (applyExtras(getIntent())) {
            recreate();
            return;
        }
        handler = new Handler(Looper.getMainLooper());

        colLime = color(R.color.hh_lime);
        colTrack = color(R.color.hh_track);
        colText = color(R.color.hh_text);
        colDim = color(R.color.hh_text_dim);
        colOnLime = color(R.color.hh_on_lime);

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(color(R.color.hh_black));

        titleView = Ui.text(this, "", 18, colText);
        bodyView = Ui.text(this, "", 14, colDim);

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
        roundInsets(root);
        showIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handler.removeCallbacksAndMessages(null);
        if (applyExtras(intent)) {
            recreate();
            return;
        }
        showIntent(intent);
    }

    private void showIntent(Intent intent) {
        String k = intent != null ? intent.getStringExtra("kind") : null;
        kind = k == null ? "" : k;

        /* No kind = the launcher being opened: Home, not an alert. */
        if (kind.isEmpty()) {
            startActivity(new Intent(this, HomeActivity.class));
            finish();
            return;
        }

        String extraTitle = intent.getStringExtra("title");
        String extraBody = intent.getStringExtra("body");
        int titleRes = R.string.app_name;
        int bodyRes = 0;
        if (kind.equals(Haptics.DOUBTFUL)) {
            titleRes = R.string.alert_doubt_title;
            bodyRes = R.string.alert_doubt_body;
        } else if (kind.equals(Haptics.REMINDER)) {
            titleRes = R.string.alert_reminder_title;
        } else if (kind.equals(Haptics.OK)) {
            titleRes = R.string.alert_ok_title;
        } else if (kind.equals(Haptics.END)) {
            titleRes = R.string.alert_end_title;
        } else {
            bodyRes = R.string.alert_idle_body;
        }

        titleView.setText(extraTitle == null ? str(titleRes) : extraTitle);
        if (extraBody != null) {
            bodyView.setText(extraBody);
            bodyView.setVisibility(View.VISIBLE);
        } else if (bodyRes != 0) {
            bodyView.setText(str(bodyRes));
            bodyView.setVisibility(View.VISIBLE);
        } else {
            bodyView.setVisibility(View.GONE);
        }
        bodyView.setTextColor(colDim);
        titleView.setVisibility(View.VISIBLE);
        buttonContainer.setVisibility(View.VISIBLE);
        answered = false;
        buildButtons();
        selectedIndex = 0;
        updateSelection();
        Haptics.play(this, kind);
        if (!kind.equals(Haptics.DOUBTFUL) && !kind.equals(Haptics.REMINDER)) {
            goHomeLater(HOME_DELAY_MS);
        }
    }

    private void buildButtons() {
        buttonContainer.removeAllViews();
        buttons.clear();
        if (kind.equals(Haptics.DOUBTFUL)) {
            addButton(str(R.string.answer_yes), "yes", colLime, colOnLime);
            addButton(str(R.string.answer_no), "no", colTrack, colText);
        } else if (kind.equals(Haptics.REMINDER)) {
            addButton(str(R.string.answer_already), "yes", colLime, colOnLime);
        }
    }

    private void addButton(String label, String tag, int fill, int textColor) {
        Button btn = Ui.pill(this, label, fill, textColor, Ui.ROW_DP);
        btn.setTag(tag);
        /* One selection system only: the lime-pill outline driven by the crown
           and arrow keys. Native focus would move a second, invisible cursor,
           so Enter could confirm a button the wearer does not see selected. */
        btn.setFocusable(false);
        btn.setFocusableInTouchMode(false);
        btn.setDefaultFocusHighlightEnabled(false);

        final int idx = buttons.size();
        buttons.add(btn);
        btn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                selectedIndex = idx;
                updateSelection();
                confirm();
            }
        });

        LinearLayout.LayoutParams lp = Ui.rowLp(this);
        lp.topMargin = dp(6);
        buttonContainer.addView(btn, lp);
    }

    private void updateSelection() {
        for (int i = 0; i < buttons.size(); i++) {
            Button button = buttons.get(i);
            GradientDrawable shape = (GradientDrawable) button.getBackground();
            if (i == selectedIndex) {
                shape.setStroke(dp(2), colText);
            } else {
                shape.setStroke(0, colTrack);
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
        Button selected = buttons.get(selectedIndex);
        /* The answer is the button's tag, never its translated label. */
        boolean yes = "yes".equals(selected.getTag());
        android.util.Log.i("HHW", yes ? "answer=yes" : "answer=no");
        Haptics.play(this, Haptics.OK);
        if (yes) addDone();
        String message = yes ? str(R.string.noted) : str(R.string.stays);
        titleView.setVisibility(View.GONE);
        bodyView.setText(message);
        bodyView.setTextColor(colText);
        bodyView.setVisibility(View.VISIBLE);
        buttonContainer.setVisibility(View.GONE);
        goHomeLater(HOME_DELAY_MS);
    }

    private void goHomeLater(long delayMs) {
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                Intent home = new Intent(AlertActivity.this, HomeActivity.class);
                home.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(home);
                finish();
            }
        }, delayMs);
    }

    @Override
    protected void onDestroy() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            /* The crown press (STEM_PRIMARY) is reserved by Wear OS for Home and
               never reaches apps; the second button (STEM_1) does. */
            case KeyEvent.KEYCODE_STEM_PRIMARY:
            case KeyEvent.KEYCODE_STEM_1:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                if (!buttons.isEmpty()) {
                    confirm();
                    return true;
                }
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
        /* A mouse wheel (scrcpy mirror on the PC) stands in for the crown:
           wheel down moves the selection down. */
        if (event.getAction() == MotionEvent.ACTION_SCROLL
                && event.isFromSource(InputDevice.SOURCE_CLASS_POINTER)) {
            float v = event.getAxisValue(MotionEvent.AXIS_VSCROLL);
            if (v != 0f) {
                moveSelection(v < 0 ? 1 : -1);
            }
            return true;
        }
        return super.onGenericMotionEvent(event);
    }
}
