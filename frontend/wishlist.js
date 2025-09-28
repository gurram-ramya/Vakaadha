
// wishlist.js
(function () {
  const CART_KEY = "vakaadha_cart_v1";
  const WISHLIST_KEY = "vakaadha_wishlist_v1";

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { return []; }
  }
  function write(key, val) { localStorage.setItem(key, JSON.stringify(val || [])); }

  function updateNavbarCountsSafe() {
    if (typeof window.updateNavbarCounts === "function") window.updateNavbarCounts();
  }

  function renderWishlist() {
    const wishlist = read(WISHLIST_KEY);
    const container = document.getElementById("wishlist-items");
    if (!container) return;

    if (!wishlist.length) {
      container.innerHTML = `<p>Your wishlist is empty. <a href="index.html">Shop now</a></p>`;
      updateNavbarCountsSafe();
      return;
    }

    container.innerHTML = wishlist
      .map((item, index) => `
        <div class="wishlist-card">
          <img src="${item.image || 'images/placeholder.png'}" alt="${item.name}">
          <h3>${item.name}</h3>
          <p>₹${item.price}</p>
          <div class="wishlist-actions">
            <button class="move-to-cart-btn" data-index="${index}">Move to Cart</button>
            <button class="remove-from-wishlist-btn" data-index="${index}">Remove</button>
          </div>
        </div>
      `)
      .join("");
    updateNavbarCountsSafe();
  }

  function moveToCart(index) {
    const wishlist = read(WISHLIST_KEY);
    const cart = read(CART_KEY);
    if (index < 0 || index >= wishlist.length) return;

    const item = wishlist[index];
    item.qty = 1;

    const exists = cart.find(c => String(c.id) === String(item.id) && (c.size || "") === (item.size || ""));
    if (exists) exists.qty = (Number(exists.qty) || 1) + 1;
    else cart.push({ ...item, qty: 1 });

    wishlist.splice(index, 1);
    write(WISHLIST_KEY, wishlist);
    write(CART_KEY, cart);

    renderWishlist();
    updateNavbarCountsSafe();
  }

  function removeFromWishlist(index) {
    const wishlist = read(WISHLIST_KEY);
    if (index < 0 || index >= wishlist.length) return;
    wishlist.splice(index, 1);
    write(WISHLIST_KEY, wishlist);
    renderWishlist();
    updateNavbarCountsSafe();
  }

  // ✅ Event delegation for buttons
  document.addEventListener("click", (e) => {
    if (e.target.closest(".move-to-cart-btn")) {
      const idx = +e.target.closest(".move-to-cart-btn").dataset.index;
      moveToCart(idx);
    }
    if (e.target.closest(".remove-from-wishlist-btn")) {
      const idx = +e.target.closest(".remove-from-wishlist-btn").dataset.index;
      removeFromWishlist(idx);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    renderWishlist();
    updateNavbarCountsSafe();
  });
})();
