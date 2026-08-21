package com.hanok.printbridge;

import android.app.Application;

public class BridgeApp extends Application {
    @Override public void onCreate(){
        super.onCreate();
        PrinterHealthMonitor.start(this);
    }
}
