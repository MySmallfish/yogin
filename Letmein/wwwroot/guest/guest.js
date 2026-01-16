import { apiGet } from "../shared/api.js";
import { login, logout, getSession, loadSessionHint, consumeForceLogout } from "../shared/auth.js";
import { compileTemplate } from "../shared/templates.js";
import { formatMoney, toDateInputValue } from "../shared/utils.js";

const root = document.getElementById("app");
const sessionHint = loadSessionHint();

const loginTemplate = compileTemplate("guest-login", `
  <div class="login-shell">
    <div class="login-card">
      <h1>Guest access</h1>
      <p>View the studio schedule.</p>
      {{#if error}}
        <div class="notice">{{error}}</div>
      {{/if}}
      <form id="login-form">
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password</label>
        <input type="password" name="password" required />
        <label>Studio slug</label>
        <input type="text" name="studioSlug" required value="{{studioSlug}}" />
        <label>Role</label>
        <select name="role">
          <option value="guest">Guest</option>
        </select>
        <div style="margin-top:16px;">
          <button type="submit">Log in</button>
        </div>
      </form>
    </div>
  </div>
`);

const layoutTemplate = compileTemplate("guest-layout", `
  <div class="portal-shell">
    <div class="portal-header">
      <div class="portal-title">
        <h1>Guest Calendar</h1>
        <div class="muted">{{studioName}} · Read-only view</div>
      </div>
      <button class="secondary" id="logout-btn">Log out</button>
    </div>
    <div class="surface">
      {{{content}}}
    </div>
  </div>
`);

const calendarTemplate = compileTemplate("guest-calendar", `
  <div class="notice">All sessions are view-only.</div>
  <div class="calendar-toolbar">
    <div class="calendar-views">
      <button class="secondary {{#if isDay}}active{{/if}}" data-view="day">Day</button>
      <button class="secondary {{#if isWeek}}active{{/if}}" data-view="week">Week</button>
      <button class="secondary {{#if isMonth}}active{{/if}}" data-view="month">Month</button>
    </div>
    <div class="calendar-nav">
      <button class="secondary" data-nav="prev">Prev</button>
      <input type="date" id="calendar-date" value="{{focusDate}}" />
      <button class="secondary" data-nav="next">Next</button>
    </div>
    <div class="calendar-range">{{rangeLabel}}</div>
  </div>
  <div class="calendar-body">
    {{#if isDay}}
      <div class="calendar-day">
        <div class="calendar-day-header">{{day.label}}</div>
        {{#if day.hasEvents}}
          <div class="calendar-events">
            {{#each day.events}}
              <div class="calendar-event {{#if isCancelled}}cancelled{{/if}} {{#if isHoliday}}holiday{{/if}}" data-event="{{id}}">
                <div class="event-time">{{timeRange}}</div>
                <div class="event-title">{{seriesTitle}}</div>
                <div class="event-meta">{{roomName}} · {{instructorName}}</div>
                <div class="event-meta">{{booked}} / {{capacity}} · {{price}}</div>
              </div>
            {{/each}}
          </div>
        {{else}}
          <div class="empty-state">No classes scheduled.</div>
        {{/if}}
      </div>
    {{/if}}
    {{#if isWeek}}
      <div class="calendar-week">
        {{#each week.days}}
          <div class="calendar-day-column {{#if isToday}}today{{/if}}">
            <div class="calendar-day-label">
              <span>{{weekday}}</span>
              <span class="date">{{dateLabel}}</span>
            </div>
            <div class="calendar-day-events">
              {{#if hasEvents}}
                {{#each events}}
                  <div class="calendar-event compact {{#if isCancelled}}cancelled{{/if}} {{#if isHoliday}}holiday{{/if}}" data-event="{{id}}">
                    <div class="event-time">{{timeRange}}</div>
                    <div class="event-title">{{seriesTitle}}</div>
                    <div class="event-meta">{{instructorName}}</div>
                  </div>
                {{/each}}
              {{else}}
                <div class="empty-state">No classes</div>
              {{/if}}
            </div>
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
              <div class="calendar-month-day {{#unless isCurrentMonth}}muted{{/unless}} {{#if isToday}}today{{/if}}">
                <div class="calendar-month-day-header">{{label}}</div>
                <div class="calendar-month-events">
                  {{#each eventsPreview}}
                    <div class="calendar-event mini {{#if isCancelled}}cancelled{{/if}} {{#if isHoliday}}holiday{{/if}}" data-event="{{id}}">
                      <span>{{time}}</span>
                      <span>{{title}}</span>
                    </div>
                  {{/each}}
                </div>
                {{#if moreCount}}
                  <div class="more-indicator">+{{moreCount}} more</div>
                {{/if}}
              </div>
            {{/each}}
          {{/each}}
        </div>
      </div>
    {{/if}}
  </div>
`);

