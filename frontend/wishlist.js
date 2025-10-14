// wishlist.js
(function () {
  const CART_KEY = "vakaadha_cart_v1";
  const WISHLIST_KEY = "vakaadha_wishlist_v1";

  async function getToken() {
    const user = firebase.auth().currentUser;
    return user ? await user.getIdToken() : null;
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"); }
    catch { return []; }
  }
  function writeLocal(val) { localStorage.setItem(WISHLIST_KEY, JSON.stringify(val || [])); }

  function updateNavbarCountsSafe() {
    if (typeof window.updateNavbarCounts === "function") window.updateNavbarCounts();
  }

  // -----------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------
  function renderWishlistItems(items) {
    const container = document.getElementById("wishlist-items");
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<p>Your wishlist is empty. <a href="index.html">Shop now</a></p>`;
      updateNavbarCountsSafe();
      return;
    }

    container.innerHTML = items
      .map((item, index) => `
        <div class="wishlist-card">
          <img src="${item.image_url || item.image || 'images/placeholder.png'}" alt="${item.name}">
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

  // -----------------------------------------------------------
  // Guest Wishlist Handlers
  // -----------------------------------------------------------
  function renderLocalWishlist() {
    const wishlist = readLocal();
    renderWishlistItems(wishlist);
  }

  function removeLocalWishlist(index) {
    const wishlist = readLocal();
    if (index < 0 || index >= wishlist.length) return;
    wishlist.splice(index, 1);
    writeLocal(wishlist);
    renderLocalWishlist();
  }

  function moveToCartLocal(index) {
    const wishlist = readLocal();
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (index < 0 || index >= wishlist.length) return;

    const item = wishlist[index];
    item.qty = 1;

    const exists = cart.find(c => String(c.id) === String(item.id));
    if (exists) exists.qty = (Number(exists.qty) || 1) + 1;
    else cart.push({ ...item, qty: 1 });

    wishlist.splice(index, 1);
    writeLocal(wishlist);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    renderLocalWishlist();
  }

  // -----------------------------------------------------------
  // Authenticated Wishlist Handlers
  // -----------------------------------------------------------
  async function fetchAndRenderWishlist(token) {
    try {
      const res = await fetch("/api/wishlist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch wishlist");
      const items = await res.json();
      renderWishlistItems(items);
    } catch (err) {
      console.error("Error loading wishlist:", err);
      renderLocalWishlist();
    }
  }

  async function removeServerWishlist(index) {
    try {
      const token = await getToken();
      const res = await fetch("/api/wishlist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = await res.json();
      const item = items[index];
      if (!item) return;

      await fetch(`/api/wishlist/${item.product_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAndRenderWishlist(token);
    } catch (err) {
      console.error("Error removing wishlist item:", err);
    }
  }

  async function moveToCartServer(index) {
    try {
      const token = await getToken();
      const res = await fetch("/api/wishlist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = await res.json();
      const item = items[index];
      if (!item) return;

      await fetch(`/api/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: item.product_id, qty: 1 }),
      });

      await fetch(`/api/wishlist/${item.product_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      await fetchAndRenderWishlist(token);
    } catch (err) {
      console.error("Error moving wishlist item to cart:", err);
    }
  }

  // -----------------------------------------------------------
  // Merge Guest Wishlist → Server on Login
  // -----------------------------------------------------------
  async function mergeGuestWishlist(token) {
    const guest = readLocal();
    if (!guest.length) return;

    const payload = guest.map(item => ({ product_id: item.id || item.product_id }));
    await fetch("/api/wishlist/merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: payload }),
    });
    localStorage.removeItem(WISHLIST_KEY);
  }

  // -----------------------------------------------------------
  // Auth State Initialization
  // -----------------------------------------------------------
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      const token = await user.getIdToken();
      await mergeGuestWishlist(token);
      await fetchAndRenderWishlist(token);
    } else {
      renderLocalWishlist();
    }
  });

  // -----------------------------------------------------------
  // Event Delegation
  // -----------------------------------------------------------
  document.addEventListener("click", async (e) => {
    if (e.target.closest(".remove-from-wishlist-btn")) {
      const idx = +e.target.closest(".remove-from-wishlist-btn").dataset.index;
      const user = firebase.auth().currentUser;
      if (user) await removeServerWishlist(idx);
      else removeLocalWishlist(idx);
    }

    if (e.target.closest(".move-to-cart-btn")) {
      const idx = +e.target.closest(".move-to-cart-btn").dataset.index;
      const user = firebase.auth().currentUser;
      if (user) await moveToCartServer(idx);
      else moveToCartLocal(idx);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const user = firebase.auth().currentUser;
    if (user) user.getIdToken().then(fetchAndRenderWishlist);
    else renderLocalWishlist();
  });
})();
