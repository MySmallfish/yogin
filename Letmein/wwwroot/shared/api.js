const baseHeaders = {
    "Content-Type": "application/json"
};

async function parseResponse(response) {
    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    if (!text) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        return JSON.parse(text);
    }

    return text;
}

export async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
        credentials: "include",
        headers: {
            ...baseHeaders,
            ...(options.headers || {})
        },
        ...options
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
        const message = payload?.error || response.statusText || "Request failed";
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return payload;
}

export function apiGet(path) {
    return apiFetch(path, { method: "GET" });
}

export function apiPost(path, body) {
    return apiFetch(path, {
        method: "POST",
        body: JSON.stringify(body)
    });
}

export function apiPut(path, body) {
    return apiFetch(path, {
        method: "PUT",
        body: JSON.stringify(body)
    });
}

export function apiDelete(path) {
    return apiFetch(path, { method: "DELETE" });
}

