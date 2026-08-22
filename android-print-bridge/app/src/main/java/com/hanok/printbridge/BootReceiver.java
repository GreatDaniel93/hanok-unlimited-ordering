package com.hanok.printbridge;

import android.content.*;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    public static final String ACTION_RESTART="com.hanok.printbridge.RESTART";

    @Override public void onReceive(Context context, Intent intent){
        if(intent==null)return;
        String a=intent.getAction();
        boolean watchdog=BridgeWatchdog.ACTION_WATCHDOG.equals(a);
        boolean valid=Intent.ACTION_BOOT_COMPLETED.equals(a)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)||ACTION_RESTART.equals(a)||watchdog;
        if(!valid)return;
        android.content.SharedPreferences p=context.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE);
        boolean enabled=p.getBoolean("enabled",false);
        if(!enabled)return;
        if(watchdog){
            p.edit().putInt("watchdog_fire_count",p.getInt("watchdog_fire_count",0)+1).putLong("last_watchdog_at",System.currentTimeMillis()).putLong("watchdog_due_at",0L).apply();
        }
        Intent s=new Intent(context,BridgeService.class);
        try{
            if(Build.VERSION.SDK_INT>=26)context.startForegroundService(s);
            else context.startService(s);
        }catch(Throwable ignored){}
        BridgeWatchdog.forceArm(context);
    }
}
