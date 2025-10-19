

// navbar.js — unified for guest + user carts
import { apiRequest } from "./api/client.js";

(function () {
  if (window.__navbar_js_bound__) return;
  window.__navbar_js_bound__ = true;

  const CART_ENDPOINT = "/api/cart";
  const WISHLIST_COUNT_ENDPOINT = "/api/wishlist/count";

  // =============================================================
  // Fetch Cart Count — supports both guest + logged-in users
  // =============================================================
  async function fetchCartCount() {
    try {
      const data = await apiRequest(CART_ENDPOINT, { method: "GET" });

      // ✅ backend returns { cart_id, items }
      if (!data || !Array.isArray(data.items)) return 0;

      // ✅ sum of item quantities
      return data.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    } catch (err) {
      console.warn("Cart count update failed:", err);
      return 0;
    }
  }

  // =============================================================
  // Fetch Wishlist Count (only if user logged in)
  // =============================================================
  async function fetchWishlistCount() {
    const token = localStorage.getItem("auth_token");
    if (!token) return 0;

    try {
      const res = await apiRequest(WISHLIST_COUNT_ENDPOINT, { method: "GET" });
      if (!res || typeof res.count !== "number") return 0;
      return res.count;
    } catch (err) {
      console.warn("Wishlist count update failed:", err);
      return 0;
    }
  }

  // =============================================================
  // Update Navbar Counts
  // =============================================================
  async function updateNavbarCounts() {
    const cartEl = document.getElementById("cartCount");
    const wishEl = document.getElementById("wishlistCount");
    if (!cartEl && !wishEl) return;

    try {
      const [cartCount, wishlistCount] = await Promise.all([
        fetchCartCount(),
        fetchWishlistCount(),
      ]);

      if (cartEl) cartEl.textContent = cartCount || 0;
      if (wishEl) wishEl.textContent = wishlistCount || 0;
    } catch (err) {
      console.warn("Navbar count update failed:", err);
      if (cartEl) cartEl.textContent = "0";
      if (wishEl) wishEl.textContent = "0";
    }
  }

  // =============================================================
  // Update Navbar User Info
  // =============================================================
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

  // =============================================================
  // Wire Logout Handler
  // =============================================================
  function wireLogout() {
    const logoutLink = document.getElementById("navbar-logout");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await window.auth.logout();
        window.location.href = "index.html";
      } catch (err) {
        console.warn("Logout failed:", err);
      }
    });
  }

  // =============================================================
  // Initialize Navbar
  // =============================================================
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const user = await window.auth.getCurrentUser();
      updateNavbarUser(user);
    } catch {
      updateNavbarUser(null);
    }

    await updateNavbarCounts();
    wireLogout();

    // Expose globally for product.js & script.js
    window.updateNavbarCounts = updateNavbarCounts;
    window.updateNavbarUser = updateNavbarUser;
  });
})();
