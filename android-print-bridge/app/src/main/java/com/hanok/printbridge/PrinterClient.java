package com.hanok.printbridge;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public final class PrinterClient {
    private PrinterClient(){}
    public static void printTest(String host,int port,String name)throws Exception{
        Socket s=new Socket();
        s.connect(new InetSocketAddress(host,port),4000);
        s.setSoTimeout(5000);
        OutputStream out=s.getOutputStream();
        out.write(new byte[]{0x1b,0x40,0x1b,0x61,0x01,0x1b,0x45,0x01,0x1d,0x21,0x11});
        out.write("HANOK WAGGA\n".getBytes(StandardCharsets.US_ASCII));
        out.write(new byte[]{0x1d,0x21,0x33});
        out.write("T01\n".getBytes(StandardCharsets.US_ASCII));
        out.write(new byte[]{0x1d,0x21,0x11,0x1d,0x42,0x01});
        out.write((" "+name+" \n").getBytes(StandardCharsets.US_ASCII));
        out.write(new byte[]{0x1d,0x42,0x00,0x1d,0x21,0x00,0x1b,0x61,0x00});
        out.write("\nWagyu Scotch Fillet   x 2\nFried Chicken          x 1\n\nBRIDGE TEST OK\n\n\n".getBytes(StandardCharsets.US_ASCII));
        out.write(new byte[]{0x1d,0x56,0x00});
        out.flush();
        s.close();
    }
}
