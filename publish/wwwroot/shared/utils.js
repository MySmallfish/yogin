export function formatDateTime(iso, timeZone) {
    if (!iso) return "";
    const date = new Date(iso);
    const options = {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    };
    if (timeZone) {
        options.timeZone = timeZone;
    }
    return new Intl.DateTimeFormat(getLocaleFromSettings(), options).format(date);
}

export function formatMoney(cents, currency) {
    const amount = (cents || 0) / 100;
    const safeCurrency = currency || "ILS";
    const locale = getLocaleFromSettings();
    const currencyParts = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: safeCurrency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 0
    }).formatToParts(amount);
    const symbol = currencyParts.find(part => part.type === "currency")?.value || safeCurrency;
    const number = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0
    }).format(amount);
    return `${symbol}${number}`;
}

function getLocaleFromSettings() {
    const raw = (document?.documentElement?.lang || "").trim().replace("_", "-").toLowerCase();
    if (!raw) return "en-IL";
    if (raw.includes("-")) return raw;
    if (raw === "he") return "he-IL";
    if (raw === "en") return "en-IL";
    return `${raw}-IL`;
}

export function toDateInputValue(date) {
    const value = date || new Date();
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function getStudioSlugFromPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const sIndex = parts.indexOf("s");
    if (sIndex >= 0 && parts.length > sIndex + 1) {
        return parts[sIndex + 1];
    }
    return "";
}

export function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    if (params.has(name)) {
        return params.get(name);
    }

    const hash = window.location.hash || "";
    if (hash.includes("?")) {
        const query = hash.split("?")[1];
        const hashParams = new URLSearchParams(query);
        return hashParams.get(name);
    }

    return null;
}

export function setQueryParam(name, value) {
    const url = new URL(window.location.href);
    if (value) {
        url.searchParams.set(name, value);
    } else {
        url.searchParams.delete(name);
    }
    window.history.replaceState({}, "", url.toString());
}



