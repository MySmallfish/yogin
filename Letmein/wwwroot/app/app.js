import { createMachine, createActor, fromPromise, assign } from "xstate";
import Handlebars from "handlebars";
import { apiGet, apiPost, apiPut } from "../shared/api.js";
import { login, logout, register, getSession, loadSessionHint, consumeForceLogout } from "../shared/auth.js";
import { setLocale, t, resolveLocale, getStoredLocale } from "../shared/i18n.js";
import { compileTemplate } from "../shared/templates.js";
import { formatDateTime, formatMoney, getQueryParam } from "../shared/utils.js";
import { renderMarkdown } from "../shared/markdown.js";

const root = document.getElementById("app");
const sessionHint = loadSessionHint();
Handlebars.registerHelper("t", (key, fallback) => t(key, fallback));

const layoutTemplate = compileTemplate("layout", `
  <div class="shell">
    <div class="hero">
      <h1>{{title}}</h1>
      <div class="meta">{{subtitle}}</div>
    </div>
    <nav class="navbar">
      <a href="#/schedule" data-route="schedule">{{t "nav.schedule" "Schedule"}}</a>
      <a href="#/me" data-route="me">{{t "nav.me" "My registrations"}}</a>
      <a href="#/payments" data-route="payments">{{t "nav.payments" "Payments"}}</a>
      <a href="#/profile" data-route="profile">{{t "nav.profile" "Profile"}}</a>
      <button class="secondary" id="logout-btn">{{t "nav.logout" "Log out"}}</button>
    </nav>
    <div class="surface">
      {{{content}}}
    </div>
  </div>
  <div class="toast-root" id="toast-root"></div>
`);

const loginTemplate = compileTemplate("login", `
  <div class="login-card">
    <h2>{{t "login.title" "Welcome to Letmein"}}</h2>
    <p>{{t "login.subtitle" "Sign in or create an account to register for classes."}}</p>
    {{#if error}}
      <div class="notice">{{error}}</div>
    {{/if}}
    <div class="login-switch">
      <button type="button" class="secondary active" data-auth-mode="login">{{t "login.signIn" "Sign in"}}</button>
      <button type="button" class="secondary" data-auth-mode="register">{{t "login.createAccount" "Create account"}}</button>
    </div>
    <form id="login-form">
      <label>{{t "login.email" "Email"}}</label>
      <input type="email" name="email" required value="member@letmein.local" />
      <label>{{t "login.password" "Password"}}</label>
      <input type="password" name="password" required value="member123" />
      <label>{{t "login.studioSlug" "Studio slug"}}</label>
      <input type="text" name="studioSlug" required value="{{studioSlug}}" />
      <button type="submit">{{t "login.submit" "Sign in"}}</button>
    </form>
    <form id="register-form" class="hidden">
      <label>{{t "login.fullName" "Full name"}}</label>
      <input type="text" name="fullName" required />
      <label>{{t "login.phone" "Phone"}}</label>
      <input type="tel" name="phone" />
      <label>{{t "login.email" "Email"}}</label>
      <input type="email" name="email" required />
      <label>{{t "login.password" "Password"}}</label>
      <input type="password" name="password" required />
      <label>{{t "login.studioSlug" "Studio slug"}}</label>
      <input type="text" name="studioSlug" required value="{{studioSlug}}" />
      <button type="submit">{{t "login.submitRegister" "Create account"}}</button>
    </form>
  </div>
`);

function showToast(message, type = "info") {
    if (!message) return;
    const root = document.getElementById("toast-root");
    if (!root) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    root.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });
    const removeToast = () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    };
    const timeout = setTimeout(removeToast, 3200);
    toast.addEventListener("click", () => {
        clearTimeout(timeout);
        removeToast();
    });
}

async function openLegalModal(kind) {
    const existing = document.getElementById("legal-modal");
    if (existing) {
        existing.remove();
    }
    const safeKind = kind === "privacy" ? "privacy" : "terms";
    const title = safeKind === "privacy"
        ? t("legal.privacyTitle", "Privacy policy")
        : t("legal.termsTitle", "Terms & conditions");
    let markdown = "";
    try {
        const response = await fetch(`/public/${safeKind}.md`);
        markdown = await response.text();
    } catch {
        markdown = t("legal.loadError", "Unable to load content.");
    }
    const content = renderMarkdown(markdown || "");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = legalModalTemplate({ title, content });
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);
    const closeModal = () => overlay.remove();
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });
    const closeBtn = overlay.querySelector("#close-legal");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
}

function setupSignaturePad(canvas, outputInput, clearButton) {
    if (!canvas || !outputInput) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    let drawing = false;
    let hasStroke = false;

    const getPoint = (event) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    };

    const redraw = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, rect.width * ratio);
        canvas.height = Math.max(1, rect.height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#0f172a";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
        if (outputInput.value) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
            };
            img.src = outputInput.value;
            hasStroke = true;
        }
    };

    const syncOutput = () => {
        if (!hasStroke) {
            outputInput.value = "";
            return;
        }
        outputInput.value = canvas.toDataURL("image/png");
    };

    const startDraw = (event) => {
        drawing = true;
        hasStroke = true;
        const point = getPoint(event);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x + 0.01, point.y + 0.01);
        ctx.stroke();
        canvas.setPointerCapture(event.pointerId);
    };
    const moveDraw = (event) => {
        if (!drawing) return;
        const point = getPoint(event);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    };
    const endDraw = (event) => {
        if (!drawing) return;
        drawing = false;
        try {
            canvas.releasePointerCapture(event.pointerId);
        } catch {
            // Ignore if pointer was not captured.
        }
        syncOutput();
    };

    canvas.addEventListener("pointerdown", startDraw);
    canvas.addEventListener("pointermove", moveDraw);
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);
    canvas.addEventListener("pointerleave", endDraw);

    if (clearButton) {
        clearButton.addEventListener("click", () => {
            hasStroke = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const rect = canvas.getBoundingClientRect();
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, rect.width, rect.height);
            syncOutput();
        });
    }

    redraw();
    window.addEventListener("resize", redraw);

    return {
        sync: syncOutput,
        hasSignature: () => hasStroke
    };
}

