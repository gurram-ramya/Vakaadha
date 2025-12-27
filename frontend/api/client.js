// // frontend/api/client.js — async token flow aligned with auth.js
// (function () {
//   const API_BASE = "";
//   const AUTH_CACHE_KEY = "loggedInUser";
//   const TOKEN_KEY = "auth_token";
//   const GUEST_KEY = "guest_id";

//   // ---------------- Cookie helper ----------------
//   function getCookie(name) {
//     const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
//     return m ? decodeURIComponent(m[2]) : null;
//   }

//   // ---------------- Auth cache (legacy) ----------------
//   function getAuth() {
//     try {
//       return JSON.parse(localStorage.getItem(AUTH_CACHE_KEY) || "null");
//     } catch {
//       return null;
//     }
//   }
//   function setAuth(obj) {
//     if (!obj) localStorage.removeItem(AUTH_CACHE_KEY);
//     else localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(obj));
//   }
//   function clearAuth() {
//     localStorage.removeItem(AUTH_CACHE_KEY);
//   }

//   // ---------------- Unified token getter ----------------
//   async function getToken() {
//     try {
//       if (window.auth?.getToken) {
//         const t = await window.auth.getToken();
//         if (typeof t === "string" && t.trim()) return t;
//       }
//       const fallback = localStorage.getItem(TOKEN_KEY);
//       return fallback || null;
//     } catch (err) {
//       console.error("[client.js] getToken failed:", err);
//       return null;
//     }
//   }

//   // ---------------- Guest ID ----------------
//   function getGuestId() {
//     const ck = getCookie(GUEST_KEY);
//     if (ck) {
//       try {
//         localStorage.setItem(GUEST_KEY, ck);
//       } catch {}
//       return ck;
//     }
//     try {
//       return localStorage.getItem(GUEST_KEY) || null;
//     } catch {
//       return null;
//     }
//   }

//   // ---------------- Core request wrapper ----------------
//   async function apiRequest(endpoint, { method = "GET", headers = {}, body, _retried } = {}) {

//       // [DEBUG] Client-side request trace
//       console.log("CLIENT DEBUG → request start", {
//           endpoint,
//           method,
//           cookies: document.cookie,
//           local_guest: localStorage.getItem("guest_id"),
//           token_present: !!(await getToken())
//       });

//       const token = await getToken();
//       const h = {
//           ...(body && typeof body === "object" ? { "Content-Type": "application/json" } : {}),
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//           ...headers,
//       };

//       const gid = getGuestId();
//       if (gid) {
//           h["X-Guest-Id"] = gid;
//       }

//       let url = API_BASE + endpoint;

//       if (!token) {
//           const gid = getGuestId();
//           if (gid && !/([?&])guest_id=/.test(url)) {
//               url += (url.includes("?") ? "&" : "?") + "guest_id=" + encodeURIComponent(gid);
//           }
//       }

//       let res;
//       try {
//           res = await fetch(url, {
//               method,
//               headers: h,
//               body: body && typeof body === "object" ? JSON.stringify(body) : body,
//               credentials: "include",
//           });
//       } catch (err) {
//           console.error("[client.js] network error:", err);
//           throw err;
//       }

//       if (res.status === 410) return { expired: true, status: 410 };

//       if (res.status === 401 && !_retried) {
//           try {
//               if (window.auth?.initSession) await window.auth.initSession();
//           } catch (err) {
//               console.error("[client.js] reinit after 401 failed:", err);
//           }
//           return apiRequest(endpoint, { method, headers, body, _retried: true });
//       }

//       let data = null;
//       try {
//           data = await res.json();
//       } catch {}

//       if (!res.ok) {
//           const err = new Error(data?.error || `API ${res.status}`);
//           err.status = res.status;
//           err.payload = data;
//           throw err;
//       }

//       return data;
//   }


//   // ---------------- Convenience wrappers ----------------
//   const apiClient = {
//     get: (e) => apiRequest(e),
//     post: (e, b) => apiRequest(e, { method: "POST", body: b }),
//     put: (e, b) => apiRequest(e, { method: "PUT", body: b }),
//     delete: (e) => apiRequest(e, { method: "DELETE" }),
//   };

//   // ---------------- Cart facade ----------------
//   window.CartAPI = {
//     get: () => apiRequest("/api/cart"),
//     patch: (body) => apiRequest("/api/cart", { method: "PATCH", body }),
//     add: (body) => apiRequest("/api/cart", { method: "POST", body }),
//     remove: (id) => apiRequest(`/api/cart/${id}`, { method: "DELETE" }),
//     clear: () => apiRequest("/api/cart/clear", { method: "DELETE" }),
//   };

//   // ---------------- Global exposure ----------------
//   window.apiRequest = apiRequest;
//   window.apiClient = apiClient;
//   window.getAuth = getAuth;
//   window.setAuth = setAuth;
//   window.clearAuth = clearAuth;

//   // ---------------- Auth shim ----------------
//   if (!window.auth) {
//     console.warn("[client.js] fallback auth shim active (auth.js not loaded)");
//     window.auth = {
//       async initSession() { return null; },
//       async getCurrentUser() { return null; },
//       async getToken() { return null; },
//       async logout() {
//         localStorage.clear();
//       },
//     };
//   }

//   console.log("[client.js] async token flow aligned; Authorization resolved; guest_id fallback retained");
// })();


//-------------------------------------------------------------------------------------------------------------

