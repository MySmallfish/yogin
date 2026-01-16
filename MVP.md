Below is an **implementation plan** (architecture + phased delivery) for building the **backend in .NET (C#)** and the **frontend as “no‑build” HTML/JS/CSS** (Bootstrap allowed), with **templating + routing libraries**, and **state management using XState**—aligned to your MVP scope and the brief. 

---

# 1) Target architecture

## 1.1 Components

1. **ASP.NET Core Backend (Web API + Static hosting)**

   * Hosts REST API under `/api/*`
   * Serves the no-build frontend from `wwwroot/` (two apps):

     * `/admin` (Backoffice)
     * `/app` (Client registration app)
     * `/s/{studioSlug}` (Public schedule page that deep-links into `/app`)
2. **Database**

   * PostgreSQL (recommended) or SQL Server
3. **Object storage (optional for MVP)**

   * For logos / assets / later signed forms: S3/Azure Blob or local disk initially
4. **Background jobs**

   * For generating recurring instances, reminders, and email sending
   * Minimal: `IHostedService` + DB-backed job table
   * Or use Hangfire/Quartz when ready

## 1.2 Key backend modules (bounded contexts)

* **Identity & Access**: Staff roles (Admin/Instructor), Customers
* **Studio Setup**: studio settings, rooms, instructors, branding/theme
* **Scheduling**: event series + event instances + capacity
* **Products**: drop-in price, membership plans, coupons
* **Booking**: register/cancel + policy enforcement
* **Payments**: checkout + webhook reconciliation
* **Notifications**: email/push (MVP: email + web push optional)
* **Reporting/Export**: occupancy, revenue, csv exports

## 1.3 Frontend apps (no build)

* **Client App** (PWA-friendly): browse schedule → event → register → pay → “My bookings/payments”
* **Admin App**: calendar/week view, CRUD events/plans, customers, attendance, exports

---

# 2) Backend plan (.NET C#)

## 2.1 Tech choices (recommended)

* **.NET 8 (LTS)**, ASP.NET Core
* **EF Core** + migrations
* **PostgreSQL** (or SQL Server)
* **Authentication**

  * Staff: Cookie auth (simplest for same-domain admin app)
  * Customers: Cookie auth + External login (Google/Facebook)
  * Optional: also issue JWT for future native apps (not required for no-build web)
* **Time & recurrence**

  * Use UTC in DB; store studio timezone in Studio settings
  * Use NodaTime (recommended) to avoid DST bugs
  * Recurrence rules:

    * MVP: weekly recurrence + optional daily
    * Store recurrence as structured fields OR as iCal RRULE string
    * Generate EventInstances forward (e.g., 8 weeks rolling window)

---

## 2.2 Data model (MVP tables)

You can implement these first; everything else hangs off them.

**Identity**

* `Users` (staff + customer if using Identity as one table)
* `Roles`, `UserRoles`

**Studio**

* `Studios` (Id, Slug, Name, Timezone, ThemeJson)
* `Rooms` (Id, StudioId, Name)
* `Instructors` (Id, StudioId, UserId or separate profile)

**Scheduling**

* `EventSeries` (Id, StudioId, Title, Description, InstructorId, RoomId, RRule/Pattern, DefaultCapacity, DefaultPricingJson, CancellationPolicyJson)
* `EventInstances` (Id, SeriesId, StartUtc, EndUtc, CapacityOverride?, Status)

**Products**

* `Plans` (Id, StudioId, Type: WeeklyLimit / PunchCard / Unlimited, RulesJson, Price, Active)
* `Coupons` (Id, StudioId, Code, DiscountType, DiscountValue, ValidFrom/To, MaxUses…)

**Customer profile**

* `Customers` (Id, StudioId, UserId, Name, Phone, Email, Address…, TagsJson)
* `HealthDeclarations` (Id, StudioId, CustomerId, SubmittedAtUtc, PayloadJson, SignatureType…)

**Booking & Payments**

* `Bookings` (Id, StudioId, CustomerId, EventInstanceId, Status: Pending/Confirmed/Cancelled, CreatedAtUtc, CancelledAtUtc…)
* `Payments` (Id, StudioId, CustomerId, Provider, Amount, Currency, Status, ProviderRef, CreatedAtUtc)
* `Memberships` (Id, StudioId, CustomerId, PlanId, Status, StartUtc, EndUtc, RemainingUses?, RulesSnapshotJson)

**Notifications**

* `NotificationLog` (Id, StudioId, CustomerId, Type, Channel, Status, SentAtUtc, PayloadJson)

**Reporting/Export**

* Usually done via queries/views; no special tables needed in MVP.

---

## 2.3 Multi-tenancy approach (MVP)

**Goal:** keep studios isolated.

Recommended MVP strategy:

* Every table includes `StudioId`
* Backend derives `StudioId` from:

  * URL segment: `/s/{studioSlug}` and `/api/studios/{slug}/…`, or
  * Logged-in user claim (staff usually fixed to one studio)
* Enforce via:

  * Global query filter in EF Core for current `StudioId` (careful on admin cross-studio tools)
  * Validate on every write

---

## 2.4 API endpoints (MVP list)

Keep it simple and explicit.

### Auth

* `POST /api/auth/login` (email/password or magic link if you go that route)
* `GET /api/auth/external/{provider}` (start Google/Facebook flow)
* `GET /api/auth/external/callback`
* `POST /api/auth/logout`
* `GET /api/auth/me`

### Studio (admin)

* `GET/PUT /api/admin/studio`
* `GET/POST/PUT/DELETE /api/admin/rooms`
* `GET/POST/PUT/DELETE /api/admin/instructors`

### Scheduling (admin)

* `GET /api/admin/calendar?from=…&to=…`
* `POST /api/admin/event-series`
* `PUT /api/admin/event-series/{id}`
* `POST /api/admin/event-series/{id}/generate-instances` (or auto in background)
* `PUT /api/admin/event-instances/{id}` (override instructor/room/capacity/time for one instance)
* `DELETE /api/admin/event-instances/{id}` (cancel instance)

### Client schedule (public/app)

* `GET /api/public/studios/{slug}/schedule?from=…&to=…&filters=…`
* `GET /api/public/studios/{slug}/event-instances/{id}`

### Plans & coupons (admin)

* `GET/POST/PUT/DELETE /api/admin/plans`
* `GET/POST/PUT/DELETE /api/admin/coupons`

### Customer profile & health declaration

* `GET/PUT /api/app/me/profile`
* `POST /api/app/me/health-declaration`
* `GET /api/admin/customers?search=…`
* `GET /api/admin/customers/{id}`

### Booking engine

* `POST /api/app/bookings` (instanceId + paymentMode)
* `POST /api/app/bookings/{id}/cancel`
* `GET /api/app/me/bookings`

### Payments

* `POST /api/app/checkout` (drop-in or plan purchase)
* `POST /api/payments/webhook/{provider}`

### Instructor

* `GET /api/instructor/my-schedule?from=…&to=…`
* `GET /api/instructor/instances/{id}/roster`
* `POST /api/instructor/instances/{id}/attendance`

### Export & reports

* `GET /api/admin/reports/occupancy?from=…&to=…`
* `GET /api/admin/reports/revenue?from=…&to=…`
* `GET /api/admin/export/bookings.csv?from=…&to=…` (and similar)

---

## 2.5 Core business logic (must be correct in MVP)

### A) Recurrence → Instances

* Store series definition + recurrence
* Generate instances forward to a rolling horizon (e.g., next 8 weeks)
* Nightly job extends the horizon
* Editing series:

  * Option 1 (MVP): edits apply only to future instances not yet generated (simple)
  * Option 2: “apply to future generated instances” with controlled update

### B) Capacity & overbooking protection

* Booking creation must be **transactional**
* Approach:

  1. Lock instance row (or optimistic concurrency with RowVersion)
  2. Count confirmed bookings
  3. If `< capacity`, create booking + commit

### C) Membership weekly limit rule

Requirement: “2 per week” blocks even if the booked events are in the future. 
Implementation:

* Define “week” boundaries (configurable per studio: week starts Sunday vs Monday)
* Count **Confirmed** bookings in that week window for the membership
* Include future confirmed bookings in count
* On cancel: reduce count naturally because booking becomes Cancelled

### D) Cancellation policy

* Store policy per series/instance (e.g., “can cancel until X hours before start”)
* On cancel, check `now` vs `startUtc - policyWindow`

---

## 2.6 Background jobs (MVP minimum)

Implement a tiny job runner early (even before fancy libs), because you’ll need:

* Generate future instances
* Send reminders (email/push)
* Reconcile payment webhooks if needed

MVP approach:

* Table `Jobs` (Id, Type, PayloadJson, RunAtUtc, Status)
* `BackgroundService` polls due jobs and executes handlers

---

## 2.7 Deployment plan (backend)

* Single container deploy: API + static frontend in one
* Environment variables: DB conn string, OAuth secrets, payment keys
* Migrations run on startup (or in pipeline step)

---

# 3) Frontend plan (no-build HTML/JS/CSS + Bootstrap + templating + routing + XState)

## 3.1 Principles for “no build” done right

* Use **native ES Modules** (`<script type="module">`)
* Use **import maps** to pull libraries from CDN without bundling
* Keep JS in small feature modules
* Keep templating simple (Handlebars/Mustache) and cache compiled templates at runtime
* Keep all state transitions in **XState** machines (page machines + app machine)

---

## 3.2 Library choices (no-build friendly)

### CSS

* **Bootstrap** via CDN

### Templating (pick one)

* Option A: **Handlebars** (easy HTML templates, global or ESM)
* Option B: **Mustache** (simpler, logicless)

### Routing

* **Navigo** (simple SPA router, hash or history mode)

  * Use hash mode to avoid server rewrite complexity: `/#/schedule`

### State management

* **XState** (required)

  * App machine handles auth + studio context + route coordination
  * Feature machines handle schedule, event details, checkout, admin calendar, etc.

---

## 3.3 Folder structure (static)

Example inside `wwwroot/`:

* `wwwroot/`

  * `admin/`

    * `index.html`
    * `admin.css`
    * `admin.js`
  * `app/`

    * `index.html`
    * `app.css`
    * `app.js`
  * `shared/`

    * `api.js` (fetch wrapper)
    * `auth.js`
    * `router.js`
    * `templates.js`
    * `machines/`

      * `appMachine.js`
      * `scheduleMachine.js`
      * `eventMachine.js`
      * `checkoutMachine.js`
      * `adminCalendarMachine.js`
  * `assets/`

    * `logo-placeholder.svg`

---

## 3.4 Import map example (no-build)

Put this in each `index.html` (or share a snippet).

```html
<script type="importmap">
{
  "imports": {
    "xstate": "https://esm.sh/xstate@5",
    "navigo": "https://esm.sh/navigo",
    "handlebars": "https://esm.sh/handlebars"
  }
}
</script>
```

> If you prefer “script tags without modules”, you can also use UMD builds, but ESM + importmap keeps code cleaner.

---

## 3.5 XState architecture (recommended)

### Global App Machine (per app)

Context includes:

* `studioSlug`
* `user` (null or profile)
* `authState` (unknown / unauth / authed)
* `route` (current route)
* `toast` / errors

States:

* `boot` → load studio settings + session
* `unauthenticated` → show login
* `authenticated` → run child feature machine based on route

Events:

* `ROUTE_CHANGED`
* `LOGIN_SUCCESS`, `LOGOUT`
* `STUDIO_LOADED`
* `API_ERROR`

### Feature machines (examples)

**Client**

* `scheduleMachine`

  * `loading` → `ready` → `error`
  * supports filters + selecting an instance
* `eventMachine`

  * `loading` → `ready`
  * `registering` → `checkout` → `confirmed`
* `checkoutMachine`

  * `selectMode` (drop-in vs plan)
  * `applyingCoupon`
  * `paying`
  * `success` / `failure`

**Admin**

* `adminCalendarMachine`

  * `loadingWeek`
  * `weekReady`
  * `editingSeries`
  * `editingInstance`
  * `saving`
* `customersMachine`
* `plansMachine`

### Rendering strategy

On each state transition:

1. derive “view model”
2. render template into `<main>`
3. attach event listeners (or delegate events)

This keeps UI deterministic and prevents “random DOM drift”.

---

## 3.6 API client module (`shared/api.js`)

* Wrap `fetch` with:

  * base URL
  * JSON parsing
  * unified error format
  * retry policy only where safe
* Keep auth cookie-based where possible (simpler; fewer token storage issues)

---

## 3.7 Routes (Client app)

Hash routes example:

* `/#/schedule`
* `/#/event/:id`
* `/#/me/bookings`
* `/#/me/payments`
* `/#/profile`

Routes send events to the app machine:

* `ROUTE_CHANGED({ name, params })`

---

## 3.8 Public schedule + share links

* Public schedule page: `/s/{studioSlug}`
* Each event card includes “share link”:

  * shared URL: `/s/{studioSlug}#/event/{id}`
  * if user is not logged in, app machine goes to login → returns to event after auth

---

# 4) Phased implementation plan (backend + frontend together)

## Milestone 1 — Project skeleton + auth

**Backend**

* Create solution, EF Core, migrations, Studio table
* Cookie auth + Admin role
* Swagger + basic health endpoint

**Frontend**

* `/admin` + `/app` shells with Bootstrap
* Router wired
* XState appMachine boot flow (no real pages yet)
* API wrapper stubbed

**Done when**

* Admin can log in and hit `/admin`, client can open `/app` and load studio slug context

---

## Milestone 2 — Scheduling core (series + instances) + public schedule

**Backend**

* EventSeries CRUD
* Instance generation (rolling horizon)
* Public schedule endpoint for date range
* Admin calendar endpoint

**Frontend**

* Admin: Week calendar list (MVP UI can be list by day if full grid is too heavy)
* Client: Schedule list (week)
* Event details page (read-only)

**Done when**

* Admin creates a weekly recurring class; client sees it on schedule page

---

## Milestone 3 — Booking engine (register/cancel) without payments

**Backend**

* Booking create (capacity + policy + membership eligibility stub)
* Cancel booking (policy check)

**Frontend**

* Client: “Register” creates booking
* “My bookings” view
* Cancel flow

**Done when**

* A logged-in client registers and cancels within policy window

---

## Milestone 4 — Products: plans + eligibility rules

**Backend**

* Plans CRUD
* Membership purchase record creation (without payment first or with mocked payment)
* Eligibility engine for weekly-limit rule (counts confirmed bookings incl. future)

**Frontend**

* Admin: Plans management page
* Client: when registering, choose “drop-in vs plan” (plan logic can be simplified to “already have membership” in first iteration)

**Done when**

* Weekly-limit rule blocks 3rd booking in the same week (even future ones)

---

## Milestone 5 — Payments integration

**Backend**

* Checkout endpoint
* Payment webhook endpoint
* Booking confirmation only after paid (or allow “pending” then confirm on webhook)

**Frontend**

* Checkout screen (redirect or embedded)
* Success/failure handling in XState checkoutMachine

**Done when**

* Drop-in payment confirms booking; plan purchase creates active membership

---

## Milestone 6 — Onboarding + health declaration

**Backend**

* Profile required fields
* Health declaration submit + store
* Enforcement: first booking requires health declaration

**Frontend**

* Profile wizard
* Health declaration modal/page controlled by XState before booking

**Done when**

* New user must complete health declaration before first booking

---

## Milestone 7 — Instructor view + attendance

**Backend**

* Instructor schedule endpoint
* Roster endpoint
* Attendance updates

**Frontend**

* Simple instructor pages under `/admin` (or `/instructor`) with restricted role

**Done when**

* Instructor sees own classes and can mark attendance

---

## Milestone 8 — Notifications + exports + basic reports

**Backend**

* Notification service + templates (email)
* Reminder job scheduling
* CSV exports
* Occupancy + revenue endpoints

**Frontend**

* Admin: exports + basic dashboard tiles

**Done when**

* Reminder emails go out and admin can download bookings CSV

---

# 5) Notes specific to “no-build” constraints

* Prefer **hash routing** to avoid server rewrite rules.
* Keep dependencies minimal; if CDN is a concern, you can vendor the JS libs into `wwwroot/vendor/` later.
* If you want **push notifications** on a no-build web app, plan it as a **PWA** (service worker + Web Push). This is feasible but adds complexity; for MVP you can start with email notifications and add push later.

---

If you want, I can convert this into:

* a **Jira-ready backlog** split by Milestones (Backend vs Frontend tickets), and/or
* a concrete **API contract draft** (request/response examples) for the critical flows: schedule → event → register → checkout → confirm.