const scheduleTemplate = compileTemplate("schedule", `
  {{#if notice}}
    <div class="notice">{{notice}}</div>
  {{/if}}
  {{#if hasItems}}
    {{#each sections}}
      <div class="schedule-day">
        <div class="schedule-day-header">{{label}}</div>
        <div class="grid">
          {{#each items}}
          <div class="card {{#if isFull}}dim{{/if}}">
            <h3>{{seriesTitle}}</h3>
            <div class="meta">{{start}} - {{roomName}}</div>
            <div class="meta">{{t "schedule.instructor" "Instructor"}}: {{instructorName}}</div>
            <div class="meta">{{availability}}</div>
            <div class="meta">{{price}}</div>
            <button data-event="{{id}}" {{#unless isBookable}}disabled{{/unless}}>{{ctaLabel}}</button>
          </div>
          {{/each}}
        </div>
      </div>
    {{/each}}
  {{else}}
    <div class="empty-state">{{t "schedule.empty" "No upcoming classes yet."}}</div>
  {{/if}}
`);

const eventTemplate = compileTemplate("event", `
  <div class="event-layout">
    <div class="card">
      <div class="event-header">
        <h3>{{seriesTitle}}</h3>
        <span class="pill {{statusClass}}">{{statusLabel}}</span>
      </div>
      <div class="meta">{{start}} - {{roomName}}</div>
      <div class="meta">{{description}}</div>
      <div class="meta">{{t "schedule.instructor" "Instructor"}}: {{instructorName}}</div>
      <div class="meta">{{availability}}</div>
      <div class="meta">{{price}}</div>
    </div>
    <div class="card">
      <h3>{{t "event.book.title" "Book your spot"}}</h3>
      {{#if error}}
        <div class="notice">{{error}}</div>
      {{/if}}
      {{#if notice}}
        <div class="notice">{{notice}}</div>
      {{/if}}
      {{#if waiverRequired}}
        <div class="notice waiver-notice">
          <div>{{t "event.waiverRequired" "Health waiver required before booking."}}</div>
          <button type="button" class="secondary" id="open-waiver">{{t "event.waiverCta" "Complete waiver"}}</button>
        </div>
      {{/if}}
      {{#if hasRemote}}
        <label>{{t "event.attendance" "Attendance"}}</label>
        <select id="attendance-select">
          <option value="in-person" {{#if inPersonSelected}}selected{{/if}}>{{t "event.attendance.inPerson" "In-studio"}}</option>
          <option value="remote" {{#if remoteSelected}}selected{{/if}}>{{t "event.attendance.remote" "Remote (Zoom)"}}</option>
        </select>
      {{/if}}
      <label>{{t "event.membership" "Use membership"}}</label>
      <select id="membership-select" {{#if disableMembershipSelect}}disabled{{/if}}>
        {{#if dropInAllowed}}
          <option value="">{{t "event.dropIn" "Drop-in"}}</option>
        {{/if}}
        {{#each memberships}}
          <option value="{{id}}">{{label}}</option>
        {{/each}}
      </select>
      {{#if planRequired}}
        <div class="meta">{{t "event.planRequired" "This class requires an eligible plan or pass."}}</div>
      {{/if}}
      <button id="book-btn" {{#unless isBookable}}disabled{{/unless}}>{{bookLabel}}</button>
      {{#if hasPlans}}
        <div class="plan-list">
          <h4>{{t "event.plans.title" "Need a pass?"}}</h4>
          <div class="plan-grid">
            {{#each plans}}
              <div class="plan-card">
                <div class="plan-name">{{name}}</div>
                <div class="meta">{{price}}</div>
                <button class="secondary" data-plan="{{id}}">{{t "event.plans.buy" "Buy pass"}}</button>
              </div>
            {{/each}}
          </div>
        </div>
      {{/if}}
    </div>
  </div>
`);

const bookingsTemplate = compileTemplate("bookings", `
  {{#if notice}}
    <div class="notice">{{notice}}</div>
  {{/if}}
  <div class="grid">
    {{#each bookings}}
    <div class="card">
      <h3>{{title}}</h3>
      <div class="meta">{{start}}</div>
      <div class="meta">{{t "bookings.status" "Status"}}: {{status}}</div>
      {{#if canCancel}}
        <button class="secondary" data-cancel="{{id}}">{{t "bookings.cancel" "Cancel"}}</button>
      {{/if}}
    </div>
    {{/each}}
  </div>
`);

const paymentsTemplate = compileTemplate("payments", `
  <div class="grid">
    {{#each payments}}
    <div class="card">
      <h3>{{amount}}</h3>
      <div class="meta">{{t "payments.status" "Status"}}: {{status}}</div>
      <div class="meta">{{date}}</div>
      <div class="meta">{{t "payments.provider" "Provider"}}: {{provider}}</div>
    </div>
    {{/each}}
  </div>
`);

