package com.hanok.printbridge;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public final class PrinterHealthMonitor {
    private static final AtomicBoolean started=new AtomicBoolean(false);
    private static ScheduledExecutorService exec;
    private static final long INTERVAL_SECONDS=30L;
    private static final int PROBE_TIMEOUT_MS=1200;

    private PrinterHealthMonitor(){}

    public static void start(Context context){
        if(!started.compareAndSet(false,true))return;
        Context app=context.getApplicationContext();
        exec=Executors.newSingleThreadScheduledExecutor();
        exec.scheduleWithFixedDelay(()->check(app),4L,INTERVAL_SECONDS,TimeUnit.SECONDS);
    }

    private static void check(Context context){
        SharedPreferences prefs=context.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE);
        if(!prefs.getBoolean("enabled",false))return;

        BridgeWatchdog.arm(context);
        DeviceHealthReporter.report(context);
        if(!prefs.getBoolean("service_alive",false))return;

        String totalHost=prefs.getString("total_host",BridgeConfig.DEFAULT_TOTAL_IP);
        String splitHost=prefs.getString("split_host",BridgeConfig.DEFAULT_SPLIT_IP);
        String barHost=prefs.getString("bar_host",BridgeConfig.DEFAULT_BAR_IP);
        int port=prefs.getInt("port",BridgeConfig.DEFAULT_PORT);

        Probe total=probe(totalHost,port);
        Probe split=probe(splitHost,port);
        Probe bar=probe(barHost,port);
        long now=System.currentTimeMillis();
        prefs.edit()
            .putBoolean("total_printer_online",total.online)
            .putBoolean("split_printer_online",split.online)
            .putBoolean("bar_printer_online",bar.online)
            .putInt("total_printer_latency_ms",total.latencyMs)
            .putInt("split_printer_latency_ms",split.latencyMs)
            .putInt("bar_printer_latency_ms",bar.latencyMs)
            .putLong("printer_health_checked_at",now)
            .apply();

        report(total,split,bar,prefs);
    }

    private static Probe probe(String host,int port){
        long startedAt=System.nanoTime();
        Socket socket=new Socket();
        try{
            if(host==null||host.trim().isEmpty())return new Probe(false,0);
            socket.setTcpNoDelay(true);
            socket.connect(new InetSocketAddress(host.trim(),port),PROBE_TIMEOUT_MS);
            int latency=(int)Math.min(10000L,Math.max(0L,(System.nanoTime()-startedAt)/1_000_000L));
            return new Probe(true,latency);
        }catch(Throwable ignored){
            int latency=(int)Math.min(10000L,Math.max(0L,(System.nanoTime()-startedAt)/1_000_000L));
            return new Probe(false,latency);
        }finally{
            try{socket.close();}catch(Throwable ignored){}
        }
    }

    private static void report(Probe total,Probe split,Probe bar,SharedPreferences prefs){
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(BridgeConfig.BASE_URL+"/api/print/health").openConnection();
            c.setConnectTimeout(5000);
            c.setReadTimeout(5000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setUseCaches(false);
            c.setRequestProperty("content-type","application/json");
            c.setRequestProperty("x-print-secret",BridgeConfig.PRINT_SECRET);
            String json="{\"total_printer_online\":"+total.online+
                    ",\"split_printer_online\":"+split.online+
                    ",\"bar_printer_online\":"+bar.online+
                    ",\"total_printer_latency_ms\":"+total.latencyMs+
                    ",\"split_printer_latency_ms\":"+split.latencyMs+
                    ",\"bar_printer_latency_ms\":"+bar.latencyMs+"}";
            byte[] body=json.getBytes(StandardCharsets.UTF_8);
            try(OutputStream out=c.getOutputStream()){out.write(body);out.flush();}
            int code=c.getResponseCode();
            prefs.edit().putInt("printer_health_http",code).putLong("printer_health_report_at",System.currentTimeMillis()).apply();
        }catch(Throwable ignored){
            prefs.edit().putInt("printer_health_http",0).apply();
        }finally{
            if(c!=null)c.disconnect();
        }
    }

    private static final class Probe {
        final boolean online;
        final int latencyMs;
        Probe(boolean online,int latencyMs){this.online=online;this.latencyMs=latencyMs;}
    }
}
