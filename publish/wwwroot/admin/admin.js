import { createMachine, createActor, fromPromise, assign } from "xstate";
import Handlebars from "handlebars";
import { apiGet, apiPost, apiPut, apiDelete } from "../shared/api.js";
import { login, logout, getSession, loadSessionHint, consumeForceLogout } from "../shared/auth.js";
import { setLocale, t, resolveLocale, getStoredLocale } from "../shared/i18n.js";
import { compileTemplate } from "../shared/templates.js";
import { formatMoney, formatDateTime, getQueryParam, toDateInputValue } from "../shared/utils.js";

const root = document.getElementById("app");
const sessionHint = loadSessionHint();
Handlebars.registerHelper("t", (key, fallback) => t(key, fallback));
Handlebars.registerHelper("eq", (a, b) => a === b);
const debugEnabled = new URLSearchParams(window.location.search).has("debug")
    || localStorage.getItem("letmein.debug") === "1";
function debugLog(...args) {
    if (!debugEnabled) return;
    console.info("[admin]", ...args);
}

const ICON_OPTIONS = [
    "\u{1F9D8}",
    "\u{1F4AA}",
    "\u{1F525}",
    "\u{1F343}",
    "\u{1F31E}",
    "\u{1F300}",
    "\u{1F3B5}",
    "\u{26A1}",
    "\u{1F3C3}",
    "\u{1F93E}",
    "\u{1F3AF}",
    "\u{1F9E0}",
    "\u{2764}\u{FE0F}"
];

const TAG_COLOR_PALETTE = [
    "#F87171", "#FB923C", "#FBBF24", "#FACC15", "#A3E635", "#4ADE80", "#34D399", "#2DD4BF",
    "#22D3EE", "#38BDF8", "#60A5FA", "#818CF8", "#A78BFA", "#C084FC", "#E879F9", "#F472B6",
    "#FB7185", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981", "#14B8A6",
    "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899"
];

const layoutTemplate = compileTemplate("layout", `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo">
          {{#if logoUrl}}
            <img src="{{logoUrl}}" alt="{{studioName}} logo" />
          {{else}}
            <div class="brand-badge"></div>
          {{/if}}
        </div>
        <div class="brand-text">
          <div class="brand-name">{{studioName}}</div>
          <div class="brand-subtitle">{{t "brand.subtitle" "Studio admin"}}</div>
        </div>
        <button class="secondary sidebar-toggle icon-button" id="toggle-sidebar" aria-label="{{t "nav.menu" "Menu"}}">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z"/>
            </svg>
          </span>
          <span class="sr-only">{{t "nav.menu" "Menu"}}</span>
        </button>
      </div>
      <nav class="nav">
        <div class="nav-section">
          <a href="#/calendar" data-route="calendar" class="nav-group nav-header">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zm13 6H4v10h16V8z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.calendar" "Calendar"}}</span>
          </a>
          <a href="#/events" data-route="events" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4V6H7a4 4 0 0 0-4 4v1H1v-1a6 6 0 0 1 6-6h10V1zm-10 22l-4-4 4-4v3h10a4 4 0 0 0 4-4v-1h2v1a6 6 0 0 1-6 6H7v3z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.events" "Serieses"}}</span>
          </a>
          <a href="#/rooms" data-route="rooms" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 3h12a2 2 0 0 1 2 2v16h-2v-2H6v2H4V3zm2 2v12h8V5H6zm9 7h1v2h-1v-2z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.rooms" "Rooms"}}</span>
          </a>
        </div>
        <div class="nav-section">
          <a href="#/customers" data-route="customers" class="nav-group nav-header">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.67-8 5v3h16v-3c0-3.33-4.7-5-8-5z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.customers" "Customers"}}</span>
          </a>
        </div>
        <div class="nav-section">
          <div class="nav-group nav-header nav-header-static">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 9.7-8 10-4.5-.3-8-5-8-10V6l8-4z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            </span>
            <span class="nav-label">{{t "nav.section.admin" "Admin"}}</span>
          </div>
          <a href="#/reports" data-route="reports" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 20h16M6 16h2V8H6v8zm5 0h2V4h-2v12zm5 0h2v-6h-2v6z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.reports" "Reports"}}</span>
          </a>
          <a href="#/plans" data-route="plans" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2zm-2 8h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6zm4 2v2h6v-2H5z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.plans" "Plans"}}</span>
          </a>
          <a href="#/users" data-route="users" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.67-8 5v3h16v-3c0-3.33-4.7-5-8-5z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.users" "Team"}}</span>
          </a>
          <a href="#/payroll" data-route="payroll" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3c-5.52 0-10 1.79-10 4s4.48 4 10 4 10-1.79 10-4-4.48-4-10-4zm0 10c-5.52 0-10 1.79-10 4s4.48 4 10 4 10-1.79 10-4-4.48-4-10-4z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.payroll" "Payroll"}}</span>
          </a>
          <a href="#/billing" data-route="billing" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 14h4" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            </span>
            <span class="nav-label">{{t "nav.billing" "Billing"}}</span>
          </a>
          <a href="#/invoices" data-route="invoices" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 13h8M8 17h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </span>
            <span class="nav-label">{{t "nav.invoices" "Invoices"}}</span>
          </a>
          <a href="#/audit" data-route="audit" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 2h6a2 2 0 0 1 2 2h3v18H4V4h3a2 2 0 0 1 2-2zm0 4h6V4H9v2zm-1 9l2 2 4-4 1.5 1.5L10 19l-3.5-3.5L8 15z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.audit" "Audit log"}}</span>
          </a>
          <a href="#/settings" data-route="settings" class="nav-item">
            <span class="nav-short" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M19.4 13a7.96 7.96 0 0 0 .1-1 7.96 7.96 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.42 7.42 0 0 0-1.7-1L15 2h-6l-.3 2.9c-.6.2-1.2.6-1.7 1l-2.5-1-2 3.4L4.6 11a7.96 7.96 0 0 0-.1 1 7.96 7.96 0 0 0 .1 1L2.5 14.6l2 3.4 2.5-1c.5.4 1.1.8 1.7 1L9 22h6l.3-2.9c.6-.2 1.2-.6 1.7-1l2.5 1 2-3.4L19.4 13zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z"/></svg>
            </span>
            <span class="nav-label">{{t "nav.settings" "Settings"}}</span>
          </a>
        </div>
      </nav>
      <footer class="sidebar-footer">
        <div class="user-card" id="user-profile-card">
          <div class="user-avatar">
            {{#if userAvatarUrl}}
              <img src="{{userAvatarUrl}}" alt="{{userName}} avatar" />
            {{else}}
              {{userInitials}}
            {{/if}}
          </div>
          <div class="user-meta">
            <div class="user-name">{{userName}}</div>
            <div class="user-role">{{userRolesLabel}}</div>
            <div class="user-email">{{userEmail}}</div>
          </div>
        </div>
        <button class="icon-button logout-btn" id="logout-btn" aria-label="{{t "nav.logout" "Log out"}}">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M10 17l5-5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M15 12H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
        </button>
        <div class="tag">{{t "nav.demo" "Demo mode enabled"}}</div>
      </footer>
    </aside>
    <main class="main">
      <div class="topbar">
        <div>
          <h1>{{title}}</h1>
          <div class="muted">{{subtitle}}</div>
        </div>
      </div>
      <div class="surface">
        {{{content}}}
      </div>
    </main>
  </div>
  <div class="toast-root" id="toast-root"></div>
`);

const loginTemplate = compileTemplate("login", `
  <div class="login-shell">
    <div class="login-card">
      <h1>{{t "login.title" "Welcome back"}}</h1>
      <p>{{t "login.subtitle" "Run ops for your studio in one place."}}</p>
      {{#if error}}
        <div class="notice">{{error}}</div>
      {{/if}}
      <form id="login-form">
        <label>{{t "login.email" "Email"}}</label>
        <input type="email" name="email" required value="admin@letmein.local" />
        <label>{{t "login.password" "Password"}}</label>
        <input type="password" name="password" required value="admin123" />
        <label>{{t "login.studioSlug" "Studio slug"}}</label>
        <input type="text" name="studioSlug" required value="{{studioSlug}}" />
        <label>{{t "login.role" "Role"}}</label>
        <select name="role">
          <option value="admin">{{t "login.role.admin" "Admin"}}</option>
          <option value="staff">{{t "login.role.staff" "Staff"}}</option>
        </select>
        <div style="margin-top:16px;">
          <button type="submit">{{t "login.submit" "Log in"}}</button>
        </div>
      </form>
    </div>
  </div>
`);

const calendarTemplate = compileTemplate("calendar", `
  <div class="calendar-toolbar">
    <div class="calendar-grid">
      <div class="calendar-actions-row">
        <div class="calendar-actions-main">
          <input type="search" id="calendar-search" placeholder="{{t "calendar.search" "Search sessions"}}" value="{{search}}" />
          <div class="calendar-export" aria-label="{{t "calendar.export" "Export"}}">
          <button class="icon-button export-btn" data-export="outlook" title="{{t "calendar.exportOutlook" "Outlook (.ics)"}}" aria-label="{{t "calendar.exportOutlook" "Outlook (.ics)"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zm13 8H4v10h16V10z"/></svg>
            </span>
            <span class="sr-only">{{t "calendar.exportOutlook" "Outlook (.ics)"}}</span>
          </button>
          <button class="icon-button export-btn" data-export="excel" title="{{t "calendar.exportExcel" "Excel (.csv)"}}" aria-label="{{t "calendar.exportExcel" "Excel (.csv)"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 3h12l4 4v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm11 1v4h4M7 9l2 3-2 3h2l1-2 1 2h2l-2-3 2-3h-2l-1 2-1-2H7z"/></svg>
            </span>
            <span class="sr-only">{{t "calendar.exportExcel" "Excel (.csv)"}}</span>
          </button>
          </div>
          <button id="add-session">
            <span class="icon" aria-hidden="true">+</span>
            {{t "calendar.addSession" "Add session"}}
          </button>
        </div>
        <div class="calendar-nav">
          <button class="icon-button nav-arrow" data-nav="prev" aria-label="{{t "calendar.prev" "Prev"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
            </span>
          </button>
          <input type="date" class="date-input" id="calendar-date" value="{{focusDateValue}}" />
          <button class="icon-button nav-arrow" data-nav="next" aria-label="{{t "calendar.next" "Next"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
            </span>
          </button>
          <button class="secondary" id="calendar-today">{{t "calendar.today" "Today"}}</button>
        </div>
          <div class="calendar-views-stack">
            <div class="calendar-views">
              <button class="secondary view-btn {{#if isDay}}active{{/if}}" data-view="day">
                <span class="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zm13 6H4v10h16V8z"/></svg>
                </span>
                {{t "calendar.day" "Day"}}
              </button>
            <button class="secondary view-btn {{#if isWeek}}active{{/if}}" data-view="week">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2zm-2 6h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6zm4 2v2h4v-2H5zm6 0v2h4v-2h-4zm6 0v2h2v-2h-2z"/></svg>
              </span>
              {{t "calendar.week" "Week"}}
            </button>
            <button class="secondary view-btn {{#if isMonth}}active{{/if}}" data-view="month">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v3H2V6a2 2 0 0 1 2-2h3V2zm15 9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9z"/></svg>
              </span>
              {{t "calendar.month" "Month"}}
            </button>
              <button class="secondary view-btn {{#if isList}}active{{/if}}" data-view="list">
                <span class="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 6h3v3H4V6zm5 1h11v1H9V7zm-5 6h3v3H4v-3zm5 1h11v1H9v-1zm-5 6h3v3H4v-3zm5 1h11v1H9v-1z"/></svg>
                </span>
                {{t "calendar.list" "List"}}
              </button>
            </div>
            <div class="calendar-range">
              {{#if weekNumberLabel}}<span class="calendar-week-number">{{weekNumberLabel}}</span>{{/if}}
              <span>{{rangeLabel}}</span>
            </div>
          </div>
      </div>
    </div>
  </div>
  <div class="calendar-body">
    {{#if isDay}}
      <div class="calendar-day-view calendar-time-grid" style="--hour-count: {{hourCount}}">
        <div class="calendar-hours">
          {{#each hourTicks}}
            <div class="calendar-hour">{{this}}</div>
          {{/each}}
        </div>
        <div class="calendar-day calendar-dropzone" data-date="{{day.dateKey}}">
          <div class="calendar-day-header">{{day.label}}</div>
          {{#if day.hasEvents}}
            <div class="calendar-events">
              {{#each day.events}}
                <div class="calendar-event {{#if isAllDay}}all-day{{else}}timed{{/if}} {{#if isCancelled}}cancelled{{/if}} {{#if isPast}}past{{/if}} {{#if isHoliday}}holiday{{/if}} {{#if isBirthday}}birthday{{/if}} {{#if hasBirthdayList}}has-birthday-list{{/if}} {{#unless suppressActions}}has-rail{{/unless}}" data-event="{{id}}" data-birthday-names="{{birthdayNamesJson}}" data-birthday-contacts="{{birthdayContactsJson}}" data-birthday-label="{{birthdayDateLabel}}" {{#unless isLocked}}draggable="true"{{/unless}} style="{{eventStyle}}">
                  {{#unless suppressActions}}
                    <div class="event-actions-rail" aria-label="{{t "calendar.actions" "Actions"}}">
                      <button class="event-actions" type="button" aria-label="{{t "calendar.actions" "Actions"}}">
                        <span class="icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="19" cy="12" r="2"></circle>
                          </svg>
                        </span>
                      </button>
                      <button class="event-share" type="button" aria-label="{{t "calendar.actionShare" "Share"}}">
                        <span class="icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-7.1 4.13a3 3 0 0 0-2.17-1 3 3 0 1 0 2.17 5l7.1 4.13A3 3 0 1 0 15 16a3 3 0 0 0 .17 1l-7.1-4.13a3 3 0 0 0 0-2.74l7.1-4.13A3 3 0 0 0 18 8z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                        </span>
                      </button>
                    </div>
                  {{/unless}}
                <div class="event-title">
                  {{#if seriesIcon}}<span class="event-icon-inline" aria-hidden="true">{{seriesIcon}}</span>{{/if}}
                  {{seriesTitle}}
                  {{#if hasBirthdayList}}
                    <span class="birthday-chevron" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>
                    </span>
                  {{/if}}
                </div>
                {{#if timeRange}}
                  <div class="event-time">{{timeRange}}</div>
                {{/if}}
                <div class="event-meta">{{roomSummary}}</div>
                <div class="event-meta">{{instructorName}}</div>
                {{#if isCancelled}}
                  <div class="event-meta">{{t "calendar.cancelled" "Cancelled"}}</div>
                {{/if}}
                  {{#if isBirthday}}
                    <div class="event-meta">{{t "calendar.birthday" "Birthday"}}</div>
                  {{/if}}
                </div>
              {{/each}}
            </div>
          {{else}}
            <div class="empty-state">{{t "calendar.empty.day" "No classes scheduled."}}</div>
          {{/if}}
        </div>
      </div>
    {{/if}}
    {{#if isWeek}}
      <div class="calendar-week calendar-time-grid" style="--hour-count: {{hourCount}}">
        <div class="calendar-hours">
          {{#each hourTicks}}
            <div class="calendar-hour">{{this}}</div>
          {{/each}}
        </div>
        {{#each week.days}}
          <div class="calendar-day-column calendar-dropzone {{#if isToday}}today{{/if}}" data-date="{{dateKey}}">
            <div class="calendar-day-label">
              <span>{{weekday}}</span>
              <span class="date">{{dateLabel}}</span>
            </div>
            {{#if hasEvents}}
              <div class="calendar-day-events">
                {{#each events}}
                  <div class="calendar-event compact {{#if isAllDay}}all-day{{else}}timed{{/if}} {{#if isCancelled}}cancelled{{/if}} {{#if isPast}}past{{/if}} {{#if isHoliday}}holiday{{/if}} {{#if isBirthday}}birthday{{/if}} {{#if hasBirthdayList}}has-birthday-list{{/if}} {{#unless suppressActions}}has-rail{{/unless}}" data-event="{{id}}" data-birthday-names="{{birthdayNamesJson}}" data-birthday-contacts="{{birthdayContactsJson}}" data-birthday-label="{{birthdayDateLabel}}" {{#unless isLocked}}draggable="true"{{/unless}} style="{{eventStyle}}">
                    {{#unless suppressActions}}
                      <div class="event-actions-rail" aria-label="{{t "calendar.actions" "Actions"}}">
                        <button class="event-actions" type="button" aria-label="{{t "calendar.actions" "Actions"}}">
                          <span class="icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                              <circle cx="5" cy="12" r="2"></circle>
                              <circle cx="12" cy="12" r="2"></circle>
                              <circle cx="19" cy="12" r="2"></circle>
                            </svg>
                          </span>
                        </button>
                        <button class="event-share" type="button" aria-label="{{t "calendar.actionShare" "Share"}}">
                          <span class="icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-7.1 4.13a3 3 0 0 0-2.17-1 3 3 0 1 0 2.17 5l7.1 4.13A3 3 0 1 0 15 16a3 3 0 0 0 .17 1l-7.1-4.13a3 3 0 0 0 0-2.74l7.1-4.13A3 3 0 0 0 18 8z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                          </span>
                        </button>
                      </div>
                    {{/unless}}
                    <div class="event-title">
                      {{#if seriesIcon}}<span class="event-icon-inline" aria-hidden="true">{{seriesIcon}}</span>{{/if}}
                      {{seriesTitle}}
                      {{#if hasBirthdayList}}
                        <span class="birthday-chevron" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>
                        </span>
                      {{/if}}
                    </div>
                    {{#if timeRange}}
                      <div class="event-time">{{timeRange}}</div>
                    {{/if}}
                    <div class="event-meta">{{roomSummary}}</div>
                    <div class="event-meta">{{instructorName}}</div>
                  </div>
                {{/each}}
              </div>
            {{else}}
              <div class="empty-slot">{{t "calendar.empty.week" "No classes"}}</div>
            {{/if}}
          </div>
        {{/each}}
      </div>
    {{/if}}
    {{#if isMonth}}
      <div class="calendar-month">
        <div class="calendar-weekdays">
          {{#each month.weekdays}}
            <div>{{this}}</div>
          {{/each}}
        </div>
        <div class="calendar-month-grid">
          {{#each month.weeks}}
            {{#each days}}
              <div class="calendar-month-day calendar-dropzone {{#unless isCurrentMonth}}muted{{/unless}} {{#if isToday}}today{{/if}}" data-date="{{dateKey}}">
                <div class="date-number">{{label}}</div>
                {{#if hasEvents}}
                  <div class="calendar-month-events">
                    {{#each eventsPreview}}
                      <div class="calendar-event mini {{#if isCancelled}}cancelled{{/if}} {{#if isPast}}past{{/if}} {{#if isHoliday}}holiday{{/if}} {{#if isBirthday}}birthday{{/if}} {{#if hasBirthdayList}}has-birthday-list{{/if}}" data-event="{{id}}" data-birthday-names="{{birthdayNamesJson}}" data-birthday-contacts="{{birthdayContactsJson}}" data-birthday-label="{{birthdayDateLabel}}" {{#unless isLocked}}draggable="true"{{/unless}} style="{{eventStyle}}">
                        <span class="event-title">
                          {{#if seriesIcon}}<span class="event-icon-inline" aria-hidden="true">{{seriesIcon}}</span>{{/if}}
                          {{title}}
                          {{#if hasBirthdayList}}
                            <span class="birthday-chevron" aria-hidden="true">
                              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>
                            </span>
                          {{/if}}
                        </span>
                        {{#if seriesIcon}}<span class="event-icon-corner" aria-hidden="true">{{seriesIcon}}</span>{{/if}}
                      </div>
                    {{/each}}
                    {{#if moreCount}}
                      <div class="more-events">+{{moreCount}} {{t "calendar.more" "more"}}</div>
                    {{/if}}
                  </div>
                {{/if}}
              </div>
            {{/each}}
          {{/each}}
        </div>
      </div>
    {{/if}}
    {{#if isList}}
      <div class="calendar-list">
        {{#if list.hasItems}}
          <table class="table">
            <thead>
              <tr>
                <th>{{t "calendar.list.date" "Date"}}</th>
                <th>{{t "calendar.list.time" "Time"}}</th>
                <th>{{t "calendar.list.class" "Class"}}</th>
                <th>{{t "calendar.list.room" "Room"}}</th>
                <th>{{t "calendar.list.instructor" "Instructor"}}</th>
                <th>{{t "calendar.list.booked" "Booked"}}</th>
              </tr>
            </thead>
            <tbody>
              {{#each list.items}}
              <tr class="{{#if isHoliday}}holiday-row{{/if}} {{#if isBirthday}}birthday-row{{/if}}" data-event="{{id}}" data-birthday-names="{{birthdayNamesJson}}" data-birthday-contacts="{{birthdayContactsJson}}" data-birthday-label="{{birthdayDateLabel}}">
                <td>{{dateLabel}}</td>
                <td>{{timeRange}}</td>
                <td>
                  <div class="event-title">
                    {{#if seriesIcon}}<span class="event-icon">{{seriesIcon}}</span>{{/if}}
                    {{seriesTitle}}
                    {{#if isHoliday}}<span class="customer-tag">{{t "calendar.holiday" "Holiday"}}</span>{{/if}}
                    {{#if isBirthday}}<span class="customer-tag">{{t "calendar.birthday" "Birthday"}}</span>{{/if}}
                  </div>
                </td>
                <td>{{roomName}}</td>
                <td>{{instructorName}}</td>
                <td>{{bookedSummary}}</td>
              </tr>
              {{/each}}
            </tbody>
          </table>
        {{else}}
          <div class="empty-state">{{t "calendar.empty.list" "No sessions found."}}</div>
        {{/if}}
      </div>
    {{/if}}
  </div>
  <div class="calendar-stats">
    <div class="stat-card">
      <div class="stat-label">{{t "calendar.stats.weekSessions" "Week's sessions"}}</div>
      <div class="stat-value">{{stats.weekSessions}}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">{{t "calendar.stats.registrations" "Registrations"}}</div>
      <div class="stat-value">{{stats.registrations}}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">{{t "calendar.stats.newRegistrations" "New registrations (this week)"}}</div>
      <div class="stat-value">{{stats.newRegistrations}}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">{{t "calendar.stats.strongestSession" "Strongest session"}}</div>
      <div class="stat-value">{{stats.strongestSession}}</div>
    </div>
  </div>
`);
const rosterTemplate = compileTemplate("roster", `
  <div class="roster-actions">
    <label class="checkbox roster-select-all">
      <input type="checkbox" id="roster-select-all" />
      {{t "roster.selectAll" "Select all"}}
    </label>
    <div class="roster-actions-buttons">
      <button class="secondary" id="roster-email">{{t "roster.emailShort" "Send Email"}}</button>
      <button class="secondary" id="roster-sms">{{t "roster.smsShort" "Send SMS"}}</button>
    </div>
  </div>
  {{#if roster.length}}
    <table class="table roster-table">
      <thead>
        <tr>
          <th></th>
          <th>{{t "roster.customer" "Customer"}}</th>
          <th>{{t "roster.email" "Email"}}</th>
          <th>{{t "roster.booking" "Booking"}}</th>
          <th>{{t "roster.attendance" "Attendance"}}</th>
          <th>{{t "roster.actions" "Actions"}}</th>
        </tr>
      </thead>
      <tbody>
        {{#each roster}}
        <tr>
          <td>
            <input type="checkbox" data-roster-select="{{customerId}}" />
          </td>
          <td>
            <div class="customer-cell">
              <div class="customer-name">
                {{customerName}}
                {{#if isBirthday}}
                  <span class="birthday-badge" title="{{t "roster.birthday" "Birthday"}}">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8z"/>
                      <path d="M4 10h16v2H4z"/>
                      <path d="M9 7c0-1.1.9-2 2-2 .6 0 1.1.2 1.5.6.4-.4.9-.6 1.5-.6 1.1 0 2 .9 2 2 0 1.2-1 2.2-3.5 3.6C10 9.2 9 8.2 9 7z"/>
                    </svg>
                  </span>
                {{/if}}
                {{#if isRemote}}<span class="customer-tag">{{t "roster.remote" "Remote"}}</span>{{/if}}
              </div>
              <div class="contact-actions">
                {{#if hasPhone}}
                  <a class="contact-icon phone" href="{{phoneLink}}" title="Call" aria-label="Call {{customerName}}">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.1.8.3 1.57.6 2.3a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.77-1.15a2 2 0 0 1 2.11-.45c.73.3 1.5.5 2.3.6A2 2 0 0 1 22 16.9z"/>
                    </svg>
                  </a>
                {{else}}
                  <span class="contact-icon disabled">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.1.8.3 1.57.6 2.3a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.77-1.15a2 2 0 0 1 2.11-.45c.73.3 1.5.5 2.3.6A2 2 0 0 1 22 16.9z"/>
                    </svg>
                  </span>
                {{/if}}
                {{#if hasEmail}}
                  <a class="contact-icon email" href="{{emailLink}}" title="Email" aria-label="Email {{customerName}}">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2"/>
                      <path d="M3 7l9 6 9-6"/>
                    </svg>
                  </a>
                {{else}}
                  <span class="contact-icon disabled">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2"/>
                      <path d="M3 7l9 6 9-6"/>
                    </svg>
                  </span>
                {{/if}}
                {{#if hasWhatsapp}}
                  <a class="contact-icon whatsapp" href="{{whatsappLink}}" target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp {{customerName}}">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 11.5a8.5 8.5 0 1 1-4.2-7.3A8.5 8.5 0 0 1 21 11.5z"/>
                      <path d="M7 19l1-3"/>
                    </svg>
                  </a>
                {{else}}
                  <span class="contact-icon disabled">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 11.5a8.5 8.5 0 1 1-4.2-7.3A8.5 8.5 0 0 1 21 11.5z"/>
                      <path d="M7 19l1-3"/>
                    </svg>
                  </span>
                {{/if}}
                {{#if hasPhone}}
                  <a class="contact-icon sms" href="{{smsLink}}" title="SMS" aria-label="SMS {{customerName}}">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>
                    </svg>
                  </a>
                {{else}}
                  <span class="contact-icon disabled">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>
                    </svg>
                  </span>
                {{/if}}
              </div>
            </div>
          </td>
          <td>{{email}}</td>
          <td>{{bookingStatusLabel}}</td>
          <td>
            {{#if isCancelled}}
              <span class="muted">{{t "roster.cancelled" "Cancelled"}}</span>   
            {{else}}
              <div class="attendance-toggle" data-attendance="{{customerId}}">
                <button type="button" class="attendance-btn {{#if isRegistered}}active{{/if}}" data-status="Registered" aria-label="{{t "roster.status.registered" "Registered"}}" title="{{t "roster.status.registered" "Registered"}}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2" />
                    <path d="M8 12h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
                <button type="button" class="attendance-btn {{#if isPresent}}active{{/if}}" data-status="Present" aria-label="{{t "roster.status.present" "Present"}}" title="{{t "roster.status.present" "Present"}}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 12.5l4 4 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button type="button" class="attendance-btn {{#if isNoShow}}active{{/if}}" data-status="NoShow" aria-label="{{t "roster.status.noshow" "No-show"}}" title="{{t "roster.status.noshow" "No-show"}}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7l-10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            {{/if}}
          </td>
          <td>
            {{#if canRemove}}
              <button type="button" class="icon-button roster-remove" data-remove-booking="{{bookingId}}" data-customer-name="{{customerName}}" aria-label="{{t "roster.remove" "Remove"}} {{customerName}}" title="{{t "roster.remove" "Remove"}}">
                <span class="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </span>
              </button>
            {{/if}}
          </td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  {{else}}
    <div class="empty-state">{{t "roster.empty" "No registrations yet."}}</div>
  {{/if}}
`);

const calendarModalTemplate = compileTemplate("calendar-modal", `
  <div class="modal-overlay" id="calendar-modal">
    <div class="modal modal-scroll">
      <div class="modal-header">
        <div>
          <h3>{{seriesTitle}}</h3>
          <div class="muted">{{startLabel}} ({{timeRange}})</div>
          <div class="meta">
            <span>{{roomName}}</span>
            {{#if instructorName}}
              <span class="meta-sep"> - </span>
              {{#if hasInstructorDetails}}
                <button class="link-button" type="button" id="open-instructor">{{instructorName}}</button>
              {{else}}
                <span>{{instructorName}}</span>
              {{/if}}
            {{/if}}
          </div>
          {{#if hasDescription}}
            <button class="link-button" type="button" id="open-description">{{t "session.descriptionLink" "View description"}}</button>
          {{/if}}
          <div class="meta" data-capacity-summary>{{capacitySummary}}</div>
        </div>
        <button class="modal-close" id="close-modal" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-body">
        <div class="session-header-fields">
          <div class="form-grid">
            <div class="span-2">
              <label>{{t "session.title" "Title"}}</label>
              <input name="title" value="{{seriesTitle}}" list="{{titleSuggestionId}}" />
              {{#if titleSuggestions.length}}
                <datalist id="{{titleSuggestionId}}">
                  {{#each titleSuggestions}}
                    <option value="{{this}}"></option>
                  {{/each}}
                </datalist>
              {{/if}}
            </div>
            <div class="span-2">
              <label>{{t "session.description" "Description"}}</label>
              <textarea name="description" rows="4" placeholder="{{t "series.descriptionHintPlain" "Add description"}}">{{seriesDescription}}</textarea>
            </div>
          </div>
        </div>
        <div class="form-grid">
            <div>
              <label>{{t "session.status" "Status"}}</label>
              <select name="status">
                {{#each statuses}}
                  <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
                {{/each}}
              </select>
            </div>
            <div>
              <label>{{t "session.startTime" "Start time"}}</label>
              <input type="text" class="time-input" name="startTimeLocal" value="{{startTimeLocal}}" inputmode="numeric" placeholder="HH:MM" />
            </div>
            <div>
              <label>{{t "session.duration" "Duration (min)"}}</label>
              <input type="number" name="durationMinutes" value="{{durationMinutes}}" />
            </div>
            <div>
              <label>{{t "session.room" "Room"}}</label>
              <select name="roomId">
                {{#each rooms}}
                  <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
                {{/each}}
              </select>
            </div>
            <div>
              <label>{{t "session.instructor" "Instructor"}}</label>
              <select name="instructorId">
                {{#each instructors}}
                  <option value="{{id}}" {{#if selected}}selected{{/if}}>{{displayName}}</option>
                {{/each}}
              </select>
            </div>
            <div>
              <label>{{t "session.icon" "Icon"}}</label>
              <div class="icon-field">
                <input type="hidden" name="icon" value="{{instanceIcon}}" />
                <button type="button" class="icon-button icon-picker-trigger icon-picker-button" data-icon-picker data-icon-target="[name=&quot;icon&quot;]" aria-label="{{t "session.pickIcon" "Pick icon"}}">
                  <span class="icon-preview" data-icon-preview>{{instanceIcon}}</span>
                  <span class="icon-fallback" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
                  </span>
                </button>
              </div>
              <div class="meta">{{t "session.iconHint" "Leave blank to use the series icon."}}</div>
            </div>
            <div>
              <label>{{t "session.color" "Color"}}</label>
              <div class="color-field" data-series-color="{{seriesColor}}">
                <input class="color-input" name="color" type="color" value="{{colorValue}}" />
              </div>
              <div class="meta">{{t "session.colorHint" "Leave blank to use the series color."}}</div>
            </div>
            <div>
              <label>{{t "session.capacity" "Capacity"}}</label>
              <input type="number" name="capacity" value="{{capacity}}" />      
            </div>
            <div>
              <label>{{t "session.remoteCapacity" "Remote capacity"}}</label>
              <input type="number" name="remoteCapacity" value="{{remoteCapacity}}" />
            </div>
            <div>
              <label>{{t "session.price" "Price"}}</label>
              <input type="number" step="0.01" name="price" value="{{price}}" />
            </div>
            <div>
              <label>{{t "session.zoomInvite" "Zoom invite link"}}</label>
              <input name="remoteInviteUrl" value="{{remoteInviteUrl}}" placeholder="https://zoom.us/j/..." />
            </div>
            <div>
              <label>{{t "session.category" "Category"}}</label>
              <select name="planCategoryId">
                {{#each planCategories}}
                  <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
                {{/each}}
              </select>
            </div>
            <div class="span-2">
              <label>{{t "series.allowedPlans" "Allowed plans"}}</label>
              <div class="plan-options">
                {{#each plans}}
                  <label class="plan-pill">
                    <input type="checkbox" name="instancePlanIds" value="{{id}}" {{#if selected}}checked{{/if}} />
                    <span>
                      <span class="plan-name">{{name}}</span>
                      <span class="plan-price">{{price}}</span>
                    </span>
                  </label>
                {{/each}}
              </div>
              <div class="meta">{{t "series.allowedPlansHint" "Leave empty to allow all plans + drop-ins."}}</div>
            </div>
          </div>
      </div>
      <div class="modal-footer">
        <div class="meta" data-booked-meta>{{capacitySummary}}</div>
        <div class="modal-actions">
          <button class="secondary" id="open-registrations">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="8.5" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M19 8v6M16 11h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            {{t "session.participantsTitle" "Participants list"}}
          </button>
          <button class="secondary btn-danger" id="delete-session">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            {{t "session.delete" "Delete session"}}
          </button>
          <button class="secondary" id="duplicate-session">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="9" y="9" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M5 7V5h10" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M5 17V7" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
            </span>
            {{t "session.duplicate" "Duplicate"}}
          </button>
          {{#if eventSeriesId}}
            <button class="secondary btn-danger" id="delete-series">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </span>
              {{t "series.delete" "Delete series"}}
            </button>
          {{/if}}
          <button class="secondary" id="edit-series">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              </svg>
            </span>
            {{t "series.edit" "Edit series"}}
          </button>
          <button id="save-instance" class="primary-action">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            {{t "common.saveChanges" "Save changes"}}
          </button>
        </div>
      </div>
    </div>
  </div>
`);

const sessionRegistrationsModalTemplate = compileTemplate("session-registrations-modal", `
  <div class="modal-overlay" id="session-registrations-modal">
    <div class="modal modal-scroll">
      <div class="modal-header">
        <div>
          <h3>{{seriesTitle}}</h3>
          <div class="muted">{{startLabel}} ({{timeRange}})</div>
          <div class="meta">
            <span>{{roomName}}</span>
            {{#if instructorName}}
              <span class="meta-sep"> - </span>
              {{#if hasInstructorDetails}}
                <button class="link-button" type="button" id="open-instructor">{{instructorName}}</button>
              {{else}}
                <span>{{instructorName}}</span>
              {{/if}}
            {{/if}}
          </div>
        </div>
        <button class="modal-close" id="close-registrations" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-body">
        {{#if hasSessionDescription}}
          <div class="session-description">{{sessionDescription}}</div>
        {{/if}}
        <div class="registration-form">
          <h4 class="registration-title">{{t "session.registrationTitle" "Registration"}}</h4>
          <div class="form-grid">
            <div class="span-2">
              <div class="registration-lookup-row">
                <input name="customerLookup" list="customer-list" placeholder="{{t "session.findCustomerPlaceholder" "Start typing a name or email"}}" autocomplete="off" />
                <select name="attendanceType" class="attendance-select" aria-label="{{t "session.attendance" "Attendance"}}">
                  <option value="in-person">{{t "session.attendance.inPerson" "In-studio"}}</option>
                  {{#if hasRemoteCapacity}}
                    <option value="remote">{{t "session.attendance.remote" "Remote (Zoom)"}}</option>
                  {{/if}}
                </select>
              </div>
              <input type="hidden" name="customerId" />
              <datalist id="customer-list">
                {{#each customers}}
                  <option value="{{lookupLabel}}" data-customer-id="{{id}}"></option>
                {{/each}}
                {{#if addCustomerOption}}
                  <option value="{{addCustomerOption}}" data-add="true"></option>
                {{/if}}
              </datalist>
            </div>
          </div>
          <div class="modal-footer">
            <div class="modal-actions">
              <button id="register-customer">{{t "session.registerCustomer" "Register customer"}}</button>
            </div>
          </div>
        </div>
        <div class="registrations-header">
          <div>
            <h4>{{t "session.participantsTitle" "Participants list"}}</h4>
            <div class="meta" data-capacity-summary>{{capacitySummary}}</div>
          </div>
          <button class="secondary btn-icon" id="share-session-link" aria-label="{{t "calendar.actionShare" "Share"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-7.1 4.13a3 3 0 0 0-2.17-1 3 3 0 1 0 2.17 5l7.1 4.13A3 3 0 1 0 15 16a3 3 0 0 0 .17 1l-7.1-4.13a3 3 0 0 0 0-2.74l7.1-4.13A3 3 0 0 0 18 8z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            </span>
            {{t "calendar.actionShare" "Share"}}
          </button>
        </div>
        <div class="roster" data-roster-panel>
          {{{rosterHtml}}}
        </div>
      </div>
    </div>
  </div>
`);

const instructorModalTemplate = compileTemplate("instructor-modal", `
  <div class="modal-overlay" id="instructor-modal">
    <div class="modal modal-compact">
      <div class="modal-header">
        <div>
          <h3>{{displayName}}</h3>
          <div class="muted">{{t "instructor.subtitle" "Instructor details"}}</div>
        </div>
        <button class="modal-close" id="close-instructor" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="instructor-card">
        <div class="instructor-avatar">
          {{#if avatarUrl}}
            <img src="{{avatarUrl}}" alt="{{displayName}} avatar" />
          {{else}}
            <span>{{initials}}</span>
          {{/if}}
        </div>
        <div>
          <div class="instructor-name">{{displayName}}</div>
          {{#if bio}}
            <div class="muted">{{bio}}</div>
          {{/if}}
          <div class="contact-actions instructor-actions">
            {{#if hasPhone}}
              <a class="contact-icon phone" href="{{phoneLink}}" title="{{t "contact.call" "Call"}}" aria-label="{{t "contact.call" "Call"}} {{displayName}}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.1.8.3 1.57.6 2.3a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.77-1.15a2 2 0 0 1 2.11-.45c.73.3 1.5.5 2.3.6A2 2 0 0 1 22 16.9z"/>
                </svg>
              </a>
            {{/if}}
            {{#if hasEmail}}
              <a class="contact-icon email" href="{{emailLink}}" title="{{t "contact.email" "Email"}}" aria-label="{{t "contact.email" "Email"}} {{displayName}}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <path d="M3 7l9 6 9-6"/>
                </svg>
              </a>
            {{/if}}
            {{#if hasWhatsapp}}
              <a class="contact-icon whatsapp" href="{{whatsappLink}}" target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp {{displayName}}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 11.5a8.5 8.5 0 1 1-4.2-7.3A8.5 8.5 0 0 1 21 11.5z"/>
                  <path d="M7 19l1-3"/>
                </svg>
              </a>
            {{/if}}
            {{#if hasPhone}}
              <a class="contact-icon sms" href="{{smsLink}}" title="{{t "contact.sms" "SMS"}}" aria-label="{{t "contact.sms" "SMS"}} {{displayName}}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>
                </svg>
              </a>
            {{/if}}
          </div>
        </div>
      </div>
    </div>
  </div>
`);

const descriptionModalTemplate = compileTemplate("description-modal", `
  <div class="modal-overlay" id="description-modal">
    <div class="modal modal-compact">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{t "session.descriptionSubtitle" "Series description"}}</div>
        </div>
        <button class="modal-close" id="close-description" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="description-body">{{{html}}}</div>
    </div>
  </div>
`);

const birthdayModalTemplate = compileTemplate("birthday-modal", `
  <div class="modal-overlay" id="birthday-modal">
    <div class="modal modal-compact">
      <div class="modal-header">
        <div class="span-2">
          <h3>{{title}}</h3>
          {{#if subtitle}}
            <div class="muted">{{subtitle}}</div>
          {{/if}}
        </div>
        <button class="modal-close" id="close-birthday" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="birthday-actions">
        <button class="secondary btn-icon" id="birthday-email-all">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </span>
          {{t "birthday.emailAll" "Email"}}
        </button>
        <button class="secondary btn-icon" id="birthday-sms-all">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </span>
          {{t "birthday.smsAll" "SMS"}}
        </button>
      </div>
      <div class="birthday-list">
        {{#each contacts}}
          <div class="birthday-contact">
            <div class="birthday-name">{{name}}</div>
            <div class="contact-actions">
              {{#if email}}
                <button class="contact-icon email" type="button" data-birthday-email="{{email}}" data-birthday-name="{{name}}" aria-label="{{t "contact.email" "Email"}} {{name}}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                    <path d="M3 7l9 6 9-6"/>
                  </svg>
                </button>
              {{else}}
                <span class="contact-icon disabled">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                    <path d="M3 7l9 6 9-6"/>
                  </svg>
                </span>
              {{/if}}
              {{#if phone}}
                <button class="contact-icon sms" type="button" data-birthday-sms="{{phone}}" data-birthday-name="{{name}}" aria-label="{{t "contact.sms" "SMS"}} {{name}}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              {{else}}
                <span class="contact-icon disabled">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>
                  </svg>
                </span>
              {{/if}}
              {{#if whatsappLink}}
                <a class="contact-icon whatsapp" href="{{whatsappLink}}" target="_blank" rel="noreferrer" aria-label="WhatsApp {{name}}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 11.5a8.5 8.5 0 1 1-4.2-7.3A8.5 8.5 0 0 1 21 11.5z"/>
                    <path d="M7 19l1-3"/>
                  </svg>
                </a>
              {{else}}
                <span class="contact-icon disabled">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 11.5a8.5 8.5 0 1 1-4.2-7.3A8.5 8.5 0 0 1 21 11.5z"/>
                    <path d="M7 19l1-3"/>
                  </svg>
                </span>
              {{/if}}
            </div>
          </div>
        {{/each}}
      </div>
    </div>
  </div>
`);

const confirmModalTemplate = compileTemplate("confirm-modal", `
  <div class="modal-overlay" id="confirm-modal">
    <div class="modal modal-compact">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{message}}</div>
        </div>
        <button class="modal-close" id="close-confirm" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button class="secondary" id="confirm-cancel">{{cancelLabel}}</button>
          <button id="confirm-ok">{{confirmLabel}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const iconPickerTemplate = compileTemplate("icon-picker-modal", `
  <div class="modal-overlay" id="icon-picker-modal">
    <div class="modal modal-compact icon-picker-modal">
      <div class="modal-header">
        <div>
          <h3>{{t "session.pickIcon" "Pick icon"}}</h3>
          <div class="muted">{{t "session.pickIconHint" "Choose an icon for this session."}}</div>
        </div>
        <button class="modal-close" id="close-icon-picker" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="icon-grid">
        {{#each icons}}
          <button type="button" class="icon-option" data-icon="{{this}}">
            <span aria-hidden="true">{{this}}</span>
          </button>
        {{/each}}
      </div>
      <div class="modal-footer">
        <button class="secondary" id="clear-icon">{{t "common.clear" "Clear"}}</button>
      </div>
    </div>
  </div>
`);

const inviteEmailTemplate = compileTemplate("invite-email-modal", `
  <div class="modal-overlay" id="invite-email-modal">
    <div class="modal modal-compact modal-scroll">
      <div class="modal-header">
        <div>
          <h3>{{t "invite.emailTitle" "Send invite email"}}</h3>
          <div class="muted">{{t "invite.emailSubtitle" "Review and send the invite message."}}</div>
        </div>
        <button class="modal-close" id="close-invite-email" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="span-2">
            <label>{{t "invite.emailTo" "To"}}</label>
            <input name="inviteTo" value="{{email}}" disabled />
          </div>
          <div class="span-2">
            <label>{{t "invite.emailSubject" "Subject"}}</label>
            <input name="inviteSubject" value="{{subject}}" />
          </div>
          <div class="span-2">
            <label>{{t "invite.emailBody" "Message"}}</label>
            <textarea name="inviteBody" rows="8">{{body}}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button class="secondary" id="cancel-invite-email">{{t "common.cancel" "Cancel"}}</button>
          <button id="send-invite-email" class="primary-action">{{t "invite.emailSend" "Send email"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const emailComposerTemplate = compileTemplate("email-composer-modal", `
  <div class="modal-overlay" id="email-composer-modal">
    <div class="modal modal-scroll">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-email-composer" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-body">
        <div class="recipient-list">
          {{#each recipients}}
            <span class="recipient-pill">{{name}}{{#if email}}<span class="recipient-meta">{{email}}</span>{{/if}}</span>
          {{/each}}
        </div>
        <div class="form-grid">
          <div class="span-2">
            <label>{{t "email.subject" "Subject"}}</label>
            <input name="emailSubject" value="{{subject}}" />
          </div>
          <div class="span-2">
            <label>{{t "email.body" "Message"}}</label>
            <textarea name="emailBody" rows="6">{{body}}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button class="secondary" id="cancel-email-composer">{{t "common.cancel" "Cancel"}}</button>
          <button id="send-email-composer" class="primary-action">{{t "email.send" "Send email"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const smsComposerTemplate = compileTemplate("sms-composer-modal", `
  <div class="modal-overlay" id="sms-composer-modal">
    <div class="modal modal-scroll">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-sms-composer" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-body">
        <div class="recipient-list">
          {{#each recipients}}
            <span class="recipient-pill">{{name}}{{#if phone}}<span class="recipient-meta">{{phone}}</span>{{/if}}</span>
          {{/each}}
        </div>
        <div class="form-grid">
          <div class="span-2">
            <label>{{t "sms.body" "Message"}}</label>
            <textarea name="smsBody" rows="5">{{body}}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button class="secondary" id="cancel-sms-composer">{{t "common.cancel" "Cancel"}}</button>
          <button id="send-sms-composer" class="primary-action">{{t "sms.send" "Send SMS"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const sessionModalTemplate = compileTemplate("session-modal", `
  <div class="modal-overlay" id="session-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{t "session.addTitle" "Add session"}}</h3>
          <div class="muted">{{t "session.addSubtitle" "Create a one-time class or a recurring series."}}</div>
        </div>
        <button class="modal-close" id="close-session" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div>
          <label>{{t "session.type" "Type"}}</label>
          <select name="sessionType">
            <option value="one-time">{{t "session.type.oneTime" "One-time"}}</option>
            <option value="recurring">{{t "session.type.recurring" "Recurring"}}</option>
          </select>
        </div>
        <div>
          <label>{{t "session.title" "Title"}}</label>
          <input name="title" value="" list="{{titleSuggestionId}}" />
          {{#if titleSuggestions.length}}
            <datalist id="{{titleSuggestionId}}">
              {{#each titleSuggestions}}
                <option value="{{this}}"></option>
              {{/each}}
            </datalist>
          {{/if}}
        </div>
        <div class="span-2">
          <label>{{t "session.description" "Description"}}</label>
          <textarea name="description" rows="4" placeholder="{{t "series.descriptionHintPlain" "Add description"}}"></textarea>
        </div>
        <div>
          <label>{{t "session.instructor" "Instructor"}}</label>
          <select name="instructorId">
            <option value="">{{t "session.unassigned" "Unassigned"}}</option>
            {{#each instructors}}
              <option value="{{id}}">{{displayName}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "session.room" "Room"}}</label>
          <select name="roomId">
            <option value="">{{t "session.unassigned" "Unassigned"}}</option>
            {{#each rooms}}
              <option value="{{id}}">{{name}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "session.startTime" "Start time"}}</label>
            <input type="text" class="time-input" name="startTimeLocal" value="18:00" inputmode="numeric" placeholder="HH:MM" />
        </div>
        <div>
          <label>{{t "session.duration" "Duration (min)"}}</label>
          <input type="number" name="durationMinutes" value="60" />
        </div>
        <div>
          <label>{{t "session.capacity" "Capacity"}}</label>
          <input type="number" name="capacity" value="" />
        </div>
        <div>
          <label>{{t "session.remoteCapacity" "Remote capacity"}}</label>
          <input type="number" name="remoteCapacity" value="0" />
        </div>
        <div>
          <label>{{t "session.price" "Price"}}</label>
          <input type="number" step="0.01" name="price" value="" />
        </div>
        <div>
          <label>{{t "session.zoomInvite" "Zoom invite link"}}</label>
          <input name="remoteInviteUrl" placeholder="{{t "session.zoomInvitePlaceholder" "https://zoom.us/j/..."}}" />
        </div>
        <div>
          <label>{{t "session.category" "Category"}}</label>
          <select name="planCategoryId">
            {{#each planCategories}}
              <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "session.cancellationWindow" "Cancellation window (hours)"}}</label>
          <input type="number" name="cancellationWindowHours" value="" />
        </div>
        {{#if plans.length}}
        <div class="span-2">
          <label>{{t "session.allowedPlans" "Allowed plans"}}</label>
          <div class="plan-options">
            {{#each plans}}
              <label class="plan-pill">
                <input type="checkbox" name="sessionPlanIds" value="{{id}}" {{#if selected}}checked{{/if}} />
                <span>
                  <span class="plan-name">{{name}}</span>
                  <span class="plan-price">{{price}}</span>
                </span>
              </label>
            {{/each}}
          </div>
          <div class="meta">{{t "series.allowedPlansHint" "Leave empty to allow all plans + drop-ins."}}</div>
        </div>
        {{/if}}
      </div>
      <div class="form-grid session-one-time">
        <div>
          <label>{{t "session.date" "Date"}}</label>
          <input type="date" class="date-input" name="date" value="{{focusDateValue}}" />
        </div>
      </div>
      <div class="form-grid session-recurring hidden">
        <div>
          <label>{{t "session.startDate" "Start date"}}</label>
          <input type="date" class="date-input" name="startDate" value="{{focusDateValue}}" />
        </div>
        <div>
          <label>{{t "session.generateUntil" "Generate until"}}</label>
          <input type="date" class="date-input" name="generateUntil" value="{{generateUntilValue}}" />
        </div>
        <div class="span-2">
          <label>{{t "session.daysOfWeek" "Days of week"}}</label>
          <div class="weekday-pills">
            <label class="weekday-pill"><input type="checkbox" name="recurringDays" value="0" /><span>{{t "weekday.sunday" "Sunday"}}</span></label>
            <label class="weekday-pill"><input type="checkbox" name="recurringDays" value="1" /><span>{{t "weekday.monday" "Monday"}}</span></label>
            <label class="weekday-pill"><input type="checkbox" name="recurringDays" value="2" /><span>{{t "weekday.tuesday" "Tuesday"}}</span></label>
            <label class="weekday-pill"><input type="checkbox" name="recurringDays" value="3" /><span>{{t "weekday.wednesday" "Wednesday"}}</span></label>
            <label class="weekday-pill"><input type="checkbox" name="recurringDays" value="4" /><span>{{t "weekday.thursday" "Thursday"}}</span></label>
            <label class="weekday-pill"><input type="checkbox" name="recurringDays" value="5" /><span>{{t "weekday.friday" "Friday"}}</span></label>
            <label class="weekday-pill"><input type="checkbox" name="recurringDays" value="6" /><span>{{t "weekday.saturday" "Saturday"}}</span></label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "session.addHint" "Sessions appear on the calendar immediately."}}</div>
        <div class="modal-actions">
          <button id="save-session">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            {{t "session.create" "Create session"}}
          </button>
        </div>
      </div>
    </div>
  </div>
`);

const seriesModalTemplate = compileTemplate("series-modal", `
  <div class="modal-overlay" id="series-modal">
    <div class="modal modal-scroll">
      <div class="modal-header">
        <div>
          <h3>{{modalTitle}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-series" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" name="seriesId" value="{{seriesId}}" />
        <div class="form-grid">
          <div>
            <label>{{t "series.title" "Title"}}</label>
            <input name="title" value="{{titleValue}}" list="{{titleSuggestionId}}" />
            {{#if titleSuggestions.length}}
              <datalist id="{{titleSuggestionId}}">
                {{#each titleSuggestions}}
                  <option value="{{this}}"></option>
                {{/each}}
              </datalist>
            {{/if}}
          </div>
          <div>
            <label>{{t "series.icon" "Icon"}}</label>
            <div class="icon-field">
              <input type="hidden" name="icon" value="{{icon}}" />
              <button type="button" class="icon-button icon-picker-trigger icon-picker-button" data-icon-picker data-icon-target="[name=&quot;icon&quot;]" aria-label="{{t "session.pickIcon" "Pick icon"}}">
                <span class="icon-preview" data-icon-preview>{{icon}}</span>
                <span class="icon-fallback" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
                </span>
              </button>
            </div>
          </div>
          <div>
            <label>{{t "series.color" "Color"}}</label>
            <div class="color-field">
              <input class="color-input" name="color" type="color" value="{{color}}" />
            </div>
          </div>
        <div class="span-2">
          <label>{{t "series.daysOfWeek" "Days of week"}}</label>
          <div class="weekday-pills">
            {{#each dayOptions}}
              <label class="weekday-pill">
                <input type="checkbox" name="seriesDays" value="{{value}}" {{#if selected}}checked{{/if}} />
                <span>{{label}}</span>
              </label>
            {{/each}}
          </div>
        </div>
          <div>
            <label>{{t "series.startTime" "Start time"}}</label>
          <input type="text" class="time-input" name="startTimeLocal" value="{{startTimeLocal}}" inputmode="numeric" placeholder="HH:MM" />
          </div>
          <div>
            <label>{{t "series.duration" "Duration (min)"}}</label>
            <input type="number" name="durationMinutes" value="{{durationMinutes}}" />
          </div>
          <div>
            <label>{{t "series.capacity" "Capacity"}}</label>
            <input type="number" name="capacity" value="{{defaultCapacity}}" />
          </div>
          <div>
            <label>{{t "series.remoteCapacity" "Remote capacity"}}</label>
            <input type="number" name="remoteCapacity" value="{{remoteCapacity}}" />
          </div>
          <div>
            <label>{{t "series.price" "Price"}}</label>
            <input type="number" step="0.01" name="price" value="{{price}}" />
          </div>
          <div>
            <label>{{t "series.zoomInvite" "Zoom invite link"}}</label>
            <input name="remoteInviteUrl" value="{{remoteInviteUrl}}" placeholder="https://zoom.us/j/..." />
          </div>
          <div>
            <label>{{t "series.instructor" "Instructor"}}</label>
            <select name="instructorId">
              {{#each instructors}}
                <option value="{{id}}" {{#if selected}}selected{{/if}}>{{displayName}}</option>
              {{/each}}
            </select>
          </div>
          <div>
            <label>{{t "series.room" "Room"}}</label>
            <select name="roomId">
              {{#each rooms}}
                <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
              {{/each}}
            </select>
          </div>
          <div>
            <label>{{t "series.category" "Category"}}</label>
            <select name="planCategoryId">
              {{#each planCategories}}
                <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
              {{/each}}
            </select>
          </div>
          <div class="span-2">
            <label>{{t "series.description" "Description"}}</label>
            <textarea name="description" rows="4" placeholder="{{t "series.descriptionHintPlain" "Add description"}}">{{description}}</textarea>
          </div>
        <div>
          <label>{{t "series.generateUntil" "Generate until"}}</label>
          <input type="date" class="date-input" name="generateUntil" value="{{generateUntilValue}}" />
        </div>
          <div>
            <label>{{t "series.cancellationWindow" "Cancellation window (hours)"}}</label>
            <input type="number" name="cancellationWindowHours" value="{{cancellationWindowHours}}" />
          </div>
          <div>
            <label>{{t "series.active" "Active"}}</label>
            <select name="isActive">
              <option value="true" {{#if isActive}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
              <option value="false" {{#unless isActive}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            </select>
          </div>
        </div>
        <div class="plan-picker">
          <label>{{t "series.allowedPlans" "Allowed plans"}}</label>
          <div class="plan-options">
            {{#each plans}}
              <label class="plan-pill">
                <input type="checkbox" name="planIds" value="{{id}}" {{#if selected}}checked{{/if}} />
                <span>
                  <span class="plan-name">{{name}}</span>
                  <span class="plan-price">{{price}}</span>
                </span>
              </label>
            {{/each}}
          </div>
          <div class="meta">{{t "series.allowedPlansHint" "Leave empty to allow all plans + drop-ins."}}</div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "series.updateHint" "Series updates apply to future generated sessions."}}</div>
        <div class="modal-actions">
          <button id="save-series" class="primary-action">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            {{saveLabel}}
          </button>
        </div>
      </div>
    </div>
  </div>
`);

const customerModalTemplate = compileTemplate("customer-modal", `
  <div class="modal-overlay" id="customer-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-customer" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="customerId" value="{{customerId}}" />
      <div class="form-grid">
        <div>
          <label>{{t "customer.fullName" "Full name"}}</label>
          <input name="fullName" value="{{fullName}}" />
        </div>
        <div>
          <label>{{t "customer.email" "Email"}}</label>
          <input name="email" type="email" value="{{email}}" />
        </div>
        <div>
          <label>{{t "customer.phone" "Phone"}}</label>
          <input name="phone" type="tel" value="{{phone}}" />
        </div>
        <div>
          <label>{{t "customer.idNumber" "ID number"}}</label>
          <input name="idNumber" value="{{idNumber}}" />
        </div>
        <div>
          <label>{{t "customer.sex" "Sex"}}</label>
          <div class="sex-pills">
            {{#each genderOptions}}
              <label class="sex-pill">
                <input type="radio" name="gender" value="{{value}}" {{#if selected}}checked{{/if}} />
                <span>{{label}}</span>
              </label>
            {{/each}}
          </div>
        </div>
        <div>
          <label>{{t "customer.dateOfBirth" "Date of birth"}} {{#if ageLabel}}<span class="meta">({{ageLabel}})</span>{{/if}}</label>
          <input name="dateOfBirth" type="date" class="date-input" value="{{dateOfBirthValue}}" />
        </div>
        <div class="span-2 address-row">
          <div>
            <label>{{t "customer.city" "City"}}</label>
            <input name="city" value="{{city}}" />
          </div>
          <div>
            <label>{{t "customer.address" "Address"}}</label>
            <input name="address" value="{{address}}" />
          </div>
        </div>
        <div>
          <label>{{t "customer.profession" "Profession"}}</label>
          <input name="occupation" value="{{occupation}}" />
        </div>
        <div>
          <label>{{t "customer.signedHealth" "Signed health waiver"}}</label>   
          <select name="signedHealthView">
            <option value="false" {{#unless signedHealthView}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            <option value="true" {{#if signedHealthView}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
          </select>
        </div>
        <div>
          <label>{{t "customers.status" "Status"}}</label>
          <select name="statusId">
            {{#each statusOptions}}
              <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
            {{/each}}
          </select>
        </div>
        <div class="span-2">
          <label>{{t "customer.tags" "Tags"}}</label>
          <div class="tag-input" data-tag-input>
            <div class="tag-chips"></div>
            <input name="tagsInput" list="tag-suggestions" placeholder="{{t "customer.tagsPlaceholder" "e.g. VIP, trial, morning"}}" />
            <datalist id="tag-suggestions">
              {{#each tagSuggestions}}
                <option value="{{this}}"></option>
              {{/each}}
            </datalist>
          </div>
          <input type="hidden" name="tags" value="{{tags}}" />
        </div>
        <div>
          <label>{{t "customer.archived" "Archived"}}</label>
          <select name="isArchived">
            <option value="false" {{#unless isArchived}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            <option value="true" {{#if isArchived}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
          </select>
        </div>
      </div>
      <div class="attachments">
        <h4>{{t "customer.attachments" "Attachments"}}</h4>
        <div id="customer-attachments-list">
          {{{attachmentsHtml}}}
        </div>
        {{#if isEdit}}
        <div class="attachment-upload">
          <label class="attachment-dropzone" id="attachment-dropzone">
            <input name="attachmentFile" type="file" />
            <div class="dropzone-content">
              <div class="dropzone-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M19 15v4H5v-4H3v6h18v-6h-2zM11 3h2v8h3l-4 4-4-4h3z"/>
                </svg>
              </div>
              <div class="dropzone-title">{{t "customer.uploadDrop" "Drag & drop a file"}}</div>
              <div class="dropzone-subtitle">{{t "customer.uploadClick" "or click to browse"}}</div>
            </div>
          </label>
          <button class="secondary" id="upload-attachment">{{t "customer.upload" "Upload"}}</button>
        </div>
        {{else}}
        <div class="meta">{{t "customer.attachmentsHint" "Save the customer to upload attachments."}}</div>
        {{/if}}
      </div>
      <div class="modal-footer">
        <div class="meta">{{footerNote}}</div>
        <div class="modal-actions">
          {{#if isEdit}}
            <button class="secondary" id="reset-customer-password">{{t "customer.resetPassword" "Reset password"}}</button>
          {{/if}}
          <button id="save-customer">{{saveLabel}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const customerAttachmentsTemplate = compileTemplate("customer-attachments", `   
  {{#if hasAttachments}}
    <div class="attachments-list">
      {{#each attachments}}
        <div class="attachment-row">
          <div>
            <div class="attachment-name">{{fileName}}</div>
            <div class="meta">{{uploadedLabel}}</div>
          </div>
          <div class="attachment-actions">
            <a class="secondary" href="{{downloadUrl}}" target="_blank" rel="noreferrer">{{t "customer.download" "Download"}}</a>
            <button class="secondary" data-attachment-delete="{{id}}">{{t "common.delete" "Delete"}}</button>
          </div>
        </div>
      {{/each}}
    </div>
  {{else}}
    <div class="attachment-empty">
      <div class="attachment-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm9 1.5V11h5.5L13 5.5zM7 14h10v2H7v-2zm0 4h7v2H7v-2z"/>
        </svg>
      </div>
      <div class="attachment-empty-title">{{t "customer.attachmentsEmptyTitle" "No files yet"}}</div>
      <div class="meta">{{t "customer.attachmentsEmpty" "Upload waivers, forms, or notes here."}}</div>
    </div>
  {{/if}}
`);

const userAttachmentsTemplate = compileTemplate("user-attachments", `
  {{#if hasAttachments}}
    <div class="attachments-list">
      {{#each attachments}}
        <div class="attachment-row">
          <div>
            <div class="attachment-name">{{fileName}}</div>
            <div class="meta">{{uploadedLabel}}</div>
          </div>
          <div class="attachment-actions">
            <a class="secondary" href="{{downloadUrl}}" target="_blank" rel="noreferrer">{{t "user.download" "Download"}}</a>
            <button class="secondary" data-user-attachment-delete="{{id}}">{{t "common.delete" "Delete"}}</button>
          </div>
        </div>
      {{/each}}
    </div>
  {{else}}
    <div class="attachment-empty">
      <div class="attachment-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm9 1.5V11h5.5L13 5.5zM7 14h10v2H7v-2zm0 4h7v2H7v-2z"/>
        </svg>
      </div>
      <div class="attachment-empty-title">{{t "user.attachmentsEmptyTitle" "No files yet"}}</div>
      <div class="meta">{{t "user.attachmentsEmpty" "Upload agreements, IDs, or notes here."}}</div>
    </div>
  {{/if}}
`);

const customerStatusModalTemplate = compileTemplate("customer-status-modal", `
  <div class="modal-overlay" id="customer-status-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{t "customerStatus.title" "Customer statuses"}}</h3>
          <div class="muted">{{t "customerStatus.subtitle" "Define statuses and defaults for new customers."}}</div>
        </div>
        <button class="modal-close" id="close-statuses" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="statusId" value="{{statusId}}" />
      <div class="form-grid status-form">
        <div>
          <label>{{t "customerStatus.name" "Status name"}}</label>
          <input name="statusName" value="{{statusName}}" />
        </div>
        <div>
          <label>{{t "customerStatus.default" "Default"}}</label>
          <select name="statusDefault">
            <option value="false" {{#unless statusDefault}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            <option value="true" {{#if statusDefault}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
          </select>
        </div>
        <div>
          <label>{{t "customerStatus.active" "Active"}}</label>
          <select name="statusActive">
            <option value="true" {{#if statusActive}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
            <option value="false" {{#unless statusActive}}selected{{/unless}}>{{t "common.no" "No"}}</option>
          </select>
        </div>
      </div>
      <div class="modal-actions" style="margin-top:12px;">
        <button id="save-status">{{saveLabel}}</button>
        <button class="secondary" id="reset-status">{{t "customerStatus.new" "New status"}}</button>
      </div>
      <div style="margin-top:20px;">
        <table class="table">
          <thead>
            <tr>
              <th>{{t "customerStatus.name" "Status name"}}</th>
              <th>{{t "customerStatus.default" "Default"}}</th>
              <th>{{t "customerStatus.active" "Active"}}</th>
              <th>{{t "customerStatus.actions" "Actions"}}</th>
            </tr>
          </thead>
          <tbody>
            {{#each statuses}}
            <tr>
              <td>{{name}}</td>
              <td>{{defaultLabel}}</td>
              <td>{{activeLabel}}</td>
              <td>
                <button class="secondary btn-edit" data-status-edit="{{id}}">
                  <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  </span>
                  {{t "common.edit" "Edit"}}
                </button>
              </td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </div>
    </div>
  </div>
`);

const userModalTemplate = compileTemplate("user-modal", `
  <div class="modal-overlay" id="user-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-user" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="userId" value="{{userId}}" />
      <div class="form-grid">
        <div>
          <label>{{t "profile.displayName" "Display name"}}</label>
          <input name="displayName" value="{{displayName}}" />
        </div>
        <div>
          <label>{{t "profile.email" "Email"}}</label>
          <input name="email" type="email" value="{{email}}" />
        </div>
        <div>
          <label>{{t "user.phone" "Phone"}}</label>
          <input name="phone" type="tel" value="{{phone}}" />
        </div>
        <div>
          <label>{{t "user.sex" "Sex"}}</label>
          <select name="gender">
            {{#each genderOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "user.dateOfBirth" "Date of birth"}}</label>
          <input name="dateOfBirth" type="date" class="date-input" value="{{dateOfBirthValue}}" />
        </div>
        <div>
          <label>{{t "user.idNumber" "ID number"}}</label>
          <input name="idNumber" value="{{idNumber}}" />
        </div>
        <div class="span-2 address-row">
          <div>
            <label>{{t "user.city" "City"}}</label>
            <input name="city" value="{{city}}" />
          </div>
          <div>
            <label>{{t "user.address" "Address"}}</label>
            <input name="address" value="{{address}}" />
          </div>
        </div>
        <div>
          <label>{{t "profile.roles" "Roles"}}</label>
          <div class="role-options">
            {{#each roleOptions}}
              <label class="role-pill">
                <input type="checkbox" name="roles" value="{{value}}" {{#if checked}}checked{{/if}} />
                <span>{{label}}</span>
              </label>
            {{/each}}
          </div>
        </div>
        <div>
          <label>{{t "user.active" "Active"}}</label>
          <select name="isActive">
            <option value="true" {{#if isActive}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
            <option value="false" {{#unless isActive}}selected{{/unless}}>{{t "common.no" "No"}}</option>
          </select>
        </div>
        <div class="instructor-fields">
          <label>{{t "user.instructorName" "Instructor name"}}</label>
          <input name="instructorDisplayName" value="{{instructorDisplayName}}" placeholder="{{t "user.instructorNameHint" "Shown in schedules"}}" />
        </div>
        <div class="instructor-fields">
          <label>{{t "user.instructorBio" "Instructor bio"}}</label>
          <textarea name="instructorBio" rows="2" placeholder="{{t "user.instructorBioHint" "Short bio"}}">{{instructorBio}}</textarea>
        </div>
        <div class="instructor-fields">
          <label>{{t "user.instructorRate" "Payroll rate (NIS)"}}</label>
          <input name="instructorRate" type="number" min="0" step="0.01" value="{{instructorRate}}" />
        </div>
        <div class="instructor-fields">
          <label>{{t "user.instructorRateUnit" "Rate unit"}}</label>
          <select name="instructorRateUnit">
            {{#each rateUnitOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div class="instructor-fields">
          <label>{{t "user.instructorRateCurrency" "Rate currency"}}</label>
          <input name="instructorRateCurrency" value="{{instructorRateCurrency}}" readonly />
        </div>
      </div>
      <div class="attachments">
        <h4>{{t "user.attachments" "Attachments"}}</h4>
        <div id="user-attachments-list">
          {{{attachmentsHtml}}}
        </div>
        {{#if isEdit}}
        <div class="attachment-upload">
          <label class="attachment-dropzone" id="user-attachment-dropzone">
            <input name="userAttachmentFile" type="file" />
            <div class="dropzone-content">
              <div class="dropzone-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v6h-2V7a3 3 0 1 0-6 0v9a3 3 0 0 0 6 0v-1h2v1a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/></svg>
              </div>
              <div class="dropzone-title">{{t "user.attachmentsEmptyTitle" "Drop files here"}}</div>
              <div class="dropzone-subtitle">{{t "user.uploadDrop" "or click to select files"}}</div>
            </div>
          </label>
          <button class="secondary" id="upload-user-attachment">{{t "user.upload" "Upload"}}</button>
        </div>
        {{else}}
        <div class="meta">{{t "user.attachmentsHint" "Save the user to upload attachments."}}</div>
        {{/if}}
      </div>
      <div class="modal-footer">
        <div class="meta">{{footerNote}}</div>
        <div class="modal-actions">
          {{#if isEdit}}
            <button class="secondary" id="reset-user-password">{{t "user.resetPassword" "Reset password"}}</button>
          {{/if}}
          <button id="save-user">{{saveLabel}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const guestModalTemplate = compileTemplate("guest-modal", `
  <div class="modal-overlay" id="guest-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{t "guest.addTitle" "Add guest"}}</h3>
          <div class="muted">{{t "guest.addSubtitle" "Invite read-only viewers to the studio calendar."}}</div>
        </div>
        <button class="modal-close" id="close-guest" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div>
          <label>{{t "guest.name" "Guest name"}}</label>
          <input name="guestDisplayName" value="{{guestDisplayName}}" />
        </div>
        <div>
          <label>{{t "guest.email" "Guest email"}}</label>
          <input name="guestEmail" type="email" value="{{guestEmail}}" />
        </div>
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "guest.hint" "Guests can only view schedules in read-only mode."}}</div>
        <div class="modal-actions">
          <button id="save-guest">{{t "guest.create" "Create guest"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const roomModalTemplate = compileTemplate("room-modal", `
  <div class="modal-overlay" id="room-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-room" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="roomId" value="{{roomId}}" />
      <div class="form-grid">
        <div>
          <label>{{t "room.name" "Room name"}}</label>
          <input name="roomName" value="{{roomName}}" />
        </div>
        <div>
          <label>{{t "room.supportsRemote" "Supports remote"}}</label>
          <select name="roomSupportsRemote">
            <option value="false" {{#unless supportsRemote}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            <option value="true" {{#if supportsRemote}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
          </select>
        </div>
        <div class="room-remote-fields span-2">
          <label>{{t "room.remoteLink" "Remote link"}}</label>
          <input name="roomRemoteLink" value="{{roomRemoteLink}}" placeholder="https://zoom.us/j/..." />
        </div>
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "room.hint" "Rooms show up in calendars and sessions."}}</div>
        <div class="modal-actions">
          <button id="save-room">{{saveLabel}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const planModalTemplate = compileTemplate("plan-modal", `
  <div class="modal-overlay" id="plan-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-plan" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="planId" value="{{planId}}" />
      <div class="form-grid">
        <div>
          <label>{{t "plans.name" "Name"}}</label>
          <input name="planName" value="{{name}}" />
        </div>
        <div>
          <label>{{t "plans.type" "Type"}}</label>
          <select name="planType">
            {{#each typeOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div class="plan-field plan-field-weekly">
          <label>{{t "plans.weeklyLimit" "Weekly limit"}}</label>
          <input type="number" name="weeklyLimit" value="{{weeklyLimit}}" />
        </div>
        <div class="plan-field plan-field-punch">
          <label>{{t "plans.punchUses" "Punch card uses"}}</label>
          <input type="number" name="punchCardUses" value="{{punchCardUses}}" />
        </div>
        <div>
          <label>{{t "plans.price" "Price"}}</label>
          <input type="number" step="0.01" name="price" value="{{price}}" />
        </div>
        <div>
          <label>{{t "plans.remoteOnly" "Remote only"}}</label>
          <select name="planRemoteOnly">
            <option value="false" {{#unless remoteOnly}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            <option value="true" {{#if remoteOnly}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
          </select>
        </div>
        <div>
          <label>{{t "plans.validityDays" "Validity (days)"}}</label>
          <input type="number" name="planValidityDays" value="{{validityDays}}" placeholder="{{t "plans.validityNone" "No expiry"}}" />
        </div>
        <div>
          <label>{{t "plans.dailyLimit" "Daily limit"}}</label>
          <input type="number" name="planDailyLimit" value="{{dailyLimit}}" placeholder="{{t "plans.dailyLimitNone" "No limit"}}" />
        </div>
          <div>
            <label>{{t "plans.active" "Active"}}</label>
            <select name="planActive">
              {{#each activeOptions}}
                <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
              {{/each}}
            </select>
          </div>
          {{#if categories.length}}
          <div class="span-2">
            <label>{{t "plans.categories" "Categories"}}</label>
            <div class="plan-options">
              {{#each categories}}
                <label class="plan-pill">
                  <input type="checkbox" name="planCategoryIds" value="{{id}}" {{#if selected}}checked{{/if}} />
                  <span class="plan-name">{{name}}</span>
                </label>
              {{/each}}
            </div>
          </div>
          {{/if}}
        </div>
      <div class="modal-actions">
        <button id="save-plan" class="primary-action">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          {{saveLabel}}
        </button>
      </div>
    </div>
  </div>
`);

const customerTagModalTemplate = compileTemplate("customer-tag-modal", `
  <div class="modal-overlay" id="customer-tag-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{t "customerTags.title" "Customer tags"}}</h3>
          <div class="muted">{{t "customerTags.subtitle" "Create tags to help segment customers."}}</div>
        </div>
        <button class="modal-close" id="close-tags" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="tagOriginal" value="{{tagOriginal}}" />
        <div class="form-grid status-form">
          <div>
            <label>{{t "customerTags.name" "Tag name"}}</label>
            <input name="tagName" value="{{tagName}}" />
          </div>
          <div>
            <label>{{t "customerTags.color" "Color"}}</label>
            <div class="color-field">
              <input class="color-input" type="color" name="tagColor" value="{{tagColor}}" />
            </div>
          </div>
        </div>
        <div class="modal-actions" style="margin-top:12px;">
          <button id="save-tag">{{saveLabel}}</button>
          <button class="secondary" id="reset-tag">{{t "customerTags.new" "New tag"}}</button>
        </div>
        <div style="margin-top:20px;">
          <table class="table">
            <thead>
              <tr>
                <th>{{t "customerTags.name" "Tag name"}}</th>
                <th>{{t "customerTags.color" "Color"}}</th>
                <th>{{t "customerTags.actions" "Actions"}}</th>
              </tr>
            </thead>
            <tbody id="customer-tag-rows">
              {{#each tags}}
              <tr>
                <td>{{name}}</td>
                <td><span class="color-dot" style="background: {{color}};"></span></td>
                <td>
                  <button class="secondary btn-edit" data-tag-edit="{{name}}">
                  <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  </span>
                  {{t "common.edit" "Edit"}}
                </button>
                <button class="secondary btn-danger" data-tag-delete="{{name}}">
                  <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </span>
                  {{t "customerTags.delete" "Delete"}}
                </button>
              </td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </div>
    </div>
  </div>
`);

const planCategoryModalTemplate = compileTemplate("plan-category-modal", `
  <div class="modal-overlay" id="plan-category-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{t "planCategory.title" "Plan categories"}}</h3>
          <div class="muted">{{t "planCategory.subtitle" "Group plans into categories and set defaults."}}</div>
        </div>
        <button class="modal-close" id="close-plan-categories" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="planCategoryId" value="{{categoryId}}" />
      <div class="form-grid status-form">
        <div>
          <label>{{t "planCategory.name" "Category name"}}</label>
          <input name="planCategoryName" value="{{categoryName}}" />
        </div>
        <div>
          <label>{{t "planCategory.default" "Default"}}</label>
          <select name="planCategoryDefault">
            <option value="false" {{#unless categoryDefault}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            <option value="true" {{#if categoryDefault}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
          </select>
        </div>
        <div>
          <label>{{t "planCategory.active" "Active"}}</label>
          <select name="planCategoryActive">
            <option value="true" {{#if categoryActive}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
            <option value="false" {{#unless categoryActive}}selected{{/unless}}>{{t "common.no" "No"}}</option>
          </select>
        </div>
      </div>
      <div class="modal-actions" style="margin-top:12px;">
        <button id="save-plan-category">{{saveLabel}}</button>
        <button class="secondary" id="reset-plan-category">{{t "planCategory.new" "New category"}}</button>
      </div>
      <div style="margin-top:20px;">
        <table class="table">
          <thead>
            <tr>
              <th>{{t "planCategory.name" "Category name"}}</th>
              <th>{{t "planCategory.default" "Default"}}</th>
              <th>{{t "planCategory.active" "Active"}}</th>
              <th>{{t "planCategory.actions" "Actions"}}</th>
            </tr>
          </thead>
          <tbody>
            {{#each categories}}
            <tr>
              <td>{{name}}</td>
              <td>{{defaultLabel}}</td>
              <td>{{activeLabel}}</td>
              <td>
                <button class="secondary btn-edit" data-plan-category-edit="{{id}}">
                  <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  </span>
                  {{t "common.edit" "Edit"}}
                </button>
              </td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </div>
    </div>
  </div>
`);

const billingItemModalTemplate = compileTemplate("billing-item-modal", `
  <div class="modal-overlay" id="billing-item-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-billing-item" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="billingItemId" value="{{id}}" />
      <div class="form-grid">
        <div>
          <label>{{t "billing.itemName" "Name"}}</label>
          <input name="billingItemName" value="{{name}}" />
        </div>
        <div>
          <label>{{t "billing.itemType" "Type"}}</label>
          <select name="billingItemType">
            {{#each typeOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "billing.amount" "Price"}}</label>
          <input type="number" step="0.01" name="billingItemPrice" value="{{price}}" />
        </div>
        <div>
          <label>{{t "billing.status" "Status"}}</label>
          <select name="billingItemActive">
            {{#each activeOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button id="save-billing-item">{{saveLabel}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const billingSubscriptionModalTemplate = compileTemplate("billing-subscription-modal", `
  <div class="modal-overlay" id="billing-subscription-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-billing-subscription" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div>
          <label>{{t "billing.customer" "Customer"}}</label>
          <select name="billingSubscriptionCustomer">
            {{#each customerOptions}}
              <option value="{{id}}">{{name}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "billing.plan" "Plan"}}</label>
          <select name="billingSubscriptionItem">
            {{#each itemOptions}}
              <option value="{{id}}">{{name}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "billing.startDate" "Start date"}}</label>
          <input type="date" class="date-input" name="billingSubscriptionStart" value="{{startValue}}" />
        </div>
        <div>
          <label>{{t "billing.interval" "Interval"}}</label>
          <select name="billingSubscriptionInterval">
            {{#each intervalOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "billing.anchorDay" "Anchor day"}}</label>
          <input type="number" name="billingSubscriptionAnchor" value="{{anchorDay}}" placeholder="{{t "billing.anchorHint" "Leave blank for default"}}"/>
        </div>
        <div>
          <label>{{t "billing.overridePrice" "Price override"}}</label>
          <input type="number" step="0.01" name="billingSubscriptionPrice" value="{{price}}" placeholder="{{t "billing.overrideHint" "Optional"}}"/>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button id="save-billing-subscription">{{saveLabel}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const billingChargeModalTemplate = compileTemplate("billing-charge-modal", `
  <div class="modal-overlay" id="billing-charge-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-billing-charge" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div>
          <label>{{t "billing.customer" "Customer"}}</label>
          <select name="billingChargeCustomer">
            {{#each customerOptions}}
              <option value="{{id}}">{{name}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "billing.description" "Description"}}</label>
          <input name="billingChargeDescription" value="{{description}}" />
        </div>
        <div>
          <label>{{t "billing.amount" "Amount"}}</label>
          <input type="number" step="0.01" name="billingChargeAmount" value="{{amount}}" />
        </div>
        <div>
          <label>{{t "billing.chargeDate" "Date"}}</label>
          <input type="date" class="date-input" name="billingChargeDate" value="{{dateValue}}" />
        </div>
        <div>
          <label>{{t "billing.source" "Source"}}</label>
          <select name="billingChargeSource">
            {{#each sourceOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button id="save-billing-charge">{{saveLabel}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const billingAdjustModalTemplate = compileTemplate("billing-adjust-modal", `
  <div class="modal-overlay" id="billing-adjust-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-billing-adjust" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div>
          <label>{{t "billing.amount" "Amount"}}</label>
          <input type="number" step="0.01" name="billingAdjustAmount" value="" />
        </div>
        <div class="span-2">
          <label>{{t "billing.reason" "Reason"}}</label>
          <input name="billingAdjustReason" value="" />
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button id="save-billing-adjust">{{t "billing.adjust" "Adjust"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const billingVoidModalTemplate = compileTemplate("billing-void-modal", `
  <div class="modal-overlay" id="billing-void-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{title}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-billing-void" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div class="span-2">
          <label>{{t "billing.reason" "Reason"}}</label>
          <input name="billingVoidReason" value="" />
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button id="save-billing-void" class="btn-danger">{{t "billing.void" "Void"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const bulkRegistrationTemplate = compileTemplate("bulk-registration", `
  <div class="modal-overlay" id="bulk-registration-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{t "bulk.title" "Register selected customers"}}</h3>
          <div class="muted">{{count}} {{t "bulk.count" "customers selected"}}</div>
        </div>
        <button class="modal-close" id="close-bulk-registration" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div>
          <label>{{t "bulk.session" "Session"}}</label>
          <select name="sessionId">
            {{#each sessions}}
              <option value="{{id}}">{{label}}</option>
            {{/each}}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "bulk.hint" "Registers all selected customers to the chosen session."}}</div>
        <div class="modal-actions">
          <button id="confirm-bulk-registration">{{t "bulk.confirm" "Register"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const eventsTemplate = compileTemplate("events", `
  <div class="notice">{{t "events.notice" "Create weekly series and auto-generate classes."}}</div>
  <div class="toolbar">
    <button id="add-series">
      <span class="icon" aria-hidden="true">+</span>
      {{t "events.addSeries" "Add series"}}
    </button>
  </div>
  {{#if hasSeries}}
    <table class="table">
      <thead>
        <tr>
          <th>{{t "events.title" "Title"}}</th>
          <th>{{t "events.icon" "Icon"}}</th>
          <th>{{t "events.color" "Color"}}</th>
          <th>{{t "events.day" "Day"}}</th>
          <th>{{t "events.time" "Time"}}</th>
          <th>{{t "events.capacity" "Capacity"}}</th>
          <th>{{t "events.remoteCapacity" "Remote"}}</th>
          <th>{{t "events.active" "Active"}}</th>
          <th>{{t "events.actions" "Actions"}}</th>
        </tr>
      </thead>
      <tbody>
        {{#each series}}
        <tr>
          <td>{{title}}</td>
          <td>{{icon}}</td>
          <td><span class="color-dot" style="background: {{color}}"></span></td>
          <td>{{dayLabel}}</td>
          <td>{{startTimeLocal}}</td>
          <td>{{defaultCapacity}}</td>
          <td>{{remoteCapacity}}</td>
          <td>{{activeLabel}}</td>
          <td>
            <button class="secondary btn-edit icon-only" data-edit="{{id}}" aria-label="{{t "common.edit" "Edit"}}" title="{{t "common.edit" "Edit"}}">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
              </span>
            </button>
            <button class="secondary btn-danger icon-only" data-delete-series="{{id}}" aria-label="{{t "events.delete" "Delete"}}" title="{{t "events.delete" "Delete"}}">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </span>
            </button>
          </td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  {{else}}
    <div class="empty-state">{{t "events.empty" "No event series yet."}}</div>
  {{/if}}
`);

const plansTemplate = compileTemplate("plans", `
  <div class="notice">{{t "plans.notice" "Manage membership pricing, limits, and availability."}}</div>
  <div class="toolbar">
    <button id="add-plan">
      <span class="icon" aria-hidden="true">+</span>
      {{t "plans.add" "Add plan"}}
    </button>
    <button class="secondary" id="manage-plan-categories">{{t "plans.manageCategories" "Manage categories"}}</button>
  </div>
  <div style="margin-top:24px;">
    <table class="table">
      <thead>
        <tr>
          <th>{{t "plans.name" "Name"}}</th>
          <th>{{t "plans.type" "Type"}}</th>
          <th>{{t "plans.priceLabel" "Price"}}</th>
          <th>{{t "plans.active" "Active"}}</th>
          <th>{{t "plans.actions" "Actions"}}</th>
        </tr>
      </thead>
      <tbody>
        {{#each plans}}
        <tr>
          <td>{{name}}</td>
          <td>{{typeLabel}}</td>
          <td>{{price}}</td>
          <td>{{activeLabel}}</td>
          <td>
            <button class="secondary btn-edit" data-plan-edit="{{id}}">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
              </span>
              {{t "common.edit" "Edit"}}
            </button>
          </td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
`);

const customersTemplate = compileTemplate("customers", `
  <div class="notice">{{t "customers.notice" "Manage customer profiles, contacts, and status."}}</div>
  <div class="toolbar toolbar-customers">
    <button id="add-customer" class="btn-icon">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      {{t "customers.add" "Add customer"}}
    </button>
    <button class="secondary" id="manage-statuses">{{t "customers.manageStatuses" "Manage statuses"}}</button>
    <button class="secondary" id="manage-tags">{{t "customers.manageTags" "Manage tags"}}</button>
    <button class="secondary" id="export-customers">{{t "customers.export" "Export CSV"}}</button>
    <label class="import-card" id="import-customers-zone">
      <input type="file" id="import-customers" accept=".csv,.xlsx" />
      <div class="import-title">{{t "customers.import" "Import"}}</div>
      <div class="import-subtitle">{{t "customers.importHint" "Drop a CSV or Excel file"}}</div>
    </label>
  </div>
  <div class="customer-controls">
    <input type="search" name="search" placeholder="{{t "customers.search" "Search customers"}}" value="{{search}}" />
    <select name="statusFilter">
      <option value="">{{t "customers.statusAll" "All statuses"}}</option>
      {{#each statusOptions}}
        <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
      {{/each}}
    </select>
    <select name="tagFilter">
      <option value="">{{t "customers.tagAll" "All tags"}}</option>
      {{#each tagOptions}}
        <option value="{{value}}" {{#if selected}}selected{{/if}}>{{value}}</option>
      {{/each}}
    </select>
    <label class="checkbox">
      <input type="checkbox" name="includeArchived" {{#if includeArchived}}checked{{/if}} />
      {{t "customers.showArchived" "Show archived"}}
    </label>
    <label class="checkbox">
      <input type="checkbox" id="customers-select-all" />
      {{t "customers.selectAll" "Select all"}}
    </label>
    <button class="secondary" id="apply-customer-filters">{{t "common.apply" "Apply"}}</button>
    <div class="bulk-actions">
      <button class="secondary" id="bulk-email">{{t "customers.bulkEmail" "Email selected"}}</button>
      <button class="secondary" id="bulk-sms">{{t "customers.bulkSms" "SMS selected"}}</button>
      <button class="secondary" id="bulk-register">{{t "customers.bulkRegister" "Register to class"}}</button>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th></th>
        <th class="sortable {{#if (eq sortKey "name")}}sorted {{sortDir}}{{/if}}" data-sort="name">{{t "customers.name" "Name"}}</th>
        <th class="sortable {{#if (eq sortKey "email")}}sorted {{sortDir}}{{/if}}" data-sort="email">{{t "customers.email" "Email"}}</th>
        <th class="sortable {{#if (eq sortKey "phone")}}sorted {{sortDir}}{{/if}}" data-sort="phone">{{t "customers.phone" "Phone"}}</th>
        <th class="sortable {{#if (eq sortKey "status")}}sorted {{sortDir}}{{/if}}" data-sort="status">{{t "customers.status" "Status"}}</th>
        <th>{{t "customer.tags" "Tags"}}</th>
        <th>{{t "customers.actions" "Actions"}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each customers}}
      <tr class="{{#if isArchived}}row-muted{{/if}}">
        <td><input type="checkbox" data-customer-select="{{id}}" /></td>
        <td><a href="#/customer/{{id}}" class="link-button">{{fullName}}</a></td>
        <td><a href="mailto:{{email}}">{{email}}</a></td>
        <td>
          <a href="tel:{{phone}}">{{phone}}</a>
          <a href="sms:{{phone}}" class="link-muted">{{t "customers.sms" "SMS"}}</a>
        </td>
        <td>{{statusLabel}}</td>
        <td>{{{tagsHtml}}}</td>
        <td>
          <button class="secondary btn-edit icon-only" data-edit="{{id}}" aria-label="{{t "common.edit" "Edit"}}" title="{{t "common.edit" "Edit"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            </span>
          </button>
          <button class="secondary btn-danger icon-only" data-archive="{{id}}" aria-label="{{archiveLabel}}" title="{{archiveLabel}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
          </button>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>
`);

const customerDetailsTemplate = compileTemplate("customer-details", `
  <div class="customer-details">
    <div class="details-header">
      <div class="details-title">
        <h2>{{fullName}}</h2>
        <div class="muted">{{email}}{{#if phone}} · {{phone}}{{/if}}</div>
        <div class="meta">{{statusLabel}}</div>
      </div>
      <div class="details-actions">
        <button class="secondary btn-edit" id="edit-customer">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </span>
        {{t "common.edit" "Edit"}}
        </button>
      </div>
    </div>
    <div class="details-columns">
      <div class="details-main">
        <section class="details-section">
          <h3>{{t "customer.details.info" "Information"}}</h3>
          <div class="details-list">
            <div><span class="label">{{t "customers.name" "Name"}}</span><span>{{fullName}}</span></div>
            <div><span class="label">{{t "customers.email" "Email"}}</span><span>{{email}}</span></div>
            <div><span class="label">{{t "customers.phone" "Phone"}}</span><span>{{phone}}</span></div>
            <div><span class="label">{{t "customer.idNumber" "ID number"}}</span><span>{{idNumber}}</span></div>
            <div><span class="label">{{t "customer.sex" "Sex"}}</span><span>{{gender}}</span></div>
            <div><span class="label">{{t "customer.dateOfBirth" "Date of birth"}}</span><span>{{dateOfBirth}}{{#if ageLabel}} <span class="meta">({{ageLabel}})</span>{{/if}}</span></div>
            <div><span class="label">{{t "customer.city" "City"}}</span><span>{{city}}</span></div>
            <div><span class="label">{{t "customer.address" "Address"}}</span><span>{{address}}</span></div>
            <div><span class="label">{{t "customer.profession" "Profession"}}</span><span>{{occupation}}</span></div>
            <div><span class="label">{{t "customer.tags" "Tags"}}</span><span class="tags-inline">{{{tagsHtml}}}</span></div>
            <div><span class="label">{{t "customer.signedHealth" "Signed health waiver"}}</span><span>{{{signedHealthTag}}}</span></div>
          </div>
        </section>
        <section class="details-section">
          <h3>{{t "customer.details.signedForms" "Signed forms"}}</h3>
          {{#if healthDeclarations.length}}
            <table class="table details-table">
              <thead>
                <tr>
                  <th>{{t "customer.details.submittedAt" "Submitted"}}</th>
                  <th>{{t "customer.details.signature" "Signature"}}</th>
                  <th>{{t "customer.details.signatureType" "Type"}}</th>
                </tr>
              </thead>
              <tbody>
                {{#each healthDeclarations}}
                <tr>
                  <td>{{submittedLabel}}</td>
                  <td>{{signatureName}}</td>
                  <td>{{signatureType}}</td>
                </tr>
                {{/each}}
              </tbody>
            </table>
          {{else}}
            <div class="empty-state">{{t "customer.details.noForms" "No signed forms yet."}}</div>
          {{/if}}
        </section>
        <section class="details-section">
          <div class="details-section-header">
            <h3>{{t "customer.details.attachments" "Attachments"}}</h3>
            <label class="secondary btn-icon">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </span>
              {{t "customer.details.upload" "Upload"}}
              <input type="file" id="customer-attachment-input" hidden />
            </label>
          </div>
          {{#if attachments.length}}
            <div class="attachments-list">
              {{#each attachments}}
                <div class="attachment-row">
                  <div>
                    <div class="attachment-name">{{fileName}}</div>
                    <div class="meta">{{uploadedLabel}}</div>
                  </div>
                  <div class="attachment-actions">
                    <a class="secondary" href="{{downloadUrl}}" target="_blank" rel="noreferrer">{{t "customer.download" "Download"}}</a>
                  </div>
                </div>
              {{/each}}
            </div>
          {{else}}
            <div class="empty-state">{{t "customer.details.noAttachments" "No attachments uploaded."}}</div>
          {{/if}}
        </section>
        <section class="details-section">
          <div class="details-section-header">
            <h3>{{t "customer.details.recentRegistrations" "Recent registrations"}}</h3>
            <button class="secondary" id="view-all-registrations">{{t "customer.details.viewAll" "View all"}}</button>
          </div>
          {{#if recentRegistrations.length}}
            <table class="table details-table">
              <thead>
                <tr>
                  <th>{{t "calendar.list.date" "Date"}}</th>
                  <th>{{t "calendar.list.time" "Time"}}</th>
                  <th>{{t "calendar.list.class" "Class"}}</th>
                  <th>{{t "calendar.list.room" "Room"}}</th>
                  <th>{{t "calendar.list.instructor" "Instructor"}}</th>
                  <th>{{t "roster.booking" "Booking"}}</th>
                  <th>{{t "roster.attendance" "Attendance"}}</th>
                </tr>
              </thead>
              <tbody>
                {{#each recentRegistrations}}
                <tr>
                  <td>{{dateLabel}}</td>
                  <td>{{timeLabel}}</td>
                  <td>{{seriesTitle}}</td>
                  <td>{{roomName}}</td>
                  <td>{{instructorName}}</td>
                  <td>{{bookingStatusLabel}}</td>
                  <td>{{attendanceLabel}}</td>
                </tr>
                {{/each}}
              </tbody>
            </table>
          {{else}}
            <div class="empty-state">{{t "customer.details.noRegistrations" "No registrations yet."}}</div>
          {{/if}}
        </section>
        <section class="details-section">
          <div class="details-section-header">
            <h3>{{t "customer.details.recentInvoices" "Recent invoices"}}</h3>
            <button class="secondary" id="view-invoices">{{t "customer.details.viewInvoices" "View all"}}</button>
          </div>
          {{#if recentInvoices.length}}
            <table class="table details-table">
              <thead>
                <tr>
                  <th>{{t "invoices.number" "Invoice"}}</th>
                  <th>{{t "invoices.issued" "Issued"}}</th>
                  <th>{{t "invoices.total" "Total"}}</th>
                  <th>{{t "invoices.url" "Invoice"}}</th>
                </tr>
              </thead>
              <tbody>
                {{#each recentInvoices}}
                <tr>
                  <td>{{invoiceNo}}</td>
                  <td>{{issuedLabel}}</td>
                  <td>{{amountLabel}}</td>
                  <td>
                    {{#if url}}
                      <a class="secondary" href="{{url}}" target="_blank" rel="noreferrer">{{t "invoices.download" "Download"}}</a>
                    {{else}}
                      -
                    {{/if}}
                  </td>
                </tr>
                {{/each}}
              </tbody>
            </table>
          {{else}}
            <div class="empty-state">{{t "customer.details.noInvoices" "No invoices yet."}}</div>
          {{/if}}
        </section>
      </div>
      <div class="details-activity">
        <section class="details-section">
          <h3>{{t "customer.details.activity" "Activity log"}}</h3>
          <form id="activity-form" class="activity-form">
            <label>{{t "customer.details.activityAddTitle" "Log activity"}}</label>
            <textarea name="activityNote" rows="3" placeholder="{{t "customer.details.activityPlaceholder" "Write a note about the customer."}}"></textarea>
            <div class="activity-actions">
              <label class="secondary btn-icon">
                <span class="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </span>
                {{t "customer.details.activityFile" "Add photo"}}
                <input type="file" name="activityFile" accept="image/*" hidden />
              </label>
              <button type="submit" id="save-activity">{{t "customer.details.activityAdd" "Add note"}}</button>
            </div>
          </form>
        </section>
        <section class="details-section">
          {{#if auditLogs.length}}
            <table class="table details-table">
              <thead>
                <tr>
                  <th>{{t "audit.time" "Time"}}</th>
                  <th>{{t "audit.actor" "Actor"}}</th>
                  <th>{{t "audit.action" "Action"}}</th>
                  <th>{{t "audit.summary" "Summary"}}</th>
                </tr>
              </thead>
              <tbody>
                {{#each auditLogs}}
                <tr>
                  <td>{{timeLabel}}</td>
                  <td>{{actorLabel}}</td>
                  <td>{{actionLabel}}</td>
                  <td>{{summary}}</td>
                </tr>
                {{/each}}
              </tbody>
            </table>
          {{else}}
            <div class="empty-state">{{t "customer.details.noActivity" "No activity yet."}}</div>
          {{/if}}
        </section>
      </div>
    </div>
  </div>
`);

const usersTemplate = compileTemplate("users", `
  <div class="notice">{{t "users.notice" "Create and manage staff, instructors, and guest access."}}</div>
  <div class="toolbar toolbar-users">
    <button id="add-user" class="btn-icon">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      {{t "users.add" "Add user"}}
    </button>
    <div class="user-filters">
      <select name="userRoleFilter">
        {{#each roleOptions}}
          <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
        {{/each}}
      </select>
      <button class="secondary btn-icon" id="apply-user-filter">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        {{t "common.apply" "Apply"}}
      </button>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>{{t "users.name" "Name"}}</th>
        <th>{{t "users.email" "Email"}}</th>
        <th>{{t "users.roles" "Roles"}}</th>
        <th>{{t "users.status" "Status"}}</th>
        <th>{{t "users.instructorProfile" "Instructor profile"}}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {{#each users}}
      <tr class="{{#unless isActive}}row-muted{{/unless}}">
        <td>{{displayName}}</td>
        <td>{{email}}</td>
        <td>{{rolesLabel}}</td>
        <td>{{statusLabel}}</td>
        <td>{{instructorLabel}}</td>
        <td>
          <button class="secondary btn-edit icon-only" data-user-edit="{{id}}" aria-label="{{t "common.edit" "Edit"}}" title="{{t "common.edit" "Edit"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            </span>
          </button>
          <button class="secondary btn-icon icon-only" data-user-invite="{{id}}" aria-label="{{t "users.invite" "Invite"}}" title="{{t "users.invite" "Invite"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            </span>
          </button>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>
`);

const guestDirectoryTemplate = compileTemplate("guest-directory", `
  <div class="notice">{{t "guests.notice" "Guests can only view schedules in read-only mode."}}</div>
  <div class="toolbar toolbar-guests">
    <button id="add-guest" class="btn-icon">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      {{t "guests.add" "Add guest"}}
    </button>
  </div>
  <div class="customer-controls">
    <input type="search" name="guestSearch" placeholder="{{t "guests.search" "Search guests"}}" value="{{search}}" />
    <button class="secondary btn-icon" id="apply-guest-search">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      {{t "common.apply" "Apply"}}
    </button>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>{{t "guests.name" "Name"}}</th>
        <th>{{t "guests.email" "Email"}}</th>
        <th>{{t "guests.status" "Status"}}</th>
        <th>{{t "guests.created" "Created"}}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {{#each guests}}
      <tr class="{{#unless isActive}}row-muted{{/unless}}">
        <td>{{displayName}}</td>
        <td>{{email}}</td>
        <td>{{statusLabel}}</td>
        <td>{{createdLabel}}</td>
        <td>
          <button class="secondary btn-icon icon-only" data-guest-invite="{{id}}" aria-label="{{t "guests.invite" "Invite"}}" title="{{t "guests.invite" "Invite"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            </span>
          </button>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>
`);

const roomsTemplate = compileTemplate("rooms", `
  <div class="notice">{{t "rooms.notice" "Manage studio rooms and spaces."}}</div>
  <div class="toolbar">
    <button id="add-room">
      <span class="icon" aria-hidden="true">+</span>
      {{t "rooms.add" "Add room"}}
    </button>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>{{t "rooms.name" "Name"}}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {{#each rooms}}
      <tr>
        <td>{{name}}</td>
        <td>
          <button class="secondary btn-edit icon-only" data-room-edit="{{id}}" aria-label="{{t "common.edit" "Edit"}}" title="{{t "common.edit" "Edit"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            </span>
          </button>
          <button class="secondary btn-danger icon-only" data-room-delete="{{id}}" aria-label="{{t "common.delete" "Delete"}}" title="{{t "common.delete" "Delete"}}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
          </button>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>
`);

const reportsTemplate = compileTemplate("reports", `
  <div class="cards">
    <div class="card">
      <div class="card-title">{{t "reports.revenue" "Revenue (30d)"}}</div>
      <div class="card-value">{{revenue}}</div>
    </div>
    <div class="card">
      <div class="card-title">{{t "reports.sessions" "Total sessions"}}</div>
      <div class="card-value">{{sessions}}</div>
    </div>
    <div class="card">
      <div class="card-title">{{t "reports.occupancy" "Avg occupancy"}}</div>
      <div class="card-value">{{occupancy}}%</div>
    </div>
  </div>
`);

const payrollTemplate = compileTemplate("payroll", `
  <div class="notice">{{t "payroll.notice" "Review instructor rates and reported attendance for payroll processing."}}</div>
  {{#if errorMessage}}
    <div class="notice">{{errorMessage}}</div>
  {{/if}}
  <div class="customer-controls">
    <select name="payrollInstructor">
      <option value="">{{t "payroll.allInstructors" "All instructors"}}</option>
      {{#each instructorOptions}}
        <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
      {{/each}}
    </select>
    <div>
      <label>{{t "payroll.from" "From"}}</label>
      <input type="date" class="date-input" name="payrollFrom" value="{{fromValue}}" />
    </div>
    <div>
      <label>{{t "payroll.to" "To"}}</label>
      <input type="date" class="date-input" name="payrollTo" value="{{toValue}}" />
    </div>
    <button class="secondary" id="apply-payroll">{{t "common.apply" "Apply"}}</button>
  </div>
  <div class="cards" style="margin-bottom: 16px;">
    <div class="card">
      <div class="card-title">{{t "payroll.totalPayout" "Total payout"}}</div>
      <div class="card-value">{{totalPayout}}</div>
    </div>
    <div class="card">
      <div class="card-title">{{t "payroll.sessions" "Reported sessions"}}</div>
      <div class="card-value">{{totalSessions}}</div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>{{t "payroll.reportedAt" "Reported"}}</th>
        <th>{{t "payroll.instructor" "Instructor"}}</th>
        <th>{{t "payroll.session" "Session"}}</th>
        <th>{{t "payroll.sessionDate" "Session date"}}</th>
        <th>{{t "payroll.attendance" "Attendance"}}</th>
        <th>{{t "payroll.units" "Units"}}</th>
        <th>{{t "payroll.rate" "Rate"}}</th>
        <th>{{t "payroll.amount" "Amount"}}</th>
        <th>{{t "payroll.reportedBy" "Reported by"}}</th>
      </tr>
    </thead>
    <tbody>
      {{#if hasLogs}}
        {{#each logs}}
        <tr>
          <td>{{reportedAtLabel}}</td>
          <td>{{instructorLabel}}</td>
          <td>{{sessionLabel}}</td>
          <td>{{sessionDateLabel}}</td>
          <td>{{attendanceLabel}}</td>
          <td>{{unitsLabel}}</td>
          <td>{{rateLabel}}</td>
          <td>{{amountLabel}}</td>
          <td>{{reportedByLabel}}</td>
        </tr>
        {{/each}}
      {{else}}
        <tr>
          <td colspan="9" class="empty-state">{{t "payroll.empty" "No payroll entries yet."}}</td>
        </tr>
      {{/if}}
    </tbody>
  </table>
`);

const billingTemplate = compileTemplate("billing", `
  <div class="notice">{{t "billing.notice" "Track subscriptions and charges for your studio."}}</div>
  {{#if errorMessage}}
    <div class="notice">{{errorMessage}}</div>
  {{/if}}
  <div class="billing-toolbar">
    <div class="billing-actions">
      <button class="primary btn-icon" id="billing-run">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        {{t "billing.run" "Run billing"}}
      </button>
      <button class="secondary btn-icon" id="billing-export">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 3h12l4 4v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm11 1v4h4M7 9l2 3-2 3h2l1-2 1 2h2l-2-3 2-3h-2l-1 2-1-2H7z"/></svg>
        </span>
        {{t "billing.export" "Export CSV"}}
      </button>
      <button class="secondary btn-icon" id="billing-new-charge">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        {{t "billing.newCharge" "New charge"}}
      </button>
    </div>
    <div class="billing-filters">
      <div class="billing-range-guard">
        <label class="checkbox">
          <input type="checkbox" id="billing-run-guard" {{#if runRangeEnabled}}checked{{/if}} />
          <span>{{t "billing.runGuard" "Enable custom billing range"}}</span>
        </label>
      </div>
      <div>
        <label>{{t "billing.from" "From"}}</label>
        <input type="date" class="date-input" name="billingFrom" value="{{fromValue}}" {{#unless runRangeEnabled}}disabled{{/unless}} />
      </div>
      <div>
        <label>{{t "billing.to" "To"}}</label>
        <input type="date" class="date-input" name="billingTo" value="{{toValue}}" {{#unless runRangeEnabled}}disabled{{/unless}} />
      </div>
      <div>
        <label>{{t "billing.status" "Status"}}</label>
        <select name="billingStatus">
          {{#each statusOptions}}
            <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
          {{/each}}
        </select>
      </div>
      <div>
        <label>{{t "billing.customer" "Customer"}}</label>
        <select name="billingCustomer">
          {{#each customerOptions}}
            <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
          {{/each}}
        </select>
      </div>
      <div>
        <label>{{t "billing.source" "Source"}}</label>
        <select name="billingSource">
          {{#each sourceOptions}}
            <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
          {{/each}}
        </select>
      </div>
      <button class="secondary" id="billing-apply">{{t "common.apply" "Apply"}}</button>
    </div>
  </div>
  <section class="billing-section">
    <div class="section-header">
      <div>
        <h3>{{t "billing.charges" "Charges"}}</h3>
        <div class="muted">{{chargesCount}}</div>
      </div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>{{t "billing.chargeDate" "Date"}}</th>
          <th>{{t "billing.customer" "Customer"}}</th>
          <th>{{t "billing.description" "Description"}}</th>
          <th>{{t "billing.source" "Source"}}</th>
          <th>{{t "billing.amount" "Amount"}}</th>
          <th>{{t "billing.status" "Status"}}</th>
          <th>{{t "billing.invoice" "Invoice"}}</th>
          <th>{{t "billing.actions" "Actions"}}</th>
        </tr>
      </thead>
      <tbody>
        {{#if charges.length}}
          {{#each charges}}
          <tr>
            <td>{{chargeDateLabel}}</td>
            <td>{{customerName}}</td>
            <td>{{description}}</td>
            <td>{{sourceLabel}}</td>
            <td>{{amountLabel}}</td>
            <td>{{statusLabel}}</td>
            <td>
              {{#if invoiceUrl}}
                <a class="secondary" href="{{invoiceUrl}}" target="_blank" rel="noreferrer">{{invoiceNo}}</a>
              {{else}}
                -
              {{/if}}
            </td>
            <td class="table-actions">
              <button class="secondary icon-only" data-charge-adjust="{{id}}" aria-label="{{t "billing.adjust" "Adjust"}}" title="{{t "billing.adjust" "Adjust"}}">
                <span class="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </span>
              </button>
              <button class="secondary btn-danger icon-only" data-charge-void="{{id}}" aria-label="{{t "billing.void" "Void"}}" title="{{t "billing.void" "Void"}}">
                <span class="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </span>
              </button>
            </td>
          </tr>
          {{/each}}
        {{else}}
          <tr>
            <td colspan="8" class="empty-state">{{t "billing.emptyCharges" "No charges found."}}</td>
          </tr>
        {{/if}}
      </tbody>
    </table>
  </section>
  <section class="billing-section">
    <div class="section-header">
      <div>
        <h3>{{t "billing.subscriptions" "Subscriptions"}}</h3>
        <div class="muted">{{t "billing.subscriptionsHint" "Active customer subscriptions"}}</div>
      </div>
      <button class="secondary btn-icon" id="billing-new-subscription">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        {{t "billing.newSubscription" "New subscription"}}
      </button>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>{{t "billing.customer" "Customer"}}</th>
          <th>{{t "billing.plan" "Plan"}}</th>
          <th>{{t "billing.nextCharge" "Next charge"}}</th>
          <th>{{t "billing.amount" "Amount"}}</th>
          <th>{{t "billing.status" "Status"}}</th>
          <th>{{t "billing.actions" "Actions"}}</th>
        </tr>
      </thead>
      <tbody>
        {{#if subscriptions.length}}
          {{#each subscriptions}}
            <tr>
              <td>{{customerName}}</td>
              <td>{{itemName}}</td>
              <td>{{nextChargeLabel}}</td>
              <td>{{amountLabel}}</td>
              <td>{{statusLabel}}</td>
              <td class="table-actions">
                {{#if canPause}}
                  <button class="secondary icon-only" data-subscription-pause="{{id}}" aria-label="{{t "billing.pause" "Pause"}}" title="{{t "billing.pause" "Pause"}}">
                    <span class="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zm7 0h3v14h-3z"/></svg>
                    </span>
                  </button>
                {{/if}}
                {{#if canResume}}
                  <button class="secondary icon-only" data-subscription-resume="{{id}}" aria-label="{{t "billing.resume" "Resume"}}" title="{{t "billing.resume" "Resume"}}">
                    <span class="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M8 5l10 7-10 7V5z"/></svg>
                    </span>
                  </button>
                {{/if}}
                <button class="secondary btn-danger icon-only" data-subscription-cancel="{{id}}" aria-label="{{t "billing.cancel" "Cancel"}}" title="{{t "billing.cancel" "Cancel"}}">
                  <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  </span>
                </button>
              </td>
            </tr>
          {{/each}}
        {{else}}
          <tr>
            <td colspan="6" class="empty-state">{{t "billing.emptySubscriptions" "No subscriptions yet."}}</td>
          </tr>
        {{/if}}
      </tbody>
    </table>
  </section>
  <section class="billing-section">
    <div class="section-header">
      <div>
        <h3>{{t "billing.items" "Billable items"}}</h3>
        <div class="muted">{{t "billing.itemsHint" "Products and fees you can charge."}}</div>
      </div>
      <button class="secondary btn-icon" id="billing-new-item">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        {{t "billing.newItem" "New item"}}
      </button>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>{{t "billing.itemName" "Name"}}</th>
          <th>{{t "billing.itemType" "Type"}}</th>
          <th>{{t "billing.amount" "Price"}}</th>
          <th>{{t "billing.status" "Status"}}</th>
          <th>{{t "billing.actions" "Actions"}}</th>
        </tr>
      </thead>
      <tbody>
        {{#if items.length}}
          {{#each items}}
            <tr>
              <td>{{name}}</td>
              <td>{{typeLabel}}</td>
              <td>{{priceLabel}}</td>
              <td>{{statusLabel}}</td>
              <td class="table-actions">
                <button class="secondary icon-only" data-item-edit="{{id}}" aria-label="{{t "common.edit" "Edit"}}" title="{{t "common.edit" "Edit"}}">
                  <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  </span>
                </button>
              </td>
            </tr>
          {{/each}}
        {{else}}
          <tr>
            <td colspan="5" class="empty-state">{{t "billing.emptyItems" "No billable items yet."}}</td>
          </tr>
        {{/if}}
      </tbody>
    </table>
  </section>
`);

const invoicesTemplate = compileTemplate("invoices", `
  <div class="notice">{{t "invoices.notice" "Invoices are generated externally and shown here for reference."}}</div>
  {{#if errorMessage}}
    <div class="notice">{{errorMessage}}</div>
  {{/if}}
  <div class="billing-toolbar">
    <div class="billing-filters">
      <div>
        <label>{{t "invoices.from" "From"}}</label>
        <input type="date" class="date-input" name="invoiceFrom" value="{{fromValue}}" />
      </div>
      <div>
        <label>{{t "invoices.to" "To"}}</label>
        <input type="date" class="date-input" name="invoiceTo" value="{{toValue}}" />
      </div>
      <div>
        <label>{{t "invoices.customer" "Customer"}}</label>
        <select name="invoiceCustomer">
          {{#each customerOptions}}
            <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
          {{/each}}
        </select>
      </div>
      <button class="secondary" id="invoice-apply">{{t "common.apply" "Apply"}}</button>
    </div>
  </div>
  <section class="billing-section">
    <div class="section-header">
      <div>
        <h3>{{t "invoices.title" "Invoices"}}</h3>
        <div class="muted">{{invoiceCount}}</div>
      </div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>{{t "invoices.number" "Invoice"}}</th>
          <th>{{t "invoices.customer" "Customer"}}</th>
          <th>{{t "invoices.issued" "Issued"}}</th>
          <th>{{t "invoices.total" "Total"}}</th>
          <th>{{t "invoices.url" "Invoice"}}</th>
        </tr>
      </thead>
      <tbody>
        {{#if hasInvoices}}
          {{#each invoices}}
          <tr>
            <td>{{invoiceNo}}</td>
            <td>{{customerName}}</td>
            <td>{{issuedLabel}}</td>
            <td>{{amountLabel}}</td>
            <td>
              {{#if url}}
                <a class="secondary" href="{{url}}" target="_blank" rel="noreferrer">{{t "invoices.download" "Download"}}</a>
              {{else}}
                -
              {{/if}}
            </td>
          </tr>
          {{/each}}
        {{else}}
          <tr>
            <td colspan="5" class="empty-state">{{t "invoices.empty" "No invoices found."}}</td>
          </tr>
        {{/if}}
      </tbody>
    </table>
  </section>
`);

const auditTemplate = compileTemplate("audit", `
  <div class="notice">{{t "audit.notice" "Track every change across the studio. Export or clear logs as needed."}}</div>
  {{#if errorMessage}}
    <div class="notice">{{errorMessage}}</div>
  {{/if}}
  <div class="audit-controls">
    <div>
      <label>{{t "audit.from" "From"}}</label>
      <input type="date" class="date-input" name="auditFrom" value="{{fromValue}}" />
    </div>
    <div>
      <label>{{t "audit.to" "To"}}</label>
      <input type="date" class="date-input" name="auditTo" value="{{toValue}}" />
    </div>
    <div>
      <label>{{t "audit.search" "Search"}}</label>
      <input type="search" name="auditSearch" value="{{search}}" placeholder="{{t "audit.searchPlaceholder" "Search logs"}}" />
    </div>
    <div class="audit-actions">
      <button class="secondary" id="apply-audit">{{t "common.apply" "Apply"}}</button>
      <button class="icon-button export-btn" id="export-audit" aria-label="{{t "audit.export" "Export CSV"}}">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 3h12l4 4v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm11 1v4h4M7 9l2 3-2 3h2l1-2 1 2h2l-2-3 2-3h-2l-1 2-1-2H7z"/></svg>
        </span>
        <span class="sr-only">{{t "audit.export" "Export CSV"}}</span>
      </button>
    </div>
  </div>
  <div class="audit-controls audit-clear">
    <div>
      <label>{{t "audit.clearBefore" "Clear before"}}</label>
      <input type="date" class="date-input" name="auditClearBefore" value="{{clearBeforeValue}}" />
    </div>
    <div class="audit-actions">
      <button class="secondary" id="clear-audit">{{t "audit.clear" "Clear logs"}}</button>
    </div>
  </div>
  {{#if hasLogs}}
  <table class="table">
    <thead>
      <tr>
        <th>{{t "audit.time" "Time"}}</th>
        <th>{{t "audit.actor" "Actor"}}</th>
        <th>{{t "audit.action" "Action"}}</th>
        <th>{{t "audit.relatesTo" "Relates to"}}</th>
        <th>{{t "audit.summary" "Summary"}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each logs}}
      <tr>
        <td>{{timeLabel}}</td>
        <td>{{actorLabel}}</td>
        <td>{{actionLabel}}</td>
        <td>{{relatesToLabel}}</td>
        <td>{{summary}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{else}}
    <div class="empty-state">{{t "audit.empty" "No audit entries found."}}</div>
  {{/if}}
`);

const settingsTemplate = compileTemplate("settings", `
  <div class="form-grid">
    <div>
      <label>{{t "settings.studioName" "Studio name"}}</label>
      <input name="name" value="{{name}}" />
    </div>
    <div>
      <label>{{t "settings.logoUrl" "Logo URL"}}</label>
      <input name="logoUrl" value="{{logoUrl}}" placeholder="{{t "settings.logoUrlHint" "https://... or data:image/..."}}" />
    </div>
    <div>
      <label>{{t "settings.faviconUrl" "Favicon URL"}}</label>
      <input name="faviconUrl" value="{{faviconUrl}}" placeholder="{{t "settings.faviconHint" "Defaults to logo"}}" />
    </div>
    <div>
      <label>{{t "settings.logoFile" "Logo file"}}</label>
      <input name="logoFile" type="file" accept="image/*" />
    </div>
    <div class="logo-preview">
      {{#if logoUrl}}
        <img src="{{logoUrl}}" alt="{{t 'settings.logoPreview' 'Studio logo preview'}}" />
      {{else}}
        <div class="logo-placeholder">{{t "settings.logoPlaceholder" "No logo selected"}}</div>
      {{/if}}
    </div>
    <div>
      <label>{{t "settings.weekStartsOn" "Week starts on"}}</label>
      <div class="static-value">{{t "settings.weekStartsOnSunday" "Sunday"}}</div>
      <input name="weekStartsOn" type="hidden" value="0" />
    </div>
    <div>
      <label>{{t "settings.defaultLocale" "Default language"}}</label>
      <select name="defaultLocale">
        {{#each defaultLanguageOptions}}
          <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
        {{/each}}
      </select>
    </div>
    <div>
      <label>{{t "settings.userLocale" "Your language"}}</label>
      <select name="userLocale">
        {{#each userLanguageOptions}}
          <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
        {{/each}}
      </select>
    </div>
    <div>
      <label>{{t "settings.googlePlacesKey" "Google Places API key"}}</label>
      <input name="googlePlacesApiKey" value="{{googlePlacesApiKey}}" placeholder="AIza..." />
    </div>
  </div>
  <div class="holiday-section">
    <h4>{{t "settings.holidays.title" "Holiday calendars"}}</h4>
    <div class="holiday-options">
      {{#each holidayCalendarOptions}}
        <label class="checkbox">
          <input type="checkbox" name="holidayCalendars" value="{{id}}" {{#if selected}}checked{{/if}} />
          {{label}}
        </label>
      {{/each}}
    </div>
    <div class="meta">{{t "settings.holidays.hint" "Holidays appear as all-day markers in the calendar."}}</div>
  </div>
  <div class="theme-row">
    <div class="theme-card">
      <h4>{{t "settings.themeEditor" "Theme editor"}}</h4>
      <div class="form-grid theme-fields">
        <div>
          <label>{{t "settings.primary" "Primary"}}</label>
          <div class="color-field">
            <input class="color-input" name="themePrimary" type="color" value="{{themePrimary}}" />
          </div>
        </div>
        <div>
          <label>{{t "settings.secondary" "Secondary"}}</label>
          <div class="color-field">
            <input class="color-input" name="themeSecondary" type="color" value="{{themeSecondary}}" />
          </div>
        </div>
        <div>
          <label>{{t "settings.accent" "Accent"}}</label>
          <div class="color-field">
            <input class="color-input" name="themeAccent" type="color" value="{{themeAccent}}" />
          </div>
        </div>
        <div>
          <label>{{t "settings.background" "Background"}}</label>
          <div class="color-field">
            <input class="color-input" name="themeBackground" type="color" value="{{themeBackground}}" />
          </div>
        </div>
      </div>
    </div>
    <div class="theme-card">
      <h4>{{t "settings.themeJson" "Theme JSON"}}</h4>
      <textarea name="themeJson" rows="8">{{themeJson}}</textarea>
    </div>
  </div>
  <div style="margin-top:16px;">
    <button id="save-settings">{{t "settings.save" "Save settings"}}</button>
  </div>
`);

const profileModalTemplate = compileTemplate("profile-modal", `
  <div class="modal-overlay" id="profile-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{t "profile.title" "Your profile"}}</h3>
          <div class="muted">{{t "profile.subtitle" "Update your contact details and photo."}}</div>
        </div>
        <button class="modal-close" id="close-profile" type="button" aria-label="{{t "profile.close" "Close"}}"></button>
      </div>
      <div class="form-grid">
        <div>
          <label>{{t "profile.displayName" "Display name"}}</label>
          <input name="profileDisplayName" value="{{displayName}}" />
        </div>
        <div>
          <label>{{t "profile.email" "Email"}}</label>
          <input name="profileEmail" type="email" value="{{email}}" />
        </div>
        <div>
          <label>{{t "profile.roles" "Roles"}}</label>
          <input name="profileRole" value="{{rolesLabel}}" disabled />
        </div>
        <div>
          <label>{{t "profile.password" "New password"}}</label>
          <input name="profilePassword" type="password" placeholder="{{t 'profile.passwordHint' 'Leave blank to keep current'}}" />
        </div>
        <div>
          <label>{{t "profile.avatarUrl" "Avatar URL"}}</label>
          <input name="profileAvatarUrl" value="{{avatarUrl}}" placeholder="https://... or data:image/..." />
        </div>
        <div>
          <label>{{t "profile.avatarFile" "Avatar file"}}</label>
          <input name="profileAvatarFile" type="file" accept="image/*" />
        </div>
      </div>
      <div class="avatar-preview">
        {{#if avatarUrl}}
          <img src="{{avatarUrl}}" alt="{{displayName}} avatar" />
        {{else}}
          <div class="logo-placeholder">{{t "profile.photoPlaceholder" "No photo selected"}}</div>
        {{/if}}
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "profile.hint" "Click your profile in the sidebar to update later."}}</div>
        <div class="modal-actions">
          <button id="save-profile">{{t "profile.save" "Save profile"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const adminMachine = createMachine({
    id: "admin",
    initial: "boot",
    context: {
        user: null,
        studio: null,
        route: "calendar",
        calendarView: "week",
        calendarDate: toDateInputValue(new Date()),
        calendarSearch: "",
        data: {},
        error: ""
    },
    on: {
        NAVIGATE: {
            target: ".loading",
            guard: "isAuthenticated",
            actions: "setRoute"
        },
        SET_CALENDAR: {
            target: ".loading",
            guard: "isAuthenticated",
            actions: "setCalendar"
        },
        SET_CALENDAR_SEARCH: {
            actions: "setCalendarSearch"
        }
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
                    target: "login",
                    actions: "setError"
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
                SET_CALENDAR: {
                    target: "loading",
                    actions: "setCalendar"
                },
                SET_CALENDAR_SEARCH: {
                    actions: "setCalendarSearch"
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
                error: ""
            };
        }),
        setRoute: assign(({ context, event }) => ({
            ...context,
            route: event.route
        })),
        setCalendar: assign(({ context, event }) => ({
            ...context,
            calendarView: event.view ?? context.calendarView,
            calendarDate: event.date ?? context.calendarDate,
            calendarSearch: event.search ?? context.calendarSearch
        })),
        setCalendarSearch: assign(({ context, event }) => ({
            ...context,
            calendarSearch: event.search ?? ""
        })),
        setData: assign(({ context, event }) => ({
            ...context,
            data: event.output,
            error: ""
        })),
        setError: assign(({ context, event }) => {
            const message = event.error?.message;
            const status = event.error?.status;
            const shouldLogout = message === "LOGOUT" || status === 401 || status === 403;
            return {
                ...context,
                user: shouldLogout ? null : context.user,
                studio: shouldLogout ? null : context.studio,
                error: shouldLogout ? "" : (message || "Unable to load data")
            };
        })
    },
    guards: {
        isAuthenticated: ({ context }) => !!context.user
    },
    actors: {
        loadSession: fromPromise(async () => {
            await setLocale("admin", resolveLocale(getStoredLocale("admin"), "", navigator.language));
            if (consumeForceLogout()) {
                throw new Error("LOGOUT");
            }
            try {
                const session = await getSession();
                const role = (session?.user?.role || "").toLowerCase();
                if (!["admin", "staff"].includes(role)) {
                    await logout();
                    throw new Error("Admin access required. Please log in with an Admin or Staff account.");
                }
                const locale = resolveLocale(
                    session?.user?.preferredLocale,
                    session?.studio?.defaultLocale || "en",
                    navigator.language
                );
                await setLocale("admin", locale);
                return { user: session.user, studio: session.studio };
            } catch (error) {
                const slug = sessionHint.studioSlug || "demo";
                try {
                    const studio = await apiGet(`/api/public/studios/${slug}`);
                    const locale = resolveLocale("", studio?.defaultLocale || "en", navigator.language);
                    await setLocale("admin", locale);
                } catch {
                    // ignore locale fallback errors
                }
                throw error;
            }
        }),
        loadRoute: fromPromise(async ({ input }) => {
            debugLog("loadRoute:start", {
                route: input.route,
                hash: window.location.hash,
                path: window.location.pathname
            });
            let studio;
            try {
                studio = await apiGet("/api/admin/studio");
            } catch (error) {
                if (error.status === 401 || error.status === 403) {
                    await logout();
                    throw new Error("LOGOUT");
                }
                debugLog("loadRoute:error", { route: input.route, message: error.message, status: error.status });
                throw error;
            }
            switch (input.route) {
                case "calendar": {
                    const view = input.calendarView || "week";
                    const focusDate = input.calendarDate || toDateInputValue(new Date());
                    const range = getCalendarRange(view, focusDate, 0);
                    const [items, rooms, instructors, customers, plans, planCategories, customerTags] = await Promise.all([
                        apiGet(`/api/admin/calendar?from=${range.from}&to=${range.to}`),
                        apiGet("/api/admin/rooms"),
                        apiGet("/api/admin/instructors"),
                        apiGet("/api/admin/customers"),
                        apiGet("/api/admin/plans"),
                        apiGet("/api/admin/plan-categories"),
                        apiGet("/api/admin/customer-tags")
                    ]);
                    return { studio, items, rooms, instructors, customers, plans, planCategories, customerTags, calendar: { view, focusDate, studio, range } };
                }
                case "events": {
                    const [series, rooms, instructors, plans, planCategories] = await Promise.all([
                        apiGet("/api/admin/event-series"),
                        apiGet("/api/admin/rooms"),
                        apiGet("/api/admin/instructors"),
                        apiGet("/api/admin/plans"),
                        apiGet("/api/admin/plan-categories")
                    ]);
                    return { studio, series, rooms, instructors, plans, planCategories };
                }
                case "rooms": {
                    const rooms = await apiGet("/api/admin/rooms");
                    return { studio, rooms };
                }
                case "plans": {
                    const [plans, planCategories] = await Promise.all([
                        apiGet("/api/admin/plans"),
                        apiGet("/api/admin/plan-categories")
                    ]);
                    return { studio, plans, planCategories };
                }
                case "audit": {
                    const from = getQueryParam("from") || "";
                    const to = getQueryParam("to") || "";
                    const search = getQueryParam("search") || "";
                    const params = new URLSearchParams();
                    if (from) params.set("from", from);
                    if (to) params.set("to", to);
                    if (search) params.set("search", search);
                    const qs = params.toString();
                    let logs = [];
                    let auditError = "";
                    try {
                        logs = await apiGet(`/api/admin/audit${qs ? `?${qs}` : ""}`);
                    } catch (error) {
                        auditError = error.message || t("audit.loadError", "Unable to load audit logs.");
                    }
                    return { studio, audit: { logs, filters: { from, to, search } }, auditError };
                }
                case "customers": {
                    const search = getQueryParam("search") || "";
                    const includeArchived = getQueryParam("archived") === "1";
                    const statusId = getQueryParam("statusId") || "";
                    const tag = getQueryParam("tag") || "";
                    const sort = getQueryParam("sort") || "";
                    const dir = getQueryParam("dir") || "";
                    const query = new URLSearchParams();
                    if (search) query.set("search", search);
                    if (includeArchived) query.set("includeArchived", "true");
                    if (statusId) query.set("statusId", statusId);
                    if (tag) query.set("tag", tag);
                    if (sort) query.set("sort", sort);
                    if (dir) query.set("dir", dir);
                    const qs = query.toString();
                    const [customers, customerStatuses, customerTags] = await Promise.all([
                        apiGet(`/api/admin/customers${qs ? `?${qs}` : ""}`),
                        apiGet("/api/admin/customer-statuses"),
                        apiGet("/api/admin/customer-tags")
                    ]);
                    return { studio, customers, customerStatuses, customerTags, customerFilters: { search, includeArchived, statusId, tag, sort, dir } };
                }
                case "customer": {
                    const id = getRouteParam("customer");
                    if (!id) {
                        return { studio, customerDetails: null };
                    }
                    const customerDetails = await apiGet(`/api/admin/customers/${id}/details`);
                    const customerTags = await apiGet("/api/admin/customer-tags");
                    return { studio, customerDetails, customerTags };
                }
                case "users": {
                    const role = getQueryParam("role") || "";
                    const users = await apiGet("/api/admin/users");
                    return { studio, users, userFilters: { role } };
                }
                case "guests": {
                    const search = getQueryParam("search") || "";
                    const users = await apiGet("/api/admin/users");
                    return { studio, users, guestFilters: { search } };
                }
                case "reports": {
                    const revenue = await apiGet("/api/admin/reports/revenue");
                    const occupancy = await apiGet("/api/admin/reports/occupancy");
                    return { studio, revenue, occupancy };
                }
                case "payroll": {
                    const from = getQueryParam("from") || "";
                    const to = getQueryParam("to") || "";
                    const instructorId = getQueryParam("instructorId") || "";
                    const params = new URLSearchParams();
                    if (from) params.set("from", from);
                    if (to) params.set("to", to);
                    if (instructorId) params.set("instructorId", instructorId);
                    const qs = params.toString();
                    let payroll = { logs: [], instructors: [] };
                    let payrollError = "";
                    try {
                        payroll = await apiGet(`/api/admin/payroll${qs ? `?${qs}` : ""}`);
                    } catch (error) {
                        payrollError = error.message || t("payroll.loadError", "Unable to load payroll data.");
                    }
                    return { studio, payroll, payrollFilters: { from, to, instructorId }, payrollError };
                }
                case "billing": {
                    const from = getQueryParam("from") || "";
                    const to = getQueryParam("to") || "";
                    const status = getQueryParam("status") || "";
                    const customerId = getQueryParam("customerId") || "";
                    const sourceType = getQueryParam("sourceType") || "";
                    const params = new URLSearchParams();
                    if (from) params.set("from", from);
                    if (to) params.set("to", to);
                    if (status) params.set("status", status);
                    if (customerId) params.set("customerId", customerId);
                    if (sourceType) params.set("sourceType", sourceType);
                    const qs = params.toString();
                    let charges = [];
                    let billingError = "";
                    try {
                        charges = await apiGet(`/api/admin/billing/charges${qs ? `?${qs}` : ""}`);
                    } catch (error) {
                        billingError = error.message || t("billing.loadError", "Unable to load billing data.");
                    }
                    const [subscriptions, items, customers] = await Promise.all([
                        apiGet("/api/admin/billing/subscriptions"),
                        apiGet("/api/admin/billing/items"),
                        apiGet("/api/admin/customers")
                    ]);
                    return {
                        studio,
                        charges,
                        subscriptions,
                        items,
                        customers,
                        billingFilters: { from, to, status, customerId, sourceType },
                        billingError
                    };
                }
                case "invoices": {
                    const from = getQueryParam("from") || "";
                    const to = getQueryParam("to") || "";
                    const customerId = getQueryParam("customerId") || "";
                    const params = new URLSearchParams();
                    if (from) params.set("from", from);
                    if (to) params.set("to", to);
                    if (customerId) params.set("customerId", customerId);
                    const qs = params.toString();
                    let invoices = [];
                    let invoiceError = "";
                    try {
                        invoices = await apiGet(`/api/admin/invoices${qs ? `?${qs}` : ""}`);
                    } catch (error) {
                        invoiceError = error.message || t("invoices.loadError", "Unable to load invoices.");
                    }
                    const customers = await apiGet("/api/admin/customers");
                    return {
                        studio,
                        invoices,
                        customers,
                        invoiceFilters: { from, to, customerId },
                        invoiceError
                    };
                }
                case "settings": {
                    return { studio };
                }
                default:
                    debugLog("loadRoute:done", { route: input.route });
                    return { studio };
            }
        })
    }
});

const actor = createActor(adminMachine);

function render(state) {
    if (state.matches("login")) {
        root.innerHTML = loginTemplate({ error: state.context.error, studioSlug: sessionHint.studioSlug || "demo" });
        bindLogin();
        return;
    }

    const route = state.context.route;
    if (lastRenderedRoute !== route) {
        closeEventActionsMenu();
        clearModalEscape();
        document.querySelectorAll(".modal-overlay").forEach(overlay => overlay.remove());
        lastRenderedRoute = route;
    }
    debugLog("render", { route, state: state.value, hash: window.location.hash, path: window.location.pathname });
    const titleMap = {
        calendar: t("page.calendar.title", "Calendar"),
        events: t("page.events.title", "Event series"),
        rooms: t("page.rooms.title", "Rooms"),
        plans: t("page.plans.title", "Membership plans"),
        customers: t("page.customers.title", "Customer roster"),
        customer: t("page.customer.title", "Customer details"),
        users: t("page.users.title", "Team access"),
        guests: t("page.guests.title", "Guest directory"),
        reports: t("page.reports.title", "Performance pulse"),
        payroll: t("page.payroll.title", "Instructor payroll"),
        billing: t("page.billing.title", "Billing"),
        invoices: t("page.invoices.title", "Invoices"),
        audit: t("page.audit.title", "Audit log"),
        settings: t("page.settings.title", "Studio settings")
    };

    const subtitleMap = {
        calendar: t("page.calendar.subtitle", "Week view of live classes."),
        events: t("page.events.subtitle", "Templates that drive recurring schedules."),
        rooms: t("page.rooms.subtitle", "Spaces and rooms in the studio."),
        plans: t("page.plans.subtitle", "Sell weekly limits or unlimited passes."),
        customers: t("page.customers.subtitle", "Top-level view of active clients."),
        customer: t("page.customer.subtitle", "Customer profile and history."),
        users: t("page.users.subtitle", "Manage roles and instructor profiles."),
        guests: t("page.guests.subtitle", "Read-only viewers with schedule access."),
        reports: t("page.reports.subtitle", "Revenue and occupancy at a glance."),
        payroll: t("page.payroll.subtitle", "Track reported sessions and instructor rates."),
        billing: t("page.billing.subtitle", "Subscriptions, charges, and exports."),
        invoices: t("page.invoices.subtitle", "Invoice history and downloads."),
        audit: t("page.audit.subtitle", "Every change across admin, instructor, and client activity."),
        settings: t("page.settings.subtitle", "Brand and week logic.")
    };

    let content = "";
    const data = state.context.data || {};
    const studio = data.studio || data.calendar?.studio || {};
    const user = state.context.user || {};
    const theme = parseThemeJson(studio.themeJson);
    let subtitle = subtitleMap[route] || "";

    if (route === "calendar") {
        const calendarMeta = data.calendar || {};
        const view = calendarMeta.view || state.context.calendarView || "week";
        const focusDate = calendarMeta.focusDate || state.context.calendarDate || toDateInputValue(new Date());
        const studio = calendarMeta.studio || {};
        const timeZone = getLocalTimeZone();
        const weekStartsOn = 0;
        const search = state.context.calendarSearch || "";
        const viewState = buildCalendarView(data.items || [], {
            view,
            focusDate,
            timeZone,
            weekStartsOn,
            search,
            customers: data.customers || []
        });
        viewState.focusDateDisplay = formatDateDisplay(focusDate);
        viewState.focusDateValue = normalizeDateInputValue(focusDate);
        const subtitleMapView = {
            day: t("calendar.subtitle.day", "Daily schedule focus."),
            week: t("calendar.subtitle.week", "Weekly schedule overview."),
            month: t("calendar.subtitle.month", "Month at a glance."),
            list: t("calendar.subtitle.list", "List view of sessions.")
        };
        subtitle = subtitleMapView[view] || subtitle;
        content = calendarTemplate(viewState);
    }

    if (route === "events") {
        const dayNames = getWeekdayNames(0);
        const series = (data.series || []).map(item => ({
            ...item,
            dayLabel: (() => {
                const days = resolveSeriesDays(item);
                if (days.length) {
                    return days.map(day => dayNames[day] || "").filter(Boolean).join(", ");
                }
                return dayNames[item.dayOfWeek] || "";
            })(),
            startTimeLocal: (item.startTimeLocal || "").slice(0, 5),
            activeLabel: item.isActive ? t("common.yes", "Yes") : t("common.no", "No"),
            icon: item.icon || "",
            color: item.color || "#f1c232",
            remoteCapacity: item.remoteCapacity ?? 0
        }));
        content = eventsTemplate({
            series,
            hasSeries: series.length > 0
        });
    }

    if (route === "rooms") {
        content = roomsTemplate({ rooms: data.rooms || [] });
    }

    if (route === "plans") {
        const plans = (data.plans || []).map(plan => ({
            ...plan,
            price: formatPlainPrice(plan.priceCents),
            typeLabel: formatPlanType(plan.type),
            activeLabel: plan.active ? t("common.yes", "Yes") : t("common.no", "No")
        }));
        content = plansTemplate({ plans });
    }

    if (route === "customers") {
        const tagColorMap = buildTagColorMap(data.customerTags || []);
        const customers = (data.customers || []).map(c => {
            const tagsValue = c.tags || formatTags(c.tagsJson);
            return {
            ...c,
            statusLabel: formatCustomerStatus(c.isArchived ? "Archived" : (c.statusName || "Active")),
            archiveLabel: c.isArchived ? t("customers.restore", "Restore") : t("customers.archive", "Archive"),
            tagsHtml: renderTagChips(tagsValue, tagColorMap)
        };
        });
        const filters = data.customerFilters || { search: "", includeArchived: false, statusId: "", tag: "", sort: "", dir: "" };
        const statusOptions = (data.customerStatuses || [])
            .filter(status => status.isActive !== false)
            .map(status => ({
                id: status.id,
                name: formatCustomerStatus(status.name),
                selected: String(status.id) === String(filters.statusId || "")
            }));
        const tagOptions = collectTagSuggestions(data.customers || [], data.customerTags || []).map(tagValue => ({
            value: tagValue,
            selected: String(tagValue) === String(filters.tag || "")
        }));
        const sortKey = (filters.sort || "").toLowerCase();
        const sortDir = (filters.dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
        content = customersTemplate({
            customers,
            search: filters.search || "",
            includeArchived: filters.includeArchived,
            statusOptions,
            tagOptions,
            sortKey,
            sortDir
        });
    }

    if (route === "customer") {
        const details = data.customerDetails || {};
        const customer = details.customer || {};
        if (!customer.id) {
            content = `<div class="empty-state">${t("customer.details.notFound", "Customer not found.")}</div>`;
        } else {
        const tagColorMap = buildTagColorMap(data.customerTags || []);
        const statusLabel = formatCustomerStatus(customer.isArchived ? "Archived" : (customer.statusName || "Active"));
        const signedHealthTag = customer.signedHealthView
            ? `<span class="tag tag-accent">${t("customer.waiverValid", "V - Valid Waiver")}</span>`
            : `<span class="tag tag-danger">${t("customer.waiverMissing", "No Waiver")}</span>`;
        const registrations = formatCustomerRegistrations(details.registrations || []);
        const recentRegistrations = registrations.slice(0, 5);
        const ageLabel = formatAgeLabel(customer.dateOfBirth);
        const invoices = (details.invoices || []).map(item => ({
            ...item,
            issuedLabel: formatDateDisplay(item.issuedAtUtc),
            amountLabel: formatPlainPrice(item.totalCents),
            url: item.url || ""
        }));
        const recentInvoices = invoices.slice(0, 5);
        const attachments = (details.attachments || []).map(item => ({
            ...item,
            uploadedLabel: formatDateTime(item.uploadedAtUtc),
            downloadUrl: `/api/admin/customers/${customer.id}/attachments/${item.id}`
        }));
        const healthDeclarations = (details.healthDeclarations || []).map(item => ({
            ...item,
            submittedLabel: formatDateTime(item.submittedAtUtc),
            signatureName: item.signatureName || "",
            signatureType: item.signatureType || ""
        }));
        const auditLogs = (details.auditLogs || []).map(log => ({
            ...log,
            timeLabel: formatDateTime(log.createdAtUtc),
            actorLabel: log.actorName || log.actorRole || "-",
            actionLabel: formatAuditAction(log.action || ""),
            summary: translateAuditSummary(log)
        }));
        const tagsHtml = renderTagChips(customer.tags || formatTags(customer.tagsJson), tagColorMap);
        content = customerDetailsTemplate({
            ...customer,
            statusLabel,
            signedHealthTag,
            dateOfBirth: customer.dateOfBirth ? formatDateDisplay(customer.dateOfBirth) : "",
            ageLabel,
            tagsHtml,
            registrations,
            recentRegistrations,
            recentInvoices,
            attachments,
            healthDeclarations,
            auditLogs
        });
        }
    }

    if (route === "users") {
        const filters = data.userFilters || { role: "" };
        const roleOptions = [
            { value: "", label: t("users.filterAll", "All roles"), selected: !filters.role },
            { value: "Admin", label: t("roles.admin", "Admin"), selected: filters.role === "Admin" },
            { value: "Staff", label: t("roles.staff", "Staff"), selected: filters.role === "Staff" },
            { value: "Instructor", label: t("roles.instructor", "Instructor"), selected: filters.role === "Instructor" }
        ];
        const users = (data.users || [])
            .filter(item => {
                const roles = item.roles || [item.role];
                const guestOnly = roles.length === 1 && roles[0] === "Guest";
                if (guestOnly) return false;
                if (!filters.role) return true;
                return roles.includes(filters.role);
            })
            .map(item => ({
            ...item,
            statusLabel: item.isActive ? t("users.status.active", "Active") : t("users.status.inactive", "Inactive"),
            rolesLabel: (item.roles || [item.role]).join(", "),
            instructorLabel: (item.roles || [item.role]).includes("Instructor")
                ? (item.instructorName || t("users.needsProfile", "Needs profile"))
                : "-"
        }));
        content = usersTemplate({
            users,
            roleOptions
        });
    }

    if (route === "guests") {
        const searchValue = data.guestFilters?.search || "";
        const guests = (data.users || [])
            .filter(item => (item.roles || [item.role]).includes("Guest"))
            .filter(item => {
                if (!searchValue) return true;
                const term = searchValue.toLowerCase();
                return (item.displayName || "").toLowerCase().includes(term) ||
                    (item.email || "").toLowerCase().includes(term);
            })
            .map(item => ({
                ...item,
                statusLabel: item.isActive ? t("guests.status.active", "Active") : t("guests.status.inactive", "Inactive"),
                createdLabel: formatShortDate(item.createdAtUtc)
            }));

        content = guestDirectoryTemplate({
            guests,
            search: searchValue
        });
    }

    if (route === "reports") {
        const revenue = formatMoney(data.revenue?.totalCents || 0, "ILS");
        const totalSessions = (data.occupancy || []).reduce((sum, item) => sum + item.sessions, 0);
        const totalCapacity = (data.occupancy || []).reduce((sum, item) => sum + item.capacity, 0);
        const totalBooked = (data.occupancy || []).reduce((sum, item) => sum + item.booked, 0);
        const occupancyRate = totalCapacity ? Math.round((totalBooked / totalCapacity) * 100) : 0;
        content = reportsTemplate({ revenue, sessions: totalSessions, occupancy: occupancyRate });
    }

    if (route === "payroll") {
        const payroll = data.payroll || {};
        const logs = (payroll.logs || []).map(entry => {
            const rateLabel = `${formatMoney(entry.rateCents || 0, entry.currency || "ILS")} / ${formatPayrollUnit(entry.rateUnit)}`;
            const amountLabel = formatMoney(entry.amountCents || 0, entry.currency || "ILS");
            const unitsValue = Number(entry.units || 0);
            const unitsLabel = entry.rateUnit === "Hour"
                ? unitsValue.toFixed(2)
                : String(Math.round(unitsValue || 0));
            return {
                ...entry,
                reportedAtLabel: formatShortDateTime(entry.reportedAtUtc),
                instructorLabel: entry.instructorName || "-",
                sessionLabel: entry.sessionTitle || t("payroll.sessionFallback", "Session"),
                sessionDateLabel: entry.sessionStartUtc ? formatShortDateTime(entry.sessionStartUtc) : "-",
                attendanceLabel: `${entry.presentCount || 0} / ${entry.bookedCount || 0}`,
                unitsLabel,
                rateLabel,
                amountLabel,
                reportedByLabel: entry.reportedByName || "-"
            };
        });
        const totalPayoutCents = logs.reduce((sum, entry) => sum + (entry.amountCents || 0), 0);
        const instructorOptions = (payroll.instructors || []).map(instructor => ({
            id: instructor.id,
            name: instructor.displayName,
            selected: String(instructor.id) === String(data.payrollFilters?.instructorId || "")
        }));
        const filters = data.payrollFilters || {};
        const fromValue = filters.from ? normalizeDateInputValue(filters.from) : "";
        const toValue = filters.to ? normalizeDateInputValue(filters.to) : "";
        content = payrollTemplate({
            logs,
            hasLogs: logs.length > 0,
            totalPayout: formatMoney(totalPayoutCents, "ILS"),
            totalSessions: logs.length,
            instructorOptions,
            from: filters.from || "",
            to: filters.to || "",
            fromValue,
            toValue,
            errorMessage: data.payrollError || ""
        });
    }

    if (route === "billing") {
        const filters = data.billingFilters || { from: "", to: "", status: "", customerId: "", sourceType: "" };
        const today = new Date();
        const defaultFrom = normalizeDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
        const defaultTo = normalizeDateInputValue(today);
        const runRangeEnabled = Boolean(filters.from || filters.to);
        const customers = (data.customers || []).map(customer => ({
            id: customer.id,
            name: customer.fullName || customer.email || customer.phone || "-"
        }));
        const customerOptions = [
            { id: "", name: t("billing.customerAll", "All customers"), selected: !filters.customerId },
            ...customers.map(customer => ({
                ...customer,
                selected: String(customer.id) === String(filters.customerId || "")
            }))
        ];
        const statusOptions = [
            { value: "", label: t("billing.statusAll", "All statuses"), selected: !filters.status },
            { value: "Draft", label: formatBillingChargeStatus("Draft"), selected: filters.status === "Draft" },
            { value: "Posted", label: formatBillingChargeStatus("Posted"), selected: filters.status === "Posted" },
            { value: "Voided", label: formatBillingChargeStatus("Voided"), selected: filters.status === "Voided" }
        ];
        const sourceOptions = [
            { value: "", label: t("billing.sourceAll", "All sources"), selected: !filters.sourceType },
            { value: "subscription", label: formatBillingSource("subscription"), selected: filters.sourceType === "subscription" },
            { value: "session_registration", label: formatBillingSource("session_registration"), selected: filters.sourceType === "session_registration" },
            { value: "workshop_registration", label: formatBillingSource("workshop_registration"), selected: filters.sourceType === "workshop_registration" },
            { value: "manual", label: formatBillingSource("manual"), selected: filters.sourceType === "manual" },
            { value: "fee", label: formatBillingSource("fee"), selected: filters.sourceType === "fee" },
            { value: "adjustment", label: formatBillingSource("adjustment"), selected: filters.sourceType === "adjustment" }
        ];
        const charges = (data.charges || []).map(charge => ({
            ...charge,
            chargeDateLabel: charge.chargeDate ? formatDateDisplay(new Date(charge.chargeDate)) : "-",
            amountLabel: formatPlainPrice(charge.totalCents),
            statusLabel: formatBillingChargeStatus(charge.status),
            sourceLabel: formatBillingSource(charge.sourceType),
            invoiceNo: charge.invoiceNo || "",
            invoiceUrl: charge.invoiceUrl || ""
        }));
        const subscriptions = (data.subscriptions || []).map(sub => ({
            ...sub,
            nextChargeLabel: sub.nextChargeDate ? formatDateDisplay(new Date(sub.nextChargeDate)) : "-",
            amountLabel: formatPlainPrice(sub.priceCents),
            statusLabel: formatBillingSubscriptionStatus(sub.status),
            canPause: String(sub.status) === "Active",
            canResume: String(sub.status) === "Paused"
        }));
        const items = (data.items || []).map(item => ({
            ...item,
            typeLabel: formatBillingItemType(item.type),
            priceLabel: formatPlainPrice(item.defaultPriceCents),
            statusLabel: item.active ? t("common.yes", "Yes") : t("common.no", "No")
        }));
        const chargesCount = `${charges.length} ${t("billing.chargeCount", "charges")}`;
        content = billingTemplate({
            fromValue: runRangeEnabled ? (filters.from || "") : defaultFrom,
            toValue: runRangeEnabled ? (filters.to || "") : defaultTo,
            runRangeEnabled,
            customerOptions,
            statusOptions,
            sourceOptions,
            charges,
            subscriptions,
            items,
            chargesCount,
            errorMessage: data.billingError || ""
        });
    }

    if (route === "invoices") {
        const filters = data.invoiceFilters || { from: "", to: "", customerId: "" };
        const customers = (data.customers || []).map(customer => ({
            id: customer.id,
            name: customer.fullName || customer.email || customer.phone || "-"
        }));
        const customerOptions = [
            { id: "", name: t("invoices.customerAll", "All customers"), selected: !filters.customerId },
            ...customers.map(customer => ({
                ...customer,
                selected: String(customer.id) === String(filters.customerId || "")
            }))
        ];
        const invoices = (data.invoices || []).map(invoice => ({
            ...invoice,
            issuedLabel: invoice.issuedAtUtc ? formatDateDisplay(new Date(invoice.issuedAtUtc)) : "-",
            amountLabel: formatPlainPrice(invoice.totalCents)
        }));
        const invoiceCount = `${invoices.length} ${t("invoices.count", "invoices")}`;
        content = invoicesTemplate({
            fromValue: filters.from || "",
            toValue: filters.to || "",
            customerOptions,
            invoices,
            hasInvoices: invoices.length > 0,
            invoiceCount,
            errorMessage: data.invoiceError || ""
        });
    }

    if (route === "audit") {
        const logs = (data.audit?.logs || []).map(log => {
            const actorLabel = log.actorName || log.actorEmail || log.actorRole || "-";
            const entityLabel = formatAuditEntity(log.entityType);
            const relatesToLabel = log.entityId ? `${entityLabel} #${log.entityId}` : entityLabel;
            return {
                ...log,
                timeLabel: formatShortDateTime(log.createdAtUtc),
                actorLabel,
                actionLabel: formatAuditAction(log.action),
                relatesToLabel,
                summary: translateAuditSummary(log)
            };
        });
        const filters = data.audit?.filters || {};
        const fromValue = filters.from ? normalizeDateInputValue(filters.from) : "";
        const toValue = filters.to ? normalizeDateInputValue(filters.to) : "";
        const clearBeforeValue = filters.to || "";
        const clearBeforeDisplay = clearBeforeValue ? normalizeDateInputValue(clearBeforeValue) : "";
        content = auditTemplate({
            logs,
            hasLogs: logs.length > 0,
            from: filters.from || "",
            to: filters.to || "",
            fromValue,
            toValue,
            search: filters.search || "",
            clearBefore: clearBeforeValue,
            clearBeforeValue: clearBeforeDisplay,
            errorMessage: data.auditError || ""
        });
    }

    if (route === "audit") {
        const applyBtn = document.getElementById("apply-audit");
        const exportBtn = document.getElementById("export-audit");
        const clearBtn = document.getElementById("clear-audit");

        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                const fromRaw = document.querySelector("[name=\"auditFrom\"]")?.value || "";
                const toRaw = document.querySelector("[name=\"auditTo\"]")?.value || "";
                const from = normalizeDateInputValue(fromRaw);
                const to = normalizeDateInputValue(toRaw);
                const search = document.querySelector("[name=\"auditSearch\"]")?.value || "";
                const params = new URLSearchParams();
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (search) params.set("search", search);
                const query = params.toString();
                window.location.hash = `#/audit${query ? `?${query}` : ""}`;
                actor.send({ type: "REFRESH" });
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                const fromRaw = document.querySelector("[name=\"auditFrom\"]")?.value || "";
                const toRaw = document.querySelector("[name=\"auditTo\"]")?.value || "";
                const from = normalizeDateInputValue(fromRaw);
                const to = normalizeDateInputValue(toRaw);
                const search = document.querySelector("[name=\"auditSearch\"]")?.value || "";
                const params = new URLSearchParams();
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (search) params.set("search", search);
                const query = params.toString();
                window.location.href = `/api/admin/audit/export${query ? `?${query}` : ""}`;
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener("click", async () => {
                const beforeRaw = document.querySelector("[name=\"auditClearBefore\"]")?.value || "";
                const before = normalizeDateInputValue(beforeRaw);
                if (!before) {
                    showToast(t("audit.clearBeforeRequired", "Choose a date to clear before."), "error");
                    return;
                }
                if (!window.confirm(t("audit.clearConfirm", "Clear audit logs before this date?"))) {
                    return;
                }
                try {
                    await apiDelete(`/api/admin/audit?before=${encodeURIComponent(before)}`);
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("audit.clearError", "Unable to clear audit logs."), "error");
                }
            });
        }
    }

    if (route === "payroll") {
        const applyBtn = document.getElementById("apply-payroll");
        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                const fromRaw = document.querySelector("[name=\"payrollFrom\"]")?.value || "";
                const toRaw = document.querySelector("[name=\"payrollTo\"]")?.value || "";
                const from = normalizeDateInputValue(fromRaw);
                const to = normalizeDateInputValue(toRaw);
                const instructorId = document.querySelector("[name=\"payrollInstructor\"]")?.value || "";
                const params = new URLSearchParams();
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (instructorId) params.set("instructorId", instructorId);
                const query = params.toString();
                window.location.hash = `#/payroll${query ? `?${query}` : ""}`;
            });
        }
    }

    if (route === "billing") {
        const runBtn = document.getElementById("billing-run");
        const exportBtn = document.getElementById("billing-export");
        const newChargeBtn = document.getElementById("billing-new-charge");
        const newSubscriptionBtn = document.getElementById("billing-new-subscription");
        const newItemBtn = document.getElementById("billing-new-item");
        const applyBtn = document.getElementById("billing-apply");
        const runGuard = document.getElementById("billing-run-guard");

        if (runGuard) {
            syncBillingRangeGuard();
            runGuard.addEventListener("change", syncBillingRangeGuard);
        }

        if (runBtn) {
            runBtn.addEventListener("click", async () => {
                const { useCustom, fromValue, toValue } = resolveBillingRunRange();
                if (useCustom && (!fromValue || !toValue)) {
                    showToast(t("billing.runRangeError", "Select a date range first."), "error");
                    return;
                }
                const message = t("billing.runConfirmMessage", "Generate charges from {from} to {to}.")
                    .replace("{from}", formatDateDisplay(fromValue))
                    .replace("{to}", formatDateDisplay(toValue));
                openConfirmModal({
                    title: t("billing.runConfirmTitle", "Run billing?"),
                    message,
                    confirmLabel: t("billing.runConfirm", "Run billing"),
                    cancelLabel: t("common.cancel", "Cancel"),
                    onConfirm: async () => {
                        try {
                            const params = new URLSearchParams();
                            if (fromValue) params.set("from", fromValue);
                            if (toValue) params.set("to", toValue);
                            const qs = params.toString();
                            await apiPost(`/api/admin/billing/run${qs ? `?${qs}` : ""}`, {});
                            showToast(t("billing.runSuccess", "Billing run complete."), "success");
                            actor.send({ type: "REFRESH" });
                        } catch (error) {
                            showToast(error.message || t("billing.runError", "Unable to run billing."), "error");
                        }
                    }
                });
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                const fromValue = document.querySelector("[name=\"billingFrom\"]")?.value || "";
                const toValue = document.querySelector("[name=\"billingTo\"]")?.value || "";
                const params = new URLSearchParams();
                if (fromValue) params.set("from", fromValue);
                if (toValue) params.set("to", toValue);
                const qs = params.toString();
                window.location.href = `/api/admin/billing/charges/export${qs ? `?${qs}` : ""}`;
            });
        }

        if (newChargeBtn) {
            newChargeBtn.addEventListener("click", () => {
                openBillingChargeModal(data);
            });
        }

        if (newSubscriptionBtn) {
            newSubscriptionBtn.addEventListener("click", () => {
                openBillingSubscriptionModal(data);
            });
        }

        if (newItemBtn) {
            newItemBtn.addEventListener("click", () => {
                openBillingItemModal(null);
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                const fromRaw = document.querySelector("[name=\"billingFrom\"]")?.value || "";
                const toRaw = document.querySelector("[name=\"billingTo\"]")?.value || "";
                const statusValue = document.querySelector("[name=\"billingStatus\"]")?.value || "";
                const customerValue = document.querySelector("[name=\"billingCustomer\"]")?.value || "";
                const sourceValue = document.querySelector("[name=\"billingSource\"]")?.value || "";
                const params = new URLSearchParams();
                if (fromRaw) params.set("from", fromRaw);
                if (toRaw) params.set("to", toRaw);
                if (statusValue) params.set("status", statusValue);
                if (customerValue) params.set("customerId", customerValue);
                if (sourceValue) params.set("sourceType", sourceValue);
                const query = params.toString();
                window.location.hash = `#/billing${query ? `?${query}` : ""}`;
            });
        }

        document.querySelectorAll("[data-item-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-item-edit");
                const item = (data.items || []).find(entry => String(entry.id) === String(id));
                if (!item) return;
                openBillingItemModal(item);
            });
        });

        document.querySelectorAll("[data-charge-void]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-charge-void");
                if (!id) return;
                openBillingVoidModal(id);
            });
        });

        document.querySelectorAll("[data-charge-adjust]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-charge-adjust");
                if (!id) return;
                openBillingAdjustModal(id);
            });
        });

        document.querySelectorAll("[data-subscription-pause]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-subscription-pause");
                if (!id) return;
                try {
                    await apiPost(`/api/admin/billing/subscriptions/${id}/pause`, {});
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("billing.pauseError", "Unable to pause subscription."), "error");
                }
            });
        });

        document.querySelectorAll("[data-subscription-resume]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-subscription-resume");
                if (!id) return;
                try {
                    await apiPost(`/api/admin/billing/subscriptions/${id}/resume`, {});
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("billing.resumeError", "Unable to resume subscription."), "error");
                }
            });
        });

        document.querySelectorAll("[data-subscription-cancel]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-subscription-cancel");
                if (!id) return;
                openConfirmModal({
                    title: t("billing.cancelTitle", "Cancel subscription?"),
                    message: t("billing.cancelMessage", "This will stop future billing."),
                    confirmLabel: t("billing.cancel", "Cancel"),
                    cancelLabel: t("common.cancel", "Cancel"),
                    onConfirm: async () => {
                        try {
                            await apiPost(`/api/admin/billing/subscriptions/${id}/cancel`, {});
                            actor.send({ type: "REFRESH" });
                        } catch (error) {
                            showToast(error.message || t("billing.cancelError", "Unable to cancel subscription."), "error");
                        }
                    }
                });
            });
        });
    }

    if (route === "invoices") {
        const applyBtn = document.getElementById("invoice-apply");
        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                const fromRaw = document.querySelector("[name=\"invoiceFrom\"]")?.value || "";
                const toRaw = document.querySelector("[name=\"invoiceTo\"]")?.value || "";
                const customerValue = document.querySelector("[name=\"invoiceCustomer\"]")?.value || "";
                const params = new URLSearchParams();
                if (fromRaw) params.set("from", fromRaw);
                if (toRaw) params.set("to", toRaw);
                if (customerValue) params.set("customerId", customerValue);
                const query = params.toString();
                window.location.hash = `#/invoices${query ? `?${query}` : ""}`;
            });
        }
    }

    if (route === "settings") {
        const logoUrl = theme.logoUrl || "";
        const faviconUrl = theme.faviconUrl || "";
        let themeJson = studio.themeJson || "{}";
        try {
            themeJson = JSON.stringify(JSON.parse(themeJson), null, 2);
        } catch {
            // Keep raw theme JSON if it's not valid.
        }
        const defaultLocale = studio.defaultLocale || "en";
        const userLocale = user.preferredLocale || "";
        const languages = [
            { value: "en", label: t("language.en", "English") },
            { value: "he", label: t("language.he", "Hebrew") }
        ];
        const defaultLanguageOptions = languages.map(option => ({
            ...option,
            selected: option.value === defaultLocale
        }));
        const userLanguageOptions = [
            {
                value: "",
                label: t("settings.userLocaleDefault", "Use studio default"),
                selected: !userLocale
            },
            ...languages.map(option => ({
                ...option,
                selected: option.value === userLocale
            }))
        ];
        const holidayCalendars = parseStringListJson(studio.holidayCalendarsJson);
        const selectedHolidayCalendars = holidayCalendars.length ? holidayCalendars : ["hebrew"];
        const holidayCalendarOptions = [
            {
                id: "hebrew",
                label: t("settings.holidays.hebrew", "Hebrew calendar"),
                selected: selectedHolidayCalendars.includes("hebrew")
            }
        ];
        content = settingsTemplate({
            name: studio.name || "",
            logoUrl,
            faviconUrl,
            weekStartsOn: studio.weekStartsOn || 0,
            themeJson,
            themePrimary: ensureHexColor(theme.primary, "#f1c232"),
            themeSecondary: ensureHexColor(theme.secondary, "#f6d88a"),
            themeAccent: ensureHexColor(theme.accent, "#f9e7b7"),
            themeBackground: ensureHexColor(theme.background, "#fff7de"),
            googlePlacesApiKey: studio.googlePlacesApiKey || "",
            defaultLanguageOptions,
            userLanguageOptions,
            holidayCalendarOptions
        });
    }

    const userName = user.displayName || t("profile.userFallback", "Studio user");
    const userEmail = user.email || "";
    const userRolesLabel = (user.roles || [user.role]).filter(Boolean).join(", ");

    const shouldRefocusSearch = route === "calendar"
        && (calendarSearchShouldFocus || document.activeElement?.id === "calendar-search");
    root.innerHTML = layoutTemplate({
        title: titleMap[route] || "Admin",
        subtitle,
        content,
        studioName: studio.name || "Yogin Studio",
        logoUrl: theme.logoUrl || "",
        userName,
        userEmail,
        userRolesLabel,
        userInitials: getInitials(userName || userEmail),
        userAvatarUrl: user.avatarUrl || ""
    });
    setFavicon(theme.faviconUrl || theme.logoUrl || "");

    applySidebarState(getSidebarState());
    if (route !== "calendar") {
        calendarSearchShouldFocus = false;
    }
    if (shouldRefocusSearch) {
        const searchInput = document.getElementById("calendar-search");
        if (searchInput) {
            searchInput.focus();
            searchInput.selectionStart = searchInput.value.length;
            searchInput.selectionEnd = searchInput.value.length;
        }
    }

    const navigateToRoute = (routeName) => {
        const targetHash = `#/${routeName}`;
        debugLog("nav:navigate", { routeName, targetHash });
        actor.send({ type: "NAVIGATE", route: routeName });
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }
    };
    document.querySelectorAll(".nav a").forEach(link => {
        const routeName = link.getAttribute("data-route");
        if (routeName === route) {
            link.classList.add("active");
        }
        link.addEventListener("click", (event) => {
            event.preventDefault();
            if (!routeName) return;
            debugLog("nav:click", { routeName, hash: window.location.hash });
            navigateToRoute(routeName);
        });
    });

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await logout();
            const baseUrl = `${window.location.pathname}${window.location.search}`;
            window.location.href = baseUrl;
        });
    }

    const profileCard = document.getElementById("user-profile-card");
    if (profileCard) {
        profileCard.addEventListener("click", () => {
            openProfileModal(user, studio);
        });
    }

    const toggleBtn = document.getElementById("toggle-sidebar");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const next = !getSidebarState();
            setSidebarState(next);
            applySidebarState(next);
        });
    }

    bindRouteActions(route, data, state);
}

function bindLogin() {
    const form = document.getElementById("login-form");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            email: formData.get("email"),
            password: formData.get("password"),
            role: formData.get("role"),
            studioSlug: formData.get("studioSlug")
        };
        try {
            const result = await login(payload);
            const locale = resolveLocale(
                result?.user?.preferredLocale,
                result?.studio?.defaultLocale || "en",
                navigator.language
            );
            await setLocale("admin", locale);
            actor.send({ type: "LOGIN_SUCCESS", output: result });
        } catch (error) {
            actor.send({ type: "LOGIN_FAILURE", error });
            root.innerHTML = loginTemplate({ error: error.message, studioSlug: payload.studioSlug });
            bindLogin();
        }
    });
}

function bindRouteActions(route, data, state) {
    if (route === "calendar") {
        const calendarMeta = data.calendar || {};
        const currentView = calendarMeta.view || state.context.calendarView || "week";
        const currentDate = calendarMeta.focusDate || state.context.calendarDate || toDateInputValue(new Date());
        const viewButtons = document.querySelectorAll("button[data-view]");
        const navButtons = document.querySelectorAll("button[data-nav]");
        const dateInput = document.getElementById("calendar-date");
        const searchInput = document.getElementById("calendar-search");
        const todayBtn = document.getElementById("calendar-today");

        viewButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const view = btn.getAttribute("data-view") || "week";
                const selectedDate = dateInput?.value || currentDate;
                actor.send({ type: "SET_CALENDAR", view, date: selectedDate });
            });
        });

        navButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const navType = btn.getAttribute("data-nav");
                const direction = navType === "prev" ? -1 : 1;
                const baseDate = normalizeDateInputValue(dateInput?.value) || currentDate;
                const nextDate = shiftCalendarDate(currentView, baseDate, direction);
                actor.send({ type: "SET_CALENDAR", view: currentView, date: nextDate });
            });
        });

        if (dateInput) {
            dateInput.addEventListener("change", () => {
                const normalized = normalizeDateInputValue(dateInput.value) || currentDate;
                dateInput.value = formatDateDisplay(normalized);
                actor.send({ type: "SET_CALENDAR", view: currentView, date: normalized });
            });
            dateInput.addEventListener("blur", () => {
                const normalized = normalizeDateInputValue(dateInput.value);
                if (normalized) {
                    dateInput.value = formatDateDisplay(normalized);
                }
            });
        }

        if (todayBtn) {
            todayBtn.addEventListener("click", () => {
                const today = toDateInputValue(new Date());
                actor.send({ type: "SET_CALENDAR", view: currentView, date: today });
            });
        }

        if (searchInput) {
            const markFocus = () => {
                calendarSearchShouldFocus = true;
            };
            searchInput.addEventListener("focus", markFocus);
            searchInput.addEventListener("click", markFocus);
            searchInput.addEventListener("blur", () => {
                calendarSearchShouldFocus = false;
            });
            searchInput.addEventListener("input", () => {
                calendarSearchShouldFocus = true;
                actor.send({ type: "SET_CALENDAR_SEARCH", search: searchInput.value || "" });
            });
        }

        document.querySelectorAll(".calendar-export [data-export]").forEach(button => {
            button.addEventListener("click", () => {
                const type = button.getAttribute("data-export");
                if (!type) return;
                const studioMeta = calendarMeta.studio || data.studio || {};
                const range = calendarMeta.range || getCalendarRange(currentView, currentDate, 0);
                const params = new URLSearchParams();
                if (range?.from) params.set("from", range.from);
                if (range?.to) params.set("to", range.to);
                const activeRole = (state.context.user?.role || "").toLowerCase();
                if (activeRole === "instructor") {
                    params.set("mine", "true");
                }
                const query = params.toString();
                const endpoint = type === "excel"
                    ? "/api/admin/calendar/export/csv"
                    : "/api/admin/calendar/export/ics";
                window.location.href = `${endpoint}${query ? `?${query}` : ""}`;
            });
        });

        const addSessionBtn = document.getElementById("add-session");
        if (addSessionBtn) {
            addSessionBtn.addEventListener("click", () => {
                openSessionModal(data);
            });
        }

        const itemMap = new Map((data.items || []).map(item => [String(item.id), item]));
        document.querySelectorAll(".calendar-event[data-event], .calendar-list [data-event]").forEach(card => {
            card.addEventListener("click", (event) => {
                if (event.target.closest(".event-actions, .event-share")) return;
                event.stopPropagation();
                const birthdayContacts = getBirthdayContactsFromElement(card);
                if (birthdayContacts) {
                    const label = card.getAttribute("data-birthday-label") || "";
                    const studioName = data?.calendar?.studio?.name || "";
                    openBirthdayModal(birthdayContacts, label, studioName);
                    return;
                }
                const birthdayNames = getBirthdayNamesFromElement(card);
                if (birthdayNames) {
                    const label = card.getAttribute("data-birthday-label") || "";
                    const studioName = data?.calendar?.studio?.name || "";
                    const contacts = birthdayNames.map(name => ({ name }));
                    openBirthdayModal(contacts, label, studioName);
                    return;
                }
                const id = card.getAttribute("data-event");
                const item = itemMap.get(String(id));
                if (!item || item.isHoliday || item.isBirthday) return;
                openCalendarEventModal(item, data);
            });
        });
        document.querySelectorAll(".event-actions").forEach(button => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const card = button.closest(".calendar-event");
                const id = card?.getAttribute("data-event");
                const item = itemMap.get(String(id));
                if (!item || item.isHoliday || item.isBirthday) return;
                openEventActionsMenu(button, item, data);
            });
        });
        document.querySelectorAll(".event-share").forEach(button => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const card = button.closest(".calendar-event");
                const id = card?.getAttribute("data-event");
                const item = itemMap.get(String(id));
                if (!item || item.isHoliday || item.isBirthday) return;
                await shareSessionLink(item, data);
            });
        });
        bindCalendarInteractions(data, itemMap);
    }

    if (route === "events") {
        const addBtn = document.getElementById("add-series");
        const seriesIdParam = getQueryParam("series");

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openSeriesModal(null, data);
            });
        }

        if (seriesIdParam && data.series) {
            const selected = data.series.find(item => item.id === seriesIdParam);
            if (selected) {
                openSeriesModal(selected, data);
            }
        }

        document.querySelectorAll("button[data-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const seriesId = btn.getAttribute("data-edit");
                const selected = (data.series || []).find(item => item.id === seriesId);
                if (!selected) return;
                openSeriesModal(selected, data);
            });
        });

        document.querySelectorAll("button[data-delete-series]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const seriesId = btn.getAttribute("data-delete-series");
                if (!seriesId) return;
                const confirmed = await confirmWithModal({
                    title: t("events.deleteConfirmTitle", "Delete series?"),
                    message: t("events.deleteConfirmMessage", "This will remove the series and its future sessions."),
                    confirmLabel: t("events.delete", "Delete"),
                    cancelLabel: t("common.cancel", "Cancel")
                });
                if (!confirmed) return;
                btn.disabled = true;
                try {
                    await apiDelete(`/api/admin/event-series/${seriesId}`);
                    showToast(t("events.deleteSuccess", "Series deleted."), "success");
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("events.deleteError", "Unable to delete series."), "error");
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }

    if (route === "rooms") {
        const addBtn = document.getElementById("add-room");
        const roomMap = new Map((data.rooms || []).map(room => [String(room.id), room]));

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openRoomModal(null);
            });
        }

        document.querySelectorAll("button[data-room-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-room-edit");
                const room = roomMap.get(String(id));
                if (!room) return;
                openRoomModal(room);
            });
        });

        document.querySelectorAll("button[data-room-delete]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-room-delete");
                if (!id) return;
                if (!window.confirm("Delete this room?")) return;
                try {
                    await apiDelete(`/api/admin/rooms/${id}`);
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("room.deleteError", "Unable to delete room."), "error");
                }
            });
        });
    }

    if (route === "plans") {
        const addBtn = document.getElementById("add-plan");
        const manageCategoriesBtn = document.getElementById("manage-plan-categories");
        const planMap = new Map((data.plans || []).map(plan => [String(plan.id), plan]));

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openPlanModal(null, data.planCategories || []);
            });
        }
        if (manageCategoriesBtn) {
            manageCategoriesBtn.addEventListener("click", () => {
                openPlanCategoryModal(data.planCategories || []);
            });
        }

        document.querySelectorAll("button[data-plan-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-plan-edit");
                const plan = planMap.get(String(id));
                if (!plan) return;
                openPlanModal(plan, data.planCategories || []);
            });
        });
    }

    if (route === "customers") {
        const addBtn = document.getElementById("add-customer");
        const manageStatusesBtn = document.getElementById("manage-statuses");
        const manageTagsBtn = document.getElementById("manage-tags");
        const exportBtn = document.getElementById("export-customers");
        const importInput = document.getElementById("import-customers");
        const importZone = document.getElementById("import-customers-zone");
        const filterBtn = document.getElementById("apply-customer-filters");
        const selectAll = document.getElementById("customers-select-all");
        const bulkEmail = document.getElementById("bulk-email");
        const bulkSms = document.getElementById("bulk-sms");
        const bulkRegister = document.getElementById("bulk-register");
        const customerMap = new Map((data.customers || []).map(customer => [String(customer.id), customer]));

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openCustomerModal(null, data);
            });
        }

        if (manageStatusesBtn) {
            manageStatusesBtn.addEventListener("click", () => {
                openCustomerStatusModal(data.customerStatuses || []);
            });
        }

        if (manageTagsBtn) {
            manageTagsBtn.addEventListener("click", () => {
                openCustomerTagModal(data.customerTags || []);
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                window.location.href = "/api/admin/customers/export/csv";
            });
        }

        const handleImport = async (file) => {
            if (!file) return;
            const formData = new FormData();
            formData.append("file", file);
            if (importInput) importInput.disabled = true;
            try {
                const result = await apiFetch("/api/admin/customers/import", {
                    method: "POST",
                    body: formData
                });
                const created = result?.created ?? 0;
                const updated = result?.updated ?? 0;
                const skipped = result?.skipped ?? 0;
                showToast(`${t("customers.importSuccess", "Customer import complete.")} (${created}/${updated}/${skipped})`, "success");
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("customers.importError", "Unable to import customers."), "error");
            } finally {
                if (importInput) {
                    importInput.value = "";
                    importInput.disabled = false;
                }
            }
        };

        if (importInput) {
            importInput.addEventListener("change", async () => {
                const file = importInput.files?.[0];
                await handleImport(file);
            });
        }

        if (importZone) {
            const setActive = (active) => importZone.classList.toggle("drag-over", active);
            importZone.addEventListener("dragover", (event) => {
                event.preventDefault();
                setActive(true);
            });
            importZone.addEventListener("dragleave", () => setActive(false));
            importZone.addEventListener("drop", async (event) => {
                event.preventDefault();
                setActive(false);
                const file = event.dataTransfer?.files?.[0];
                await handleImport(file);
            });
        }

        if (filterBtn) {
            filterBtn.addEventListener("click", () => {
                const searchInput = document.querySelector("[name=\"search\"]");
                const includeArchivedInput = document.querySelector("[name=\"includeArchived\"]");
                const statusInput = document.querySelector("[name=\"statusFilter\"]");
                const tagInput = document.querySelector("[name=\"tagFilter\"]");
                const searchValue = searchInput?.value || "";
                const includeArchived = includeArchivedInput?.checked;
                const statusValue = statusInput?.value || "";
                const tagValue = tagInput?.value || "";
                const params = new URLSearchParams();
                if (searchValue) {
                    params.set("search", searchValue);
                }
                if (includeArchived) {
                    params.set("archived", "1");
                }
                if (statusValue) {
                    params.set("statusId", statusValue);
                }
                if (tagValue) {
                    params.set("tag", tagValue);
                }
                const sortKey = data.customerFilters?.sort || "";
                const sortDir = data.customerFilters?.dir || "";
                if (sortKey) {
                    params.set("sort", sortKey);
                }
                if (sortDir) {
                    params.set("dir", sortDir);
                }
                const query = params.toString();
                window.location.hash = `#/customers${query ? `?${query}` : ""}`;
            });
        }

        document.querySelectorAll("th[data-sort]").forEach(header => {
            header.addEventListener("click", () => {
                const sortKey = header.getAttribute("data-sort") || "";
                if (!sortKey) return;
                const currentSort = data.customerFilters?.sort || "";
                const currentDir = data.customerFilters?.dir || "asc";
                let nextDir = "asc";
                if (currentSort === sortKey) {
                    nextDir = currentDir === "asc" ? "desc" : "asc";
                }
                const params = new URLSearchParams();
                const searchInput = document.querySelector("[name=\"search\"]");
                const includeArchivedInput = document.querySelector("[name=\"includeArchived\"]");
                const statusInput = document.querySelector("[name=\"statusFilter\"]");
                const tagInput = document.querySelector("[name=\"tagFilter\"]");
                const searchValue = searchInput?.value || "";
                const includeArchived = includeArchivedInput?.checked;
                const statusValue = statusInput?.value || "";
                const tagValue = tagInput?.value || "";
                if (searchValue) params.set("search", searchValue);
                if (includeArchived) params.set("archived", "1");
                if (statusValue) params.set("statusId", statusValue);
                if (tagValue) params.set("tag", tagValue);
                params.set("sort", sortKey);
                params.set("dir", nextDir);
                const query = params.toString();
                window.location.hash = `#/customers${query ? `?${query}` : ""}`;
            });
        });

        document.querySelectorAll("button[data-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-edit");
                const customer = customerMap.get(String(id));
                if (!customer) return;
                openCustomerModal(customer, data);
            });
        });

        document.querySelectorAll("button[data-archive]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-archive");
                const customer = customerMap.get(String(id));
                if (!customer) return;
                const tags = customer.tags ?? formatTags(customer.tagsJson);
                await apiPut(`/api/admin/customers/${id}`, {
                    fullName: customer.fullName,
                    email: customer.email,
                    phone: customer.phone,
                    tags,
                    isArchived: !customer.isArchived
                });
                actor.send({ type: "REFRESH" });
            });
        });

        const checkboxes = Array.from(document.querySelectorAll("input[data-customer-select]"));
        if (selectAll) {
            selectAll.addEventListener("change", () => {
                checkboxes.forEach(box => {
                    box.checked = selectAll.checked;
                });
            });
        }

        const getSelectedCustomers = () => {
            const selectedIds = checkboxes.filter(box => box.checked).map(box => box.getAttribute("data-customer-select"));
            return selectedIds.map(id => customerMap.get(String(id))).filter(Boolean);
        };

        if (bulkEmail) {
            bulkEmail.addEventListener("click", () => {
                const recipients = getSelectedCustomers()
                    .map(customer => ({
                        name: customer.fullName || customer.email || customer.phone || "",
                        email: customer.email || ""
                    }))
                    .filter(entry => entry.email);
                const emails = recipients.map(entry => entry.email);
                if (emails.length === 0) {
                    showToast(t("email.noRecipients", "No email addresses selected."), "error");
                    return;
                }
                openEmailComposerModal({
                    title: t("email.composeTitle", "Send email"),
                    subtitle: t("email.composeSubtitle", "Write a message to the selected recipients."),
                    recipients,
                    subject: "",
                    body: "",
                    onSend: (subject, body) => sendBulkEmail(emails, subject, body)
                });
            });
        }

        if (bulkSms) {
            bulkSms.addEventListener("click", () => {
                const recipients = getSelectedCustomers()
                    .map(customer => ({
                        name: customer.fullName || customer.phone || "",
                        phone: customer.phone || ""
                    }))
                    .filter(entry => entry.phone);
                const phones = recipients.map(entry => entry.phone);
                if (phones.length === 0) {
                    showToast(t("sms.noRecipients", "No phone numbers selected."), "error");
                    return;
                }
                openSmsComposerModal({
                    title: t("sms.composeTitle", "Send SMS"),
                    subtitle: t("sms.composeSubtitle", "Write a message to the selected recipients."),
                    recipients,
                    body: "",
                    onSend: (body) => {
                        openSmsLink(phones, body);
                    }
                });
            });
        }

        if (bulkRegister) {
            bulkRegister.addEventListener("click", async () => {
                const selected = getSelectedCustomers();
                if (selected.length === 0) {
                    showToast(t("customers.selectOne", "Select at least one customer."), "error");
                    return;
                }
                await openBulkRegistrationModal(selected, data);
            });
        }
    }

    if (route === "customer") {
        const editBtn = document.getElementById("edit-customer");
        const viewAllBtn = document.getElementById("view-all-registrations");
        const billingBtn = document.getElementById("view-invoices");
        const attachmentInput = document.getElementById("customer-attachment-input");
        const activityForm = document.getElementById("activity-form");
        if (editBtn) {
            editBtn.addEventListener("click", async () => {
                const details = data.customerDetails || {};
                const customer = details.customer;
                if (!customer?.id) return;
                const [customerStatuses, customerTags] = await Promise.all([
                    apiGet("/api/admin/customer-statuses"),
                    apiGet("/api/admin/customer-tags")
                ]);
                openCustomerModal(customer, {
                    customerStatuses,
                    customerTags,
                    customers: []
                });
            });
        }
        if (viewAllBtn) {
            viewAllBtn.addEventListener("click", () => {
                const details = data.customerDetails || {};
                const registrations = formatCustomerRegistrations(details.registrations || []);
                openCustomerRegistrationsModal(registrations);
            });
        }
        if (billingBtn) {
            billingBtn.addEventListener("click", () => {
                const details = data.customerDetails || {};
                const customer = details.customer;
                if (!customer?.id) return;
                window.location.hash = `#/invoices?customerId=${customer.id}`;
            });
        }
        if (attachmentInput) {
            attachmentInput.addEventListener("change", async () => {
                const details = data.customerDetails || {};
                const customer = details.customer;
                if (!customer?.id) return;
                const file = attachmentInput.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append("file", file);
                try {
                    await apiFetch(`/api/admin/customers/${customer.id}/attachments`, {
                        method: "POST",
                        body: formData
                    });
                    showToast(t("customer.details.uploadSuccess", "Attachment uploaded."), "success");
                    attachmentInput.value = "";
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("customer.details.uploadError", "Unable to upload attachment."), "error");
                }
            });
        }
        if (activityForm) {
            activityForm.addEventListener("submit", async (event) => {
                event.preventDefault();
                const details = data.customerDetails || {};
                const customer = details.customer;
                if (!customer?.id) return;
                const noteInput = activityForm.querySelector("[name=\"activityNote\"]");
                const fileInput = activityForm.querySelector("[name=\"activityFile\"]");
                const note = noteInput?.value?.trim() || "";
                const file = fileInput?.files?.[0];
                if (!note && !file) {
                    showToast(t("customer.details.activityRequired", "Add a note or photo first."), "error");
                    return;
                }
                const formData = new FormData();
                if (note) formData.append("note", note);
                if (file) formData.append("file", file);
                try {
                    await apiFetch(`/api/admin/customers/${customer.id}/activity`, {
                        method: "POST",
                        body: formData
                    });
                    showToast(t("customer.details.activitySaved", "Activity saved."), "success");
                    activityForm.reset();
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("customer.details.activityError", "Unable to save activity."), "error");
                }
            });
        }
    }

    if (route === "users") {
        const addBtn = document.getElementById("add-user");
        const filterBtn = document.getElementById("apply-user-filter");
        const userMap = new Map((data.users || []).map(item => [String(item.id), item]));

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openUserModal(null);
            });
        }

        if (filterBtn) {
            filterBtn.addEventListener("click", () => {
                const roleInput = document.querySelector("[name=\"userRoleFilter\"]");
                const roleValue = roleInput?.value || "";
                const params = new URLSearchParams();
                if (roleValue) {
                    params.set("role", roleValue);
                }
                const query = params.toString();
                window.location.hash = `#/users${query ? `?${query}` : ""}`;
            });
        }

        document.querySelectorAll("button[data-user-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-user-edit");
                const userItem = userMap.get(String(id));
                if (!userItem) return;
                openUserModal(userItem);
            });
        });

        document.querySelectorAll("button[data-user-invite]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-user-invite");
                if (!id) return;
                btn.disabled = true;
                try {
                    const invite = await requestInvite(id, false);
                    openInviteEmailModal({
                        email: invite.email || "",
                        subject: invite.subject || "",
                        body: invite.body || "",
                        onSend: async (subject, body) => {
                            try {
                                await sendInviteEmail(id, subject, body);
                            } catch (error) {
                                const message = String(error?.message || "");
                                if (message.toLowerCase().includes("configured")) {
                                    openInviteEmail({ email: invite.email, subject, body });
                                    showToast(t("users.inviteMailto", "Opened email client."), "success");
                                    return { fallback: true };
                                }
                                throw error;
                            }
                        }
                    });
                } catch (error) {
                    showToast(error.message || t("users.inviteError", "Unable to generate invite."), "error");
                } finally {
                    btn.disabled = false;
                }
            });
        });

    }

    if (route === "guests") {
        const addBtn = document.getElementById("add-guest");
        const searchBtn = document.getElementById("apply-guest-search");

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openGuestModal();
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener("click", () => {
                const searchInput = document.querySelector("[name=\"guestSearch\"]");
                const searchValue = searchInput?.value || "";
                const params = new URLSearchParams();
                if (searchValue) {
                    params.set("search", searchValue);
                }
                const query = params.toString();
                window.location.hash = `#/guests${query ? `?${query}` : ""}`;
            });
        }

        document.querySelectorAll("button[data-guest-invite]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-guest-invite");
                if (!id) return;
                btn.disabled = true;
                try {
                    const invite = await requestInvite(id, false);
                    openInviteEmailModal({
                        email: invite.email || "",
                        subject: invite.subject || "",
                        body: invite.body || "",
                        onSend: async (subject, body) => {
                            try {
                                await sendInviteEmail(id, subject, body);
                            } catch (error) {
                                const message = String(error?.message || "");
                                if (message.toLowerCase().includes("configured")) {
                                    openInviteEmail({ email: invite.email, subject, body });
                                    showToast(t("guests.inviteMailto", "Opened email client."), "success");
                                    return { fallback: true };
                                }
                                throw error;
                            }
                        }
                    });
                } catch (error) {
                    showToast(error.message || t("guests.inviteError", "Unable to send invite."), "error");
                } finally {
                    btn.disabled = false;
                }
            });
        });

    }

    if (route === "settings") {
        const button = document.getElementById("save-settings");
        const logoInput = document.querySelector("[name=\"logoUrl\"]");
        const faviconInput = document.querySelector("[name=\"faviconUrl\"]");
        const logoFileInput = document.querySelector("[name=\"logoFile\"]");
        const logoPreview = document.querySelector(".logo-preview");
        const themeJsonInput = document.querySelector("[name=\"themeJson\"]");
        const themeInputs = {
            primary: document.querySelector("[name=\"themePrimary\"]"),
            secondary: document.querySelector("[name=\"themeSecondary\"]"),
            accent: document.querySelector("[name=\"themeAccent\"]"),
            background: document.querySelector("[name=\"themeBackground\"]")
        };

        const parseThemeInput = () => {
            if (!themeJsonInput) return { ok: false, value: {} };
            try {
                return { ok: true, value: JSON.parse(themeJsonInput.value || "{}") };
            } catch {
                return { ok: false, value: {} };
            }
        };

        const syncThemeInputs = (themeValue) => {
            if (themeInputs.primary) {
                themeInputs.primary.value = ensureHexColor(themeValue.primary, themeInputs.primary.value || "#f1c232");
                updateColorField(themeInputs.primary);
            }
            if (themeInputs.secondary) {
                themeInputs.secondary.value = ensureHexColor(themeValue.secondary, themeInputs.secondary.value || "#f6d88a");
                updateColorField(themeInputs.secondary);
            }
            if (themeInputs.accent) {
                themeInputs.accent.value = ensureHexColor(themeValue.accent, themeInputs.accent.value || "#f9e7b7");
                updateColorField(themeInputs.accent);
            }
            if (themeInputs.background) {
                themeInputs.background.value = ensureHexColor(themeValue.background, themeInputs.background.value || "#fff7de");
                updateColorField(themeInputs.background);
            }
        };

        const syncThemeJson = () => {
            if (!themeJsonInput) return;
            const parsed = parseThemeInput();
            if (!parsed.ok) return;
            const themeValue = parsed.value;
            if (themeInputs.primary) themeValue.primary = themeInputs.primary.value;
            if (themeInputs.secondary) themeValue.secondary = themeInputs.secondary.value;
            if (themeInputs.accent) themeValue.accent = themeInputs.accent.value;
            if (themeInputs.background) themeValue.background = themeInputs.background.value;
            themeJsonInput.value = JSON.stringify(themeValue, null, 2);
        };

        const syncFavicon = () => {
            const faviconValue = faviconInput?.value.trim() || logoInput?.value.trim() || "";
            setFavicon(faviconValue);
        };

        if (logoInput && logoPreview) {
            logoInput.addEventListener("input", () => {
                setLogoPreview(logoPreview, logoInput.value.trim());
                syncFavicon();
            });
        }
        if (faviconInput) {
            faviconInput.addEventListener("input", syncFavicon);
        }
        if (logoFileInput && logoInput) {
            logoFileInput.addEventListener("change", () => {
                const file = logoFileInput.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : "";
                    if (result) {
                        logoInput.value = result;
                        setLogoPreview(logoPreview, result);
                        syncFavicon();
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        if (themeJsonInput) {
            themeJsonInput.addEventListener("input", () => {
                const parsed = parseThemeInput();
                if (parsed.ok) {
                    syncThemeInputs(parsed.value);
                }
            });
        }
        Object.values(themeInputs).forEach(input => {
            if (!input) return;
            input.addEventListener("input", () => {
                updateColorField(input);
                syncThemeJson();
            });
            updateColorField(input);
        });
        document.querySelectorAll("[data-color-text]").forEach(input => {
            input.addEventListener("input", () => {
                const field = input.closest(".color-field");
                if (!field) return;
                const colorInput = field.querySelector("input[type=\"color\"]");
                if (!colorInput) return;
                const normalized = normalizeHexInput(input.value);
                if (!normalized) return;
                colorInput.value = normalized;
                updateColorField(colorInput);
                syncThemeJson();
            });
        });

        if (button) {
            button.addEventListener("click", async () => {
                const formValues = readFormValues([
                    "name",
                    "themeJson",
                    "logoUrl",
                    "faviconUrl",
                    "themePrimary",
                    "themeSecondary",
                    "themeAccent",
                    "themeBackground",
                    "defaultLocale",
                    "userLocale",
                    "googlePlacesApiKey"
                ]);
                const holidayCalendars = Array.from(document.querySelectorAll("input[name=\"holidayCalendars\"]:checked"))
                    .map(input => input.value)
                    .filter(Boolean);
                const holidayCalendarsJson = JSON.stringify(holidayCalendars);
                let theme = {};
                try {
                    theme = JSON.parse(formValues.themeJson || "{}");
                } catch {
                    showToast(t("settings.themeJsonError", "Theme JSON must be valid JSON."), "error");
                    return;
                }
                if (formValues.logoUrl) {
                    theme.logoUrl = formValues.logoUrl;
                } else if (theme.logoUrl) {
                    delete theme.logoUrl;
                }
                if (formValues.faviconUrl) {
                    theme.faviconUrl = formValues.faviconUrl;
                } else if (theme.faviconUrl) {
                    delete theme.faviconUrl;
                }
                theme.primary = formValues.themePrimary || theme.primary || "#f1c232";
                theme.secondary = formValues.themeSecondary || theme.secondary || "#f6d88a";
                theme.accent = formValues.themeAccent || theme.accent || "#f9e7b7";
                theme.background = formValues.themeBackground || theme.background || "#fff7de";
                const defaultLocale = formValues.defaultLocale || (state.context.studio?.defaultLocale || "en");
                const preferredLocale = formValues.userLocale || "";
                await apiPut("/api/admin/studio", {
                    name: formValues.name,
                    timezone: getLocalTimeZone(),
                    weekStartsOn: 0,
                    themeJson: JSON.stringify(theme, null, 2),
                    defaultLocale,
                    holidayCalendarsJson,
                    googlePlacesApiKey: formValues.googlePlacesApiKey
                });
                const currentUser = state.context.user || {};
                await apiPut("/api/admin/profile", {
                    displayName: currentUser.displayName || "",
                    email: currentUser.email || "",
                    password: "",
                    avatarUrl: currentUser.avatarUrl || "",
                    preferredLocale
                });
                const resolvedLocale = resolveLocale(preferredLocale, defaultLocale, navigator.language);
                await setLocale("admin", resolvedLocale);
                actor.send({
                    type: "SET_SESSION",
                    user: { ...currentUser, preferredLocale },
                    studio: { ...(state.context.studio || {}), defaultLocale, holidayCalendarsJson }
                });
                actor.send({ type: "REFRESH" });
            });
        }
    }
}

function readFormValues(fields) {
    const values = {};
    fields.forEach((field) => {
        const checked = document.querySelector(`[name="${field}"]:checked`);
        if (checked) {
            values[field] = checked.value;
            return;
        }
        const element = document.querySelector(`[name="${field}"]`);
        values[field] = element ? element.value : "";
    });
    return values;
}

function parseTagList(value) {
    return String(value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeTagCatalog(tagCatalog) {
    if (!Array.isArray(tagCatalog)) return [];
    return tagCatalog.map((item, index) => {
        if (typeof item === "string") {
            return { name: item, color: TAG_COLOR_PALETTE[index % TAG_COLOR_PALETTE.length] };
        }
        const name = item?.name || item?.Name || "";
        const color = item?.color || item?.Color || TAG_COLOR_PALETTE[index % TAG_COLOR_PALETTE.length];
        return { name, color };
    }).filter(item => item.name);
}

function buildTagColorMap(tagCatalog) {
    const map = new Map();
    normalizeTagCatalog(tagCatalog).forEach(item => {
        map.set(item.name.toLowerCase(), item.color);
    });
    return map;
}

function nextTagColor(tagCatalog) {
    const count = normalizeTagCatalog(tagCatalog).length;
    return TAG_COLOR_PALETTE[count % TAG_COLOR_PALETTE.length];
}

function tagTextColor(hex) {
    const clean = String(hex || "").replace("#", "");
    if (clean.length !== 6) return "#111827";
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? "#111827" : "#ffffff";
}

function renderTagChips(tags, colorMap) {
    const list = Array.isArray(tags) ? tags : parseTagList(tags);
    if (!list.length) return "";
    const chips = list.map(tag => {
        const color = colorMap?.get(tag.toLowerCase()) || TAG_COLOR_PALETTE[0];
        const textColor = tagTextColor(color);
        const safe = escapeHtml(tag);
        return `<span class="tag-chip" style="background:${color}; color:${textColor};">${safe}</span>`;
    }).join("");
    return `<span class="tag-chips">${chips}</span>`;
}

function serializeTags(value) {
    const tags = Array.isArray(value) ? value : parseTagList(value);
    const unique = Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));
    return unique.join(", ");
}

function formatTags(tagsJson) {
    if (!tagsJson) return "";
    try {
        const parsed = JSON.parse(tagsJson);
        if (Array.isArray(parsed)) {
            return parsed.join(", ");
        }
    } catch {
        return tagsJson;
    }
    return tagsJson;
}

function setupTagInput(root, colorMap) {
    const wrapper = root?.querySelector("[data-tag-input]");
    if (!wrapper) return;
    const chips = wrapper.querySelector(".tag-chips");
    const input = wrapper.querySelector("input[name=\"tagsInput\"]");
    const hidden = root.querySelector("input[name=\"tags\"]");
    if (!chips || !input || !hidden) return;

    let tags = parseTagList(hidden.value);
    const render = () => {
        chips.innerHTML = "";
        tags.forEach(tag => {
            const chip = document.createElement("span");
            chip.className = "tag-chip";
            chip.textContent = tag;
            if (colorMap) {
                const color = colorMap.get(tag.toLowerCase());
                if (color) {
                    chip.style.background = color;
                    chip.style.color = tagTextColor(color);
                }
            }
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "tag-remove";
            remove.setAttribute("aria-label", t("customer.tagRemove", "Remove tag"));
            remove.innerHTML = "&times;";
            remove.addEventListener("click", () => {
                tags = tags.filter(existing => existing !== tag);
                hidden.value = serializeTags(tags);
                render();
            });
            chip.appendChild(remove);
            chips.appendChild(chip);
        });
    };

    const addTag = (value) => {
        const cleaned = String(value || "").trim().replace(/,$/, "");
        if (!cleaned) return;
        if (!tags.includes(cleaned)) {
            tags.push(cleaned);
            hidden.value = serializeTags(tags);
            render();
        }
    };

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag(input.value);
            input.value = "";
        }
        if (event.key === "Backspace" && !input.value && tags.length) {
            tags.pop();
            hidden.value = serializeTags(tags);
            render();
        }
    });
    input.addEventListener("blur", () => {
        addTag(input.value);
        input.value = "";
    });
    input.addEventListener("change", () => {
        addTag(input.value);
        input.value = "";
    });

    hidden.value = serializeTags(tags);
    render();
}

let googlePlacesPromise = null;

function loadGooglePlaces(apiKey) {
    if (!apiKey) return Promise.resolve(null);
    if (window.google?.maps?.places) return Promise.resolve(window.google);
    if (googlePlacesPromise) return googlePlacesPromise;
    googlePlacesPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=he&region=IL`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.google);
        script.onerror = () => reject(new Error("Unable to load Google Places."));
        document.head.appendChild(script);
    });
    return googlePlacesPromise;
}

function setupCustomerAddressAutocomplete(root, apiKey) {
    if (!apiKey) return;
    const cityInput = root.querySelector("input[name=\"city\"]");
    const addressInput = root.querySelector("input[name=\"address\"]");
    if (!cityInput && !addressInput) return;
    loadGooglePlaces(apiKey).then((google) => {
        if (!google?.maps?.places) return;
        const cityAutocomplete = cityInput
            ? new google.maps.places.Autocomplete(cityInput, {
                types: ["(cities)"],
                componentRestrictions: { country: "il" }
            })
            : null;
        const addressAutocomplete = addressInput
            ? new google.maps.places.Autocomplete(addressInput, {
                types: ["address"],
                componentRestrictions: { country: "il" }
            })
            : null;

        if (cityAutocomplete) {
            cityAutocomplete.addListener("place_changed", () => {
                const place = cityAutocomplete.getPlace();
                if (place?.name) {
                    cityInput.value = place.name;
                }
                if (addressAutocomplete && place?.geometry?.viewport) {
                    addressAutocomplete.setBounds(place.geometry.viewport);
                    addressAutocomplete.setOptions({ strictBounds: true });
                }
            });
        }

        if (addressAutocomplete && cityInput) {
            addressAutocomplete.addListener("place_changed", () => {
                const place = addressAutocomplete.getPlace();
                if (place?.formatted_address) {
                    addressInput.value = place.formatted_address;
                } else if (place?.name) {
                    addressInput.value = place.name;
                }
                const cityComponent = place?.address_components?.find(component =>
                    component.types?.includes("locality") ||
                    component.types?.includes("administrative_area_level_2") ||
                    component.types?.includes("administrative_area_level_1"));
                if (cityComponent?.long_name) {
                    cityInput.value = cityComponent.long_name;
                }
            });
        }
    }).catch(() => {});
}

function collectTagSuggestions(customers, tagCatalog = []) {
    const set = new Set();
    normalizeTagCatalog(tagCatalog).forEach(tag => set.add(tag.name));
    (customers || []).forEach(customer => {
        const value = customer.tags || formatTags(customer.tagsJson);
        parseTagList(value).forEach(tag => set.add(tag));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function parseGuidListJson(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.filter(Boolean);
        }
    } catch {
        return [];
    }
    return [];
}

function parseNumberListJson(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed
                .map(item => Number(item))
                .filter(item => Number.isFinite(item));
        }
    } catch {
        return [];
    }
    return [];
}

function resolveSeriesDays(series) {
    const parsed = parseNumberListJson(series?.daysOfWeekJson || series?.daysOfWeek || "");
    if (parsed.length) {
        return Array.from(new Set(parsed)).filter(day => day >= 0 && day <= 6);
    }
    const fallback = Number(series?.dayOfWeek);
    if (Number.isFinite(fallback)) {
        return [fallback];
    }
    return [];
}

function parseStringListJson(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(item => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean);
    } catch {
        return [];
    }
}

function toggleInstructorFields(roles) {
    const list = Array.isArray(roles) ? roles : [roles];
    const isInstructor = list.some(role => String(role).toLowerCase() === "instructor");
    document.querySelectorAll(".instructor-fields").forEach(field => {
        field.classList.toggle("hidden", !isInstructor);
    });
}

async function requestInvite(id, sendEmail) {
    return apiPost(`/api/admin/users/${id}/invite`, { sendEmail });
}

function openInviteEmail(invite) {
    if (!invite?.email) return;
    const subject = encodeURIComponent(invite.subject || "");
    const body = encodeURIComponent(invite.body || "");
    window.location.href = `mailto:${invite.email}?subject=${subject}&body=${body}`;
}

async function copyInvite(invite) {
    if (!invite?.body) return;
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invite.body);
        return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = invite.body;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
}

async function uploadCustomerAttachment(customerId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/admin/customers/${customerId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const error = payload?.error || response.statusText || "Upload failed";
        throw new Error(error);
    }
    return payload;
}

async function uploadUserAttachment(userId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/admin/users/${userId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const error = payload?.error || response.statusText || "Upload failed";
        throw new Error(error);
    }
    return payload;
}

function formatShortDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return formatDateDisplay(date);
}

function formatShortDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${formatDateDisplay(date)} ${formatTimeOnly(date)}`;
}

function formatPayrollUnit(unit) {
    switch (String(unit || "").toLowerCase()) {
        case "hour":
            return t("payroll.unit.hour", "Per hour");
        case "day":
            return t("payroll.unit.day", "Per day");
        case "week":
            return t("payroll.unit.week", "Per week");
        case "month":
            return t("payroll.unit.month", "Per month");
        default:
            return t("payroll.unit.session", "Per session");
    }
}

function getLocalTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function parseThemeJson(value) {
    if (!value) return {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

function ensureHexColor(value, fallback) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
        return trimmed;
    }
    return fallback;
}

function updateColorField(input) {
    if (!input) return;
    const field = input.closest(".color-field");
    if (!field) return;
    const chip = field.querySelector(".color-chip");
    const text = field.querySelector("[data-color-text]");
    if (chip) chip.style.background = input.value;
    if (text) text.value = input.value;
}

function normalizeHexInput(value) {
    const trimmed = (value || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return "";
}

function bindColorField(container) {
    if (!container) return;
    const colorInput = container.querySelector("input[type=\"color\"]");
    const textInput = container.querySelector("[data-color-text]");
    if (!colorInput) return;
    const seriesColor = ensureHexColor(container.getAttribute("data-series-color") || "", "");
    colorInput.addEventListener("input", () => updateColorField(colorInput));
    if (textInput) {
        textInput.addEventListener("input", () => {
            if (!textInput.value.trim()) {
                if (seriesColor) {
                    colorInput.value = seriesColor;
                    updateColorField(colorInput);
                }
                return;
            }
            const normalized = normalizeHexInput(textInput.value);
            if (!normalized) return;
            colorInput.value = normalized;
            updateColorField(colorInput);
        });
    }
    updateColorField(colorInput);
}

function bindColorResets(container) {
    if (!container) return;
    container.querySelectorAll("[data-color-reset]").forEach(button => {
        button.addEventListener("click", () => {
            const field = button.closest(".color-field");
            if (!field) return;
            const colorInput = field.querySelector("input[type=\"color\"]");
            const seriesColor = ensureHexColor(field.getAttribute("data-series-color") || "", "");
            if (!colorInput || !seriesColor) return;
            colorInput.value = seriesColor;
            updateColorField(colorInput);
        });
    });
}

function getInitials(value) {
    if (!value) return "U";
    const parts = value.trim().split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(part => part[0].toUpperCase());
    return initials.join("") || "U";
}

const sidebarStorageKey = "letmein.sidebar.collapsed";
let activeModalKeyHandler = null;
let globalEscapeHandlerAttached = false;
let activeEventMenu = null;
let activeEventMenuCleanup = null;
let calendarSearchShouldFocus = false;
let lastRenderedRoute = null;
let billingHandlersBound = false;

function getSidebarState() {
    const stored = localStorage.getItem(sidebarStorageKey);
    if (stored === null) {
        return window.innerWidth < 1500;
    }
    return stored === "1";
}

function setSidebarState(value) {
    localStorage.setItem(sidebarStorageKey, value ? "1" : "0");
}

function applySidebarState(collapsed) {
    const shell = document.querySelector(".app-shell");
    if (!shell) return;
    shell.classList.toggle("collapsed", collapsed);
    const toggle = document.getElementById("toggle-sidebar");
    if (toggle) {
        const label = collapsed
            ? t("nav.expand", "Expand")
            : t("nav.menu", "Menu");
        toggle.setAttribute("aria-label", label);
        const srLabel = toggle.querySelector(".sr-only");
        if (srLabel) {
            srLabel.textContent = label;
        }
    }
}

function setLogoPreview(container, value) {
    if (!container) return;
    container.innerHTML = "";
    if (value) {
        const img = document.createElement("img");
        img.src = value;
        img.alt = t("settings.logoPreview", "Studio logo preview");
        container.appendChild(img);
        return;
    }
    const placeholder = document.createElement("div");
    placeholder.className = "logo-placeholder";
    placeholder.textContent = t("settings.logoPlaceholder", "No logo selected");
    container.appendChild(placeholder);
}

function setAvatarPreview(container, value) {
    if (!container) return;
    container.innerHTML = "";
    if (value) {
        const img = document.createElement("img");
        img.src = value;
        img.alt = t("profile.avatarPreview", "User avatar preview");
        container.appendChild(img);
        return;
    }
    const placeholder = document.createElement("div");
    placeholder.className = "logo-placeholder";
    placeholder.textContent = t("profile.photoPlaceholder", "No photo selected");
    container.appendChild(placeholder);
}

function setFavicon(url) {
    if (!url) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    link.href = url;
}

function normalizeToastMessage(message) {
    const normalized = String(message || "").trim();
    if (!normalized) return "";
    if (normalized === "Session overlaps with another scheduled session.") {
        return t("session.overlapError", "Session overlaps with another scheduled session.");
    }
    return message;
}

function showToast(message, type = "info") {
    const normalizedMessage = normalizeToastMessage(message);
    if (!normalizedMessage) return;
    const root = document.getElementById("toast-root");
    if (!root) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = normalizedMessage;
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

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderPlainText(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

function renderMarkdown(value) {
    if (!value) return "";
    const escaped = escapeHtml(value);
    const withLinks = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    const withItalic = withBold.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return withItalic.replace(/\n/g, "<br>");
}

function bindMarkdownPreview(root) {
    if (!root) return;
    const sources = Array.from(root.querySelectorAll("[data-markdown-source]"));
    sources.forEach(source => {
        const key = source.getAttribute("data-markdown-source");
        if (!key) return;
        const preview = root.querySelector(`[data-markdown-preview="${key}"]`);
        if (!preview) return;
        const updatePreview = () => {
            preview.innerHTML = renderMarkdown(source.value || "");
        };
        updatePreview();
        source.addEventListener("input", updatePreview);
    });

    const toggles = Array.from(root.querySelectorAll("[data-markdown-toggle]"));
    toggles.forEach(toggle => {
        const key = toggle.getAttribute("data-markdown-toggle");
        if (!key) return;
        const preview = root.querySelector(`[data-markdown-preview="${key}"]`);
        if (!preview) return;
        toggle.addEventListener("click", () => {
            preview.classList.toggle("hidden");
        });
    });
}

function clearModalEscape() {
    if (!activeModalKeyHandler) return;
    document.removeEventListener("keydown", activeModalKeyHandler);
    activeModalKeyHandler = null;
}

function bindModalEscape(closeModal) {
    clearModalEscape();
    const handler = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        closeModal();
    };
    activeModalKeyHandler = handler;
    document.addEventListener("keydown", handler);
    return () => {
        if (activeModalKeyHandler === handler) {
            document.removeEventListener("keydown", handler);
            activeModalKeyHandler = null;
        }
    };
}

function ensureGlobalEscapeHandler() {
    if (globalEscapeHandlerAttached) return;
    const handler = (event) => {
        if (event.key !== "Escape") return;
        if (activeModalKeyHandler) return;
        const overlays = Array.from(document.querySelectorAll(".modal-overlay"));
        const overlay = overlays[overlays.length - 1];
        if (!overlay) return;
        const closeBtn = overlay.querySelector(".modal-close");
        if (closeBtn) {
            closeBtn.click();
        } else {
            overlay.remove();
        }
    };
    document.addEventListener("keydown", handler);
    globalEscapeHandlerAttached = true;
}

function bindModalBackdrop(overlay) {
    if (!overlay) return;
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            event.preventDefault();
            event.stopPropagation();
        }
    });
}

function setFieldValue(name, value) {
    const element = document.querySelector(`[name="${name}"]`);
    if (!element) return;
    element.value = value ?? "";
}

function fillCustomerForm(customer) {
    setFieldValue("customerId", customer.id);
    setFieldValue("fullName", customer.fullName);
    setFieldValue("email", customer.email);
    setFieldValue("phone", customer.phone);
    setFieldValue("idNumber", customer.idNumber);
    setFieldValue("gender", customer.gender);
    setFieldValue("dateOfBirth", customer.dateOfBirth ? normalizeDateInputValue(customer.dateOfBirth) : "");
    setFieldValue("city", customer.city);
    setFieldValue("address", customer.address);
    setFieldValue("occupation", customer.occupation);
    setFieldValue("signedHealthView", customer.signedHealthView ? "true" : "false");
    const tags = customer.tags ?? formatTags(customer.tagsJson);
    setFieldValue("tags", tags);
    setFieldValue("isArchived", customer.isArchived ? "true" : "false");
    const saveBtn = document.getElementById("save-customer");
    if (saveBtn) {
        saveBtn.textContent = t("customer.update", "Update customer");
    }
}

function resetCustomerForm() {
    setFieldValue("customerId", "");
    setFieldValue("fullName", "");
    setFieldValue("email", "");
    setFieldValue("phone", "");
    setFieldValue("idNumber", "");
    setFieldValue("gender", "");
    setFieldValue("dateOfBirth", "");
    setFieldValue("city", "");
    setFieldValue("address", "");
    setFieldValue("occupation", "");
    setFieldValue("signedHealthView", "false");
    setFieldValue("tags", "");
    setFieldValue("isArchived", "false");
    const saveBtn = document.getElementById("save-customer");
    if (saveBtn) {
        saveBtn.textContent = t("customer.create", "Create customer");
    }
}

function fillUserForm(userItem) {
    setFieldValue("userId", userItem.id);
    setFieldValue("displayName", userItem.displayName);
    setFieldValue("email", userItem.email);
    setFieldValue("phone", userItem.phone);
    setFieldValue("city", userItem.city);
    setFieldValue("address", userItem.address);
    setFieldValue("gender", userItem.gender);
    setFieldValue("idNumber", userItem.idNumber);
    setFieldValue("dateOfBirth", userItem.dateOfBirth ? normalizeDateInputValue(userItem.dateOfBirth) : "");
    setFieldValue("role", userItem.role || "Admin");
    setFieldValue("isActive", userItem.isActive ? "true" : "false");
    setFieldValue("instructorDisplayName", userItem.instructorName || "");
    setFieldValue("instructorBio", userItem.instructorBio || "");
    setFieldValue("instructorRate", Number(userItem.instructorRateCents || 0) / 100);
    setFieldValue("instructorRateUnit", userItem.instructorRateUnit || "Session");
    setFieldValue("instructorRateCurrency", userItem.instructorRateCurrency || "ILS");
    const saveBtn = document.getElementById("save-user");
    if (saveBtn) {
        saveBtn.textContent = t("user.update", "Update user");
    }
}

function resetUserForm() {
    setFieldValue("userId", "");
    setFieldValue("displayName", "");
    setFieldValue("email", "");
    setFieldValue("phone", "");
    setFieldValue("city", "");
    setFieldValue("address", "");
    setFieldValue("gender", "");
    setFieldValue("idNumber", "");
    setFieldValue("dateOfBirth", "");
    setFieldValue("role", "Admin");
    setFieldValue("isActive", "true");
    setFieldValue("instructorDisplayName", "");
    setFieldValue("instructorBio", "");
    setFieldValue("instructorRate", "0");
    setFieldValue("instructorRateUnit", "Session");
    setFieldValue("instructorRateCurrency", "ILS");
    const saveBtn = document.getElementById("save-user");
    if (saveBtn) {
        saveBtn.textContent = t("user.create", "Create user");
    }
    toggleInstructorFields("Admin");
}

function getSessionTiming(item, timeZone) {
    const start = parseUtcDate(item.startUtc) || new Date(item.startUtc);
    const end = item.endUtc ? (parseUtcDate(item.endUtc) || new Date(item.endUtc)) : null;
    const timeRange = end ? `${formatTimeOnly(start, timeZone)} - ${formatTimeOnly(end, timeZone)}` : formatTimeOnly(start, timeZone);
    const startLabel = formatFullDate(start, timeZone);
    const sessionDateKey = getDateKeyInTimeZone(start, timeZone);
    const startTimeLocal = formatTimeInput(start, timeZone);
    const durationMinutes = end
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
        : (item.durationMinutes || 60);
    return { start, end, timeRange, startLabel, sessionDateKey, startTimeLocal, durationMinutes };
}

function formatCapacitySummaryCounts(bookedCount, remoteCount, capacityValue, remoteCapacityValue) {
    const bookedLabel = t("capacity.registered", "Registered");
    const remoteLabel = t("capacity.registeredRemote", "Registered remotely");
    if (remoteCapacityValue > 0) {
        return `${bookedLabel}: ${bookedCount} / ${capacityValue} | ${remoteLabel}: ${remoteCount} / ${remoteCapacityValue}`;
    }
    return `${bookedLabel}: ${bookedCount} / ${capacityValue}`;
}

function updateCalendarEventSummary(eventId, bookedCount, capacityValue) {
    if (!eventId) return;
    const summary = `${bookedCount}/${capacityValue}`;
    document.querySelectorAll(`.calendar-event[data-event="${eventId}"] .event-meta-compact span`).forEach(span => {
        span.textContent = summary;
    });
    document.querySelectorAll(`.calendar-list tr[data-event="${eventId}"]`).forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length > 0) {
            cells[cells.length - 1].textContent = summary;
        }
    });
}

async function openCalendarEventModal(item, data, options = {}) {
    const existing = document.getElementById("calendar-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const timeZone = getLocalTimeZone();
    const { start, end, timeRange, startLabel, sessionDateKey, startTimeLocal, durationMinutes } = getSessionTiming(item, timeZone);

    const statusValue = typeof item.status === "string"
        ? item.status
        : (item.status === 1 ? "Cancelled" : "Scheduled");

    const rooms = [
        { id: "", name: t("common.unassigned", "Unassigned"), selected: !item.roomId },
        ...(data.rooms || []).map(room => ({
            id: room.id,
            name: room.name,
            selected: room.id === item.roomId
        }))
    ];

    const instructors = [
        { id: "", displayName: t("common.unassigned", "Unassigned"), selected: !item.instructorId },
        ...(data.instructors || []).map(instructor => ({
            id: instructor.id,
            displayName: instructor.displayName,
            selected: instructor.id === item.instructorId
        }))
    ];
    const instructorDetails = (data.instructors || []).find(instructor => String(instructor.id) === String(item.instructorId));
    const descriptionValue = (item.seriesDescription || item.description || "").trim();
    const hasDescription = descriptionValue.length > 0;
    const descriptionIsUrl = /^https?:\/\//i.test(descriptionValue);
    const seriesIconValue = item.seriesIcon || "";
    const seriesColorValue = ensureHexColor(item.seriesColor || "#f1c232", "#f1c232");
    const instanceIconValue = item.icon || "";
    const instanceColorValue = ensureHexColor(item.color || "", "");
    const colorValue = instanceColorValue || seriesColorValue;

    const statuses = [
        {
            value: "Scheduled",
            label: t("status.scheduled", "Scheduled"),
            selected: statusValue === "Scheduled"
        },
        {
            value: "Cancelled",
            label: t("status.cancelled", "Cancelled"),
            selected: statusValue === "Cancelled"
        }
    ];

    const capacityValue = Number(item.capacity || 0);
    const remoteCapacityValue = Number(item.remoteCapacity || 0);
    const bookedCount = Number(item.booked || 0);
    const remoteCount = Number(item.remoteBooked || 0);
    const capacitySummary = formatCapacitySummaryCounts(bookedCount, remoteCount, capacityValue, remoteCapacityValue);
    const seriesPlanIds = Array.isArray(item.seriesAllowedPlanIds) ? item.seriesAllowedPlanIds.map(id => String(id)) : [];
    const instancePlanIds = Array.isArray(item.instanceAllowedPlanIds) ? item.instanceAllowedPlanIds.map(id => String(id)) : [];
    const hasPlanOverride = item.hasPlanOverride === true;
    const effectivePlanIds = hasPlanOverride ? instancePlanIds : seriesPlanIds;
    const allowedPlanSet = new Set(effectivePlanIds);
    const seriesPlanCategoryId = item.seriesPlanCategoryId || "";
    const instancePlanCategoryId = item.instancePlanCategoryId || "";
    const effectivePlanCategoryId = instancePlanCategoryId || seriesPlanCategoryId || "";
    const planCategories = buildPlanCategoryOptions(data.planCategories || [], effectivePlanCategoryId);
    const planOptions = filterPlansByCategory(data.plans || [], effectivePlanCategoryId).map(plan => ({
        id: plan.id,
        name: plan.name,
        price: formatPlainPrice(plan.priceCents),
        selected: allowedPlanSet.has(String(plan.id))
    }));
    const titleSuggestions = buildTitleSuggestions(data);
    const titleSuggestionId = createTitleSuggestionId("session-title");

    const modalMarkup = calendarModalTemplate({
        ...item,
        timeRange,
        startLabel,
        statusLabel: statusValue,
        statuses,
        rooms,
        instructors,
        plans: planOptions,
        planCategories,
        titleSuggestions,
        titleSuggestionId,
        capacitySummary,
        instanceIcon: instanceIconValue,
        seriesIcon: seriesIconValue,
        seriesColor: seriesColorValue,
        colorValue,
        price: toCurrencyUnits(item.priceCents),
        startTimeLocal,
        durationMinutes,
        remoteCapacity: remoteCapacityValue,
        remoteInviteUrl: item.remoteInviteUrl || "",
        hasRemoteCapacity: remoteCapacityValue > 0,
        hasInstructorDetails: Boolean(instructorDetails),
        hasDescription,
        seriesDescription: descriptionValue
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    overlay.querySelectorAll(".color-field").forEach(field => bindColorField(field));
    bindColorResets(overlay);
    bindIconPicker(overlay);
    bindIconPreview(overlay);
    bindRoomRemoteDefaults(overlay, data.rooms || [], item.remoteInviteUrl || "");

    const closeBtn = overlay.querySelector("#close-modal");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const planCategorySelect = overlay.querySelector("[name=\"planCategoryId\"]");
    const planOptionsContainer = overlay.querySelector(".plan-options");
    if (planCategorySelect && planOptionsContainer) {
        planCategorySelect.addEventListener("change", () => {
            const selectedIds = new Set(Array.from(overlay.querySelectorAll("input[name=\"instancePlanIds\"]:checked"))
                .map(input => input.value));
            const categoryId = planCategorySelect.value || "";
            renderPlanOptions(planOptionsContainer, data.plans || [], selectedIds, categoryId, "instancePlanIds");
        });
    }

    const instructorBtn = overlay.querySelector("#open-instructor");
    if (instructorBtn && instructorDetails) {
        instructorBtn.addEventListener("click", () => openInstructorModal(instructorDetails));
    }

    const descriptionBtn = overlay.querySelector("#open-description");
    if (descriptionBtn && hasDescription) {
        descriptionBtn.addEventListener("click", () => {
            if (descriptionIsUrl) {
                window.open(descriptionValue, "_blank", "noopener");
                return;
            }
            openDescriptionModal(item.seriesTitle || t("session.descriptionTitle", "Description"), descriptionValue);
        });
    }

    const editSeriesBtn = overlay.querySelector("#edit-series");
    if (editSeriesBtn) {
        editSeriesBtn.addEventListener("click", async () => {
            if (!item.eventSeriesId || String(item.eventSeriesId) === "00000000-0000-0000-0000-000000000000") return;
            closeModal();
            try {
                const series = await apiGet(`/api/admin/event-series/${item.eventSeriesId}`);
                openSeriesModal(series, {
                    rooms: data.rooms || [],
                    instructors: data.instructors || [],
                    plans: data.plans || [],
                    planCategories: data.planCategories || []
                });
            } catch (error) {
                showToast(error.message || t("series.loadError", "Unable to load series details."), "error");
            }
        });
    }

    const registrationsBtn = overlay.querySelector("#open-registrations");
    if (registrationsBtn) {
        registrationsBtn.addEventListener("click", async () => {
            closeModal();
            await openSessionRegistrationsModal(item, data);
        });
    }

    const duplicateBtn = overlay.querySelector("#duplicate-session");
    if (duplicateBtn) {
        duplicateBtn.addEventListener("click", async () => {
            duplicateBtn.disabled = true;
            try {
                closeModal();
                await duplicateSessionFromItem(item, data);
            } catch (error) {
                showToast(error.message || t("session.duplicateError", "Unable to duplicate session."), "error");
            } finally {
                duplicateBtn.disabled = false;
            }
        });
    }

    const deleteBtn = overlay.querySelector("#delete-session");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
            const confirmed = await confirmWithModal({
                title: t("calendar.deleteTitle", "Delete session?"),
                message: t("calendar.deleteMessage", "This will remove the session and its registrations."),
                confirmLabel: t("calendar.deleteConfirm", "Delete session"),
                cancelLabel: t("common.cancel", "Cancel")
            });
            if (!confirmed) return;
            deleteBtn.disabled = true;
            try {
                await apiDelete(`/api/admin/event-instances/${item.id}`);
                showToast(t("calendar.deleteSuccess", "Session deleted."), "success");
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("calendar.deleteError", "Unable to delete session."), "error");
            } finally {
                deleteBtn.disabled = false;
            }
        });
    }

    const deleteSeriesBtn = overlay.querySelector("#delete-series");
    if (deleteSeriesBtn) {
        deleteSeriesBtn.addEventListener("click", async () => {
            const confirmed = await confirmWithModal({
                title: t("series.deleteConfirmTitle", "Delete series?"),
                message: t("series.deleteConfirmMessage", "This will remove the series and its future sessions."),
                confirmLabel: t("series.delete", "Delete series"),
                cancelLabel: t("common.cancel", "Cancel")
            });
            if (!confirmed) return;
            deleteSeriesBtn.disabled = true;
            try {
                await apiDelete(`/api/admin/event-series/${item.eventSeriesId}`);
                showToast(t("series.deleteSuccess", "Series deleted."), "success");
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("series.deleteError", "Unable to delete series."), "error");
            } finally {
                deleteSeriesBtn.disabled = false;
            }
        });
    }

    const bookedMeta = overlay.querySelector("[data-booked-meta]");
    const capacitySummaryEl = overlay.querySelector("[data-capacity-summary]");
    const updateBookedMeta = () => {
        const capacityInput = overlay.querySelector("[name=\"capacity\"]");
        const remoteCapacityInput = overlay.querySelector("[name=\"remoteCapacity\"]");
        const capacityValue = Number(capacityInput?.value || item.capacity || 0);
        const remoteCapacityValue = Number(remoteCapacityInput?.value || item.remoteCapacity || 0);
        const summary = formatCapacitySummaryCounts(bookedCount, remoteCount, capacityValue, remoteCapacityValue);
        if (bookedMeta) bookedMeta.textContent = summary;
        if (capacitySummaryEl) capacitySummaryEl.textContent = summary;
    };

    ["capacity", "remoteCapacity"].forEach(name => {
        const input = overlay.querySelector(`[name="${name}"]`);
        if (input) {
            input.addEventListener("input", updateBookedMeta);
        }
    });

    updateBookedMeta();

    const saveBtn = overlay.querySelector("#save-instance");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const formValues = {};
            ["title", "description", "status", "roomId", "instructorId", "icon", "color", "capacity", "remoteCapacity", "price", "remoteInviteUrl", "planCategoryId", "startTimeLocal", "durationMinutes"].forEach(field => {
                const element = overlay.querySelector(`[name="${field}"]`);
                formValues[field] = element ? element.value : "";
            });

            const normalizedRoomId = formValues.roomId || null;
            const normalizedInstructorId = formValues.instructorId || null;
            const capacityValue = Number(formValues.capacity || item.capacity);
            const remoteCapacityValue = Number(formValues.remoteCapacity || item.remoteCapacity || 0);
            const priceValue = Number(formValues.price || toCurrencyUnits(item.priceCents));
            const remoteInviteUrlValue = formValues.remoteInviteUrl || "";
            const selectedPlanCategoryId = formValues.planCategoryId || "";
            const titleValue = formValues.title?.trim() || "";
            const descriptionValue = formValues.description?.trim() || "";
            const iconInputValue = formValues.icon?.trim() || "";
            const colorInputValue = formValues.color?.trim() || "";
            const startTimeValue = normalizeTimeInputValue(formValues.startTimeLocal || startTimeLocal || "");
            const durationValue = Number(formValues.durationMinutes || durationMinutes || 0);
            const normalizedColorInput = ensureHexColor(colorInputValue, "");
            const effectiveIconValue = iconInputValue || seriesIconValue;
            const effectiveColorValue = normalizedColorInput || seriesColorValue;
            const nextIconOverride = iconInputValue && iconInputValue !== seriesIconValue ? iconInputValue : "";
            const nextColorOverride = effectiveColorValue && effectiveColorValue !== seriesColorValue ? effectiveColorValue : "";
            const selectedPlanIds = Array.from(overlay.querySelectorAll("input[name=\"instancePlanIds\"]:checked"))
                .map(input => input.value)
                .filter(Boolean);
            const selectedPlanSignature = selectedPlanIds.map(id => String(id)).sort().join(",");
            const seriesSignature = seriesPlanIds.map(id => String(id)).sort().join(",");
            const shouldOverridePlans = hasPlanOverride || selectedPlanSignature !== seriesSignature;
            const allowedPlanIdsJson = shouldOverridePlans ? JSON.stringify(selectedPlanIds) : null;
            const seriesCategoryId = String(seriesPlanCategoryId || "");
            const instanceCategoryId = String(instancePlanCategoryId || "");
            const toLocalDateTime = (dateKey, timeValue) => {
                const [year, month, day] = dateKey.split("-").map(Number);
                const [hours, minutes] = String(timeValue || "0:0").split(":").map(Number);
                return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
            };
            if (!startTimeValue || durationValue <= 0) {
                showToast(t("session.requiredFields", "Title, time, and duration are required."), "error");
                return;
            }
            const nextStartLocal = toLocalDateTime(sessionDateKey, startTimeValue);
            const nextEndLocal = new Date(nextStartLocal.getTime() + durationValue * 60000);
            const nextStartUtc = nextStartLocal.toISOString();
            const nextEndUtc = nextEndLocal.toISOString();
            const currentStartUtc = (parseUtcDate(item.startUtc) || new Date(item.startUtc)).getTime();
            const currentEndUtc = item.endUtc ? (parseUtcDate(item.endUtc) || new Date(item.endUtc)).getTime() : currentStartUtc;
            const startChanged = Math.abs(nextStartLocal.getTime() - currentStartUtc) > 1000;
            const endChanged = Math.abs(nextEndLocal.getTime() - currentEndUtc) > 1000;

            const hasSeriesChanges =
                titleValue !== (item.seriesTitle || "") ||
                descriptionValue !== (item.seriesDescription || "") ||
                String(normalizedRoomId || "") !== String(item.roomId || "") ||
                String(normalizedInstructorId || "") !== String(item.instructorId || "") ||
                startTimeValue !== startTimeLocal ||
                durationValue !== durationMinutes ||
                capacityValue !== Number(item.capacity || 0) ||
                remoteCapacityValue !== Number(item.remoteCapacity || 0) ||
                priceValue !== toCurrencyUnits(Number(item.priceCents || 0)) ||
                remoteInviteUrlValue !== (item.remoteInviteUrl || "") ||
                effectiveIconValue !== seriesIconValue ||
                effectiveColorValue !== seriesColorValue ||
                String(selectedPlanCategoryId || "") !== seriesCategoryId ||
                selectedPlanSignature !== seriesSignature;

            const saveInstance = async (applyToSeries) => {
                const payload = {};
                const statusNext = formValues.status || statusValue;
                const roomChanged = String(normalizedRoomId || "") !== String(item.roomId || "");
                const instructorChanged = String(normalizedInstructorId || "") !== String(item.instructorId || "");
                const normalizedPlanCategoryId = String(selectedPlanCategoryId || "");
                const hasCategoryOverride = instanceCategoryId !== "";
                if (titleValue !== (item.seriesTitle || "")) payload.title = titleValue;
                if (descriptionValue !== (item.seriesDescription || "")) payload.description = descriptionValue;
                if (statusNext !== statusValue) payload.status = statusNext;
                if (roomChanged) payload.roomId = normalizedRoomId || "00000000-0000-0000-0000-000000000000";
                if (instructorChanged) payload.instructorId = normalizedInstructorId || "00000000-0000-0000-0000-000000000000";
                if (capacityValue !== Number(item.capacity || 0)) payload.capacity = capacityValue;
                if (remoteCapacityValue !== Number(item.remoteCapacity || 0)) payload.remoteCapacity = remoteCapacityValue;
                if (priceValue !== toCurrencyUnits(Number(item.priceCents || 0))) {
                    payload.priceCents = toCents(priceValue);
                    payload.currency = item.currency || "ILS";
                }
                if (startChanged) payload.startUtc = nextStartUtc;
                if (endChanged) payload.endUtc = nextEndUtc;
                if (nextIconOverride !== (item.icon || "")) payload.icon = nextIconOverride;
                if (nextColorOverride !== (item.color || "")) payload.color = nextColorOverride;
                if (remoteInviteUrlValue !== (item.remoteInviteUrl || "")) payload.remoteInviteUrl = remoteInviteUrlValue;
                if (allowedPlanIdsJson !== null) payload.allowedPlanIdsJson = allowedPlanIdsJson;
                if (hasCategoryOverride && normalizedPlanCategoryId === seriesCategoryId) {
                    payload.planCategoryId = "00000000-0000-0000-0000-000000000000";
                } else if (normalizedPlanCategoryId !== seriesCategoryId) {
                    payload.planCategoryId = normalizedPlanCategoryId || "00000000-0000-0000-0000-000000000000";
                }

                await apiPut(`/api/admin/event-instances/${item.id}`, payload);

                closeModal();
                actor.send({ type: "REFRESH" });

                if (applyToSeries) {
                    try {
                        const [seriesList, plans] = await Promise.all([
                            apiGet("/api/admin/event-series"),
                            apiGet("/api/admin/plans")
                        ]);
                        const series = (seriesList || []).find(entry => String(entry.id) === String(item.eventSeriesId));
                        if (!series) {
                            showToast(t("series.notFound", "Series not found."), "error");
                            return;
                        }
                        const updatedSeries = {
                            ...series,
                            title: titleValue,
                            description: descriptionValue,
                            instructorId: normalizedInstructorId,
                            roomId: normalizedRoomId,
                            icon: effectiveIconValue,
                            color: effectiveColorValue,
                            defaultCapacity: capacityValue,
                            remoteCapacity: remoteCapacityValue,
                            startTimeLocal: `${startTimeValue}:00`,
                            durationMinutes: durationValue,
                            priceCents: toCents(priceValue),
                            remoteInviteUrl: remoteInviteUrlValue,
                            allowedPlanIdsJson,
                            planCategoryId: normalizedPlanCategoryId || null
                        };
                        openSeriesModal(updatedSeries, {
                            rooms: data.rooms || [],
                            instructors: data.instructors || [],
                            plans: plans || [],
                            planCategories: data.planCategories || []
                        });
                    } catch (error) {
                        showToast(error.message || t("series.loadError", "Unable to load series details."), "error");
                    }
                }
            };

            if (hasSeriesChanges) {
                openConfirmModal({
                    title: t("series.applyChangesTitle", "Apply changes to series?"),
                    message: t("series.applyChangesMessage", "Apply these updates to the whole series or only this session."),
                    confirmLabel: t("series.applyYes", "Yes, update series"),
                    cancelLabel: t("series.applyNo", "No, only this session"),
                    onConfirm: () => saveInstance(true),
                    onCancel: () => saveInstance(false)
                });
                return;
            }

            await saveInstance(false);
        });
    }

}

async function openSessionRegistrationsModal(item, data, options = {}) {
    const existing = document.getElementById("session-registrations-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const timeZone = getLocalTimeZone();
    const { timeRange, startLabel, sessionDateKey } = getSessionTiming(item, timeZone);
    let roster = [];
    try {
        roster = await apiGet(`/api/admin/event-instances/${item.id}/roster`);
    } catch {
        roster = [];
    }

    const messageSubject = `${t("session.emailSubject", "Class registration:")} ${item.seriesTitle || t("session.sessionFallback", "Session")}`;
    const bulkEmailBody = `${t("session.emailGreeting", "Hi")}, ${t("session.emailBody", "you're registered for")} ${item.seriesTitle || t("session.sessionFallbackLower", "this session")} ${t("session.emailOn", "on")} ${startLabel} (${timeRange}).`;
    const bulkSmsBody = `${t("session.smsBodyPrefix", "Reminder:")} ${item.seriesTitle || t("session.sessionFallback", "Session")} ${t("session.emailOn", "on")} ${startLabel} (${timeRange}).`;
    const isBirthdayForKey = (dateOfBirth, dateKey) => {
        if (!dateOfBirth || !dateKey) return false;
        const parts = String(dateOfBirth).split("-");
        if (parts.length < 3) return false;
        const month = parts[1];
        const day = parts[2];
        if (!month || !day) return false;
        return `${month}-${day}` === dateKey.slice(5);
    };
    const normalizeRosterRows = (rows) => rows.map(row => {
        const bookingStatusLabel = normalizeBookingStatus(row.bookingStatus);
        const attendanceLabel = normalizeAttendanceStatus(row.attendanceStatus);
        const customerName = row.customerName || t("session.greetingFallback", "there");
        const messageBody = `${t("session.emailGreeting", "Hi")} ${customerName}, ${t("session.emailBody", "you're registered for")} ${item.seriesTitle || t("session.sessionFallbackLower", "this session")} ${t("session.emailOn", "on")} ${startLabel} (${timeRange}).`;
        const encodedSubject = encodeURIComponent(messageSubject);
        const encodedBody = encodeURIComponent(messageBody);
        const email = (row.email || "").trim();
        const phone = (row.phone || "").trim();
        const phoneDigits = phone.replace(/[^\d]/g, "");
        const isRemote = Boolean(row.isRemote);
        const bookingStatusRaw = row.bookingStatus;
        const attendanceRaw = row.attendanceStatus;
        const isCancelled = bookingStatusRaw === "Cancelled" || bookingStatusRaw === 2;
        const isPresent = attendanceRaw === "Present" || attendanceRaw === 0;
        const isNoShow = attendanceRaw === "NoShow" || attendanceRaw === 1;
        const isRegistered = attendanceRaw === "Registered" || attendanceRaw === null || attendanceRaw === undefined;
        const isBirthday = isBirthdayForKey(row.dateOfBirth, sessionDateKey);
        const canRemove = Boolean(row.bookingId) && !isCancelled;
        return {
            ...row,
            bookingStatusLabel,
            attendanceLabel,
            isRemote,
            isCancelled,
            isRegistered,
            isPresent,
            isNoShow,
            isBirthday,
            canRemove,
            hasEmail: Boolean(email),
            hasPhone: Boolean(phone),
            hasWhatsapp: Boolean(phoneDigits),
            emailLink: email ? `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}` : "",
            phoneLink: phone ? `tel:${phone}` : "",
            smsLink: phone ? `sms:${phone}?&body=${encodedBody}` : "",
            whatsappLink: phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodedBody}` : ""
        };
    });

    const rosterRows = normalizeRosterRows(roster);
    const activeRows = rosterRows.filter(row => !row.isCancelled);
    const bookedCount = activeRows.filter(row => !row.isRemote).length;
    const remoteCount = activeRows.filter(row => row.isRemote).length;
    const capacityValue = Number(item.capacity || 0);
    const remoteCapacityValue = Number(item.remoteCapacity || 0);
    const capacitySummary = formatCapacitySummaryCounts(bookedCount, remoteCount, capacityValue, remoteCapacityValue);
    const rosterHtml = rosterTemplate({ roster: rosterRows });
    const customers = (data.customers || []).map(customer => ({
        ...customer,
        email: customer.email || "",
        lookupLabel: `${customer.fullName}${customer.email ? ` (${customer.email})` : ""}`
    }));
    const instructorDetails = (data.instructors || []).find(instructor => String(instructor.id) === String(item.instructorId));
    const sessionDescription = (item.seriesDescription || item.description || "").trim();
    const hasSessionDescription = sessionDescription.length > 0;
    const addCustomerOption = t("session.addCustomerOption", "Add customer...");

    const modalMarkup = sessionRegistrationsModalTemplate({
        ...item,
        timeRange,
        startLabel,
        rosterHtml,
        customers,
        capacitySummary,
        hasRemoteCapacity: remoteCapacityValue > 0,
        hasInstructorDetails: Boolean(instructorDetails),
        sessionDescription,
        hasSessionDescription,
        addCustomerOption
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-registrations");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const instructorBtn = overlay.querySelector("#open-instructor");
    if (instructorBtn && instructorDetails) {
        instructorBtn.addEventListener("click", () => openInstructorModal(instructorDetails));
    }

    const shareBtn = overlay.querySelector("#share-session-link");
    if (shareBtn) {
        shareBtn.addEventListener("click", async () => {
            await shareSessionLink(item, data);
        });
    }

    const rosterPanel = overlay.querySelector("[data-roster-panel]");
    const capacitySummaryEl = overlay.querySelector("[data-capacity-summary]");
    let currentRosterRows = rosterRows;

    const updateBookedMeta = (rows) => {
        const activeRows = rows.filter(row => !row.isCancelled);
        const bookedCount = activeRows.filter(row => !row.isRemote).length;
        const remoteCount = activeRows.filter(row => row.isRemote).length;
        item.booked = bookedCount;
        item.remoteBooked = remoteCount;
        const summary = formatCapacitySummaryCounts(bookedCount, remoteCount, capacityValue, remoteCapacityValue);
        if (capacitySummaryEl) {
            capacitySummaryEl.textContent = summary;
        }
        updateCalendarEventSummary(item.id, bookedCount, capacityValue);
    };

    const bindRosterActions = () => {
        overlay.querySelectorAll(".attendance-toggle").forEach(wrapper => {
            const buttons = Array.from(wrapper.querySelectorAll("button[data-status]"));
            const customerId = wrapper.getAttribute("data-attendance");
            buttons.forEach(btn => {
                btn.addEventListener("click", async () => {
                    const status = btn.getAttribute("data-status");
                    if (!customerId || !status) return;
                    try {
                        if (status === "Registered") {
                            await apiDelete(`/api/admin/event-instances/${item.id}/attendance/${customerId}`);
                        } else {
                            await apiPost(`/api/admin/event-instances/${item.id}/attendance`, {
                                customerId,
                                status
                            });
                        }
                        buttons.forEach(button => {
                            button.classList.toggle("active", button === btn);
                        });
                    } catch (error) {
                        showToast(error.message || t("attendance.updateError", "Unable to update attendance."), "error");
                    }
                });
            });
        });

        overlay.querySelectorAll("[data-remove-booking]").forEach(button => {
            const bookingId = button.getAttribute("data-remove-booking");
            const customerName = button.getAttribute("data-customer-name") || "";
            if (!bookingId) return;
            button.addEventListener("click", async () => {
                const confirmed = await confirmWithModal({
                    title: t("roster.removeConfirmTitle", "Remove registration?"),
                    message: t("roster.removeConfirmMessage", "This will cancel the registration for this session."),
                    confirmLabel: t("roster.remove", "Remove"),
                    cancelLabel: t("common.cancel", "Cancel")
                });
                if (!confirmed) return;
                button.disabled = true;
                try {
                    await apiDelete(`/api/admin/bookings/${bookingId}`);
                    showToast(t("roster.removeSuccess", "Registration removed."), "success");
                    await refreshRoster();
                } catch (error) {
                    showToast(error.message || t("roster.removeError", "Unable to remove registration."), "error");
                } finally {
                    button.disabled = false;
                }
            });
        });

        const rosterCheckboxes = Array.from(overlay.querySelectorAll("input[data-roster-select]"));
        const rosterSelectAll = overlay.querySelector("#roster-select-all");
        const rosterEmailBtn = overlay.querySelector("#roster-email");
        const rosterSmsBtn = overlay.querySelector("#roster-sms");

        if (rosterSelectAll) {
            rosterSelectAll.addEventListener("change", () => {
                rosterCheckboxes.forEach(box => {
                    box.checked = rosterSelectAll.checked;
                });
            });
        }

        const getSelectedRoster = () => {
            const selectedIds = rosterCheckboxes
                .filter(box => box.checked)
                .map(box => box.getAttribute("data-roster-select"));
            return currentRosterRows.filter(row => selectedIds.includes(row.customerId));
        };

        const resolveRosterRecipients = () => {
            const selected = getSelectedRoster();
            return selected.length ? selected : currentRosterRows.filter(row => !row.isCancelled);
        };

        if (rosterEmailBtn) {
            rosterEmailBtn.addEventListener("click", () => {
                const rows = resolveRosterRecipients().filter(row => row.email);
                if (rows.length === 0) {
                    showToast(t("email.noRecipients", "No email recipients available."), "error");
                    return;
                }
                const recipients = rows.map(row => ({
                    name: row.customerName,
                    email: row.email
                }));
                openEmailComposerModal({
                    title: t("email.composeTitle", "Send email"),
                    subtitle: t("email.composeSubtitle", "Review and send the message."),
                    recipients,
                    subject: messageSubject,
                    body: bulkEmailBody,
                    onSend: async (subject, body) => {
                        try {
                            await sendBulkEmail(
                                recipients.map(entry => entry.email).filter(Boolean),
                                subject,
                                body
                            );
                        } catch (error) {
                            const message = String(error?.message || "");
                            if (message.toLowerCase().includes("configured")) {
                                openBulkMailto(recipients.map(entry => entry.email).filter(Boolean), subject, body);
                                return;
                            }
                            throw error;
                        }
                    }
                });
            });
        }

        if (rosterSmsBtn) {
            rosterSmsBtn.addEventListener("click", () => {
                const rows = resolveRosterRecipients().filter(row => row.phone);
                if (rows.length === 0) {
                    showToast(t("sms.noRecipients", "No phone numbers available."), "error");
                    return;
                }
                const recipients = rows.map(row => ({
                    name: row.customerName,
                    phone: row.phone
                }));
                openSmsComposerModal({
                    title: t("sms.composeTitle", "Send SMS"),
                    subtitle: t("sms.composeSubtitle", "Prepare a text message for the group."),
                    recipients,
                    body: bulkSmsBody,
                    onSend: async (body) => {
                        openSmsLink(recipients.map(entry => entry.phone).filter(Boolean), body);
                    }
                });
            });
        }
    };

    const refreshRoster = async () => {
        if (!rosterPanel) return;
        let nextRoster = [];
        try {
            nextRoster = await apiGet(`/api/admin/event-instances/${item.id}/roster`);
        } catch {
            nextRoster = [];
        }
        currentRosterRows = normalizeRosterRows(nextRoster);
        rosterPanel.innerHTML = rosterTemplate({ roster: currentRosterRows });
        bindRosterActions();
        updateBookedMeta(currentRosterRows);
    };

    updateBookedMeta(currentRosterRows);
    bindRosterActions();

    const customerLookupInput = overlay.querySelector("[name=\"customerLookup\"]");
    const customerIdInput = overlay.querySelector("[name=\"customerId\"]");
    const customerList = customers || [];
    const resolveCustomerId = (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        if (trimmed === addCustomerOption) return "";
        const options = Array.from(overlay.querySelectorAll("#customer-list option"));
        const match = options.find(option => option.value === trimmed);
        if (match) {
            return match.getAttribute("data-customer-id") || "";
        }
        const lowered = trimmed.toLowerCase();
        const direct = customerList.find(customer =>
            (customer.email || "").toLowerCase() === lowered ||
            (customer.fullName || "").toLowerCase() === lowered);
        return direct?.id || "";
    };

    const syncCustomerLookup = () => {
        if (!customerLookupInput || !customerIdInput) return;
        customerIdInput.value = resolveCustomerId(customerLookupInput.value);
    };

    const openAddCustomerModal = (isRemote) => {
        openCustomerModal(null, data, {
            onSaved: async (savedCustomer) => {
                upsertCustomerOption(savedCustomer);
                await registerCustomer(savedCustomer?.id || "", isRemote);
            }
        });
    };

    if (customerLookupInput && customerIdInput) {
        customerLookupInput.addEventListener("input", syncCustomerLookup);
        customerLookupInput.addEventListener("change", () => {
            syncCustomerLookup();
            if (customerLookupInput.value === addCustomerOption) {
                const attendanceType = overlay.querySelector("[name=\"attendanceType\"]")?.value || "in-person";
                const isRemote = attendanceType === "remote";
                customerLookupInput.value = "";
                customerIdInput.value = "";
                openAddCustomerModal(isRemote);
            }
        });
    }

    if (options.focusRegistration && customerLookupInput) {
        const registrationForm = overlay.querySelector(".registration-form");
        if (registrationForm) {
            registrationForm.scrollIntoView({ block: "center" });
        }
        customerLookupInput.focus();
    }

    const registerBtn = overlay.querySelector("#register-customer");
    const upsertCustomerOption = (customerEntry) => {
        if (!customerEntry?.id) return;
        if (customerList.some(entry => entry.id === customerEntry.id)) return;
        const created = {
            id: customerEntry.id,
            fullName: customerEntry.fullName || "",
            email: customerEntry.email || "",
            lookupLabel: `${customerEntry.fullName}${customerEntry.email ? ` (${customerEntry.email})` : ""}`
        };
        customerList.push(created);
        const list = overlay.querySelector("#customer-list");
        if (list) {
            const option = document.createElement("option");
            option.value = created.lookupLabel;
            option.setAttribute("data-customer-id", created.id);
            list.appendChild(option);
        }
    };
    const registerCustomer = async (customerId, isRemote) => {
        if (!customerId) {
            showToast(t("session.registerValidation", "Select a customer to register."), "error");
            return;
        }
        const currentUser = actor.getSnapshot()?.context?.user || {};
        const roleList = currentUser.roles || [currentUser.role];
        const isAdmin = roleList.includes("Admin");
        const sendRegistration = async (overrideHealthWaiver) =>
            apiPost(`/api/admin/event-instances/${item.id}/registrations`, {
                customerId,
                fullName: "",
                email: "",
                phone: "",
                membershipId: null,
                isRemote,
                overrideHealthWaiver: Boolean(overrideHealthWaiver)
            });

        try {
            const result = await sendRegistration(false);
            upsertCustomerOption(result?.customer);
            if (customerLookupInput) customerLookupInput.value = "";
            if (customerIdInput) customerIdInput.value = "";
            const attendanceInput = overlay.querySelector("[name=\"attendanceType\"]");
            if (attendanceInput) attendanceInput.value = "in-person";
            showToast(t("session.registered", "Customer registered."), "success");
            await refreshRoster();
        } catch (error) {
            const message = error.message || "";
            if (message === "Health declaration required" && isAdmin) {
                const confirmOverride = await confirmWithModal({
                    title: t("session.healthOverrideTitle", "Health waiver required"),
                    message: t("session.healthOverrideConfirm", "Health waiver not signed. Register anyway?"),
                    confirmLabel: t("common.yes", "Yes"),
                    cancelLabel: t("common.no", "No")
                });
                if (confirmOverride) {
                    try {
                        const result = await sendRegistration(true);
                        upsertCustomerOption(result?.customer);
                        showToast(t("session.registered", "Customer registered."), "success");
                        await refreshRoster();
                        return;
                    } catch (overrideError) {
                        showToast(overrideError.message || t("session.registerError", "Unable to register customer."), "error");
                        return;
                    }
                }
            }
            showToast(message || t("session.registerError", "Unable to register customer."), "error");
        }
    };

    if (registerBtn) {
        registerBtn.addEventListener("click", async () => {
            const attendanceType = overlay.querySelector("[name=\"attendanceType\"]")?.value || "in-person";
            const isRemote = attendanceType === "remote";
            const customerId = customerIdInput?.value || resolveCustomerId(customerLookupInput?.value || "");
            registerBtn.disabled = true;
            try {
                await registerCustomer(customerId, isRemote);
            } finally {
                registerBtn.disabled = false;
            }
        });
    }

}

async function duplicateSessionFromItem(item, data) {
    const timeZone = getLocalTimeZone();
    let series = null;
    if (item.eventSeriesId) {
        try {
            series = await apiGet(`/api/admin/event-series/${item.eventSeriesId}`);
        } catch {
            series = null;
        }
    }

    const start = parseUtcDate(item.startUtc) || new Date(item.startUtc);
    const end = item.endUtc ? (parseUtcDate(item.endUtc) || new Date(item.endUtc)) : null;
    const durationMinutes = end
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
        : (series?.durationMinutes || 60);
    const date = getDateKeyInTimeZone(start, timeZone);
    const startTimeLocal = formatTimeInput(start, timeZone);
    const prefill = {
        title: item.seriesTitle || series?.title || "Session",
        description: item.seriesDescription || series?.description || "",
        instructorId: item.instructorId || null,
        roomId: item.roomId || null,
        startTimeLocal,
        durationMinutes,
        capacity: Number(item.capacity || series?.defaultCapacity || 0),
        remoteCapacity: Number(item.remoteCapacity || series?.remoteCapacity || 0),
        price: toCurrencyUnits(item.priceCents || series?.priceCents || 0),
        currency: item.currency || series?.currency || "ILS",
        remoteInviteUrl: item.remoteInviteUrl || series?.remoteInviteUrl || "",
        cancellationWindowHours: Number(item.cancellationWindowHours ?? series?.cancellationWindowHours ?? 0),
        allowedPlanIds: Array.isArray(item.allowedPlanIds) ? item.allowedPlanIds : parseGuidListJson(series?.allowedPlanIdsJson)
    };
    openSessionModal(data, { date, prefill, type: "one-time" });
}

function openInstructorModal(instructor) {
    if (!instructor) return;
    const existing = document.getElementById("instructor-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const email = (instructor.email || "").trim();
    const phone = (instructor.phone || "").trim();
    const phoneDigits = phone.replace(/[^\d]/g, "");
    const emailLink = email ? `mailto:${email}` : "";
    const phoneLink = phone ? `tel:${phone}` : "";
    const smsLink = phone ? `sms:${phone}` : "";
    const whatsappLink = phoneDigits ? `https://wa.me/${phoneDigits}` : "";
    const modalMarkup = instructorModalTemplate({
        displayName: instructor.displayName || t("instructor.unknown", "Instructor"),
        bio: instructor.bio || "",
        avatarUrl: instructor.avatarUrl || "",
        initials: getInitials(instructor.displayName || instructor.email),
        hasEmail: Boolean(email),
        hasPhone: Boolean(phone),
        hasWhatsapp: Boolean(phoneDigits),
        emailLink,
        phoneLink,
        smsLink,
        whatsappLink
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);
    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    const closeBtn = overlay.querySelector("#close-instructor");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
}

function openDescriptionModal(title, description) {
    const existing = document.getElementById("description-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }
    const modalMarkup = descriptionModalTemplate({
        title: title || t("session.descriptionTitle", "Description"),
        html: renderPlainText(description || "")
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);
    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    const closeBtn = overlay.querySelector("#close-description");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
}

function openCustomerRegistrationsModal(registrations) {
    const existing = document.getElementById("customer-registrations-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const rows = (registrations || []).map(reg => `
      <tr>
        <td>${escapeHtml(reg.dateLabel || "-")}</td>
        <td>${escapeHtml(reg.timeLabel || "-")}</td>
        <td>${escapeHtml(reg.seriesTitle || "")}</td>
        <td>${escapeHtml(reg.roomName || "")}</td>
        <td>${escapeHtml(reg.instructorName || "")}</td>
        <td>${escapeHtml(reg.bookingStatusLabel || "")}</td>
        <td>${escapeHtml(reg.attendanceLabel || "")}</td>
      </tr>
    `).join("");

    const content = registrations.length
        ? `<table class="table details-table">
            <thead>
              <tr>
                <th>${t("calendar.list.date", "Date")}</th>
                <th>${t("calendar.list.time", "Time")}</th>
                <th>${t("calendar.list.class", "Class")}</th>
                <th>${t("calendar.list.room", "Room")}</th>
                <th>${t("calendar.list.instructor", "Instructor")}</th>
                <th>${t("roster.booking", "Booking")}</th>
                <th>${t("roster.attendance", "Attendance")}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
        : `<div class="empty-state">${t("customer.details.noRegistrations", "No registrations yet.")}</div>`;

    const overlay = document.createElement("div");
    overlay.id = "customer-registrations-modal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h3>${t("customer.details.registrations", "Registrations")}</h3>
            <div class="muted">${t("customer.details.recentRegistrations", "Recent registrations")}</div>
          </div>
          <button class="modal-close" type="button" aria-label="${t("common.close", "Close")}"></button>
        </div>
        ${content}
      </div>
    `;

    document.body.appendChild(overlay);
    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector(".modal-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
}

async function openBillingModal(customer) {
    const existing = document.getElementById("customer-billing-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "customer-billing-modal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h3>${t("customer.details.billing", "Billing")}</h3>
            <div class="muted">${customer?.fullName || ""}</div>
          </div>
          <button class="modal-close" type="button" aria-label="${t("common.close", "Close")}"></button>
        </div>
        <div class="modal-body" id="customer-billing-body">
          <div class="empty-state">${t("billing.loading", "Loading billing data...")}</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector(".modal-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    if (!customer?.id) {
        const body = overlay.querySelector("#customer-billing-body");
        if (body) {
            body.innerHTML = `<div class="empty-state">${t("customer.details.noBilling", "No billing activity yet.")}</div>`;
        }
        return;
    }

    try {
        const charges = await apiGet(`/api/admin/billing/charges?customerId=${customer.id}`);
        const rows = (charges || []).map(charge => {
            const invoiceLabel = charge.invoiceUrl
                ? `<a class="secondary" href="${charge.invoiceUrl}" target="_blank" rel="noreferrer">${escapeHtml(charge.invoiceNo || t("invoices.download", "Download"))}</a>`
                : "-";
            return `
          <tr>
            <td>${formatDateDisplay(new Date(charge.chargeDate))}</td>
            <td>${escapeHtml(charge.description || "")}</td>
            <td>${formatPlainPrice(charge.totalCents)}</td>
            <td>${formatBillingChargeStatus(charge.status)}</td>
            <td>${invoiceLabel}</td>
          </tr>
        `;
        }).join("");
        const body = overlay.querySelector("#customer-billing-body");
        if (body) {
            if (!charges || charges.length === 0) {
                body.innerHTML = `<div class="empty-state">${t("customer.details.noBilling", "No billing activity yet.")}</div>`;
            } else {
                body.innerHTML = `
                  <table class="table">
                    <thead>
                      <tr>
                        <th>${t("billing.chargeDate", "Date")}</th>
                        <th>${t("billing.description", "Description")}</th>
                        <th>${t("billing.amount", "Amount")}</th>
                        <th>${t("billing.status", "Status")}</th>
                        <th>${t("billing.invoice", "Invoice")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows}
                    </tbody>
                  </table>
                `;
            }
        }
    } catch (error) {
        const body = overlay.querySelector("#customer-billing-body");
        if (body) {
            body.innerHTML = `<div class="empty-state">${t("billing.loadError", "Unable to load billing data.")}</div>`;
        }
    }
}

function openBirthdayModal(contacts, dateLabel, studioName) {
    if (!Array.isArray(contacts) || contacts.length === 0) return;
    const existing = document.getElementById("birthday-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }
    const subtitle = dateLabel
        ? `${t("calendar.birthdaySubtitle", "Celebrating on")} ${dateLabel}`
        : t("calendar.birthdaySubtitle", "Celebrating on");
    const normalizePhone = (phone) => (phone || "").replace(/[^\d]/g, "");
    const birthdayMessage = studioName
        ? `${t("birthday.message", "Happy birthday!")} ${t("birthday.from", "From")} ${studioName}`
        : t("birthday.message", "Happy birthday!");
    const emailSubject = studioName
        ? `${t("birthday.subject", "Happy birthday from")} ${studioName}`
        : t("birthday.subject", "Happy birthday");
    const enrichedContacts = contacts.map(contact => {
        const phoneDigits = normalizePhone(contact.phone);
        return {
            ...contact,
            whatsappLink: phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(birthdayMessage)}` : ""
        };
    });
    const modalMarkup = birthdayModalTemplate({
        title: t("calendar.birthdayTitle", "Birthdays"),
        subtitle,
        contacts: enrichedContacts
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);
    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    const closeBtn = overlay.querySelector("#close-birthday");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const emailAllBtn = overlay.querySelector("#birthday-email-all");
    if (emailAllBtn) {
        emailAllBtn.addEventListener("click", () => {
            const recipients = enrichedContacts.filter(contact => contact.email);
            if (!recipients.length) {
                showToast(t("email.noRecipients", "No email recipients available."), "error");
                return;
            }
            openEmailComposerModal({
                title: t("birthday.emailTitle", "Birthday email"),
                subtitle: t("birthday.emailSubtitle", "Send a birthday greeting."),
                recipients,
                subject: emailSubject,
                body: birthdayMessage,
                onSend: async (subject, body) => {
                    try {
                        await sendBulkEmail(
                            recipients.map(entry => entry.email).filter(Boolean),
                            subject,
                            body
                        );
                    } catch (error) {
                        const message = String(error?.message || "");
                        if (message.toLowerCase().includes("configured")) {
                            openBulkMailto(recipients.map(entry => entry.email).filter(Boolean), subject, body);
                            return;
                        }
                        throw error;
                    }
                }
            });
        });
    }

    const smsAllBtn = overlay.querySelector("#birthday-sms-all");
    if (smsAllBtn) {
        smsAllBtn.addEventListener("click", () => {
            const recipients = enrichedContacts.filter(contact => contact.phone);
            if (!recipients.length) {
                showToast(t("sms.noRecipients", "No phone numbers available."), "error");
                return;
            }
            openSmsComposerModal({
                title: t("birthday.smsTitle", "Birthday SMS"),
                subtitle: t("birthday.smsSubtitle", "Send a birthday text."),
                recipients,
                body: birthdayMessage,
                onSend: async (body) => {
                    openSmsLink(recipients.map(entry => entry.phone).filter(Boolean), body);
                }
            });
        });
    }

    overlay.querySelectorAll("[data-birthday-email]").forEach(button => {
        button.addEventListener("click", () => {
            const email = button.getAttribute("data-birthday-email") || "";
            const name = button.getAttribute("data-birthday-name") || "";
            if (!email) return;
            openEmailComposerModal({
                title: t("birthday.emailTitle", "Birthday email"),
                subtitle: t("birthday.emailSubtitle", "Send a birthday greeting."),
                recipients: [{ name, email }],
                subject: emailSubject,
                body: birthdayMessage,
                onSend: async (subject, body) => {
                    try {
                        await sendBulkEmail([email], subject, body);
                    } catch (error) {
                        const message = String(error?.message || "");
                        if (message.toLowerCase().includes("configured")) {
                            openBulkMailto([email], subject, body);
                            return;
                        }
                        throw error;
                    }
                }
            });
        });
    });

    overlay.querySelectorAll("[data-birthday-sms]").forEach(button => {
        button.addEventListener("click", () => {
            const phone = button.getAttribute("data-birthday-sms") || "";
            const name = button.getAttribute("data-birthday-name") || "";
            if (!phone) return;
            openSmsComposerModal({
                title: t("birthday.smsTitle", "Birthday SMS"),
                subtitle: t("birthday.smsSubtitle", "Send a birthday text."),
                recipients: [{ name, phone }],
                body: birthdayMessage,
                onSend: async (body) => {
                    openSmsLink([phone], body);
                }
            });
        });
    });
}

function openConfirmModal({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
    const existing = document.getElementById("confirm-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }
    const modalMarkup = confirmModalTemplate({
        title: title || t("common.confirm", "Confirm"),
        message: message || "",
        confirmLabel: confirmLabel || t("common.yes", "Yes"),
        cancelLabel: cancelLabel || t("common.no", "No")
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);
    let cleanupEscape = () => {};
    const closeModal = (didConfirm) => {
        cleanupEscape();
        overlay.remove();
        if (didConfirm) {
            onConfirm?.();
        } else {
            onCancel?.();
        }
    };
    cleanupEscape = bindModalEscape(() => closeModal(false));
    bindModalBackdrop(overlay);
    const closeBtn = overlay.querySelector("#close-confirm");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => closeModal(false));
    }
    const confirmBtn = overlay.querySelector("#confirm-ok");
    if (confirmBtn) {
        confirmBtn.addEventListener("click", () => closeModal(true));
    }
    const cancelBtn = overlay.querySelector("#confirm-cancel");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => closeModal(false));
        cancelBtn.focus();
    }
}

function confirmWithModal(options) {
    return new Promise(resolve => {
        openConfirmModal({
            ...options,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
}

function openTagReplaceModal(tagName, replacements) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
          <div class="modal modal-compact">
            <div class="modal-header">
              <div>
                <h3>${t("customerTags.deleteTitle", "Delete tag")}</h3>
                <div class="muted">${t("customerTags.deleteSubtitle", "Choose a replacement tag or remove it entirely.")}</div>
              </div>
              <button class="modal-close" id="close-tag-replace" type="button" aria-label="${t("common.close", "Close")}"></button>
            </div>
            <div class="modal-body">
              <label>${t("customerTags.replaceLabel", "Replace with (optional)")}</label>
              <select id="tag-replace-select">
                <option value="">${t("customerTags.replaceNone", "No replacement")}</option>
                ${(replacements || []).map(name => `<option value="${name}">${name}</option>`).join("")}
              </select>
              <div class="meta">${t("customerTags.deleteHint", "Customers with this tag will be updated.")}</div>
            </div>
            <div class="modal-actions" style="justify-content:flex-end;">
              <button id="confirm-tag-delete">${t("customerTags.delete", "Delete")}</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        let cleanupEscape = () => {};
        const closeModal = (value) => {
            cleanupEscape();
            overlay.remove();
            resolve(value);
        };
        cleanupEscape = bindModalEscape(() => closeModal(null));
        bindModalBackdrop(overlay);

        overlay.querySelector("#close-tag-replace")?.addEventListener("click", () => closeModal(null));
        overlay.querySelector("#confirm-tag-delete")?.addEventListener("click", () => {
            const replacement = overlay.querySelector("#tag-replace-select")?.value || "";
            closeModal(replacement);
        });
    });
}

function bindIconPreview(container) {
    if (!container) return;
    container.querySelectorAll(".icon-field").forEach(field => {
        const input = field.querySelector("input[name=\"icon\"]");
        const preview = field.querySelector("[data-icon-preview]");
        if (!input || !preview) return;
        const update = () => {
            const value = input.value?.trim() || "";
            preview.textContent = value;
            preview.classList.toggle("is-empty", !value);
        };
        input.addEventListener("input", update);
        update();
    });
}

function bindRoomRemoteDefaults(container, rooms, initialValue = "") {
    if (!container) return;
    const roomSelect = container.querySelector("select[name=\"roomId\"]");
    const inviteInput = container.querySelector("input[name=\"remoteInviteUrl\"]");
    if (!roomSelect || !inviteInput) return;
    const roomMap = new Map((rooms || []).map(room => [String(room.id), room]));
    let lastAutoValue = initialValue || inviteInput.value || "";

    const applyRoomDefault = () => {
        const room = roomMap.get(String(roomSelect.value || ""));
        const nextDefault = room?.supportsRemote ? (room.remoteLink || "") : "";
        if (!nextDefault) {
            if (inviteInput.value === lastAutoValue) {
                inviteInput.value = "";
            }
            lastAutoValue = "";
            return;
        }
        if (!inviteInput.value || inviteInput.value === lastAutoValue) {
            inviteInput.value = nextDefault;
            lastAutoValue = nextDefault;
        }
    };

    roomSelect.addEventListener("change", applyRoomDefault);
    applyRoomDefault();
}

function openIconPicker(targetInput) {
    if (!targetInput) return;
    const existing = document.getElementById("icon-picker-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }
    const modalMarkup = iconPickerTemplate({ icons: ICON_OPTIONS });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);
    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    const closeBtn = overlay.querySelector("#close-icon-picker");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
    const clearBtn = overlay.querySelector("#clear-icon");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            targetInput.value = "";
            targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            closeModal();
        });
    }
    overlay.querySelectorAll(".icon-option").forEach(button => {
        button.addEventListener("click", () => {
            const icon = button.getAttribute("data-icon") || "";
            targetInput.value = icon;
            targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            closeModal();
        });
    });
}

function bindIconPicker(container) {
    if (!container) return;
    container.querySelectorAll("[data-icon-picker]").forEach(button => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const selector = button.getAttribute("data-icon-target") || "input[name=\"icon\"]";
            const target = container.querySelector(selector) || document.querySelector(selector);
            if (target) {
                openIconPicker(target);
            }
        });
    });
}

async function sendInviteEmail(id, subject, body) {
    return apiPost(`/api/admin/users/${id}/invite-email`, { subject, body });
}

function openInviteEmailModal({ email, subject, body, onSend }) {
    const existing = document.getElementById("invite-email-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = inviteEmailTemplate({ email, subject, body });
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-invite-email");
    const cancelBtn = overlay.querySelector("#cancel-invite-email");
    const sendBtn = overlay.querySelector("#send-invite-email");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (sendBtn) {
        sendBtn.addEventListener("click", async () => {
            const subjectValue = overlay.querySelector("[name=\"inviteSubject\"]")?.value || "";
            const bodyValue = overlay.querySelector("[name=\"inviteBody\"]")?.value || "";
            sendBtn.disabled = true;
            try {
                const result = await onSend(subjectValue, bodyValue);
                if (result?.fallback) {
                    closeModal();
                    return;
                }
                showToast(t("invite.emailSent", "Invite email sent."), "success");
                closeModal();
            } catch (error) {
                const message = error?.message || t("invite.emailError", "Unable to send invite email.");
                if (isEmailConfigError(message)) {
                    openInviteEmail({ email, subject: subjectValue, body: bodyValue });
                    showToast(t("email.fallback", "Opened email client."), "success");
                    closeModal();
                    sendBtn.disabled = false;
                    return;
                }
                showToast(message, "error");
            } finally {
                sendBtn.disabled = false;
            }
        });
    }
}

async function sendBulkEmail(recipients, subject, body) {
    return apiPost("/api/admin/communications/email", {
        recipients,
        subject,
        body
    });
}

function isEmailConfigError(message) {
    return (message || "").toLowerCase().includes("email delivery is not configured");
}

function openBulkMailto(recipients, subject, body) {
    if (!recipients || recipients.length === 0) return;
    const emails = recipients
        .map(entry => (typeof entry === "string" ? entry : entry?.email))
        .filter(Boolean);
    if (!emails.length) return;
    const to = encodeURIComponent(emails.join(","));
    const encodedSubject = encodeURIComponent(subject || "");
    const encodedBody = encodeURIComponent(body || "");
    window.location.href = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
}

function openEmailComposerModal({ title, subtitle, recipients, subject, body, onSend }) {
    if (!recipients || recipients.length === 0) return;
    const existing = document.getElementById("email-composer-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }
    const modalMarkup = emailComposerTemplate({
        title,
        subtitle,
        recipients,
        subject,
        body
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-email-composer");
    const cancelBtn = overlay.querySelector("#cancel-email-composer");
    const sendBtn = overlay.querySelector("#send-email-composer");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (sendBtn) {
        sendBtn.addEventListener("click", async () => {
            const subjectValue = overlay.querySelector("[name=\"emailSubject\"]")?.value || "";
            const bodyValue = overlay.querySelector("[name=\"emailBody\"]")?.value || "";
            sendBtn.disabled = true;
            try {
                await onSend(subjectValue, bodyValue);
                showToast(t("email.sent", "Email sent."), "success");
                closeModal();
            } catch (error) {
                const message = error?.message || t("email.error", "Unable to send email.");
                if (isEmailConfigError(message)) {
                    openBulkMailto(recipients, subjectValue, bodyValue);
                    showToast(t("email.fallback", "Opened email client."), "success");
                    closeModal();
                    sendBtn.disabled = false;
                    return;
                }
                showToast(message, "error");
            } finally {
                sendBtn.disabled = false;
            }
        });
    }
}

function openSmsLink(recipients, body) {
    if (!recipients || recipients.length === 0) return;
    const encodedBody = encodeURIComponent(body || "");
    const numbers = recipients.join(",");
    window.location.href = `sms:${numbers}?&body=${encodedBody}`;
}

function openSmsComposerModal({ title, subtitle, recipients, body, onSend }) {
    if (!recipients || recipients.length === 0) return;
    const existing = document.getElementById("sms-composer-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }
    const modalMarkup = smsComposerTemplate({
        title,
        subtitle,
        recipients,
        body
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-sms-composer");
    const cancelBtn = overlay.querySelector("#cancel-sms-composer");
    const sendBtn = overlay.querySelector("#send-sms-composer");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (sendBtn) {
        sendBtn.addEventListener("click", async () => {
            const bodyValue = overlay.querySelector("[name=\"smsBody\"]")?.value || "";
            sendBtn.disabled = true;
            try {
                await onSend(bodyValue);
                showToast(t("sms.sent", "SMS prepared."), "success");
                closeModal();
            } catch (error) {
                const message = error?.message || t("sms.error", "Unable to send SMS.");
                showToast(message, "error");
            } finally {
                sendBtn.disabled = false;
            }
        });
    }
}

function openSessionModal(data, options = {}) {
    const existing = document.getElementById("session-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const calendarMeta = data.calendar || {};
    const focusDate = options.date || calendarMeta.focusDate || toDateInputValue(new Date());
    const focusDateDisplay = formatDateDisplay(focusDate);
    const focusDateValue = normalizeDateInputValue(focusDate);
    const prefill = options.prefill || {};
    const allowedPlanSet = new Set((prefill.allowedPlanIds || []).map(id => String(id)));
    const defaultPlanCategoryId = (data.planCategories || []).find(category => category.isDefault && category.isActive)?.id || "";
    const selectedPlanCategoryId = prefill.planCategoryId || defaultPlanCategoryId || "";
    const planCategories = buildPlanCategoryOptions(data.planCategories || [], selectedPlanCategoryId);
    const plans = filterPlansByCategory(data.plans || [], selectedPlanCategoryId).map(plan => ({
        id: plan.id,
        name: plan.name,
        price: formatPlainPrice(plan.priceCents),
        selected: allowedPlanSet.has(String(plan.id))
    }));
    const titleSuggestions = buildTitleSuggestions(data);
    const titleSuggestionId = createTitleSuggestionId("session-title");
    const baseDate = parseDateInput(options.date || focusDate);
    const defaultGenerateUntil = normalizeDateInputValue(addDays(baseDate, 365));
    const modalMarkup = sessionModalTemplate({
        focusDateDisplay,
        focusDateValue,
        generateUntilValue: defaultGenerateUntil,
        rooms: data.rooms || [],
        instructors: data.instructors || [],
        plans,
        planCategories,
        titleSuggestions,
        titleSuggestionId
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    bindRoomRemoteDefaults(overlay, data.rooms || [], prefill.remoteInviteUrl || "");

    const closeBtn = overlay.querySelector("#close-session");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const typeSelect = overlay.querySelector("[name=\"sessionType\"]");
    const oneTimeSection = overlay.querySelector(".session-one-time");
    const recurringSection = overlay.querySelector(".session-recurring");
    if (options.date) {
        const dateInput = overlay.querySelector("[name=\"date\"]");
        const startDateInput = overlay.querySelector("[name=\"startDate\"]");
        const generateUntilInput = overlay.querySelector("[name=\"generateUntil\"]");
        if (dateInput) dateInput.value = normalizeDateInputValue(options.date);
        if (startDateInput) startDateInput.value = normalizeDateInputValue(options.date);
        const dateValue = parseDateInput(options.date);
        overlay.querySelectorAll("input[name=\"recurringDays\"]").forEach(input => {
            input.checked = Number(input.value) === dateValue.getDay();
        });
        if (generateUntilInput) {
            generateUntilInput.value = normalizeDateInputValue(addDays(dateValue, 365));
        }
    }

    const setValue = (name, value) => {
        const input = overlay.querySelector(`[name="${name}"]`);
        if (input && value !== undefined && value !== null) {
            input.value = value;
        }
    };

    if (prefill && Object.keys(prefill).length > 0) {
        setValue("title", prefill.title);
        setValue("description", prefill.description);
        setValue("instructorId", prefill.instructorId || "");
        setValue("roomId", prefill.roomId || "");
        setValue("startTimeLocal", prefill.startTimeLocal);
        setValue("durationMinutes", prefill.durationMinutes);
        setValue("capacity", prefill.capacity);
        setValue("remoteCapacity", prefill.remoteCapacity);
        setValue("price", prefill.price);
        setValue("remoteInviteUrl", prefill.remoteInviteUrl);
        setValue("cancellationWindowHours", prefill.cancellationWindowHours);
        setValue("planCategoryId", prefill.planCategoryId || selectedPlanCategoryId);
    }

    const setMode = (mode) => {
        const isRecurring = mode === "recurring";
        if (oneTimeSection) oneTimeSection.classList.toggle("hidden", isRecurring);
        if (recurringSection) recurringSection.classList.toggle("hidden", !isRecurring);
    };

    if (typeSelect) {
        if (options.type) {
            typeSelect.value = options.type;
        }
        typeSelect.addEventListener("change", () => {
            setMode(typeSelect.value);
        });
    }

    const saveBtn = overlay.querySelector("#save-session");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const type = getValue("sessionType") || "one-time";
            const selectedPlanIds = Array.from(overlay.querySelectorAll("input[name=\"sessionPlanIds\"]:checked"))
                .map(input => input.value)
                .filter(Boolean);
            const planCategoryId = getValue("planCategoryId") || "";
            const normalizedStartTime = normalizeTimeInputValue(getValue("startTimeLocal"));
            const payload = {
                title: getValue("title"),
                description: getValue("description"),
                instructorId: getValue("instructorId") || null,
                roomId: getValue("roomId") || null,
                planCategoryId: planCategoryId || null,
                startTimeLocal: normalizedStartTime ? `${normalizedStartTime}:00` : "",
                durationMinutes: Number(getValue("durationMinutes") || 0),      
                capacity: Number(getValue("capacity") || 0),
                remoteCapacity: Number(getValue("remoteCapacity") || 0),
                priceCents: toCents(Number(getValue("price") || 0)),
                currency: "ILS",
                remoteInviteUrl: getValue("remoteInviteUrl") || "",
                cancellationWindowHours: Number(getValue("cancellationWindowHours") || 0),
                allowedPlanIdsJson: JSON.stringify(selectedPlanIds)
            };

            if (!payload.title || !payload.startTimeLocal || payload.durationMinutes <= 0) {
                showToast(t("session.requiredFields", "Title, time, and duration are required."), "error");
                return;
            }

            try {
                if (type === "recurring") {
                    const startDate = normalizeDateInputValue(getValue("startDate")) || focusDate;
                    const selectedDays = Array.from(overlay.querySelectorAll("input[name=\"recurringDays\"]:checked"))
                        .map(input => Number(input.value))
                        .filter(value => Number.isFinite(value));
                    const recurrenceIntervalWeeks = 1;
                    const generateUntil = normalizeDateInputValue(getValue("generateUntil"))
                        || normalizeDateInputValue(addDays(parseDateInput(startDate), 365));

                    if (!selectedDays.length) {
                        showToast(t("session.daysRequired", "Select at least one day of week."), "error");
                        return;
                    }

                    await apiPost("/api/admin/event-series", {
                        title: payload.title,
                        description: payload.description || "",
                        instructorId: payload.instructorId,
                        roomId: payload.roomId,
                        planCategoryId: payload.planCategoryId,
                        dayOfWeek: selectedDays[0],
                        daysOfWeekJson: JSON.stringify(selectedDays),
                        startTimeLocal: payload.startTimeLocal,
                        durationMinutes: payload.durationMinutes,
                        recurrenceIntervalWeeks,
                        generateUntil,
                        generateFrom: startDate,
                        defaultCapacity: payload.capacity,
                        remoteCapacity: payload.remoteCapacity,
                        priceCents: payload.priceCents,
                        currency: payload.currency,
                        remoteInviteUrl: payload.remoteInviteUrl,
                        allowedPlanIdsJson: payload.allowedPlanIdsJson,
                        cancellationWindowHours: payload.cancellationWindowHours,
                        isActive: true
                    });
                } else {
                    const date = normalizeDateInputValue(getValue("date")) || focusDate;
                    await apiPost("/api/admin/event-instances", {
                        title: payload.title,
                        description: payload.description || "",
                        date,
                        startTimeLocal: payload.startTimeLocal,
                        durationMinutes: payload.durationMinutes,
                        instructorId: payload.instructorId,
                        roomId: payload.roomId,
                        planCategoryId: payload.planCategoryId,
                        capacity: payload.capacity,
                        remoteCapacity: payload.remoteCapacity,
                        priceCents: payload.priceCents,
                        currency: payload.currency,
                        remoteInviteUrl: payload.remoteInviteUrl,
                        allowedPlanIdsJson: payload.allowedPlanIdsJson,
                        cancellationWindowHours: payload.cancellationWindowHours,
                        status: "Scheduled"
                    });
                }

                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("session.createError", "Unable to create session."), "error");
            }
        });
    }

    setMode(typeSelect?.value || "one-time");
}

async function openBulkRegistrationModal(selectedCustomers, data) {
    const existing = document.getElementById("bulk-registration-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const calendarMeta = data.calendar || {};
    const studio = calendarMeta.studio || {};
    const timeZone = getLocalTimeZone();
    const from = toDateInputValue(new Date());
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 14);
    const to = toDateInputValue(toDate);
    const sessions = await apiGet(`/api/admin/calendar?from=${from}&to=${to}`);

    const sessionOptions = (sessions || []).map(item => {
        const start = parseUtcDate(item.startUtc) || new Date(item.startUtc);
        const label = `${item.seriesTitle} - ${formatMonthDay(start, timeZone)} ${formatTimeOnly(start, timeZone)}`;
        return { id: item.id, label };
    });

    const modalMarkup = bulkRegistrationTemplate({
        count: selectedCustomers.length,
        sessions: sessionOptions
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-bulk-registration");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const confirmBtn = overlay.querySelector("#confirm-bulk-registration");
    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            const sessionId = overlay.querySelector("[name=\"sessionId\"]")?.value;
            if (!sessionId) return;
            await Promise.all(selectedCustomers.map(customer => apiPost(`/api/admin/event-instances/${sessionId}/registrations`, {
                customerId: customer.id,
                fullName: "",
                email: "",
                phone: "",
                membershipId: null,
                isRemote: false
            })));
            closeModal();
            actor.send({ type: "REFRESH" });
        });
    }
}

function openProfileModal(user, studio) {
    const existing = document.getElementById("profile-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const rolesLabel = (user.roles || [user.role]).filter(Boolean).join(", ");
    const modalMarkup = profileModalTemplate({
        displayName: user.displayName || "",
        email: user.email || "",
        rolesLabel,
        avatarUrl: user.avatarUrl || ""
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);

    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-profile");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const avatarInput = overlay.querySelector("[name=\"profileAvatarUrl\"]");
    const avatarFileInput = overlay.querySelector("[name=\"profileAvatarFile\"]");
    const avatarPreview = overlay.querySelector(".avatar-preview");

    const syncAvatarPreview = () => {
        const value = avatarInput?.value.trim() || "";
        setAvatarPreview(avatarPreview, value);
    };

    if (avatarInput) {
        avatarInput.addEventListener("input", syncAvatarPreview);
    }

    if (avatarFileInput && avatarInput) {
        avatarFileInput.addEventListener("change", () => {
            const file = avatarFileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const result = typeof reader.result === "string" ? reader.result : "";
                if (result) {
                    avatarInput.value = result;
                    syncAvatarPreview();
                }
            };
            reader.readAsDataURL(file);
        });
    }

    const saveBtn = overlay.querySelector("#save-profile");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const displayName = getValue("profileDisplayName").trim();
            const email = getValue("profileEmail").trim();
            const password = getValue("profilePassword");
            const avatarUrl = getValue("profileAvatarUrl").trim();

            if (!displayName || !email) {
                showToast(t("profile.required", "Display name and email are required."), "error");
                return;
            }

            try {
                const updated = await apiPut("/api/admin/profile", {
                    displayName,
                    email,
                    password: password || null,
                    avatarUrl,
                    preferredLocale: user?.preferredLocale || null
                });
                showToast(t("profile.updated", "Profile updated."), "success");
                actor.send({ type: "SET_SESSION", output: { user: updated, studio } });
                closeModal();
            } catch (error) {
                showToast(error.message || t("profile.updateError", "Unable to update profile."), "error");
            }
        });
    }
}

function openCustomerModal(customer, data, options = {}) {
    const existing = document.getElementById("customer-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(customer?.id);
    const attachmentsHtml = customerAttachmentsTemplate({
        attachments: [],
        hasAttachments: false
    });
    const statusList = (data?.customerStatuses || []).filter(status => status.isActive !== false);
    const defaultStatusId = statusList.find(status => status.isDefault)?.id || statusList[0]?.id || "";
    const selectedStatusId = customer?.statusId || defaultStatusId;
    const statusOptions = statusList.map(status => ({
        id: status.id,
        name: status.name,
        selected: String(status.id) === String(selectedStatusId)
    }));
    const genderValue = (customer?.gender || "").trim();
    const genderOptions = [
        { value: "", label: t("common.select", "Select"), selected: !genderValue },
        { value: "Male", label: t("gender.male", "Male"), selected: genderValue === "Male" },
        { value: "Female", label: t("gender.female", "Female"), selected: genderValue === "Female" }
    ];
    const tagSuggestions = collectTagSuggestions(data?.customers || [], data?.customerTags || []);
    const tagColorMap = buildTagColorMap(data?.customerTags || []);
    const modalMarkup = customerModalTemplate({
        title: isEdit ? t("customer.editTitle", "Edit customer") : t("customer.addTitle", "Add customer"),
        subtitle: isEdit
            ? t("customer.editSubtitle", "Update contact details and status.")
            : t("customer.addSubtitle", "Create a new customer record."),
        footerNote: t("customer.footer", "Customers can register for classes once saved."),
        saveLabel: isEdit ? t("common.saveChanges", "Save changes") : t("customer.create", "Create customer"),
        isEdit,
        customerId: customer?.id || "",
        fullName: customer?.fullName || "",
        email: customer?.email || "",
        phone: customer?.phone || "",
        idNumber: customer?.idNumber || "",
        genderOptions,
        dateOfBirthValue: customer?.dateOfBirth ? normalizeDateInputValue(customer.dateOfBirth) : "",
        ageLabel: formatAgeLabel(customer?.dateOfBirth),
        city: customer?.city || "",
        address: customer?.address || "",
        occupation: customer?.occupation || "",
        signedHealthView: customer?.signedHealthView || false,
        statusOptions,
        tags: customer?.tags ?? formatTags(customer?.tagsJson),
        tagSuggestions,
        isArchived: customer?.isArchived,
        attachmentsHtml
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    setupTagInput(overlay, tagColorMap);
    setupCustomerAddressAutocomplete(overlay, data?.studio?.googlePlacesApiKey || "");

    const closeBtn = overlay.querySelector("#close-customer");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const attachmentsList = overlay.querySelector("#customer-attachments-list");
    const uploadBtn = overlay.querySelector("#upload-attachment");
    const uploadInput = overlay.querySelector("[name=\"attachmentFile\"]");
    const dropzone = overlay.querySelector("#attachment-dropzone");
    const renderAttachments = (items) => {
        if (!attachmentsList) return;
        const viewModel = (items || []).map(item => ({
            ...item,
            uploadedLabel: formatShortDate(item.uploadedAtUtc),
            downloadUrl: `/api/admin/customers/${customer?.id}/attachments/${item.id}`
        }));
        attachmentsList.innerHTML = customerAttachmentsTemplate({
            attachments: viewModel,
            hasAttachments: viewModel.length > 0
        });
    };

    const refreshAttachments = async () => {
        if (!isEdit || !customer?.id) return;
        try {
            const list = await apiGet(`/api/admin/customers/${customer.id}/attachments`);
            renderAttachments(list || []);
        } catch {
            renderAttachments([]);
        }
    };

    if (isEdit && customer?.id) {
        refreshAttachments();
    }

    const uploadAttachment = async () => {
        if (!uploadInput || !customer?.id) return;
        const file = uploadInput.files?.[0];
        if (!file) return;
        try {
            await uploadCustomerAttachment(customer.id, file);
            uploadInput.value = "";
            await refreshAttachments();
        } catch (error) {
            showToast(error.message || t("customer.uploadError", "Unable to upload attachment."), "error");
        }
    };

    if (uploadBtn && uploadInput && customer?.id) {
        uploadBtn.addEventListener("click", uploadAttachment);
        uploadInput.addEventListener("change", uploadAttachment);
    }

    if (dropzone && uploadInput && customer?.id) {
        const setDragActive = (active) => dropzone.classList.toggle("drag-over", active);
        dropzone.addEventListener("dragover", (event) => {
            event.preventDefault();
            setDragActive(true);
        });
        dropzone.addEventListener("dragleave", () => setDragActive(false));
        dropzone.addEventListener("drop", (event) => {
            event.preventDefault();
            setDragActive(false);
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return;
            uploadInput.files = files;
            uploadAttachment();
        });
    }

    if (attachmentsList && customer?.id) {
        attachmentsList.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-attachment-delete]");
            if (!button) return;
            const attachmentId = button.getAttribute("data-attachment-delete");
            if (!attachmentId) return;
            try {
                await apiDelete(`/api/admin/customers/${customer.id}/attachments/${attachmentId}`);
                await refreshAttachments();
            } catch (error) {
                showToast(error.message || t("customer.attachmentDeleteError", "Unable to delete attachment."), "error");
            }
        });
    }

    const resetPasswordBtn = overlay.querySelector("#reset-customer-password");
    if (resetPasswordBtn && isEdit && customer?.id) {
        resetPasswordBtn.addEventListener("click", async () => {
            const confirmed = await confirmWithModal({
                title: t("customer.resetPasswordTitle", "Reset customer password"),
                message: t("customer.resetPasswordConfirm", "Generate a new temporary password for this customer?"),
                confirmLabel: t("common.yes", "Yes"),
                cancelLabel: t("common.no", "No")
            });
            if (!confirmed) return;
            resetPasswordBtn.disabled = true;
            try {
                const result = await apiPost(`/api/admin/customers/${customer.id}/reset-password`, {});
                const tempPassword = result?.tempPassword || "";
                if (tempPassword) {
                    try {
                        await navigator.clipboard.writeText(tempPassword);
                        showToast(t("customer.resetPasswordCopied", "Temporary password copied."), "success");
                    } catch {
                        showToast(`${t("customer.resetPasswordTemp", "Temporary password")}: ${tempPassword}`, "success");
                    }
                    openDescriptionModal(t("customer.resetPasswordTitle", "Temporary password"), tempPassword);
                } else {
                    showToast(t("customer.resetPasswordSuccess", "Password reset."), "success");
                }
            } catch (error) {
                showToast(error.message || t("customer.resetPasswordError", "Unable to reset password."), "error");
            } finally {
                resetPasswordBtn.disabled = false;
            }
        });
    }

    const saveBtn = overlay.querySelector("#save-customer");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const fullName = getValue("fullName").trim();
            const email = getValue("email").trim();
            const phone = getValue("phone").trim();
            const idNumber = getValue("idNumber").trim();
            const gender = getValue("gender");
            const dateOfBirth = normalizeDateInputValue(getValue("dateOfBirth")) || null;
            const city = getValue("city").trim();
            const address = getValue("address").trim();
            const occupation = getValue("occupation").trim();
            const signedHealthView = getValue("signedHealthView") === "true";   
            const statusId = getValue("statusId") || null;
            const tags = serializeTags(getValue("tags"));
            const isArchived = getValue("isArchived") === "true";

            if (!fullName || !email) {
                showToast(t("customer.required", "Full name and email are required."), "error");
                return;
            }

            try {
                let saved = null;
                if (isEdit && customer?.id) {
                    saved = await apiPut(`/api/admin/customers/${customer.id}`, {
                        fullName,
                        email,
                        phone,
                        idNumber,
                        gender,
                        dateOfBirth,
                        city,
                        address,
                        occupation,
                        signedHealthView,
                        statusId,
                        tags,
                        isArchived
                    });
                } else {
                    saved = await apiPost("/api/admin/customers", {
                        fullName,
                        email,
                        phone,
                        idNumber,
                        gender,
                        dateOfBirth,
                        city,
                        address,
                        occupation,
                        signedHealthView,
                        statusId,
                        tags
                    });
                }
                if (saved) {
                    options.onSaved?.(saved);
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("customer.saveError", "Unable to save customer."), "error");
            }
        });
    }
}

function openCustomerStatusModal(statuses) {
    const existing = document.getElementById("customer-status-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const statusRows = (statuses || []).map(status => ({
        ...status,
        defaultLabel: status.isDefault ? t("common.yes", "Yes") : t("common.no", "No"),
        activeLabel: status.isActive ? t("common.yes", "Yes") : t("common.no", "No")
    }));

    const modalMarkup = customerStatusModalTemplate({
        statuses: statusRows,
        statusId: "",
        statusName: "",
        statusDefault: false,
        statusActive: true,
        saveLabel: t("customerStatus.add", "Add status")
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-statuses");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-status");
    const resetBtn = overlay.querySelector("#reset-status");
    const setForm = (status) => {
        overlay.querySelector("[name=\"statusId\"]").value = status?.id || "";
        overlay.querySelector("[name=\"statusName\"]").value = status?.name || "";
        overlay.querySelector("[name=\"statusDefault\"]").value = status?.isDefault ? "true" : "false";
        overlay.querySelector("[name=\"statusActive\"]").value = status?.isActive === false ? "false" : "true";
        if (saveBtn) {
            saveBtn.textContent = status?.id
                ? t("customerStatus.update", "Update status")
                : t("customerStatus.add", "Add status");
        }
    };

    if (resetBtn) {
        resetBtn.addEventListener("click", () => setForm(null));
    }

    overlay.querySelectorAll("[data-status-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-status-edit");
            const status = statusRows.find(item => String(item.id) === String(id));
            if (!status) return;
            setForm(status);
        });
    });

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const statusId = getValue("statusId");
            const name = getValue("statusName").trim();
            const isDefault = getValue("statusDefault") === "true";
            const isActive = getValue("statusActive") === "true";

            if (!name) {
                showToast(t("customerStatus.nameRequired", "Status name is required."), "error");
                return;
            }

            const payload = { name, isDefault, isActive };
            try {
                if (statusId) {
                    await apiPut(`/api/admin/customer-statuses/${statusId}`, payload);
                } else {
                    await apiPost("/api/admin/customer-statuses", payload);
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("customerStatus.saveError", "Unable to save status."), "error");
            }
        });
    }
}

function openCustomerTagModal(tags) {
    const existing = document.getElementById("customer-tag-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    let tagRows = normalizeTagCatalog(tags);
    const modalMarkup = customerTagModalTemplate({
        tags: tagRows,
        tagOriginal: "",
        tagName: "",
        tagColor: nextTagColor(tagRows),
        saveLabel: t("customerTags.add", "Add tag")
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-tags");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-tag");
    const resetBtn = overlay.querySelector("#reset-tag");
    const tagBody = overlay.querySelector("#customer-tag-rows");
    const colorInput = overlay.querySelector("[name=\"tagColor\"]");
    const setForm = (tagName, tagColor) => {
        overlay.querySelector("[name=\"tagOriginal\"]").value = tagName || "";
        overlay.querySelector("[name=\"tagName\"]").value = tagName || "";
        if (colorInput) colorInput.value = tagColor || nextTagColor(tagRows);
        if (saveBtn) {
            saveBtn.textContent = tagName
                ? t("customerTags.update", "Update tag")
                : t("customerTags.add", "Add tag");
        }
    };

    if (resetBtn) {
        resetBtn.addEventListener("click", () => setForm("", nextTagColor(tagRows)));
    }

    if (colorInput) {
        colorInput.addEventListener("input", () => {
            colorInput.value = colorInput.value;
        });
    }

    const renderTagRows = (nextTags) => {
        tagRows = normalizeTagCatalog(nextTags);
        if (!tagBody) return;
        const rowsMarkup = tagRows.map(row => {
            const safeName = escapeHtml(row.name);
            const safeColor = escapeHtml(row.color || TAG_COLOR_PALETTE[0]);
            const encoded = encodeURIComponent(row.name);
            return `
              <tr>
                <td>${safeName}</td>
                <td><span class="color-dot" style="background: ${safeColor};"></span></td>
                <td>
                  <button class="secondary btn-edit" data-tag-edit="${encoded}">
                    <span class="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                    </span>
                    ${t("common.edit", "Edit")}
                  </button>
                  <button class="secondary btn-danger" data-tag-delete="${encoded}">
                    <span class="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </span>
                    ${t("customerTags.delete", "Delete")}
                  </button>
                </td>
              </tr>
            `;
        }).join("");
        tagBody.innerHTML = rowsMarkup;
        bindTagRowActions();
    };

    const bindTagRowActions = () => {
        overlay.querySelectorAll("[data-tag-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const encoded = btn.getAttribute("data-tag-edit") || "";
                if (!encoded) return;
                const name = decodeURIComponent(encoded);
                const match = tagRows.find(item => item.name.toLowerCase() === name.toLowerCase());
                setForm(name, match?.color || nextTagColor(tagRows));
            });
        });

        overlay.querySelectorAll("[data-tag-delete]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const encoded = btn.getAttribute("data-tag-delete") || "";
                if (!encoded) return;
                const name = decodeURIComponent(encoded);
                const replacement = await openTagReplaceModal(name, tagRows.map(item => item.name).filter(tag => tag !== name));
                if (replacement === null) return;
                const params = new URLSearchParams({ name });
                if (replacement) {
                    params.set("replacement", replacement);
                }
                try {
                    await apiDelete(`/api/admin/customer-tags?${params.toString()}`);
                    const refreshed = await apiGet("/api/admin/customer-tags");
                    renderTagRows(refreshed || []);
                    actor.send({ type: "REFRESH" });
                } catch (error) {
                    showToast(error.message || t("customerTags.saveError", "Unable to save tag."), "error");
                }
            });
        });
    };

    renderTagRows(tagRows);
    setForm("", nextTagColor(tagRows));

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const original = overlay.querySelector("[name=\"tagOriginal\"]")?.value || "";
            const name = overlay.querySelector("[name=\"tagName\"]")?.value?.trim() || "";
            const color = overlay.querySelector("[name=\"tagColor\"]")?.value?.trim() || "";
            if (!name) {
                showToast(t("customerTags.nameRequired", "Tag name is required."), "error");
                return;
            }

            try {
                if (original) {
                    await apiPut("/api/admin/customer-tags", { name: original, newName: name, color });
                } else {
                    await apiPost("/api/admin/customer-tags", { name, color });
                }
                const refreshed = await apiGet("/api/admin/customer-tags");
                renderTagRows(refreshed || []);
                setForm("", nextTagColor(tagRows));
                showToast(t("customerTags.saveSuccess", "Tag saved."), "success");
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("customerTags.saveError", "Unable to save tag."), "error");
            }
        });
    }
}

function openPlanCategoryModal(categories) {
    const existing = document.getElementById("plan-category-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const rows = (categories || []).map(category => ({
        ...category,
        defaultLabel: category.isDefault ? t("common.yes", "Yes") : t("common.no", "No"),
        activeLabel: category.isActive ? t("common.yes", "Yes") : t("common.no", "No")
    }));

    const modalMarkup = planCategoryModalTemplate({
        categories: rows,
        categoryId: "",
        categoryName: "",
        categoryDefault: false,
        categoryActive: true,
        saveLabel: t("planCategory.add", "Add category")
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-plan-categories");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const planCategorySelect = overlay.querySelector("[name=\"planCategoryId\"]");
    const planOptionsContainer = overlay.querySelector(".plan-options");
    if (planCategorySelect && planOptionsContainer) {
        planCategorySelect.addEventListener("change", () => {
            const selectedIds = new Set(Array.from(overlay.querySelectorAll("input[name=\"sessionPlanIds\"]:checked"))
                .map(input => input.value));
            const categoryId = planCategorySelect.value || "";
            renderPlanOptions(planOptionsContainer, data.plans || [], selectedIds, categoryId, "sessionPlanIds");
        });
    }

    const saveBtn = overlay.querySelector("#save-plan-category");
    const resetBtn = overlay.querySelector("#reset-plan-category");
    const setForm = (category) => {
        overlay.querySelector("[name=\"planCategoryId\"]").value = category?.id || "";
        overlay.querySelector("[name=\"planCategoryName\"]").value = category?.name || "";
        overlay.querySelector("[name=\"planCategoryDefault\"]").value = category?.isDefault ? "true" : "false";
        overlay.querySelector("[name=\"planCategoryActive\"]").value = category?.isActive === false ? "false" : "true";
        if (saveBtn) {
            saveBtn.textContent = category?.id
                ? t("planCategory.update", "Update category")
                : t("planCategory.add", "Add category");
        }
    };

    if (resetBtn) {
        resetBtn.addEventListener("click", () => setForm(null));
    }

    overlay.querySelectorAll("[data-plan-category-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-plan-category-edit");
            const category = rows.find(item => String(item.id) === String(id));
            if (!category) return;
            setForm(category);
        });
    });

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const categoryId = getValue("planCategoryId");
            const name = getValue("planCategoryName").trim();
            const isDefault = getValue("planCategoryDefault") === "true";
            const isActive = getValue("planCategoryActive") === "true";

            if (!name) {
                showToast(t("planCategory.nameRequired", "Category name is required."), "error");
                return;
            }

            const payload = { name, isDefault, isActive };
            try {
                if (categoryId) {
                    await apiPut(`/api/admin/plan-categories/${categoryId}`, payload);
                } else {
                    await apiPost("/api/admin/plan-categories", payload);
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("planCategory.saveError", "Unable to save category."), "error");
            }
        });
    }
}

function openUserModal(userItem) {
    const existing = document.getElementById("user-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(userItem?.id);
    const availableRoles = [
        { value: "Admin", label: t("roles.admin", "Admin") },
        { value: "Staff", label: t("roles.staff", "Staff") },
        { value: "Instructor", label: t("roles.instructor", "Instructor") },
        { value: "Guest", label: t("roles.guest", "Guest") }
    ];
    const selectedRoles = Array.isArray(userItem?.roles) && userItem.roles.length
        ? userItem.roles
        : [userItem?.role || "Admin"];
    const roleOptions = availableRoles.map(option => ({
        ...option,
        checked: selectedRoles.includes(option.value)
    }));
    const rateUnitOptions = [
        { value: "Session", label: t("payroll.unit.session", "Per session") },  
        { value: "Hour", label: t("payroll.unit.hour", "Per hour") },
        { value: "Day", label: t("payroll.unit.day", "Per day") },
        { value: "Week", label: t("payroll.unit.week", "Per week") },
        { value: "Month", label: t("payroll.unit.month", "Per month") }
    ];
    const selectedRateUnit = userItem?.instructorRateUnit || "Session";
    const instructorRate = Number(userItem?.instructorRateCents || 0) / 100;
    const genderValue = (userItem?.gender || "").trim();
    const genderOptions = [
        { value: "", label: t("common.select", "Select"), selected: !genderValue },
        { value: "Male", label: t("gender.male", "Male"), selected: genderValue === "Male" },
        { value: "Female", label: t("gender.female", "Female"), selected: genderValue === "Female" }
    ];
    const attachmentsHtml = userAttachmentsTemplate({
        attachments: [],
        hasAttachments: false
    });
    const modalMarkup = userModalTemplate({
        title: isEdit ? t("user.editTitle", "Edit user") : t("user.addTitle", "Add user"),
        subtitle: t("user.subtitle", "Set access, roles, and instructor profiles."),
        footerNote: t("user.footer", "Invite links can be sent from the list."),
        saveLabel: isEdit ? t("common.saveChanges", "Save changes") : t("user.create", "Create user"),
        userId: userItem?.id || "",
        displayName: userItem?.displayName || "",
        email: userItem?.email || "",
        phone: userItem?.phone || "",
        city: userItem?.city || "",
        address: userItem?.address || "",
        idNumber: userItem?.idNumber || "",
        dateOfBirthValue: userItem?.dateOfBirth ? normalizeDateInputValue(userItem.dateOfBirth) : "",
        genderOptions,
        roleOptions,
        isActive: userItem?.isActive !== false,
        instructorDisplayName: userItem?.instructorName || "",
        instructorBio: userItem?.instructorBio || "",
        instructorRate,
        rateUnitOptions: rateUnitOptions.map(option => ({
            ...option,
            selected: option.value === selectedRateUnit
        })),
        instructorRateCurrency: userItem?.instructorRateCurrency || "ILS",
        attachmentsHtml,
        isEdit
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-user");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const roleCheckboxes = Array.from(overlay.querySelectorAll("input[name=\"roles\"]"));
    const readRoles = () => roleCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
    const syncInstructorFields = () => toggleInstructorFields(readRoles());     
    roleCheckboxes.forEach(cb => cb.addEventListener("change", syncInstructorFields));
    syncInstructorFields();

    const attachmentsList = overlay.querySelector("#user-attachments-list");
    const uploadBtn = overlay.querySelector("#upload-user-attachment");
    const uploadInput = overlay.querySelector("[name=\"userAttachmentFile\"]");
    const dropzone = overlay.querySelector("#user-attachment-dropzone");
    const renderAttachments = (items) => {
        if (!attachmentsList) return;
        const viewModel = (items || []).map(item => ({
            ...item,
            uploadedLabel: formatShortDate(item.uploadedAtUtc),
            downloadUrl: `/api/admin/users/${userItem?.id}/attachments/${item.id}`
        }));
        attachmentsList.innerHTML = userAttachmentsTemplate({
            attachments: viewModel,
            hasAttachments: viewModel.length > 0
        });
    };

    const refreshAttachments = async () => {
        if (!isEdit || !userItem?.id) return;
        try {
            const list = await apiGet(`/api/admin/users/${userItem.id}/attachments`);
            renderAttachments(list || []);
        } catch {
            renderAttachments([]);
        }
    };

    if (isEdit && userItem?.id) {
        refreshAttachments();
    }

    const uploadAttachment = async () => {
        if (!uploadInput || !userItem?.id) return;
        const file = uploadInput.files?.[0];
        if (!file) return;
        try {
            await uploadUserAttachment(userItem.id, file);
            uploadInput.value = "";
            await refreshAttachments();
        } catch (error) {
            showToast(error.message || t("user.uploadError", "Unable to upload attachment."), "error");
        }
    };

    const setDragActive = (active) => {
        if (!dropzone) return;
        dropzone.classList.toggle("drag-over", active);
    };

    if (uploadBtn) {
        uploadBtn.addEventListener("click", uploadAttachment);
    }
    if (uploadInput) {
        uploadInput.addEventListener("change", uploadAttachment);
    }
    if (dropzone && uploadInput) {
        dropzone.addEventListener("dragover", (event) => {
            event.preventDefault();
            setDragActive(true);
        });
        dropzone.addEventListener("dragleave", () => setDragActive(false));
        dropzone.addEventListener("drop", (event) => {
            event.preventDefault();
            setDragActive(false);
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return;
            uploadInput.files = files;
            uploadAttachment();
        });
    }

    if (attachmentsList && userItem?.id) {
        attachmentsList.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-user-attachment-delete]");
            if (!button) return;
            const attachmentId = button.getAttribute("data-user-attachment-delete");
            if (!attachmentId) return;
            try {
                await apiDelete(`/api/admin/users/${userItem.id}/attachments/${attachmentId}`);
                await refreshAttachments();
            } catch (error) {
                showToast(error.message || t("user.attachmentDeleteError", "Unable to delete attachment."), "error");
            }
        });
    }

    const resetPasswordBtn = overlay.querySelector("#reset-user-password");
    if (resetPasswordBtn && isEdit && userItem?.id) {
        resetPasswordBtn.addEventListener("click", async () => {
            const confirmed = await confirmWithModal({
                title: t("user.resetPasswordTitle", "Reset user password"),
                message: t("user.resetPasswordConfirm", "Generate a new temporary password for this user?"),
                confirmLabel: t("common.yes", "Yes"),
                cancelLabel: t("common.no", "No")
            });
            if (!confirmed) return;
            resetPasswordBtn.disabled = true;
            try {
                const result = await apiPost(`/api/admin/users/${userItem.id}/invite`, { sendEmail: false });
                const tempPassword = result?.tempPassword || "";
                if (tempPassword) {
                    try {
                        await navigator.clipboard.writeText(tempPassword);
                        showToast(t("user.resetPasswordCopied", "Temporary password copied."), "success");
                    } catch {
                        showToast(`${t("user.resetPasswordTemp", "Temporary password")}: ${tempPassword}`, "success");
                    }
                    openDescriptionModal(t("user.resetPasswordTitle", "Temporary password"), tempPassword);
                } else {
                    showToast(t("user.resetPasswordSuccess", "Password reset."), "success");
                }
            } catch (error) {
                showToast(error.message || t("user.resetPasswordError", "Unable to reset password."), "error");
            } finally {
                resetPasswordBtn.disabled = false;
            }
        });
    }

    const saveBtn = overlay.querySelector("#save-user");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const displayName = getValue("displayName").trim();
            const email = getValue("email").trim();
            const phone = getValue("phone").trim();
            const city = getValue("city").trim();
            const address = getValue("address").trim();
            const gender = getValue("gender");
            const idNumber = getValue("idNumber").trim();
            const dateOfBirth = normalizeDateInputValue(getValue("dateOfBirth")) || null;
            const roles = readRoles();
            const isActive = getValue("isActive") !== "false";
            const instructorDisplayName = getValue("instructorDisplayName");    
            const instructorBio = getValue("instructorBio");
            const instructorRate = Number(getValue("instructorRate") || 0);
            const instructorRateUnit = getValue("instructorRateUnit") || "Session";
            const instructorRateCurrency = getValue("instructorRateCurrency").trim();
            const instructorRateCents = Number.isFinite(instructorRate) ? Math.round(instructorRate * 100) : 0;

            if (!displayName || !email) {
                showToast(t("user.required", "Display name and email are required."), "error");
                return;
            }
            if (!roles.length) {
                showToast(t("user.roleRequired", "Select at least one role."), "error");
                return;
            }

            const primaryRoleOrder = ["Admin", "Staff", "Instructor", "Guest", "Customer"];
            const primaryRole = primaryRoleOrder.find(role => roles.includes(role)) || roles[0];

            const payload = {
                displayName,
                email,
                phone,
                city,
                address,
                gender,
                idNumber,
                dateOfBirth,
                role: primaryRole,
                roles,
                isActive,
                instructorDisplayName: instructorDisplayName || null,
                instructorBio: instructorBio || null,
                instructorRateCents,
                instructorRateUnit,
                instructorRateCurrency: instructorRateCurrency || "ILS"
            };

            try {
                if (isEdit && userItem?.id) {
                    await apiPut(`/api/admin/users/${userItem.id}`, payload);
                } else {
                    await apiPost("/api/admin/users", payload);
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("user.saveError", "Unable to save user."), "error");
            }
        });
    }
}

function openGuestModal() {
    const existing = document.getElementById("guest-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const modalMarkup = guestModalTemplate({
        guestDisplayName: "",
        guestEmail: ""
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-guest");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-guest");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const displayName = getValue("guestDisplayName").trim();
            const email = getValue("guestEmail").trim();

            if (!displayName || !email) {
                showToast(t("guest.required", "Guest name and email are required."), "error");
                return;
            }

            try {
                await apiPost("/api/admin/users", {
                    displayName,
                    email,
                    role: "Guest",
                    password: null,
                    instructorDisplayName: null,
                    instructorBio: null
                });
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("guest.saveError", "Unable to create guest."), "error");
            }
        });
    }
}

function openRoomModal(room) {
    const existing = document.getElementById("room-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(room?.id);
    const modalMarkup = roomModalTemplate({
        title: isEdit ? t("room.editTitle", "Edit room") : t("room.addTitle", "Add room"),
        subtitle: isEdit ? t("room.editSubtitle", "Update room details.") : t("room.addSubtitle", "Create a new room."),
        saveLabel: isEdit ? t("common.saveChanges", "Save changes") : t("room.create", "Create room"),
        roomId: room?.id || "",
        roomName: room?.name || "",
        supportsRemote: room?.supportsRemote ?? false,
        roomRemoteLink: room?.remoteLink || ""
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-room");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const supportsSelect = overlay.querySelector("[name=\"roomSupportsRemote\"]");
    const remoteFields = overlay.querySelector(".room-remote-fields");
    const updateRemoteFields = () => {
        const enabled = supportsSelect?.value === "true";
        if (remoteFields) {
            remoteFields.style.display = enabled ? "" : "none";
        }
    };
    if (supportsSelect) {
        supportsSelect.addEventListener("change", updateRemoteFields);
    }
    updateRemoteFields();

    const saveBtn = overlay.querySelector("#save-room");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const name = overlay.querySelector("[name=\"roomName\"]")?.value.trim() || "";
            const supportsRemote = overlay.querySelector("[name=\"roomSupportsRemote\"]")?.value === "true";
            const remoteLink = overlay.querySelector("[name=\"roomRemoteLink\"]")?.value.trim() || "";
            if (!name) {
                showToast(t("room.nameRequired", "Room name is required."), "error");
                return;
            }
            try {
                if (isEdit && room?.id) {
                    await apiPut(`/api/admin/rooms/${room.id}`, { name, supportsRemote, remoteLink });
                } else {
                    await apiPost("/api/admin/rooms", { name, supportsRemote, remoteLink });
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("room.saveError", "Unable to save room."), "error");
            }
        });
    }
}

function openPlanModal(plan, planCategories = []) {
    const existing = document.getElementById("plan-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(plan?.id);
    const categoryIds = parsePlanCategoryIds(plan);
    const selectedCategoryIds = new Set(categoryIds.map(id => String(id)));
    if (!isEdit && selectedCategoryIds.size === 0) {
        const defaultCategory = (planCategories || []).find(category => category.isDefault && category.isActive);
        if (defaultCategory) {
            selectedCategoryIds.add(String(defaultCategory.id));
        }
    }
    const categoryOptions = (planCategories || [])
        .filter(category => category.isActive !== false || selectedCategoryIds.has(String(category.id)))
        .map(category => ({
            id: category.id,
            name: category.name,
            selected: selectedCategoryIds.has(String(category.id))
        }));
    const typeOptions = [
        {
            value: "WeeklyLimit",
            label: t("plans.type.weekly", "Weekly limit"),
            selected: plan?.type === "WeeklyLimit" || !plan?.type
        },
        {
            value: "PunchCard",
            label: t("plans.type.punch", "Punch card"),
            selected: plan?.type === "PunchCard"
        },
        {
            value: "Unlimited",
            label: t("plans.type.unlimited", "Unlimited"),
            selected: plan?.type === "Unlimited"
        }
    ];
    const activeOptions = [
        { value: "true", label: t("common.yes", "Yes"), selected: plan?.active ?? true },
        { value: "false", label: t("common.no", "No"), selected: plan?.active === false }
    ];
    const modalMarkup = planModalTemplate({
        title: isEdit ? t("plans.editTitle", "Edit plan") : t("plans.addTitle", "New plan"),
        subtitle: isEdit ? t("plans.editSubtitle", "Update pricing and limits.") : t("plans.addSubtitle", "Create a new membership plan."),
        saveLabel: isEdit ? t("common.saveChanges", "Save changes") : t("plans.create", "Create plan"),
        planId: plan?.id || "",
        name: plan?.name || "",
        typeOptions,
        weeklyLimit: plan?.weeklyLimit ?? 2,
        punchCardUses: plan?.punchCardUses ?? 0,
        price: toCurrencyUnits(plan?.priceCents ?? 12000),
        remoteOnly: plan?.remoteOnly ?? false,
        validityDays: plan?.validityDays ?? "",
        dailyLimit: plan?.dailyLimit ?? "",
        activeOptions,
        categories: categoryOptions
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-plan");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const typeSelect = overlay.querySelector("[name=\"planType\"]");
    const weeklyField = overlay.querySelector(".plan-field-weekly");
    const punchField = overlay.querySelector(".plan-field-punch");
    const updatePlanFields = () => {
        const type = typeSelect?.value || "WeeklyLimit";
        if (weeklyField) {
            weeklyField.classList.toggle("hidden", type !== "WeeklyLimit");
        }
        if (punchField) {
            punchField.classList.toggle("hidden", type !== "PunchCard");
        }
    };
    if (typeSelect) {
        typeSelect.addEventListener("change", updatePlanFields);
    }
    updatePlanFields();

    const saveBtn = overlay.querySelector("#save-plan");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const name = getValue("planName").trim();
            const type = getValue("planType");
            const weeklyLimit = Number(getValue("weeklyLimit"));
            const punchCardUses = Number(getValue("punchCardUses"));
            const price = Number(getValue("price"));
            const active = getValue("planActive") === "true";
            const remoteOnly = getValue("planRemoteOnly") === "true";
            const validityDays = Number(getValue("planValidityDays"));
            const dailyLimit = Number(getValue("planDailyLimit"));
            const normalizedWeeklyLimit = type === "WeeklyLimit" && Number.isFinite(weeklyLimit) ? weeklyLimit : 0;
            const normalizedPunchUses = type === "PunchCard" && Number.isFinite(punchCardUses) ? punchCardUses : 0;

            if (!name) {
                showToast(t("plans.nameRequired", "Plan name is required."), "error");
                return;
            }

            const selectedCategoryIds = Array.from(overlay.querySelectorAll("input[name=\"planCategoryIds\"]:checked"))
                .map(input => input.value)
                .filter(Boolean);

            const payload = {
                name,
                type,
                weeklyLimit: normalizedWeeklyLimit,
                punchCardUses: normalizedPunchUses,
                priceCents: toCents(Number.isFinite(price) ? price : 0),
                currency: "ILS",
                remoteOnly,
                validityDays: Number.isFinite(validityDays) && validityDays > 0 ? validityDays : null,
                dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : null,
                categoryIdsJson: JSON.stringify(selectedCategoryIds),
                active
            };

            try {
                if (isEdit && plan?.id) {
                    await apiPut(`/api/admin/plans/${plan.id}`, payload);
                } else {
                    await apiPost("/api/admin/plans", payload);
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("plans.saveError", "Unable to save plan."), "error");
            }
        });
    }
}

function openBillingItemModal(item) {
    const existing = document.getElementById("billing-item-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(item?.id);
    const typeOptions = [
        { value: "Membership", label: formatBillingItemType("Membership"), selected: item?.type === "Membership" },
        { value: "ClassPass", label: formatBillingItemType("ClassPass"), selected: item?.type === "ClassPass" },
        { value: "DropIn", label: formatBillingItemType("DropIn"), selected: item?.type === "DropIn" },
        { value: "Workshop", label: formatBillingItemType("Workshop"), selected: item?.type === "Workshop" },
        { value: "Retail", label: formatBillingItemType("Retail"), selected: item?.type === "Retail" },
        { value: "Fee", label: formatBillingItemType("Fee"), selected: item?.type === "Fee" },
        { value: "Custom", label: formatBillingItemType("Custom"), selected: !item?.type || item?.type === "Custom" }
    ];
    const activeOptions = [
        { value: "true", label: t("common.yes", "Yes"), selected: item?.active ?? true },
        { value: "false", label: t("common.no", "No"), selected: item?.active === false }
    ];
    const modalMarkup = billingItemModalTemplate({
        title: isEdit ? t("billing.itemEditTitle", "Edit item") : t("billing.itemAddTitle", "New item"),
        subtitle: isEdit ? t("billing.itemEditSubtitle", "Update catalog details.") : t("billing.itemAddSubtitle", "Create a billable catalog item."),
        saveLabel: isEdit ? t("common.saveChanges", "Save changes") : t("billing.newItem", "New item"),
        id: item?.id || "",
        name: item?.name || "",
        price: toCurrencyUnits(item?.defaultPriceCents ?? 0),
        typeOptions,
        activeOptions
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-billing-item");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-billing-item");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const name = overlay.querySelector("[name=\"billingItemName\"]")?.value.trim() || "";
            const type = overlay.querySelector("[name=\"billingItemType\"]")?.value || "Custom";
            const priceValue = Number(overlay.querySelector("[name=\"billingItemPrice\"]")?.value || 0);
            const active = overlay.querySelector("[name=\"billingItemActive\"]")?.value === "true";
            if (!name) {
                showToast(t("billing.nameRequired", "Name is required."), "error");
                return;
            }
            const payload = {
                name,
                type,
                defaultPriceCents: toCents(priceValue),
                currency: "ILS",
                active
            };
            try {
                if (isEdit && item?.id) {
                    await apiPut(`/api/admin/billing/items/${item.id}`, payload);
                } else {
                    await apiPost("/api/admin/billing/items", payload);
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("billing.saveError", "Unable to save billing item."), "error");
            }
        });
    }
}

function openBillingSubscriptionModal(data) {
    const existing = document.getElementById("billing-subscription-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const customers = (data.customers || []).map(customer => ({
        id: customer.id,
        name: customer.fullName || customer.email || customer.phone || "-"
    }));
    if (!customers.length) {
        showToast(t("billing.noCustomers", "Add a customer first."), "error");
        return;
    }

    let items = (data.items || []).filter(item => String(item.type) === "Membership");
    if (!items.length) {
        items = data.items || [];
    }
    const itemOptions = items.map(item => ({
        id: item.id,
        name: item.name
    }));
    if (!itemOptions.length) {
        showToast(t("billing.noItems", "Add a billable item first."), "error");
        return;
    }

    const intervalOptions = [
        { value: "Monthly", label: formatBillingInterval("Monthly"), selected: true },
        { value: "Weekly", label: formatBillingInterval("Weekly"), selected: false }
    ];
    const startValue = normalizeDateInputValue(new Date());
    const modalMarkup = billingSubscriptionModalTemplate({
        title: t("billing.subscriptionAddTitle", "New subscription"),
        subtitle: t("billing.subscriptionAddSubtitle", "Set up recurring billing."),
        saveLabel: t("billing.newSubscription", "New subscription"),
        customerOptions: customers,
        itemOptions,
        intervalOptions,
        startValue,
        anchorDay: "",
        price: ""
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-billing-subscription");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-billing-subscription");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const customerId = overlay.querySelector("[name=\"billingSubscriptionCustomer\"]")?.value || "";
            const billableItemId = overlay.querySelector("[name=\"billingSubscriptionItem\"]")?.value || "";
            const startDate = overlay.querySelector("[name=\"billingSubscriptionStart\"]")?.value || "";
            const interval = overlay.querySelector("[name=\"billingSubscriptionInterval\"]")?.value || "Monthly";
            const anchorDayValue = overlay.querySelector("[name=\"billingSubscriptionAnchor\"]")?.value || "";
            const priceValue = overlay.querySelector("[name=\"billingSubscriptionPrice\"]")?.value || "";
            if (!customerId || !billableItemId || !startDate) {
                showToast(t("billing.subscriptionRequired", "Customer, plan, and start date are required."), "error");
                return;
            }
            const anchorDay = Number(anchorDayValue);
            const priceOverride = Number(priceValue);
            const payload = {
                customerId,
                billableItemId,
                startDate,
                billingInterval: interval,
                billingAnchorDay: Number.isFinite(anchorDay) ? anchorDay : 0,
                priceOverrideCents: Number.isFinite(priceOverride) && priceOverride > 0 ? toCents(priceOverride) : null
            };
            try {
                await apiPost("/api/admin/billing/subscriptions", payload);
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("billing.saveError", "Unable to save subscription."), "error");
            }
        });
    }
}

function openBillingChargeModal(data) {
    const existing = document.getElementById("billing-charge-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const customers = (data.customers || []).map(customer => ({
        id: customer.id,
        name: customer.fullName || customer.email || customer.phone || "-"
    }));
    if (!customers.length) {
        showToast(t("billing.noCustomers", "Add a customer first."), "error");
        return;
    }
    const sourceOptions = [
        { value: "manual", label: formatBillingSource("manual"), selected: true },
        { value: "fee", label: formatBillingSource("fee"), selected: false },
        { value: "session_registration", label: formatBillingSource("session_registration"), selected: false },
        { value: "workshop_registration", label: formatBillingSource("workshop_registration"), selected: false }
    ];
    const modalMarkup = billingChargeModalTemplate({
        title: t("billing.chargeAddTitle", "New charge"),
        subtitle: t("billing.chargeAddSubtitle", "Record a manual charge."),
        saveLabel: t("billing.newCharge", "New charge"),
        customerOptions: customers,
        sourceOptions,
        amount: "",
        description: "",
        dateValue: normalizeDateInputValue(new Date())
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-billing-charge");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-billing-charge");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const customerId = overlay.querySelector("[name=\"billingChargeCustomer\"]")?.value || "";
            const description = overlay.querySelector("[name=\"billingChargeDescription\"]")?.value.trim() || "";
            const amountValue = Number(overlay.querySelector("[name=\"billingChargeAmount\"]")?.value || 0);
            const chargeDate = overlay.querySelector("[name=\"billingChargeDate\"]")?.value || "";
            const sourceType = overlay.querySelector("[name=\"billingChargeSource\"]")?.value || "manual";
            if (!customerId || !description || !chargeDate || !Number.isFinite(amountValue) || amountValue === 0) {
                showToast(t("billing.chargeRequired", "Customer, description, date, and amount are required."), "error");
                return;
            }
            const payload = {
                customerId,
                description,
                amountCents: toCents(amountValue),
                chargeDate,
                sourceType
            };
            try {
                await apiPost("/api/admin/billing/charges", payload);
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("billing.saveError", "Unable to save charge."), "error");
            }
        });
    }
}

function openBillingAdjustModal(chargeId) {
    const existing = document.getElementById("billing-adjust-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const modalMarkup = billingAdjustModalTemplate({
        title: t("billing.adjustTitle", "Adjust charge"),
        subtitle: t("billing.adjustSubtitle", "Create a credit adjustment."),
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-billing-adjust");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-billing-adjust");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const amountValue = Number(overlay.querySelector("[name=\"billingAdjustAmount\"]")?.value || 0);
            const reason = overlay.querySelector("[name=\"billingAdjustReason\"]")?.value.trim() || "";
            if (!Number.isFinite(amountValue) || amountValue === 0) {
                showToast(t("billing.adjustAmountRequired", "Enter an adjustment amount."), "error");
                return;
            }
            try {
                await apiPost(`/api/admin/billing/charges/${chargeId}/adjust`, {
                    amountCents: toCents(amountValue),
                    reason
                });
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("billing.adjustError", "Unable to adjust charge."), "error");
            }
        });
    }
}

function openBillingVoidModal(chargeId) {
    const existing = document.getElementById("billing-void-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const modalMarkup = billingVoidModalTemplate({
        title: t("billing.voidTitle", "Cancel this Item"),
        subtitle: t("billing.voidSubtitle", "Provide a reason for the cancellation."),
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);

    const closeBtn = overlay.querySelector("#close-billing-void");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-billing-void");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const reason = overlay.querySelector("[name=\"billingVoidReason\"]")?.value.trim() || "";
            if (!reason) {
                showToast(t("billing.reasonRequired", "Reason is required."), "error");
                return;
            }
            try {
                await apiPost(`/api/admin/billing/charges/${chargeId}/void`, { reason });
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("billing.voidError", "Unable to void charge."), "error");
            }
        });
    }
}

function openSeriesModal(series, data) {
    const existing = document.getElementById("series-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(series?.id);
    const dayNames = getWeekdayNames(0);
    const selectedDays = resolveSeriesDays(series);
    const safeDays = selectedDays.length ? selectedDays : [2];
    const dayOptions = [
        { value: 0, label: dayNames[0] || t("weekday.sunday", "Sunday"), selected: safeDays.includes(0) },
        { value: 1, label: dayNames[1] || t("weekday.monday", "Monday"), selected: safeDays.includes(1) },
        { value: 2, label: dayNames[2] || t("weekday.tuesday", "Tuesday"), selected: safeDays.includes(2) },
        { value: 3, label: dayNames[3] || t("weekday.wednesday", "Wednesday"), selected: safeDays.includes(3) },
        { value: 4, label: dayNames[4] || t("weekday.thursday", "Thursday"), selected: safeDays.includes(4) },
        { value: 5, label: dayNames[5] || t("weekday.friday", "Friday"), selected: safeDays.includes(5) },
        { value: 6, label: dayNames[6] || t("weekday.saturday", "Saturday"), selected: safeDays.includes(6) }
    ];
    const rooms = [
        { id: "", name: t("common.unassigned", "Unassigned"), selected: !series?.roomId },
        ...(data.rooms || []).map(room => ({
            id: room.id,
            name: room.name,
            selected: room.id === series?.roomId
        }))
    ];
    const instructors = [
        { id: "", displayName: t("common.unassigned", "Unassigned"), selected: !series?.instructorId },
        ...(data.instructors || []).map(instructor => ({
            id: instructor.id,
            displayName: instructor.displayName,
            selected: instructor.id === series?.instructorId
        }))
    ];
    const allowedPlanIds = parseGuidListJson(series?.allowedPlanIdsJson).map(id => String(id));
    const allowedSet = new Set(allowedPlanIds);
    const defaultPlanCategoryId = (data.planCategories || []).find(category => category.isDefault && category.isActive)?.id || "";
    const selectedPlanCategoryId = series?.planCategoryId || defaultPlanCategoryId || "";
    const planCategories = buildPlanCategoryOptions(data.planCategories || [], selectedPlanCategoryId);
    const plans = filterPlansByCategory(data.plans || [], selectedPlanCategoryId).map(plan => ({
        ...plan,
        price: formatPlainPrice(plan.priceCents),
        selected: allowedSet.has(String(plan.id))
    }));
    const titleSuggestions = buildTitleSuggestions(data);
    const titleSuggestionId = createTitleSuggestionId("series-title");
    const generateUntilDate = series?.generateUntil ? new Date(series.generateUntil) : null;
    const generateUntilValue = generateUntilDate && generateUntilDate.getFullYear() > 1900
        ? normalizeDateInputValue(generateUntilDate)
        : normalizeDateInputValue(addDays(new Date(), 365));
    const modalMarkup = seriesModalTemplate({
        modalTitle: isEdit ? t("series.editTitle", "Edit series") : t("series.newTitle", "New series"),
        subtitle: isEdit
            ? t("series.editSubtitle", "Update weekly schedule settings.")
            : t("series.newSubtitle", "Create a weekly series."),
        seriesId: series?.id || "",
        titleValue: series?.title || "Studio Flow",
        icon: series?.icon || "",
        color: ensureHexColor(series?.color || "#f1c232", "#f1c232"),
        titleSuggestions,
        titleSuggestionId,
        dayOptions,
        startTimeLocal: (series?.startTimeLocal || "18:00").slice(0, 5),
        durationMinutes: series?.durationMinutes ?? 60,
        defaultCapacity: series?.defaultCapacity ?? 14,
        remoteCapacity: series?.remoteCapacity ?? 0,
        price: toCurrencyUnits(series?.priceCents ?? 2500),
        remoteInviteUrl: series?.remoteInviteUrl || "",
        description: series?.description || "",
        recurrenceIntervalWeeks: series?.recurrenceIntervalWeeks ?? 1,
        generateUntilValue,
        cancellationWindowHours: series?.cancellationWindowHours ?? 6,
        isActive: series?.isActive ?? true,
        rooms,
        instructors,
        planCategories,
        plans,
        saveLabel: isEdit ? t("common.saveChanges", "Save changes") : t("series.create", "Create series")
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalMarkup;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;

    document.body.appendChild(overlay);

    let cleanupEscape = () => {};
    const closeModal = () => {
        cleanupEscape();
        overlay.remove();
    };
    cleanupEscape = bindModalEscape(closeModal);
    bindModalBackdrop(overlay);
    overlay.querySelectorAll(".color-field").forEach(field => bindColorField(field));
    bindIconPicker(overlay);
    bindIconPreview(overlay);
    bindRoomRemoteDefaults(overlay, data.rooms || [], series?.remoteInviteUrl || "");

    const closeBtn = overlay.querySelector("#close-series");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const planCategorySelect = overlay.querySelector("[name=\"planCategoryId\"]");
    const planOptionsContainer = overlay.querySelector(".plan-options");
    if (planCategorySelect && planOptionsContainer) {
        planCategorySelect.addEventListener("change", () => {
            const selectedIds = new Set(Array.from(overlay.querySelectorAll("input[name=\"planIds\"]:checked"))
                .map(input => input.value));
            const categoryId = planCategorySelect.value || "";
            renderPlanOptions(planOptionsContainer, data.plans || [], selectedIds, categoryId, "planIds");
        });
    }


    const saveBtn = overlay.querySelector("#save-series");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value ?? "";
            const startTimeValue = normalizeTimeInputValue(getValue("startTimeLocal"));
            const startTimeLocal = startTimeValue ? `${startTimeValue}:00` : "";
            const selectedDays = Array.from(overlay.querySelectorAll("input[name=\"seriesDays\"]:checked"))
                .map(input => Number(input.value))
                .filter(value => Number.isFinite(value));
            if (!selectedDays.length) {
                showToast(t("series.daysRequired", "Select at least one day of week."), "error");
                return;
            }
            if (!startTimeLocal) {
                showToast(t("session.requiredFields", "Title, time, and duration are required."), "error");
                return;
            }
            const allowedPlanIds = Array.from(overlay.querySelectorAll("input[name=\"planIds\"]:checked"))
                .map(input => input.value)
                .filter(Boolean);
            const payload = {
                title: getValue("title"),
                icon: getValue("icon"),
                color: getValue("color") || "#f1c232",
                description: getValue("description") || "",
                instructorId: getValue("instructorId") || null,
                roomId: getValue("roomId") || null,
                planCategoryId: getValue("planCategoryId") || null,
                dayOfWeek: selectedDays[0],
                daysOfWeekJson: JSON.stringify(selectedDays),
                startTimeLocal,
                durationMinutes: Number(getValue("durationMinutes")),
                recurrenceIntervalWeeks: series?.recurrenceIntervalWeeks ?? 1,
                generateUntil: normalizeDateInputValue(getValue("generateUntil")) || null,
                defaultCapacity: Number(getValue("capacity") || 0),
                remoteCapacity: Number(getValue("remoteCapacity") || 0),
                priceCents: toCents(Number(getValue("price") || 0)),
                currency: "ILS",
                remoteInviteUrl: getValue("remoteInviteUrl") || "",
                allowedPlanIdsJson: JSON.stringify(allowedPlanIds),
                cancellationWindowHours: Number(getValue("cancellationWindowHours") || 0),
                isActive: getValue("isActive") === "true"
            };
            try {
                if (isEdit && series?.id) {
                    await apiPut(`/api/admin/event-series/${series.id}`, payload);
                } else {
                    await apiPost("/api/admin/event-series", payload);
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("series.saveError", "Unable to save series."), "error");
            }
        });
    }
}

function getCalendarRange(view, focusDate, weekStartsOn) {
    const focus = parseDateInput(focusDate);
    const safeWeekStart = Number.isFinite(Number(weekStartsOn)) ? Number(weekStartsOn) : 0;

    if (view === "day") {
        const nextDay = addDays(focus, 1);
        return { from: formatDateKeyLocal(focus), to: formatDateKeyLocal(nextDay) };
    }

    if (view === "list") {
        const monthStart = startOfMonth(focus);
        const nextYear = addYears(monthStart, 1);
        return { from: formatDateKeyLocal(monthStart), to: formatDateKeyLocal(nextYear) };
    }

    if (view === "month") {
        const firstOfMonth = new Date(focus.getFullYear(), focus.getMonth(), 1, 12);
        const gridStart = startOfWeek(firstOfMonth, safeWeekStart);
        const gridEnd = addDays(gridStart, 42);
        return { from: formatDateKeyLocal(gridStart), to: formatDateKeyLocal(gridEnd) };
    }

    const start = startOfWeek(focus, safeWeekStart);
    const end = addDays(start, 7);
    return { from: formatDateKeyLocal(start), to: formatDateKeyLocal(end) };
}

function buildCalendarView(items, options) {
    const view = options.view || "week";
    const focusDate = options.focusDate || toDateInputValue(new Date());
    const timeZone = options.timeZone || "UTC";
    const weekStartsOn = Number.isFinite(Number(options.weekStartsOn))
        ? Number(options.weekStartsOn)
        : 0;
    const customers = options.customers || [];
    const searchTerm = (options.search || "").trim().toLowerCase();
    const eventMap = buildEventMap(items, timeZone);
    const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
    const matchesSearch = (event) => {
        if (!searchTerm) return true;
        const haystack = [
            event.seriesTitle,
            event.instructorName,
            event.roomName
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchTerm);
    };
    const filterEvents = (events) => searchTerm ? events.filter(matchesSearch) : events;

    const dayDate = parseDateInput(focusDate);
    const dayKey = formatDateKeyLocal(dayDate);
    const dayEvents = filterEvents(eventMap.get(dayKey) || []);
    const day = {
        dateKey: dayKey,
        label: formatFullDate(dayDate, timeZone),
        events: dayEvents,
        hasEvents: dayEvents.length > 0
    };

    const weekStart = startOfWeek(parseDateInput(focusDate), weekStartsOn);
    const weekdayNames = getWeekdayNames(weekStartsOn);
    const weekDays = [];
    for (let i = 0; i < 7; i += 1) {
        const date = addDays(weekStart, i);
        const key = formatDateKeyLocal(date);
        const events = filterEvents(eventMap.get(key) || []);
        weekDays.push({
            dateKey: key,
            weekday: weekdayNames[i],
            dateLabel: formatMonthDay(date, timeZone),
            events,
            hasEvents: events.length > 0,
            isToday: key === todayKey
        });
    }

    const focus = parseDateInput(focusDate);
    const firstOfMonth = new Date(focus.getFullYear(), focus.getMonth(), 1, 12);
    const gridStart = startOfWeek(firstOfMonth, weekStartsOn);
    const monthWeeks = [];
    for (let w = 0; w < 6; w += 1) {
        const days = [];
        for (let d = 0; d < 7; d += 1) {
            const date = addDays(gridStart, w * 7 + d);
            const key = formatDateKeyLocal(date);
            const events = filterEvents(eventMap.get(key) || []);
            const previews = events.slice(0, 3).map(event => ({
                id: event.id,
                time: event.startTime,
                title: event.seriesTitle,
                isCancelled: event.isCancelled,
                isPast: event.isPast,
                isBirthday: event.isBirthday,
                hasBirthdayList: event.hasBirthdayList,
                birthdayNamesJson: event.birthdayNamesJson,
                birthdayDateLabel: event.birthdayDateLabel,
                isLocked: event.isLocked,
                seriesIcon: event.seriesIcon,
                eventStyle: event.eventStyle
            }));
            days.push({
                label: date.getDate(),
                dateKey: key,
                isCurrentMonth: date.getMonth() === focus.getMonth(),
                isToday: key === todayKey,
                eventsPreview: previews,
                moreCount: Math.max(0, events.length - previews.length),
                hasEvents: events.length > 0
            });
        }
        monthWeeks.push({ days });
    }

    const rangeLabel = getRangeLabel(view, focusDate, weekStartsOn, timeZone);
    const listItems = [];
    eventMap.forEach(list => {
        list.forEach(event => {
            const dateLabel = formatShortDate(event.startUtc);
            const booked = Number(event.booked || 0);
            const capacity = Number(event.capacity || 0);
            const remoteBooked = Number(event.remoteBooked || 0);
            const remoteCapacity = Number(event.remoteCapacity || 0);
            const bookedSummary = event.isHoliday || event.isBirthday
                ? t("calendar.list.na", "-")
                : `${booked} / ${capacity}`;
            const remoteSummary = event.isHoliday || event.isBirthday
                ? t("calendar.list.na", "-")
                : (remoteCapacity > 0 ? `${remoteBooked} / ${remoteCapacity}` : t("calendar.list.na", "-"));
            const searchText = [
                event.seriesTitle,
                event.instructorName,
                event.roomName
            ].filter(Boolean).join(" ").toLowerCase();
            listItems.push({
                ...event,
                dateLabel,
                bookedSummary,
                remoteSummary,
                searchText
            });
        });
    });
    listItems.sort((a, b) => new Date(a.startUtc) - new Date(b.startUtc));
    const filteredItems = searchTerm
        ? listItems.filter(item => item.searchText.includes(searchTerm))
        : listItems;

    const allEvents = [];
    eventMap.forEach(list => {
        list.forEach(event => {
            if (!searchTerm || matchesSearch(event)) {
                allEvents.push(event);
            }
        });
    });
    const sessionEvents = allEvents.filter(event => !event.isHoliday && !event.isBirthday && !event.isCancelled);
    const weekRange = getCalendarRange("week", focusDate, weekStartsOn);
    const weekSessions = sessionEvents.filter(event => {
        const eventKey = getDateKeyInTimeZone(new Date(event.startUtc), timeZone);
        return eventKey >= weekRange.from && eventKey < weekRange.to;
    });
    const weekRegistrations = weekSessions.reduce((sum, event) => sum + Number(event.booked || 0) + Number(event.remoteBooked || 0), 0);
    const newRegistrations = (customers || []).filter(customer => {
        if (!customer.createdAtUtc) return false;
        const createdKey = formatDateKeyLocal(new Date(customer.createdAtUtc));
        return createdKey >= weekRange.from && createdKey < weekRange.to;
    }).length;
    let strongestSession = "-";
    if (weekSessions.length) {
        const best = weekSessions.reduce((top, event) => {
            const count = Number(event.booked || 0) + Number(event.remoteBooked || 0);
            if (!top || count > top.count) {
                return { title: event.seriesTitle || t("session.sessionFallback", "Session"), count };
            }
            return top;
        }, null);
        if (best) {
            strongestSession = `${best.title} (${best.count})`;
        }
    }
    const weekNumberLabel = view === "week"
        ? `${t("calendar.weekNumber", "Week")} ${String(getWeekNumber(weekStart)).padStart(2, "0")}`
        : "";
    const hebrewDateLabel = formatHebrewDate(focus);
    const hourTicks = Array.from({ length: 16 }, (_, index) => {
        const hour = String(7 + index).padStart(2, "0");
        return `${hour}:00`;
    });

    return {
        view,
        focusDate,
        rangeLabel,
        weekNumberLabel,
        hebrewDateLabel,
        hourTicks,
        hourCount: hourTicks.length,
        isDay: view === "day",
        isWeek: view === "week",
        isMonth: view === "month",
        isList: view === "list",
        search: options.search || "",
        day,
        week: { days: weekDays },
        month: { weeks: monthWeeks, weekdays: weekdayNames },
        list: { items: filteredItems, hasItems: filteredItems.length > 0 },
        stats: {
            weekSessions: weekSessions.length.toString(),
            registrations: weekRegistrations.toString(),
            newRegistrations: newRegistrations.toString(),
            strongestSession
        }
    };
}

function normalizeStatus(value) {
    if (typeof value === "string") {
        if (value === "Cancelled") return t("status.cancelled", "Cancelled");
        if (value === "Scheduled") return t("status.scheduled", "Scheduled");
        return value;
    }
    return value === 1
        ? t("status.cancelled", "Cancelled")
        : t("status.scheduled", "Scheduled");
}

function formatPlanType(value) {
    if (value === "WeeklyLimit") return t("plans.type.weekly", "Weekly limit");
    if (value === "PunchCard") return t("plans.type.punch", "Punch card");
    if (value === "Unlimited") return t("plans.type.unlimited", "Unlimited");
    return value || "-";
}

function formatBillingItemType(value) {
    if (value === "Membership") return t("billing.itemType.membership", "Membership");
    if (value === "ClassPass") return t("billing.itemType.classPass", "Class pass");
    if (value === "DropIn") return t("billing.itemType.dropIn", "Drop-in");
    if (value === "Workshop") return t("billing.itemType.workshop", "Workshop");
    if (value === "Retail") return t("billing.itemType.retail", "Retail");
    if (value === "Fee") return t("billing.itemType.fee", "Fee");
    if (value === "Custom") return t("billing.itemType.custom", "Custom");
    return value || "-";
}

function formatBillingChargeStatus(value) {
    if (value === "Draft") return t("billing.status.draft", "Draft");
    if (value === "Posted") return t("billing.status.posted", "Posted");
    if (value === "Voided") return t("billing.status.voided", "Voided");
    return value || "-";
}

function formatBillingSubscriptionStatus(value) {
    if (value === "Active") return t("billing.subscription.active", "Active");
    if (value === "Paused") return t("billing.subscription.paused", "Paused");
    if (value === "Cancelled") return t("billing.subscription.cancelled", "Cancelled");
    if (value === "Ended") return t("billing.subscription.ended", "Ended");
    return value || "-";
}

function formatBillingInterval(value) {
    if (value === "Monthly") return t("billing.interval.monthly", "Monthly");
    if (value === "Weekly") return t("billing.interval.weekly", "Weekly");
    if (value === "Custom") return t("billing.interval.custom", "Custom");
    return value || "-";
}

function formatBillingSource(value) {
    if (value === "subscription") return t("billing.source.subscription", "Subscription");
    if (value === "session_registration") return t("billing.source.session", "Session");
    if (value === "workshop_registration") return t("billing.source.workshop", "Workshop");
    if (value === "pos_sale") return t("billing.source.sale", "Sale");
    if (value === "fee") return t("billing.source.fee", "Fee");
    if (value === "adjustment") return t("billing.source.adjustment", "Adjustment");
    if (value === "manual") return t("billing.source.manual", "Manual");
    return value || "-";
}

function parsePlanCategoryIds(plan) {
    return parseGuidListJson(plan?.categoryIdsJson);
}

function filterPlansByCategory(plans, categoryId) {
    if (!categoryId) return plans;
    return (plans || []).filter(plan => {
        const categories = parsePlanCategoryIds(plan);
        return categories.length === 0 || categories.includes(categoryId);
    });
}

function buildPlanCategoryOptions(categories, selectedId) {
    const options = [];
    options.push({
        id: "",
        name: t("plans.categoryAll", "All categories"),
        selected: !selectedId
    });
    (categories || [])
        .filter(category => category.isActive !== false || String(category.id) === String(selectedId))
        .forEach(category => {
            options.push({
                id: category.id,
                name: category.name,
                selected: String(category.id) === String(selectedId)
            });
        });
    return options;
}

function renderPlanOptions(container, plans, selectedIds, categoryId, inputName) {
    if (!container) return;
    const filteredPlans = filterPlansByCategory(plans || [], categoryId);
    container.innerHTML = filteredPlans.map(plan => {
        const id = String(plan.id);
        const selected = selectedIds.has(id) ? "checked" : "";
        const name = escapeHtml(plan.name);
        const price = escapeHtml(formatPlainPrice(plan.priceCents));
        return `<label class="plan-pill">
            <input type="checkbox" name="${inputName}" value="${escapeHtml(id)}" ${selected} />
            <span>
              <span class="plan-name">${name}</span>
              <span class="plan-price">${price}</span>
            </span>
          </label>`;
    }).join("");
}

function formatCustomerStatus(value) {
    if (!value) return "";
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "active") return t("customers.status.active", "Active");
    if (normalized === "archived") return t("customers.status.archived", "Archived");
    if (normalized === "lead") return t("customers.status.lead", "Lead");
    if (normalized === "trial") return t("customers.status.trial", "Trial");
    if (normalized === "vip") return t("customers.status.vip", "VIP");
    return value;
}

function formatCustomerRegistrations(registrations) {
    return (registrations || []).map(reg => {
        const start = reg.startUtc ? (parseUtcDate(reg.startUtc) || new Date(reg.startUtc)) : null;
        const end = reg.endUtc ? (parseUtcDate(reg.endUtc) || new Date(reg.endUtc)) : null;
        const dateLabel = start ? formatDateDisplay(start) : "-";
        const timeLabel = start
            ? `${formatTimeOnly(start)}${end ? ` - ${formatTimeOnly(end)}` : ""}`
            : "-";
        const bookingStatusLabel = normalizeBookingStatus(reg.status);
        const attendanceLabel = reg.attendanceStatus ? normalizeAttendanceStatus(reg.attendanceStatus) : "-";
        const seriesTitle = reg.seriesTitle || t("session.sessionFallback", "Session");
        return {
            ...reg,
            dateLabel,
            timeLabel,
            bookingStatusLabel,
            attendanceLabel,
            seriesTitle
        };
    });
}

function formatAuditAction(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "create") return t("audit.action.create", "Created");
    if (normalized === "update") return t("audit.action.update", "Updated");
    if (normalized === "delete") return t("audit.action.delete", "Deleted");
    if (normalized === "login") return t("audit.action.login", "Login");
    if (normalized === "logout") return t("audit.action.logout", "Logout");
    if (normalized === "register") return t("audit.action.register", "Registered");
    if (normalized === "cancel") return t("audit.action.cancel", "Cancelled");
    if (normalized === "report") return t("audit.action.report", "Reported");
    if (normalized === "generate") return t("audit.action.generate", "Generated");
    if (normalized === "invite") return t("audit.action.invite", "Invited");
    if (normalized === "import") return t("audit.action.import", "Imported");
    if (normalized === "activity") return t("audit.action.activity", "Activity");
    return value;
}

function translateAuditSummary(log) {
    const summary = String(log?.summary || "").trim();
    if (!summary) return "";
    const patterns = [
        {
            regex: /^Created billing subscription for (.+)$/i,
            template: t("audit.summary.createdSubscription", "Created billing subscription for {item}")
        },
        {
            regex: /^Created charge for (.+)$/i,
            template: t("audit.summary.createdCharge", "Created charge for {item}")
        },
        {
            regex: /^Generated (\\d+) charges$/i,
            template: t("audit.summary.generatedCharges", "Generated {count} charges")
        },
        {
            regex: /^Voided charge$/i,
            template: t("audit.summary.voidedCharge", "Voided charge")
        },
        {
            regex: /^Imported customers \\(created: (\\d+), updated: (\\d+), skipped: (\\d+)\\)$/i,
            template: t("audit.summary.importedCustomers", "Imported customers (created: {created}, updated: {updated}, skipped: {skipped})")
        },
        {
            regex: /^Reset password for (.+)$/i,
            template: t("audit.summary.resetPassword", "Reset password for {item}")
        },
        {
            regex: /^Created customer (.+)$/i,
            template: t("audit.summary.createdCustomer", "Created customer {item}")
        },
        {
            regex: /^Updated customer (.+)$/i,
            template: t("audit.summary.updatedCustomer", "Updated customer {item}")
        },
        {
            regex: /^Created customer for guest (.+)$/i,
            template: t("audit.summary.createdCustomerGuest", "Created customer for guest {item}")
        },
        {
            regex: /^Created customer status (.+)$/i,
            template: t("audit.summary.createdCustomerStatus", "Created customer status {item}")
        },
        {
            regex: /^Updated customer status (.+)$/i,
            template: t("audit.summary.updatedCustomerStatus", "Updated customer status {item}")
        },
        {
            regex: /^Archived customer status (.+)$/i,
            template: t("audit.summary.archivedCustomerStatus", "Archived customer status {item}")
        },
        {
            regex: /^Created customer tag (.+)$/i,
            template: t("audit.summary.createdCustomerTag", "Created customer tag {item}")
        },
        {
            regex: /^Renamed customer tag (.+) to (.+)$/i,
            template: t("audit.summary.renamedCustomerTag", "Renamed customer tag {from} to {to}")
        },
        {
            regex: /^Deleted customer tag (.+)$/i,
            template: t("audit.summary.deletedCustomerTag", "Deleted customer tag {item}")
        },
        {
            regex: /^Uploaded attachment for customer (.+)$/i,
            template: t("audit.summary.uploadedAttachmentCustomer", "Uploaded attachment for customer {item}")
        },
        {
            regex: /^Uploaded attachment for user (.+)$/i,
            template: t("audit.summary.uploadedAttachmentUser", "Uploaded attachment for user {item}")
        },
        {
            regex: /^Added attachment (.+)$/i,
            template: t("audit.summary.addedAttachment", "Added attachment {item}")
        },
        {
            regex: /^Deleted attachment (.+)$/i,
            template: t("audit.summary.deletedAttachment", "Deleted attachment {item}")
        },
        {
            regex: /^Added activity for customer (.+)$/i,
            template: t("audit.summary.activityCustomer", "Added activity for customer {item}")
        },
        {
            regex: /^Recorded attendance for customer (.+)$/i,
            template: t("audit.summary.recordedAttendance", "Recorded attendance for customer {item}")
        },
        {
            regex: /^Removed attendance for customer (.+)$/i,
            template: t("audit.summary.removedAttendance", "Removed attendance for customer {item}")
        },
        {
            regex: /^Submitted health declaration for customer (.+)$/i,
            template: t("audit.summary.submittedHealth", "Submitted health declaration for customer {item}")
        },
        {
            regex: /^Removed registration$/i,
            template: t("audit.summary.removedRegistration", "Removed registration")
        },
        {
            regex: /^Cancelled booking$/i,
            template: t("audit.summary.cancelledBooking", "Cancelled booking")
        },
        {
            regex: /^Updated session details$/i,
            template: t("audit.summary.updatedSession", "Updated session details")
        },
        {
            regex: /^Deleted session$/i,
            template: t("audit.summary.deletedSession", "Deleted session")
        },
        {
            regex: /^Generated sessions for (.+)$/i,
            template: t("audit.summary.generatedSessions", "Generated sessions for {item}")
        },
        {
            regex: /^Created (.+)$/i,
            template: t("audit.summary.created", "Created {item}")
        },
        {
            regex: /^Updated (.+)$/i,
            template: t("audit.summary.updated", "Updated {item}")
        },
        {
            regex: /^Deleted (.+)$/i,
            template: t("audit.summary.deleted", "Deleted {item}")
        },
        {
            regex: /^Archived (.+)$/i,
            template: t("audit.summary.archived", "Archived {item}")
        },
        {
            regex: /^Generated (.+)$/i,
            template: t("audit.summary.generated", "Generated {item}")
        }
    ];
    for (const entry of patterns) {
        const match = summary.match(entry.regex);
        if (!match) continue;
        let output = entry.template;
        if (output.includes("{item}") && match[1]) {
            output = output.replace("{item}", match[1]);
        }
        if (output.includes("{count}") && match[1]) {
            output = output.replace("{count}", match[1]);
        }
        if (output.includes("{created}") && match[1]) {
            output = output.replace("{created}", match[1]);
        }
        if (output.includes("{updated}") && match[2]) {
            output = output.replace("{updated}", match[2]);
        }
        if (output.includes("{skipped}") && match[3]) {
            output = output.replace("{skipped}", match[3]);
        }
        if (output.includes("{from}") && match[1]) {
            output = output.replace("{from}", match[1]);
        }
        if (output.includes("{to}") && match[2]) {
            output = output.replace("{to}", match[2]);
        }
        return output;
    }
    return summary;
}

function formatAuditEntity(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    const map = {
        EventInstance: t("audit.entity.session", "Session"),
        EventSeries: t("audit.entity.series", "Series"),
        Booking: t("audit.entity.booking", "Booking"),
        Attendance: t("audit.entity.attendance", "Attendance"),
        Customer: t("audit.entity.customer", "Customer"),
        User: t("audit.entity.user", "User"),
        Instructor: t("audit.entity.instructor", "Instructor"),
        Room: t("audit.entity.room", "Room"),
        Plan: t("audit.entity.plan", "Plan"),
        BillableItem: t("audit.entity.billableItem", "Billable item"),
        BillingSubscription: t("audit.entity.billingSubscription", "Subscription"),
        BillingCharge: t("audit.entity.billingCharge", "Charge"),
        Payment: t("audit.entity.payment", "Payment"),
        Membership: t("audit.entity.membership", "Membership"),
        HealthDeclaration: t("audit.entity.health", "Health waiver"),
        Payroll: t("audit.entity.payroll", "Payroll"),
        AuditLog: t("audit.entity.audit", "Audit log"),
        Studio: t("audit.entity.studio", "Studio")
    };
    return map[normalized] || value;
}

function toCurrencyUnits(cents) {
    const amount = Number(cents || 0) / 100;
    return Number.isFinite(amount) ? amount : 0;
}

function toCents(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100);
}

function formatPlainPrice(cents) {
    const amount = toCurrencyUnits(cents);
    const locale = getLocaleFromSettings();
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
}

function buildTitleSuggestions(data) {
    const suggestions = new Set();
    (data?.items || []).forEach(item => {
        const title = String(item?.seriesTitle || "").trim();
        if (!title) return;
        const isSeries = item?.eventSeriesId && String(item.eventSeriesId) !== "00000000-0000-0000-0000-000000000000";
        if (isSeries) {
            suggestions.add(title);
        }
    });
    (data?.series || []).forEach(series => {
        const title = String(series?.title || "").trim();
        if (title) {
            suggestions.add(title);
        }
    });
    return Array.from(suggestions);
}

function createTitleSuggestionId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBookingStatus(value) {
    if (typeof value === "string") {
        if (value === "Confirmed") {
            return t("booking.registered", "Registered");
        }
        if (value === "Cancelled") {
            return t("status.cancelled", "Cancelled");
        }
        if (value === "Pending") {
            return t("booking.pending", "Pending");
        }
        return value;
    }
    if (value === 2) {
        return t("status.cancelled", "Cancelled");
    }
    if (value === 1) {
        return t("booking.registered", "Registered");
    }
    return t("booking.pending", "Pending");
}

function normalizeAttendanceStatus(value) {
    if (typeof value === "string") {
        if (value === "NoShow") return t("attendance.noshow", "No-show");
        if (value === "Present") return t("attendance.present", "Present");
        if (value === "Registered") return t("attendance.registered", "Registered");
        return value;
    }
    if (value === 0) {
        return t("attendance.present", "Present");
    }
    if (value === 1) {
        return t("attendance.noshow", "No-show");
    }
    return t("attendance.registered", "Registered");
}

function buildEventMap(items, timeZone) {
    const map = new Map();
    const now = new Date();
    items.forEach(item => {
        if (!item?.startUtc) {
            return;
        }
        const start = parseUtcDate(item.startUtc) || new Date(item.startUtc);
        if (Number.isNaN(start.getTime())) {
            return;
        }
        const end = item.endUtc ? (parseUtcDate(item.endUtc) || new Date(item.endUtc)) : null;
        const endSafe = end && !Number.isNaN(end.getTime()) ? end : null;
        const dateKey = getDateKeyInTimeZone(start, timeZone);
        const isHoliday = Boolean(item.isHoliday);
        const isBirthday = Boolean(item.isBirthday);
        const isAllDay = isHoliday || isBirthday;
        const pastCheck = endSafe ?? start;
        const isPast = !isAllDay && pastCheck < now;
        const startTime = isAllDay ? "" : formatTimeOnly(start, timeZone);
        const endTime = isAllDay || !endSafe ? "" : formatTimeOnly(endSafe, timeZone);
        const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
        const statusLabel = normalizeStatus(item.status);
        const isCancelled = String(item.status) === "Cancelled" || item.status === 1;
        const birthdayName = item.birthdayName || item.seriesTitle || "";
        const birthdayIcon = "\u{1F382}";
        const birthdayTitle = birthdayName
            ? `${birthdayIcon} ${birthdayName}`
            : `${birthdayIcon} ${t("calendar.birthday", "Birthday")}`;
        const seriesTitle = isBirthday ? birthdayTitle : item.seriesTitle;
        const seriesIcon = isBirthday ? "" : item.seriesIcon;
        const durationFallback = endSafe ? Math.max(15, Math.round((endSafe.getTime() - start.getTime()) / 60000)) : 60;
        const durationMinutes = Number(item.durationMinutes || durationFallback || 60);
        const dayStartMinutes = 7 * 60;
        const startMinutes = (start.getHours() * 60) + start.getMinutes();
        const eventStartMinutes = isAllDay ? 0 : Math.max(0, startMinutes - dayStartMinutes);
        const eventStyle = `${item.seriesColor ? `--series-color: ${item.seriesColor};` : ""}--event-duration: ${durationMinutes};--event-start: ${eventStartMinutes};`;
        const booked = Number(item.booked || 0);
        const capacity = Number(item.capacity || 0);
        const remoteBooked = Number(item.remoteBooked || 0);
        const remoteCapacity = Number(item.remoteCapacity || 0);
        const list = map.get(dateKey) || [];
        if (isBirthday) {
            const resolvedName = birthdayName || t("calendar.birthday", "Birthday");
            const existing = list.find(entry => entry.isBirthdayGroup);
            if (existing) {
                existing.birthdayNames.push(resolvedName);
                existing.birthdayContacts.push({
                    name: resolvedName,
                    email: item.birthdayEmail || "",
                    phone: item.birthdayPhone || ""
                });
                existing.birthdayCount = existing.birthdayNames.length;
                existing.hasBirthdayList = existing.birthdayCount > 1;
                existing.birthdayNamesJson = encodeURIComponent(JSON.stringify(existing.birthdayNames));
                existing.birthdayContactsJson = encodeURIComponent(JSON.stringify(existing.birthdayContacts));
                existing.seriesTitle = `${birthdayIcon} ${existing.birthdayNames[0]}`;
            } else {
                const birthdayNames = [resolvedName];
                const birthdayContacts = [{
                    name: resolvedName,
                    email: item.birthdayEmail || "",
                    phone: item.birthdayPhone || ""
                }];
                const event = {
                    ...item,
                    dateKey,
                    startTime,
                    endTime,
                    timeRange,
                    statusLabel,
                    isCancelled,
                    isHoliday,
                    isBirthday,
                    isBirthdayGroup: true,
                    isLocked: true,
                    suppressActions: true,
                    isPast: false,
                    seriesTitle,
                    seriesIcon: "",
                    roomSummary: "",
                    registeredSummary: "",
                    remoteSummary: "",
                    price: "",
                    eventStyle,
                    birthdayNames,
                    birthdayCount: birthdayNames.length,
                    hasBirthdayList: false,
                    birthdayNamesJson: encodeURIComponent(JSON.stringify(birthdayNames)),
                    birthdayContacts,
                    birthdayContactsJson: encodeURIComponent(JSON.stringify(birthdayContacts)),
                    birthdayDateLabel: formatFullDate(start, timeZone)
                };
                list.push(event);
            }
            map.set(dateKey, list);
            return;
        }

        const summaryValue = isHoliday ? "" : `${booked}/${capacity}`;
        const roomSummary = [item.roomName, summaryValue].filter(Boolean).join(" · ");
        const event = {
            ...item,
            dateKey,
            startTime,
            endTime,
            timeRange,
            statusLabel,
            isCancelled,
            isHoliday,
            isBirthday,
            isPast,
            isLocked: isAllDay,
            suppressActions: isHoliday || isBirthday || isAllDay,
            seriesTitle,
            seriesIcon,
            roomSummary,
            registeredSummary: isHoliday ? "" : `${booked}/${capacity}`,
            remoteSummary: remoteCapacity > 0 && !isHoliday ? `${remoteBooked}/${remoteCapacity}` : "",
            price: formatPlainPrice(item.priceCents),
            eventStyle,
            isAllDay,
            birthdayNames: [],
            birthdayCount: 0,
            hasBirthdayList: false,
            birthdayNamesJson: "",
            birthdayContacts: [],
            birthdayContactsJson: "",
            birthdayDateLabel: ""
        };
        list.push(event);
        map.set(dateKey, list);
    });

    map.forEach(list => list.sort((a, b) => {
        const aPriority = (a.isHoliday || a.isBirthday) ? 0 : 1;
        const bPriority = (b.isHoliday || b.isBirthday) ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(a.startUtc) - new Date(b.startUtc);
    }));
    return map;
}

function getRangeLabel(view, focusDate, weekStartsOn, timeZone) {
    const focus = parseDateInput(focusDate);

    if (view === "day") {
        return formatFullDate(focus, timeZone);
    }

    if (view === "list") {
        const monthStart = startOfMonth(focus);
        const end = addDays(addYears(monthStart, 1), -1);
        return `${formatMonthYear(monthStart, timeZone)} - ${formatMonthYear(end, timeZone)}`;
    }

    if (view === "month") {
        return formatMonthYear(focus, timeZone);
    }

    const weekStart = startOfWeek(focus, weekStartsOn);
    const weekEnd = addDays(weekStart, 6);
    return `${formatMonthDay(weekStart, timeZone)} - ${formatMonthDay(weekEnd, timeZone)}`;
}

function shiftCalendarDate(view, focusDate, direction) {
    const focus = parseDateInput(focusDate);

    if (view === "day") {
        return formatDateKeyLocal(addDays(focus, direction));
    }

    if (view === "list") {
        const monthStart = startOfMonth(focus);
        return formatDateKeyLocal(addYears(monthStart, direction));
    }

    if (view === "month") {
        const next = new Date(focus.getFullYear(), focus.getMonth() + direction, 1, 12);
        return formatDateKeyLocal(next);
    }

    return formatDateKeyLocal(addDays(focus, direction * 7));
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addYears(date, amount) {
    return new Date(date.getFullYear() + amount, date.getMonth(), date.getDate(), 12);
}

function parseDateInput(value) {
    if (!value) {
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        return now;
    }
    const trimmed = String(value).trim();
    if (trimmed.includes("/")) {
        const [day, month, year] = trimmed.split("/").map(part => Number(part));
        return new Date(year || 0, (month || 1) - 1, day || 1, 12);
    }
    const [year, month, day] = trimmed.split("-").map(part => Number(part));
    return new Date(year || 0, (month || 1) - 1, day || 1, 12);
}

function parseUtcDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
        return new Date(raw);
    }
    return new Date(`${raw}Z`);
}

function formatDateKeyLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(value) {
    const date = value instanceof Date ? value : parseDateInput(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function normalizeDateInputValue(value) {
    if (!value) return "";
    const parsed = parseDateInput(value);
    if (!parsed || Number.isNaN(parsed.getTime())) return "";
    return formatDateKeyLocal(parsed);
}

function getBillingDefaultRange() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
        from: normalizeDateInputValue(startOfMonth),
        to: normalizeDateInputValue(today)
    };
}

function resolveBillingRunRange() {
    const guard = document.getElementById("billing-run-guard");
    const fromInput = document.querySelector("[name=\"billingFrom\"]");
    const toInput = document.querySelector("[name=\"billingTo\"]");
    const { from: defaultFrom, to: defaultTo } = getBillingDefaultRange();
    const useCustom = Boolean(guard?.checked);
    const fromValue = useCustom ? normalizeDateInputValue(fromInput?.value || "") : defaultFrom;
    const toValue = useCustom ? normalizeDateInputValue(toInput?.value || "") : defaultTo;
    return { useCustom, fromValue, toValue, defaultFrom, defaultTo, fromInput, toInput };
}

function syncBillingRangeGuard() {
    const { useCustom, fromValue, toValue, defaultFrom, defaultTo, fromInput, toInput } = resolveBillingRunRange();
    if (!fromInput || !toInput) return;
    fromInput.disabled = !useCustom;
    toInput.disabled = !useCustom;
    if (!useCustom) {
        fromInput.value = defaultFrom || fromValue;
        toInput.value = defaultTo || toValue;
    }
}

function normalizeTimeInputValue(value) {
    const trimmed = String(value || "").trim().toLowerCase();
    if (!trimmed) return "";
    const match = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return "";
    let hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const meridiem = match[3];
    if (meridiem) {
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
    }
    if (hours > 23 || minutes > 59) return "";
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function closeEventActionsMenu() {
    if (activeEventMenu) {
        activeEventMenu.remove();
        activeEventMenu = null;
    }
    if (activeEventMenuCleanup) {
        activeEventMenuCleanup();
        activeEventMenuCleanup = null;
    }
}

function getBirthdayNamesFromElement(element) {
    if (!element) return null;
    const raw = element.getAttribute("data-birthday-names");
    if (!raw) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch {
        return null;
    }
    return null;
}

function getBirthdayContactsFromElement(element) {
    if (!element) return null;
    const raw = element.getAttribute("data-birthday-contacts");
    if (!raw) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch {
        return null;
    }
    return null;
}

async function shareSessionLink(item, data) {
    if (!item) return;
    const shareSlug = data?.calendar?.studio?.slug || "demo";
    const shareUrl = `${window.location.origin}/app?studio=${encodeURIComponent(shareSlug)}#/event/${item.id}`;
    const shareTitle = item.seriesTitle || t("calendar.shareTitle", "Session");
    if (navigator.share) {
        try {
            await navigator.share({ title: shareTitle, url: shareUrl });
            return;
        } catch {}
    }
    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast(t("calendar.shareCopied", "Share link copied."), "success");
    } catch {
        showToast(t("calendar.shareCopyError", "Unable to copy share link."), "error");
    }
}

function openEventActionsMenu(anchor, item, data) {
    if (!anchor || !item) return;
    closeEventActionsMenu();
    const menu = document.createElement("div");
    menu.className = "event-actions-menu";
    menu.innerHTML = `
        <button type="button" data-action="share">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-7.1 4.13a3 3 0 0 0-2.17-1 3 3 0 1 0 2.17 5l7.1 4.13A3 3 0 1 0 15 16a3 3 0 0 0 .17 1l-7.1-4.13a3 3 0 0 0 0-2.74l7.1-4.13A3 3 0 0 0 18 8z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </span>
          ${t("calendar.actionShare", "Share")}
        </button>
        <button type="button" data-action="register">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="8.5" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="M19 8v6M16 11h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          ${t("calendar.actionRegister", "Register student")}
        </button>
        <button type="button" data-action="edit">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L18.81 7.94l-2.75-2.75L4 17.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          </span>
          ${t("calendar.actionEdit", "Edit session")}
        </button>
        <button type="button" data-action="duplicate">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="9" y="9" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="M5 7V5h10" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="M5 17V7" fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>
          </span>
          ${t("calendar.actionDuplicate", "Duplicate session")}
        </button>
        <button type="button" data-action="delete">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          ${t("calendar.actionDelete", "Delete session")}
        </button>
    `;

    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 6;
    const left = rect.left + window.scrollX;
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    const onDocumentClick = (event) => {
        if (event.target === anchor || anchor.contains(event.target)) return;
        if (menu.contains(event.target)) return;
        closeEventActionsMenu();
    };
    const onKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeEventActionsMenu();
        }
    };
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("keydown", onKeyDown);
    activeEventMenuCleanup = () => {
        document.removeEventListener("click", onDocumentClick, true);
        document.removeEventListener("keydown", onKeyDown);
    };
    activeEventMenu = menu;

    menu.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const action = button.getAttribute("data-action");
        closeEventActionsMenu();
        if (action === "register") {
            await openSessionRegistrationsModal(item, data, { focusRegistration: true });
            return;
        }
        if (action === "edit") {
            openCalendarEventModal(item, data);
            return;
        }
        if (action === "share") {
            await shareSessionLink(item, data);
            return;
        }
        if (action === "duplicate") {
            await duplicateSessionFromItem(item, data);
            return;
        }
        if (action === "delete") {
            const confirmed = await confirmWithModal({
                title: t("calendar.deleteTitle", "Delete session?"),
                message: t("calendar.deleteMessage", "This will remove the session and its registrations."),
                confirmLabel: t("calendar.deleteConfirm", "Delete session"),
                cancelLabel: t("common.cancel", "Cancel")
            });
            if (!confirmed) return;
            try {
                await apiDelete(`/api/admin/event-instances/${item.id}`);
                showToast(t("calendar.deleteSuccess", "Session deleted."), "success");
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("calendar.deleteError", "Unable to delete session."), "error");
            }
        }
    });
}

function bindCalendarInteractions(data, itemMap) {
    const calendarMeta = data.calendar || {};
    const timeZone = getLocalTimeZone();
    const dropZones = document.querySelectorAll(".calendar-dropzone[data-date]");
    let dragTimeOffsetMinutes = 0;
    let dragPointerOffsetPx = 0;

    document.querySelectorAll(".calendar-event[data-event]").forEach(card => {
        const id = card.getAttribute("data-event") || "";
        card.addEventListener("dragstart", (event) => {
            if (!event.dataTransfer || !id) return;
            const item = itemMap.get(String(id));
            if (item?.startUtc) {
                const start = parseUtcDate(item.startUtc) || new Date(item.startUtc);
                if (!Number.isNaN(start.getTime())) {
                    const dayStartMinutes = 7 * 60;
                    const startMinutes = (start.getHours() * 60) + start.getMinutes();
                    dragTimeOffsetMinutes = Math.max(0, startMinutes - dayStartMinutes);
                } else {
                    dragTimeOffsetMinutes = 0;
                }
            } else {
                dragTimeOffsetMinutes = 0;
            }
            const rect = card.getBoundingClientRect();
            const pointerOffset = event.clientY - rect.top;
            dragPointerOffsetPx = Number.isFinite(pointerOffset) ? Math.max(0, pointerOffset) : 0;
            event.dataTransfer.setData("text/plain", id);
            event.dataTransfer.effectAllowed = "move";
            card.classList.add("dragging");
        });
        card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
        });
    });

    const resolveTimeGridMetrics = (zone) => {
        const grid = zone.querySelector(".calendar-day-events, .calendar-events");
        if (!grid) return null;
        const styles = getComputedStyle(grid);
        const topGap = parseFloat(styles.getPropertyValue("--hour-top-gap")) || 0;
        const hourCount = parseFloat(styles.getPropertyValue("--hour-count")) || 0;
        let rowHeight = parseFloat(styles.getPropertyValue("--hour-row-height")) || 64;
        let gridTop = grid.getBoundingClientRect().top + topGap;
        const timeGrid = zone.closest(".calendar-time-grid");
        const hoursColumn = timeGrid?.querySelector(".calendar-hours");
        const hourCells = hoursColumn?.querySelectorAll(".calendar-hour") || [];
        if (hourCells.length >= 2) {
            const firstRect = hourCells[0].getBoundingClientRect();
            const secondRect = hourCells[1].getBoundingClientRect();
            const measured = secondRect.top - firstRect.top;
            if (Number.isFinite(measured) && measured > 0) {
                rowHeight = measured;
            }
        }
        return { grid, rowHeight, topGap, hourCount, gridTop };
    };

    dropZones.forEach(zone => {
        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.classList.add("drag-over");
            const isTimeGrid = Boolean(zone.closest(".calendar-time-grid"));
            const metrics = isTimeGrid ? resolveTimeGridMetrics(zone) : null;
            if (!metrics) return;
            let offsetY = event.clientY - metrics.gridTop - dragPointerOffsetPx;
            if (!Number.isFinite(offsetY)) offsetY = 0;
            offsetY = Math.max(0, offsetY);
            const minutesFromStart = (offsetY / metrics.rowHeight) * 60;
            const snapped = Math.round(minutesFromStart / 30) * 30;
        });
        zone.addEventListener("dragleave", () => {
            zone.classList.remove("drag-over");
        });
        zone.addEventListener("drop", async (event) => {
            event.preventDefault();
            zone.classList.remove("drag-over");
            const eventId = event.dataTransfer?.getData("text/plain");
            const dateKey = zone.getAttribute("data-date");
            if (!eventId || !dateKey) return;
            const item = itemMap.get(String(eventId));
            if (!item || item.isHoliday || item.isBirthday) return;
            const currentStart = parseUtcDate(item.startUtc) || new Date(item.startUtc);
            const currentKey = getDateKeyInTimeZone(currentStart, timeZone);
            const isTimeGrid = Boolean(zone.closest(".calendar-time-grid"));
            const metrics = isTimeGrid ? resolveTimeGridMetrics(zone) : null;
            let debugOffsetY = null;
            let debugRowHeight = null;
            let debugGridTop = null;
            let targetStartMinutes = null;
            if (metrics) {
                let offsetY = event.clientY - metrics.gridTop - dragPointerOffsetPx;
                if (!Number.isFinite(offsetY)) offsetY = 0;
                offsetY = Math.max(0, offsetY);
                debugOffsetY = offsetY;
                debugRowHeight = metrics.rowHeight;
                debugGridTop = metrics.gridTop;
                const durationMinutes = Number(item.durationMinutes || (item.endUtc
                    ? Math.max(15, Math.round(((parseUtcDate(item.endUtc) || new Date(item.endUtc)).getTime() - currentStart.getTime()) / 60000))
                    : 60));
                const maxMinutes = metrics.hourCount > 0
                    ? Math.max(0, (metrics.hourCount * 60) - durationMinutes)
                    : Math.max(0, 24 * 60 - durationMinutes);
                const maxOffset = (maxMinutes / 60) * metrics.rowHeight;
                const clampedOffset = Math.min(Math.max(0, offsetY), maxOffset);
                const minutesFromStart = (clampedOffset / metrics.rowHeight) * 60;
                const snapped = Math.round(minutesFromStart / 30) * 30;
                const clamped = Math.min(Math.max(0, snapped), maxMinutes);
                targetStartMinutes = Math.round(clamped / 30) * 30;
            }
            if (currentKey === dateKey) {
                if (targetStartMinutes === null) return;
                const currentMinutes = currentStart.getHours() * 60 + currentStart.getMinutes();
                const dayStartMinutes = 7 * 60;
                if (currentMinutes === dayStartMinutes + targetStartMinutes) return;
            }
            try {
                const effectiveStartMinutes = (targetStartMinutes === null || targetStartMinutes === 0)
                    ? dragTimeOffsetMinutes
                    : targetStartMinutes;
                console.log("[calendar] drop", {
                    eventId,
                    dateKey,
                    isTimeGrid,
                    targetStartMinutes,
                    effectiveStartMinutes,
                    dragTimeOffsetMinutes,
                    offsetY: debugOffsetY,
                    rowHeight: debugRowHeight,
                    gridTop: debugGridTop
                });
                await moveEventInstance(item, dateKey, effectiveStartMinutes);
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("session.moveError", "Unable to move session."), "error");
            }
        });
        zone.addEventListener("click", (event) => {
            if (event.target.closest(".calendar-event")) return;
            const dateKey = zone.getAttribute("data-date");
            if (!dateKey) return;
            openSessionModal(data, { date: dateKey });
        });
    });
}

async function moveEventInstance(item, dateKey, startMinutesOverride) {
    const start = parseUtcDate(item.startUtc) || new Date(item.startUtc);
    const end = item.endUtc ? (parseUtcDate(item.endUtc) || new Date(item.endUtc)) : null;
    const durationMinutes = Number(item.durationMinutes || (end ? Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)) : 60));
    const durationMs = durationMinutes ? durationMinutes * 60000 : null;
    const targetDate = parseDateInput(dateKey);
    const dayStartMinutes = 7 * 60;
    const originalMinutes = start.getHours() * 60 + start.getMinutes();
    const targetMinutes = Number.isFinite(startMinutesOverride)
        ? dayStartMinutes + Number(startMinutesOverride)
        : originalMinutes;
    const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, targetMinutes));
    const targetHours = Math.floor(safeMinutes / 60);
    const targetMinutesOnly = safeMinutes % 60;
    const movedStart = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        targetHours,
        targetMinutesOnly,
        start.getSeconds(),
        start.getMilliseconds()
    );
    const payload = {
        startUtc: movedStart.toISOString(),
        instructorId: item.instructorId || null,
        roomId: item.roomId || null
    };
    if (durationMs !== null) {
        payload.endUtc = new Date(movedStart.getTime() + durationMs).toISOString();
    }
    await apiPut(`/api/admin/event-instances/${item.id}`, payload);
}

function getDateKeyInTimeZone(value, timeZone) {
    const date = value instanceof Date ? value : (parseUtcDate(value) || new Date(value));
    return formatDateKeyLocal(date);
}

function startOfWeek(date, weekStartsOn) {
    const dayIndex = date.getDay();
    const diff = (dayIndex - weekStartsOn + 7) % 7;
    return addDays(date, -diff);
}

function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
}

function getLocaleFromSettings() {
    const raw = (document.documentElement.lang || "").trim().replace("_", "-").toLowerCase();
    if (!raw) return "en-IL";
    if (raw.includes("-")) return raw;
    if (raw === "he") return "he-IL";
    if (raw === "en") return "en-IL";
    return `${raw}-IL`;
}

function formatTimeOnly(date, timeZone) {
    const value = date instanceof Date ? date : new Date(date);
    if (!value || Number.isNaN(value.getTime())) return "";
    return new Intl.DateTimeFormat(getLocaleFromSettings(), {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).format(value);
}

function formatTimeInput(date, timeZone) {
    const parts = new Intl.DateTimeFormat(getLocaleFromSettings(), {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    const hour = parts.find(part => part.type === "hour")?.value ?? "00";
    const minute = parts.find(part => part.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
}

function formatMonthDay(date, timeZone) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
}

function formatFullDate(date, timeZone) {
    return formatDateDisplay(date);
}

function formatMonthYear(date, timeZone) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${month}/${date.getFullYear()}`;
}

function calculateAge(dateValue) {
    if (!dateValue) return null;
    const date = dateValue instanceof Date ? dateValue : parseDateInput(dateValue);
    if (!date || Number.isNaN(date.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age -= 1;
    }
    return age >= 0 ? age : null;
}

function formatAgeLabel(dateValue) {
    const age = calculateAge(dateValue);
    if (age === null || Number.isNaN(age)) return "";
    return t("customer.ageLabel", "Age {age}").replace("{age}", String(age));
}

function formatHebrewDate(date) {
    return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

function getWeekNumber(date) {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    return Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
}

function getWeekdayNames(weekStartsOn) {
    const base = new Date(2024, 0, 7, 12);
    const names = Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(getLocaleFromSettings(), { weekday: "short" }).format(addDays(base, index)));
    return names.slice(weekStartsOn).concat(names.slice(0, weekStartsOn));
}

function bindBillingDelegates() {
    if (billingHandlersBound) return;
    document.addEventListener("click", async (event) => {
        const snapshot = actor.getSnapshot();
        const route = snapshot?.context?.route;
        if (route !== "billing") return;
        const data = snapshot?.context?.data || {};
        const runBtn = event.target.closest("#billing-run");
        if (runBtn) {
            event.preventDefault();
            const { useCustom, fromValue, toValue } = resolveBillingRunRange();
            if (useCustom && (!fromValue || !toValue)) {
                showToast(t("billing.runRangeError", "Select a date range first."), "error");
                return;
            }
            const message = t("billing.runConfirmMessage", "Generate charges from {from} to {to}.")
                .replace("{from}", formatDateDisplay(fromValue))
                .replace("{to}", formatDateDisplay(toValue));
            openConfirmModal({
                title: t("billing.runConfirmTitle", "Run billing?"),
                message,
                confirmLabel: t("billing.runConfirm", "Run billing"),
                cancelLabel: t("common.cancel", "Cancel"),
                onConfirm: async () => {
                    try {
                        const params = new URLSearchParams();
                        if (fromValue) params.set("from", fromValue);
                        if (toValue) params.set("to", toValue);
                        const qs = params.toString();
                        await apiPost(`/api/admin/billing/run${qs ? `?${qs}` : ""}`, {});
                        showToast(t("billing.runSuccess", "Billing run complete."), "success");
                        actor.send({ type: "REFRESH" });
                    } catch (error) {
                        showToast(error.message || t("billing.runError", "Unable to run billing."), "error");
                    }
                }
            });
            return;
        }
        const exportBtn = event.target.closest("#billing-export");
        if (exportBtn) {
            event.preventDefault();
            const fromValue = document.querySelector("[name=\"billingFrom\"]")?.value || "";
            const toValue = document.querySelector("[name=\"billingTo\"]")?.value || "";
            const params = new URLSearchParams();
            if (fromValue) params.set("from", fromValue);
            if (toValue) params.set("to", toValue);
            const qs = params.toString();
            window.location.href = `/api/admin/billing/charges/export${qs ? `?${qs}` : ""}`;
            return;
        }
        const newChargeBtn = event.target.closest("#billing-new-charge");
        if (newChargeBtn) {
            event.preventDefault();
            openBillingChargeModal(data);
            return;
        }
        const newSubscriptionBtn = event.target.closest("#billing-new-subscription");
        if (newSubscriptionBtn) {
            event.preventDefault();
            openBillingSubscriptionModal(data);
            return;
        }
        const newItemBtn = event.target.closest("#billing-new-item");
        if (newItemBtn) {
            event.preventDefault();
            openBillingItemModal(null);
            return;
        }
        const applyBtn = event.target.closest("#billing-apply");
        if (applyBtn) {
            event.preventDefault();
            const fromRaw = document.querySelector("[name=\"billingFrom\"]")?.value || "";
            const toRaw = document.querySelector("[name=\"billingTo\"]")?.value || "";
            const statusValue = document.querySelector("[name=\"billingStatus\"]")?.value || "";
            const customerValue = document.querySelector("[name=\"billingCustomer\"]")?.value || "";
            const sourceValue = document.querySelector("[name=\"billingSource\"]")?.value || "";
            const params = new URLSearchParams();
            if (fromRaw) params.set("from", fromRaw);
            if (toRaw) params.set("to", toRaw);
            if (statusValue) params.set("status", statusValue);
            if (customerValue) params.set("customerId", customerValue);
            if (sourceValue) params.set("sourceType", sourceValue);
            const query = params.toString();
            window.location.hash = `#/billing${query ? `?${query}` : ""}`;
            return;
        }
        const itemEditBtn = event.target.closest("[data-item-edit]");
        if (itemEditBtn) {
            event.preventDefault();
            const id = itemEditBtn.getAttribute("data-item-edit");
            const item = (data.items || []).find(entry => String(entry.id) === String(id));
            if (item) {
                openBillingItemModal(item);
            }
            return;
        }
        const adjustBtn = event.target.closest("[data-charge-adjust]");
        if (adjustBtn) {
            event.preventDefault();
            const id = adjustBtn.getAttribute("data-charge-adjust");
            if (id) openBillingAdjustModal(id);
            return;
        }
        const voidBtn = event.target.closest("[data-charge-void]");
        if (voidBtn) {
            event.preventDefault();
            const id = voidBtn.getAttribute("data-charge-void");
            if (id) openBillingVoidModal(id);
            return;
        }
        const pauseBtn = event.target.closest("[data-subscription-pause]");
        if (pauseBtn) {
            event.preventDefault();
            const id = pauseBtn.getAttribute("data-subscription-pause");
            if (!id) return;
            try {
                await apiPost(`/api/admin/billing/subscriptions/${id}/pause`, {});
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("billing.pauseError", "Unable to pause subscription."), "error");
            }
            return;
        }
        const resumeBtn = event.target.closest("[data-subscription-resume]");
        if (resumeBtn) {
            event.preventDefault();
            const id = resumeBtn.getAttribute("data-subscription-resume");
            if (!id) return;
            try {
                await apiPost(`/api/admin/billing/subscriptions/${id}/resume`, {});
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("billing.resumeError", "Unable to resume subscription."), "error");
            }
            return;
        }
        const cancelBtn = event.target.closest("[data-subscription-cancel]");
        if (cancelBtn) {
            event.preventDefault();
            const id = cancelBtn.getAttribute("data-subscription-cancel");
            if (!id) return;
            openConfirmModal({
                title: t("billing.cancelTitle", "Cancel subscription?"),
                message: t("billing.cancelMessage", "This will stop future billing."),
                confirmLabel: t("billing.cancel", "Cancel"),
                cancelLabel: t("common.cancel", "Cancel"),
                onConfirm: async () => {
                    try {
                        await apiPost(`/api/admin/billing/subscriptions/${id}/cancel`, {});
                        actor.send({ type: "REFRESH" });
                    } catch (error) {
                        showToast(error.message || t("billing.cancelError", "Unable to cancel subscription."), "error");
                    }
                }
            });
        }
    });
    document.addEventListener("change", (event) => {
        const snapshot = actor.getSnapshot();
        const route = snapshot?.context?.route;
        if (route !== "billing") return;
        if (event.target.closest("#billing-run-guard")) {
            syncBillingRangeGuard();
        }
    });
    billingHandlersBound = true;
}

actor.subscribe((state) => {
    debugLog("state", { value: state.value, route: state.context.route });
    render(state);
});

ensureGlobalEscapeHandler();
bindBillingDelegates();
actor.start();

const adminRoutes = new Set(["calendar", "events", "rooms", "plans", "customers", "customer", "users", "guests", "reports", "payroll", "billing", "invoices", "audit", "settings"]);

function getRouteParam(route, index = 1) {
    const hash = window.location.hash || `#/${route}`;
    const cleaned = hash.replace(/^#\/?/, "");
    const [path] = cleaned.split("?");
    const parts = path.split("/");
    if (parts[0] !== route) return "";
    return parts[index] || "";
}

function resolveRouteFromHash(defaultRoute) {
    const hash = window.location.hash || `#/${defaultRoute}`;
    const cleaned = hash.replace(/^#\/?/, "");
    const [path] = cleaned.split("?");
    const route = path.split("/")[0] || defaultRoute;
    return adminRoutes.has(route) ? route : defaultRoute;
}

function handleRouteChange() {
    const route = resolveRouteFromHash("calendar");
    const snapshot = actor.getSnapshot?.();
    debugLog("hashchange", { route, hash: window.location.hash, state: snapshot?.value });
    if (snapshot?.matches?.("login")) {
        return;
    }
    actor.send({ type: "NAVIGATE", route });
}

window.addEventListener("hashchange", handleRouteChange);
handleRouteChange();


