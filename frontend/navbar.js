// // ============================================================
// // navbar.js — Phase 3 (Guest + Auth Wishlist Count Fix)
// // ============================================================

// console.log("[navbar.js] apiRequest available?", typeof window.apiRequest);

// // ============================================================
// // navbar.js — Revised for Auth-First Initialization
// // ============================================================

// (function () {
//   if (window.__navbar_js_bound__) return;
//   window.__navbar_js_bound__ = true;

//   const CART_ENDPOINT = "/api/cart";
//   const WISHLIST_COUNT_ENDPOINT = "/api/wishlist/count";

//   window.appState = window.appState || {
//     cartCount: 0,
//     wishlistCount: 0,
//     lastFetch: 0,
//   };

//   // ------------------------------------------------------------
//   // Helpers
//   // ------------------------------------------------------------
//   function getGuestId() {
//     try { return localStorage.getItem("guest_id") || null; } catch { return null; }
//   }

//   async function safeApiRequest(endpoint, options = {}) {
//     const guestId = getGuestId();
//     const url = guestId ? `${endpoint}?guest_id=${guestId}` : endpoint;
//     const token = localStorage.getItem("auth_token");
//     const headers = options.headers || {};
//     if (token) headers["Authorization"] = `Bearer ${token}`;
//     return await window.apiRequest(url, { ...options, headers });
//   }

//   // ------------------------------------------------------------
//   // Counts
//   // ------------------------------------------------------------
//   async function fetchCartCount(force = false) {
//     const now = Date.now();
//     if (!force && now - window.appState.lastFetch < 60000)
//       return window.appState.cartCount;

//     try {
//       const data = await safeApiRequest(CART_ENDPOINT, { method: "GET" });
//       const items = Array.isArray(data.items) ? data.items : [];
//       const count = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
//       window.appState.cartCount = count;
//       window.appState.lastFetch = now;
//       return count;
//     } catch (err) {
//       if (err.status === 410) window.appState.cartCount = 0;
//       return 0;
//     }
//   }

//   async function fetchWishlistCount(force = false) {
//     const now = Date.now();
//     if (!force && now - window.appState.lastFetch < 60000)
//       return window.appState.wishlistCount;

//     try {
//       const res = await safeApiRequest(WISHLIST_COUNT_ENDPOINT, { method: "GET" });
//       const count = typeof res.count === "number" ? res.count : 0;
//       window.appState.wishlistCount = count;
//       window.appState.lastFetch = now;
//       return count;
//     } catch {
//       return 0;
//     }
//   }

//   async function updateNavbarCounts(force = false) {
//     const cartEl = document.getElementById("cartCount");
//     const wishEl = document.getElementById("wishlistCount");
//     if (!cartEl && !wishEl) return;
//     try {
//       const [cartCount, wishlistCount] = await Promise.all([
//         fetchCartCount(force),
//         fetchWishlistCount(force),
//       ]);
//       if (cartEl) cartEl.textContent = cartCount || 0;
//       if (wishEl) wishEl.textContent = wishlistCount || 0;
//     } catch {
//       if (cartEl) cartEl.textContent = "0";
//       if (wishEl) wishEl.textContent = "0";
//     }
//   }

//   // ------------------------------------------------------------
//   // User Display
//   // ------------------------------------------------------------
//   function updateNavbarUser(user) {
//     const loginLink = document.getElementById("loginLink");
//     const profileLink = document.getElementById("profileLink");
//     const logoutLink = document.getElementById("navbar-logout");
//     const userDisplay = document.getElementById("user-display");
//     const isAuth = !!(user && (user.name || user.email));

//     if (userDisplay)
//       userDisplay.textContent = isAuth ? (user.name || user.email || "") : "";
//     if (loginLink) loginLink.style.display = isAuth ? "none" : "inline-block";
//     if (profileLink) profileLink.style.display = isAuth ? "inline-block" : "none";
//     if (logoutLink) logoutLink.style.display = isAuth ? "inline-block" : "none";
//   }

//   function wireLogout() {
//     const logoutLink = document.getElementById("navbar-logout");
//     if (!logoutLink) return;
//     logoutLink.addEventListener("click", async (e) => {
//       e.preventDefault();
//       try {
//         await window.auth.logout();
//         window.appState = { cartCount: 0, wishlistCount: 0, lastFetch: 0 };
//       } finally {
//         location.href = "/";
//       }
//     });
//   }

//   // ------------------------------------------------------------
//   // Initialization
//   // ------------------------------------------------------------
//   async function initializeNavbar() {
//     // Wait until auth session resolved
//     await window.auth.initSession();

