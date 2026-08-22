package com.hanok.printbridge;

import android.app.Application;
import android.content.SharedPreferences;

public class BridgeApp extends Application {
    @Override public void onCreate(){
        super.onCreate();
        SharedPreferences p=getSharedPreferences(BridgeConfig.PREFS,MODE_PRIVATE);
        p.edit().putInt("process_start_count",p.getInt("process_start_count",0)+1).putLong("process_started_at",System.currentTimeMillis()).apply();
        PrinterHealthMonitor.start(this);
        if(p.getBoolean("enabled",false))BridgeWatchdog.forceArm(this);
    }
}
