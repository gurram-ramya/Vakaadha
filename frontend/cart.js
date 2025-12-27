// // ============================================================
// // cart.js — With Item Selection + Selected Checkout
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
//   // Toast
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
//   // Helpers
//   // ----------------------------
//   function getGuestId() {
//     try {
//       return localStorage.getItem("guest_id") || null;
//     } catch {
//       return null;
//     }
//   }

//   async function safeApi(endpoint, options = {}) {
//     const guestId = getGuestId();
//     const url = guestId ? `${endpoint}?guest_id=${guestId}` : endpoint;
//     const token = localStorage.getItem("auth_token");
//     const headers = options.headers || {};
//     if (token) headers["Authorization"] = `Bearer ${token}`;
//     return await window.apiRequest(url, { ...options, headers });
//   }

//   const CartAPI = {
//     async get() { return safeApi("/api/cart", { method: "GET" }); },
//     async patch(b) {
//       return safeApi("/api/cart", {
//         method: "PATCH",
//         body: JSON.stringify(b),
//         headers: { "Content-Type": "application/json" },
//       });
//     },
//     async remove(id) { return safeApi(`/api/cart/${id}`, { method: "DELETE" }); },
//     async clear() { return safeApi("/api/cart/clear", { method: "DELETE" }); },
//   };

//   // ----------------------------
//   // Recalculate totals only for selected items
//   // ----------------------------
//   function recalcSelectedTotals() {
//     const items = document.querySelectorAll(".cart-item");
//     let subtotal = 0;

//     items.forEach((item) => {
//       const checkbox = item.querySelector(".cart-select");
//       if (checkbox && checkbox.checked) {
//         const price = Number(item.querySelector(".price").textContent.replace("₹", ""));
//         const qty = Number(item.querySelector("input[type='number']").value);
//         subtotal += price * qty;
//       }
//     });

//     subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
//     totalEl.textContent = `₹${subtotal.toFixed(2)}`;
//   }

//   // ----------------------------
//   // Render cart
//   // ----------------------------
//   function renderCart(cart) {
//     if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
//       showEmpty();
//       return;
//     }

//     emptyEl.classList.add("hidden");
//     summaryEl.classList.remove("hidden");
//     checkoutBtn.disabled = false;

//     const html = cart.items.map((item) => {
//       const img = item.image_url || "Images/default.jpg";
//       const name = item.product_name || item.name || "Product";
//       const price = (item.price_cents / 100).toFixed(2);
//       const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);

//       return `
//         <div class="cart-item" data-id="${item.cart_item_id}">
//           <input type="checkbox" class="cart-select" />
//           <div class="cart-item-left"><img src="${img}" alt="${name}" /></div>
//           <div class="cart-item-right">
//             <h3>${name}</h3>
//             <p class="variant">${item.size || ""} ${item.color || ""}</p>
//             <p class="price">₹${price}</p>

//             <div class="quantity-control">
//               <button class="qty-btn minus">−</button>
//               <input type="number" min="1" value="${item.quantity}" />
//               <button class="qty-btn plus">+</button>
//             </div>

//             <div class="item-actions">
//               <span class="item-subtotal">₹${subtotal}</span>
//               <button class="remove-btn"><i class="fas fa-trash"></i></button>
//             </div>
//           </div>
//         </div>`;
//     }).join("");

//     itemsContainer.innerHTML = html;

//     recalcSelectedTotals();
//   }

//   // ----------------------------
//   // Show empty cart
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
//   // Load
//   // ----------------------------
//   async function loadCart() {
//     try {
//       const cart = await CartAPI.get();
//       if (!cart || cart.error || cart.expired) {
//         showEmpty();
//         toast("Cart unavailable", true);
//         return;
//       }
//       renderCart(cart);
//     } catch (err) {
//       console.error("[cart.js] loadCart failed:", err);
//       toast("Error loading cart", true);
//       showEmpty();
//     }
//   }

//   async function refresh() {
//     await loadCart();
//     updateNavbarCounts?.(true);
//   }

//   // ----------------------------
//   // Item operations
//   // ----------------------------
// async function updateQuantity(id, quantity) {
//   try {
//     if (quantity <= 0) return removeItem(id);

