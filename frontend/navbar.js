// ============================================================
// navbar.js — Phase 2 Final (with caching + 410 handling)
// ============================================================

import { apiRequest } from "./api/client.js";

(function () {
  if (window.__navbar_js_bound__) return;
  window.__navbar_js_bound__ = true;

  const CART_ENDPOINT = "/api/cart";
  const WISHLIST_COUNT_ENDPOINT = "/api/wishlist/count";

  // Shared cache across pages
  window.appState = window.appState || {
    cartCount: 0,
    wishlistCount: 0,
    lastFetch: 0,
  };

  // ------------------------------------------------------------
  // Fetch Cart Count (with 410 handling)
  // ------------------------------------------------------------
  async function fetchCartCount(force = false) {
    const now = Date.now();
    if (!force && now - window.appState.lastFetch < 60000) {
      return window.appState.cartCount;
    }
    try {
      const data = await apiRequest(CART_ENDPOINT, { method: "GET" });
      const items = Array.isArray(data.items) ? data.items : [];
      const count = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      window.appState.cartCount = count;
      window.appState.lastFetch = now;
      return count;
    } catch (err) {
      if (err.status === 410) {
        console.warn("Guest cart expired");
        window.appState.cartCount = 0;
        return 0;
      }
      console.warn("Cart count fetch failed:", err);
      return 0;
    }
  }

  // ------------------------------------------------------------
  // Fetch Wishlist Count
  // ------------------------------------------------------------
  async function fetchWishlistCount(force = false) {
    const now = Date.now();
    if (!force && now - window.appState.lastFetch < 60000) {
      return window.appState.wishlistCount;
    }
    const token = localStorage.getItem("auth_token");
    if (!token) return 0;

    try {
      const res = await apiRequest(WISHLIST_COUNT_ENDPOINT, { method: "GET" });
      const count = typeof res.count === "number" ? res.count : 0;
      window.appState.wishlistCount = count;
      window.appState.lastFetch = now;
      return count;
    } catch (err) {
      console.warn("Wishlist count fetch failed:", err);
      return 0;
    }
  }

  // ------------------------------------------------------------
  // Update Navbar Counts
  // ------------------------------------------------------------
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
    } catch (err) {
      console.warn("Navbar count update failed:", err);
      if (cartEl) cartEl.textContent = "0";
      if (wishEl) wishEl.textContent = "0";
    }
  }

  // ------------------------------------------------------------
  // Update Navbar User Info
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
  // Wire Logout Handler
  // ------------------------------------------------------------
  function wireLogout() {
    const logoutLink = document.getElementById("navbar-logout");
    if (!logoutLink) return;
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await window.auth.logout();
        window.appState = { cartCount: 0, wishlistCount: 0, lastFetch: 0 };
        window.location.href = "index.html";
      } catch (err) {
        console.warn("Logout failed:", err);
      }
    });
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const user = await window.auth.getCurrentUser();
      updateNavbarUser(user);
    } catch {
      updateNavbarUser(null);
    }

    await updateNavbarCounts(true);
    wireLogout();

    // Periodic refresh every 60s
    setInterval(() => updateNavbarCounts(false), 60000);

    // Global access
    window.updateNavbarCounts = updateNavbarCounts;
    window.updateNavbarUser = updateNavbarUser;
  });
})();