const profileTemplate = compileTemplate("profile", `
  <form id="profile-form" class="form-grid">
    <div>
      <label>{{t "profile.fullName" "Full name"}}</label>
      <input name="fullName" value="{{fullName}}" />
    </div>
    <div>
      <label>{{t "profile.email" "Email"}}</label>
      <input name="email" type="email" value="{{email}}" />
    </div>
    <div>
      <label>{{t "profile.phone" "Phone"}}</label>
      <input name="phone" type="tel" value="{{phone}}" />
    </div>
    <div>
      <label>{{t "profile.gender" "Gender"}}</label>
      <select name="gender">
        {{#each genderOptions}}
          <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
        {{/each}}
      </select>
    </div>
    <div>
      <label>{{t "profile.dateOfBirth" "Date of birth"}}</label>
      <input name="dateOfBirth" type="date" value="{{dateOfBirth}}" />
    </div>
    <div>
      <label>{{t "profile.idNumber" "ID number"}}</label>
      <input name="idNumber" value="{{idNumber}}" />
    </div>
    <div>
      <label>{{t "profile.city" "City"}}</label>
      <input name="city" value="{{city}}" />
    </div>
    <div class="span-2">
      <label>{{t "profile.address" "Address"}}</label>
      <input name="address" value="{{address}}" />
    </div>
    <div>
      <label>{{t "profile.occupation" "Occupation"}}</label>
      <input name="occupation" value="{{occupation}}" />
    </div>
    <div>
      <label>{{t "profile.language" "Language"}}</label>
      <select name="preferredLocale">
        {{#each languageOptions}}
          <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
        {{/each}}
      </select>
    </div>
    <div class="span-2">
      <button type="submit">{{t "profile.save" "Save profile"}}</button>
    </div>
  </form>
  <div class="card waiver-card">
    <h3>{{t "profile.waiver.title" "Health waiver"}}</h3>
    <p class="meta">{{t "profile.waiver.subtitle" "Complete once before your first booking."}}</p>
    <div class="notice">{{#if signedHealthView}}{{t "profile.waiver.status.complete" "Signed"}}{{else}}{{t "profile.waiver.status.pending" "Not signed yet."}}{{/if}}</div>
    <button class="secondary" id="open-waiver">{{t "profile.waiver.cta" "Complete waiver"}}</button>
  </div>
`);

const waiverTemplate = compileTemplate("waiver", `
  <div class="waiver-header">
    <h2>{{t "waiver.title" "Health waiver"}}</h2>
    <p class="meta">{{t "waiver.subtitle" "Complete this form before your first booking."}}</p>
    {{#if signedHealthView}}
      <div class="notice">{{t "waiver.status.complete" "Waiver already signed."}}</div>
    {{/if}}
  </div>
  <form id="waiver-form" class="waiver-form">
    <div class="waiver-section">
      <h3>{{t "waiver.section.details" "Customer details"}}</h3>
      <div class="form-grid">
        <div>
          <label>{{t "waiver.field.firstName" "First name"}}</label>
          <input name="firstName" value="{{firstName}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.lastName" "Last name"}}</label>
          <input name="lastName" value="{{lastName}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.email" "Email"}}</label>
          <input name="email" type="email" value="{{email}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.phone" "Phone"}}</label>
          <input name="phone" type="tel" value="{{phone}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.dateOfBirth" "Date of birth"}}</label>
          <input name="dateOfBirth" type="date" value="{{dateOfBirth}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.idNumber" "ID number"}}</label>
          <input name="idNumber" value="{{idNumber}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.gender" "Gender"}}</label>
          <select name="gender" required>
            {{#each genderOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "waiver.field.city" "City"}}</label>
          <input name="city" value="{{city}}" required />
        </div>
        <div class="span-2">
          <label>{{t "waiver.field.address" "Address"}}</label>
          <input name="address" value="{{address}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.occupation" "Occupation"}}</label>
          <input name="occupation" value="{{occupation}}" required />
        </div>
        <div>
          <label>{{t "waiver.field.heardAbout" "How did you hear about us?"}}</label>
          <input name="heardAbout" value="{{heardAbout}}" required />
        </div>
        <div class="span-2">
          <label>{{t "waiver.field.marketingConsent" "Marketing consent"}}</label>
          <div class="radio-group">
            <label><input type="radio" name="marketingConsent" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="marketingConsent" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
      </div>
    </div>
    <div class="waiver-section">
      <h3>{{t "waiver.section.health" "Health declaration"}}</h3>
      <div class="waiver-questions">
        <div class="radio-row">
          <span>{{t "waiver.question.highBloodPressure" "High blood pressure"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="highBloodPressure" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="highBloodPressure" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.diabetes" "Diabetes"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="diabetes" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="diabetes" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.headaches" "Headaches / dizziness / fainting"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="headaches" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="headaches" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.asthma" "Asthma or breathing problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="asthma" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="asthma" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.balance" "Balance problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="balanceIssues" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="balanceIssues" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.neckBackShoulder" "Neck / back / shoulder problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="neckBackShoulderIssues" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="neckBackShoulderIssues" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.joint" "Joint problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="jointProblems" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="jointProblems" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.spine" "Spine problems (disc, scoliosis, etc.)"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="spineProblems" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="spineProblems" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.digestive" "Digestive problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="digestiveProblems" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="digestiveProblems" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.ear" "Ear problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="earProblems" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="earProblems" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.eye" "Glaucoma / eye problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="eyeProblems" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="eyeProblems" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.chronic" "Chronic disease"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="chronicDisease" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="chronicDisease" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.surgery" "Surgical operations"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="surgeries" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="surgeries" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.menstrual" "Menstrual problems"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="menstrualProblems" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="menstrualProblems" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.smoker" "Smoker"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="smoker" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="smoker" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
        <div class="radio-row">
          <span>{{t "waiver.question.pregnant" "Are you pregnant?"}}</span>
          <div class="radio-group">
            <label><input type="radio" name="pregnant" value="yes" required />{{t "common.yes" "Yes"}}</label>
            <label><input type="radio" name="pregnant" value="no" required />{{t "common.no" "No"}}</label>
          </div>
        </div>
      </div>
      <label>{{t "waiver.field.otherNotes" "Other notes"}}</label>
      <textarea name="otherNotes" rows="3"></textarea>
    </div>
    <div class="waiver-section">
      <h3>{{t "waiver.section.signature" "Terms & signature"}}</h3>
      <div class="waiver-signature-grid">
        <div class="waiver-checkboxes">
          <label class="checkbox-row">
            <input type="checkbox" name="acknowledged" required />
            <span>{{t "waiver.acknowledge" "I confirm the information above is accurate and complete."}}</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" name="agreeToTerms" required />
            <span>
              {{t "waiver.agree" "I agree to the terms and privacy policy."}}
              <button type="button" class="link-button" id="open-terms">{{t "waiver.terms" "Read terms"}}</button>
              <button type="button" class="link-button" id="open-privacy">{{t "waiver.privacy" "Privacy policy"}}</button>
            </span>
          </label>
        </div>
        <div class="waiver-signature-block">
          <label>{{t "waiver.field.signature" "Signature"}}</label>
          <div class="signature-pad">
            <canvas id="waiver-signature" aria-label="{{t "waiver.signature.hint" "Draw your signature above."}}"></canvas>
          </div>
          <div class="signature-actions">
            <button type="button" class="secondary" id="clear-signature">{{t "waiver.signature.clear" "Clear signature"}}</button>
            <span class="signature-hint">{{t "waiver.signature.hint" "Draw your signature above."}}</span>
          </div>
          <input type="hidden" name="signatureDataUrl" />
          <div class="form-grid">
            <div>
              <label>{{t "waiver.field.signatureName" "Signature name"}}</label>
              <input name="signatureName" value="{{signatureName}}" required />
            </div>
            <div>
              <label>{{t "waiver.field.password" "Choose app password"}}</label>
              <input name="password" type="password" placeholder="{{t "waiver.field.passwordHint" "Leave empty to keep current"}}" />
            </div>
          </div>
        </div>
      </div>
      <button type="submit">{{t "waiver.submit" "Submit waiver"}}</button>
    </div>
  </form>
`);