const modalTemplate = compileTemplate("guest-modal", `
  <div class="modal-overlay" id="guest-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>{{seriesTitle}}</h2>
          <div class="muted">{{dateLabel}} · {{timeRange}}</div>
        </div>
        <div class="modal-actions">
          <span class="pill readonly">Read-only</span>
          <button class="secondary" id="close-modal">Close</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="meta-grid">
          <div>
            <label>Room</label>
            <div>{{roomName}}</div>
          </div>
          <div>
            <label>Instructor</label>
            <div>{{instructorName}}</div>
          </div>
          <div>
            <label>Capacity</label>
            <div>{{booked}} / {{capacity}}</div>
          </div>
          <div>
            <label>Price</label>
            <div>{{price}}</div>
          </div>
        </div>
        {{#if notes}}
          <div class="section-title">Notes</div>
          <div class="readonly-note">{{notes}}</div>
        {{/if}}
      </div>
    </div>
  </div>
`);

const state = {
    view: "week",
    focusDate: toDateInputValue(new Date()),
    items: [],
    studio: null
};

async function init() {
    try {
        if (consumeForceLogout()) {
            renderLogin();
            return;
        }
        const session = await getSession();
        const role = (session?.user?.role || "").toLowerCase();
        if (!["guest", "admin"].includes(role)) {
            await logout();
            renderLogin("Guest access required.");
            return;
        }
        await loadCalendar();
        render();
    } catch (error) {
        renderLogin(error.message || "Unable to load guest portal.");
    }
}

function renderLogin(error) {
    root.innerHTML = loginTemplate({ error, studioSlug: sessionHint.studioSlug || "demo" });
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
            await login(payload);
            await loadCalendar();
            render();
        } catch (err) {
            renderLogin(err.message || "Unable to sign in.");
        }
    });
}

async function loadCalendar() {
    const studio = await apiGet("/api/guest/studio");
    const range = getCalendarRange(state.view, state.focusDate, studio.weekStartsOn ?? 0);
    const items = await apiGet(`/api/guest/calendar?from=${range.from}&to=${range.to}`);
    state.studio = studio;
    state.items = items || [];
    state.range = range;
}

function render() {
    if (!state.studio) {
        renderLogin("Studio access required.");
        return;
    }

    const viewState = buildCalendarView(state.items, {
        view: state.view,
        focusDate: state.focusDate,
        timeZone: state.studio.timezone || "UTC",
        weekStartsOn: state.studio.weekStartsOn ?? 0
    });

    root.innerHTML = layoutTemplate({
        studioName: state.studio.name,
        content: calendarTemplate(viewState)
    });

    bindCalendarActions();
}