//     // Update backend only (no page refresh)
//     await CartAPI.patch({ cart_item_id: id, quantity });

//     // Update subtotal for this item only
//     const itemEl = document.querySelector(`.cart-item[data-id='${id}']`);
//     if (itemEl) {
//       const price = Number(itemEl.querySelector(".price").textContent.replace("₹", ""));
//       const subtotal = price * quantity;
//       itemEl.querySelector(".item-subtotal").textContent = `₹${subtotal.toFixed(2)}`;
//     }

//     // Recalculate totals for selected items
//     recalcSelectedTotals();

//   } catch {
//     toast("Failed to update quantity", true);
//   }
// }


//   async function removeItem(id) {
//     try {
//       await CartAPI.remove(id);
//       toast("Item removed");
//       await refresh();
//     } catch {
//       toast("Failed to remove item", true);
//     }
//   }

//   async function clearCart() {
//     try {
//       await CartAPI.clear();
//       toast("Cart cleared");
//       await refresh();
//     } catch {
//       toast("Failed to clear cart", true);
//     }
//   }

//   // ----------------------------
//   // Event wiring
//   // ----------------------------
//   document.addEventListener("click", async (e) => {
//     const minus = e.target.closest(".qty-btn.minus");
//     const plus = e.target.closest(".qty-btn.plus");
//     const remove = e.target.closest(".remove-btn");
//     const clear = e.target.closest("#clear-cart-btn");
//     const checkout = e.target.closest("#checkout-btn");
//     const checkbox = e.target.closest(".cart-select");

//     // Quantity +/-
//     if (minus || plus) {
//       const item = e.target.closest(".cart-item");
//       const input = item.querySelector("input[type='number']");
//       let qty = Number(input.value);
//       qty += plus ? 1 : -1;
//       if (qty < 1) qty = 1;
//       input.value = qty;

//       await updateQuantity(Number(item.dataset.id), qty);
//       recalcSelectedTotals();
//     }

//     // Remove item
//     if (remove) removeItem(Number(e.target.closest(".cart-item").dataset.id));

//     // Clear cart
//     if (clear) clearCart();

//     // Checkbox selection
//     if (checkbox) recalcSelectedTotals();

//   //   // Checkout — ONLY SELECTED PRODUCTS
//   //   if (checkout) {
//   //     const items = document.querySelectorAll(".cart-item");
//   //     const selected = [];

//   //     items.forEach((item) => {
//   //       const check = item.querySelector(".cart-select");
//   //       if (check && check.checked) {
//   //         const id = Number(item.dataset.id);
//   //         selected.push(id);
//   //       }
//   //     });

//   //     if (selected.length === 0) {
//   //       toast("Select at least one product", true);
//   //       return;
//   //     }

//   //     const cart = await CartAPI.get();
//   //     const finalItems = cart.items.filter((i) => selected.includes(i.cart_item_id));

//   //     sessionStorage.setItem("checkout_items", JSON.stringify(finalItems));
//   //     window.location.href = "addresses.html";
//   //   }
//   // });

//   //  -----------------------------
//   // Checkout — ONLY SELECTED PRODUCTS
//   // ----------------------------
//   // Checkout — ONLY SELECTED PRODUCTS
//     if (checkout) {
//       const items = document.querySelectorAll(".cart-item");
//       const selectedIds = [];

//       items.forEach((item) => {
//         const check = item.querySelector(".cart-select");
//         if (check && check.checked) {
//           selectedIds.push(Number(item.dataset.id));
//         }
//       });

//       if (selectedIds.length === 0) {
//         toast("Select at least one product", true);
//         return;
//       }

//       // Fetch fresh cart for accurate quantities
//       const cart = await CartAPI.get();

//       // Filter only selected products
//       const finalItems = cart.items.filter(i => selectedIds.includes(i.cart_item_id));

//       // Save selected items for next page
//       sessionStorage.setItem("checkout_items", JSON.stringify(finalItems));

//       window.location.href = "addresses.html";
//     }
//   });


//   // ----------------------------
//   // Init
//   // ----------------------------
//   document.addEventListener("DOMContentLoaded", async () => {
//     try {
//       if (window.auth?.initSession) await window.auth.initSession();
//       await new Promise(r => setTimeout(r, 120));
//       await loadCart();
//     } catch (err) {
//       console.error("[cart.js] init failed:", err);
//       showEmpty();
//     }
//   });
// })();