const legalModalTemplate = compileTemplate("legal-modal", `
  <div class="modal-overlay" id="legal-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>{{title}}</h3>
        <button class="modal-close" id="close-legal" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-body legal-body">
        {{{content}}}
      </div>
    </div>
  </div>
`);

const appMachine = createMachine({
    id: "app",
    initial: "boot",
    context: {
        user: null,
        studio: null,
        studioSlug: getQueryParam("studio") || sessionHint.studioSlug || "demo",
        route: "schedule",
        params: {},
        data: {},
        error: ""
    },
    states: {
        boot: {
            invoke: {
                src: "loadSession",
                onDone: {
                    target: "loading",
                    actions: "setSession"
                },
                onError: {
                    target: "login"
                }
            }
        },
        login: {
            on: {
                LOGIN_SUCCESS: {
                    target: "loading",
                    actions: "setSession"
                }
            }
        },
        loading: {
            invoke: {
                src: "loadRoute",
                input: ({ context }) => context,
                onDone: {
                    target: "ready",
                    actions: "setData"
                },
                onError: {
                    target: "ready",
                    actions: "setError"
                }
            }
        },
        ready: {
            on: {
                NAVIGATE: {
                    target: "loading",
                    actions: "setRoute"
                },
                SET_SESSION: {
                    actions: "setSession"
                },
                REFRESH: {
                    target: "loading"
                }
            }
        }
    }
}, {
    actions: {
        setSession: assign(({ context, event }) => {
            const payload = event.output ?? event;
            return {
                ...context,
                user: payload.user ?? context.user,
                studio: payload.studio ?? context.studio,
                studioSlug: payload.studio?.slug ?? context.studioSlug,
                error: ""
            };
        }),
        setRoute: assign(({ context, event }) => ({
            ...context,
            route: event.route,
            params: event.params || {}
        })),
        setData: assign(({ context, event }) => ({
            ...context,
            data: event.output,
            error: ""
        })),
        setError: assign(({ context, event }) => {
            const message = event.error?.message;
            return {
                ...context,
                error: message === "LOGOUT" ? "" : (message || "Unable to load data")
            };
        })
    },
    actors: {
        loadSession: fromPromise(async () => {
            await setLocale("app", resolveLocale(getStoredLocale("app"), "", navigator.language));
            if (consumeForceLogout()) {
                throw new Error("LOGOUT");
            }
            try {
                const session = await getSession();
                const locale = resolveLocale(
                    session?.user?.preferredLocale,
                    session?.studio?.defaultLocale || "en",
                    navigator.language
                );
                await setLocale("app", locale);
                return { user: session.user, studio: session.studio };
            } catch (error) {
                const slug = getQueryParam("studio") || sessionHint.studioSlug || "demo";
                try {
                    const studio = await apiGet(`/api/public/studios/${slug}`);
                    const locale = resolveLocale("", studio?.defaultLocale || "en", navigator.language);
                    await setLocale("app", locale);
                } catch {
                    // ignore locale fallback errors
                }
                throw error;
            }
        }),
        loadRoute: fromPromise(async ({ input }) => {
            switch (input.route) {
                case "schedule": {
                    const from = new Date().toISOString().slice(0, 10);
                    const toDate = new Date();
                    toDate.setDate(toDate.getDate() + 14);
                    const to = toDate.toISOString().slice(0, 10);
                    const items = await apiGet(`/api/public/studios/${input.studioSlug}/schedule?from=${from}&to=${to}`);
                    return { items };
                }
                case "event": {
                    const event = await apiGet(`/api/public/studios/${input.studioSlug}/event-instances/${input.params.id}`);
                    const memberships = await apiGet("/api/app/me/memberships");
                    const plans = await apiGet(`/api/public/studios/${input.studioSlug}/plans`);
                    return { event, memberships, plans };
                }
                case "me": {
                    const bookings = await apiGet("/api/app/me/bookings");
                    return { bookings };
                }
                case "payments": {
                    const payments = await apiGet("/api/app/me/payments");
                    return { payments };
                }
                case "profile": {
                    const profile = await apiGet("/api/app/me/profile");        
                    return { profile };
                }
                case "waiver": {
                    const profile = await apiGet("/api/app/me/profile");
                    return { profile };
                }
                default:
                    return {};
            }
        })
    }
});

