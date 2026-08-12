# Wagga Hanok 重启计划 — Project State

Last updated: 2026-08-12 (Australia/Sydney)

This file is the durable project-memory baseline for the Wagga Hanok restart and ordering-system work. It records confirmed decisions, current production architecture, business rules, routes, database behavior, manager/staff controls, deployment state, and follow-up work.

> Security note: this repository is public. Operational PINs, session secrets, print secrets, private tokens, and other credentials are intentionally NOT recorded here in plaintext. They remain managed outside this file.

## 1. Project goal

Hanok Wagga Wagga is being restarted as a table-order unlimited Korean BBQ concept with minimal CapEx.

Core operating model:
- Table-order AYCE / unlimited model.
- No full buffet meat line or major remodel.
- Existing Korean side-dish bar and dessert remain self-service.
- BBQ meats, hot dishes, rice/soup are ordered by customer QR.
- Existing POS remains the money/payment system.
- Hanok custom ordering system handles included-food ordering, dining timer, Starter, controls, KDS/printing, and reporting.

Principle: QR reduces order-taking workload; it does not reduce floor service.

## 2. Dining rules

- Dining time: 90 minutes.
- Last order: 15 minutes before session end.
- Meat reorder cooldown: 5 minutes.
- Small portions; meat target 100g per portion/order unit.
- Customer does not enter table number or guest count.
- Staff starts the session and records guest categories.
- Fixed table QR token identifies the table.
- QR cannot order when the table has no active session.
- Multiple phones on one table share the same table/session rules.

Guest fields:
- Adults
- Children 8–12
- Children 4–7
- Under 4

Starter-equivalent logic currently uses adults + children 8–12 + 0.5 × children 4–7, minimum 1.

## 3. Physical tables

There are 16 physical tables total:
- T01 through T16

Each table has a fixed opaque token stored in Supabase. Public customer URLs use the opaque token, not a predictable table-number URL.

## 4. Production domain and hosting

Production customer/system domain:
- https://orderhanokbbqwagga.com

The domain was purchased through GoDaddy and points to the Vercel project.

GoDaddy DNS confirmed:
- A / @ / 76.76.21.21
- CNAME / www / cname.vercel-dns-0.com

Primary Vercel project:
- Project name: hanok-unlimited-ordering-za6y
- Project ID: prj_GRf7V60vhKeYpaRjlTIZj9wRKR1m
- Team ID: team_GZKWU3fWecS41X0ut680TvXh
- GitHub repository: GreatDaniel93/hanok-unlimited-ordering
- Branch: main

The old vercel.app production URL may remain available, but QR codes are now intentionally locked to the final production domain above.

## 5. QR-code system

Manager QR page:
- /manager/qr

Behavior:
- Reads T01–T16 from the database.
- Uses each table's fixed opaque token.
- Generates QR codes locally with the qrcode package.
- Each QR points to https://orderhanokbbqwagga.com/t/<table-token>.
- Manager can download individual PNGs.
- Manager can print all 16 tables from the page.

Printing/table-sign visual design is intentionally deferred for later refinement.

## 6. Main routes

Public/customer:
- /
- /t/[token]

Staff:
- /staff

Manager:
- /manager/menu
- /manager/qr

Kitchen:
- /kitchen/meat
- /kitchen/hot

Important APIs include:
- /api/auth/login
- /api/auth/logout
- /api/customer/session
- /api/customer/order
- /api/staff/tables
- /api/staff/session
- /api/kitchen/orders
- /api/manager/menu
- /api/manager/starter
- /api/manager/tables
- /api/print/pending

## 7. Authentication model

The system was changed from Vercel-stored application secrets to database-managed PIN authentication and short-lived access sessions.

Current model:
- Staff, manager, and kitchen PINs are hashed in Supabase.
- Successful PIN login creates a random access token.
- Access-token hash is stored in Supabase.
- Browser receives an HttpOnly cookie.
- Access session expires after 12 hours.
- Role is checked server-side through RPC.

Roles:
- staff
- manager
- kitchen

Manager has elevated controls.

Logout bug was fixed so database logout failure cannot prevent local cookie deletion. Legacy staff cookies are also cleared.

Do not put plaintext operational PINs or access secrets into this public repository.

