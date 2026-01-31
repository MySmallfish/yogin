# WhatsApp Bot PRD (Customer Facing)

## 1. Overview
Create a WhatsApp customer-facing bot that allows studio members to **discover classes, register, reschedule/cancel, and pay** without visiting the web app. The bot must be friendly, fast, bilingual (Hebrew/English), and tied to the existing Letmein/Yogin studio data (sessions, plans, waivers, customer profiles).

## 2. Goals
- Reduce booking friction: customers can complete a full booking in WhatsApp.
- Increase retention: quick check-ins, reminders, and easy rescheduling.
- Increase conversion: simple purchase flows for plans, drop-ins, and add-ons.
- Reduce staff workload: automate routine inquiries and self-service actions.

## 3. Non-Goals (v1)
- Full coaching / chat support.
- Complex billing (invoices generated elsewhere).
- Multi-studio marketplace (studio scoped only).
- Advanced CRM automation (basic tagging + activity only).

## 4. Personas
1. **Member**: has a plan, wants to quickly book and check schedule.
2. **Drop-in**: not a member, wants to pay and join one session.
3. **Returning customer**: wants to reschedule/cancel and manage attendance.
4. **Studio manager**: wants fewer booking calls and fewer manual tasks.

## 5. Success Metrics
- % of registrations completed via WhatsApp.
- Time-to-book (message to confirmation).
- Drop-in conversion rate.
- No-show reduction via reminders.
- Reduction in inbound admin requests for scheduling.

## 6. Key User Journeys
### 6.1 New Customer (no profile)
1. User sends “Hi” → bot detects phone not registered.
2. Bot asks for name + email + (optional) city.
3. Bot requests **Health Waiver** agreement if not signed.
4. Bot shows upcoming sessions and “Pay & Register”.

### 6.2 Existing Customer Booking
1. User asks “What’s available today?”
2. Bot shows today’s classes with time, instructor, spots left.
3. User taps a session → bot checks eligibility (plan/credits).
4. Bot confirms registration + adds to calendar.

### 6.3 Reschedule/Cancel
1. User asks “Cancel my 18:00 yoga”.
2. Bot shows upcoming bookings.
3. User selects booking → confirms cancellation.
4. If plan has penalty rules, display policy and require confirmation.

### 6.4 Drop-in Payment
1. User selects a session without eligible plan.
2. Bot offers drop-in purchase.
3. User pays (payment link or WhatsApp payment supported).
4. Bot confirms and registers.

### 6.5 Plan Purchase
1. User asks “Buy a plan”.
2. Bot shows available plans (filtered by category if provided).
3. User selects → pays → plan applied to account.

## 7. Functional Requirements
### 7.1 Identity & Verification
- Identify customer by **phone number** (WhatsApp sender).
- If not found, create a customer record.
- Allow linking email to account for receipts and future logins.

### 7.2 Waiver & Terms
- If `SignedHealthView` is false:
  - Present **Health Waiver** summary and link to full policy.
  - Require explicit “I agree” before booking.
  - Store timestamp and signature metadata.
- Also present Terms & Privacy acceptance when required.

### 7.3 Scheduling / Availability
- Search sessions by: **today, date, instructor, class type**.
- Show availability: capacity, waitlist status.
- Respect overlapping rules and booking cutoff windows.
- Handle recurring series and one-time sessions.

### 7.4 Registration
- Register customer to session if:
  - Eligible plan exists **or** drop-in paid.
  - Waiver signed or admin override rules satisfied.
  - Capacity available.
- Provide confirmation with session details and “Add to calendar”.

### 7.5 Changes / Cancellations
- Allow canceling if inside cancellation window.
- Provide policy text in a clear, short confirmation.
- Update customer activity log and audit log.

### 7.6 Payments
- Payment options:
  - External payment link (Stripe/PayPal/Tranzila).
  - If WhatsApp Payments available, use native.
- Payment statuses:
  - Created / Paid / Failed / Expired.
- After payment success: auto-register session and apply plan.

### 7.7 Notifications
- Confirmation message after booking.
- Reminders (24h and 2h before).
- Cancellation notifications.

### 7.8 Language & Localization
- Hebrew default for IL studios, English fallback.
- Dates in DD/MM/YYYY, time in 24h.
- RTL display for Hebrew.

## 8. Conversation Flows (High Level)
1. **Start**
   - “Hello 👋 How can I help?”
   - Options: Book / My Bookings / Buy Plan / Support
2. **Book**
   - “When?” (today/tomorrow/select date)
   - “What class?” (list)
   - “Confirm booking”
3. **My Bookings**
   - Show upcoming
   - Reschedule / Cancel
4. **Buy Plan**
   - Show plans
   - Pay
   - Confirmation

## 9. Data & Integrations
- Use existing API endpoints:
  - Sessions / Series / Plans / Customers / Bookings.
- New API endpoints required:
  - `POST /api/bot/identify`
  - `POST /api/bot/book`
  - `POST /api/bot/cancel`
  - `POST /api/bot/pay`
- Audit logs must capture all actions.

## 10. Security & Compliance
- Validate studio ownership per WhatsApp number.
- Rate limit unknown numbers.
- Store minimal PII (name/email/phone).
- GDPR: ability to delete data on request.

## 11. UX Guidelines
- Short replies, use quick-reply buttons.
- Avoid long paragraphs; chunk info.
- Provide “Back” and “Main menu”.
- Always confirm before charging.

## 12. Edge Cases
- Full class → waitlist or offer next available.
- Customer with expired plan → offer renewal.
- Payment fails → retry or choose different method.
- Session canceled → notify customer immediately.

## 13. Analytics & Logging
- Log:
  - Flow completion
  - Drop-off points
  - Payment success rate
  - Most requested classes
- Use existing audit log table + event telemetry.

## 14. Rollout Plan
1. Internal beta: one studio, low traffic.
2. Add payments + waiver flow.
3. Expand to new studios.
4. Optimize with FAQ + NLP intent detection.

## 15. Risks
- WhatsApp API limitations and approval delays.
- Payment compliance & chargebacks.
- Multi-language string maintenance.

## 16. Future Enhancements
- AI-driven intent matching.
- Personal recommendations.
- Membership upgrades and offers.
- Loyalty points and referral codes.