const actor = createActor(appMachine);

function render(state) {
    if (state.matches("login")) {
        root.innerHTML = loginTemplate({ error: state.context.error, studioSlug: state.context.studioSlug });
        bindAuthForms();
        return;
    }

    const route = state.context.route;
    const notice = getQueryParam("notice");
    const titleMap = {
        schedule: t("page.schedule.title", "Your studio schedule"),
        event: t("page.event.title", "Class details"),
        me: t("page.me.title", "My registrations"),
        payments: t("page.payments.title", "Payments"),
        profile: t("page.profile.title", "Profile"),
        waiver: t("page.waiver.title", "Health waiver")
    };

    let content = "";
    const data = state.context.data || {};

    if (route === "schedule") {
        const items = (data.items || []).map(item => {
            const statusValue = normalizeStatusValue(item.status);
            const statusLabel = normalizeStatus(statusValue);
            const remoteAvailable = item.remoteAvailable ?? Math.max(0, (item.remoteCapacity || 0) - (item.remoteBooked || 0));
            const hasRemote = (item.remoteCapacity || 0) > 0;
            const isCancelled = statusValue === "Cancelled";
            const isBookable = !isCancelled && (item.available > 0 || remoteAvailable > 0);
            const ctaLabel = isCancelled
                ? t("schedule.cta.cancelled", "Cancelled")
                : item.available > 0 || remoteAvailable > 0
                    ? t("schedule.cta.register", "Register")
                    : t("schedule.cta.full", "Full");
            const dateKey = toDateKeyLocal(item.startUtc);
            return {
                ...item,
                dateKey,
                dateLabel: formatDateLabel(item.startUtc),
                start: formatDateTime(item.startUtc),
                availability: hasRemote
                    ? `In-studio: ${item.available} left • Remote: ${remoteAvailable} left`
                    : `${item.available} spots left`,
                price: formatMoney(item.priceCents, item.currency),
                isBookable,
                isFull: !isBookable,
                ctaLabel
            };
        });
        const sections = groupScheduleItems(items);
        content = scheduleTemplate({
            sections,
            hasItems: sections.length > 0,
            notice: notice === "cancelled" ? t("schedule.notice.cancelled", "Booking cancelled.") : ""
        });
    }

    if (route === "event") {
        const event = data.event || {};
        const statusValue = normalizeStatusValue(event.status);
        const statusLabel = normalizeStatus(statusValue);
        const available = event.available ?? Math.max(0, (event.capacity || 0) - (event.booked || 0));
        const remoteAvailable = event.remoteAvailable ?? Math.max(0, (event.remoteCapacity || 0) - (event.remoteBooked || 0));
        const hasRemote = (event.remoteCapacity || 0) > 0;
        const isCancelled = statusValue === "Cancelled";
        const isBookable = !isCancelled && (available > 0 || remoteAvailable > 0);
        const bookingNotice = isCancelled
            ? t("event.cancelledNotice", "This class has been cancelled.")
            : available <= 0 && remoteAvailable <= 0
                ? t("event.fullNotice", "This class is currently full.")
                : "";
        const allowedPlanIds = Array.isArray(event.allowedPlanIds)
            ? event.allowedPlanIds.map(id => String(id))
            : [];
        const planRequired = allowedPlanIds.length > 0;
        const allowedSet = new Set(allowedPlanIds);
        const memberships = (data.memberships || [])
            .filter(membership => {
                const planId = String(membership.plan?.id || "");
                return !planRequired || allowedSet.has(planId);
            })
            .map(membership => ({
                ...membership,
                label: buildMembershipLabel(membership)
            }));
        const plans = (data.plans || [])
            .filter(plan => !planRequired || allowedSet.has(String(plan.id)))
            .map(plan => ({
                ...plan,
                price: formatMoney(plan.priceCents, plan.currency)
            }));
        const hasEligibleMemberships = memberships.length > 0;
        const dropInAllowed = !planRequired;
        const disableMembershipSelect = !dropInAllowed && !hasEligibleMemberships;
        const planBlocked = planRequired && !hasEligibleMemberships;
        const needsWaiver = !state.context.user?.signedHealthView;
        const canBook = isBookable && !planBlocked && !needsWaiver;
        const bookLabel = canBook
            ? t("event.book", "Book now")
            : needsWaiver
                ? t("event.waiverCta", "Complete waiver")
                : planBlocked && isBookable
                    ? t("event.planRequiredShort", "Plan required")
                    : t("event.unavailable", "Not available");
        content = eventTemplate({
            ...event,
            start: formatDateTime(event.startUtc),
            availability: hasRemote
                ? `In-studio: ${available} left • Remote: ${remoteAvailable} left`
                : `${available} spots left`,
            price: formatMoney(event.priceCents, event.currency),
            memberships,
            plans,
            hasPlans: plans.length > 0,
            isBookable: canBook,
            bookLabel,
            statusLabel,
            statusClass: statusValue === "Cancelled" ? "pill-muted" : "pill-live",
            notice: bookingNotice || (planBlocked ? t("event.planRequired", "This class requires an eligible plan or pass.") : ""),
            error: state.context.error,
            hasRemote,
            inPersonSelected: !hasRemote || available > 0 || remoteAvailable <= 0,
            remoteSelected: hasRemote && available <= 0 && remoteAvailable > 0,
            waiverRequired: needsWaiver,
            dropInAllowed,
            planRequired,
            disableMembershipSelect
        });
    }

    if (route === "me") {
        const bookings = (data.bookings || []).map(booking => ({
            id: booking.id,
            status: booking.status,
            title: booking.instance?.seriesTitle || t("bookings.class", "Class"),
            start: formatDateTime(booking.instance?.startUtc),
            canCancel: booking.status === "Confirmed" || booking.status === 1
        }));
        content = bookingsTemplate({
            bookings,
            notice: notice === "booked"
                ? t("bookings.confirmed", "Booking confirmed.")
                : notice === "cancelled"
                    ? t("bookings.cancelled", "Booking cancelled.")
                    : ""
        });
    }

    if (route === "payments") {
        const payments = (data.payments || []).map(payment => ({
            amount: formatMoney(payment.amountCents, payment.currency),
            status: payment.status,
            date: formatDateTime(payment.createdAtUtc),
            provider: payment.provider
        }));
        content = paymentsTemplate({ payments });
    }

    if (route === "profile") {
        const profile = data.profile || {};
        const userLocale = profile.preferredLocale || "";
        const genderValue = (profile.gender || "").trim();
        const languages = [
            { value: "en", label: t("language.en", "English") },
            { value: "he", label: t("language.he", "Hebrew") }
        ];
        const languageOptions = [
            {
                value: "",
                label: t("profile.languageDefault", "Use studio default"),
                selected: !userLocale
            },
            ...languages.map(option => ({
                ...option,
                selected: option.value === userLocale
            }))
        ];
        const genderOptions = [
            { value: "", label: t("common.select", "Select"), selected: !genderValue },
            { value: "Male", label: t("gender.male", "Male"), selected: genderValue === "Male" },
            { value: "Female", label: t("gender.female", "Female"), selected: genderValue === "Female" }
        ];
        content = profileTemplate({
            ...profile,
            languageOptions,
            genderOptions,
            signedHealthView: profile.signedHealthView
        });
    }

    if (route === "waiver") {
        const profile = data.profile || {};
        const nameParts = splitName(profile.fullName || "");
        const firstName = profile.firstName || nameParts.firstName;
        const lastName = profile.lastName || nameParts.lastName;
        const genderValue = (profile.gender || "").trim();
        const genderOptions = [
            { value: "", label: t("common.select", "Select"), selected: !genderValue },
            { value: "Male", label: t("gender.male", "Male"), selected: genderValue === "Male" },
            { value: "Female", label: t("gender.female", "Female"), selected: genderValue === "Female" }
        ];
        content = waiverTemplate({
            ...profile,
            firstName,
            lastName,
            signatureName: profile.fullName || `${firstName} ${lastName}`.trim(),
            dateOfBirth: profile.dateOfBirth || "",
            genderOptions,
            signedHealthView: profile.signedHealthView
        });
    }

    root.innerHTML = layoutTemplate({
        title: titleMap[route] || "Letmein",
        subtitle: t("page.subtitle", "Reserve your next session"),
        content
    });

    document.querySelectorAll(".navbar a").forEach(link => {
        const routeName = link.getAttribute("data-route");
        if (routeName === route) {
            link.classList.add("active");
        }
    });

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await logout();
            const baseUrl = `${window.location.pathname}${window.location.search}`;
            window.location.href = baseUrl;
        });
    }

    bindRouteActions(route, data, state);
}

