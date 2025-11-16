// // ============================================================
// // cart.js — Auth-first; waits for initSession before API usage
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

//       let lockBadge = "";
//       if (item.locked_price_until && new Date(item.locked_price_until) > new Date()) {
//         const until = new Date(item.locked_price_until).toLocaleDateString();
//         lockBadge = `<div class="lock-badge">Locked until ${until}</div>`;
//       }

//       return `
//         <div class="cart-item" data-id="${item.cart_item_id}">
//           <div class="cart-item-left"><img src="${img}" alt="${name}" /></div>
//           <div class="cart-item-right">
//             <h3>${name}</h3>
//             <p class="variant">${item.size || ""} ${item.color || ""}</p>
//             <p class="price">₹${price}</p>
//             ${lockBadge}
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

//     const subtotal = cart.totals?.subtotal_cents ??
//       cart.items.reduce((s, i) => s + i.price_cents * i.quantity, 0);
//     const total = cart.totals?.total_cents ??
//       cart.items.reduce((s, i) => s + i.price_cents * i.quantity, 0);

//     subtotalEl.textContent = `₹${(subtotal / 100).toFixed(2)}`;
//     totalEl.textContent = `₹${(total / 100).toFixed(2)}`;
//   }

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
//       if (err.status === 410) {
//         toast("Cart expired", true);
//         showEmpty();
//       } else {
//         toast("Error loading cart", true);
//       }
//     }
//   }

//   async function refresh() {
//     await loadCart();
//     updateNavbarCounts?.(true);
//   }

//   // ----------------------------
//   // Item operations
//   // ----------------------------
//   async function updateQuantity(id, quantity) {
//     try {
//       if (quantity <= 0) return removeItem(id);
//       await CartAPI.patch({ cart_item_id: id, quantity });
//       await refresh();
//     } catch (err) {
//       handleError(err, "Failed to update quantity");
//     }
//   }

//   async function removeItem(id) {
//     try {
//       await CartAPI.remove(id);
//       toast("Item removed");
//       await refresh();
//     } catch (err) {
//       handleError(err, "Failed to remove item");
//     }
//   }

//   async function clearCart() {
//     try {
//       await CartAPI.clear();
//       toast("Cart cleared");
//       await refresh();
//     } catch (err) {
//       handleError(err, "Failed to clear cart");
//     }
//   }

//   function handleError(err, fallback) {
//     if (!err) return toast(fallback, true);
//     switch (err.status) {
//       case 400: toast("Bad request", true); break;
//       case 409: toast("Out of stock", true); break;
//       case 410: toast("Cart expired", true); showEmpty(); break;
//       default: toast(fallback, true);
//     }
//   }
//   // ----------------------------
//   // Login-required popup
//   // ----------------------------
//   function showLoginPopup() {
//     const overlay = document.createElement("div");
//     overlay.id = "login-overlay";
//     Object.assign(overlay.style, {
//       position: "fixed",
//       top: 0,
//       left: 0,
//       width: "100%",
//       height: "100%",
//       background: "rgba(0,0,0,0.55)",
//       display: "flex",
//       justifyContent: "center",
//       alignItems: "center",
//       zIndex: "9999",
//       animation: "fadeIn 0.3s ease"
//     });

//     const box = document.createElement("div");
//     Object.assign(box.style, {
//       background: "#fff",
//       padding: "2rem 2.5rem",
//       borderRadius: "12px",
//       width: "90%",
//       maxWidth: "380px",
//       boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
//       textAlign: "center",
//       fontFamily: "system-ui, sans-serif",
//       position: "relative"
//     });

//     box.innerHTML = `
//       <h2 style="margin-bottom: 0.8rem; font-size: 1.4rem;">Sign in Required</h2>
//       <p style="color:#555; font-size:0.95rem; margin-bottom:1.6rem;">
//         You need to log in or create an account to proceed with checkout.
//       </p>
//       <div style="display:flex; gap:0.8rem; justify-content:center;">
//         <button id="go-login" style="
//           background:#111;
//           color:#fff;
//           border:none;
//           border-radius:6px;
//           padding:0.6rem 1.2rem;
//           font-weight:600;
//           cursor:pointer;
//           transition:background 0.2s;
//         ">Login / Sign Up</button>
//         <button id="cancel-login" style="
//           background:#e4e4e4;
//           color:#333;
//           border:none;
//           border-radius:6px;
//           padding:0.6rem 1.2rem;
//           cursor:pointer;
//           font-weight:500;
//         ">Cancel</button>
//       </div>
//     `;

//     overlay.appendChild(box);
//     document.body.appendChild(overlay);

//     document.getElementById("go-login").onclick = () => {
//       overlay.remove();
//       window.location.href = "profile.html";
//     };
//     document.getElementById("cancel-login").onclick = () => overlay.remove();
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

