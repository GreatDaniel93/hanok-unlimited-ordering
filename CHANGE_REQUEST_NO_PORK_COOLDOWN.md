# Change Request — No Pork Starter + Manager Cooldown

Date: 2026-08-12
Status: APPROVED BY OWNER / READY FOR IMPLEMENTATION

## 1. No Pork Starter

### Staff start-session UI
Add a Starter Preference selector before `START 90-MIN SESSION`:
- Standard (default)
- No Pork

Staff must select/confirm the preference when opening the table. The selected preference belongs to that table session.

### Starter recipes
Manager Starter management must support two recipe families:
- Standard
- No Pork

Each family has independently editable recipes for:
- 2P
- 3P
- 4P
- 5P
- 6P

No Pork recipes must not contain Pork Belly or any product marked as pork. The Manager can configure the actual replacement meats without a code deployment.

### 7+ guests
Existing split logic remains, but every component must use the selected recipe family. Example:
- No Pork 7P = No Pork 4P + No Pork 3P
- No Pork 8P = No Pork 4P + No Pork 4P

### Data / audit
Persist the selected starter preference on the table session so staff/kitchen/history can identify which recipe family was used. Manager changes to Starter recipes must continue to be audited.

## 2. Manager-configurable reorder cooldown

### Default
- Default meat reorder cooldown: 5 minutes.

### Manager UI
Add an `ORDER SETTINGS` area to Manager management. Manager can edit the store-wide Meat Reorder Cooldown.

Required behavior:
- integer minutes
- allowed range: 0–15 minutes
- default: 5
- saved to Supabase / database configuration
- takes effect without redeployment
- Manager-only write permission
- changes are audit logged

### Existing sessions / active cooldowns
A setting change is prospective, not retroactive.

Example:
- A table orders while cooldown = 5 min and receives a next-order timestamp of 20:35.
- Manager changes store setting to 3 min at 20:32.
- That table remains locked until 20:35.
- Its next successful order uses the new 3-minute setting.

This avoids changing already-issued cooldown timestamps during service.

### Manager single-table override
Existing `Open Ordering Now` remains unchanged. It is a temporary per-table override and does not change the store-wide cooldown setting.

## 3. Intended Manager navigation

Manager management areas should be presented as:
- PRODUCTS
- STARTER PLATTERS
- ORDER SETTINGS

Starter Platters should contain a recipe-family selector:
- Standard
- No Pork

followed by 2P–6P recipe selection/editing.

## 4. Acceptance criteria

1. Staff can start a session as Standard or No Pork.
2. Standard remains the default.
3. No Pork session automatically generates the correct No Pork Starter in Meat KDS.
4. No Pork Starter contains no pork products.
5. Manager can edit Standard and No Pork recipes independently.
6. 7+ guest splitting preserves the selected recipe family.
7. Manager can change cooldown from 5 min to another value from 0–15.
8. New successful customer orders use the current database cooldown setting.
9. Existing active cooldown timestamps are not recalculated when the setting changes.
10. Open Ordering Now still works as a single-table override.
11. All new Manager configuration writes are audit logged.