function bindAuthForms(defaultMode = "login") {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const modeButtons = document.querySelectorAll("[data-auth-mode]");

    if (!loginForm || !registerForm) return;

    const setMode = (mode) => {
        const isRegister = mode === "register";
        loginForm.classList.toggle("hidden", isRegister);
        registerForm.classList.toggle("hidden", !isRegister);
        modeButtons.forEach(btn => {
            const buttonMode = btn.getAttribute("data-auth-mode");
            btn.classList.toggle("active", buttonMode === mode);
        });
    };

    modeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.getAttribute("data-auth-mode") || "login";
            setMode(mode);
        });
    });

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const payload = {
            email: formData.get("email"),
            password: formData.get("password"),
            role: "customer",
            studioSlug: formData.get("studioSlug")
        };
        try {
            const result = await login(payload);
            const locale = resolveLocale(
                result?.user?.preferredLocale,
                result?.studio?.defaultLocale || "en",
                navigator.language
            );
            await setLocale("app", locale);
            actor.send({ type: "LOGIN_SUCCESS", output: result });
        } catch (error) {
            root.innerHTML = loginTemplate({ error: error.message, studioSlug: payload.studioSlug });
            bindAuthForms("login");
        }
    });

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(registerForm);
        const payload = {
            fullName: formData.get("fullName"),
            phone: formData.get("phone"),
            email: formData.get("email"),
            password: formData.get("password"),
            studioSlug: formData.get("studioSlug")
        };
        try {
            const result = await register(payload);
            const locale = resolveLocale(
                result?.user?.preferredLocale,
                result?.studio?.defaultLocale || "en",
                navigator.language
            );
            await setLocale("app", locale);
            actor.send({ type: "LOGIN_SUCCESS", output: result });
        } catch (error) {
            root.innerHTML = loginTemplate({ error: error.message, studioSlug: payload.studioSlug });
            bindAuthForms("register");
        }
    });

    setMode(defaultMode);
}

