package com.dawaay.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

/** بيشغّل صوت المنبه (على قناة المنبه) والاهتزاز، وبيعرض إشعار بشاشة كاملة وأزرار. */
public class AlarmService extends Service {
    static final String ACTION_RING = "com.dawaay.app.RING";
    static final String ACTION_STOP = "com.dawaay.app.STOP";
    static final String ACTION_SNOOZE = "com.dawaay.app.SNOOZE";
    static final String CH = "dose_alarm";
    static final int NID = 4001;

    private MediaPlayer mp;
    private Vibrator vib;
    private PowerManager.WakeLock wl;
    private final Handler h = new Handler(Looper.getMainLooper());
    private String name = "";
    private final Runnable timeout = () -> {
        stopSound();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH); // الإشعار يفضل
        stopSelf();
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_RING : intent.getAction();
        if (ACTION_STOP.equals(action)) { finish(); return START_NOT_STICKY; }
        if (ACTION_SNOOZE.equals(action)) { AlarmStore.snooze(this, name, 10); finish(); return START_NOT_STICKY; }

        name = intent != null && intent.getStringExtra("name") != null ? intent.getStringExtra("name") : "";
        String k = intent != null ? intent.getStringExtra("k") : "";
        Notification n = buildNotification(name, k);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NID, n);
        }
        startSound();
        h.removeCallbacks(timeout);
        h.postDelayed(timeout, 2 * 60 * 1000L); // يرن دقيقتين
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String name, String k) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CH, "تنبيهات الأدوية", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
        Intent ai = new Intent(this, AlarmActivity.class).putExtra("name", name).putExtra("k", k)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int imm = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent full = PendingIntent.getActivity(this, 1, ai, imm);
        PendingIntent stop = PendingIntent.getService(this, 2, new Intent(this, AlarmService.class).setAction(ACTION_STOP), imm);
        PendingIntent snooze = PendingIntent.getService(this, 3, new Intent(this, AlarmService.class).setAction(ACTION_SNOOZE), imm);
        return new NotificationCompat.Builder(this, CH)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("⏰ ميعاد الدواء")
                .setContentText(name)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setFullScreenIntent(full, true)
                .setContentIntent(full)
                .addAction(0, "أخدته ✅", stop)
                .addAction(0, "بعد 10 دقايق", snooze)
                .build();
    }

    private void startSound() {
        stopSound();
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "dawaay:alarm");
            wl.acquire(3 * 60 * 1000L);
        } catch (Exception ignored) { }
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM), want = (int) Math.ceil(max * 0.7);
            if (am.getStreamVolume(AudioManager.STREAM_ALARM) < want) am.setStreamVolume(AudioManager.STREAM_ALARM, want, 0);
            Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            mp.setDataSource(this, u);
            mp.setLooping(true);
            mp.prepare();
            mp.start();
        } catch (Exception e) { mp = null; }
        try {
            vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            long[] p = {0, 800, 500};
            if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createWaveform(p, 0));
            else vib.vibrate(p, 0);
        } catch (Exception ignored) { }
    }

    private void stopSound() {
        try { if (mp != null) { mp.stop(); mp.release(); } } catch (Exception ignored) { }
        mp = null;
        try { if (vib != null) vib.cancel(); } catch (Exception ignored) { }
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
    }

    private void finish() {
        h.removeCallbacks(timeout);
        stopSound();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        NotificationManagerCompat.from(this).cancel(NID);
        stopSelf();
    }

    @Override
    public void onDestroy() { stopSound(); super.onDestroy(); }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