// frontend/api/client.js
// transport layer (auth.js–aligned, Firebase-agnostic)
//
// Contract:
// - window.apiRequest(endpoint, opts)
// - window.apiClient.{get,post,put,delete}
// - window.CartAPI facade (unchanged)
//
// Rules:
// - Token source is window.auth.getToken() (auth.js is authority)
// - If caller passes headers.Authorization, it MUST win (AuthCore relies on this)
// - Single retry on 401: force-refresh token once, then retry
(function () {
  if (window.__api_client_bound__) return;
  window.__api_client_bound__ = true;

  const API_BASE =
    (typeof window.API_BASE === "string" ? window.API_BASE : "") ||
    (typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "") ||
    "";

  const TOKEN_KEY = "auth_token";
  const GUEST_KEY = "guest_id";

  /* -------------------------------------------------------
   * Cookie helper
   * ----------------------------------------------------- */
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  /* -------------------------------------------------------
   * Guest ID continuity
   * ----------------------------------------------------- */
  function getGuestId() {
    const ck = getCookie(GUEST_KEY);
    if (ck) {
      try { localStorage.setItem(GUEST_KEY, ck); } catch {}
      return ck;
    }
    try {
      return localStorage.getItem(GUEST_KEY) || null;
    } catch {
      return null;
    }
  }

  /* -------------------------------------------------------
   * Body helpers
   * ----------------------------------------------------- */
  function isPlainObject(x) {
    return (
      x &&
      typeof x === "object" &&
      !Array.isArray(x) &&
      !(x instanceof FormData) &&
      !(x instanceof Blob) &&
      !(x instanceof ArrayBuffer) &&
      !(x instanceof URLSearchParams)
    );
  }

  function shouldJsonEncode(body) {
    return isPlainObject(body);
  }

  /* -------------------------------------------------------
   * Token acquisition (auth.js is authority)
   * ----------------------------------------------------- */
  async function getToken(forceRefresh) {
    try {
      if (window.auth?.getToken) {
        const t = await window.auth.getToken({ forceRefresh: !!forceRefresh });
        if (typeof t === "string" && t.trim()) return t.trim();
      }
    } catch {}

    // Transitional fallback only
    try {
      const t2 = localStorage.getItem(TOKEN_KEY);
      return t2 && String(t2).trim() ? String(t2).trim() : null;
    } catch {
      return null;
    }
  }

  /* -------------------------------------------------------
   * Core request wrapper
   * ----------------------------------------------------- */
  async function apiRequest(endpoint, opts = {}) {
    const {
      method = "GET",
      headers = {},
      body,
      _retried = false,
    } = opts;

    const guestId = getGuestId();

    // Token is optional; if caller provides Authorization, it wins.
    const token = await getToken(false);

    const reqHeaders = {
      ...(shouldJsonEncode(body) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(guestId ? { "X-Guest-Id": guestId } : {}),
      ...headers, // must be last: caller overrides Authorization (AuthCore needs this)
    };

    let url = API_BASE + endpoint;

    // Guest fallback for unauthenticated requests (no Authorization header)
    const hasAuthHeader = !!reqHeaders.Authorization;
    if (!hasAuthHeader && guestId && !/([?&])guest_id=/.test(url)) {
      url += (url.includes("?") ? "&" : "?") + "guest_id=" + encodeURIComponent(guestId);
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: shouldJsonEncode(body) ? JSON.stringify(body) : body,
        credentials: "include",
      });
    } catch (err) {
      throw err;
    }

    // Explicit expired marker (used by checkout flows)
    if (res.status === 410) {
      return { expired: true, status: 410 };
    }

    // Single retry on auth failure:
    // - force-refresh token once
    // - retry with refreshed Authorization header (unless caller pinned Authorization)
    if (res.status === 401 && !_retried) {
      try {
        if (window.auth?.initSession) {
          await window.auth.initSession();
        }
      } catch {}

      const callerPinnedAuth = Object.prototype.hasOwnProperty.call(headers || {}, "Authorization");

      if (!callerPinnedAuth) {
        const fresh = await getToken(true);
        if (fresh) {
          const retryHeaders = {
            ...reqHeaders,
            Authorization: `Bearer ${fresh}`,
          };
          return apiRequest(endpoint, {
            method,
            headers: retryHeaders,
            body,
            _retried: true,
          });
        }
      }

      return apiRequest(endpoint, { method, headers, body, _retried: true });
    }

    let data = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `API ${res.status}`);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  /* -------------------------------------------------------
   * Convenience wrappers
   * ----------------------------------------------------- */
  const apiClient = {
    get: (e) => apiRequest(e),
    post: (e, b) => apiRequest(e, { method: "POST", body: b }),
    put: (e, b) => apiRequest(e, { method: "PUT", body: b }),
    delete: (e) => apiRequest(e, { method: "DELETE" }),
  };

  /* -------------------------------------------------------
   * Cart facade (unchanged contract)
   * ----------------------------------------------------- */
  window.CartAPI = {
    get: () => apiRequest("/api/cart"),
    patch: (body) => apiRequest("/api/cart", { method: "PATCH", body }),
    add: (body) => apiRequest("/api/cart", { method: "POST", body }),
    remove: (id) => apiRequest(`/api/cart/${id}`, { method: "DELETE" }),
    clear: () => apiRequest("/api/cart/clear", { method: "DELETE" }),
  };

  /* -------------------------------------------------------
   * Global exposure (unchanged)
   * ----------------------------------------------------- */
  window.apiRequest = apiRequest;
  window.apiClient = apiClient;

  /* -------------------------------------------------------
   * Auth shim (failsafe only)
   * ----------------------------------------------------- */
  if (!window.auth) {
    window.auth = {
      async initSession() {},
      async getCurrentUser() { return null; },
      async getToken() { return null; },
      async logout() { try { localStorage.clear(); } catch {} },
    };
  }
})();