function bindRouteActions(route, data, state) {
    if (route === "schedule")
    {
        document.querySelectorAll("button[data-event]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-event");
                window.location.hash = `#/event/${id}`;
            });
        });
    }

    if (route === "event")
    {
        const button = document.getElementById("book-btn");
        const waiverBtn = document.getElementById("open-waiver");
        const needsWaiver = !state.context.user?.signedHealthView;
        if (waiverBtn) {
            waiverBtn.addEventListener("click", () => {
                window.location.hash = `#/waiver?return=event/${data.event?.id || ""}`;
            });
        }
        if (button) {
            button.addEventListener("click", async () => {
                if (needsWaiver) {
                    window.location.hash = `#/waiver?return=event/${data.event?.id || ""}`;
                    return;
                }
                const select = document.getElementById("membership-select");
                const membershipId = select?.value || null;
                const attendanceSelect = document.getElementById("attendance-select");
                const isRemote = attendanceSelect?.value === "remote";
                try {
                    await apiPost("/api/app/bookings", {
                        eventInstanceId: data.event.id,
                        membershipId: membershipId || null,
                        isRemote
                    });
                    window.location.hash = "#/me?notice=booked";
                } catch (error) {
                    if (error.message === "Health declaration required") {
                        window.location.hash = `#/waiver?return=event/${data.event?.id || ""}`;
                        return;
                    }
                    actor.send({ type: "REFRESH" });
                    showToast(error.message || "Unable to book session.", "error");
                }
            });
        }

        document.querySelectorAll("button[data-plan]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const planId = btn.getAttribute("data-plan");
                if (!planId) return;
                try {
                    await apiPost("/api/app/checkout", { planId, couponCode: null });
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || "Unable to complete payment.", "error");
                }
            });
        });
    }

    if (route === "me")
    {
        document.querySelectorAll("button[data-cancel]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-cancel");
                if (!window.confirm("Cancel this booking?")) return;
                await apiPost(`/api/app/bookings/${id}/cancel`, {});
                window.location.hash = "#/me?notice=cancelled";
            });
        });
    }

    if (route === "profile")
    {
        const profileForm = document.getElementById("profile-form");
        if (profileForm) {
            profileForm.addEventListener("submit", async (event) => {
                event.preventDefault();
                const formData = new FormData(profileForm);
                await apiPut("/api/app/me/profile", {
                    fullName: formData.get("fullName"),
                    email: formData.get("email"),
                    phone: formData.get("phone"),
                    gender: formData.get("gender") || null,
                    dateOfBirth: formData.get("dateOfBirth") || null,
                    idNumber: formData.get("idNumber"),
                    city: formData.get("city"),
                    address: formData.get("address"),
                    occupation: formData.get("occupation"),
                    preferredLocale: formData.get("preferredLocale")
                });
                const preferredLocale = formData.get("preferredLocale");
                const session = state.context.user || {};
                const studio = state.context.studio || {};
                const resolvedLocale = resolveLocale(preferredLocale, studio.defaultLocale || "en", navigator.language);
                await setLocale("app", resolvedLocale);
                actor.send({ type: "SET_SESSION", user: { ...session, preferredLocale } });
                actor.send({ type: "REFRESH" });
            });
        }
        const waiverBtn = document.getElementById("open-waiver");
        if (waiverBtn) {
            waiverBtn.addEventListener("click", () => {
                window.location.hash = "#/waiver?return=profile";
            });
        }
    }

    if (route === "waiver")
    {
        const waiverForm = document.getElementById("waiver-form");
        const openTermsBtn = document.getElementById("open-terms");
        const openPrivacyBtn = document.getElementById("open-privacy");
        const signatureCanvas = document.getElementById("waiver-signature");
        const signatureInput = waiverForm?.querySelector("[name=\"signatureDataUrl\"]") || null;
        const clearSignatureBtn = document.getElementById("clear-signature");
        const signaturePad = signatureCanvas && signatureInput
            ? setupSignaturePad(signatureCanvas, signatureInput, clearSignatureBtn)
            : null;
        if (openTermsBtn) {
            openTermsBtn.addEventListener("click", () => openLegalModal("terms"));
        }
        if (openPrivacyBtn) {
            openPrivacyBtn.addEventListener("click", () => openLegalModal("privacy"));
        }

        if (waiverForm) {
            waiverForm.addEventListener("submit", async (event) => {
                event.preventDefault();
                if (!waiverForm.reportValidity()) return;
                signaturePad?.sync();
                if (!signatureInput?.value) {
                    showToast(t("waiver.signature.required", "Signature is required."), "error");
                    return;
                }
                const formData = new FormData(waiverForm);
                const toBool = (value) => value === "yes";
                try {
                    await apiPost("/api/app/me/health-declaration", {
                        firstName: formData.get("firstName"),
                        lastName: formData.get("lastName"),
                        email: formData.get("email"),
                        phone: formData.get("phone"),
                        dateOfBirth: formData.get("dateOfBirth") || null,
                        idNumber: formData.get("idNumber"),
                        gender: formData.get("gender"),
                        city: formData.get("city"),
                        address: formData.get("address"),
                        occupation: formData.get("occupation"),
                        heardAbout: formData.get("heardAbout"),
                        marketingConsent: toBool(formData.get("marketingConsent")),
                        highBloodPressure: toBool(formData.get("highBloodPressure")),
                        diabetes: toBool(formData.get("diabetes")),
                        headaches: toBool(formData.get("headaches")),
                        asthma: toBool(formData.get("asthma")),
                        balanceIssues: toBool(formData.get("balanceIssues")),
                        neckBackShoulderIssues: toBool(formData.get("neckBackShoulderIssues")),
                        jointProblems: toBool(formData.get("jointProblems")),
                        spineProblems: toBool(formData.get("spineProblems")),
                        digestiveProblems: toBool(formData.get("digestiveProblems")),
                        earProblems: toBool(formData.get("earProblems")),
                        eyeProblems: toBool(formData.get("eyeProblems")),
                        chronicDisease: toBool(formData.get("chronicDisease")),
                        surgeries: toBool(formData.get("surgeries")),
                        menstrualProblems: toBool(formData.get("menstrualProblems")),
                        smoker: toBool(formData.get("smoker")),
                        pregnant: toBool(formData.get("pregnant")),
                        otherNotes: formData.get("otherNotes"),
                        acknowledged: formData.get("acknowledged") === "on",
                        agreeToTerms: formData.get("agreeToTerms") === "on",
                        signatureName: formData.get("signatureName"),
                        signatureType: "drawn",
                        signatureDataUrl: formData.get("signatureDataUrl"),
                        password: formData.get("password")
                    });
                    showToast(t("waiver.submitted", "Waiver submitted."), "success");
                    const session = state.context.user || {};
                    actor.send({ type: "SET_SESSION", user: { ...session, signedHealthView: true } });
                    const returnTo = getQueryParam("return") || "profile";
                    window.location.hash = `#/${returnTo}`;
                } catch (error) {
                    showToast(error.message || t("waiver.submitError", "Unable to submit waiver."), "error");
                }
            });
        }
    }
}

