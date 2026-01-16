import { createMachine, createActor, fromPromise, assign } from "xstate";
import Handlebars from "handlebars";
import { apiGet } from "../shared/api.js";
import { formatDateTime, formatMoney, getStudioSlugFromPath } from "../shared/utils.js";

const root = document.getElementById("app");
const slug = getStudioSlugFromPath() || "demo";

const template = Handlebars.compile(`
  <header>
    <div>
      <h1>{{studio.name}}</h1>
      <div class="meta">Public schedule - {{studio.slug}}</div>
    </div>
    <button id="open-app">Open app</button>
  </header>
  <div class="surface">
    <div class="grid">
      {{#each items}}
        <div class="card">
          <h3>{{seriesTitle}}</h3>
          <div class="meta">{{start}} - {{roomName}}</div>
          <div class="meta">Instructor: {{instructorName}}</div>
          <div class="meta">{{availability}}</div>
          <div class="meta">{{price}}</div>
          <button data-event="{{id}}">Reserve</button>
        </div>
      {{/each}}
    </div>
  </div>
`);

const machine = createMachine({
    id: "public",
    initial: "loading",
    context: { studio: null, items: [], error: "" },
    states: {
        loading: {
            invoke: {
                src: "load",
                onDone: {
                    target: "ready",
                    actions: "setData"
                },
                onError: {
                    target: "error",
                    actions: "setError"
                }
            }
        },
        ready: {},
        error: {}
    }
}, {
    actions: {
        setData: assign(({ context, event }) => ({
            ...context,
            studio: event.output.studio,
            items: event.output.items,
            error: ""
        })),
        setError: assign(({ context, event }) => ({
            ...context,
            error: event.error?.message || "Unable to load"
        }))
    },
    actors: {
        load: fromPromise(async () => {
            const studio = await apiGet(`/api/public/studios/${slug}`);
            const from = new Date().toISOString().slice(0, 10);
            const toDate = new Date();
            toDate.setDate(toDate.getDate() + 14);
            const to = toDate.toISOString().slice(0, 10);
            const items = await apiGet(`/api/public/studios/${slug}/schedule?from=${from}&to=${to}`);
            return { studio, items };
        })
    }
});

const actor = createActor(machine);

actor.subscribe((state) => {
    if (state.matches("error")) {
        root.innerHTML = `<div class="surface">${state.context.error}</div>`;
        return;
    }

    if (!state.context.studio) return;

    const items = (state.context.items || []).map(item => ({
        ...item,
        start: formatDateTime(item.startUtc, state.context.studio.timezone),
        availability: `${item.available} spots left`,
        price: formatMoney(item.priceCents, item.currency)
    }));

    root.innerHTML = template({ studio: state.context.studio, items });

    const openApp = document.getElementById("open-app");
    if (openApp) {
        openApp.addEventListener("click", () => {
            window.location.href = `/app#/schedule?studio=${slug}`;
        });
    }

    document.querySelectorAll("button[data-event]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-event");
            window.location.href = `/app#/event/${id}?studio=${slug}`;
        });
    });
});

actor.start();




