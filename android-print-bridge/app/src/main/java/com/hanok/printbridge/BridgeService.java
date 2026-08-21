package com.hanok.printbridge;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.wifi.WifiManager;
import android.os.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;

public class BridgeService extends Service {
    public static final String ACTION_STOP="com.hanok.printbridge.STOP";
    private static final String CHANNEL="hanok_bridge";
    private static final int NOTIFICATION_ID=1001;
    private static final long ACTIVE_POLL_MS=1000L;
    private static final long IDLE_POLL_MS=5000L;
    private static final long ERROR_MIN_MS=2000L;
    private static final long ERROR_MAX_MS=30000L;
    private static final long HEARTBEAT_WRITE_MS=10000L;
    private static final long DELIVERED_RETENTION_MS=7L*24L*60L*60L*1000L;

    private final ScheduledExecutorService exec=Executors.newSingleThreadScheduledExecutor();
    private final Object scheduleLock=new Object();
    private final Map<String,Long> firstSeen=new HashMap<>();
    private volatile boolean busy=false;
    private volatile boolean stopping=false;
    private volatile boolean pollAgainSoon=false;
    private ScheduledFuture<?> scheduledFuture;
    private SharedPreferences prefs;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean networkCallbackRegistered=false;
    private int consecutiveErrors=0;
    private long lastHeartbeatWrite=0L;
    private String lastStatus="";

    @Override public void onCreate(){
        super.onCreate();
        prefs=getSharedPreferences(BridgeConfig.PREFS,MODE_PRIVATE);
        createChannel();
        Notification n=notification("Bridge starting...");
        if(Build.VERSION.SDK_INT>=34) startForeground(NOTIFICATION_ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTIFICATION_ID,n);
        prefs.edit().putBoolean("enabled",true).putBoolean("service_alive",true).putLong("service_started_at",System.currentTimeMillis()).putString("status","Bridge starting...").apply();
        acquireLocks();
        pruneDeliveredLedger();
        registerNetworkCallback();
        setStatus("Bridge running · connecting to server...");
    }

    @Override public int onStartCommand(Intent i,int flags,int startId){
        if(i!=null&&ACTION_STOP.equals(i.getAction())){
            stopBridge();
            return START_NOT_STICKY;
        }
        stopping=false;
        prefs.edit().putBoolean("enabled",true).putBoolean("service_alive",true).apply();
        ensureLocks();
        triggerSoon();
        return START_STICKY;
    }

