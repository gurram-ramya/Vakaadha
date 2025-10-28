// // ============================================================
// // cart.js — Vakaadha Cart Service Frontend (Phase 2 Final)
// // REST-aligned, consistent with existing cart.html + styles
// // ============================================================

// (function () {
//   const itemsContainer = document.getElementById("cart-items");
//   const emptyEl = document.getElementById("cart-empty");
//   const summaryEl = document.getElementById("cart-summary");
//   const subtotalEl = document.getElementById("cart-subtotal");
//   const totalEl = document.getElementById("cart-total");
//   const checkoutBtn = document.getElementById("checkout-btn");
//   const clearBtn = document.getElementById("clear-cart-btn");
//   const toastEl = document.getElementById("toast");

//   // ----------------------------
//   // Toast utility
//   // ----------------------------
//   function toast(msg, bad = false, ms = 2200) {
//     if (!toastEl) return;
//     toastEl.textContent = msg;
//     toastEl.style.background = bad ? "#b00020" : "#333";
//     toastEl.style.opacity = "1";
//     clearTimeout(toast._t);
//     toast._t = setTimeout(() => (toastEl.style.opacity = "0"), ms);
//   }

//   // ----------------------------
//   // Render cart contents
//   // ----------------------------
//   function renderCart(cart) {
//     if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
//       showEmpty();
//       return;
//     }

//     emptyEl.classList.add("hidden");
//     summaryEl.classList.remove("hidden");
//     checkoutBtn.disabled = false;

//     const html = cart.items
//       .map((item) => {
//         const img = item.image_url || "Images/default.jpg";
//         const name = item.product_name || item.name || "Product";  // ✅ fix name
//         const price = (item.price_cents / 100).toFixed(2);
//         const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);
//         let lockBadge = "";
//         if (item.locked_price_until && new Date(item.locked_price_until) > new Date()) {
//           const until = new Date(item.locked_price_until).toLocaleDateString();
//           lockBadge = `<div class="lock-badge">Locked until ${until}</div>`;
//         }

//         return `
//           <div class="cart-item" data-id="${item.cart_item_id}">
//             <div class="cart-item-left">
//               <img src="${img}" alt="${name}" /> <!-- ✅ fixed -->
//             </div>
//             <div class="cart-item-right">
//               <h3>${name}</h3> <!-- ✅ fixed -->
//               <p class="variant">${item.size || ""} ${item.color || ""}</p>
//               <p class="price">₹${price}</p>
//               ${lockBadge}
//               <div class="quantity-control">
//                 <button class="qty-btn minus">−</button>
//                 <input type="number" min="1" value="${item.quantity}" />
//                 <button class="qty-btn plus">+</button>
//               </div>
//               <div class="item-actions">
//                 <span class="item-subtotal">₹${subtotal}</span>
//                 <button class="remove-btn"><i class="fas fa-trash"></i></button>
//               </div>
//             </div>
//           </div>`;
//       })
//       .join("");

//     itemsContainer.innerHTML = html;

//     // Totals
//     const subtotal =
//       cart.totals?.subtotal_cents ??
//       cart.items.reduce((s, i) => s + i.price_cents * i.quantity, 0);
//     const total =
//       cart.totals?.total_cents ??
//       cart.items.reduce((s, i) => s + i.price_cents * i.quantity, 0);

//     subtotalEl.textContent = `₹${(subtotal / 100).toFixed(2)}`;
//     totalEl.textContent = `₹${(total / 100).toFixed(2)}`;
//   }

//   // ----------------------------
//   // Empty-state helper
//   // ----------------------------
//   function showEmpty() {
//     itemsContainer.innerHTML = "";
//     emptyEl.classList.remove("hidden");
//     summaryEl.classList.add("hidden");
//     checkoutBtn.disabled = true;
//     subtotalEl.textContent = "₹0.00";
//     totalEl.textContent = "₹0.00";
//     updateNavbarCounts?.(true);
//   }

//   // ----------------------------
//   // Fetch + render
//   // ----------------------------
//   async function loadCart() {
//     try {
//       const cart = await CartAPI.get();
//       if (!cart || cart.error) {
//         showEmpty();
//         toast("Unable to load cart", true);
//         return;
//       }
//       if (cart?.expired || cart?.status === 410) {
//         toast("Your cart session expired", true);
//         showEmpty();
//         return;
//       }
//       renderCart(cart);
//     } catch (err) {
//       if (err.status === 410) {
//         toast("Your cart session expired", true);
//         showEmpty();
//       } else {
//         console.error("Cart load failed:", err);
//         toast("Error loading cart", true);
//       }
//     }
//   }



