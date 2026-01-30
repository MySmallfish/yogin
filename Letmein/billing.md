I tried to load `https://web.redox.co.il/` directly, but my web viewer can’t render it (it returns an unexpected status code), so I can’t reliably “look at the UI” from here. I *can* still design a billing module that fits a typical yoga/pilates studio-management product and is easy to extend later into invoices + payments when you’re ready.

Below is a concrete **billing-only** design: it supports **recurring billings (memberships/subscriptions)** and **one‑time charges (session registrations, workshops, products, fees)**, while explicitly **not** doing invoices and **not** doing payments.

---

## What “Billing” means in this phase

### Goals

* Record **what each customer should be charged** (a ledger of charges).
* Generate charges automatically for **recurring plans**.
* Create charges automatically for **one‑time events** (booking a class/workshop) and **products**.
* Allow staff to **view, filter, export, correct (void/reverse)** charges.
* Be **future-proof** for adding invoices (grouping charges) + payments later.

### Non-goals (explicitly out of scope)

* No payment processing, no payment methods, no transaction records.
* No invoices (no invoice numbers, PDF/email invoices, tax invoices).
* No receipts.

> Important design implication: we track **charges** (amounts owed), and we track **voids/reversals/adjustments**, but we do not track “paid”.

---

## Core concepts and terminology

Think of Billing as a **ledger**.

### 1) Billable item (catalog)

A thing you can charge money for:

* Membership plan (recurring)
* Class pack / pass (one-time purchase)
* Drop-in class registration (one-time)
* Workshop registration (one-time)
* Retail product (one-time)
* Fees (late cancel, no-show, joining fee, etc.)

### 2) Subscription (recurring agreement)

A customer’s active recurring plan:

* “Charge this customer 320 ₪ every month on the 1st”
* “Charge weekly on Mondays”
* Can be paused/canceled/ended

### 3) Charge (ledger entry)

A posted amount owed by a customer, created either:

* by the subscription engine (recurring), or
* by a booking/purchase event (one-time), or
* manually by staff

A charge can have one or more **line items** for breakdown.

---

## Data model (designed to support invoices & payments later)

Below is a practical relational model (Postgres/MySQL style). Even if you’re using something else, the structure is the key.

### Tables

#### `billable_items`

Represents products/services/fees.

* `id`
* `studio_id` (tenant)
* `name`
* `type` ENUM: `membership`, `class_pass`, `drop_in`, `workshop`, `retail`, `fee`, `custom`
* `active` boolean
* `default_price` (money)
* `currency` (likely per studio)
* `tax_behavior` ENUM: `none`, `exclusive`, `inclusive` (optional now, can be “none” for MVP)
* `metadata` JSON (optional)

#### `subscriptions`

Customer recurring agreement.

* `id`
* `studio_id`
* `customer_id`
* `billable_item_id` (the plan)
* `status` ENUM: `active`, `paused`, `canceled`, `ended`
* `start_date`
* `end_date` (nullable)
* `billing_interval` ENUM: `monthly`, `weekly`, `custom`
* `billing_anchor_day` (e.g., day-of-month 1..31 OR weekday)
* `next_charge_date` (computed)
* `price_override` (nullable)
* `created_at`, `updated_at`
* `canceled_at`, `paused_at`, `resumed_at` (optional)

#### `charges`

The ledger “header” row.

* `id`
* `studio_id`
* `customer_id`
* `status` ENUM: `draft`, `posted`, `voided`
* `charge_date` (the date this becomes billable)
* `due_date` (optional; can default to charge_date)
* `currency`
* `subtotal_amount`
* `tax_amount` (optional)
* `total_amount`
* `source_type` ENUM: `subscription`, `session_registration`, `workshop_registration`, `pos_sale`, `manual`, `fee`, …
* `source_id` (id of booking/subscription/etc)
* `billing_period_start` (nullable; for subscription)
* `billing_period_end` (nullable; for subscription)
* `note` (optional)
* `created_by_user_id` (nullable; system vs staff)
* `created_at`, `updated_at`
* `voided_at`, `void_reason`

**Critical for correctness (idempotency):**

* Unique constraint for subscription-generated charges:

  * `(studio_id, source_type='subscription', source_id, billing_period_start)` UNIQUE
    So the job can run twice without duplicating charges.

