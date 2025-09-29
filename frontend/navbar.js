// navbar.js
(function () {
  const CART_KEY = "vakaadha_cart_v1";
  const WISHLIST_KEY = "vakaadha_wishlist_v1";

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { return []; }
  }

  function updateNavbarCounts() {
    const cart = read(CART_KEY);
    const wishlist = read(WISHLIST_KEY);

    const cartCount = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0) : 0;
    const wishlistCount = Array.isArray(wishlist) ? wishlist.length : 0;

    const cartEl = document.getElementById("cartCount");
    const wishEl = document.getElementById("wishlistCount");

    if (cartEl) cartEl.textContent = cartCount;
    if (wishEl) wishEl.textContent = wishlistCount;
  }

  function updateAuthUI() {
    const auth = JSON.parse(localStorage.getItem("loggedInUser") || "null");
    const loginLink = document.getElementById("loginLink");
    const profileLink = document.getElementById("profileLink");
    const logoutLink = document.getElementById("navbar-logout");


    if (auth && auth.idToken) {
      if (loginLink) loginLink.style.display = "none";
      if (profileLink) profileLink.style.display = "inline-block";
      if (logoutLink) logoutLink.style.display = "inline-block";
    } else {
      if (loginLink) loginLink.style.display = "inline-block";
      if (profileLink) profileLink.style.display = "none";
      if (logoutLink) logoutLink.style.display = "none";
    }
  }

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
      localStorage.removeItem("loggedInUser");
      window.location.href = "index.html";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateNavbarCounts();
    updateAuthUI();
    wireLogout();
  });

  // expose globally
  window.updateNavbarCounts = updateNavbarCounts;
  window.__VAKAADHA_KEYS = { CART_KEY, WISHLIST_KEY };

  // add helper for user display
  window.updateNavbarUser = function (user) {
    const el = document.getElementById("user-display");
    if (!el) return;
    el.textContent = user?.name || user?.email || "";
  };  

})();