//   // ----------------------------
//   // Quantity update
//   // ----------------------------
//   async function updateQuantity(id, quantity) {
//     try {
//       if (quantity <= 0) return removeItem(id);
//       await CartAPI.patch({ cart_item_id: id, quantity });
//       await refresh();
//       updateNavbarCounts?.(true); // ADD THIS LINE ✅
//     } catch (err) {
//       handleError(err, "Failed to update quantity");
//     }
//   }

//   // ----------------------------
//   // Remove item
//   // ----------------------------
//   async function removeItem(id) {
//     try {
//       await CartAPI.remove(id);
//       toast("Item removed");
//       await refresh();
//       updateNavbarCounts?.(true); // ADD THIS LINE ✅
//     } catch (err) {
//       handleError(err, "Failed to remove item");
//     }
//   }


//   // ----------------------------
//   // Clear cart
//   // ----------------------------
//   async function clearCart() {
//     try {
//       await CartAPI.clear();
//       toast("Cart cleared");
//       await refresh();
//       updateNavbarCounts?.(true); // ADD THIS LINE ✅
//     } catch (err) {
//       handleError(err, "Failed to clear cart");
//     }
//   }
//   // ----------------------------
//   // Error handler
//   // ----------------------------
//   function handleError(err, fallback) {
//     if (!err) return toast(fallback, true);
//     switch (err.status) {
//       case 400:
//         toast("Bad request", true);
//         break;
//       case 409:
//         toast("Out of stock or inventory updated", true);
//         break;
//       case 410:
//         toast("Cart expired", true);
//         showEmpty();
//         break;
//       default:
//         toast(fallback, true);
//     }
//   }

//   // ----------------------------
//   // Refresh cart + navbar
//   // ----------------------------
//   async function refresh() {
//     await loadCart();
//     updateNavbarCounts?.(true);
//   }

//   // ----------------------------
//   // Event delegation
//   // ----------------------------
//   document.addEventListener("click", (e) => {
//     const minus = e.target.closest(".qty-btn.minus");
//     const plus = e.target.closest(".qty-btn.plus");
//     const remove = e.target.closest(".remove-btn");
//     const clear = e.target.closest("#clear-cart-btn");
//     const checkout = e.target.closest("#checkout-btn");

//     if (minus || plus) {
//       const item = e.target.closest(".cart-item");
//       const input = item.querySelector("input");
//       let qty = Number(input.value);
//       qty += plus ? 1 : -1;
//       if (qty < 1) qty = 1;
//       input.value = qty;
//       updateQuantity(Number(item.dataset.id), qty);
//     }

//     if (remove) {
//       const id = Number(e.target.closest(".cart-item").dataset.id);
//       removeItem(id);
//     }

//     if (clear) clearCart();

//     if (checkout) window.location.href = "checkout.html";
//   });

//   // ----------------------------
//   // Init
//   // ----------------------------
//   document.addEventListener("DOMContentLoaded", () => {
//     loadCart();
//   });
// })();


// ============================================================
// cart.js — Revised for Auth/Guest Consistency
// ============================================================

