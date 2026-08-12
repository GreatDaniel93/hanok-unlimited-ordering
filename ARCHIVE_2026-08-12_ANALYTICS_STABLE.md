# Hanok Wagga — Analytics Stable Checkpoint

Archived: 2026-08-12
Owner status: TESTED / CONFIRMED WORKING

## Stable Manager structure
Main system home is simplified to Staff / Kitchen / Manager. Manager functions are consolidated under `/manager`.

Manager areas:
- Menu & Starter
- Table Management
- Analytics & Reports
- Table QR Codes
- Access & PIN Settings

## Analytics & Reports
Route: `/manager/analytics`

Manager can run historical operational reports using a selected date range, including quick Last 7 Days and Last 30 Days presets.

Current KPIs / analysis include:
- Guests
- Table Sessions
- Orders
- Total Meat Serves
- Starter Meat Serves
- Customer Reorder Meat Serves
- Hot Food Serves
- Avg Orders / Table
- Avg Guests / Table
- Avg Dining Minutes
- No Pork Sessions
- Product Performance
- Table Performance
- Estimated meat kilograms based on current 100g-per-serve model
- CSV product export

## Important report semantics
- Selected `To` date is inclusive. Example: 05/08/2026–12/08/2026 includes all of 12 August.
- Starter consumption is included in total meat consumption.
- Starter meat and customer reorder meat are also separated so the operator can distinguish automatic initial allocation from subsequent guest demand.
- Revenue / sales are intentionally excluded because payment remains in the existing POS.

## Fixes validated during rollout
1. Analytics authentication corrected to use the existing `access_role()` / `staff_access_sessions` access model rather than a nonexistent `access_sessions` relation.
2. Daily/table aggregation SQL corrected to avoid PostgreSQL ungrouped-column errors.
3. Date-range end-date semantics corrected so current-day sessions are not omitted.
4. Starter items added to consumption analysis so a session that only generated a Starter still appears meaningfully in product/meat reporting.
5. Last 7 / Last 30 day presets now trigger the appropriate report behavior.

## Production data validation
Production database was checked during debugging and contained multiple closed test sessions with orders, confirming that table/session/order persistence was functioning. Owner subsequently tested the Analytics UI and confirmed it is working correctly.

## Deployment
The Analytics UI/date-range fix commit passed Vercel deployment status successfully before this archive was created.

This file is a stable checkpoint. Preserve it when making future Analytics or Manager UI changes.
