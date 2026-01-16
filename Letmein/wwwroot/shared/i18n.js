const stateByNamespace = new Map();
const cache = new Map();
const storagePrefix = "letmein.locale.";
let activeNamespace = "";

function normalizeLocale(value) {
    if (!value) return "";
    return value.trim().replace("_", "-").toLowerCase();
}

function getBaseLocale(value) {
    const normalized = normalizeLocale(value);
    if (!normalized) return "";
    return normalized.split("-")[0];
}

function isRtlLocale(value) {
    const base = getBaseLocale(value);
    return ["ar", "he", "fa", "ur"].includes(base);
}

export function resolveLocale(preferred, fallback, systemLocale) {
    return normalizeLocale(preferred) ||
        normalizeLocale(fallback) ||
        normalizeLocale(systemLocale) ||
        "en";
}

export function getStoredLocale(namespace) {
    if (!namespace) return "";
    return normalizeLocale(localStorage.getItem(`${storagePrefix}${namespace}`));
}

function applyDocumentLocale(locale) {
    const html = document.documentElement;
    if (!html) return;
    html.lang = locale || "en";
    html.dir = isRtlLocale(locale) ? "rtl" : "ltr";
}

async function loadMessages(namespace, locale) {
    const normalized = normalizeLocale(locale) || "en";
    const cacheKey = `${namespace}:${normalized}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const candidates = [];
    if (normalized) candidates.push(normalized);
    const base = getBaseLocale(normalized);
    if (base && base !== normalized) candidates.push(base);
    if (!candidates.includes("en")) candidates.push("en");

    let messages = {};
    for (const candidate of candidates) {
        try {
            const response = await fetch(`/i18n/${namespace}.${candidate}.json`, {
                credentials: "same-origin"
            });
            if (response.ok) {
                messages = await response.json();
                break;
            }
        } catch {
            // ignore and keep fallback
        }
    }

    const result = { locale: normalized, messages };
    cache.set(cacheKey, result);
    return result;
}

export async function setLocale(namespace, locale) {
    const normalized = resolveLocale(locale, "", "en");
    const result = await loadMessages(namespace, normalized);
    stateByNamespace.set(namespace, result);
    activeNamespace = namespace;
    applyDocumentLocale(result.locale);
    if (namespace) {
        localStorage.setItem(`${storagePrefix}${namespace}`, result.locale);
    }
    return result.locale;
}

export function t(key, fallback = "") {
    const state = stateByNamespace.get(activeNamespace);
    const value = state?.messages?.[key];
    if (value === undefined || value === null || value === "") {
        return fallback || key;
    }
    return value;
}
