package com.hanok.printbridge;

import android.app.AlarmManager;
import android.content.*;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.*;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class DeviceHealthReporter {
    private DeviceHealthReporter(){}

    public static void report(Context context){
        HttpURLConnection c=null;
        try{
            Context app=context.getApplicationContext();
            SharedPreferences p=app.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE);
            long now=System.currentTimeMillis();
            PowerManager pm=(PowerManager)app.getSystemService(Context.POWER_SERVICE);
            boolean batteryIgnored=Build.VERSION.SDK_INT<23 || (pm!=null&&pm.isIgnoringBatteryOptimizations(app.getPackageName()));
            boolean powerSave=pm!=null&&pm.isPowerSaveMode();
            boolean interactive=pm==null||pm.isInteractive();
            AlarmManager am=(AlarmManager)app.getSystemService(Context.ALARM_SERVICE);
            boolean exactAlarm=Build.VERSION.SDK_INT<31 || (am!=null&&am.canScheduleExactAlarms());
            int battery=-1;boolean charging=false;
            try{
                BatteryManager bm=(BatteryManager)app.getSystemService(Context.BATTERY_SERVICE);
                if(bm!=null)battery=bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                Intent bi=app.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                if(bi!=null){int st=bi.getIntExtra(BatteryManager.EXTRA_STATUS,-1);charging=st==BatteryManager.BATTERY_STATUS_CHARGING||st==BatteryManager.BATTERY_STATUS_FULL;}
            }catch(Throwable ignored){}
            String network="unknown";
            try{
                ConnectivityManager cm=(ConnectivityManager)app.getSystemService(Context.CONNECTIVITY_SERVICE);
                Network n=cm==null?null:cm.getActiveNetwork();
                NetworkCapabilities nc=n==null||cm==null?null:cm.getNetworkCapabilities(n);
                if(nc!=null){if(nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))network="wifi";else if(nc.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))network="ethernet";else if(nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR))network="cellular";else network="other";}
            }catch(Throwable ignored){}

            long started=p.getLong("service_started_at",0L);
            long lastPoll=p.getLong("last_poll_at",0L);
            long lastSuccess=p.getLong("last_success_at",0L);
            JSONObject j=new JSONObject();
            j.put("app_version",BuildConfig.VERSION_NAME);
            j.put("manufacturer",Build.MANUFACTURER);
            j.put("model",Build.MODEL);
            j.put("android_version",Build.VERSION.RELEASE);
            j.put("sdk_int",Build.VERSION.SDK_INT);
            j.put("battery_optimization_ignored",batteryIgnored);
            j.put("exact_alarm_allowed",exactAlarm);
            j.put("power_save_mode",powerSave);
            j.put("screen_on",interactive);
            j.put("battery_percent",battery);
            j.put("charging",charging);
            j.put("network",network);
            j.put("service_alive",p.getBoolean("service_alive",false));
            j.put("cpu_lock",p.getBoolean("cpu_lock",false));
            j.put("wifi_lock",p.getBoolean("wifi_lock",false));
            j.put("service_restart_count",p.getInt("service_restart_count",0));
            j.put("watchdog_fire_count",p.getInt("watchdog_fire_count",0));
            j.put("service_uptime_seconds",started>0?Math.max(0,(now-started)/1000L):0);
            j.put("last_poll_age_seconds",lastPoll>0?Math.max(0,(now-lastPoll)/1000L):-1);
            j.put("last_success_age_seconds",lastSuccess>0?Math.max(0,(now-lastSuccess)/1000L):-1);
            j.put("consecutive_errors",p.getInt("consecutive_errors",0));
            j.put("watchdog_due_at",p.getLong("watchdog_due_at",0L));

            c=(HttpURLConnection)new URL(BridgeConfig.BASE_URL+"/api/print/device-health").openConnection();
            c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestMethod("POST");c.setDoOutput(true);c.setUseCaches(false);
            c.setRequestProperty("content-type","application/json");c.setRequestProperty("x-print-secret",BridgeConfig.PRINT_SECRET);
            byte[] body=j.toString().getBytes(StandardCharsets.UTF_8);
            try(OutputStream out=c.getOutputStream()){out.write(body);out.flush();}
            int code=c.getResponseCode();
            p.edit().putInt("device_health_http",code).putLong("device_health_report_at",now).apply();
        }catch(Throwable ignored){}finally{if(c!=null)c.disconnect();}
    }
}