// -------------------------------------------

// ============================================================
// cart.js
// Cart UI controller
//
// New auth design alignment:
// - Cart remains guest-owned until /api/auth/register is called elsewhere.
// - This file must NOT attempt registration or user reconciliation.
// - Requests must carry guest identity even if a Firebase token exists.
// - Use api/client.js as the transport (window.apiRequest / window.CartAPI).
// - Do not read auth_token directly; use window.auth.getToken via api/client.js.
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
  // Toast
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
  // Guest identity helpers
  // Keep guest_id attached even if token exists (until backend register clears it).
  // ----------------------------
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function getGuestId() {
    const ck = getCookie("guest_id");
    if (ck) {
      try { localStorage.setItem("guest_id", ck); } catch {}
      return ck;
    }
    try {
      return localStorage.getItem("guest_id") || null;
    } catch {
      return null;
    }
  }

  function withGuestQuery(endpoint) {
    const guestId = getGuestId();
    if (!guestId) return endpoint;

    // Do not double-append
    if (/([?&])guest_id=/.test(endpoint)) return endpoint;

    return endpoint + (endpoint.includes("?") ? "&" : "?") + "guest_id=" + encodeURIComponent(guestId);
  }

  // ----------------------------
  // Transport (prefer client.js contracts)
  // ----------------------------
  function assertTransport() {
    if (typeof window.apiRequest !== "function") {
      throw new Error("apiRequest not available (api/client.js not loaded)");
    }
  }

  const CartAPI = (function () {
    // Prefer the global CartAPI facade if client.js already created it
    if (window.CartAPI && typeof window.CartAPI.get === "function") {
      return {
        get: async () => window.apiRequest(withGuestQuery("/api/cart")),
        patch: async (body) => window.apiRequest(withGuestQuery("/api/cart"), { method: "PATCH", body }),
        remove: async (id) => window.apiRequest(withGuestQuery(`/api/cart/${id}`), { method: "DELETE" }),
        clear: async () => window.apiRequest(withGuestQuery("/api/cart/clear"), { method: "DELETE" }),
      };
    }

    return {
      get: async () => window.apiRequest(withGuestQuery("/api/cart")),
      patch: async (body) => window.apiRequest(withGuestQuery("/api/cart"), { method: "PATCH", body }),
      remove: async (id) => window.apiRequest(withGuestQuery(`/api/cart/${id}`), { method: "DELETE" }),
      clear: async () => window.apiRequest(withGuestQuery("/api/cart/clear"), { method: "DELETE" }),
    };
  })();

  // ----------------------------
  // Recalculate totals only for selected items
  // ----------------------------
  function recalcSelectedTotals() {
    const items = document.querySelectorAll(".cart-item");
    let subtotal = 0;

    items.forEach((item) => {
      const checkbox = item.querySelector(".cart-select");
      if (checkbox && checkbox.checked) {
        const price = Number(String(item.querySelector(".price")?.textContent || "₹0").replace("₹", ""));
        const qty = Number(item.querySelector("input[type='number']")?.value || 0);
        subtotal += price * qty;
      }
    });

    subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    totalEl.textContent = `₹${subtotal.toFixed(2)}`;
  }

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

    const html = cart.items
      .map((item) => {
        const img = item.image_url || "Images/default.jpg";
        const name = item.product_name || item.name || "Product";
        const price = (Number(item.price_cents || 0) / 100).toFixed(2);
        const subtotal = ((Number(item.price_cents || 0) * Number(item.quantity || 0)) / 100).toFixed(2);

        return `
        <div class="cart-item" data-id="${item.cart_item_id}">
          <input type="checkbox" class="cart-select" />
          <div class="cart-item-left"><img src="${img}" alt="${name}" /></div>
          <div class="cart-item-right">
            <h3>${name}</h3>
            <p class="variant">${item.size || ""} ${item.color || ""}</p>
            <p class="price">₹${price}</p>

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
      })
      .join("");

    itemsContainer.innerHTML = html;

    recalcSelectedTotals();
    updateNavbarCounts?.(true);
  }

  // ----------------------------
  // Show empty cart
  // ----------------------------
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
  // Load
  // ----------------------------
  async function loadCart() {
    assertTransport();

    try {
      const cart = await CartAPI.get();
      if (!cart || cart.error || cart.expired) {
        showEmpty();
        toast("Cart unavailable", true);
        return;
      }
      renderCart(cart);
    } catch (err) {
      console.error("[cart.js] loadCart failed:", err);
      toast("Error loading cart", true);
      showEmpty();
    }
  }

  async function refresh() {
    await loadCart();
    updateNavbarCounts?.(true);
  }

  // ----------------------------
  // Item operations
  // ----------------------------
  async function updateQuantity(id, quantity) {
    try {
      if (quantity <= 0) return removeItem(id);

      await CartAPI.patch({ cart_item_id: id, quantity });

      const itemEl = document.querySelector(`.cart-item[data-id='${id}']`);
      if (itemEl) {
        const price = Number(String(itemEl.querySelector(".price")?.textContent || "₹0").replace("₹", ""));
        const subtotal = price * quantity;
        const subEl = itemEl.querySelector(".item-subtotal");
        if (subEl) subEl.textContent = `₹${subtotal.toFixed(2)}`;
      }

      recalcSelectedTotals();
      updateNavbarCounts?.(true);
    } catch {
      toast("Failed to update quantity", true);
    }
  }

  async function removeItem(id) {
    try {
      await CartAPI.remove(id);
      toast("Item removed");
      await refresh();
    } catch {
      toast("Failed to remove item", true);
    }
  }

  async function clearCart() {
    try {
      await CartAPI.clear();
      toast("Cart cleared");
      await refresh();
    } catch {
      toast("Failed to clear cart", true);
    }
  }

  // ----------------------------
  // Checkout (selected items only)
  // ----------------------------
  async function checkoutSelected() {
    const items = document.querySelectorAll(".cart-item");
    const selectedIds = [];

    items.forEach((item) => {
      const check = item.querySelector(".cart-select");
      if (check && check.checked) selectedIds.push(Number(item.dataset.id));
    });

    if (selectedIds.length === 0) {
      toast("Select at least one product", true);
      return;
    }

    try {
      const cart = await CartAPI.get();
      const finalItems = (cart?.items || []).filter((i) => selectedIds.includes(Number(i.cart_item_id)));

      if (!finalItems.length) {
        toast("Selected items not available", true);
        return;
      }

      sessionStorage.setItem("checkout_items", JSON.stringify(finalItems));
      window.location.href = "addresses.html";
    } catch (err) {
      console.error("[cart.js] checkoutSelected failed:", err);
      toast("Checkout failed", true);
    }
  }

  // ----------------------------
  // Event wiring
  // ----------------------------
  document.addEventListener("click", async (e) => {
    const minus = e.target.closest(".qty-btn.minus");
    const plus = e.target.closest(".qty-btn.plus");
    const remove = e.target.closest(".remove-btn");
    const clear = e.target.closest("#clear-cart-btn");
    const checkout = e.target.closest("#checkout-btn");
    const checkbox = e.target.closest(".cart-select");

    if (minus || plus) {
      const item = e.target.closest(".cart-item");
      if (!item) return;

      const input = item.querySelector("input[type='number']");
      if (!input) return;

      let qty = Number(input.value);
      qty += plus ? 1 : -1;
      if (qty < 1) qty = 1;
      input.value = qty;

      await updateQuantity(Number(item.dataset.id), qty);
      return;
    }

    if (remove) {
      const item = e.target.closest(".cart-item");
      if (!item) return;
      removeItem(Number(item.dataset.id));
      return;
    }

    if (clear) {
      clearCart();
      return;
    }

    if (checkbox) {
      recalcSelectedTotals();
      return;
    }

    if (checkout) {
      checkoutSelected();
      return;
    }
  });

  document.addEventListener("change", (e) => {
    const input = e.target;
    if (!input) return;

    const qtyInput = input.closest(".cart-item")?.querySelector("input[type='number']");
    if (!qtyInput || input !== qtyInput) return;

    const item = input.closest(".cart-item");
    if (!item) return;

    let qty = Number(qtyInput.value);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    qtyInput.value = qty;

    updateQuantity(Number(item.dataset.id), qty);
  });

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    loadCart();
  });
})();
