package com.hanok.printbridge;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public final class BridgeWatchdog {
    public static final String ACTION_WATCHDOG="com.hanok.printbridge.WATCHDOG";
    private static final long WATCHDOG_DELAY_MS=120000L;
    private static final long REARM_THRESHOLD_MS=60000L;

    private BridgeWatchdog(){}

    public static void arm(Context context){
        Context app=context.getApplicationContext();
        SharedPreferences p=app.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE);
        if(!p.getBoolean("enabled",false))return;
        long now=System.currentTimeMillis();
        long due=p.getLong("watchdog_due_at",0L);
        if(due>now+REARM_THRESHOLD_MS)return;
        schedule(app,now+WATCHDOG_DELAY_MS);
    }

    public static void forceArm(Context context){
        schedule(context.getApplicationContext(),System.currentTimeMillis()+WATCHDOG_DELAY_MS);
    }

    public static void cancel(Context context){
        try{
            AlarmManager am=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
            if(am!=null)am.cancel(pending(context));
        }catch(Throwable ignored){}
        context.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE).edit().putLong("watchdog_due_at",0L).apply();
    }

    public static boolean exactAlarmAllowed(Context context){
        if(Build.VERSION.SDK_INT<31)return true;
        try{
            AlarmManager am=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
            return am!=null&&am.canScheduleExactAlarms();
        }catch(Throwable ignored){return false;}
    }

    private static void schedule(Context context,long when){
        try{
            AlarmManager am=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
            if(am==null)return;
            PendingIntent pi=pending(context);
            if(Build.VERSION.SDK_INT>=31&&am.canScheduleExactAlarms()){
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
            }else if(Build.VERSION.SDK_INT>=23){
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
            }else{
                am.set(AlarmManager.RTC_WAKEUP,when,pi);
            }
            context.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE).edit().putLong("watchdog_due_at",when).apply();
        }catch(Throwable ignored){}
    }

    private static PendingIntent pending(Context context){
        Intent i=new Intent(context,BootReceiver.class).setAction(ACTION_WATCHDOG);
        return PendingIntent.getBroadcast(context,91,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