    @Override public void onTaskRemoved(Intent rootIntent){
        if(prefs!=null&&prefs.getBoolean("enabled",false)){
            prefs.edit().putString("status","Bridge recovering after task removal...").putBoolean("service_alive",false).apply();
            scheduleSelfRestart(2500L);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override public void onDestroy(){
        unregisterNetworkCallback();
        releaseLocks();
        if(prefs!=null){
            boolean enabled=prefs.getBoolean("enabled",false);
            prefs.edit().putBoolean("service_alive",false).putString("status",enabled?"Service restarting...":"Stopped").apply();
            if(enabled&&!stopping) scheduleSelfRestart(3500L);
        }
        synchronized(scheduleLock){
            if(scheduledFuture!=null) scheduledFuture.cancel(true);
            scheduledFuture=null;
        }
        exec.shutdownNow();
        super.onDestroy();
    }

    @Override public void onLowMemory(){
        ensureLocks();
        super.onLowMemory();
    }

    @Override public IBinder onBind(Intent i){return null;}

    private void stopBridge(){
        stopping=true;
        if(prefs!=null) prefs.edit().putBoolean("enabled",false).putBoolean("service_alive",false).putString("status","Stopped").apply();
        unregisterNetworkCallback();
        releaseLocks();
        synchronized(scheduleLock){
            if(scheduledFuture!=null) scheduledFuture.cancel(true);
            scheduledFuture=null;
        }
        exec.shutdownNow();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void triggerSoon(){
        synchronized(scheduleLock){
            if(stopping||exec.isShutdown()) return;
            if(busy){pollAgainSoon=true;return;}
            if(scheduledFuture!=null&&!scheduledFuture.isDone()) scheduledFuture.cancel(false);
            scheduledFuture=exec.schedule(this::runPollCycle,0L,TimeUnit.MILLISECONDS);
        }
    }

    private void scheduleNext(long delayMs){
        synchronized(scheduleLock){
            if(stopping||exec.isShutdown()) return;
            long d=Math.max(250L,delayMs);
            scheduledFuture=exec.schedule(this::runPollCycle,d,TimeUnit.MILLISECONDS);
        }
    }

    private void runPollCycle(){
        if(stopping) return;
        busy=true;
        long nextDelay=IDLE_POLL_MS;
        try{
            ensureLocks();
            nextDelay=pollOnce();
        }catch(Throwable t){
            consecutiveErrors++;
            recordHeartbeat(false);
            setStatus("Bridge recovering · "+shortMsg(t));
            nextDelay=errorBackoffMs();
        }finally{
            busy=false;
            synchronized(scheduleLock){scheduledFuture=null;}
            if(pollAgainSoon){pollAgainSoon=false;nextDelay=500L;}
            scheduleNext(nextDelay);
        }
    }

    private long pollOnce(){
        String base=BridgeConfig.BASE_URL,secret=BridgeConfig.PRINT_SECRET;
        HttpURLConnection c=null;
        try{
            String q="?since="+URLEncoder.encode(isoHoursAgo(6),"UTF-8");
            c=(HttpURLConnection)new URL(base+"/api/print/pending"+q).openConnection();
            c.setConnectTimeout(7000);
            c.setReadTimeout(10000);
            c.setUseCaches(false);
            c.setRequestProperty("x-print-secret",secret);
            c.setRequestProperty("accept","application/json");
            c.setRequestProperty("connection","keep-alive");
            int code=c.getResponseCode();
            String body=read(code>=400?c.getErrorStream():c.getInputStream());
            if(code<200||code>=300) throw new IOException("API "+code+" "+body);

            consecutiveErrors=0;
            recordHeartbeat(true);
            JSONArray orders=new JSONObject(body).optJSONArray("orders");
            if(orders==null||orders.length()==0){
                setStatus("Online · waiting for orders");
                return IDLE_POLL_MS;
            }

            Map<String,List<JSONObject>> groups=new LinkedHashMap<>();
            for(int x=0;x<orders.length();x++){
                JSONObject o=orders.getJSONObject(x);
                String key=groupKey(o);
                groups.computeIfAbsent(key,k->new ArrayList<>()).add(o);
                firstSeen.putIfAbsent(key,System.currentTimeMillis());
            }

            boolean waitingForGroup=false;
            boolean printedAnything=false;
            for(Map.Entry<String,List<JSONObject>> entry:groups.entrySet()){
                String key=entry.getKey();
                List<JSONObject> group=entry.getValue();
                long age=System.currentTimeMillis()-firstSeen.getOrDefault(key,System.currentTimeMillis());
                if(age<1800L){waitingForGroup=true;continue;}
                String table=group.get(0).optString("table_name","TABLE");
                setStatus("Printing "+table+"...");
                try{
                    if(!wasDelivered("total",key)){
                        printTotal(group);
                        rememberDelivered("total",key);
                    }
                    for(JSONObject o:group){
                        JSONArray items=o.optJSONArray("order_items");
                        if(items==null||items.length()==0) continue;
                        String orderId=o.optString("id","");
                        if(!wasDelivered("split",orderId)){
                            printOneSplit(o);
                            rememberDelivered("split",orderId);
                        }
                    }
                    for(JSONObject o:group) mark(base,secret,o.optString("id"),true);
                    firstSeen.remove(key);
                    printedAnything=true;
                    prefs.edit().putLong("last_print_at",System.currentTimeMillis()).apply();
                    setStatus("Printed "+table+" · total + split");
                }catch(Throwable e){
                    setStatus("Print error · "+shortMsg(e));
                    return 3000L;
                }
            }

            if(waitingForGroup) setStatus("Order received · preparing print...");
            else if(!printedAnything) setStatus("Online · pending order check");
            return ACTIVE_POLL_MS;
        }catch(Throwable e){
            consecutiveErrors++;
            recordHeartbeat(false);
            setStatus("Server reconnecting · "+shortMsg(e));
            return errorBackoffMs();
        }finally{
            if(c!=null)c.disconnect();
        }
    }

    private long errorBackoffMs(){
        int shift=Math.min(4,Math.max(0,consecutiveErrors-1));
        return Math.min(ERROR_MAX_MS,ERROR_MIN_MS*(1L<<shift));
    }

    private void recordHeartbeat(boolean success){
        long now=System.currentTimeMillis();
        if(success&&now-lastHeartbeatWrite<HEARTBEAT_WRITE_MS) return;
        lastHeartbeatWrite=now;
        SharedPreferences.Editor e=prefs.edit().putBoolean("service_alive",true).putLong("last_poll_at",now).putInt("consecutive_errors",consecutiveErrors);
        if(success) e.putLong("last_success_at",now);
        e.apply();
    }

    private String receiptKey(String type,String id){return "delivered2_"+type+"_"+sha256(id);}
    private String oldReceiptKey(String type,String id){return "delivered_"+type+"_"+Integer.toHexString(id.hashCode());}

    private boolean wasDelivered(String type,String id){
        if(id==null||id.isEmpty()) return false;
        long ts=prefs.getLong(receiptKey(type,id),0L);
        if(ts>0L) return true;
        try{return prefs.getBoolean(oldReceiptKey(type,id),false);}catch(ClassCastException ignored){return false;}
    }

    private void rememberDelivered(String type,String id){
        if(id==null||id.isEmpty()) return;
        prefs.edit().putLong(receiptKey(type,id),System.currentTimeMillis()).apply();
    }

    private void pruneDeliveredLedger(){
        try{
            long cutoff=System.currentTimeMillis()-DELIVERED_RETENTION_MS;
            Map<String,?> all=prefs.getAll();
            SharedPreferences.Editor editor=null;
            for(Map.Entry<String,?> e:all.entrySet()){
                if(!e.getKey().startsWith("delivered2_")) continue;
                Object v=e.getValue();
                if(v instanceof Long&&((Long)v)<cutoff){
                    if(editor==null)editor=prefs.edit();
                    editor.remove(e.getKey());
                }
            }
            if(editor!=null)editor.apply();
        }catch(Throwable ignored){}
    }

    private String groupKey(JSONObject o){return o.optString("table_name","")+"|"+o.optString("source","")+"|"+o.optInt("round_no",0)+"|"+o.optString("label","");}
    private void printTotal(List<JSONObject> group)throws Exception{send(prefs.getString("total_host",BridgeConfig.DEFAULT_TOTAL_IP),prefs.getInt("port",BridgeConfig.DEFAULT_PORT),totalTicket(group));}
    private void printOneSplit(JSONObject o)throws Exception{send(prefs.getString("split_host",BridgeConfig.DEFAULT_SPLIT_IP),prefs.getInt("port",BridgeConfig.DEFAULT_PORT),stationTicket(o));}

    private void send(String host,int port,byte[] body)throws Exception{
        if(host==null||host.isEmpty())throw new Exception("Printer IP missing");
        Socket s=new Socket();
        try{
            s.setKeepAlive(true);
            s.setTcpNoDelay(true);
            s.connect(new InetSocketAddress(host,port),5000);
            s.setSoTimeout(5000);
            OutputStream out=s.getOutputStream();
            out.write(body);
            out.write(new byte[]{0x1b,0x64,0x04});
            out.write(new byte[]{0x1d,0x56,0x00});
            out.flush();
        }finally{try{s.close();}catch(Exception ignored){}}
    }

    private byte[] totalTicket(List<JSONObject> group)throws Exception{
        JSONObject first=group.get(0);
        String table=first.optString("table_name","TABLE"),source=first.optString("source",""),label=first.optString("label","").toUpperCase(Locale.ROOT);
        String type=source.equals("starter")?(label.contains("NO PORK")?"NO PORK STARTER":"STARTER"):(first.optInt("round_no",0)>0?"ROUND "+first.optInt("round_no"):"NEW ORDER");
        List<JSONObject> meat=new ArrayList<>(),hot=new ArrayList<>();
        int count=0;String created=first.optString("created_at","");
        for(JSONObject o:group){JSONArray a=o.optJSONArray("order_items");if(a==null)continue;for(int i=0;i<a.length();i++){JSONObject it=a.getJSONObject(i);count+=it.optInt("qty",0);if(o.optString("station","").equals("hot"))hot.add(it);else meat.add(it);}}
        ByteArrayOutputStream b=new ByteArrayOutputStream();
        header(b,table,"TOTAL ORDER",type);
        if(!meat.isEmpty()){section(b,"BBQ MEAT");items(b,meat);}
        if(!hot.isEmpty()){section(b,"HOT KITCHEN");items(b,hot);}
        footer(b,count,created);
        return b.toByteArray();
    }

    private byte[] stationTicket(JSONObject o)throws Exception{
        JSONArray a=o.optJSONArray("order_items");if(a==null)a=new JSONArray();
        List<JSONObject> its=new ArrayList<>();int count=0;
        for(int i=0;i<a.length();i++){JSONObject it=a.getJSONObject(i);its.add(it);count+=it.optInt("qty",0);}
        String source=o.optString("source",""),label=o.optString("label","").toUpperCase(Locale.ROOT),station=o.optString("station","");
        String sec=source.equals("starter")?(label.contains("NO PORK")?"NO PORK STARTER":"STARTER PLATTER"):(station.equals("hot")?"HOT KITCHEN":"BBQ MEAT");
        String type=source.equals("starter")?"STARTER":(o.optInt("round_no",0)>0?"ROUND "+o.optInt("round_no"):"NEW ORDER");
        ByteArrayOutputStream b=new ByteArrayOutputStream();
        header(b,o.optString("table_name","TABLE"),sec,type);items(b,its);footer(b,count,o.optString("created_at",""));return b.toByteArray();
    }

    private void header(ByteArrayOutputStream b,String table,String sec,String type)throws Exception{write(b,new byte[]{0x1b,0x40,0x1b,0x61,0x01,0x1b,0x45,0x01});txt(b,"HANOK WAGGA\n\n");write(b,new byte[]{0x1d,0x21,0x11});txt(b,table+"\n\n");write(b,new byte[]{0x1d,0x21,0x10});txt(b,sec+"\n");write(b,new byte[]{0x1d,0x21,0x00});txt(b,type+"\n");write(b,new byte[]{0x1b,0x61,0x00,0x1b,0x45,0x00});txt(b,"------------------------------------------\n\n");}
    private void section(ByteArrayOutputStream b,String name)throws Exception{write(b,new byte[]{0x1b,0x45,0x01,0x1d,0x21,0x10});txt(b,name+"\n\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00});}
    private void items(ByteArrayOutputStream b,List<JSONObject> list)throws Exception{for(JSONObject it:list){String name=it.optString("item_name","Item");int qty=it.optInt("qty",0);write(b,new byte[]{0x1b,0x45,0x01,0x1d,0x21,0x01});txt(b,itemLine(name,qty));txt(b,"\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00});}}
    private String itemLine(String name,int qty){String q="x"+qty;int width=42;if(name.length()+q.length()+1<=width){StringBuilder s=new StringBuilder(name);while(s.length()<width-q.length())s.append(' ');return s+q+"\n";}return name+"\n"+spaces(Math.max(1,width-q.length()))+q+"\n";}
    private String spaces(int n){StringBuilder s=new StringBuilder();for(int i=0;i<n;i++)s.append(' ');return s.toString();}
    private void footer(ByteArrayOutputStream b,int count,String created)throws Exception{String time=created.length()>15?created.substring(11,16):"";write(b,new byte[]{0x1b,0x45,0x00,0x1d,0x21,0x00});txt(b,"------------------------------------------\n");write(b,new byte[]{0x1b,0x45,0x01});String left="ITEMS: "+count,right=time;StringBuilder row=new StringBuilder(left);while(row.length()<42-right.length())row.append(' ');row.append(right).append('\n');txt(b,row.toString());write(b,new byte[]{0x1b,0x45,0x00});txt(b,"==========================================\n");}

    private void mark(String base,String secret,String id,boolean printed)throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(base+"/api/print/pending").openConnection();
            c.setConnectTimeout(7000);c.setReadTimeout(10000);c.setRequestMethod("PATCH");c.setDoOutput(true);c.setUseCaches(false);
            c.setRequestProperty("content-type","application/json");c.setRequestProperty("x-print-secret",secret);c.setRequestProperty("connection","keep-alive");
            byte[] body=("{\"order_id\":\""+id+"\",\"printed\":"+printed+",\"attempts\":1}").getBytes(StandardCharsets.UTF_8);
            try(OutputStream out=c.getOutputStream()){out.write(body);out.flush();}
            int code=c.getResponseCode();if(code<200||code>=300)throw new IOException("Mark failed HTTP "+code);
        }finally{if(c!=null)c.disconnect();}
    }

    private void createChannel(){
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel c=new NotificationChannel(CHANNEL,"Hanok Wagga Print Bridge",NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Keeps Wagga kitchen printing active while the screen is locked");
            c.setShowBadge(false);
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
    }

    private Notification notification(String msg){
        Intent i=new Intent(this,MainActivity.class);
        PendingIntent p=PendingIntent.getActivity(this,0,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.stat_sys_upload_done).setContentTitle("Hanok Wagga Print Bridge").setContentText(msg).setContentIntent(p).setOnlyAlertOnce(true).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE).build();
    }

    private void setStatus(String msg){
        if(prefs==null||msg==null) return;
        if(msg.equals(lastStatus)) return;
        lastStatus=msg;
        prefs.edit().putBoolean("enabled",true).putBoolean("service_alive",true).putString("status",msg).putLong("statusAt",System.currentTimeMillis()).apply();
        try{((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID,notification(msg));}catch(Throwable ignored){}
    }

    private void acquireLocks(){acquireWakeLock();acquireWifiLock();}
    private void ensureLocks(){
        try{if(wakeLock==null||!wakeLock.isHeld())acquireWakeLock();}catch(Throwable ignored){}
        try{if(wifiLock==null||!wifiLock.isHeld())acquireWifiLock();}catch(Throwable ignored){}
    }

    private void acquireWakeLock(){
        try{
            PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);
            wakeLock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"HanokWagga:PrintBridgeCpu");
            wakeLock.setReferenceCounted(false);wakeLock.acquire();
            prefs.edit().putBoolean("cpu_lock",true).apply();
        }catch(Throwable ignored){if(prefs!=null)prefs.edit().putBoolean("cpu_lock",false).apply();}
    }

    @SuppressWarnings("deprecation")
    private void acquireWifiLock(){
        try{
            WifiManager wm=(WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);
            wifiLock=wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF,"HanokWagga:PrintBridgeWifi");
            wifiLock.setReferenceCounted(false);wifiLock.acquire();
            prefs.edit().putBoolean("wifi_lock",true).apply();
        }catch(Throwable ignored){if(prefs!=null)prefs.edit().putBoolean("wifi_lock",false).apply();}
    }

    private void releaseLocks(){
        try{if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();}catch(Throwable ignored){}
        try{if(wifiLock!=null&&wifiLock.isHeld())wifiLock.release();}catch(Throwable ignored){}
        if(prefs!=null)prefs.edit().putBoolean("cpu_lock",false).putBoolean("wifi_lock",false).apply();
    }

    private void registerNetworkCallback(){
        try{
            connectivityManager=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
            if(connectivityManager==null)return;
            networkCallback=new ConnectivityManager.NetworkCallback(){
                @Override public void onAvailable(Network network){setStatus("Network available · reconnecting...");triggerSoon();}
                @Override public void onLost(Network network){setStatus("Network disconnected · waiting to reconnect...");}
            };
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
            networkCallbackRegistered=true;
        }catch(Throwable ignored){}
    }

    private void unregisterNetworkCallback(){
        try{if(networkCallbackRegistered&&connectivityManager!=null&&networkCallback!=null)connectivityManager.unregisterNetworkCallback(networkCallback);}catch(Throwable ignored){}
        networkCallbackRegistered=false;
    }

    private void scheduleSelfRestart(long delayMs){
        try{
            Intent i=new Intent(this,BootReceiver.class).setAction(BootReceiver.ACTION_RESTART);
            PendingIntent p=PendingIntent.getBroadcast(this,77,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
            AlarmManager am=(AlarmManager)getSystemService(ALARM_SERVICE);
            if(am==null)return;
            long at=SystemClock.elapsedRealtime()+Math.max(1000L,delayMs);
            if(Build.VERSION.SDK_INT>=23)am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP,at,p);
            else am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP,at,p);
        }catch(Throwable ignored){}
    }

    private static String read(InputStream in)throws Exception{if(in==null)return"";ByteArrayOutputStream b=new ByteArrayOutputStream();byte[]x=new byte[4096];int n;while((n=in.read(x))>0)b.write(x,0,n);return new String(b.toByteArray(),StandardCharsets.UTF_8);}
    private static void write(ByteArrayOutputStream b,byte[]x)throws Exception{b.write(x);}
    private static void txt(ByteArrayOutputStream b,String s)throws Exception{b.write(s.getBytes(StandardCharsets.US_ASCII));}
    private static String isoHoursAgo(int hours){return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX",Locale.US).format(new Date(System.currentTimeMillis()-hours*60L*60L*1000L));}
    private static String shortMsg(Throwable e){String s=e.getMessage();if(s==null||s.trim().isEmpty())s=e.getClass().getSimpleName();return s.length()>160?s.substring(0,160):s;}
    private static String sha256(String s){try{MessageDigest d=MessageDigest.getInstance("SHA-256");byte[] b=d.digest(String.valueOf(s).getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte x:b)out.append(String.format(Locale.US,"%02x",x));return out.toString();}catch(Exception e){return Integer.toHexString(String.valueOf(s).hashCode());}}
}
