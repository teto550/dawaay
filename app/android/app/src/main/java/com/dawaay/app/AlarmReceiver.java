package com.dawaay.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String id = i.getStringExtra("id"), name = i.getStringExtra("name");
        long t = i.getLongExtra("t", 0);
        if (id == null) return;
        AlarmStore.scheduleAll(c, t); // جدول الجرعة اللي بعدها
        Intent s = new Intent(c, AlarmService.class).setAction(AlarmService.ACTION_RING)
                .putExtra("name", name == null ? "" : name).putExtra("k", id + "|" + t);
        ContextCompat.startForegroundService(c, s);
    }
}
