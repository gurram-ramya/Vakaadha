// // navbar.js
// import { getToken, clearAuth, apiRequest, resetGuestId } from "./api/client.js";

// (function () {
//   const WISHLIST_KEY = "vakaadha_wishlist_v1";

//   // -------------------------------------------------------------
//   // Fetch wishlist count
//   // -------------------------------------------------------------
//   async function fetchWishlistCount() {
//     try {
//       const user = firebase.auth().currentUser;
//       if (user) {
//         const token = await user.getIdToken();
//         const res = await fetch("/api/wishlist/count", {
//           headers: { Authorization: `Bearer ${token}` },
//         });

//         if (!res.ok) throw new Error("Wishlist count failed");
//         const data = await res.json();
//         return data?.count || 0;
//       }
//     } catch (err) {
//       console.warn("Wishlist count fallback to localStorage:", err);
//     }

//     // Guest fallback: localStorage
//     try {
//       const list = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
//       return Array.isArray(list) ? list.length : 0;
//     } catch {
//       return 0;
//     }
//   }

//   // -------------------------------------------------------------
//   // Fetch cart count
//   // -------------------------------------------------------------
//   async function fetchCartCount() {
//     try {
//       const cart = await apiRequest("/api/cart");
//       if (!cart || !Array.isArray(cart.items)) return 0;
//       return cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
//     } catch (err) {
//       console.warn("Cart count update failed:", err);
//       return 0;
//     }
//   }

//   // -------------------------------------------------------------
//   // Update navbar counts (wishlist + cart)
//   // -------------------------------------------------------------
//   async function updateNavbarCounts() {
//     const wishlistCount = await fetchWishlistCount();
//     const wishEl = document.getElementById("wishlistCount");
//     if (wishEl) wishEl.textContent = wishlistCount;

//     const cartCount = await fetchCartCount();
//     const cartEl = document.getElementById("cartCount");
//     if (cartEl) cartEl.textContent = cartCount || 0;
//   }

//   // -------------------------------------------------------------
//   // Auth UI
//   // -------------------------------------------------------------
//   function updateAuthUI() {
//     const token = getToken();
//     const loginLink = document.getElementById("loginLink");
//     const profileLink = document.getElementById("profileLink");
//     const logoutLink = document.getElementById("navbar-logout");

//     if (token) {
//       if (loginLink) loginLink.style.display = "none";
//       if (profileLink) profileLink.style.display = "inline-block";
//       if (logoutLink) logoutLink.style.display = "inline-block";
//     } else {
//       if (loginLink) loginLink.style.display = "inline-block";
//       if (profileLink) profileLink.style.display = "none";
//       if (logoutLink) logoutLink.style.display = "none";
//     }
//   }

//   // -------------------------------------------------------------
//   // Logout handler
//   // -------------------------------------------------------------
//   function wireLogout() {
//     const logoutLink = document.getElementById("navbar-logout");
//     if (!logoutLink) return;

//     logoutLink.addEventListener("click", async (e) => {
//       e.preventDefault();
//       try {
//         if (window.firebase && firebase.auth) {
//           await firebase.auth().signOut();
//         }
//       } catch (err) {
//         console.warn("Firebase signOut failed:", err);
//       }
//       clearAuth();
//       resetGuestId();
//       window.location.href = "index.html";
//     });
//   }

//   // -------------------------------------------------------------
//   // Init
//   // -------------------------------------------------------------
//   document.addEventListener("DOMContentLoaded", () => {
//     updateNavbarCounts();
//     updateAuthUI();
//     wireLogout();
//   });

//   // -------------------------------------------------------------
//   // Globals
//   // -------------------------------------------------------------
//   window.updateNavbarCounts = updateNavbarCounts;
//   window.refreshCartCount = updateNavbarCounts;

//   window.updateNavbarUser = function (me) {
//     const el = document.getElementById("user-display");
//     if (el) el.textContent = me?.name || me?.email || "";
//     updateAuthUI();
//     updateNavbarCounts();
//   };
// })();


// navbar.js
import { apiRequest } from "./api/client.js";

(function () {
  if (window.__navbar_js_bound__) return;
  window.__navbar_js_bound__ = true;

  const CART_ENDPOINT = "/api/cart";
  const WISHLIST_COUNT_ENDPOINT = "/api/wishlist/count";

  // -----------------------------
  // Fetch Cart Count
  // -----------------------------
  async function fetchCartCount() {
    const token = localStorage.getItem("auth_token");
    if (!token) return 0;

    try {
      const data = await apiRequest(CART_ENDPOINT);
      if (!data || !Array.isArray(data.items)) return 0;
      return data.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    } catch (err) {
      if (err?.status === 401) console.info("Cart count skipped (guest).");
      else console.warn("Cart count update failed:", err);
      return 0;
    }
  }

  // -----------------------------
  // Fetch Wishlist Count
  // -----------------------------
  async function fetchWishlistCount() {
    const token = localStorage.getItem("auth_token");
    if (!token) return 0;

    try {
      const res = await apiRequest(WISHLIST_COUNT_ENDPOINT);
      if (!res || typeof res.count !== "number") return 0;
      return res.count;
    } catch (err) {
      if (err?.status === 401) console.info("Wishlist count skipped (guest).");
      else console.warn("Wishlist count update failed:", err);
      return 0;
    }
  }

  // -----------------------------
  // Update Navbar Counts
  // -----------------------------
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

  // -----------------------------
  // Update Navbar User
  // -----------------------------
  function updateNavbarUser(user) {
    const loginLink = document.getElementById("loginLink");
    const profileLink = document.getElementById("profileLink");
    const logoutLink = document.getElementById("navbar-logout");
    const userDisplay = document.getElementById("user-display");

    const isAuth = !!(user && (user.name || user.email));

    if (userDisplay) userDisplay.textContent = isAuth ? (user.name || user.email || "") : "";

    if (loginLink) loginLink.style.display = isAuth ? "none" : "inline-block";
    if (profileLink) profileLink.style.display = isAuth ? "inline-block" : "none";
    if (logoutLink) logoutLink.style.display = isAuth ? "inline-block" : "none";
  }

  // -----------------------------
  // Wire Logout Handler
  // -----------------------------
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

  // -----------------------------
  // Initialize Navbar
  // -----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const user = await window.auth.getCurrentUser();
      updateNavbarUser(user);
    } catch {
      updateNavbarUser(null);
    }

    updateNavbarCounts();
    wireLogout();
  });

  // -----------------------------
  // Expose Globals
  // -----------------------------
  window.updateNavbarCounts = updateNavbarCounts;
  window.updateNavbarUser = updateNavbarUser;
})();
