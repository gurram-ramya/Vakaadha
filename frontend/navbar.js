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

  // run on load
  document.addEventListener("DOMContentLoaded", updateNavbarCounts);

  // expose globally so other files call it
  window.updateNavbarCounts = updateNavbarCounts;

  // expose keys in case debugging is needed
  window.__VAKAADHA_KEYS = { CART_KEY, WISHLIST_KEY };
})();