## 8. Supabase

Production Supabase project:
- Name: hanokwagga buffet
- Project ref: pycuztuyrhdkqlepbinh
- Region: ap-southeast-1
- PostgreSQL 17

Core tables:
- stores
- dining_tables
- menu_items
- table_sessions
- orders
- order_items
- audit_logs
- backend_config
- staff_access_sessions
- starter_recipe_items

RLS is enabled on data tables. SECURITY DEFINER RPCs are used deliberately for protected server/business operations.

Current confirmed menu count after testing cleanup:
- 20 total products
- 20 active
- 0 hidden

## 9. Menu — BBQ meats

Current 11 BBQ meats, all generally modeled as 100g portions:
1. Wagyu Scotch Fillet
2. Wagyu Intercostal
3. Wagyu Inside Skirt
4. Marinated LA Short Rib
5. Marinated Angus Flap Meat
6. Wagyu Brisket
7. Pork Belly
8. Sausage
9. Marinated Chicken Thigh
10. Soy Marinated Chicken Thigh
11. Spicy Squid

## 10. Menu — hot dishes / rice / soup

Hot dishes:
1. Korean Fried Chicken
2. Fried Dumplings
3. Tteokbokki
4. Seafood Pancake
5. Japchae
6. Korean Rolled Egg
7. French Fries

Also made to order:
- Dolsot Bibimbap
- Soup of the Day

Bibimbap target portion discussed:
- 130–150g cooked rice
- 70–80g vegetables
- about 20g sauce + sesame oil
- 1 egg
- output target 5–7 minutes

Soup target:
- rotating soup
- about 200–250ml

Korean Fried Chicken flavour selector still requires final product/flavour definition if a selector is desired.

## 11. Customer order limits

Current meat-cap logic by starter equivalent:
- 1–2 guests/equivalent: 4 meat portions per order/round
- 3–4: 6
- 5–6: 8
- 7+: 10

Same meat item maximum was designed around max 2 per order unless product configuration overrides it.

Hot-food cooldown is separate from meat cooldown but participates in server-side controls.

The customer UI still uses internal round-related data in some places. Earlier product direction was to avoid emphasizing “Round N” to customers, keeping round as an internal/KDS concept. This remains a UI polish item.

## 12. Starter / First Grill Selection

Guest-facing concept:
- HANOK FIRST GRILL SELECTION
- “We’ll start your BBQ with a selection of Hanok favourites. After that, simply reorder whichever meats you enjoy most.”

Starter target:
- roughly 200g per adult/equivalent
- components are 100g portions
- target delivery about 5 minutes, maximum around 6 minutes

Starter recipes are now database-driven and manager-editable. They are no longer hard-coded in the starter-generation function.

Current default recipe totals:
- 2P: 4 meat types / 4 portions / ~400g
- 3P: 6 meat types / 6 portions / ~600g
- 4P: 8 meat types / 8 portions / ~800g
- 5P: 10 meat types / 10 portions / ~1,000g
- 6P: 10 meat types / 12 portions / ~1,200g

Current intended recipes preserved from the original design:

2P:
- Wagyu Brisket ×1
- Wagyu Scotch Fillet ×1
- Marinated LA Short Rib ×1
- Pork Belly ×1

3P:
- Wagyu Brisket ×1
- Wagyu Scotch Fillet ×1
- Wagyu Inside Skirt ×1
- Marinated LA Short Rib ×1
- Pork Belly ×1
- Marinated Chicken Thigh ×1

4P:
- Wagyu Brisket ×1
- Wagyu Scotch Fillet ×1
- Wagyu Inside Skirt ×1
- Wagyu Intercostal ×1
- Marinated LA Short Rib ×1
- Pork Belly ×1
- Marinated Chicken Thigh ×1
- Soy Marinated Chicken Thigh ×1

5P:
- Wagyu Brisket ×1
- Wagyu Scotch Fillet ×1
- Wagyu Inside Skirt ×1
- Wagyu Intercostal ×1
- Marinated LA Short Rib ×1
- Marinated Angus Flap Meat ×1
- Pork Belly ×1
- Marinated Chicken Thigh ×1
- Soy Marinated Chicken Thigh ×1
- Sausage ×1

