package com.hanok.printbridge;

import android.Manifest;import android.app.Activity;import android.content.*;import android.content.pm.PackageManager;import android.graphics.Color;import android.os.*;import android.widget.*;import java.io.OutputStream;import java.net.*;import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
 private EditText totalHost,splitHost,port,secret; private TextView status; private SharedPreferences prefs;
 @Override public void onCreate(Bundle b){super.onCreate(b);prefs=getSharedPreferences("bridge",MODE_PRIVATE);if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},100);buildUi();}
 private TextView label(String t){TextView v=new TextView(this);v.setText(t);v.setTextSize(14);v.setTextColor(Color.DKGRAY);v.setPadding(0,16,0,5);return v;}
 private EditText field(String v){EditText e=new EditText(this);e.setText(v);e.setTextSize(18);e.setSingleLine(true);e.setPadding(16,12,16,12);return e;}
 private Button button(String t){Button b=new Button(this);b.setText(t);b.setTextSize(17);b.setAllCaps(false);b.setPadding(10,14,10,14);return b;}
 private void buildUi(){
  ScrollView scroll=new ScrollView(this);LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(28,28,28,40);root.setBackgroundColor(Color.rgb(248,245,239));
  TextView title=new TextView(this);title.setText("HANOK PRINT BRIDGE");title.setTextSize(28);title.setTextColor(Color.rgb(55,25,20));title.setTypeface(null,1);root.addView(title);
  TextView sub=new TextView(this);sub.setText("Dual Printer Mode");sub.setTextSize(15);sub.setPadding(0,4,0,20);root.addView(sub);
  TextView info=new TextView(this);info.setText("Printer 1 prints ONE combined total order.\nPrinter 2 prints separate BBQ MEAT and HOT KITCHEN tickets.");info.setTextSize(14);info.setTextColor(Color.rgb(80,70,65));info.setPadding(0,0,0,10);root.addView(info);

  root.addView(label("Printer 1 · TOTAL ORDER IP"));totalHost=field(prefs.getString("total_host",""));totalHost.setHint("e.g. 192.168.0.191");root.addView(totalHost);
  root.addView(label("Printer 2 · SPLIT ORDER IP"));splitHost=field(prefs.getString("split_host",""));splitHost.setHint("e.g. 192.168.0.192");root.addView(splitHost);
  root.addView(label("Printer Port"));port=field(prefs.getString("port","9100"));port.setInputType(2);root.addView(port);

  root.addView(label("Bridge Secret · normally enter once"));secret=field(prefs.getString("secret",""));secret.setInputType(0x81);root.addView(secret);

  status=new TextView(this);status.setText("● Bridge stopped");status.setTextSize(17);status.setTypeface(null,1);status.setTextColor(Color.rgb(150,45,35));status.setPadding(0,26,0,12);root.addView(status);

  Button testTotal=button("TEST PRINTER 1 · TOTAL");root.addView(testTotal);testTotal.setOnClickListener(v->testPrint(true));
  Button testSplit=button("TEST PRINTER 2 · SPLIT");root.addView(testSplit);testSplit.setOnClickListener(v->testPrint(false));
  Button start=button("START BRIDGE");root.addView(start);start.setOnClickListener(v->startBridge());
  Button stop=button("STOP BRIDGE");root.addView(stop);stop.setOnClickListener(v->{stopService(new Intent(this,BridgeService.class));status.setText("● Bridge stopped");status.setTextColor(Color.rgb(150,45,35));});

  TextView note=new TextView(this);note.setText("Tomorrow setup: connect this phone to restaurant Wi-Fi, enter the two printer IP addresses, run both Test Printer buttons, then press START BRIDGE. Keep the phone plugged into power.");note.setTextSize(13);note.setPadding(0,22,0,0);root.addView(note);
  scroll.addView(root);setContentView(scroll);
 }
 private void save(){prefs.edit().putString("total_host",totalHost.getText().toString().trim()).putString("split_host",splitHost.getText().toString().trim()).putString("port",port.getText().toString().trim()).putString("secret",secret.getText().toString().trim()).putString("url","https://orderhanokbbqwagga.com").apply();}
 private boolean validate(){save();if(totalHost.getText().toString().trim().isEmpty()||splitHost.getText().toString().trim().isEmpty()){Toast.makeText(this,"Enter both printer IP addresses",Toast.LENGTH_LONG).show();return false;}if(secret.getText().toString().trim().isEmpty()){Toast.makeText(this,"Enter Bridge Secret",Toast.LENGTH_LONG).show();return false;}return true;}
 private void startBridge(){if(!validate())return;Intent i=new Intent(this,BridgeService.class);if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i);status.setText("● Bridge running");status.setTextColor(Color.rgb(30,120,70));Toast.makeText(this,"Bridge started",Toast.LENGTH_SHORT).show();}
 private void testPrint(boolean total){save();String host=total?prefs.getString("total_host",""):prefs.getString("split_host","");if(host.isEmpty()){Toast.makeText(this,"Enter printer IP first",Toast.LENGTH_LONG).show();return;}status.setText("● Testing "+(total?"Printer 1":"Printer 2")+"…");status.setTextColor(Color.rgb(160,100,15));new Thread(()->{try{int p=Integer.parseInt(prefs.getString("port","9100"));Socket s=new Socket();s.connect(new InetSocketAddress(host,p),4000);OutputStream out=s.getOutputStream();out.write(new byte[]{0x1b,0x40,0x1b,0x61,0x01,0x1b,0x45,0x01,0x1d,0x21,0x11});out.write("HANOK WAGGA\n".getBytes(StandardCharsets.US_ASCII));out.write(new byte[]{0x1d,0x21,0x33});out.write("T01\n".getBytes(StandardCharsets.US_ASCII));out.write(new byte[]{0x1d,0x21,0x11,0x1d,0x42,0x01});out.write((total?" TOTAL ORDER \n":" SPLIT ORDER \n").getBytes(StandardCharsets.US_ASCII));out.write(new byte[]{0x1d,0x42,0x00,0x1d,0x21,0x00,0x1b,0x61,0x00});if(total){out.write("\nBBQ MEAT\nWagyu Scotch Fillet   x 2\nPork Belly             x 1\n\nHOT KITCHEN\nFried Chicken          x 1\nTteokbokki             x 1\n".getBytes(StandardCharsets.US_ASCII));}else{out.write("\nBBQ MEAT TEST\nWagyu Scotch Fillet   x 2\nPork Belly             x 1\n\n--- NEXT TICKET WILL BE HOT ---\n".getBytes(StandardCharsets.US_ASCII));}out.write("\nANDROID BRIDGE TEST\n\n\n".getBytes(StandardCharsets.US_ASCII));out.write(new byte[]{0x1d,0x56,0x00});out.flush();s.close();runOnUiThread(()->{status.setText("● "+(total?"Printer 1":"Printer 2")+" connected · test printed");status.setTextColor(Color.rgb(30,120,70));});}catch(Exception e){runOnUiThread(()->{status.setText("● Test failed: "+e.getMessage());status.setTextColor(Color.rgb(150,45,35));});}}).start();}
}
