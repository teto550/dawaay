package com.dawaay.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** شاشة المنبه الكاملة: بتظهر فوق شاشة القفل. */
public class AlarmActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        String name = getIntent().getStringExtra("name");

        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setGravity(Gravity.CENTER);
        l.setPadding(48, 48, 48, 48);
        l.setBackgroundColor(0xFF0E5F57);
        l.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        l.addView(text("⏰", 72, false));
        l.addView(text("ميعاد الدواء", 26, false));
        l.addView(text(name == null ? "" : name, 30, true));

        Button ok = button("أخدته ✅");
        ok.setOnClickListener(v -> { send(AlarmService.ACTION_STOP); finish(); });
        Button sn = button("بعد 10 دقايق");
        sn.setOnClickListener(v -> { send(AlarmService.ACTION_SNOOZE); finish(); });
        l.addView(ok);
        l.addView(sn);
        setContentView(l);
    }

    private void send(String action) {
        startService(new Intent(this, AlarmService.class).setAction(action));
    }

    private TextView text(String s, int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(Color.WHITE);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, 16, 0, 16);
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        return t;
    }

    private Button button(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextSize(20);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 180);
        p.topMargin = 32;
        b.setLayoutParams(p);
        return b;
    }
}
