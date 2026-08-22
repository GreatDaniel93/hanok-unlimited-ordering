package com.hanok.printbridge;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public final class BarOrderMonitor {
    private static final AtomicBoolean started=new AtomicBoolean(false);
    private static ScheduledExecutorService exec;
    private BarOrderMonitor(){}

    public static void start(Context context){
        if(!started.compareAndSet(false,true))return;
        Context app=context.getApplicationContext();
        exec=Executors.newSingleThreadScheduledExecutor();
        exec.scheduleWithFixedDelay(()->poll(app),3L,2L,TimeUnit.SECONDS);
    }

    private static void poll(Context context){
        SharedPreferences p=context.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE);
        if(!p.getBoolean("enabled",false)||!p.getBoolean("service_alive",false))return;
        HttpURLConnection c=null;
        try{
            String since=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX",Locale.US).format(new Date(System.currentTimeMillis()-6L*60L*60L*1000L));
            String q="?station=bar&since="+URLEncoder.encode(since,"UTF-8");
            c=(HttpURLConnection)new URL(BridgeConfig.BASE_URL+"/api/print/pending"+q).openConnection();
            c.setConnectTimeout(5000);c.setReadTimeout(7000);c.setUseCaches(false);
            c.setRequestProperty("x-print-secret",BridgeConfig.PRINT_SECRET);c.setRequestProperty("accept","application/json");
            int code=c.getResponseCode();
            String body=read(code>=400?c.getErrorStream():c.getInputStream());
            if(code<200||code>=300)throw new Exception("Bar API "+code);
            JSONArray orders=new JSONObject(body).optJSONArray("orders");
            if(orders==null)return;
            for(int i=0;i<orders.length();i++){
                JSONObject o=orders.getJSONObject(i);String id=o.optString("id","");if(id.isEmpty())continue;
                if(!wasDelivered(p,id)){
                    print(context,o);
                    rememberDelivered(p,id);
                }
                mark(id);
            }
            p.edit().putLong("bar_last_success_at",System.currentTimeMillis()).putString("bar_status","Online").apply();
        }catch(Throwable e){
            p.edit().putString("bar_status","Error: "+shortMsg(e)).apply();
        }finally{if(c!=null)c.disconnect();}
    }

    private static void print(Context context,JSONObject o)throws Exception{
        SharedPreferences p=context.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE);
        String host=p.getString("bar_host",BridgeConfig.DEFAULT_BAR_IP);int port=p.getInt("port",BridgeConfig.DEFAULT_PORT);
        Socket s=new Socket();
        try{
            s.setTcpNoDelay(true);s.connect(new InetSocketAddress(host,port),4000);s.setSoTimeout(4000);
            OutputStream out=s.getOutputStream();out.write(ticket(o));out.write(new byte[]{0x1b,0x64,0x04});out.write(new byte[]{0x1d,0x56,0x00});out.flush();
        }finally{try{s.close();}catch(Throwable ignored){}}
    }

    private static byte[] ticket(JSONObject o)throws Exception{
        ByteArrayOutputStream b=new ByteArrayOutputStream();
        b.write(new byte[]{0x1b,0x40,0x1b,0x61,0x01,0x1b,0x45,0x01});
        txt(b,"HANOK WAGGA\n\n");
        b.write(new byte[]{0x1d,0x21,0x11});txt(b,o.optString("table_name","TABLE")+"\n\n");
        b.write(new byte[]{0x1d,0x21,0x10});txt(b,"BAR · RICE\n\n");
        b.write(new byte[]{0x1d,0x21,0x00,0x1b,0x61,0x00});txt(b,"------------------------------------------\n");
        JSONArray a=o.optJSONArray("order_items");int total=0;
        if(a!=null)for(int i=0;i<a.length();i++){
            JSONObject it=a.getJSONObject(i);int qty=it.optInt("qty",0);total+=qty;
            b.write(new byte[]{0x1b,0x45,0x01,0x1d,0x21,0x01});txt(b,it.optString("item_name","Rice")+"   x"+qty+"\n\n");
        }
        b.write(new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00});txt(b,"------------------------------------------\nTOTAL BOWLS: "+total+"\n==========================================\n");
        return b.toByteArray();
    }

    private static void mark(String id)throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(BridgeConfig.BASE_URL+"/api/print/pending").openConnection();
            c.setConnectTimeout(5000);c.setReadTimeout(7000);c.setRequestMethod("PATCH");c.setDoOutput(true);c.setUseCaches(false);
            c.setRequestProperty("content-type","application/json");c.setRequestProperty("x-print-secret",BridgeConfig.PRINT_SECRET);
            byte[] body=("{\"order_id\":\""+id+"\",\"printed\":true,\"attempts\":1}").getBytes(StandardCharsets.UTF_8);
            try(OutputStream out=c.getOutputStream()){out.write(body);out.flush();}
            int code=c.getResponseCode();if(code<200||code>=300)throw new Exception("Bar mark "+code);
        }finally{if(c!=null)c.disconnect();}
    }

    private static boolean wasDelivered(SharedPreferences p,String id){return p.getLong("bar_delivered2_"+sha256(id),0L)>0L;}
    private static void rememberDelivered(SharedPreferences p,String id){p.edit().putLong("bar_delivered2_"+sha256(id),System.currentTimeMillis()).apply();}
    private static String sha256(String s){try{MessageDigest d=MessageDigest.getInstance("SHA-256");byte[] x=d.digest(s.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte v:x)out.append(String.format(Locale.US,"%02x",v));return out.toString();}catch(Exception e){return Integer.toHexString(s.hashCode());}}
    private static String read(InputStream in)throws Exception{if(in==null)return"";ByteArrayOutputStream b=new ByteArrayOutputStream();byte[]x=new byte[2048];int n;while((n=in.read(x))>0)b.write(x,0,n);return new String(b.toByteArray(),StandardCharsets.UTF_8);}
    private static void txt(ByteArrayOutputStream b,String s)throws Exception{b.write(s.getBytes(StandardCharsets.US_ASCII));}
    private static String shortMsg(Throwable e){String s=e.getMessage();if(s==null||s.isEmpty())s=e.getClass().getSimpleName();return s.length()>120?s.substring(0,120):s;}
}
