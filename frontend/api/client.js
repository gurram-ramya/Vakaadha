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

// ==============================
// frontend/api/client.js
// Unified API + Auth + Guest handling
// ==============================


// ===================================================================================


// // frontend/api/client.js
// export const API_BASE = ""; // same-origin
// const STORAGE_KEY = "loggedInUser";
// const GUEST_KEY = "guest_id";

// // ---- Auth helpers ----
// export function getAuth() {
//   try {
//     return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
//   } catch {
//     return null;
//   }
// }

// export function setAuth(obj) {
//   if (!obj) {
//     localStorage.removeItem(STORAGE_KEY);
//     return;
//   }
//   localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
// }

// export function clearAuth() {
//   localStorage.removeItem(STORAGE_KEY);
// }

// export function getToken() {
//   return getAuth()?.idToken || null;
// }

// export function getUserId() {
//   return getAuth()?.user_id || null;
// }

// // ---- Guest ID helpers ----
// export function getGuestId() {
//   let gid = localStorage.getItem(GUEST_KEY);
//   if (!gid) {
//     gid = crypto.randomUUID();
//     localStorage.setItem(GUEST_KEY, gid);
//   }
//   return gid;
// }

// export function resetGuestId() {
//   localStorage.removeItem(GUEST_KEY);
//   const newId = crypto.randomUUID();
//   localStorage.setItem(GUEST_KEY, newId);
//   return newId;
// }

// // ---- Core request wrapper ----
// export async function apiRequest(endpoint, { method = "GET", headers = {}, body } = {}) {
//   const token = getToken();
//   const h = {
//     ...(body ? { "Content-Type": "application/json" } : {}),
//     ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     ...headers,
//   };

//   let url = API_BASE + endpoint;
//   if (!token && !url.includes("guest_id")) {
//     const sep = url.includes("?") ? "&" : "?";
//     url = `${url}${sep}guest_id=${getGuestId()}`;
//   }

//   console.log("[DEBUG client.js] request", { url, method, headers: h, body });

//   const res = await fetch(url, {
//     method,
//     headers: h,
//     body: body ? JSON.stringify(body) : undefined,
//     credentials: "same-origin",
//   });

//   let data;
//   try {
//     data = await res.json();
//   } catch {
//     data = null;
//   }

//   if (!res.ok) {
//     console.error("[ERROR client.js]", { status: res.status, data });
//     throw new Error(data?.error || `API error ${res.status}`);
//   }
//   return data;
// }

// export const apiClient = {
//   get: (e) => apiRequest(e),
//   post: (e, b) => apiRequest(e, { method: "POST", body: b }),
//   put: (e, b) => apiRequest(e, { method: "PUT", body: b }),
//   delete: (e) => apiRequest(e, { method: "DELETE" }),
// };


//==========================================================


// frontend/api/client.js — improved persistent guest + auth API client
(function () {
  const API_BASE = ""; // same-origin Flask API
  const AUTH_KEY = "loggedInUser";
  const GUEST_KEY = "guest_id";

  /* ---------------- Auth helpers ---------------- */
  function getAuth() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setAuth(obj) {
    if (!obj) {
      localStorage.removeItem(AUTH_KEY);
      return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify(obj));
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
  }

  function getToken() {
    return getAuth()?.idToken || null;
  }

  function getUserId() {
    return getAuth()?.user_id || null;
  }

  /* ---------------- Guest ID helpers ---------------- */
  function getGuestId() {
    let gid = localStorage.getItem(GUEST_KEY);
    if (!gid) {
      gid = crypto.randomUUID();
      localStorage.setItem(GUEST_KEY, gid);
      console.info("[client.js] Generated new guest_id", gid);
    }
    return gid;
  }

  function resetGuestId() {
    localStorage.removeItem(GUEST_KEY);
    const newId = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, newId);
    console.info("[client.js] Reset guest_id", newId);
    return newId;
  }

  /* ---------------- Core request wrapper ---------------- */
  async function apiRequest(endpoint, { method = "GET", headers = {}, body } = {}) {
    const token = getToken();
    const guestId = getGuestId();

    const h = {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };

    // Always include guest_id for anonymous or mixed sessions
    let url = API_BASE + endpoint;
    const sep = url.includes("?") ? "&" : "?";
    if (!url.includes("guest_id")) url += `${sep}guest_id=${guestId}`;

    const res = await fetch(url, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include", // allow cookies for guest_id
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error("[API ERROR]", { url, status: res.status, data });
      throw new Error(data?.error || `API ${res.status}`);
    }

    return data;
  }

  /* ---------------- Convenience wrappers ---------------- */
  const apiClient = {
    get: (e) => apiRequest(e),
    post: (e, b) => apiRequest(e, { method: "POST", body: b }),
    put: (e, b) => apiRequest(e, { method: "PUT", body: b }),
    delete: (e) => apiRequest(e, { method: "DELETE" }),
  };

  /* ---------------- Global exposure ---------------- */
  window.apiRequest = apiRequest;
  window.apiClient = apiClient;
  window.getAuth = getAuth;
  window.setAuth = setAuth;
  window.clearAuth = clearAuth;
  window.getToken = getToken;
  window.getUserId = getUserId;
  window.getGuestId = getGuestId;
  window.resetGuestId = resetGuestId;

  console.log("[client.js] loaded ✅ guest carts persist across sessions");
})();
