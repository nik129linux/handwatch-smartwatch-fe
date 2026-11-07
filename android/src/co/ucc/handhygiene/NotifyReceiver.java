package co.ucc.handhygiene;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Turns an adb broadcast into a high-priority wrist notification that WearPro
 * mirrors to the paired smartwatch. Each broadcast gets a fresh notification id
 * so the watch buzzes every time.
 */
public class NotifyReceiver extends BroadcastReceiver {

    public static final String ACTION = "co.ucc.handhygiene.NOTIFY";

    private static final String CHANNEL_ID = "wrist";
    private static final int TITLE_MAX = 40;
    private static final int BODY_MAX = 80;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        if (action != null && !ACTION.equals(action)) {
            return;
        }

        String title = intent.getStringExtra("title");
        // A missing title means ignore the broadcast entirely.
        if (title == null) {
            return;
        }
        if (title.length() > TITLE_MAX) {
            title = title.substring(0, TITLE_MAX);
        }

        String body = intent.getStringExtra("body");
        if (body != null && body.length() > BODY_MAX) {
            body = body.substring(0, BODY_MAX);
        }

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // Ensure the channel exists (idempotent).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Wrist", NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            channel.setSound(null, null);
            manager.createNotificationChannel(channel);
        }

        // Time-based id: the receiver's process is killed between broadcasts,
        // so a static counter would restart at 1 and replace the last alert.
        int notificationId = (int) (System.currentTimeMillis() & 0x7fffffff);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
        }

        builder.setSmallIcon(R.drawable.ic_hand)
                .setContentTitle(title)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setVibrate(new long[]{0L, 250L})
                .setSound(null);

        if (body != null) {
            builder.setContentText(body);
        }

        manager.notify(notificationId, builder.build());
    }
}