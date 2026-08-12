# Hanok Unlimited Ordering

Production MVP for **Hanok Wagga Wagga — Table-Order Unlimited Korean BBQ**.

## What this project does

- Customer QR ordering per table
- 90-minute table sessions
- Staff table dashboard and guest-count control
- Automatic Starter Platter on session start
- Shared table-level ordering rules across multiple customer phones
- Meat and hot-food cooldowns
- Per-item and per-round portion limits enforced in PostgreSQL
- Manager overrides for time, cooldown, guest count and table move
- Separate Meat Station / Hot Kitchen KDS
- Local Print Agent for LAN thermal printers
- Existing POS remains responsible for buffet charges, drinks, GST and payment

## Routes

- `/t/[table-token]` — Customer ordering
- `/staff` — Staff / Manager dashboard
- `/kitchen/meat` — Meat Station KDS
- `/kitchen/hot` — Hot Kitchen KDS

## Setup

1. Create a Supabase project and run `supabase/migrations/001_initial.sql` in SQL Editor.
2. Add Vercel environment variables from `.env.example`.
3. Deploy this GitHub repository to Vercel.
4. Use the Staff Dashboard to copy each permanent table URL and generate its QR code.
5. Install `print-agent/` on a Windows mini PC in the Wagga LAN and set the two printer IP addresses.

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `STAFF_PIN`
- `MANAGER_PIN`
- `KITCHEN_PIN`
- `PRINT_AGENT_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Ordering rules

Defaults are 90 minutes, last order 15 minutes before the end, 5-minute cooldown, maximum 2 portions of the same item per round, and a meat round limit based on the table's dining-equivalent guest count. Critical order validation runs in the PostgreSQL function `submit_customer_order` with a row lock, so multiple phones on the same table cannot bypass the shared limit by ordering simultaneously.

## Printing

The Print Agent polls the cloud app for unprinted orders and routes `meat` and `hot` tickets to separate LAN printers over raw TCP/9100. Confirm the exact Wagga printer brands/models before live use; some models require a vendor SDK or different ESC/POS cut command.

## Before live service

Test in stages: preview deployment → no-printer KDS test → one-printer test → two physical tables → five tables → full dining room.

## Remaining menu detail

Korean Fried Chicken is included as one item, but the exact current Hanok flavour list has not yet been supplied. Add flavour modifiers before production launch so kitchen tickets include the selected flavour.
