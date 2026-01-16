import { createMachine, createActor, fromPromise, assign } from "xstate";
import Handlebars from "handlebars";
import { apiGet, apiPost, apiPut, apiDelete } from "../shared/api.js";
import { login, logout, getSession, loadSessionHint, consumeForceLogout } from "../shared/auth.js";
import { setLocale, t, resolveLocale, getStoredLocale } from "../shared/i18n.js";
import { compileTemplate } from "../shared/templates.js";
import { formatMoney, getQueryParam, toDateInputValue } from "../shared/utils.js";

const root = document.getElementById("app");
const sessionHint = loadSessionHint();
Handlebars.registerHelper("t", (key, fallback) => t(key, fallback));

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
        <a href="#/calendar" data-route="calendar">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zm13 8H4v10h16V10z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.calendar" "Calendar"}}</span>
        </a>
        <a href="#/events" data-route="events">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4V6H7a4 4 0 0 0-4 4v1H1v-1a6 6 0 0 1 6-6h10V1zm-10 22l-4-4 4-4v3h10a4 4 0 0 0 4-4v-1h2v1a6 6 0 0 1-6 6H7v3z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.events" "Event series"}}</span>
        </a>
        <a href="#/rooms" data-route="rooms">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 3h12a2 2 0 0 1 2 2v16h-2v-2H6v2H4V3zm2 2v12h8V5H6zm9 7h1v2h-1v-2z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.rooms" "Rooms"}}</span>
        </a>
        <a href="#/plans" data-route="plans">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2zm-2 8h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6zm4 2v2h6v-2H5z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.plans" "Plans"}}</span>
        </a>
        <a href="#/customers" data-route="customers">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M16 11a3 3 0 1 0-2.999-3A3 3 0 0 0 16 11zm-8 0a3 3 0 1 0-2.999-3A3 3 0 0 0 8 11zm0 2c-2.67 0-8 1.34-8 4v3h10v-3c0-.7.2-1.34.56-1.9C9.71 13.4 8.9 13 8 13zm8 0c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.customers" "Customers"}}</span>
        </a>
        <a href="#/users" data-route="users">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.67-8 5v3h16v-3c0-3.33-4.7-5-8-5z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.users" "Users"}}</span>
        </a>
        <a href="#/guests" data-route="guests">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 2c-3.3 0-8 1.67-8 5v3h10v-3c0-1.37.47-2.56 1.3-3.54C10.1 14.43 9.08 14 8 14zm12-1h-2V9h-2v4h-4v2h4v4h2v-4h2z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.guests" "Guests"}}</span>
        </a>
        <a href="#/reports" data-route="reports">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 3h2v18H3V3zm8 6h2v12h-2V9zm8-4h2v16h-2V5z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.reports" "Reports"}}</span>
        </a>
        <a href="#/payroll" data-route="payroll">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3c-5.52 0-10 1.79-10 4s4.48 4 10 4 10-1.79 10-4-4.48-4-10-4zm0 10c-5.52 0-10 1.79-10 4s4.48 4 10 4 10-1.79 10-4-4.48-4-10-4z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.payroll" "Payroll"}}</span>
        </a>
        <a href="#/audit" data-route="audit">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M9 2h6a2 2 0 0 1 2 2h3v18H4V4h3a2 2 0 0 1 2-2zm0 4h6V4H9v2zm-1 9l2 2 4-4 1.5 1.5L10 19l-3.5-3.5L8 15z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.audit" "Audit"}}</span>
        </a>
        <a href="#/settings" data-route="settings">
          <span class="nav-short" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M19.4 13a7.96 7.96 0 0 0 .1-1 7.96 7.96 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.42 7.42 0 0 0-1.7-1L15 2h-6l-.3 2.9c-.6.2-1.2.6-1.7 1l-2.5-1-2 3.4L4.6 11a7.96 7.96 0 0 0-.1 1 7.96 7.96 0 0 0 .1 1L2.5 14.6l2 3.4 2.5-1c.5.4 1.1.8 1.7 1L9 22h6l.3-2.9c.6-.2 1.2-.6 1.7-1l2.5 1 2-3.4L19.4 13zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z"/></svg>
          </span>
          <span class="nav-label">{{t "nav.settings" "Settings"}}</span>
        </a>
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
        <button class="secondary" id="logout-btn">{{t "nav.logout" "Log out"}}</button>
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
    <div class="calendar-views">
      <button class="secondary {{#if isDay}}active{{/if}}" data-view="day">{{t "calendar.day" "Day"}}</button>
      <button class="secondary {{#if isWeek}}active{{/if}}" data-view="week">{{t "calendar.week" "Week"}}</button>
      <button class="secondary {{#if isMonth}}active{{/if}}" data-view="month">{{t "calendar.month" "Month"}}</button>
      <button class="secondary {{#if isList}}active{{/if}}" data-view="list">{{t "calendar.list" "List"}}</button>
    </div>
    <div class="calendar-nav">
      <button class="secondary" data-nav="prev">{{t "calendar.prev" "Prev"}}</button>
      <input type="date" id="calendar-date" value="{{focusDate}}" />
      <button class="secondary" data-nav="next">{{t "calendar.next" "Next"}}</button>
    </div>
    <div class="calendar-actions">
      {{#if isList}}
        <input type="search" id="calendar-search" placeholder="{{t "calendar.search" "Search sessions"}}" value="{{search}}" />
      {{/if}}
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
      <button id="add-session">{{t "calendar.addSession" "Add session"}}</button>
    </div>
    <div class="calendar-range">{{rangeLabel}}</div>
  </div>
  <div class="calendar-body">
    {{#if isDay}}
      <div class="calendar-day calendar-dropzone" data-date="{{day.dateKey}}">
        <div class="calendar-day-header">{{day.label}}</div>
        {{#if day.hasEvents}}
          <div class="calendar-events">
            {{#each day.events}}
              <div class="calendar-event {{#if isCancelled}}cancelled{{/if}} {{#if isHoliday}}holiday{{/if}}" data-event="{{id}}" {{#unless isHoliday}}draggable="true"{{/unless}} style="{{eventStyle}}">
                <div class="event-time">{{timeRange}}</div>
                <div class="event-title">
                  {{#if seriesIcon}}<span class="event-icon">{{seriesIcon}}</span>{{/if}}
                  {{seriesTitle}}
                </div>
                <div class="event-meta">{{roomName}} - {{instructorName}}</div>
                <div class="event-meta">{{booked}} / {{capacity}} - {{price}}</div>
                {{#if isCancelled}}
                  <div class="event-meta">{{t "calendar.cancelled" "Cancelled"}}</div>
                {{/if}}
              </div>
            {{/each}}
          </div>
        {{else}}
          <div class="empty-state">{{t "calendar.empty.day" "No classes scheduled."}}</div>
        {{/if}}
      </div>
    {{/if}}
    {{#if isWeek}}
      <div class="calendar-week">
        {{#each week.days}}
          <div class="calendar-day-column calendar-dropzone {{#if isToday}}today{{/if}}" data-date="{{dateKey}}">
            <div class="calendar-day-label">
              <span>{{weekday}}</span>
              <span class="date">{{dateLabel}}</span>
            </div>
            {{#if hasEvents}}
              <div class="calendar-day-events">
                {{#each events}}
                  <div class="calendar-event compact {{#if isCancelled}}cancelled{{/if}} {{#if isHoliday}}holiday{{/if}}" data-event="{{id}}" {{#unless isHoliday}}draggable="true"{{/unless}} style="{{eventStyle}}">
                    <div class="event-time">{{timeRange}}</div>
                    <div class="event-title">
                      {{#if seriesIcon}}<span class="event-icon">{{seriesIcon}}</span>{{/if}}
                      {{seriesTitle}}
                    </div>
                    <div class="event-meta">{{roomName}}</div>
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
                      <div class="calendar-event mini {{#if isCancelled}}cancelled{{/if}} {{#if isHoliday}}holiday{{/if}}" data-event="{{id}}" {{#unless isHoliday}}draggable="true"{{/unless}} style="{{eventStyle}}">
                        <span class="event-time">{{time}}</span>
                        <span class="event-title">
                          {{#if seriesIcon}}<span class="event-icon">{{seriesIcon}}</span>{{/if}}
                          {{title}}
                        </span>
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
              <tr class="{{#if isHoliday}}holiday-row{{/if}}" data-event="{{id}}">
                <td>{{dateLabel}}</td>
                <td>{{timeRange}}</td>
                <td>
                  <div class="event-title">
                    {{#if seriesIcon}}<span class="event-icon">{{seriesIcon}}</span>{{/if}}
                    {{seriesTitle}}
                    {{#if isHoliday}}<span class="customer-tag">{{t "calendar.holiday" "Holiday"}}</span>{{/if}}
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
`);
const rosterTemplate = compileTemplate("roster", `
  <h4>{{t "roster.title" "Registrations"}}</h4>
  <div class="roster-actions">
    <label class="checkbox">
      <input type="checkbox" id="roster-select-all" />
      {{t "roster.selectAll" "Select all"}}
    </label>
    <div class="roster-actions-buttons">
      <button class="secondary" id="roster-email">{{t "roster.emailSelected" "Email selected"}}</button>
      <button class="secondary" id="roster-sms">{{t "roster.smsSelected" "SMS selected"}}</button>
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
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{seriesTitle}}</h3>
          <div class="muted">{{startLabel}} ({{timeRange}})</div>
          <div class="meta">{{roomName}} - {{instructorName}}</div>
          <div class="meta" data-capacity-summary>{{capacitySummary}}</div>
        </div>
        <button class="modal-close" id="close-modal" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <div class="modal-columns">
        <div class="modal-column modal-column-details">
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
              <label>{{t "session.capacity" "Capacity"}}</label>
              <input type="number" name="capacity" value="{{capacity}}" />      
            </div>
            <div>
              <label>{{t "session.remoteCapacity" "Remote capacity"}}</label>
              <input type="number" name="remoteCapacity" value="{{remoteCapacity}}" />
            </div>
            <div>
              <label>{{t "session.price" "Price (cents)"}}</label>
              <input type="number" name="priceCents" value="{{priceCents}}" />  
            </div>
            <div>
              <label>{{t "session.zoomInvite" "Zoom invite link"}}</label>
              <input name="remoteInviteUrl" value="{{remoteInviteUrl}}" placeholder="https://zoom.us/j/..." />
            </div>
          </div>
        </div>
        <div class="modal-column modal-column-registration">
          <div class="share-row">
            <label>{{t "session.shareLink" "Share registration link"}}</label>
            <div class="share-field">
              <input type="text" readonly value="{{shareUrl}}" />
              <button class="secondary" id="copy-share-link">{{t "common.copy" "Copy"}}</button>
              <a class="secondary" href="{{shareUrl}}" target="_blank" rel="noreferrer">{{t "common.open" "Open"}}</a>
            </div>
          </div>
          <div class="roster" data-roster-panel>
            {{{rosterHtml}}}
          </div>
          <div class="registration-form">
            <h4>{{t "session.addCustomer" "Add customer"}}</h4>
            <div class="form-grid">
              <div class="span-2">
                <label>{{t "session.findCustomer" "Find existing customer"}}</label>
                <input name="customerLookup" list="customer-list" placeholder="{{t "session.findCustomerPlaceholder" "Start typing a name or email"}}" autocomplete="off" />
                <input type="hidden" name="customerId" />
                <datalist id="customer-list">
                  {{#each customers}}
                    <option value="{{lookupLabel}}" data-customer-id="{{id}}"></option>
                  {{/each}}
                </datalist>
              </div>
              <div>
                <label>{{t "session.customerName" "Full name"}}</label>
                <input name="fullName" placeholder="{{t "session.customerNamePlaceholder" "New customer name"}}" />
              </div>
              <div>
                <label>{{t "session.customerEmail" "Email"}}</label>
                <input name="email" type="email" placeholder="{{t "session.customerEmailPlaceholder" "name@email.com"}}" />
              </div>
              <div>
                <label>{{t "session.customerPhone" "Phone"}}</label>
                <input name="phone" type="tel" placeholder="{{t "session.customerPhonePlaceholder" "+1 555 123 4567"}}" />
              </div>
              <div>
                <label>{{t "session.attendance" "Attendance"}}</label>
                <select name="attendanceType">
                  <option value="in-person">{{t "session.attendance.inPerson" "In-studio"}}</option>
                  {{#if hasRemoteCapacity}}
                    <option value="remote">{{t "session.attendance.remote" "Remote (Zoom)"}}</option>
                  {{/if}}
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <div class="meta">{{t "session.addCustomerHint" "Select an existing customer or create a new one."}}</div>
              <div class="modal-actions">
                <button id="register-customer">{{t "session.registerCustomer" "Register customer"}}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="meta" data-booked-meta>{{capacitySummary}}</div>
        <div class="modal-actions">
          <button class="secondary" id="duplicate-session">{{t "session.duplicate" "Duplicate"}}</button>
          <button id="save-instance">{{t "common.saveChanges" "Save changes"}}</button>
          <button class="secondary" id="edit-series">{{t "series.edit" "Edit series"}}</button>
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
          <input name="title" value="Studio Flow" />
        </div>
        <div>
          <label>{{t "session.description" "Description"}}</label>
          <input name="description" value="" />
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
          <input type="time" name="startTimeLocal" value="18:00" />
        </div>
        <div>
          <label>{{t "session.duration" "Duration (min)"}}</label>
          <input type="number" name="durationMinutes" value="60" />
        </div>
        <div>
          <label>{{t "session.capacity" "Capacity"}}</label>
          <input type="number" name="capacity" value="14" />
        </div>
        <div>
          <label>{{t "session.remoteCapacity" "Remote capacity"}}</label>
          <input type="number" name="remoteCapacity" value="0" />
        </div>
        <div>
          <label>{{t "session.price" "Price (cents)"}}</label>
          <input type="number" name="priceCents" value="2500" />
        </div>
        <div>
          <label>{{t "session.currency" "Currency"}}</label>
          <input name="currency" value="ILS" />
        </div>
        <div>
          <label>{{t "session.zoomInvite" "Zoom invite link"}}</label>
          <input name="remoteInviteUrl" placeholder="{{t "session.zoomInvitePlaceholder" "https://zoom.us/j/..."}}" />
        </div>
        <div>
          <label>{{t "session.cancellationWindow" "Cancellation window (hours)"}}</label>
          <input type="number" name="cancellationWindowHours" value="6" />
        </div>
      </div>
      <div class="form-grid session-one-time">
        <div>
          <label>{{t "session.date" "Date"}}</label>
          <input type="date" name="date" value="{{focusDate}}" />
        </div>
      </div>
      <div class="form-grid session-recurring hidden">
        <div>
          <label>{{t "session.startDate" "Start date"}}</label>
          <input type="date" name="startDate" value="{{focusDate}}" />
        </div>
        <div>
          <label>{{t "session.dayOfWeek" "Day of week"}}</label>
          <select name="dayOfWeek">
            <option value="1">{{t "weekday.monday" "Monday"}}</option>
            <option value="2">{{t "weekday.tuesday" "Tuesday"}}</option>
            <option value="3">{{t "weekday.wednesday" "Wednesday"}}</option>
            <option value="4">{{t "weekday.thursday" "Thursday"}}</option>
            <option value="5">{{t "weekday.friday" "Friday"}}</option>
            <option value="6">{{t "weekday.saturday" "Saturday"}}</option>
            <option value="0">{{t "weekday.sunday" "Sunday"}}</option>
          </select>
        </div>
        <div>
          <label>{{t "session.recurrence" "Recurrence (weeks)"}}</label>
          <input type="number" name="recurrenceIntervalWeeks" value="1" />
        </div>
        <div>
          <label>{{t "session.generateWeeks" "Generate weeks"}}</label>
          <input type="number" name="generateWeeks" value="8" />
        </div>
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "session.addHint" "Sessions appear on the calendar immediately."}}</div>
        <div class="modal-actions">
          <button id="save-session">{{t "session.create" "Create session"}}</button>
        </div>
      </div>
    </div>
  </div>
`);

const seriesModalTemplate = compileTemplate("series-modal", `
  <div class="modal-overlay" id="series-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>{{modalTitle}}</h3>
          <div class="muted">{{subtitle}}</div>
        </div>
        <button class="modal-close" id="close-series" type="button" aria-label="{{t "common.close" "Close"}}"></button>
      </div>
      <input type="hidden" name="seriesId" value="{{seriesId}}" />
      <div class="form-grid">
        <div>
          <label>{{t "series.title" "Title"}}</label>
          <input name="title" value="{{titleValue}}" />
        </div>
        <div>
          <label>{{t "series.icon" "Icon"}}</label>
          <input name="icon" value="{{icon}}" placeholder="flow" />
        </div>
        <div>
          <label>{{t "series.color" "Color"}}</label>
          <div class="color-field">
            <input class="color-input" name="color" type="color" value="{{color}}" />
            <div class="color-chip" style="background: {{color}}"></div>
            <input class="color-text" type="text" value="{{color}}" placeholder="#f59e0b" data-color-text />
          </div>
        </div>
        <div>
          <label>{{t "series.dayOfWeek" "Day of week"}}</label>
          <select name="dayOfWeek">
            {{#each dayOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "series.startTime" "Start time"}}</label>
          <input type="time" name="startTimeLocal" value="{{startTimeLocal}}" />
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
          <label>{{t "series.price" "Price (cents)"}}</label>
          <input type="number" name="priceCents" value="{{priceCents}}" />
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
          <label>{{t "series.description" "Description"}}</label>
          <textarea name="description" rows="2">{{description}}</textarea>
        </div>
        <div>
          <label>{{t "series.recurrence" "Recurrence (weeks)"}}</label>
          <input type="number" name="recurrenceIntervalWeeks" value="{{recurrenceIntervalWeeks}}" />
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
            <label class="checkbox">
              <input type="checkbox" name="planIds" value="{{id}}" {{#if selected}}checked{{/if}} />
              {{name}} <span class="muted">({{price}})</span>
            </label>
          {{/each}}
        </div>
        <div class="meta">{{t "series.allowedPlansHint" "Leave empty to allow all plans + drop-ins."}}</div>
      </div>
      <div class="modal-footer">
        <div class="meta">{{t "series.updateHint" "Series updates apply to future generated sessions."}}</div>
        <div class="modal-actions">
          <button id="save-series">{{saveLabel}}</button>
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
          <label>{{t "customer.firstName" "First name"}}</label>
          <input name="firstName" value="{{firstName}}" />
        </div>
        <div>
          <label>{{t "customer.lastName" "Last name"}}</label>
          <input name="lastName" value="{{lastName}}" />
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
          <label>{{t "customer.gender" "Gender"}}</label>
          <select name="gender">
            {{#each genderOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "customer.dateOfBirth" "Date of birth"}}</label>
          <input name="dateOfBirth" type="date" value="{{dateOfBirth}}" />
        </div>
        <div>
          <label>{{t "customer.city" "City"}}</label>
          <input name="city" value="{{city}}" />
        </div>
        <div class="span-2">
          <label>{{t "customer.address" "Address"}}</label>
          <input name="address" value="{{address}}" />
        </div>
        <div>
          <label>{{t "customer.occupation" "Occupation"}}</label>
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
        <div>
          <label>{{t "customer.tags" "Tags"}}</label>
          <input name="tags" value="{{tags}}" placeholder="{{t "customer.tagsPlaceholder" "e.g. VIP, trial, morning"}}" />
        </div>
        <div>
          <label>{{t "customer.archived" "Archived"}}</label>
          <select name="isArchived">
            <option value="false" {{#unless isArchived}}selected{{/unless}}>{{t "common.no" "No"}}</option>
            <option value="true" {{#if isArchived}}selected{{/if}}>{{t "common.yes" "Yes"}}</option>
          </select>
        </div>
        {{#unless isEdit}}
        <div>
          <label>{{t "customer.password" "Password (optional)"}}</label>
          <input name="password" type="password" placeholder="{{t "customer.passwordHint" "Leave empty for temp password"}}" />
        </div>
        {{/unless}}
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
              <td><button class="secondary" data-status-edit="{{id}}">{{t "common.edit" "Edit"}}</button></td>
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
          <label>{{t "user.gender" "Gender"}}</label>
          <select name="gender">
            {{#each genderOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
        <div>
          <label>{{t "user.idNumber" "ID number"}}</label>
          <input name="idNumber" value="{{idNumber}}" />
        </div>
        <div class="span-2">
          <label>{{t "user.address" "Address"}}</label>
          <input name="address" value="{{address}}" />
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
          <label>{{t "user.instructorRate" "Payroll rate (cents)"}}</label>
          <input name="instructorRateCents" type="number" min="0" value="{{instructorRateCents}}" />
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
          <input name="instructorRateCurrency" value="{{instructorRateCurrency}}" />
        </div>
        <div>
          <label>{{t "user.password" "Password (optional)"}}</label>
          <input name="password" type="password" placeholder="{{t "user.passwordHint" "Leave empty to keep current"}}" />
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
        <div>
          <label>{{t "plans.weeklyLimit" "Weekly limit"}}</label>
          <input type="number" name="weeklyLimit" value="{{weeklyLimit}}" />
        </div>
        <div>
          <label>{{t "plans.punchUses" "Punch card uses"}}</label>
          <input type="number" name="punchCardUses" value="{{punchCardUses}}" />
        </div>
        <div>
          <label>{{t "plans.price" "Price (cents)"}}</label>
          <input type="number" name="priceCents" value="{{priceCents}}" />
        </div>
        <div>
          <label>{{t "plans.currency" "Currency"}}</label>
          <input name="currency" value="{{currency}}" />
        </div>
        <div>
          <label>{{t "plans.active" "Active"}}</label>
          <select name="planActive">
            {{#each activeOptions}}
              <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
            {{/each}}
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button id="save-plan">{{saveLabel}}</button>
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
    <button id="add-series">{{t "events.addSeries" "Add series"}}</button>
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
          <td>{{isActive}}</td>
          <td>
            <button class="secondary" data-edit="{{id}}">{{t "common.edit" "Edit"}}</button>
            <button data-generate="{{id}}">{{t "events.generate" "Generate"}}</button>
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
    <button id="add-plan">{{t "plans.add" "Add plan"}}</button>
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
          <td><button class="secondary" data-plan-edit="{{id}}">{{t "common.edit" "Edit"}}</button></td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
`);

const customersTemplate = compileTemplate("customers", `
  <div class="notice">{{t "customers.notice" "Manage customer profiles, contacts, and status."}}</div>
  <div class="toolbar">
    <button id="add-customer">{{t "customers.add" "Add customer"}}</button>     
    <button class="secondary" id="manage-statuses">{{t "customers.manageStatuses" "Manage statuses"}}</button>
  </div>
  <div class="customer-controls">
    <input type="search" name="search" placeholder="{{t "customers.search" "Search customers"}}" value="{{search}}" />
    <select name="statusFilter">
      <option value="">{{t "customers.statusAll" "All statuses"}}</option>
      {{#each statusOptions}}
        <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
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
        <th>{{t "customers.name" "Name"}}</th>
        <th>{{t "customers.email" "Email"}}</th>
        <th>{{t "customers.phone" "Phone"}}</th>
        <th>{{t "customers.status" "Status"}}</th>
        <th>{{t "customers.actions" "Actions"}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each customers}}
      <tr class="{{#if isArchived}}row-muted{{/if}}">
        <td><input type="checkbox" data-customer-select="{{id}}" /></td>
        <td>{{fullName}}</td>
        <td><a href="mailto:{{email}}">{{email}}</a></td>
        <td>
          <a href="tel:{{phone}}">{{phone}}</a>
          <a href="sms:{{phone}}" class="link-muted">{{t "customers.sms" "SMS"}}</a>
        </td>
        <td>{{statusLabel}}</td>
        <td>
          <button class="secondary" data-edit="{{id}}">{{t "common.edit" "Edit"}}</button>
          <button class="secondary" data-archive="{{id}}">{{archiveLabel}}</button>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>
`);

const usersTemplate = compileTemplate("users", `
  <div class="notice">{{t "users.notice" "Create and manage staff, instructors, and guest access."}}</div>
  <div class="toolbar">
    <button id="add-user">{{t "users.add" "Add user"}}</button>
    <div class="user-filters">
      <select name="userRoleFilter">
        {{#each roleOptions}}
          <option value="{{value}}" {{#if selected}}selected{{/if}}>{{label}}</option>
        {{/each}}
      </select>
      <button class="secondary" id="apply-user-filter">{{t "common.apply" "Apply"}}</button>
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
          <button class="secondary" data-user-edit="{{id}}">{{t "common.edit" "Edit"}}</button>
          <button class="secondary" data-user-invite="{{id}}">{{t "users.invite" "Invite"}}</button>
          <button class="secondary" data-user-copy="{{id}}">{{t "users.copyInvite" "Copy invite"}}</button>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>
`);

const guestDirectoryTemplate = compileTemplate("guest-directory", `
  <div class="notice">{{t "guests.notice" "Guests can only view schedules in read-only mode."}}</div>
  <div class="toolbar">
    <button id="add-guest">{{t "guests.add" "Add guest"}}</button>
  </div>
  <div class="customer-controls">
    <input type="search" name="guestSearch" placeholder="{{t "guests.search" "Search guests"}}" value="{{search}}" />
    <button class="secondary" id="apply-guest-search">{{t "common.apply" "Apply"}}</button>
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
          <button class="secondary" data-guest-invite="{{id}}">{{t "guests.invite" "Invite"}}</button>
          <button class="secondary" data-guest-copy="{{id}}">{{t "guests.copyInvite" "Copy invite"}}</button>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>
`);

const roomsTemplate = compileTemplate("rooms", `
  <div class="notice">{{t "rooms.notice" "Manage studio rooms and spaces."}}</div>
  <div class="toolbar">
    <button id="add-room">{{t "rooms.add" "Add room"}}</button>
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
          <button class="secondary" data-room-edit="{{id}}">{{t "common.edit" "Edit"}}</button>
          <button class="secondary" data-room-delete="{{id}}">{{t "common.delete" "Delete"}}</button>
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
      <input type="date" name="payrollFrom" value="{{from}}" />
    </div>
    <div>
      <label>{{t "payroll.to" "To"}}</label>
      <input type="date" name="payrollTo" value="{{to}}" />
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

const auditTemplate = compileTemplate("audit", `
  <div class="notice">{{t "audit.notice" "Track every change across the studio. Export or clear logs as needed."}}</div>
  {{#if errorMessage}}
    <div class="notice">{{errorMessage}}</div>
  {{/if}}
  <div class="audit-controls">
    <div>
      <label>{{t "audit.from" "From"}}</label>
      <input type="date" name="auditFrom" value="{{from}}" />
    </div>
    <div>
      <label>{{t "audit.to" "To"}}</label>
      <input type="date" name="auditTo" value="{{to}}" />
    </div>
    <div>
      <label>{{t "audit.search" "Search"}}</label>
      <input type="search" name="auditSearch" value="{{search}}" placeholder="{{t "audit.searchPlaceholder" "Search logs"}}" />
    </div>
    <div class="audit-actions">
      <button class="secondary" id="apply-audit">{{t "common.apply" "Apply"}}</button>
      <button class="secondary" id="export-audit">{{t "audit.export" "Export CSV"}}</button>
    </div>
  </div>
  <div class="audit-controls audit-clear">
    <div>
      <label>{{t "audit.clearBefore" "Clear before"}}</label>
      <input type="date" name="auditClearBefore" value="{{clearBefore}}" />
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
        <th>{{t "audit.entity" "Entity"}}</th>
        <th>{{t "audit.summary" "Summary"}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each logs}}
      <tr>
        <td>{{timeLabel}}</td>
        <td>{{actorLabel}}</td>
        <td>{{action}}</td>
        <td>{{entity}}</td>
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
      <input name="weekStartsOn" type="number" value="{{weekStartsOn}}" />
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
            <div class="color-chip" style="background: {{themePrimary}}"></div>
            <input class="color-text" type="text" value="{{themePrimary}}" placeholder="#f59e0b" data-color-text />
          </div>
        </div>
        <div>
          <label>{{t "settings.secondary" "Secondary"}}</label>
          <div class="color-field">
            <input class="color-input" name="themeSecondary" type="color" value="{{themeSecondary}}" />
            <div class="color-chip" style="background: {{themeSecondary}}"></div>
            <input class="color-text" type="text" value="{{themeSecondary}}" placeholder="#0f172a" data-color-text />
          </div>
        </div>
        <div>
          <label>{{t "settings.accent" "Accent"}}</label>
          <div class="color-field">
            <input class="color-input" name="themeAccent" type="color" value="{{themeAccent}}" />
            <div class="color-chip" style="background: {{themeAccent}}"></div>
            <input class="color-text" type="text" value="{{themeAccent}}" placeholder="#0ea5e9" data-color-text />
          </div>
        </div>
        <div>
          <label>{{t "settings.background" "Background"}}</label>
          <div class="color-field">
            <input class="color-input" name="themeBackground" type="color" value="{{themeBackground}}" />
            <div class="color-chip" style="background: {{themeBackground}}"></div>
            <input class="color-text" type="text" value="{{themeBackground}}" placeholder="#fffbeb" data-color-text />
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
            actions: "setRoute"
        },
        SET_CALENDAR: {
            target: ".loading",
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
            return {
                ...context,
                error: message === "LOGOUT" ? "" : (message || "Unable to load data")
            };
        })
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
            const studio = await apiGet("/api/admin/studio");
            switch (input.route) {
                case "calendar": {
                    const view = input.calendarView || "week";
                    const focusDate = input.calendarDate || toDateInputValue(new Date());
                    const range = getCalendarRange(view, focusDate, studio.weekStartsOn ?? 0);
                    const [items, rooms, instructors, customers] = await Promise.all([
                        apiGet(`/api/admin/calendar?from=${range.from}&to=${range.to}`),
                        apiGet("/api/admin/rooms"),
                        apiGet("/api/admin/instructors"),
                        apiGet("/api/admin/customers")
                    ]);
                    return { studio, items, rooms, instructors, customers, calendar: { view, focusDate, studio, range } };
                }
                case "events": {
                    const [series, rooms, instructors, plans] = await Promise.all([
                        apiGet("/api/admin/event-series"),
                        apiGet("/api/admin/rooms"),
                        apiGet("/api/admin/instructors"),
                        apiGet("/api/admin/plans")
                    ]);
                    return { studio, series, rooms, instructors, plans };
                }
                case "rooms": {
                    const rooms = await apiGet("/api/admin/rooms");
                    return { studio, rooms };
                }
                case "plans": {
                    const plans = await apiGet("/api/admin/plans");
                    return { studio, plans };
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
                    const query = new URLSearchParams();
                    if (search) query.set("search", search);
                    if (includeArchived) query.set("includeArchived", "true");
                    if (statusId) query.set("statusId", statusId);
                    const qs = query.toString();
                    const [customers, customerStatuses] = await Promise.all([
                        apiGet(`/api/admin/customers${qs ? `?${qs}` : ""}`),
                        apiGet("/api/admin/customer-statuses")
                    ]);
                    return { studio, customers, customerStatuses, customerFilters: { search, includeArchived, statusId } };
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
                case "settings": {
                    return { studio };
                }
                default:
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
    const titleMap = {
        calendar: t("page.calendar.title", "Calendar"),
        events: t("page.events.title", "Event series"),
        rooms: t("page.rooms.title", "Rooms"),
        plans: t("page.plans.title", "Membership plans"),
        customers: t("page.customers.title", "Customer roster"),
        users: t("page.users.title", "Team access"),
        guests: t("page.guests.title", "Guest directory"),
        reports: t("page.reports.title", "Performance pulse"),
        payroll: t("page.payroll.title", "Instructor payroll"),
        audit: t("page.audit.title", "Audit log"),
        settings: t("page.settings.title", "Studio settings")
    };

    const subtitleMap = {
        calendar: t("page.calendar.subtitle", "Week view of live classes."),
        events: t("page.events.subtitle", "Templates that drive recurring schedules."),
        rooms: t("page.rooms.subtitle", "Spaces and rooms in the studio."),
        plans: t("page.plans.subtitle", "Sell weekly limits or unlimited passes."),
        customers: t("page.customers.subtitle", "Top-level view of active clients."),
        users: t("page.users.subtitle", "Manage roles and instructor profiles."),
        guests: t("page.guests.subtitle", "Read-only viewers with schedule access."),
        reports: t("page.reports.subtitle", "Revenue and occupancy at a glance."),
        payroll: t("page.payroll.subtitle", "Track reported sessions and instructor rates."),
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
        const weekStartsOn = studio.weekStartsOn ?? 0;
        const search = state.context.calendarSearch || "";
        const viewState = buildCalendarView(data.items || [], {
            view,
            focusDate,
            timeZone,
            weekStartsOn,
            search
        });
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
            dayLabel: dayNames[item.dayOfWeek] || "",
            startTimeLocal: item.startTimeLocal,
            isActive: item.isActive ? "Yes" : "No",
            icon: item.icon || "",
            color: item.color || "#f59e0b"
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
            price: formatMoney(plan.priceCents, plan.currency),
            typeLabel: formatPlanType(plan.type),
            activeLabel: plan.active ? t("common.yes", "Yes") : t("common.no", "No")
        }));
        content = plansTemplate({ plans });
    }

    if (route === "customers") {
        const customers = (data.customers || []).map(c => ({
            ...c,
            statusLabel: c.isArchived
                ? t("customers.status.archived", "Archived")
                : (c.statusName || t("customers.status.active", "Active")),
            archiveLabel: c.isArchived ? t("customers.restore", "Restore") : t("customers.archive", "Archive")
        }));
        const filters = data.customerFilters || { search: "", includeArchived: false, statusId: "" };
        const statusOptions = (data.customerStatuses || [])
            .filter(status => status.isActive !== false)
            .map(status => ({
                id: status.id,
                name: status.name,
                selected: String(status.id) === String(filters.statusId || "")
            }));
        content = customersTemplate({
            customers,
            search: filters.search || "",
            includeArchived: filters.includeArchived,
            statusOptions
        });
    }

    if (route === "users") {
        const filters = data.userFilters || { role: "" };
        const roleOptions = [
            { value: "", label: t("users.filterAll", "All roles"), selected: !filters.role },
            { value: "Admin", label: t("roles.admin", "Admin"), selected: filters.role === "Admin" },
            { value: "Staff", label: t("roles.staff", "Staff"), selected: filters.role === "Staff" },
            { value: "Instructor", label: t("roles.instructor", "Instructor"), selected: filters.role === "Instructor" },
            { value: "Guest", label: t("roles.guest", "Guest"), selected: filters.role === "Guest" }
        ];
        const users = (data.users || [])
            .filter(item => {
                if (!filters.role) return true;
                const roles = item.roles || [item.role];
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
        content = payrollTemplate({
            logs,
            hasLogs: logs.length > 0,
            totalPayout: formatMoney(totalPayoutCents, "ILS"),
            totalSessions: logs.length,
            instructorOptions,
            from: filters.from || "",
            to: filters.to || "",
            errorMessage: data.payrollError || ""
        });
    }

    if (route === "audit") {
        const logs = (data.audit?.logs || []).map(log => {
            const actorLabel = log.actorName || log.actorEmail || log.actorRole || "-";
            const entity = log.entityId ? `${log.entityType} #${log.entityId}` : log.entityType;
            return {
                ...log,
                timeLabel: formatShortDateTime(log.createdAtUtc),
                actorLabel,
                entity
            };
        });
        const filters = data.audit?.filters || {};
        content = auditTemplate({
            logs,
            hasLogs: logs.length > 0,
            from: filters.from || "",
            to: filters.to || "",
            search: filters.search || "",
            clearBefore: filters.to || "",
            errorMessage: data.auditError || ""
        });
    }

    if (route === "audit") {
        const applyBtn = document.getElementById("apply-audit");
        const exportBtn = document.getElementById("export-audit");
        const clearBtn = document.getElementById("clear-audit");

        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                const from = document.querySelector("[name=\"auditFrom\"]")?.value || "";
                const to = document.querySelector("[name=\"auditTo\"]")?.value || "";
                const search = document.querySelector("[name=\"auditSearch\"]")?.value || "";
                const params = new URLSearchParams();
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (search) params.set("search", search);
                const query = params.toString();
                window.location.hash = `#/audit${query ? `?${query}` : ""}`;
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                const from = document.querySelector("[name=\"auditFrom\"]")?.value || "";
                const to = document.querySelector("[name=\"auditTo\"]")?.value || "";
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
                const before = document.querySelector("[name=\"auditClearBefore\"]")?.value || "";
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
        return;
    }

    if (route === "payroll") {
        const applyBtn = document.getElementById("apply-payroll");
        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                const from = document.querySelector("[name=\"payrollFrom\"]")?.value || "";
                const to = document.querySelector("[name=\"payrollTo\"]")?.value || "";
                const instructorId = document.querySelector("[name=\"payrollInstructor\"]")?.value || "";
                const params = new URLSearchParams();
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (instructorId) params.set("instructorId", instructorId);
                const query = params.toString();
                window.location.hash = `#/payroll${query ? `?${query}` : ""}`;
            });
        }
        return;
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
            themePrimary: ensureHexColor(theme.primary, "#f59e0b"),
            themeSecondary: ensureHexColor(theme.secondary, "#0f172a"),
            themeAccent: ensureHexColor(theme.accent, "#0ea5e9"),
            themeBackground: ensureHexColor(theme.background, "#fffbeb"),
            defaultLanguageOptions,
            userLanguageOptions,
            holidayCalendarOptions
        });
    }

    const userName = user.displayName || t("profile.userFallback", "Studio user");
    const userEmail = user.email || "";
    const userRolesLabel = (user.roles || [user.role]).filter(Boolean).join(", ");

    root.innerHTML = layoutTemplate({
        title: titleMap[route] || "Admin",
        subtitle,
        content,
        studioName: studio.name || "Letmein Studio",
        logoUrl: theme.logoUrl || "",
        userName,
        userEmail,
        userRolesLabel,
        userInitials: getInitials(userName || userEmail),
        userAvatarUrl: user.avatarUrl || ""
    });
    setFavicon(theme.faviconUrl || theme.logoUrl || "");

    applySidebarState(getSidebarState());

    const navigateToRoute = (routeName) => {
        const targetHash = `#/${routeName}`;
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

        viewButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const view = btn.getAttribute("data-view") || "week";
                const selectedDate = dateInput?.value || currentDate;
                actor.send({ type: "SET_CALENDAR", view, date: selectedDate });
            });
        });

        navButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const direction = btn.getAttribute("data-nav") === "prev" ? -1 : 1;
                const baseDate = dateInput?.value || currentDate;
                const nextDate = shiftCalendarDate(currentView, baseDate, direction);
                actor.send({ type: "SET_CALENDAR", view: currentView, date: nextDate });
            });
        });

        if (dateInput) {
            dateInput.addEventListener("change", () => {
                const nextDate = dateInput.value || currentDate;
                actor.send({ type: "SET_CALENDAR", view: currentView, date: nextDate });
            });
        }

        if (searchInput) {
            searchInput.addEventListener("input", () => {
                actor.send({ type: "SET_CALENDAR_SEARCH", search: searchInput.value || "" });
            });
        }

        document.querySelectorAll(".calendar-export [data-export]").forEach(button => {
            button.addEventListener("click", () => {
                const type = button.getAttribute("data-export");
                if (!type) return;
                const studioMeta = calendarMeta.studio || data.studio || {};
                const range = calendarMeta.range || getCalendarRange(currentView, currentDate, studioMeta.weekStartsOn ?? 0);
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
                event.stopPropagation();
                const id = card.getAttribute("data-event");
                const item = itemMap.get(String(id));
                if (!item || item.isHoliday) return;
                openCalendarEventModal(item, data);
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

        document.querySelectorAll("button[data-generate]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const seriesId = btn.getAttribute("data-generate");
                await apiPost(`/api/admin/event-series/${seriesId}/generate-instances`, {});
                actor.send({ type: "REFRESH" });
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
        const planMap = new Map((data.plans || []).map(plan => [String(plan.id), plan]));

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openPlanModal(null);
            });
        }

        document.querySelectorAll("button[data-plan-edit]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-plan-edit");
                const plan = planMap.get(String(id));
                if (!plan) return;
                openPlanModal(plan);
            });
        });
    }

    if (route === "customers") {
        const addBtn = document.getElementById("add-customer");
        const manageStatusesBtn = document.getElementById("manage-statuses");
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

        if (filterBtn) {
            filterBtn.addEventListener("click", () => {
                const searchInput = document.querySelector("[name=\"search\"]");
                const includeArchivedInput = document.querySelector("[name=\"includeArchived\"]");
                const statusInput = document.querySelector("[name=\"statusFilter\"]");
                const searchValue = searchInput?.value || "";
                const includeArchived = includeArchivedInput?.checked;
                const statusValue = statusInput?.value || "";
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
                const query = params.toString();
                window.location.hash = `#/customers${query ? `?${query}` : ""}`;
            });
        }

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
                const emails = getSelectedCustomers()
                    .map(customer => customer.email)
                    .filter(email => email);
                if (emails.length === 0) return;
                window.location.href = `mailto:${emails.join(",")}`;
            });
        }

        if (bulkSms) {
            bulkSms.addEventListener("click", () => {
                const phones = getSelectedCustomers()
                    .map(customer => customer.phone)
                    .filter(phone => phone);
                if (phones.length === 0) return;
                window.location.href = `sms:${phones.join(",")}`;
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
                try {
                    const invite = await requestInvite(id, true);
                    showToast(`${t("users.inviteSent", "Invite sent to")} ${invite.email}.`, "success");
                } catch (error) {
                    showToast(error.message || t("users.inviteError", "Unable to generate invite."), "error");
                }
            });
        });

        document.querySelectorAll("button[data-user-copy]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-user-copy");
                if (!id) return;
                try {
                    const invite = await requestInvite(id, false);
                    await copyInvite(invite);
                    showToast(t("users.inviteCopied", "Invite copied to clipboard."), "success");
                } catch (error) {
                    showToast(error.message || t("users.inviteCopyError", "Unable to copy invite."), "error");
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
                try {
                    const invite = await requestInvite(id, true);
                    showToast(`${t("guests.inviteSent", "Invite sent to")} ${invite.email}.`, "success");
                } catch (error) {
                    showToast(error.message || t("guests.inviteError", "Unable to send invite."), "error");
                }
            });
        });

        document.querySelectorAll("button[data-guest-copy]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-guest-copy");
                if (!id) return;
                try {
                    const invite = await requestInvite(id, false);
                    await copyInvite(invite);
                    showToast(t("guests.inviteCopied", "Invite copied to clipboard."), "success");
                } catch (error) {
                    showToast(error.message || t("guests.inviteCopyError", "Unable to copy invite."), "error");
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
                themeInputs.primary.value = ensureHexColor(themeValue.primary, themeInputs.primary.value || "#f59e0b");
                updateColorField(themeInputs.primary);
            }
            if (themeInputs.secondary) {
                themeInputs.secondary.value = ensureHexColor(themeValue.secondary, themeInputs.secondary.value || "#0f172a");
                updateColorField(themeInputs.secondary);
            }
            if (themeInputs.accent) {
                themeInputs.accent.value = ensureHexColor(themeValue.accent, themeInputs.accent.value || "#0ea5e9");
                updateColorField(themeInputs.accent);
            }
            if (themeInputs.background) {
                themeInputs.background.value = ensureHexColor(themeValue.background, themeInputs.background.value || "#fffbeb");
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
                    "weekStartsOn",
                    "themeJson",
                    "logoUrl",
                    "faviconUrl",
                    "themePrimary",
                    "themeSecondary",
                    "themeAccent",
                    "themeBackground",
                    "defaultLocale",
                    "userLocale"
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
                theme.primary = formValues.themePrimary || theme.primary || "#f59e0b";
                theme.secondary = formValues.themeSecondary || theme.secondary || "#0f172a";
                theme.accent = formValues.themeAccent || theme.accent || "#0ea5e9";
                theme.background = formValues.themeBackground || theme.background || "#fffbeb";
                const defaultLocale = formValues.defaultLocale || (state.context.studio?.defaultLocale || "en");
                const preferredLocale = formValues.userLocale || "";
                await apiPut("/api/admin/studio", {
                    name: formValues.name,
                    timezone: getLocalTimeZone(),
                    weekStartsOn: Number(formValues.weekStartsOn),
                    themeJson: JSON.stringify(theme, null, 2),
                    defaultLocale,
                    holidayCalendarsJson
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
        const element = document.querySelector(`[name="${field}"]`);
        values[field] = element ? element.value : "";
    });
    return values;
}

function serializeTags(value) {
    return (value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(", ");
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
    return date.toLocaleDateString("he-IL", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("he-IL", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
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
    if (!colorInput || !textInput) return;
    colorInput.addEventListener("input", () => updateColorField(colorInput));
    textInput.addEventListener("input", () => {
        const normalized = normalizeHexInput(textInput.value);
        if (!normalized) return;
        colorInput.value = normalized;
        updateColorField(colorInput);
    });
    updateColorField(colorInput);
}

function getInitials(value) {
    if (!value) return "U";
    const parts = value.trim().split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(part => part[0].toUpperCase());
    return initials.join("") || "U";
}

const sidebarStorageKey = "letmein.sidebar.collapsed";
let activeModalKeyHandler = null;

function getSidebarState() {
    return localStorage.getItem(sidebarStorageKey) === "1";
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
        toggle.textContent = collapsed
            ? t("nav.expand", "Expand")
            : t("nav.menu", "Menu");
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

function setFieldValue(name, value) {
    const element = document.querySelector(`[name="${name}"]`);
    if (!element) return;
    element.value = value ?? "";
}

function fillCustomerForm(customer) {
    setFieldValue("customerId", customer.id);
    setFieldValue("fullName", customer.fullName);
    setFieldValue("firstName", customer.firstName);
    setFieldValue("lastName", customer.lastName);
    setFieldValue("email", customer.email);
    setFieldValue("phone", customer.phone);
    setFieldValue("idNumber", customer.idNumber);
    setFieldValue("gender", customer.gender);
    setFieldValue("dateOfBirth", customer.dateOfBirth);
    setFieldValue("city", customer.city);
    setFieldValue("address", customer.address);
    setFieldValue("occupation", customer.occupation);
    setFieldValue("signedHealthView", customer.signedHealthView ? "true" : "false");
    const tags = customer.tags ?? formatTags(customer.tagsJson);
    setFieldValue("tags", tags);
    setFieldValue("isArchived", customer.isArchived ? "true" : "false");
    setFieldValue("password", "");
    const saveBtn = document.getElementById("save-customer");
    if (saveBtn) {
        saveBtn.textContent = t("customer.update", "Update customer");
    }
}

function resetCustomerForm() {
    setFieldValue("customerId", "");
    setFieldValue("fullName", "");
    setFieldValue("firstName", "");
    setFieldValue("lastName", "");
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
    setFieldValue("password", "");
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
    setFieldValue("address", userItem.address);
    setFieldValue("gender", userItem.gender);
    setFieldValue("idNumber", userItem.idNumber);
    setFieldValue("role", userItem.role || "Admin");
    setFieldValue("isActive", userItem.isActive ? "true" : "false");
    setFieldValue("instructorDisplayName", userItem.instructorName || "");
    setFieldValue("instructorBio", userItem.instructorBio || "");
    setFieldValue("password", "");
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
    setFieldValue("address", "");
    setFieldValue("gender", "");
    setFieldValue("idNumber", "");
    setFieldValue("role", "Admin");
    setFieldValue("isActive", "true");
    setFieldValue("instructorDisplayName", "");
    setFieldValue("instructorBio", "");
    setFieldValue("password", "");
    const saveBtn = document.getElementById("save-user");
    if (saveBtn) {
        saveBtn.textContent = t("user.create", "Create user");
    }
    toggleInstructorFields("Admin");
}

async function openCalendarEventModal(item, data) {
    const existing = document.getElementById("calendar-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const calendarMeta = data.calendar || {};
    const studio = calendarMeta.studio || {};
    const timeZone = getLocalTimeZone();
    const shareSlug = studio.slug || "demo";
    const shareUrl = `${window.location.origin}/app?studio=${encodeURIComponent(shareSlug)}#/event/${item.id}`;
    const start = new Date(item.startUtc);
    const end = item.endUtc ? new Date(item.endUtc) : null;
    const timeRange = end ? `${formatTimeOnly(start, timeZone)} - ${formatTimeOnly(end, timeZone)}` : formatTimeOnly(start, timeZone);
    const startLabel = formatFullDate(start, timeZone);

    let roster = [];
    try {
        roster = await apiGet(`/api/admin/event-instances/${item.id}/roster`);
    } catch {
        roster = [];
    }

    const messageSubject = `${t("session.emailSubject", "Class registration:")} ${item.seriesTitle || t("session.sessionFallback", "Session")}`;
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
        return {
            ...row,
            bookingStatusLabel,
            attendanceLabel,
            isRemote,
            isCancelled,
            isRegistered,
            isPresent,
            isNoShow,
            hasEmail: Boolean(email),
            hasPhone: Boolean(phone),
            hasWhatsapp: Boolean(phoneDigits),
            emailLink: email ? `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}` : "",
            phoneLink: phone ? `tel:${phone}` : "",
            smsLink: phone ? `sms:${phone}?&body=${encodedBody}` : "",
            whatsappLink: phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodedBody}` : ""
        };
    });

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

    const rosterRows = normalizeRosterRows(roster);
    const formatCapacitySummary = (rows, capacityValue, remoteCapacityValue) => {
        const activeRows = rows.filter(row => !row.isCancelled);
        const bookedCount = activeRows.filter(row => !row.isRemote).length;
        const remoteCount = activeRows.filter(row => row.isRemote).length;
        const bookedLabel = t("capacity.registered", "Registered");
        const remoteLabel = t("capacity.registeredRemote", "Registered remotely");
        if (remoteCapacityValue > 0) {
            return `${bookedLabel}: ${bookedCount} / ${capacityValue} • ${remoteLabel}: ${remoteCount} / ${remoteCapacityValue}`;
        }
        return `${bookedLabel}: ${bookedCount} / ${capacityValue}`;
    };
    const capacityValue = Number(item.capacity || 0);
    const remoteCapacityValue = Number(item.remoteCapacity || 0);
    const capacitySummary = formatCapacitySummary(rosterRows, capacityValue, remoteCapacityValue);
    const rosterHtml = rosterTemplate({ roster: rosterRows });
    const customers = (data.customers || []).map(customer => ({
        ...customer,
        email: customer.email || "",
        lookupLabel: `${customer.fullName}${customer.email ? ` (${customer.email})` : ""}`
    }));

    const modalMarkup = calendarModalTemplate({
        ...item,
        timeRange,
        startLabel: formatFullDate(start, timeZone),
        statusLabel: statusValue,
        statuses,
        rooms,
        instructors,
        shareUrl,
        rosterHtml,
        customers,
        capacitySummary,
        remoteCapacity: remoteCapacityValue,
        remoteInviteUrl: item.remoteInviteUrl || "",
        hasRemoteCapacity: remoteCapacityValue > 0
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    const closeBtn = overlay.querySelector("#close-modal");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const editSeriesBtn = overlay.querySelector("#edit-series");
    if (editSeriesBtn) {
        editSeriesBtn.addEventListener("click", () => {
            closeModal();
            window.location.hash = `#/events?series=${item.eventSeriesId}`;
        });
    }

    const shareCopyBtn = overlay.querySelector("#copy-share-link");
    if (shareCopyBtn) {
        shareCopyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(shareUrl);
                showToast(t("session.shareCopied", "Share link copied."), "success");
            } catch {
                const input = overlay.querySelector(".share-field input");
                if (input) {
                    input.focus();
                    input.select();
                    document.execCommand("copy");
                    showToast(t("session.shareCopied", "Share link copied."), "success");
                } else {
                    showToast(t("session.shareCopyError", "Unable to copy share link."), "error");
                }
            }
        });
    }

    const duplicateBtn = overlay.querySelector("#duplicate-session");
    if (duplicateBtn) {
        duplicateBtn.addEventListener("click", async () => {
            duplicateBtn.disabled = true;
            try {
                let series = null;
                if (item.eventSeriesId) {
                    try {
                        series = await apiGet(`/api/admin/event-series/${item.eventSeriesId}`);
                    } catch {
                        series = null;
                    }
                }

                const start = new Date(item.startUtc);
                const end = item.endUtc ? new Date(item.endUtc) : null;
                const durationMinutes = end
                    ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
                    : (series?.durationMinutes || 60);
                const date = getDateKeyInTimeZone(start, timeZone);
                const startTimeLocal = formatTimeInput(start, timeZone);
                const payload = {
                    title: item.seriesTitle || series?.title || "Session",
                    description: series?.description || "",
                    date,
                    startTimeLocal: `${startTimeLocal}:00`,
                    durationMinutes,
                    instructorId: item.instructorId || null,
                    roomId: item.roomId || null,
                    capacity: Number(item.capacity || series?.defaultCapacity || 0),
                    remoteCapacity: Number(item.remoteCapacity || series?.remoteCapacity || 0),
                    priceCents: Number(item.priceCents || series?.priceCents || 0),
                    currency: item.currency || series?.currency || "ILS",
                    remoteInviteUrl: item.remoteInviteUrl || series?.remoteInviteUrl || "",
                    cancellationWindowHours: Number(series?.cancellationWindowHours || 0),
                    notes: item.notes || "",
                    status: item.status || "Scheduled"
                };

                const created = await apiPost("/api/admin/event-instances", payload);
                const newItem = {
                    ...item,
                    id: created.id || item.id,
                    eventSeriesId: created.eventSeriesId || item.eventSeriesId,
                    startUtc: created.startUtc || item.startUtc,
                    endUtc: created.endUtc || item.endUtc,
                    seriesTitle: series?.title || item.seriesTitle || payload.title,
                    notes: payload.notes,
                    remoteCapacity: payload.remoteCapacity,
                    remoteInviteUrl: payload.remoteInviteUrl
                };
                closeModal();
                await openCalendarEventModal(newItem, data);
            } catch (error) {
                showToast(error.message || t("session.duplicateError", "Unable to duplicate session."), "error");
            } finally {
                duplicateBtn.disabled = false;
            }
        });
    }

    const saveBtn = overlay.querySelector("#save-instance");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const formValues = {};
            ["status", "roomId", "instructorId", "capacity", "remoteCapacity", "priceCents", "remoteInviteUrl"].forEach(field => {
                const element = overlay.querySelector(`[name="${field}"]`);
                formValues[field] = element ? element.value : "";
            });

            await apiPut(`/api/admin/event-instances/${item.id}`, {
                status: formValues.status || statusValue,
                roomId: formValues.roomId || null,
                instructorId: formValues.instructorId || null,
                capacity: Number(formValues.capacity || item.capacity),
                remoteCapacity: Number(formValues.remoteCapacity || item.remoteCapacity || 0),
                priceCents: Number(formValues.priceCents || item.priceCents),
                currency: item.currency || "ILS",
                remoteInviteUrl: formValues.remoteInviteUrl || ""
            });

            closeModal();
            actor.send({ type: "REFRESH" });
        });
    }

    const rosterPanel = overlay.querySelector("[data-roster-panel]");
    const bookedMeta = overlay.querySelector("[data-booked-meta]");
    const capacitySummaryEl = overlay.querySelector("[data-capacity-summary]");
    let currentRosterRows = rosterRows;

    const updateBookedMeta = (rows) => {
        const capacityValue = Number(overlay.querySelector("[name=\"capacity\"]")?.value || item.capacity || 0);
        const remoteCapacityValue = Number(overlay.querySelector("[name=\"remoteCapacity\"]")?.value || item.remoteCapacity || 0);
        const summary = formatCapacitySummary(rows, capacityValue, remoteCapacityValue);
        if (bookedMeta) {
            bookedMeta.textContent = summary;
        }
        if (capacitySummaryEl) {
            capacitySummaryEl.textContent = summary;
        }
    };

    ["capacity", "remoteCapacity"].forEach(name => {
        const input = overlay.querySelector(`[name="${name}"]`);
        if (input) {
            input.addEventListener("input", () => updateBookedMeta(currentRosterRows));
        }
    });

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

        if (rosterEmailBtn) {
            rosterEmailBtn.addEventListener("click", () => {
                const emails = getSelectedRoster()
                    .map(row => row.email)
                    .filter(email => email);
                if (emails.length === 0) return;
                window.location.href = `mailto:${emails.join(",")}`;
            });
        }

        if (rosterSmsBtn) {
            rosterSmsBtn.addEventListener("click", () => {
                const phones = getSelectedRoster()
                    .map(row => row.phone)
                    .filter(phone => phone);
                if (phones.length === 0) return;
                window.location.href = `sms:${phones.join(",")}`;
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

    if (customerLookupInput && customerIdInput) {
        customerLookupInput.addEventListener("input", syncCustomerLookup);
        customerLookupInput.addEventListener("change", syncCustomerLookup);
    }

    const registerBtn = overlay.querySelector("#register-customer");
    if (registerBtn) {
        registerBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const fullName = getValue("fullName").trim();
            const email = getValue("email").trim();
            const phone = getValue("phone").trim();
            const attendanceType = getValue("attendanceType");
            const isRemote = attendanceType === "remote";
            const customerId = customerIdInput?.value || resolveCustomerId(customerLookupInput?.value || "");

            if (!customerId && (!fullName || !email)) {
                showToast(t("session.registerValidation", "Select a customer or enter name and email."), "error");
                return;
            }

            const currentUser = actor.getSnapshot()?.context?.user || {};
            const roleList = currentUser.roles || [currentUser.role];
            const isAdmin = roleList.includes("Admin");
            const sendRegistration = async (overrideHealthWaiver) =>
                apiPost(`/api/admin/event-instances/${item.id}/registrations`, {
                    customerId: customerId || null,
                    fullName,
                    email,
                    phone,
                    membershipId: null,
                    isRemote,
                    overrideHealthWaiver: Boolean(overrideHealthWaiver)
                });

            registerBtn.disabled = true;
            try {
                const result = await sendRegistration(false);

                if (result?.customer?.id && !customerList.some(entry => entry.id === result.customer.id)) {
                    const created = {
                        id: result.customer.id,
                        fullName: result.customer.fullName,
                        email: result.customer.email || "",
                        lookupLabel: `${result.customer.fullName}${result.customer.email ? ` (${result.customer.email})` : ""}`
                    };
                    customerList.push(created);
                    const list = overlay.querySelector("#customer-list");
                    if (list) {
                        const option = document.createElement("option");
                        option.value = created.lookupLabel;
                        option.setAttribute("data-customer-id", created.id);
                        list.appendChild(option);
                    }
                }

                if (customerLookupInput) customerLookupInput.value = "";
                if (customerIdInput) customerIdInput.value = "";
                const fullNameInput = overlay.querySelector("[name=\"fullName\"]");
                const emailInput = overlay.querySelector("[name=\"email\"]");
                const phoneInput = overlay.querySelector("[name=\"phone\"]");
                const attendanceInput = overlay.querySelector("[name=\"attendanceType\"]");
                if (fullNameInput) fullNameInput.value = "";
                if (emailInput) emailInput.value = "";
                if (phoneInput) phoneInput.value = "";
                if (attendanceInput) attendanceInput.value = "in-person";
                showToast(t("session.registered", "Customer registered."), "success");
                await refreshRoster();
            } catch (error) {
                const message = error.message || "";
                if (message === "Health declaration required" && isAdmin) {
                    const confirmOverride = window.confirm(t("session.healthOverrideConfirm", "Health waiver not signed. Register anyway?"));
                    if (confirmOverride) {
                        try {
                            const result = await sendRegistration(true);
                            if (result?.customer?.id && !customerList.some(entry => entry.id === result.customer.id)) {
                                const created = {
                                    id: result.customer.id,
                                    fullName: result.customer.fullName,
                                    email: result.customer.email || "",
                                    lookupLabel: `${result.customer.fullName}${result.customer.email ? ` (${result.customer.email})` : ""}`
                                };
                                customerList.push(created);
                                const list = overlay.querySelector("#customer-list");
                                if (list) {
                                    const option = document.createElement("option");
                                    option.value = created.lookupLabel;
                                    option.setAttribute("data-customer-id", created.id);
                                    list.appendChild(option);
                                }
                            }
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
            } finally {
                registerBtn.disabled = false;
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
    const modalMarkup = sessionModalTemplate({
        focusDate,
        rooms: data.rooms || [],
        instructors: data.instructors || []
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

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
        if (dateInput) dateInput.value = options.date;
        if (startDateInput) startDateInput.value = options.date;
        const dayOfWeekInput = overlay.querySelector("[name=\"dayOfWeek\"]");
        if (dayOfWeekInput) {
            const dateValue = parseDateInput(options.date);
            dayOfWeekInput.value = String(dateValue.getDay());
        }
    }

    const setMode = (mode) => {
        const isRecurring = mode === "recurring";
        if (oneTimeSection) oneTimeSection.classList.toggle("hidden", isRecurring);
        if (recurringSection) recurringSection.classList.toggle("hidden", !isRecurring);
    };

    if (typeSelect) {
        typeSelect.addEventListener("change", () => {
            setMode(typeSelect.value);
        });
    }

    const saveBtn = overlay.querySelector("#save-session");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const type = getValue("sessionType") || "one-time";
            const payload = {
                title: getValue("title"),
                description: getValue("description"),
                instructorId: getValue("instructorId") || null,
                roomId: getValue("roomId") || null,
                startTimeLocal: `${getValue("startTimeLocal")}:00`,
                durationMinutes: Number(getValue("durationMinutes") || 0),      
                capacity: Number(getValue("capacity") || 0),
                remoteCapacity: Number(getValue("remoteCapacity") || 0),
                priceCents: Number(getValue("priceCents") || 0),
                currency: getValue("currency") || "ILS",
                remoteInviteUrl: getValue("remoteInviteUrl") || "",
                cancellationWindowHours: Number(getValue("cancellationWindowHours") || 0)
            };

            if (!payload.title || !payload.startTimeLocal || payload.durationMinutes <= 0) {
                showToast(t("session.requiredFields", "Title, time, and duration are required."), "error");
                return;
            }

            try {
                if (type === "recurring") {
                    const startDate = getValue("startDate") || focusDate;
                    const dayOfWeek = Number(getValue("dayOfWeek"));
                    const recurrenceIntervalWeeks = Number(getValue("recurrenceIntervalWeeks") || 1);
                    const generateWeeks = Number(getValue("generateWeeks") || 8);

                    const series = await apiPost("/api/admin/event-series", {
                        title: payload.title,
                        description: payload.description || "",
                        instructorId: payload.instructorId,
                        roomId: payload.roomId,
                        dayOfWeek,
                        startTimeLocal: payload.startTimeLocal,
                        durationMinutes: payload.durationMinutes,
                        recurrenceIntervalWeeks,
                        defaultCapacity: payload.capacity,
                        remoteCapacity: payload.remoteCapacity,
                        priceCents: payload.priceCents,
                        currency: payload.currency,
                        remoteInviteUrl: payload.remoteInviteUrl,
                        cancellationWindowHours: payload.cancellationWindowHours,
                        isActive: true
                    });

                    const toDate = new Date(startDate);
                    toDate.setDate(toDate.getDate() + generateWeeks * 7);
                    const to = toDateInputValue(toDate);
                    await apiPost(`/api/admin/event-series/${series.id}/generate-instances?from=${startDate}&to=${to}`, {});
                } else {
                    const date = getValue("date") || focusDate;
                    await apiPost("/api/admin/event-instances", {
                        title: payload.title,
                        description: payload.description || "",
                        date,
                        startTimeLocal: payload.startTimeLocal,
                        durationMinutes: payload.durationMinutes,
                        instructorId: payload.instructorId,
                        roomId: payload.roomId,
                        capacity: payload.capacity,
                        remoteCapacity: payload.remoteCapacity,
                        priceCents: payload.priceCents,
                        currency: payload.currency,
                        remoteInviteUrl: payload.remoteInviteUrl,
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

    setMode("one-time");
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
        const start = new Date(item.startUtc);
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

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

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

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

function openCustomerModal(customer, data) {
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
        firstName: customer?.firstName || "",
        lastName: customer?.lastName || "",
        email: customer?.email || "",
        phone: customer?.phone || "",
        idNumber: customer?.idNumber || "",
        genderOptions,
        dateOfBirth: customer?.dateOfBirth || "",
        city: customer?.city || "",
        address: customer?.address || "",
        occupation: customer?.occupation || "",
        signedHealthView: customer?.signedHealthView || false,
        statusOptions,
        tags: customer?.tags ?? formatTags(customer?.tagsJson),
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

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

    const saveBtn = overlay.querySelector("#save-customer");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const fullName = getValue("fullName").trim();
            const firstName = getValue("firstName").trim();
            const lastName = getValue("lastName").trim();
            const email = getValue("email").trim();
            const phone = getValue("phone").trim();
            const idNumber = getValue("idNumber").trim();
            const gender = getValue("gender");
            const dateOfBirth = getValue("dateOfBirth");
            const city = getValue("city").trim();
            const address = getValue("address").trim();
            const occupation = getValue("occupation").trim();
            const signedHealthView = getValue("signedHealthView") === "true";   
            const statusId = getValue("statusId") || null;
            const tags = serializeTags(getValue("tags"));
            const isArchived = getValue("isArchived") === "true";
            const password = getValue("password");

            if (!fullName || !email) {
                showToast(t("customer.required", "Full name and email are required."), "error");
                return;
            }

            try {
                if (isEdit && customer?.id) {
                    await apiPut(`/api/admin/customers/${customer.id}`, {       
                        fullName,
                        firstName,
                        lastName,
                        email,
                        phone,
                        idNumber,
                        gender,
                        dateOfBirth: dateOfBirth || null,
                        city,
                        address,
                        occupation,
                        signedHealthView,
                        statusId,
                        tags,
                        isArchived
                    });
                } else {
                    await apiPost("/api/admin/customers", {
                        fullName,
                        firstName,
                        lastName,
                        email,
                        phone,
                        idNumber,
                        gender,
                        dateOfBirth: dateOfBirth || null,
                        city,
                        address,
                        occupation,
                        signedHealthView,
                        statusId,
                        tags,
                        password: password || null
                    });
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

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
        address: userItem?.address || "",
        idNumber: userItem?.idNumber || "",
        genderOptions,
        roleOptions,
        isActive: userItem?.isActive !== false,
        instructorDisplayName: userItem?.instructorName || "",
        instructorBio: userItem?.instructorBio || "",
        instructorRateCents: userItem?.instructorRateCents ?? 0,
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

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

    const saveBtn = overlay.querySelector("#save-user");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const displayName = getValue("displayName").trim();
            const email = getValue("email").trim();
            const phone = getValue("phone").trim();
            const address = getValue("address").trim();
            const gender = getValue("gender");
            const idNumber = getValue("idNumber").trim();
            const roles = readRoles();
            const isActive = getValue("isActive") !== "false";
            const instructorDisplayName = getValue("instructorDisplayName");    
            const instructorBio = getValue("instructorBio");
            const instructorRateCents = Number(getValue("instructorRateCents") || 0);
            const instructorRateUnit = getValue("instructorRateUnit") || "Session";
            const instructorRateCurrency = getValue("instructorRateCurrency").trim();
            const password = getValue("password");

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
                address,
                gender,
                idNumber,
                role: primaryRole,
                roles,
                isActive,
                instructorDisplayName: instructorDisplayName || null,
                instructorBio: instructorBio || null,
                instructorRateCents: Number.isFinite(instructorRateCents) ? instructorRateCents : 0,
                instructorRateUnit,
                instructorRateCurrency: instructorRateCurrency || "ILS",
                password: password || null
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

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
        roomName: room?.name || ""
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    const closeBtn = overlay.querySelector("#close-room");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-room");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const name = overlay.querySelector("[name=\"roomName\"]")?.value.trim() || "";
            if (!name) {
                showToast(t("room.nameRequired", "Room name is required."), "error");
                return;
            }
            try {
                if (isEdit && room?.id) {
                    await apiPut(`/api/admin/rooms/${room.id}`, { name });
                } else {
                    await apiPost("/api/admin/rooms", { name });
                }
                closeModal();
                actor.send({ type: "REFRESH" });
            } catch (error) {
                showToast(error.message || t("room.saveError", "Unable to save room."), "error");
            }
        });
    }
}

function openPlanModal(plan) {
    const existing = document.getElementById("plan-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(plan?.id);
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
        priceCents: plan?.priceCents ?? 12000,
        currency: plan?.currency || "ILS",
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    const closeBtn = overlay.querySelector("#close-plan");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    const saveBtn = overlay.querySelector("#save-plan");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value || "";
            const name = getValue("planName").trim();
            const type = getValue("planType");
            const weeklyLimit = Number(getValue("weeklyLimit"));
            const punchCardUses = Number(getValue("punchCardUses"));
            const priceCents = Number(getValue("priceCents"));
            const currency = getValue("currency").trim() || "ILS";
            const active = getValue("planActive") === "true";

            if (!name) {
                showToast(t("plans.nameRequired", "Plan name is required."), "error");
                return;
            }

            const payload = {
                name,
                type,
                weeklyLimit: Number.isFinite(weeklyLimit) ? weeklyLimit : 0,
                punchCardUses: Number.isFinite(punchCardUses) ? punchCardUses : 0,
                priceCents: Number.isFinite(priceCents) ? priceCents : 0,
                currency,
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

function openSeriesModal(series, data) {
    const existing = document.getElementById("series-modal");
    if (existing) {
        clearModalEscape();
        existing.remove();
    }

    const isEdit = Boolean(series?.id);
    const dayNames = getWeekdayNames(0);
    const selectedDay = series?.dayOfWeek ?? 2;
    const dayOptions = [
        { value: 1, label: dayNames[1] || t("weekday.monday", "Monday"), selected: selectedDay === 1 },
        { value: 2, label: dayNames[2] || t("weekday.tuesday", "Tuesday"), selected: selectedDay === 2 },
        { value: 3, label: dayNames[3] || t("weekday.wednesday", "Wednesday"), selected: selectedDay === 3 },
        { value: 4, label: dayNames[4] || t("weekday.thursday", "Thursday"), selected: selectedDay === 4 },
        { value: 5, label: dayNames[5] || t("weekday.friday", "Friday"), selected: selectedDay === 5 },
        { value: 6, label: dayNames[6] || t("weekday.saturday", "Saturday"), selected: selectedDay === 6 },
        { value: 0, label: dayNames[0] || t("weekday.sunday", "Sunday"), selected: selectedDay === 0 }
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
    const plans = (data.plans || []).map(plan => ({
        ...plan,
        price: formatMoney(plan.priceCents, plan.currency),
        selected: allowedSet.has(String(plan.id))
    }));
    const modalMarkup = seriesModalTemplate({
        modalTitle: isEdit ? t("series.editTitle", "Edit series") : t("series.newTitle", "New series"),
        subtitle: isEdit
            ? t("series.editSubtitle", "Update weekly schedule settings.")
            : t("series.newSubtitle", "Create a weekly series."),
        seriesId: series?.id || "",
        titleValue: series?.title || "Studio Flow",
        icon: series?.icon || "",
        color: ensureHexColor(series?.color || "#f59e0b", "#f59e0b"),
        dayOptions,
        startTimeLocal: (series?.startTimeLocal || "18:00").slice(0, 5),
        durationMinutes: series?.durationMinutes ?? 60,
        defaultCapacity: series?.defaultCapacity ?? 14,
        remoteCapacity: series?.remoteCapacity ?? 0,
        priceCents: series?.priceCents ?? 2500,
        remoteInviteUrl: series?.remoteInviteUrl || "",
        description: series?.description || "",
        recurrenceIntervalWeeks: series?.recurrenceIntervalWeeks ?? 1,
        cancellationWindowHours: series?.cancellationWindowHours ?? 6,
        isActive: series?.isActive ?? true,
        rooms,
        instructors,
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
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    const closeBtn = overlay.querySelector("#close-series");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    bindColorField(overlay.querySelector(".color-field"));

    const saveBtn = overlay.querySelector("#save-series");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const getValue = (name) => overlay.querySelector(`[name="${name}"]`)?.value ?? "";
            const startTimeValue = getValue("startTimeLocal");
            const startTimeLocal = startTimeValue.length === 5 ? `${startTimeValue}:00` : startTimeValue;
            const allowedPlanIds = Array.from(overlay.querySelectorAll("input[name=\"planIds\"]:checked"))
                .map(input => input.value)
                .filter(Boolean);
            const payload = {
                title: getValue("title"),
                icon: getValue("icon"),
                color: getValue("color") || "#f59e0b",
                description: getValue("description") || "",
                instructorId: getValue("instructorId") || null,
                roomId: getValue("roomId") || null,
                dayOfWeek: Number(getValue("dayOfWeek")),
                startTimeLocal,
                durationMinutes: Number(getValue("durationMinutes")),
                recurrenceIntervalWeeks: Number(getValue("recurrenceIntervalWeeks") || 1),
                defaultCapacity: Number(getValue("capacity") || 0),
                remoteCapacity: Number(getValue("remoteCapacity") || 0),
                priceCents: Number(getValue("priceCents") || 0),
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
        const nextRange = addDays(focus, 14);
        return { from: formatDateKeyLocal(focus), to: formatDateKeyLocal(nextRange) };
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
    const eventMap = buildEventMap(items, timeZone);
    const todayKey = getDateKeyInTimeZone(new Date(), timeZone);

    const dayDate = parseDateInput(focusDate);
    const dayKey = formatDateKeyLocal(dayDate);
    const dayEvents = eventMap.get(dayKey) || [];
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
        const events = eventMap.get(key) || [];
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
            const events = eventMap.get(key) || [];
            const previews = events.slice(0, 3).map(event => ({
                id: event.id,
                time: event.startTime,
                title: event.seriesTitle,
                isCancelled: event.isCancelled,
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
    const searchTerm = (options.search || "").trim().toLowerCase();
    const listItems = [];
    eventMap.forEach(list => {
        list.forEach(event => {
            const dateLabel = formatShortDate(event.startUtc);
            const booked = Number(event.booked || 0);
            const capacity = Number(event.capacity || 0);
            const remoteBooked = Number(event.remoteBooked || 0);
            const remoteCapacity = Number(event.remoteCapacity || 0);
            const bookedSummary = event.isHoliday
                ? t("calendar.list.na", "-")
                : (remoteCapacity > 0
                    ? `${booked} / ${capacity} • ${remoteBooked} / ${remoteCapacity}`
                    : `${booked} / ${capacity}`);
            const searchText = [
                event.seriesTitle,
                event.instructorName,
                event.roomName
            ].filter(Boolean).join(" ").toLowerCase();
            listItems.push({
                ...event,
                dateLabel,
                bookedSummary,
                searchText
            });
        });
    });
    listItems.sort((a, b) => new Date(a.startUtc) - new Date(b.startUtc));
    const filteredItems = searchTerm
        ? listItems.filter(item => item.searchText.includes(searchTerm))
        : listItems;

    return {
        view,
        focusDate,
        rangeLabel,
        isDay: view === "day",
        isWeek: view === "week",
        isMonth: view === "month",
        isList: view === "list",
        search: options.search || "",
        day,
        week: { days: weekDays },
        month: { weeks: monthWeeks, weekdays: weekdayNames },
        list: { items: filteredItems, hasItems: filteredItems.length > 0 }
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
    items.forEach(item => {
        const start = new Date(item.startUtc);
        const end = item.endUtc ? new Date(item.endUtc) : null;
        const dateKey = getDateKeyInTimeZone(start, timeZone);
        const isHoliday = Boolean(item.isHoliday);
        const startTime = isHoliday ? t("calendar.allDay", "All day") : formatTimeOnly(start, timeZone);
        const endTime = isHoliday || !end ? "" : formatTimeOnly(end, timeZone);
        const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
        const statusLabel = normalizeStatus(item.status);
        const isCancelled = String(item.status) === "Cancelled" || item.status === 1;
        const eventStyle = item.seriesColor ? `--series-color: ${item.seriesColor};` : "";
        const event = {
            ...item,
            dateKey,
            startTime,
            endTime,
            timeRange,
            statusLabel,
            isCancelled,
            isHoliday,
            price: formatMoney(item.priceCents, item.currency),
            eventStyle
        };
        const list = map.get(dateKey) || [];
        list.push(event);
        map.set(dateKey, list);
    });

    map.forEach(list => list.sort((a, b) => new Date(a.startUtc) - new Date(b.startUtc)));
    return map;
}

function getRangeLabel(view, focusDate, weekStartsOn, timeZone) {
    const focus = parseDateInput(focusDate);

    if (view === "day") {
        return formatFullDate(focus, timeZone);
    }

    if (view === "list") {
        const end = addDays(focus, 13);
        return `${formatMonthDay(focus, timeZone)} - ${formatMonthDay(end, timeZone)}`;
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
        return formatDateKeyLocal(addDays(focus, direction * 14));
    }

    if (view === "month") {
        const next = new Date(focus.getFullYear(), focus.getMonth() + direction, 1, 12);
        return formatDateKeyLocal(next);
    }

    return formatDateKeyLocal(addDays(focus, direction * 7));
}

function parseDateInput(value) {
    if (!value) {
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        return now;
    }
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12);
}

function formatDateKeyLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function bindCalendarInteractions(data, itemMap) {
    const calendarMeta = data.calendar || {};
    const timeZone = getLocalTimeZone();
    const dropZones = document.querySelectorAll(".calendar-dropzone[data-date]");

    document.querySelectorAll(".calendar-event[data-event]").forEach(card => {
        const id = card.getAttribute("data-event") || "";
        card.addEventListener("dragstart", (event) => {
            if (!event.dataTransfer || !id) return;
            event.dataTransfer.setData("text/plain", id);
            event.dataTransfer.effectAllowed = "move";
            card.classList.add("dragging");
        });
        card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
        });
    });

    dropZones.forEach(zone => {
        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.classList.add("drag-over");
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
            if (!item || item.isHoliday) return;
            const currentKey = getDateKeyInTimeZone(new Date(item.startUtc), timeZone);
            if (currentKey === dateKey) return;
            try {
                await moveEventInstance(item, dateKey);
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

async function moveEventInstance(item, dateKey) {
    const start = new Date(item.startUtc);
    const end = item.endUtc ? new Date(item.endUtc) : null;
    const durationMs = end ? end.getTime() - start.getTime() : null;
    const targetDate = parseDateInput(dateKey);
    start.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const payload = {
        startUtc: start.toISOString(),
        instructorId: item.instructorId || null,
        roomId: item.roomId || null
    };
    if (durationMs !== null) {
        payload.endUtc = new Date(start.getTime() + durationMs).toISOString();
    }
    await apiPut(`/api/admin/event-instances/${item.id}`, payload);
}

function getDateKeyInTimeZone(value, timeZone) {
    const date = value instanceof Date ? value : new Date(value);
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

function formatTimeOnly(date, timeZone) {
    return new Intl.DateTimeFormat("he-IL", {
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

function formatTimeInput(date, timeZone) {
    const parts = new Intl.DateTimeFormat("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    const hour = parts.find(part => part.type === "hour")?.value ?? "00";
    const minute = parts.find(part => part.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
}

function formatMonthDay(date, timeZone) {
    return new Intl.DateTimeFormat("he-IL", {
        month: "short",
        day: "numeric"
    }).format(date);
}

function formatFullDate(date, timeZone) {
    return new Intl.DateTimeFormat("he-IL", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function formatMonthYear(date, timeZone) {
    return new Intl.DateTimeFormat("he-IL", {
        month: "long",
        year: "numeric"
    }).format(date);
}

function getWeekdayNames(weekStartsOn) {
    const base = new Date(2024, 0, 7, 12);
    const names = Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat("he-IL", { weekday: "short" }).format(addDays(base, index)));
    return names.slice(weekStartsOn).concat(names.slice(0, weekStartsOn));
}

actor.subscribe((state) => {
    render(state);
});

actor.start();

const adminRoutes = new Set(["calendar", "events", "rooms", "plans", "customers", "users", "guests", "reports", "payroll", "audit", "settings"]);

function resolveRouteFromHash(defaultRoute) {
    const hash = window.location.hash || `#/${defaultRoute}`;
    const cleaned = hash.replace(/^#\/?/, "");
    const [path] = cleaned.split("?");
    const route = path.split("/")[0] || defaultRoute;
    return adminRoutes.has(route) ? route : defaultRoute;
}

function handleRouteChange() {
    const route = resolveRouteFromHash("calendar");
    actor.send({ type: "NAVIGATE", route });
}

window.addEventListener("hashchange", handleRouteChange);
handleRouteChange();





