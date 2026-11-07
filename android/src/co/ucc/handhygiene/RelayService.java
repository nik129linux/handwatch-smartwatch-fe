package co.ucc.handhygiene;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import android.view.KeyEvent;

/**
 * The way back from the wrist. The cheap watch cannot answer a notification,
 * but its music screen sends play/pause and next to the phone. This service
 * holds a media session so those buttons land here, and logs the answer under
 * the tag "HHW" for the desktop app to read over adb:
 *   play/pause -> "answer=yes"   next/previous -> "answer=no"
 */
public class RelayService extends Service {

    private static final String TAG = "HHW";
    private static final String CHANNEL_ID = "relay";
    private static final int ONGOING_ID = 1;

    private MediaSession session;
    private AudioTrack silence;

    @Override
    public void onCreate() {
        super.onCreate();
        startInForeground();
        startSession();
        startSilence();
        Log.i(TAG, "relay=ready");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (session != null) session.setActive(true);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (session != null) session.release();
        if (silence != null) {
            try { silence.stop(); } catch (IllegalStateException e) { /* not playing */ }
            silence.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Relay", NotificationManager.IMPORTANCE_MIN);
        ch.setSound(null, null);
        ch.enableVibration(false);
        nm.createNotificationChannel(ch);
        Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_hand)
                .setContentTitle("Hand Hygiene relay")
                .setContentText("Watch music buttons answer: play = yes, next = no")
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(ONGOING_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(ONGOING_ID, n);
        }
    }

    private void startSession() {
        session = new MediaSession(this, "HandHygiene");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public boolean onMediaButtonEvent(Intent intent) {
                KeyEvent ev = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (ev == null || ev.getAction() != KeyEvent.ACTION_DOWN) return true;
                switch (ev.getKeyCode()) {
                    case KeyEvent.KEYCODE_MEDIA_PLAY:
                    case KeyEvent.KEYCODE_MEDIA_PAUSE:
                    case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                    case KeyEvent.KEYCODE_HEADSETHOOK:
                        answer("yes");
                        break;
                    case KeyEvent.KEYCODE_MEDIA_NEXT:
                    case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                        answer("no");
                        break;
                    default:
                        Log.i(TAG, "key=" + ev.getKeyCode());
                }
                return true;
            }
            /* Some senders call the transport controls instead of keys. */
            @Override public void onPlay() { answer("yes"); }
            @Override public void onPause() { answer("yes"); }
            @Override public void onSkipToNext() { answer("no"); }
            @Override public void onSkipToPrevious() { answer("no"); }
        });
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                        | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT
                        | PlaybackState.ACTION_SKIP_TO_PREVIOUS)
                .setState(PlaybackState.STATE_PLAYING, 0, 1f)
                .build());
        session.setActive(true);
    }

    /* Android hands media keys to the session that is actually playing audio,
       so the relay plays silence. Zeros at the lowest rate: no sound, ever. */
    private void startSilence() {
        int rate = 8000;
        int size = AudioTrack.getMinBufferSize(rate,
                AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        silence = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build())
                .setAudioFormat(new AudioFormat.Builder()
                        .setSampleRate(rate)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build())
                .setBufferSizeInBytes(size * 4)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build();
        byte[] zeros = new byte[size * 4];
        silence.write(zeros, 0, zeros.length);
        silence.setLoopPoints(0, zeros.length / 2, -1);
        silence.play();
    }

    private void answer(String value) {
        Log.i(TAG, "answer=" + value);
    }
}
