import { apiGet, apiPost, apiPut, apiDelete } from "../shared/api.js";
import { login, logout, getSession, loadSessionHint, consumeForceLogout } from "../shared/auth.js";
import { compileTemplate } from "../shared/templates.js";
import { formatMoney, toDateInputValue } from "../shared/utils.js";

const root = document.getElementById("app");
const sessionHint = loadSessionHint();

const loginTemplate = compileTemplate("instructor-login", `
  <div class="login-shell">
    <div class="login-card">
      <h1>Instructor portal</h1>
      <p>See your classes and update attendance.</p>
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
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </select>
        <div style="margin-top:16px;">
          <button type="submit">Log in</button>
        </div>
      </form>
    </div>
  </div>
`);

const layoutTemplate = compileTemplate("instructor-layout", `
  <div class="portal-shell">
    <div class="portal-header">
      <div class="portal-title">
        <h1>Instructor Calendar</h1>
        <div class="muted">{{studioName}} · {{subtitle}}</div>
      </div>
      <button class="secondary" id="logout-btn">Log out</button>
    </div>
    <div class="surface">
      {{{content}}}
    </div>
  </div>
`);

const calendarTemplate = compileTemplate("instructor-calendar", `
  <div class="notice">Your sessions are highlighted. Other classes appear muted.</div>
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
              <div class="calendar-event {{#if isCancelled}}cancelled{{/if}} {{#if isMine}}mine{{else}}muted{{/if}} {{#if isHoliday}}holiday{{/if}} {{#if isBirthday}}birthday{{/if}}" data-event="{{id}}">
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
                  <div class="calendar-event compact {{#if isCancelled}}cancelled{{/if}} {{#if isMine}}mine{{else}}muted{{/if}} {{#if isHoliday}}holiday{{/if}} {{#if isBirthday}}birthday{{/if}}" data-event="{{id}}">
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
                    <div class="calendar-event mini {{#if isCancelled}}cancelled{{/if}} {{#if isMine}}mine{{else}}muted{{/if}} {{#if isHoliday}}holiday{{/if}} {{#if isBirthday}}birthday{{/if}}" data-event="{{id}}">
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

const calendarModalTemplate = compileTemplate("instructor-modal", `
  <div class="modal-overlay" id="instructor-modal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>{{seriesTitle}}</h2>
          <div class="muted">{{dateLabel}} · {{timeRange}}</div>
        </div>
        <div class="modal-actions">
          <span class="pill {{#if isMine}}mine{{else}}readonly{{/if}}">{{ownershipLabel}}</span>
          <button class="modal-close" id="close-modal" type="button" aria-label="Close"></button>
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
        {{#if isMine}}
          <div class="form-grid">
            <div>
              <label>Date</label>
              <input name="date" type="date" value="{{dateValue}}" />
            </div>
            <div>
              <label>Start time</label>
              <input name="startTimeLocal" type="time" value="{{timeValue}}" />
            </div>
            <div>
              <label>Duration (min)</label>
              <input name="durationMinutes" type="number" min="15" step="5" value="{{durationMinutes}}" />
            </div>
            <div>
              <label>Room</label>
              <select name="roomId">
                <option value="">Unassigned</option>
                {{#each rooms}}
                  <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
                {{/each}}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select name="status">
                <option value="Scheduled" {{#if statusScheduled}}selected{{/if}}>Scheduled</option>
                <option value="Cancelled" {{#if statusCancelled}}selected{{/if}}>Cancelled</option>
              </select>
            </div>
            <div style="grid-column: 1 / -1;">
              <label>Notes</label>
              <textarea name="notes" rows="2" placeholder="Class notes">{{notes}}</textarea>
            </div>
          </div>
          <div class="toolbar">
            <button id="save-instance">Save updates</button>
            <button class="secondary" id="report-payroll">Report attendance</button>
          </div>
          <div class="notice" id="payroll-notice" style="display:none;"></div>
          <div class="section-title">Roster</div>
          {{#if rosterError}}
            <div class="notice">{{rosterError}}</div>
          {{else}}
            {{#if rosterEmpty}}
              <div class="readonly-note">No one has registered yet.</div>
            {{else}}
              <table class="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {{#each roster}}
                  <tr>
                    <td>{{customerName}}</td>
                    <td>
                      <a href="mailto:{{email}}">{{email}}</a>
                      <div><a href="tel:{{phone}}">{{phone}}</a></div>
                    </td>
                    <td>
                      <div class="attendance-toggle" data-attendance="{{customerId}}">
                        <button type="button" class="attendance-btn {{#if isRegistered}}active{{/if}}" data-status="Registered" aria-label="Registered" title="Registered">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2" />
                          </svg>
                        </button>
                        <button type="button" class="attendance-btn {{#if isPresent}}active{{/if}}" data-status="Present" aria-label="Present" title="Present">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 12.5l4 4 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </button>
                        <button type="button" class="attendance-btn {{#if isNoShow}}active{{/if}}" data-status="NoShow" aria-label="Missing" title="Missing">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 7l10 10M17 7l-10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {{/each}}
                </tbody>
              </table>
            {{/if}}
          {{/if}}
        {{else}}
          <div class="readonly-note">This class belongs to another instructor.</div>
        {{/if}}
      </div>
    </div>
  </div>
`);

const state = {
    view: "week",
    focusDate: toDateInputValue(new Date()),
    items: [],
    studio: null,
    rooms: []
};

async function init() {
    try {
        if (consumeForceLogout()) {
            renderLogin();
            return;
        }
        const session = await getSession();
        const role = (session?.user?.role || "").toLowerCase();
        if (!["instructor", "admin"].includes(role)) {
            await logout();
            renderLogin("Instructor access required.");
            return;
        }
        await loadCalendar();
        render();
    } catch (error) {
        renderLogin(error.message || "Unable to load instructor portal.");
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
    const studio = await apiGet("/api/instructor/studio");
    const range = getCalendarRange(state.view, state.focusDate, studio.weekStartsOn ?? 0);
    const [items, rooms] = await Promise.all([
        apiGet(`/api/instructor/calendar?from=${range.from}&to=${range.to}`),
        apiGet("/api/instructor/rooms")
    ]);
    state.studio = studio;
    state.items = items || [];
    state.rooms = rooms || [];
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
        subtitle: "All studio sessions with your classes highlighted.",
        content: calendarTemplate(viewState)
    });

    bindCalendarActions(viewState);
}

function bindCalendarActions(viewState) {
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
        card.addEventListener("click", async () => {
            const eventId = card.getAttribute("data-event");
            if (!eventId) return;
            const item = itemMap.get(eventId);
            if (!item || item.isHoliday || item.isBirthday) return;
            await openEventModal(item);
        });
    });
}

async function openEventModal(item) {
    const existing = document.getElementById("instructor-modal");
    if (existing) {
        existing.remove();
    }

    let rosterRows = [];
    let rosterError = "";
    if (item.isMine) {
        try {
            const roster = await apiGet(`/api/instructor/instances/${item.id}/roster`);
            rosterRows = (roster || []).map(row => {
                const status = normalizeAttendanceStatus(row.attendanceStatus);
                return {
                    ...row,
                    isRegistered: row.attendanceStatus == null,
                    isPresent: status === "Present",
                    isNoShow: status === "No-show"
                };
            });
        } catch (error) {
            rosterError = error.message || "Unable to load roster.";
        }
    }

    const statusLabel = normalizeStatus(item.status);
    const timeZone = state.studio.timezone || "UTC";
    const startDate = new Date(item.startUtc);
    const endDate = item.endUtc ? new Date(item.endUtc) : null;
    const dateValue = formatDateInputInTimeZone(startDate, timeZone);
    const timeValue = formatTimeInputInTimeZone(startDate, timeZone);
    const durationMinutes = endDate ? Math.round((endDate - startDate) / 60000) : 60;
    const rooms = (state.rooms || []).map(room => ({
        ...room,
        selected: room.id === item.roomId
    }));
    const modalHtml = calendarModalTemplate({
        ...item,
        dateLabel: formatFullDate(new Date(item.startUtc), state.studio.timezone || "UTC"),
        ownershipLabel: item.isMine ? "My session" : "Read-only",
        statusScheduled: statusLabel === "Scheduled",
        statusCancelled: statusLabel === "Cancelled",
        dateValue,
        timeValue,
        durationMinutes,
        rooms,
        notes: item.notes || "",
        roster: rosterRows,
        rosterEmpty: rosterRows.length === 0,
        rosterError
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

    const saveBtn = overlay.querySelector("#save-instance");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const status = overlay.querySelector("[name=\"status\"]")?.value || "Scheduled";
            const date = overlay.querySelector("[name=\"date\"]")?.value || dateValue;
            const startTimeLocal = overlay.querySelector("[name=\"startTimeLocal\"]")?.value || timeValue;
            const durationValue = Number(overlay.querySelector("[name=\"durationMinutes\"]")?.value || durationMinutes);
            const roomValue = overlay.querySelector("[name=\"roomId\"]")?.value || "";
            const notes = overlay.querySelector("[name=\"notes\"]")?.value ?? "";
            await apiPut(`/api/instructor/instances/${item.id}`, {
                roomId: roomValue ? roomValue : null,
                date,
                startTimeLocal,
                durationMinutes: Number.isFinite(durationValue) ? durationValue : durationMinutes,
                status,
                notes
            });
            closeModal();
            await loadCalendar();
            render();
        });
    }

    const reportBtn = overlay.querySelector("#report-payroll");
    const payrollNotice = overlay.querySelector("#payroll-notice");
    if (reportBtn) {
        reportBtn.addEventListener("click", async () => {
            reportBtn.disabled = true;
            if (payrollNotice) {
                payrollNotice.style.display = "none";
            }
            try {
                await apiPost(`/api/instructor/instances/${item.id}/payroll`, {});
                if (payrollNotice) {
                    payrollNotice.textContent = "Attendance reported for payroll.";
                    payrollNotice.style.display = "block";
                }
            } catch (error) {
                if (payrollNotice) {
                    payrollNotice.textContent = error.message || "Unable to report attendance.";
                    payrollNotice.style.display = "block";
                }
            } finally {
                reportBtn.disabled = false;
            }
        });
    }

    overlay.querySelectorAll(".attendance-toggle").forEach(wrapper => {
        const buttons = Array.from(wrapper.querySelectorAll("button[data-status]"));
        const customerId = wrapper.getAttribute("data-attendance");
        buttons.forEach(btn => {
            btn.addEventListener("click", async () => {
                const status = btn.getAttribute("data-status");
                if (!customerId || !status) return;
                try {
                    if (status === "Registered") {
                        await apiDelete(`/api/instructor/instances/${item.id}/attendance/${customerId}`);
                    } else {
                        await apiPost(`/api/instructor/instances/${item.id}/attendance`, {
                            customerId,
                            status
                        });
                    }
                    buttons.forEach(button => {
                        button.classList.toggle("active", button === btn);
                    });
                } catch (error) {
                    console.error(error);
                }
            });
        });
    });
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
                isCancelled: event.isCancelled,
                isMine: event.isMine,
                isHoliday: event.isHoliday,
                isBirthday: event.isBirthday
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
        const isHoliday = Boolean(item.isHoliday);
        const isBirthday = Boolean(item.isBirthday);
        const isAllDay = isHoliday || isBirthday;
        const startTime = isAllDay ? "All day" : formatTimeOnly(start, timeZone);
        const endTime = isAllDay || !end ? "" : formatTimeOnly(end, timeZone);
        const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
        const statusLabel = normalizeStatus(item.status);
        const birthdayName = item.birthdayName || item.seriesTitle || "";
        const birthdayTitle = birthdayName ? `Birthday: ${birthdayName}` : "Birthday";
        const seriesTitle = isBirthday ? birthdayTitle : item.seriesTitle;
        const event = {
            ...item,
            dateKey,
            startTime,
            endTime,
            timeRange,
            statusLabel,
            isCancelled: statusLabel === "Cancelled",
            isHoliday,
            isBirthday,
            seriesTitle,
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

function normalizeAttendanceStatus(value) {
    if (typeof value === "string") {
        return value === "NoShow" ? "No-show" : value;
    }
    if (value === 0) {
        return "Present";
    }
    if (value === 1) {
        return "No-show";
    }
    return "Registered";
}

function formatDateInputInTimeZone(value, timeZone) {
    return getDateKeyInTimeZone(value, timeZone);
}

function formatTimeInputInTimeZone(value, timeZone) {
    const date = value instanceof Date ? value : new Date(value);
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hour = parts.find(part => part.type === "hour")?.value ?? "00";
    const minute = parts.find(part => part.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
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
