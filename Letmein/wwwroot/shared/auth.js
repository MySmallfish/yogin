import { apiGet, apiPost } from "./api.js";

const storageKey = "letmein.session";

export function loadSessionHint() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { studioSlug: "demo", role: "admin" };
    try {
        return JSON.parse(raw);
    } catch {
        return { studioSlug: "demo", role: "admin" };
    }
}

export function saveSessionHint(payload) {
    localStorage.setItem(storageKey, JSON.stringify(payload));
}

export async function getSession() {
    return apiGet("/api/auth/me");
}

export async function login({ email, password, role, studioSlug }) {
    const result = await apiPost("/api/auth/login", {
        email,
        password,
        role,
        studioSlug
    });
    saveSessionHint({ studioSlug, role });
    return result;
}

export async function register({ email, password, studioSlug, fullName, phone }) {
    const result = await apiPost("/api/auth/register", {
        email,
        password,
        studioSlug,
        fullName,
        phone
    });
    saveSessionHint({ studioSlug, role: "customer" });
    return result;
}

export async function logout() {
    await apiPost("/api/auth/logout", {});
}

