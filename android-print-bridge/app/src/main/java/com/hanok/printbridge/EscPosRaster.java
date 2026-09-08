package com.hanok.printbridge;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;

import java.io.ByteArrayOutputStream;

/**
 * Renders Unicode text (including Chinese) to an ESC/POS raster bitmap.
 * This avoids relying on the printer's code page / Chinese font ROM.
 */
public final class EscPosRaster {
    private static final int PRINTER_WIDTH_PX = 560;
    private static final float TEXT_SIZE_PX = 32f;
    private static final int LEFT_PAD = 4;
    private static final int TOP_PAD = 6;
    private static final int BOTTOM_PAD = 8;

    private EscPosRaster() {}

    public static boolean needsRaster(String text) {
        if (text == null) return false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c > 0x7f) return true;
        }
        return false;
    }

    public static byte[] render(String text) throws Exception {
        if (text == null) text = "";
        String normalised = text.replace("\r\n", "\n").replace('\r', '\n');
        String[] rawLines = normalised.split("\n", -1);
        int effectiveLines = rawLines.length;
        while (effectiveLines > 1 && rawLines[effectiveLines - 1].isEmpty()) effectiveLines--;
        if (effectiveLines <= 0) effectiveLines = 1;

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTextSize(TEXT_SIZE_PX);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        paint.setSubpixelText(true);

        Paint.FontMetrics fm = paint.getFontMetrics();
        int lineHeight = Math.max(38, (int)Math.ceil(fm.descent - fm.ascent) + 4);
        int height = TOP_PAD + effectiveLines * lineHeight + BOTTOM_PAD;
        Bitmap bitmap = Bitmap.createBitmap(PRINTER_WIDTH_PX, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);

        float y = TOP_PAD - fm.ascent;
        for (int i = 0; i < effectiveLines; i++) {
            String line = rawLines[i];
            canvas.drawText(line, LEFT_PAD, y, paint);
            y += lineHeight;
        }

        byte[] raster = bitmapToEscPos(bitmap);
        bitmap.recycle();
        return raster;
    }

    private static byte[] bitmapToEscPos(Bitmap bitmap) throws Exception {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int widthBytes = (width + 7) / 8;
        ByteArrayOutputStream out = new ByteArrayOutputStream(8 + widthBytes * height);
        out.write(0x1d);
        out.write(0x76);
        out.write(0x30);
        out.write(0x00);
        out.write(widthBytes & 0xff);
        out.write((widthBytes >> 8) & 0xff);
        out.write(height & 0xff);
        out.write((height >> 8) & 0xff);

        for (int y = 0; y < height; y++) {
            for (int xb = 0; xb < widthBytes; xb++) {
                int value = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = xb * 8 + bit;
                    if (x >= width) continue;
                    int pixel = bitmap.getPixel(x, y);
                    int r = Color.red(pixel);
                    int g = Color.green(pixel);
                    int b = Color.blue(pixel);
                    int luminance = (r * 299 + g * 587 + b * 114) / 1000;
                    if (luminance < 180) value |= (0x80 >> bit);
                }
                out.write(value);
            }
        }
        return out.toByteArray();
    }
}
