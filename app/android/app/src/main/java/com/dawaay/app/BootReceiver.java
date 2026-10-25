package com.dawaay.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** بعد إعادة تشغيل الموبايل أو تحديث التطبيق: رجّع المنبهات. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        AlarmStore.scheduleAll(c, 0);
    }
}
