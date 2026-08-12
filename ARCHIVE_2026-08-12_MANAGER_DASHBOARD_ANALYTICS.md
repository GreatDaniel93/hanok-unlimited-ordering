# Manager Dashboard + Analytics Update
Date: 2026-08-12

## Navigation
Public system home simplified to Staff / Kitchen / Manager. Manager functions consolidated under `/manager`:
- Menu & Starter
- Table Management
- Analytics & Reports
- Table QR Codes
- Access & PIN Settings

## Analytics
Manager-only `/manager/analytics` supports custom date range plus 7/30 day presets and CSV product export.
KPIs: guests, sessions, orders, meat serves, hot serves, avg orders/table, avg guests/table, avg dining minutes, no-pork sessions.
Analysis includes product performance with estimated meat kg (100g per serve assumption) and table performance.
Revenue is intentionally excluded because payment remains in the existing POS.
Database RPC requires an active Manager access session and limits a report range to 366 days.