#### `charge_line_items`

Breakdown of a charge.

* `id`
* `charge_id`
* `billable_item_id` (nullable if ad-hoc)
* `description`
* `quantity`
* `unit_price`
* `line_subtotal`
* `tax_amount` (optional)
* `line_total`
* `metadata` JSON (optional; includes class_id, trainer_id, etc.)

#### `charge_adjustments` (optional but recommended)

For reversals/credits without invoices/payments.

* `id`
* `studio_id`
* `customer_id`
* `original_charge_id`
* `adjustment_charge_id` (a negative charge in `charges`, or separate table)
* `reason`
* `created_at`

> Simplest implementation: represent reversals as a normal `charges` row with negative amounts and `source_type='adjustment'` + `original_charge_id` reference.

---

## Billing engine behavior

### A) Recurring billing (subscriptions)

#### How charges are generated

A daily scheduled job (or event-driven job) runs:

* for each studio, for each active subscription
* if `next_charge_date <= today`
* generate a `posted` charge for the upcoming period
* update `next_charge_date` by interval rules

#### Subscription rules (MVP defaults)

* Monthly plan:

  * If anchor day = 31 and the month has fewer days → charge on the **last day of month**.
* No proration in MVP (or optional):

  * Start date mid-month: either charge immediately full amount OR charge starting next cycle.
  * I strongly recommend MVP default: **first charge on start date**, next on anchor.

You can add proration later without rewriting the model.

#### Subscription operations

* Create subscription
* Pause subscription (skips charge generation while paused)
* Resume subscription (recomputes `next_charge_date`)
* Cancel subscription (stops future charges; existing charges remain)

### B) One-time charges

#### Session registration charge (drop-in / workshop)

When staff books a customer into a session/workshop:

* Determine if this booking is billable:

  * If booking is covered by an entitlement (membership/pass): **no charge created**
  * Else: create a `posted` charge with one line item (“Drop-in: Mat Pilates – Tue 19:00”)

**Cancellation handling (billing-only)**

* If booking canceled and you want to remove the charge:

  * If charge exists: set charge `status='voided'` (or create a negative adjustment if you want auditability)

#### Product charges (retail, registration fee, class pack)

When staff sells/assigns a product to a customer:

* create a `posted` charge with line item for that product

### C) Manual charges

Staff can add a charge:

* “One-time private session fee”
* “Late cancel fee”
* “Custom adjustment (credit)”

---

## UI/UX: screens and flows

### Navigation

Add a new main module: **Billing**

Recommended menu:

* Billing Overview
* Charges
* Subscriptions
* Products (Billable Items)
* Exports / Reports
* Settings

---

### 1) Charges list

A table view for staff:

**Columns**

* Date
* Customer
* Type (Recurring / Session / Workshop / Product / Manual / Fee)
* Description (from line items)
* Amount
* Status (Draft/Posted/Void)
* Source link (e.g., click to the booking/subscription)

**Filters**

* Date range
* Customer
* Status
* Source type
* Created by (system vs staff)

**Actions**

* View
* Void (with reason)
* Create adjustment (negative charge)
* Export (CSV)

---

### 2) Charge detail view

Shows:

* Charge summary (date, customer, total, status)
* Line items breakdown
* Links to source (booking/subscription/product)
* Notes + audit trail (created by system/user, void reason)
* Actions: Void / Create adjustment / Edit (with restrictions)

**Editing restriction suggestion**

* If `status='posted'`, editing should be limited:

  * either “not editable” (preferred)
  * or “only notes + metadata”
  * any financial correction should happen via **void** or **adjustment** (accounting-safe)

---

### 3) Customer profile → Billing tab

* Active subscriptions list (next charge date, amount, status)
* Recent charges ledger
* “Total billed this month” (since no payments, this is *billed*, not “balance”)

---

### 4) Subscriptions UI

**Subscription list**

* Customer
* Plan
* Status
* Next charge date
* Amount

**Create subscription flow**

* Select customer
* Select plan (billable item type=membership)
* Start date
* Billing anchor rule
* Price override (optional)
* Save

**Subscription detail**

* Timeline of generated charges
* Pause/Resume/Cancel buttons

---

### 5) Products (Billable items)

Create/edit items:

* Name
* Type
* Price
* Active toggle

This lets you bill for:

