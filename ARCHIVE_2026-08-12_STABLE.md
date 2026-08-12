# Hanok Wagga Ordering System — Stable Archive

Archived: 2026-08-12
Status: OWNER CONFIRMED CORE FUNCTIONALITY TEMPORARILY COMPLETE / STABLE BASELINE

This archive is a checkpoint for the Wagga Hanok restart ordering system. It supplements PROJECT_STATE.md and the committed database migrations. Do not store plaintext operational PINs or secrets here.

## Production
- Domain: https://orderhanokbbqwagga.com
- Hosting: Vercel
- Repository: GreatDaniel93/hanok-unlimited-ordering, main
- Database: Supabase project `hanokwagga buffet`
- 16 physical tables: T01–T16 with fixed opaque QR tokens.

## Core customer / service model
- 90-minute table session.
- Last order 15 minutes before end.
- Existing POS remains payment/money system.
- Custom system controls QR unlimited food ordering, Starter, table timer, limits/cooldown, KDS and operational management.
- Side-dish bar remains self-service; ordered meats/hot food are produced to order.

## Starter
- Staff chooses Starter Preference when opening a session:
  - Standard (default)
  - No Pork
- Both recipe families are database-driven and Manager-editable for 2P/3P/4P/5P/6P.
- 7+ guest split logic preserves the selected recipe family.
- Menu products have `contains_pork`; No Pork recipes reject pork-marked products at both UI and database levels.
- Starter preference is persisted on the table session.

## Cooldown
- Meat reorder cooldown is database-configurable by Manager.
- Default: 5 minutes.
- Allowed range: 0–15 minutes.
- Manager changes are prospective: an already-issued cooldown timestamp is not recalculated; the next successful order uses the current setting.
- Staff Dashboard `Open Ordering Now` remains a per-table override and does not change the store-wide setting.

## Manager controls
Manager currently has:
- Product add/edit/hide/restore.
- Contains Pork product flag.
- Standard and No Pork Starter management.
- Order Settings / meat cooldown management.
- Table QR management.
- Manager-only Staff Dashboard overrides.
- Access & PIN Settings at `/manager/security`.

## Staff / Kitchen PIN management
Manager can change:
- Staff PIN
- Kitchen PIN

Security behavior:
- 4–8 numeric digits.
- New Staff/Kitchen PIN cannot equal Manager PIN or the other operational role PIN.
- PINs are stored as SHA-256 hashes, not plaintext.
- Existing access sessions for the changed role are immediately revoked, forcing devices to log in with the new PIN.
- PIN-change actions are audit logged.
- Manager PIN is intentionally not changeable from the same UI to reduce accidental management lockout risk.

Routes:
- `/manager/security`
- `/api/manager/security`

Database migration committed:
- `supabase/migrations/202608120003_manager_role_pin_change.sql`

## Main operational routes
- `/staff`
- `/manager/menu`
- `/manager/qr`
- `/manager/security`
- `/kitchen/meat`
- `/kitchen/hot`
- `/t/[token]`

## Deployment checkpoint
The latest production changes covering Access & PIN Settings passed the Vercel deployment/status check successfully before this archive was created.

## Intentionally deferred
- QR table-sign visual design / physical printing.
- Physical printer and local print-agent go-live integration/testing.
- Audit Log / Activity History UI (audit records already exist).
- Remaining menu/marketing/training polish and launch-date decisions.

## Owner decision at checkpoint
Owner confirmed that the functionality is temporarily satisfactory and requested the current state be archived before further refinement.
