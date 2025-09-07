// ==============================
// frontend/api/client.js
// Centralized API client for frontend
// ==============================

export const API_BASE = ""; // same-origin

// ---- Auth storage helpers (single source of truth) ----
const STORAGE_KEY = "loggedInUser";

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}
export function setAuth(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}));
}
export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}
export function getToken() {
  return getAuth()?.idToken || null;
}

// ---- Core request wrapper ----
export async function apiRequest(endpoint, { method = "GET", headers = {}, body } = {}) {
  const token = getToken();

  const res = await fetch(API_BASE + endpoint, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });


  if (res.status === 401) {
    clearAuth();
    const here = typeof location !== "undefined" ? location.pathname + location.search : "/";
    try { sessionStorage.setItem("postLoginRedirect", here); } catch {}

    // Avoid reload loops if we are already on profile.html
    const path = (typeof location !== "undefined" && location.pathname) ? location.pathname : "";
    const alreadyOnProfile = /(^|\/)profile\.html$/.test(path);

    if (!alreadyOnProfile && typeof window !== "undefined") {
      window.location.href = "profile.html";
    }
    throw new Error("Unauthorized");
  }


  if (!res.ok) {
    let err = {};
    try { err = await res.json(); } catch {}
    throw new Error(err.error || res.statusText || "Request failed");
  }

  if (res.status === 204) return null;
  return res.json();
}

// Convenience API object (for existing code like wishlist.js)
export const apiClient = {
  get: (e) => apiRequest(e),
  post: (e, b) => apiRequest(e, { method: "POST", body: b }),
  put: (e, b) => apiRequest(e, { method: "PUT", body: b }),
  delete: (e) => apiRequest(e, { method: "DELETE" }),
};
