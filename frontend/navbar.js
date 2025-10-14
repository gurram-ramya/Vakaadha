// navbar.js
import { getToken, clearAuth, apiRequest, resetGuestId } from "./api/client.js";

(function () {
  const WISHLIST_KEY = "vakaadha_wishlist_v1";

  // -------------------------------------------------------------
  // Fetch wishlist count
  // -------------------------------------------------------------
  async function fetchWishlistCount() {
    try {
      const user = firebase.auth().currentUser;
      if (user) {
        const token = await user.getIdToken();
        const res = await fetch("/api/wishlist/count", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Wishlist count failed");
        const data = await res.json();
        return data?.count || 0;
      }
    } catch (err) {
      console.warn("Wishlist count fallback to localStorage:", err);
    }

    // Guest fallback: localStorage
    try {
      const list = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  }

  // -------------------------------------------------------------
  // Fetch cart count
  // -------------------------------------------------------------
  async function fetchCartCount() {
    try {
      const cart = await apiRequest("/api/cart");
      if (!cart || !Array.isArray(cart.items)) return 0;
      return cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    } catch (err) {
      console.warn("Cart count update failed:", err);
      return 0;
    }
  }

  // -------------------------------------------------------------
  // Update navbar counts (wishlist + cart)
  // -------------------------------------------------------------
  async function updateNavbarCounts() {
    const wishlistCount = await fetchWishlistCount();
    const wishEl = document.getElementById("wishlistCount");
    if (wishEl) wishEl.textContent = wishlistCount;

    const cartCount = await fetchCartCount();
    const cartEl = document.getElementById("cartCount");
    if (cartEl) cartEl.textContent = cartCount || 0;
  }

  // -------------------------------------------------------------
  // Auth UI
  // -------------------------------------------------------------
  function updateAuthUI() {
    const token = getToken();
    const loginLink = document.getElementById("loginLink");
    const profileLink = document.getElementById("profileLink");
    const logoutLink = document.getElementById("navbar-logout");

    if (token) {
      if (loginLink) loginLink.style.display = "none";
      if (profileLink) profileLink.style.display = "inline-block";
      if (logoutLink) logoutLink.style.display = "inline-block";
    } else {
      if (loginLink) loginLink.style.display = "inline-block";
      if (profileLink) profileLink.style.display = "none";
      if (logoutLink) logoutLink.style.display = "none";
    }
  }

  // -------------------------------------------------------------
  // Logout handler
  // -------------------------------------------------------------
  function wireLogout() {
    const logoutLink = document.getElementById("navbar-logout");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (window.firebase && firebase.auth) {
          await firebase.auth().signOut();
        }
      } catch (err) {
        console.warn("Firebase signOut failed:", err);
      }
      clearAuth();
      resetGuestId();
      window.location.href = "index.html";
    });
  }

  // -------------------------------------------------------------
  // Init
  // -------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    updateNavbarCounts();
    updateAuthUI();
    wireLogout();
  });

  // -------------------------------------------------------------
  // Globals
  // -------------------------------------------------------------
  window.updateNavbarCounts = updateNavbarCounts;
  window.refreshCartCount = updateNavbarCounts;

  window.updateNavbarUser = function (me) {
    const el = document.getElementById("user-display");
    if (el) el.textContent = me?.name || me?.email || "";
    updateAuthUI();
    updateNavbarCounts();
  };
})();
