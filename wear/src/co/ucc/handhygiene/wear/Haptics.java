package co.ucc.handhygiene.wear;

import android.content.Context;
import android.os.VibrationEffect;
import android.os.Vibrator;

/* The four patterns of the desktop vocabulary (js/haptics.js). Ayuda and the
   alert screen play the very same VibrationEffect waveform. No sound, ever. */
final class Haptics {
    static final String REMINDER = "reminder";
    static final String OK = "ok";
    static final String DOUBTFUL = "doubtful";
    static final String END = "end";

    private Haptics() { }

    static long[] pattern(String kind) {
        switch (kind) {
            case REMINDER: return new long[]{60, 120, 60};
            case OK: return new long[]{35};
            case DOUBTFUL: return new long[]{30, 70, 45, 70, 65};
            case END: return new long[]{400};
            default: return null;
        }
    }

    static void play(Context context, String kind) {
        long[] base = pattern(kind);
        if (base == null) return;
        Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] timings = new long[base.length + 1];
        timings[0] = 0;
        System.arraycopy(base, 0, timings, 1, base.length);
        try {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
        } catch (Exception ignored) {
            /* a watch without a vibrator still shows the screen */
        }
    }
}