6P:
- Wagyu Brisket ×2
- Wagyu Scotch Fillet ×1
- Wagyu Inside Skirt ×1
- Wagyu Intercostal ×1
- Marinated LA Short Rib ×1
- Marinated Angus Flap Meat ×1
- Pork Belly ×2
- Marinated Chicken Thigh ×1
- Soy Marinated Chicken Thigh ×1
- Sausage ×1

Spicy Squid is excluded from the default Starter.

7+ guest split logic remains automatic:
- 7 = 4P + 3P
- 8 = 4P + 4P
- 9 = 5P + 4P
- 10 = 5P + 5P
- 11 = 6P + 5P
- 12 = 6P + 6P
- larger groups continue in combinations of the configured recipe sizes.

Starter-generation orders route to the Meat station with source=starter and round_no=0.

## 13. Manager menu management

Manager page:
- /manager/menu

Product controls:
- Add Product
- Edit Product
- Hide Product
- Restore Product

Fields include:
- internal/kitchen name
- customer display name
- description
- category
- portion label
- max portions per order
- sort order

Category routing:
- meat -> Meat station
- hot -> Hot Kitchen
- rice_soup -> Hot Kitchen

Hide behavior:
- does NOT physically delete product records.
- sets active=false.
- hidden products disappear from future customer ordering.
- historical order records remain intact.

Starter protection:
- a meat still used in any Starter recipe cannot be hidden.
- a meat used in Starter cannot be changed into a non-meat category until removed from all Starter recipes.

Manager actions write audit-log entries.

## 14. Manager Starter management

Inside /manager/menu there are now two manager areas:
- PRODUCTS
- STARTER PLATTERS

Starter controls:
- select 2P / 3P / 4P / 5P / 6P
- add meat
- remove meat
- increase/decrease quantity
- save recipe

Saving writes directly to Supabase. New table sessions use the saved database recipe immediately; no code deployment is needed to change a recipe.

## 15. Staff dashboard

/staff provides:
- view all 16 tables
- available/dining status
- guest counts
- timer/remaining time
- start a 90-minute session
- automatic Starter generation on start
- close session

Manager-only actions available from the staff dashboard include:
- Open Ordering Now / unlock cooldown
- +5 minutes
- +10 minutes
- Edit Guests
- Move Table

The earlier RPC-argument bug affecting Start Session and table actions was fixed. Full database flow was tested successfully.

## 16. Confirmed end-to-end test results

A full T01 test was performed and cleaned up afterward.

Confirmed:
- Manager authentication works.
- 16 tables are returned.
- T01 4-person session can start.
- 4P Starter is automatically generated.
- Starter order goes to Meat station.
- 4P Starter contained 8 meat line items under the original recipe.
- Customer meat reorder worked.
- Test order included Wagyu Brisket and Pork Belly.
- Customer order generated a Meat-station order.
- 4-person meat cap was correctly calculated as 6.
- 5-minute meat cooldown was applied.
- KDS data showed T01, station=meat, source=customer, status=new, round 1 and correct items.
- Test session/order/audit test data was cleaned up.

Starter recipe generation was also transaction-tested for 2P–6P and rolled back after verification.

## 17. Kitchen / KDS

Kitchen routes:
- /kitchen/meat
- /kitchen/hot

Kitchen authentication uses the kitchen role.

Orders support statuses such as:
- new
- preparing
- ready
- picked_up

Reprint support exists through kitchen/order actions and the print pipeline.

## 18. Local print-agent architecture

Printing is intentionally separated from the cloud application.

Architecture:
- Vercel/cloud application creates orders.
- Store mini-PC runs the Hanok Print Agent.
- Agent polls cloud print API.
- Agent sends raw ESC/POS over TCP/9100 to fixed printer IPs.
- Agent marks cloud orders printed afterward.

Example planned printer mapping discussed:
- Meat printer: 192.168.10.21
- Hot printer: 192.168.10.22

These were examples/planning values and must be validated against the actual Wagga hardware before live printing.

Current limitation:
- physical “exactly once” printing cannot be perfectly guaranteed if a printer succeeds but cloud acknowledgement fails.

Before go-live printing, still required:
- actual printer brand/model
- Ethernet vs USB confirmation
- whether existing POS printers can be shared
- final ESC/POS compatibility test
- fixed IP configuration

