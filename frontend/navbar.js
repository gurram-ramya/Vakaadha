// ============================================================
// navbar.js — Auth-first; unified token/guest logic
// Updated to support new login.html / profile.html routing
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

  // ------------------------------------------------------------------
  // ADDED: simple helper to check if user is authenticated
  // ------------------------------------------------------------------
  function isLoggedIn() {
    const token = localStorage.getItem("auth_token");
    return !!token;
  }

  // ------------------------------------------------------------
  // Core request
  // ------------------------------------------------------------
  async function safeApiRequest(endpoint, options = {}) {
    const token = localStorage.getItem("auth_token");
    const guestId = !token ? localStorage.getItem("guest_id") : null;
    const headers = options.headers || {};

    if (token) headers["Authorization"] = `Bearer ${token}`;
    const url = guestId ? `${endpoint}?guest_id=${guestId}` : endpoint;

    try {
      return await window.apiRequest(url, { ...options, headers });
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
  // Global auth shim
  // ------------------------------------------------------------
  window.auth = {
    async initSession() {
      const auth = getAuth?.();
      if (!auth) return null;
      return auth;
    },
    async getCurrentUser() {
      const auth = getAuth?.();
      return auth ? { name: auth.name, email: auth.email } : null;
    },
    async getToken() {
      const auth = getAuth?.();
      return auth ? auth.idToken : null;
    },
    async logout() {
      try {
        const fbAuth = firebase.auth();
        await fbAuth.signOut(); // ensures onAuthStateChanged(null)
      } catch (e) {
        console.warn("Firebase signOut error:", e);
      }
      clearAuth?.();
      localStorage.removeItem("auth_token");
      localStorage.removeItem("guest_id");
    },
  };

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

  // ------------------------------------------------------------
  // Logout handler
  // ------------------------------------------------------------
  function wireLogout() {
    const logoutLink = document.getElementById("navbar-logout");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      window.__logout_in_progress__ = true;

      try {
        await window.auth.logout();
        window.appState = { cartCount: 0, wishlistCount: 0, lastFetch: 0 };
      } finally {
        updateNavbarUser(null);

        // ------------------------------------------------------------------
        // REMOVED: old profile DOM manipulation for profile.html inline login
        // ADDED: universal redirect to homepage after logout
        // ------------------------------------------------------------------
        location.href = "/";
      }
    });
  }

  // ------------------------------------------------------------
  // ADDED: Handle profile icon click → login.html OR profile.html
  // ------------------------------------------------------------
  function wireProfileIconRouting() {
    const profileAnchor = document.querySelector('a[href="./profile.html"]');
    if (!profileAnchor) return;

    profileAnchor.addEventListener("click", (e) => {
      e.preventDefault();

      if (isLoggedIn()) {
        // user is authenticated → go to profile
        window.location.href = "profile.html";
      } else {
        // user not authenticated → go to login
        window.location.href = "login.html";
      }
    });
  }

  // ------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------
  async function initializeNavbar() {
    if (window.auth?.initSession) await window.auth.initSession();
    const user = await (window.auth?.getCurrentUser?.() || null);

    updateNavbarUser(user);
    await updateNavbarCounts(true);

    wireLogout();
    wireProfileIconRouting();   // <--- ADDED

    setInterval(() => updateNavbarCounts(false), 60000);

    window.updateNavbarCounts = updateNavbarCounts;
    window.updateNavbarUser = updateNavbarUser;
  }

  document.addEventListener("DOMContentLoaded", initializeNavbar);
})();