function bindCalendarActions() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await logout();
            const baseUrl = `${window.location.pathname}${window.location.search}`;
            window.location.href = baseUrl;
        });
    }

    const viewButtons = document.querySelectorAll("button[data-view]");
    const navButtons = document.querySelectorAll("button[data-nav]");
    const dateInput = document.getElementById("calendar-date");
    const itemMap = new Map((state.items || []).map(item => [String(item.id), item]));

    viewButtons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const view = btn.getAttribute("data-view") || "week";
            state.view = view;
            state.focusDate = dateInput?.value || state.focusDate;
            await loadCalendar();
            render();
        });
    });

    navButtons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const direction = btn.getAttribute("data-nav") === "prev" ? -1 : 1;
            const baseDate = dateInput?.value || state.focusDate;
            state.focusDate = shiftCalendarDate(state.view, baseDate, direction);
            await loadCalendar();
            render();
        });
    });

    if (dateInput) {
        dateInput.addEventListener("change", async () => {
            state.focusDate = dateInput.value || state.focusDate;
            await loadCalendar();
            render();
        });
    }

    document.querySelectorAll(".calendar-event").forEach(card => {
        card.addEventListener("click", () => {
            const eventId = card.getAttribute("data-event");
            if (!eventId) return;
            const item = itemMap.get(eventId);
            if (!item || item.isHoliday) return;
            openEventModal(item);
        });
    });
}

function openEventModal(item) {
    const existing = document.getElementById("guest-modal");
    if (existing) {
        existing.remove();
    }

    const modalHtml = modalTemplate({
        ...item,
        dateLabel: formatFullDate(new Date(item.startUtc), state.studio.timezone || "UTC")
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalHtml;
    const overlay = wrapper.firstElementChild;
    if (!overlay) return;
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    const closeBtn = overlay.querySelector("#close-modal");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
}

function getCalendarRange(view, focusDate, weekStartsOn) {
    const focus = parseDateInput(focusDate);
    const safeWeekStart = Number.isFinite(Number(weekStartsOn)) ? Number(weekStartsOn) : 0;

    if (view === "day") {
        const nextDay = addDays(focus, 1);
        return { from: formatDateKeyLocal(focus), to: formatDateKeyLocal(nextDay) };
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
                isCancelled: event.isCancelled
            }));
            days.push({
                label: date.getDate(),
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

    return {
        view,
        focusDate,
        rangeLabel,
        isDay: view === "day",
        isWeek: view === "week",
        isMonth: view === "month",
        day,
        week: { days: weekDays },
        month: { weeks: monthWeeks, weekdays: getWeekdayNames(weekStartsOn) }
    };
}

function buildEventMap(items, timeZone) {
    const map = new Map();
    items.forEach(item => {
        const start = new Date(item.startUtc);
        const end = item.endUtc ? new Date(item.endUtc) : null;
        const dateKey = getDateKeyInTimeZone(start, timeZone);
        const startTime = formatTimeOnly(start, timeZone);
        const endTime = end ? formatTimeOnly(end, timeZone) : "";
        const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
        const statusLabel = normalizeStatus(item.status);
        const event = {
            ...item,
            dateKey,
            startTime,
            endTime,
            timeRange,
            statusLabel,
            isCancelled: statusLabel === "Cancelled",
            price: formatMoney(item.priceCents, item.currency)
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
    if (view === "month") {
        const next = new Date(focus.getFullYear(), focus.getMonth() + direction, 1, 12);
        return formatDateKeyLocal(next);
    }
    return formatDateKeyLocal(addDays(focus, direction * 7));
}

function normalizeStatus(value) {
    if (typeof value === "string") {
        return value === "Cancelled" ? "Cancelled" : "Scheduled";
    }
    if (value === 1) {
        return "Cancelled";
    }
    return "Scheduled";
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

function getDateKeyInTimeZone(value, timeZone) {
    const date = value instanceof Date ? value : new Date(value);
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(part => part.type === "year")?.value ?? "0000";
    const month = parts.find(part => part.type === "month")?.value ?? "01";
    const day = parts.find(part => part.type === "day")?.value ?? "01";
    return `${year}-${month}-${day}`;
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

function getWeekdayNames(weekStartsOn) {
    const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    const start = new Date(2021, 7, 1 + weekStartsOn);
    return Array.from({ length: 7 }, (_, index) => formatter.format(addDays(start, index)));
}

function formatMonthDay(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone,
        month: "short",
        day: "numeric"
    }).format(date);
}

function formatFullDate(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function formatMonthYear(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone,
        month: "long",
        year: "numeric"
    }).format(date);
}

function formatTimeOnly(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

init();
