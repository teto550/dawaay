package com.dawaay.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;

/** بيخزّن تذكيرات الأدوية وبيجدول أقرب جرعة لكل تذكير بمنبه حقيقي (AlarmClock). */
public class AlarmStore {
    static final String PREFS = "dawaay_alarms", KEY = "reminders";
    static final String ACTION_ALARM = "com.dawaay.app.ALARM";

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
    }

    static JSONArray load(Context c) {
        try {
            return new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** أول ميعاد جرعة بعد وقت معين، أو -1 لو المدة خلصت. */
    static long next(JSONObject r, long after) {
        long a = r.optLong("a"), step = r.optLong("step"), ends = r.optLong("ends");
        if (step <= 0) return -1;
        long k = Math.max(0, Math.floorDiv(after - a, step) + 1);
        long t = a + k * step;
        return (ends > 0 && t >= ends) ? -1 : t;
    }

    static PendingIntent alarmPi(Context c, String id, String name, long t) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_ALARM)
                .putExtra("id", id).putExtra("name", name).putExtra("t", t);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent showPi(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void set(Context c, String id, String name, long t) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(t, showPi(c)), alarmPi(c, id, name, t));
    }

    static void cancel(Context c, String id, String name) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(alarmPi(c, id, name, 0));
    }

    /** minAfter: وقت الجرعة اللي لسه رنّت (علشان ما تتجدولش تاني). */
    static void scheduleAll(Context c, long minAfter) {
        long after = Math.max(System.currentTimeMillis(), minAfter);
        JSONArray arr = load(c);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject r = arr.optJSONObject(i);
            if (r == null) continue;
            String id = r.optString("id"), name = r.optString("name");
            long t = next(r, after);
            if (t > 0) set(c, id, name, t); else cancel(c, id, name);
        }
    }

    static void cancelAll(Context c) {
        JSONArray arr = load(c);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject r = arr.optJSONObject(i);
            if (r != null) cancel(c, r.optString("id"), r.optString("name"));
        }
        save(c, "[]");
    }

    static void snooze(Context c, String name, int minutes) {
        set(c, "snooze:" + name, name, System.currentTimeMillis() + minutes * 60000L);
    }
}
