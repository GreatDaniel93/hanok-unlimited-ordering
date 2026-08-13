# Hanok Unlimited Ordering

Existing ordering system plus test Android Print Bridge.

## Android Print Bridge test app
Source: `android-print-bridge/`

The test APK lets a restaurant Android phone act as a local print bridge between the Hanok cloud ordering API and an ESC/POS thermal printer over TCP 9100.

Test flow:
1. Install the debug APK.
2. Connect the phone to the same restaurant LAN/Wi-Fi as the printer.
3. Enter Cloud URL, Print Agent Secret, Printer IP/Port and Station.
4. Use TEST PRINT to verify direct LAN printing.
5. Use START BRIDGE to start the foreground print service. Only orders created after the service starts are polled.

The bridge uses a foreground service with a persistent notification for reliable restaurant operation and routes new cloud orders to the selected local printer.

The GitHub Actions workflow `.github/workflows/android-print-bridge.yml` builds a debug APK artifact named `hanok-print-bridge-debug-apk` whenever Android bridge files change.