//     if (minus || plus) {
//       const item = e.target.closest(".cart-item");
//       const input = item.querySelector("input");
//       let qty = Number(input.value);
//       qty += plus ? 1 : -1;
//       if (qty < 1) qty = 1;
//       input.value = qty;
//       updateQuantity(Number(item.dataset.id), qty);
//     }

//     if (remove) removeItem(Number(e.target.closest(".cart-item").dataset.id));
//     if (clear) clearCart();

//     if (checkout) {
//       const cart = await CartAPI.get();
//       if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
//         toast("Your cart is empty", true);
//         return;
//       }
//       sessionStorage.setItem("checkout_items", JSON.stringify(cart.items));
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




// ============================================================
// cart.js — With Item Selection + Selected Checkout
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
  // Helpers
  // ----------------------------
  function getGuestId() {
    try {
      return localStorage.getItem("guest_id") || null;
    } catch {
      return null;
    }
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
    async get() { return safeApi("/api/cart", { method: "GET" }); },
    async patch(b) {
      return safeApi("/api/cart", {
        method: "PATCH",
        body: JSON.stringify(b),
        headers: { "Content-Type": "application/json" },
      });
    },
    async remove(id) { return safeApi(`/api/cart/${id}`, { method: "DELETE" }); },
    async clear() { return safeApi("/api/cart/clear", { method: "DELETE" }); },
  };

  // ----------------------------
  // Recalculate totals only for selected items
  // ----------------------------
  function recalcSelectedTotals() {
    const items = document.querySelectorAll(".cart-item");
    let subtotal = 0;

    items.forEach((item) => {
      const checkbox = item.querySelector(".cart-select");
      if (checkbox && checkbox.checked) {
        const price = Number(item.querySelector(".price").textContent.replace("₹", ""));
        const qty = Number(item.querySelector("input[type='number']").value);
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

    const html = cart.items.map((item) => {
      const img = item.image_url || "Images/default.jpg";
      const name = item.product_name || item.name || "Product";
      const price = (item.price_cents / 100).toFixed(2);
      const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);

      return `
        <div class="cart-item" data-id="${item.cart_item_id}">
          <input type="checkbox" class="cart-select" checked />
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
    }).join("");

    itemsContainer.innerHTML = html;

    recalcSelectedTotals();
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

    // Update backend only (no page refresh)
    await CartAPI.patch({ cart_item_id: id, quantity });

    // Update subtotal for this item only
    const itemEl = document.querySelector(`.cart-item[data-id='${id}']`);
    if (itemEl) {
      const price = Number(itemEl.querySelector(".price").textContent.replace("₹", ""));
      const subtotal = price * quantity;
      itemEl.querySelector(".item-subtotal").textContent = `₹${subtotal.toFixed(2)}`;
    }

    // Recalculate totals for selected items
    recalcSelectedTotals();

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
  // Event wiring
  // ----------------------------
  document.addEventListener("click", async (e) => {
    const minus = e.target.closest(".qty-btn.minus");
    const plus = e.target.closest(".qty-btn.plus");
    const remove = e.target.closest(".remove-btn");
    const clear = e.target.closest("#clear-cart-btn");
    const checkout = e.target.closest("#checkout-btn");
    const checkbox = e.target.closest(".cart-select");

    // Quantity +/-
    if (minus || plus) {
      const item = e.target.closest(".cart-item");
      const input = item.querySelector("input[type='number']");
      let qty = Number(input.value);
      qty += plus ? 1 : -1;
      if (qty < 1) qty = 1;
      input.value = qty;

      await updateQuantity(Number(item.dataset.id), qty);
      recalcSelectedTotals();
    }

    // Remove item
    if (remove) removeItem(Number(e.target.closest(".cart-item").dataset.id));

    // Clear cart
    if (clear) clearCart();

    // Checkbox selection
    if (checkbox) recalcSelectedTotals();

    // Checkout — ONLY SELECTED PRODUCTS
    if (checkout) {
      const items = document.querySelectorAll(".cart-item");
      const selected = [];

      items.forEach((item) => {
        const check = item.querySelector(".cart-select");
        if (check && check.checked) {
          const id = Number(item.dataset.id);
          selected.push(id);
        }
      });

      if (selected.length === 0) {
        toast("Select at least one product", true);
        return;
      }

      const cart = await CartAPI.get();
      const finalItems = cart.items.filter((i) => selected.includes(i.cart_item_id));

      sessionStorage.setItem("checkout_items", JSON.stringify(finalItems));
      window.location.href = "addresses.html";
    }
  });

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (window.auth?.initSession) await window.auth.initSession();
      await new Promise(r => setTimeout(r, 120));
      await loadCart();
    } catch (err) {
      console.error("[cart.js] init failed:", err);
      showEmpty();
    }
  });
})();
