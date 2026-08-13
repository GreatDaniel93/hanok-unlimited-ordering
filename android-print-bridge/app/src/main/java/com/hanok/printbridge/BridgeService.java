package com.hanok.printbridge;

import android.app.*;import android.content.*;import android.content.pm.ServiceInfo;import android.os.*;import org.json.*;import java.io.*;import java.net.*;import java.nio.charset.StandardCharsets;import java.text.SimpleDateFormat;import java.util.*;import java.util.concurrent.*;

public class BridgeService extends Service {
 private static final String CHANNEL="hanok_bridge"; private final ScheduledExecutorService exec=Executors.newSingleThreadScheduledExecutor(); private volatile boolean busy=false; private String startedAt; private SharedPreferences prefs; private final Map<String,Long> firstSeen=new HashMap<>(); private final Set<String> totalDone=new HashSet<>(); private final Set<String> splitDone=new HashSet<>();
 @Override public void onCreate(){super.onCreate();prefs=getSharedPreferences("bridge",MODE_PRIVATE);startedAt=isoNow();createChannel();Notification n=notification("Running · dual printer mode");if(Build.VERSION.SDK_INT>=34)startForeground(1001,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(1001,n);}
 @Override public int onStartCommand(Intent i,int f,int id){exec.scheduleWithFixedDelay(()->{if(busy)return;busy=true;try{poll();}catch(Exception e){update("Cloud error · "+shortMsg(e));}finally{busy=false;}},0,2,TimeUnit.SECONDS);return START_STICKY;} @Override public void onDestroy(){exec.shutdownNow();super.onDestroy();} @Override public IBinder onBind(Intent i){return null;}

 private void poll() throws Exception{
  String base="https://orderhanokbbqwagga.com";String secret=prefs.getString("secret","");if(secret.isEmpty())throw new Exception("Missing secret");
  String q="?since="+URLEncoder.encode(startedAt,"UTF-8");HttpURLConnection c=(HttpURLConnection)new URL(base+"/api/print/pending"+q).openConnection();c.setConnectTimeout(5000);c.setReadTimeout(8000);c.setRequestProperty("x-print-secret",secret);c.setRequestProperty("accept","application/json");int code=c.getResponseCode();String body=read(code>=400?c.getErrorStream():c.getInputStream());if(code<200||code>=300)throw new Exception("API "+code);JSONArray orders=new JSONObject(body).optJSONArray("orders");if(orders==null||orders.length()==0)return;

  Map<String,List<JSONObject>> groups=new LinkedHashMap<>();
  for(int x=0;x<orders.length();x++){JSONObject o=orders.getJSONObject(x);String key=groupKey(o);groups.computeIfAbsent(key,k->new ArrayList<>()).add(o);firstSeen.putIfAbsent(key,System.currentTimeMillis());}

  for(Map.Entry<String,List<JSONObject>> entry:groups.entrySet()){
   String key=entry.getKey();List<JSONObject> group=entry.getValue();long age=System.currentTimeMillis()-firstSeen.getOrDefault(key,System.currentTimeMillis());if(age<1500)continue;
   String table=group.get(0).optString("table_name","TABLE");update("Printing "+table);
   try{
    if(!totalDone.contains(key)){printTotal(group);totalDone.add(key);}
    if(!splitDone.contains(key)){printSplit(group);splitDone.add(key);}
    for(JSONObject o:group)mark(base,secret,o.optString("id"),true);
    firstSeen.remove(key);totalDone.remove(key);splitDone.remove(key);update("Printed "+table+" · total + split");
   }catch(Exception e){update("Print failed · "+shortMsg(e));}
  }
 }

 private String groupKey(JSONObject o){String source=o.optString("source","");String table=o.optString("table_name","");int round=o.optInt("round_no",0);String label=o.optString("label","");return table+"|"+source+"|"+round+"|"+label;}

 private void printTotal(List<JSONObject> group)throws Exception{String host=prefs.getString("total_host","");int port=Integer.parseInt(prefs.getString("port","9100"));send(host,port,totalTicket(group));}
 private void printSplit(List<JSONObject> group)throws Exception{String host=prefs.getString("split_host","");int port=Integer.parseInt(prefs.getString("port","9100"));for(JSONObject o:group){JSONArray items=o.optJSONArray("order_items");if(items!=null&&items.length()>0)send(host,port,stationTicket(o));}}
 private void send(String host,int port,byte[] body)throws Exception{if(host==null||host.isEmpty())throw new Exception("Printer IP missing");Socket s=new Socket();s.connect(new InetSocketAddress(host,port),5000);s.setSoTimeout(5000);OutputStream out=s.getOutputStream();out.write(body);out.write(new byte[]{0x1d,0x56,0x00});out.flush();s.close();}

 private byte[] totalTicket(List<JSONObject> group)throws Exception{
  JSONObject first=group.get(0);String table=first.optString("table_name","TABLE");String source=first.optString("source","");String label=first.optString("label","").toUpperCase(Locale.ROOT);String orderType=source.equals("starter")?(label.contains("NO PORK")?"NO PORK STARTER":"STARTER"):(first.optInt("round_no",0)>0?"ROUND "+first.optInt("round_no"):"NEW ORDER");
  List<JSONObject> meat=new ArrayList<>(),hot=new ArrayList<>();int count=0;String created=first.optString("created_at","");for(JSONObject o:group){JSONArray items=o.optJSONArray("order_items");if(items==null)continue;for(int i=0;i<items.length();i++){JSONObject it=items.getJSONObject(i);count+=it.optInt("qty",0);if(o.optString("station","").equals("hot"))hot.add(it);else meat.add(it);}}
  ByteArrayOutputStream b=new ByteArrayOutputStream();header(b,table,"TOTAL ORDER",orderType);if(!meat.isEmpty()){section(b,"BBQ MEAT");items(b,meat);}if(!hot.isEmpty()){section(b,"HOT KITCHEN");items(b,hot);}footer(b,count,created,"TOTAL");return b.toByteArray();
 }

 private byte[] stationTicket(JSONObject o)throws Exception{
  JSONArray arr=o.optJSONArray("order_items");if(arr==null)arr=new JSONArray();List<JSONObject> its=new ArrayList<>();int count=0;for(int i=0;i<arr.length();i++){JSONObject it=arr.getJSONObject(i);its.add(it);count+=it.optInt("qty",0);}String source=o.optString("source","");String label=o.optString("label","").toUpperCase(Locale.ROOT);String station=o.optString("station","");String section=source.equals("starter")?(label.contains("NO PORK")?"NO PORK STARTER":"STARTER PLATTER"):(station.equals("hot")?"HOT KITCHEN":"BBQ MEAT");String orderType=source.equals("starter")?"STARTER":(o.optInt("round_no",0)>0?"ROUND "+o.optInt("round_no"):"NEW ORDER");ByteArrayOutputStream b=new ByteArrayOutputStream();header(b,o.optString("table_name","TABLE"),section,orderType);items(b,its);footer(b,count,o.optString("created_at",""),station.toUpperCase(Locale.ROOT));return b.toByteArray();
 }

 private void header(ByteArrayOutputStream b,String table,String section,String orderType)throws Exception{write(b,new byte[]{0x1b,0x40,0x1b,0x61,0x01,0x1b,0x45,0x01,0x1d,0x21,0x11});txt(b,"HANOK WAGGA\n");write(b,new byte[]{0x1d,0x21,0x33});txt(b,table+"\n");write(b,new byte[]{0x1d,0x21,0x11,0x1d,0x42,0x01});txt(b," "+section+" \n");write(b,new byte[]{0x1d,0x42,0x00,0x1d,0x21,0x10});txt(b,"\n"+orderType+"\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x61,0x00});txt(b,"------------------------------------------\n");}
 private void section(ByteArrayOutputStream b,String name)throws Exception{write(b,new byte[]{0x1b,0x61,0x00,0x1b,0x45,0x01,0x1d,0x21,0x11});txt(b,"\n"+name+"\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00});txt(b,"------------------------------------------\n");}
 private void items(ByteArrayOutputStream b,List<JSONObject> items)throws Exception{for(JSONObject it:items){write(b,new byte[]{0x1b,0x45,0x01,0x1d,0x21,0x10});txt(b,it.optString("item_name","Item")+"\n");write(b,new byte[]{0x1d,0x21,0x11});txt(b,"  x "+it.optInt("qty",0)+"\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00});txt(b,"..........................................\n");}}
 private void footer(ByteArrayOutputStream b,int count,String created,String tag)throws Exception{String time=created.length()>15?created.substring(11,16):"";write(b,new byte[]{0x1b,0x61,0x01,0x1b,0x45,0x01,0x1d,0x21,0x11});txt(b,"ITEMS: "+count+"\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x61,0x00});txt(b,"TIME:  "+time+"\n"+tag+"\n\n\n");}

 private void mark(String base,String secret,String id,boolean printed)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(base+"/api/print/pending").openConnection();c.setConnectTimeout(5000);c.setReadTimeout(8000);c.setRequestMethod("PATCH");c.setDoOutput(true);c.setRequestProperty("content-type","application/json");c.setRequestProperty("x-print-secret",secret);byte[] body=("{\"order_id\":\""+id+"\",\"printed\":"+printed+",\"attempts\":1}").getBytes(StandardCharsets.UTF_8);c.getOutputStream().write(body);if(c.getResponseCode()<200||c.getResponseCode()>=300)throw new Exception("Mark failed");c.disconnect();}
 private void createChannel(){if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(CHANNEL,"Hanok Print Bridge",NotificationManager.IMPORTANCE_LOW);c.setDescription("Keeps the restaurant print bridge active");getSystemService(NotificationManager.class).createNotificationChannel(c);}}
 private Notification notification(String msg){Intent i=new Intent(this,MainActivity.class);PendingIntent p=PendingIntent.getActivity(this,0,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);return new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.stat_sys_upload_done).setContentTitle("Hanok Print Bridge").setContentText(msg).setContentIntent(p).setOngoing(true).build();}
 private void update(String msg){((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(1001,notification(msg));}
 private static String read(InputStream in)throws Exception{if(in==null)return"";ByteArrayOutputStream b=new ByteArrayOutputStream();byte[]x=new byte[4096];int n;while((n=in.read(x))>0)b.write(x,0,n);return b.toString("UTF-8");} private static void write(ByteArrayOutputStream b,byte[]x)throws Exception{b.write(x);} private static void txt(ByteArrayOutputStream b,String s)throws Exception{b.write(s.getBytes(StandardCharsets.US_ASCII));} private static String isoNow(){return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX",Locale.US).format(new Date());} private static String shortMsg(Exception e){String s=e.getMessage();return s==null?e.getClass().getSimpleName():(s.length()>45?s.substring(0,45):s);}
}