Printing/table-sign visual work is deferred for later.

## 19. POS integration boundary

Existing POS remains responsible for MONEY:
- buffet package / child fees
- drinks/alcohol
- discounts
- GST
- payment
- closing/day-end

Hanok custom system handles $0 included food and control logic:
- QR ordering
- 90-minute session
- Starter
- cooldown/limits
- manager override
- KDS/printing
- operational analytics

Do not rebuild payment/GST/refund/inventory/booking/CRM/loyalty into the MVP unless requirements change.

Open POS integration questions remain:
- third-party Order API availability
- ability to create orders and use existing routing/printers/KDS
- API documentation / sandbox
- read Menu/Tables capability
- fees

If POS create-order/routing is available later, custom site could keep business-rule enforcement while handing final orders to POS. Otherwise the current independent KDS/printing architecture remains valid.

## 20. Service SOP principles

Key operational targets discussed:
- greet within about 30 seconds
- confirm booking/guest categories/high chair/allergies/first-time status
- seat with water, utensils, raw/cooked tongs, QR and grill/charcoal
- explain dining rules within about 2 minutes
- grill ready within about 3 minutes
- Starter target 5–6 minutes
- meat reorder target around 5 minutes
- hot food target <=8–10 minutes
- answer service call within about 1 minute
- clear table buildup within about 3 minutes
- proactive grill changes

Allergy principle:
- shared-kitchen cross-contact risk must be communicated.
- ordinary staff should not promise allergen safety beyond approved policy.

Floor roles discussed:
- Host/Cashier
- Floor Server
- Food Runner
- Side Dish Bar

Operating principle:
“Unlimited does not mean less service. It means faster, simpler and more attentive service.”

## 21. Current project status

As of 2026-08-12:
- Main website/application functions are considered basically working by the owner.
- Staff login/logout works after logout fix.
- Manager permissions work.
- Kitchen login/KDS flow exists.
- T01–T16 database/table setup is complete.
- Customer ordering flow works.
- Starter auto-generation works.
- Manager product management is live.
- Manager Starter management is live.
- Production domain orderhanokbbqwagga.com opens successfully.
- QR manager page is live and permanently generates production-domain table links.
- Permanent QR-table-sign printing/design is intentionally postponed for later refinement.

## 22. Deferred / next work

Do not treat these as blockers for the currently working core system. They are future refinement items:

1. QR table-sign visual design and print layout.
2. Actual printer hardware integration and live print-agent testing.
3. Korean Fried Chicken flavour selector if required.
4. Starter dietary variants / substitutions:
   - NO PORK
   - NO CHICKEN
   - NO MARINATED
   These were discussed but are not yet the final implemented flow.
5. Customer UI polish to de-emphasize visible “Round N”.
6. Possible manual staff-assisted order function.
7. Possible manager cancel-order controls.
8. POS API integration if provider supports order creation/routing.
9. Operational analytics/reporting refinement after live usage begins.
10. Final staff SOP/training pack once the production workflow is frozen.

## 23. Repository / migration history relevant to current state

Important migrations include:
- 001_initial.sql
- 002_rpc_backend.sql (GitHub copy historically incomplete/stub; production DB had full RPC logic applied)
- 003_expand_tables_to_16.sql
- 004_manager_menu_management.sql
- 005_manager_starter_management.sql

Important warning:
- The GitHub version of 002_rpc_backend.sql has historically been a documentation stub rather than the full production migration. Before rebuilding the entire database from scratch, reconcile this file with the live production RPC definitions and ensure all secrets/hashes are sanitized/parameterized.

## 24. Development principles to preserve

- Keep business rules server-side, not only in the browser.
- Do not expose predictable table URLs.
- Do not store plaintext operational secrets in the public repository.
- Prefer hide/deactivate over destructive delete where historical orders depend on records.
- Keep POS/payment responsibility separate from included-food ordering unless a deliberate integration is implemented.
- Keep QR table identity stable even if hosting changes by using the custom production domain.
- Manager configuration changes should write to Supabase and take effect without code deployment whenever practical.

---

When continuing this project in a new conversation, use this document as the durable baseline and verify live state before changing production behavior.