(function () {
  const itemsContainer = document.getElementById("cart-items");
  const emptyEl = document.getElementById("cart-empty");
  const summaryEl = document.getElementById("cart-summary");
  const subtotalEl = document.getElementById("cart-subtotal");
  const totalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout-btn");
  const clearBtn = document.getElementById("clear-cart-btn");
  const toastEl = document.getElementById("toast");

  // ----------------------------
  // Toast utility
  // ----------------------------
  function toast(msg, bad = false, ms = 2200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.background = bad ? "#b00020" : "#333";
    toastEl.style.opacity = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toastEl.style.opacity = "0"), ms);
  }

  // ----------------------------
  // API helpers
  // ----------------------------
  function getGuestId() {
    try { return localStorage.getItem("guest_id") || null; } catch { return null; }
  }

  async function safeApi(endpoint, options = {}) {
    const guestId = getGuestId();
    const url = guestId ? `${endpoint}?guest_id=${guestId}` : endpoint;
    const token = localStorage.getItem("auth_token");
    const headers = options.headers || {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return await window.apiRequest(url, { ...options, headers });
  }

  const CartAPI = {
    async get()      { return safeApi("/api/cart", { method: "GET" }); },
    async patch(b)   { return safeApi("/api/cart", { method: "PATCH", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } }); },
    async remove(id) { return safeApi(`/api/cart/${id}`, { method: "DELETE" }); },
    async clear()    { return safeApi("/api/cart/clear", { method: "DELETE" }); },
  };

  // ----------------------------
  // Render cart
  // ----------------------------
  function renderCart(cart) {
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      showEmpty();
      return;
    }
    emptyEl.classList.add("hidden");
    summaryEl.classList.remove("hidden");
    checkoutBtn.disabled = false;

    const html = cart.items.map((item) => {
      const img = item.image_url || "Images/default.jpg";
      const name = item.product_name || item.name || "Product";
      const price = (item.price_cents / 100).toFixed(2);
      const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);
      let lockBadge = "";
      if (item.locked_price_until && new Date(item.locked_price_until) > new Date()) {
        const until = new Date(item.locked_price_until).toLocaleDateString();
        lockBadge = `<div class="lock-badge">Locked until ${until}</div>`;
      }
      return `
        <div class="cart-item" data-id="${item.cart_item_id}">
          <div class="cart-item-left"><img src="${img}" alt="${name}" /></div>
          <div class="cart-item-right">
            <h3>${name}</h3>
            <p class="variant">${item.size || ""} ${item.color || ""}</p>
            <p class="price">₹${price}</p>
            ${lockBadge}
            <div class="quantity-control">
              <button class="qty-btn minus">−</button>
              <input type="number" min="1" value="${item.quantity}" />
              <button class="qty-btn plus">+</button>
            </div>
            <div class="item-actions">
              <span class="item-subtotal">₹${subtotal}</span>
              <button class="remove-btn"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>`;
    }).join("");
    itemsContainer.innerHTML = html;

    const subtotal = cart.totals?.subtotal_cents ??
      cart.items.reduce((s, i) => s + i.price_cents * i.quantity, 0);
    const total = cart.totals?.total_cents ??
      cart.items.reduce((s, i) => s + i.price_cents * i.quantity, 0);

    subtotalEl.textContent = `₹${(subtotal / 100).toFixed(2)}`;
    totalEl.textContent = `₹${(total / 100).toFixed(2)}`;
  }

  function showEmpty() {
    itemsContainer.innerHTML = "";
    emptyEl.classList.remove("hidden");
    summaryEl.classList.add("hidden");
    checkoutBtn.disabled = true;
    subtotalEl.textContent = "₹0.00";
    totalEl.textContent = "₹0.00";
    updateNavbarCounts?.(true);
  }

  // ----------------------------
  // Load + refresh
  // ----------------------------
  async function loadCart() {
    try {
      const cart = await CartAPI.get();
      if (!cart || cart.error || cart.expired) { showEmpty(); toast("Cart unavailable", true); return; }
      renderCart(cart);
    } catch (err) {
      if (err.status === 410) { toast("Cart expired", true); showEmpty(); }
      else { toast("Error loading cart", true); console.error(err); }
    }
  }

  async function refresh() {
    await loadCart();
    updateNavbarCounts?.(true);
  }

  // ----------------------------
  // Item ops
  // ----------------------------
  async function updateQuantity(id, quantity) {
    try {
      if (quantity <= 0) return removeItem(id);
      await CartAPI.patch({ cart_item_id: id, quantity });
      await refresh();
    } catch (err) { handleError(err, "Failed to update quantity"); }
  }

  async function removeItem(id) {
    try { await CartAPI.remove(id); toast("Item removed"); await refresh(); }
    catch (err) { handleError(err, "Failed to remove item"); }
  }

  async function clearCart() {
    try { await CartAPI.clear(); toast("Cart cleared"); await refresh(); }
    catch (err) { handleError(err, "Failed to clear cart"); }
  }

  // ----------------------------
  // Error handler
  // ----------------------------
  function handleError(err, fallback) {
    if (!err) return toast(fallback, true);
    switch (err.status) {
      case 400: toast("Bad request", true); break;
      case 409: toast("Out of stock", true); break;
      case 410: toast("Cart expired", true); showEmpty(); break;
      default: toast(fallback, true);
    }
  }

  // ----------------------------
  // Event wiring
  // ----------------------------
  document.addEventListener("click", (e) => {
    const minus = e.target.closest(".qty-btn.minus");
    const plus = e.target.closest(".qty-btn.plus");
    const remove = e.target.closest(".remove-btn");
    const clear = e.target.closest("#clear-cart-btn");
    const checkout = e.target.closest("#checkout-btn");

    if (minus || plus) {
      const item = e.target.closest(".cart-item");
      const input = item.querySelector("input");
      let qty = Number(input.value);
      qty += plus ? 1 : -1;
      if (qty < 1) qty = 1;
      input.value = qty;
      updateQuantity(Number(item.dataset.id), qty);
    }
    if (remove) removeItem(Number(e.target.closest(".cart-item").dataset.id));
    if (clear) clearCart();
    if (checkout) window.location.href = "checkout.html";
  });

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await window.auth.initSession(); // ensure session context ready
    await loadCart();
  });
})();
