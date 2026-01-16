export function formatDateTime(iso, timeZone) {
    if (!iso) return "";
    const date = new Date(iso);
    return new Intl.DateTimeFormat("he-IL", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

export function formatMoney(cents, currency) {
    const amount = (cents || 0) / 100;
    const safeCurrency = currency || "ILS";
    const currencyParts = new Intl.NumberFormat("he-IL", {
        style: "currency",
        currency: safeCurrency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 0
    }).formatToParts(amount);
    const symbol = currencyParts.find(part => part.type === "currency")?.value || safeCurrency;
    const number = new Intl.NumberFormat("he-IL", {
        maximumFractionDigits: 0
    }).format(amount);
    return `${symbol}${number}`;
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



