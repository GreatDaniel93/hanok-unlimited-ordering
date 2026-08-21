package com.hanok.printbridge;

import android.content.*;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    public static final String ACTION_RESTART="com.hanok.printbridge.RESTART";

    @Override public void onReceive(Context context, Intent intent){
        if(intent==null)return;
        String a=intent.getAction();
        boolean valid=Intent.ACTION_BOOT_COMPLETED.equals(a)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)||ACTION_RESTART.equals(a);
        if(!valid)return;
        boolean enabled=context.getSharedPreferences(BridgeConfig.PREFS,Context.MODE_PRIVATE).getBoolean("enabled",false);
        if(!enabled)return;
        Intent s=new Intent(context,BridgeService.class);
        try{
            if(Build.VERSION.SDK_INT>=26)context.startForegroundService(s);
            else context.startService(s);
        }catch(Throwable ignored){}
    }
}
