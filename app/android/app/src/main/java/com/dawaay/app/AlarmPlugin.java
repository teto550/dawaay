package com.dawaay.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** الجسر بين صفحة البرنامج (JavaScript) والمنبه الحقيقي: Capacitor.Plugins.DawaayAlarm */
@CapacitorPlugin(name = "DawaayAlarm")
public class AlarmPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        Context c = getContext();
        JSArray arr = call.getArray("reminders");
        AlarmStore.cancelAll(c);
        AlarmStore.save(c, arr == null ? "[]" : arr.toString());
        AlarmStore.scheduleAll(c, 0);
        askNotificationPermission();
        JSObject r = new JSObject();
        r.put("count", arr == null ? 0 : arr.length());
        call.resolve(r);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        AlarmStore.cancelAll(getContext());
        call.resolve();
    }

    /** تجربة: بترن حالًا. */
    @PluginMethod
    public void ring(PluginCall call) {
        Context c = getContext();
        askNotificationPermission();
        Intent s = new Intent(c, AlarmService.class).setAction(AlarmService.ACTION_RING)
                .putExtra("name", call.getString("name", "تجربة المنبه")).putExtra("k", "test");
        ContextCompat.startForegroundService(c, s);
        call.resolve();
    }

    private void askNotificationPermission() {
        try {
            if (Build.VERSION.SDK_INT >= 33 && getActivity() != null
                    && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        } catch (Exception ignored) { }
    }
}
