// // frontend/api/client.js — fixed async token handling; auth-first, guest fallback
// (function () {
//   const API_BASE = ""; // same-origin Flask API
//   const AUTH_CACHE_KEY = "loggedInUser";
//   const TOKEN_FALLBACK_KEY = "auth_token";
//   const GUEST_KEY = "guest_id";

//   // ---------------- Cookie helper ----------------
//   function getCookie(name) {
//     const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
//     return m ? decodeURIComponent(m[2]) : null;
//   }

//   // ---------------- Auth cache (legacy) ----------------
//   function getAuth() {
//     try { return JSON.parse(localStorage.getItem(AUTH_CACHE_KEY) || "null"); } catch { return null; }
//   }
//   function setAuth(obj) {
//     if (!obj) localStorage.removeItem(AUTH_CACHE_KEY);
//     else localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(obj));
//   }
//   function clearAuth() { localStorage.removeItem(AUTH_CACHE_KEY); }

//   // ---------------- Unified token getter ----------------
//   async function getToken() {
//     try {
//       if (window.auth?.getToken) {
//         const t = await window.auth.getToken();
//         if (typeof t === "string" && t.trim()) return t;
//       }
//       const legacy = localStorage.getItem(TOKEN_FALLBACK_KEY) || getAuth()?.idToken || null;
//       return legacy;
//     } catch {
//       return null;
//     }
//   }

//   // ---------------- Guest ID (cookie source of truth) ----------------
//   function getGuestId() {
//     const ck = getCookie(GUEST_KEY);
//     if (ck) {
//       try { localStorage.setItem(GUEST_KEY, ck); } catch {}
//       return ck;
//     }
//     try { return localStorage.getItem(GUEST_KEY) || null; } catch { return null; }
//   }

//   // ---------------- Core request wrapper ----------------
//   async function apiRequest(endpoint, { method = "GET", headers = {}, body, _retried } = {}) {
//     const token = await getToken(); // now resolves Promise
//     const h = {
//       ...(body && typeof body === "object" ? { "Content-Type": "application/json" } : {}),
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//       ...headers,
//     };

//     let url = API_BASE + endpoint;

//     // Attach guest_id only when no resolved token
//     if (!token) {
//       const gid = getGuestId();
//       if (gid && !/([?&])guest_id=/.test(url)) {
//         url += (url.includes("?") ? "&" : "?") + "guest_id=" + encodeURIComponent(gid);
//       }
//     }

//     const res = await fetch(url, {
//       method,
//       headers: h,
//       body: body && typeof body === "object" ? JSON.stringify(body) : body,
//       credentials: "include",
//     });

//     if (res.status === 410) return { expired: true, status: 410 };

//     if (res.status === 401 && !_retried) {
//       try { if (window.auth?.initSession) await window.auth.initSession(); } catch {}
//       return apiRequest(endpoint, { method, headers, body, _retried: true });
//     }

//     let data = null;
//     try { data = await res.json(); } catch {}

//     if (!res.ok) {
//       const err = new Error(data?.error || `API ${res.status}`);
//       err.status = res.status;
//       err.payload = data;
//       throw err;
//     }

//     return data;
//   }

//   // ---------------- Convenience wrappers ----------------
//   const apiClient = {
//     get: (e)      => apiRequest(e),
//     post: (e, b)  => apiRequest(e, { method: "POST", body: b }),
//     put: (e, b)   => apiRequest(e, { method: "PUT", body: b }),
//     delete: (e)   => apiRequest(e, { method: "DELETE" }),
//   };

//   // ---------------- Cart facade ----------------
//   window.CartAPI = {
//     get:    ()       => apiRequest("/api/cart"),
//     patch:  (body)   => apiRequest("/api/cart", { method: "PATCH", body }),
//     add:    (body)   => apiRequest("/api/cart", { method: "POST", body }),
//     remove: (id)     => apiRequest(`/api/cart/${id}`, { method: "DELETE" }),
//     clear:  ()       => apiRequest("/api/cart/clear", { method: "DELETE" }),
//   };

//   // ---------------- Global exposure ----------------
//   window.apiRequest = apiRequest;
//   window.apiClient  = apiClient;
//   window.getAuth    = getAuth;
//   window.setAuth    = setAuth;
//   window.clearAuth  = clearAuth;

