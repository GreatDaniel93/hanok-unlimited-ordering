# Project Update — No Pork Starter + Manager Cooldown

Date: 2026-08-12
Implementation status: LIVE CODE + PRODUCTION DATABASE UPDATED

## Implemented

### Starter preference at table opening
Staff Dashboard now supports:
- Standard Starter (default)
- No Pork Starter

The selected preference is persisted on `table_sessions.starter_preference` and appears in the active-table Staff view.

Session start uses the selected recipe family when automatically creating the Meat KDS Starter order. 7+ guest table splitting preserves the selected recipe family.

### Starter recipe families
`starter_recipe_items` now includes `recipe_type`:
- standard
- no_pork

Manager Starter management supports both families independently for 2P–6P.

Current No Pork recipe totals match Standard totals:
- 2P = 4 portions
- 3P = 6 portions
- 4P = 8 portions
- 5P = 10 portions
- 6P = 12 portions

Database validation confirmed No Pork 2P–6P contain zero products marked `contains_pork=true`.

### Pork product flag
`menu_items` now contains `contains_pork boolean`.

Current products marked pork:
- Pork Belly
- Sausage

Manager Product editor now exposes `Contains Pork`. No Pork Starter recipes reject products with that flag.

A product already used in a No Pork Starter cannot subsequently be marked as pork until removed from that recipe.

### Manager Order Settings
Manager navigation now includes:
- PRODUCTS
- STARTER PLATTERS
- ORDER SETTINGS

Order Settings exposes store-wide `Meat Reorder Cooldown`:
- default/current production value = 5 minutes
- manager editable range = 0–15 minutes
- saved directly to Supabase
- audit logged
- no redeployment required for future setting changes

The existing customer order RPC reads the store cooldown at each successful order and writes an absolute `meat_order_available_at` timestamp. Therefore changing the store setting does not recalculate an already-active cooldown; the new value is applied on the next successful meat order.

Existing per-table Manager `Open Ordering Now` remains a separate override.

## Database changes

Added:
- `menu_items.contains_pork`
- `table_sessions.starter_preference`
- `starter_recipe_items.recipe_type`

New RPCs:
- `add_starter_order_v2`
- `staff_start_session_v2`
- `manager_get_starters_v2`
- `manager_starter_action_v2`
- `manager_get_order_settings`
- `manager_update_order_settings`

The application APIs were moved to the v2 Starter/session RPCs.

## UI changes

Staff `/staff`:
- Starter Preference selector before opening a session
- Standard / No Pork indicator on active tables and selected table

Manager `/manager/menu`:
- Products: Contains Pork field/badge
- Starter Platters: Standard / No Pork family selector + 2P–6P selector
- Order Settings: Meat cooldown editor

## Verification

Confirmed directly in production Supabase:
- Current store cooldown = 5 minutes
- Standard and No Pork recipe families exist for every size 2P–6P
- No Pork totals are 4 / 6 / 8 / 10 / 12 portions
- No Pork pork-item count = 0 for every size

Latest GitHub/Vercel build for the Manager UI change returned success.
