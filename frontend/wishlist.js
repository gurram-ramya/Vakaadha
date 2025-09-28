// ==============================
// frontend/wishlist.js
// Clean style wishlist
// ==============================

// import { apiClient } from "./api/client.js";

// const wishlistContainer = document.getElementById("wishlist-items");
// const guestPrompt = document.getElementById("wishlist-guest");

// // Load wishlist
// async function loadWishlist() {
//   const stored = JSON.parse(localStorage.getItem("loggedInUser"));
//   if (!stored || !stored.idToken) {
//     guestPrompt.style.display = "block";
//     wishlistContainer.style.display = "none";
//     return;
//   }

//   try {
//     const items = await apiClient.get("users/me/wishlist");
//     renderWishlist(items);
//   } catch (err) {
//     console.error("Failed to load wishlist:", err);
//     guestPrompt.style.display = "block";
//     wishlistContainer.style.display = "none";
//   }
// }

// // Render wishlist items
// function renderWishlist(items) {
//   wishlistContainer.innerHTML = "";

//   if (!items || items.length === 0) {
//     wishlistContainer.innerHTML = "<p style='text-align:center;'>Your wishlist is empty.</p>";
//     return;
//   }

//   items.forEach(item => {
//     const card = document.createElement("div");
//     card.className = "wishlist-card";
//     card.innerHTML = `
//       <img src="${item.image_url || './Images/placeholder.png'}" alt="${item.name}">
//       <h3>${item.name}</h3>
//       <p>₹${(item.price_cents / 100).toFixed(2)}</p>
//       <button class="cart-btn" data-id="${item.product_id}">Move to Cart</button>
//       <button class="remove-btn" data-id="${item.product_id}">Remove</button>
//     `;
//     wishlistContainer.appendChild(card);
//   });

//   // Attach events
//   document.querySelectorAll(".remove-btn").forEach(btn => {
//     btn.addEventListener("click", async e => {
//       const productId = e.target.dataset.id;
//       await apiClient.delete(`users/me/wishlist/${productId}`);
//       loadWishlist();
//     });
//   });

//   document.querySelectorAll(".cart-btn").forEach(btn => {
//     btn.addEventListener("click", async e => {
//       const productId = e.target.dataset.id;
//       await apiClient.post("users/me/cart", { product_id: productId, quantity: 1 });
//       await apiClient.delete(`users/me/wishlist/${productId}`);
//       loadWishlist();
//     });
//   });
// }

// // Init
// document.addEventListener("DOMContentLoaded", loadWishlist);


// ============================================
// LOCALSTORAGE-BASED WISHLIST (No login needed)
// ============================================
// document.addEventListener("DOMContentLoaded", () => {
//   renderWishlist();
//   updateCounts();
// });

// function getCart() {
//   return JSON.parse(localStorage.getItem("cart")) || [];
// }
// function getWishlist() {
//   return JSON.parse(localStorage.getItem("wishlist")) || [];
// }
// function saveCart(cart) {
//   localStorage.setItem("cart", JSON.stringify(cart));
// }
// function saveWishlist(wishlist) {
//   localStorage.setItem("wishlist", JSON.stringify(wishlist));
// }
// function updateCounts() {
//   document.getElementById("cartCount").textContent = getCart().length;
//   document.getElementById("wishlistCount").textContent = getWishlist().length;
// }

// function renderWishlist() {
//   const wishlist = getWishlist();
//   const container = document.getElementById("wishlist-items");

//   if (wishlist.length === 0) {
//     container.innerHTML = `<p>Your wishlist is empty. <a href="index.html">Shop now</a></p>`;
//     return;
//   }

//   container.innerHTML = wishlist
//     .map(
//       (item, index) => `
//     <div class="wishlist-card">
//       <img src="${item.image}" alt="${item.name}">
//       <h3>${item.name}</h3>
//       <p>₹${item.price}</p>
//       <button onclick="moveToCart(${index})">Move to Cart</button>
//       <button onclick="removeFromWishlist(${index})">Remove</button>
//     </div>
//   `
//     )
//     .join("");
// }

// window.moveToCart = function (index) {
//   const wishlist = getWishlist();
//   const cart = getCart();

//   const item = wishlist[index];
//   item.qty = 1;

//   const exists = cart.find((c) => c.id === item.id);
//   if (exists) {
//     exists.qty += 1;
//   } else {
//     cart.push(item);
//   }

//   wishlist.splice(index, 1);
//   saveWishlist(wishlist);
//   saveCart(cart);

//   renderWishlist();
//   updateCounts();
// };

// window.removeFromWishlist = function (index) {
//   const wishlist = getWishlist();
//   wishlist.splice(index, 1);
//   saveWishlist(wishlist);

//   renderWishlist();
//   updateCounts();
// };


// window.addToWishlist = function (product) {
//   const wishlist = getWishlist();

//   // check if already in wishlist
//   if (wishlist.find(item => item.id === product.id)) {
//     // alert("This product is already in your wishlist!");
//     return;
//   }

//   wishlist.push(product);
//   saveWishlist(wishlist);
//   updateCounts();

//   // alert("Added to wishlist!");
// };

// wishlist.js
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