* “Drop-in class”
* “10-class pass”
* “New member registration fee”
* “Grip socks”
  without hardcoding.

---

### 6) Booking flow integration (important)

When booking a session:

* Show a “Billing” panel:

  * “This booking will create a charge of X”
  * Or “Covered by membership/pass: no charge”
* If billed: show what line item will be created

This makes billing behavior transparent and reduces disputes later.

---

## Billing-only reporting & exports (super useful without payments)

Since you won’t have invoices/payments, exports are how studios reconcile with their payment provider/accountant.

### Exports to include in MVP

* Charges export (CSV) by date range:

  * customer name/id
  * charge date
  * source type
  * description
  * amount
  * status
* Subscription export:

  * active subscriptions
  * next charge date
  * amount

Optional:

* Group charges by customer and month (for “monthly statement” style export)

---

## Permissions & audit (don’t skip)

Billing data is sensitive; studios will also need accountability.

Roles/permissions:

* View billing
* Manage subscriptions
* Create manual charges
* Void charges / create adjustments
* Export reports

Audit trail:

* who created/voided/adjusted and when
* reason fields for void/adjustment

---

## Edge cases you should handle from day 1

### Recurring

* Month length differences (29/30/31)
* Timezone: use studio timezone (Asia/Jerusalem)
* Idempotency: job runs twice → no duplicate charges
* Subscription paused: no charges generated
* Subscription canceled: stop generating from cancel date forward

### One-time session registration

* Booking canceled: void or adjust charge
* Booking moved: update metadata or void+recreate (depending on strictness)
* No-show fee: generate fee charge as separate item

### Data integrity

* Don’t allow deleting posted charges; use void/adjustment
* Keep source links stable (booking id, subscription id)

---

## API/service layer (clean separation)

Even if you’re a monolith, model it like services. Suggested endpoints:

### Billable Items

* `GET /billing/items`
* `POST /billing/items`
* `PATCH /billing/items/:id`

### Subscriptions

* `GET /billing/subscriptions`
* `POST /billing/subscriptions`
* `POST /billing/subscriptions/:id/pause`
* `POST /billing/subscriptions/:id/resume`
* `POST /billing/subscriptions/:id/cancel`

### Charges

* `GET /billing/charges`
* `GET /billing/charges/:id`
* `POST /billing/charges` (manual)
* `POST /billing/charges/:id/void`
* `POST /billing/charges/:id/adjust` (creates negative charge linked to original)

### Engine/job

* `POST /internal/billing/run?date=YYYY-MM-DD` (admin/internal only)

---

## Implementation plan (MVP → solid → ready for invoices/payments later)

### MVP (smallest useful set)

1. **Data model**: billable_items, subscriptions, charges, line_items
2. **Billing engine**: daily job generates subscription charges (monthly only)
3. **One-time charges**:

   * when booking a paid session/workshop
   * when selling a product
4. **UI**:

   * Charges list + detail
   * Subscription list + create/pause/cancel
   * Customer billing tab
5. **Exports**: CSV of charges

> Result: studios can *see what to bill customers for*, and reconcile externally.

### Next iteration (high impact improvements)

* Pause/resume with better next-date logic
* Proration support (start mid-cycle, upgrades)
* Discount codes / promotions
* Tax/VAT support (configurable per studio)
* Better reporting (group by month/customer/product)

### Later (when you decide to add invoices/payments)

Because you built a ledger:

* **Invoices** become a grouping layer over charges:

  * `invoices` table with many `charges`
* **Payments** become allocations that reduce open balance:

  * `payments` table
  * `payment_allocations` linking payments → charges

You won’t need to rewrite the charge engine.

---

## Recommended defaults (so you can build without long spec debates)

If you want clean MVP decisions:

* **Charge session registrations at booking time**
* **No proration in MVP**
* **No editing posted charges**; only void/adjust
* **Monthly subscriptions only** in MVP (weekly later)
* **Exports are mandatory** (this is how studios will use billing without payments/invoices)

---

## If you want, I can tailor this to your existing system structure

If you paste:

* your current entities (Customer, Class, Booking, Membership, Package, etc.)
* or just screenshots of the booking flow + customer profile

…I can map the exact `source_type/source_id` wiring and suggest where in your UI the “Billing” panel should sit, consistent with your current patterns.
