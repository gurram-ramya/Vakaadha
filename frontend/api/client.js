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

    if (res.status === 410) {
      console.warn("[client.js] Guest cart expired → resetting guest_id");
      resetGuestId();
      return { expired: true, status: 410 };
    }

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error("[API ERROR]", { url, status: res.status, data });
      const err = new Error(data?.error || `API ${res.status}`);
      err.status = res.status;
      throw err;
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

  window.CartAPI = {
    get: () => apiRequest("/api/cart"),
    patch: (body) => apiRequest("/api/cart", { method: "PATCH", body }),
    add: (body) => apiRequest("/api/cart", { method: "POST", body }),
    remove: (id) => apiRequest(`/api/cart/${id}`, { method: "DELETE" }),
    clear: () => apiRequest("/api/cart/clear", { method: "DELETE" }),
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