//   // ---------------- Auth shim for navbar/profile/cart ----------------
//   // Preserve existing window.auth from auth.js if loaded first
//   if (!window.auth) {
//     console.warn("[client.js] fallback auth shim active (auth.js not loaded)");
//     window.auth = {
//       async initSession() { return null; },
//       async getCurrentUser() { return null; },
//       async getToken() { return null; },
//       async logout() { localStorage.clear(); },
//     };
//   }

//   console.log("[client.js] async token fix active; Authorization resolved string; guest_id only when unauthenticated");
// })();

// ------------------------------------------------------------------------------------------------------------------------------------

// frontend/api/client.js — async token flow aligned with auth.js
(function () {
  const API_BASE = "";
  const AUTH_CACHE_KEY = "loggedInUser";
  const TOKEN_KEY = "auth_token";
  const GUEST_KEY = "guest_id";

  // ---------------- Cookie helper ----------------
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  // ---------------- Auth cache (legacy) ----------------
  function getAuth() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_CACHE_KEY) || "null");
    } catch {
      return null;
    }
  }
  function setAuth(obj) {
    if (!obj) localStorage.removeItem(AUTH_CACHE_KEY);
    else localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(obj));
  }
  function clearAuth() {
    localStorage.removeItem(AUTH_CACHE_KEY);
  }

  // ---------------- Unified token getter ----------------
  async function getToken() {
    try {
      if (window.auth?.getToken) {
        const t = await window.auth.getToken();
        if (typeof t === "string" && t.trim()) return t;
      }
      const fallback = localStorage.getItem(TOKEN_KEY);
      return fallback || null;
    } catch (err) {
      console.error("[client.js] getToken failed:", err);
      return null;
    }
  }

  // ---------------- Guest ID ----------------
  function getGuestId() {
    const ck = getCookie(GUEST_KEY);
    if (ck) {
      try {
        localStorage.setItem(GUEST_KEY, ck);
      } catch {}
      return ck;
    }
    try {
      return localStorage.getItem(GUEST_KEY) || null;
    } catch {
      return null;
    }
  }

  // ---------------- Core request wrapper ----------------
  async function apiRequest(endpoint, { method = "GET", headers = {}, body, _retried } = {}) {
    const token = await getToken();
    const h = {
      ...(body && typeof body === "object" ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };

    let url = API_BASE + endpoint;

    if (!token) {
      const gid = getGuestId();
      if (gid && !/([?&])guest_id=/.test(url)) {
        url += (url.includes("?") ? "&" : "?") + "guest_id=" + encodeURIComponent(gid);
      }
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: h,
        body: body && typeof body === "object" ? JSON.stringify(body) : body,
        credentials: "include",
      });
    } catch (err) {
      console.error("[client.js] network error:", err);
      throw err;
    }

    if (res.status === 410) return { expired: true, status: 410 };

    if (res.status === 401 && !_retried) {
      try {
        if (window.auth?.initSession) await window.auth.initSession();
      } catch (err) {
        console.error("[client.js] reinit after 401 failed:", err);
      }
      return apiRequest(endpoint, { method, headers, body, _retried: true });
    }

    let data = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      const err = new Error(data?.error || `API ${res.status}`);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  // ---------------- Convenience wrappers ----------------
  const apiClient = {
    get: (e) => apiRequest(e),
    post: (e, b) => apiRequest(e, { method: "POST", body: b }),
    put: (e, b) => apiRequest(e, { method: "PUT", body: b }),
    delete: (e) => apiRequest(e, { method: "DELETE" }),
  };

  // ---------------- Cart facade ----------------
  window.CartAPI = {
    get: () => apiRequest("/api/cart"),
    patch: (body) => apiRequest("/api/cart", { method: "PATCH", body }),
    add: (body) => apiRequest("/api/cart", { method: "POST", body }),
    remove: (id) => apiRequest(`/api/cart/${id}`, { method: "DELETE" }),
    clear: () => apiRequest("/api/cart/clear", { method: "DELETE" }),
  };

  // ---------------- Global exposure ----------------
  window.apiRequest = apiRequest;
  window.apiClient = apiClient;
  window.getAuth = getAuth;
  window.setAuth = setAuth;
  window.clearAuth = clearAuth;

  // ---------------- Auth shim ----------------
  if (!window.auth) {
    console.warn("[client.js] fallback auth shim active (auth.js not loaded)");
    window.auth = {
      async initSession() { return null; },
      async getCurrentUser() { return null; },
      async getToken() { return null; },
      async logout() {
        localStorage.clear();
      },
    };
  }

  console.log("[client.js] async token flow aligned; Authorization resolved; guest_id fallback retained");
})();