function normalizeStatusValue(value) {
    if (typeof value === "string") {
        return value;
    }
    return value === 1 ? "Cancelled" : "Scheduled";
}

function normalizeStatus(value) {
    const statusValue = normalizeStatusValue(value);
    if (statusValue === "Cancelled") {
        return t("status.cancelled", "Cancelled");
    }
    if (statusValue === "Scheduled") {
        return t("status.scheduled", "Scheduled");
    }
    return statusValue;
}

function buildMembershipLabel(membership) {
    const plan = membership.plan || {};
    const type = plan.type || "";
    if (type === "Unlimited" || type === 2) {
        return `${plan.name} (Unlimited)`;
    }
    if (type === "PunchCard" || type === 1) {
        return `${plan.name} (${membership.remainingUses || 0} left)`;
    }
    if (type === "WeeklyLimit" || type === 0) {
        return `${plan.name} (Weekly limit)`;
    }
    return plan.name || "Membership";
}

function splitName(fullName) {
    const trimmed = (fullName || "").trim();
    if (!trimmed) {
        return { firstName: "", lastName: "" };
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "" };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function groupScheduleItems(items) {
    const map = new Map();
    items.forEach(item => {
        if (!map.has(item.dateKey)) {
            map.set(item.dateKey, { label: item.dateLabel, items: [] });
        }
        map.get(item.dateKey).items.push(item);
    });
    return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(entry => entry[1]);
}

function toDateKeyLocal(value) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("he-IL", {
        weekday: "long",
        month: "short",
        day: "numeric"
    }).format(date);
}

actor.subscribe((state) => {
    render(state);
});

actor.start();

const appRoutes = new Set(["schedule", "event", "me", "payments", "profile", "waiver"]);

function parseHash(defaultRoute) {
    const hash = window.location.hash || `#/${defaultRoute}`;
    const cleaned = hash.replace(/^#\/?/, "");
    const [path] = cleaned.split("?");
    const parts = path.split("/").filter(Boolean);
    const route = parts[0] || defaultRoute;
    const params = {};
    if (route === "event" && parts[1]) {
        params.id = parts[1];
    }
    return { route, params };
}

function handleRouteChange() {
    const { route, params } = parseHash("schedule");
    const nextRoute = appRoutes.has(route) ? route : "schedule";
    actor.send({ type: "NAVIGATE", route: nextRoute, params });
}

window.addEventListener("hashchange", handleRouteChange);
handleRouteChange();