//     const user = await window.auth.getCurrentUser();
//     updateNavbarUser(user);
//     await updateNavbarCounts(true);
//     wireLogout();

//     setInterval(() => updateNavbarCounts(false), 60000);

//     window.updateNavbarCounts = updateNavbarCounts;
//     window.updateNavbarUser = updateNavbarUser;
//   }

//   document.addEventListener("DOMContentLoaded", initializeNavbar);
// })();

// ============================================================
// navbar.js — Auth-first; unified token/guest logic
// ============================================================

(function () {
  if (window.__navbar_js_bound__) return;
  window.__navbar_js_bound__ = true;

  const CART_ENDPOINT = "/api/cart";
  const WISHLIST_COUNT_ENDPOINT = "/api/wishlist/count";

  window.appState = window.appState || {
    cartCount: 0,
    wishlistCount: 0,
    lastFetch: 0,
  };

  // ------------------------------------------------------------
  // Core request
  // ------------------------------------------------------------
  async function safeApiRequest(endpoint, options = {}) {
    try {
      return await window.apiRequest(endpoint, options);
    } catch (err) {
      console.error("[navbar.js] API fail:", err);
      if (err.status === 410) {
        console.warn("[navbar.js] Guest session expired; resetting");
        if (window.resetGuestId) window.resetGuestId();
      }
      throw err;
    }
  }

  // ------------------------------------------------------------
  // Counts
  // ------------------------------------------------------------
  async function fetchCartCount(force = false) {
    const now = Date.now();
    if (!force && now - window.appState.lastFetch < 60000)
      return window.appState.cartCount;

    try {
      const data = await safeApiRequest(CART_ENDPOINT, { method: "GET" });
      const items = Array.isArray(data.items) ? data.items : [];
      const count = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      window.appState.cartCount = count;
      window.appState.lastFetch = now;
      return count;
    } catch {
      window.appState.cartCount = 0;
      return 0;
    }
  }

  async function fetchWishlistCount(force = false) {
    const now = Date.now();
    if (!force && now - window.appState.lastFetch < 60000)
      return window.appState.wishlistCount;

    try {
      const res = await safeApiRequest(WISHLIST_COUNT_ENDPOINT, { method: "GET" });
      const count = typeof res.count === "number" ? res.count : 0;
      window.appState.wishlistCount = count;
      window.appState.lastFetch = now;
      return count;
    } catch {
      window.appState.wishlistCount = 0;
      return 0;
    }
  }

  async function updateNavbarCounts(force = false) {
    const cartEl = document.getElementById("cartCount");
    const wishEl = document.getElementById("wishlistCount");
    if (!cartEl && !wishEl) return;

    try {
      const [cartCount, wishlistCount] = await Promise.all([
        fetchCartCount(force),
        fetchWishlistCount(force),
      ]);
      if (cartEl) cartEl.textContent = cartCount || 0;
      if (wishEl) wishEl.textContent = wishlistCount || 0;
    } catch {
      if (cartEl) cartEl.textContent = "0";
      if (wishEl) wishEl.textContent = "0";
    }
  }

  // ------------------------------------------------------------
  // User Display
  // ------------------------------------------------------------
  function updateNavbarUser(user) {
    const loginLink = document.getElementById("loginLink");
    const profileLink = document.getElementById("profileLink");
    const logoutLink = document.getElementById("navbar-logout");
    const userDisplay = document.getElementById("user-display");
    const isAuth = !!(user && (user.name || user.email));

    if (userDisplay)
      userDisplay.textContent = isAuth ? (user.name || user.email || "") : "";
    if (loginLink) loginLink.style.display = isAuth ? "none" : "inline-block";
    if (profileLink) profileLink.style.display = isAuth ? "inline-block" : "none";
    if (logoutLink) logoutLink.style.display = isAuth ? "inline-block" : "none";
  }

  function wireLogout() {
    const logoutLink = document.getElementById("navbar-logout");
    if (!logoutLink) return;
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await window.auth.logout();
        window.appState = { cartCount: 0, wishlistCount: 0, lastFetch: 0 };
      } finally {
        location.href = "/";
      }
    });
  }

  // ------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------
  async function initializeNavbar() {
    // wait for session establishment
    if (window.auth?.initSession) {
      await window.auth.initSession();
    }

    const user = await (window.auth?.getCurrentUser?.() || null);
    updateNavbarUser(user);

    await updateNavbarCounts(true);
    wireLogout();

    setInterval(() => updateNavbarCounts(false), 60000);

    window.updateNavbarCounts = updateNavbarCounts;
    window.updateNavbarUser = updateNavbarUser;
  }

  document.addEventListener("DOMContentLoaded", initializeNavbar);
})();
