// // ==============================
// // frontend/api/client.js
// // Centralized API client for frontend
// // ==============================

// export const API_BASE = ""; // same-origin

// // ---- Auth storage helpers (single source of truth) ----
// const STORAGE_KEY = "loggedInUser";

// export function getAuth() {
//   try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
//   catch { return null; }
// }

// export function setAuth(obj) {
//   console.log("🧪 [AUTH] setAuth called with:", obj);
//   localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}));
// }

// export function clearAuth() {
//   console.log("🧪 [AUTH] clearAuth called");
//   localStorage.removeItem(STORAGE_KEY);
// }

// export function getToken() {
//   const token = getAuth()?.idToken || null;
//   console.log("🧪 [AUTH] getToken called. Token exists?", !!token);
//   if (token) console.log("🧪 [AUTH] Token (start):", token.substring(0, 40), "...");
//   return token;
// }

// // ---- Core request wrapper ----
// export async function apiRequest(endpoint, { method = "GET", headers = {}, body } = {}) {
//   const token = getToken();

//   console.log("🧪 [API REQUEST]", method, endpoint);
//   console.log("🧪 [API] Token present?", !!token);

//   const res = await fetch(API_BASE + endpoint, {
//     method,
//     headers: {
//       ...(body ? { "Content-Type": "application/json" } : {}),
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//       ...headers,
//     },
//     body: body ? JSON.stringify(body) : undefined,
//     credentials: "same-origin",
//   });

//   if (res.status === 401) {
//     clearAuth();
//     const here = typeof location !== "undefined" ? location.pathname + location.search : "/";
//     try { sessionStorage.setItem("postLoginRedirect", here); } catch {}

//     const path = (typeof location !== "undefined" && location.pathname) ? location.pathname : "";
//     const alreadyOnProfile = /(^|\/)profile\.html$/.test(path);

//     if (!alreadyOnProfile && typeof window !== "undefined") {
//       console.warn("🧪 [API] Redirecting to login due to 401");
//       window.location.href = "profile.html";
//     }
//     throw new Error("Unauthorized");
//   }

//   if (!res.ok) {
//     let err = {};
//     try { err = await res.json(); } catch {}
//     console.error("🧪 [API ERROR]", err);
//     throw new Error(err.error || res.statusText || "Request failed");
//   }

//   if (res.status === 204) return null;
//   const json = await res.json();
//   console.log("🧪 [API] Response JSON:", json);
//   return json;
// }

// // Convenience API object (for existing code like wishlist.js)
// export const apiClient = {
//   get: (e) => apiRequest(e),
//   post: (e, b) => apiRequest(e, { method: "POST", body: b }),
//   put: (e, b) => apiRequest(e, { method: "PUT", body: b }),
//   delete: (e) => apiRequest(e, { method: "DELETE" }),
// };


// excluding the helper codes. 

// frontend/api/client.js

// ---- Core request wrapper ----
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("idToken");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.json();
}

// ---- Backward compatibility ----
export const apiRequest = apiFetch;

// ---- Convenience API object ----
export const apiClient = {
  get: (e) => apiFetch(e),
  post: (e, b) => apiFetch(e, { method: "POST", body: JSON.stringify(b) }),
  put: (e, b) => apiFetch(e, { method: "PUT", body: JSON.stringify(b) }),
  delete: (e) => apiFetch(e, { method: "DELETE" }),
};

