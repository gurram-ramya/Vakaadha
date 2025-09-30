// // cart.js
// import { apiRequest, getToken } from "./api/client.js";

// document.addEventListener("DOMContentLoaded", async () => {
//   if (!getToken()) {
//     document.getElementById("cartItems").innerHTML =
//       "<p>Please <a href='profile.html'>log in</a> to view your cart.</p>";
//     return;
//   }
//   await loadCart();
// });

// async function loadCart() {
//   const res = await apiRequest("/users/me/cart", { method: "GET" });

//   const itemsContainer = document.getElementById("cartItems");
//   const summaryContainer = document.getElementById("cartSummary");

//   if (!res.items || res.items.length === 0) {
//     itemsContainer.innerHTML =
//       "<p>Your cart is empty. <a href='index.html'>Shop now</a>.</p>";
//     summaryContainer.innerHTML = "";
//     return;
//   }

//   // Render cart items
//   itemsContainer.innerHTML = `
//     <table class="cart-table">
//       <thead>
//         <tr>
//           <th>Product</th>
//           <th>Variant</th>
//           <th>Price</th>
//           <th>Qty</th>
//           <th>Subtotal</th>
//           <th></th>
//         </tr>
//       </thead>
//       <tbody>
//         ${res.items
//           .map(
//             (item) => `
//           <tr>
//             <td>
//               <img src="${item.image_url}" alt="${item.name}" class="cart-img"/>
//               <span>${item.name}</span>
//             </td>
//             <td>${item.color || ""} ${item.size || ""}</td>
//             <td>₹${(item.price_cents / 100).toFixed(2)}</td>
//             <td>
//               <input type="number" value="${item.quantity}" min="1"
//                 class="qty-input"
//                 onchange="updateQuantity(${item.cart_item_id}, this.value)" />
//             </td>
//             <td>₹${((item.price_cents * item.quantity) / 100).toFixed(2)}</td>
//             <td>
//               <button class="remove-btn" onclick="removeItem(${item.cart_item_id})">
//                 <i class="fas fa-trash"></i>
//               </button>
//             </td>
//           </tr>
//         `
//           )
//           .join("")}
//       </tbody>
//     </table>
//   `;

//   // Render summary
//   summaryContainer.innerHTML = `
//     <p>Total: ₹${(res.subtotal_cents / 100).toFixed(2)}</p>
//     <button id="checkoutBtn" class="btn-checkout" onclick="checkout()">Proceed to Checkout</button>
//   `;
// }

// // Update quantity
// window.updateQuantity = async function (itemId, qty) {
//   await apiRequest(`/users/me/cart/${itemId}`, {
//     method: "PUT",
//     body: { quantity: parseInt(qty) },
//   });
//   await loadCart();
// };

// // Remove item
// window.removeItem = async function (itemId) {
//   await apiRequest(`/users/me/cart/${itemId}`, { method: "DELETE" });
//   await loadCart();
// };

// // Checkout
// window.checkout = async function () {
//   const res = await apiRequest("/users/me/orders/checkout", { method: "POST" });
//   if (res.error) {
//     alert("Checkout failed: " + res.error);
//     return;
//   }
//   alert("Order placed successfully!");
//   window.location.href = "orders.html";
// };



// ==============================
// CART.JS - Clean Version
// ==============================
/** cart.js **/

// (() => {
//   const CART_KEY = "vakaadha_cart_v1";

//   function readCart() {
//     try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
//     catch { return []; }
//   }

//   function writeCart(cart) {
//     localStorage.setItem(CART_KEY, JSON.stringify(cart));
//   }

//   function updateCartCount() {
//     const cart = readCart();
//     const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
//     const el = document.getElementById("cartCount");
//     if (el) el.textContent = count;
//   }

//   function renderCart() {
//     const container = document.getElementById("cartItems");
//     const summary = document.getElementById("cartSummary");
//     const cart = readCart();

//     if (!container || !summary) return;

//     if (cart.length === 0) {
//       container.innerHTML = "<p>Your cart is empty.</p>";
//       summary.innerHTML = "";
//       updateCartCount();
//       return;
//     }

//     container.innerHTML = "";
//     let total = 0;

//     cart.forEach((item, index) => {
//       if (!item.qty || item.qty < 1) item.qty = 1;
//       total += item.price * item.qty;

//       const card = document.createElement("div");
//       card.classList.add("cart-card");
//       card.innerHTML = `
//         <img src="${item.image || 'images/placeholder.png'}" alt="${item.name}">
//         <div class="cart-details">
//           <h3>${item.name}</h3>
//           ${item.size ? `<p>Size: ${item.size}</p>` : ""}
//           <p>₹${item.price}</p>
//           <div class="qty-controls">
//             <button class="qty-decrement">-</button>
//             <span>${item.qty}</span>
//             <button class="qty-increment">+</button>
//           </div>
//           <button class="remove-cart">Remove</button>
//         </div>
//       `;

//       // increment
//       card.querySelector(".qty-increment").addEventListener("click", () => {
//         item.qty++;
//         writeCart(cart);
//         renderCart();
//       });

//       // decrement
//       card.querySelector(".qty-decrement").addEventListener("click", () => {
//         if (item.qty > 1) item.qty--;
//         else cart.splice(index, 1);
//         writeCart(cart);
//         renderCart();
//       });

//       // remove
//       card.querySelector(".remove-cart").addEventListener("click", () => {
//         cart.splice(index, 1);
//         writeCart(cart);
//         renderCart();
//       });

//       container.appendChild(card);
//     });

//     summary.innerHTML = `<h3>Total: ₹${total}</h3><button class="btn-checkout">Proceed to Checkout</button>`;
//     updateCartCount();
//   }

//   document.addEventListener("DOMContentLoaded", () => {
//     renderCart();
//   });

// })();


// cart.js
(function () {
  const CART_KEY = "vakaadha_cart_v1";
  const CHECKOUT_KEY = "checkout_items";

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function updateNavbarCountsSafe() {
    if (typeof window.updateNavbarCounts === "function") {
      window.updateNavbarCounts();
    } else {
      const cart = readCart();
      const cartEl = document.getElementById("cartCount");
      if (cartEl) cartEl.textContent = Array.isArray(cart) ? cart.reduce((s, i) => s + (i.qty || 1), 0) : 0;
    }
  }

  // function renderCart() {
  //   const container = document.getElementById("cartItems");
  //   const summary = document.getElementById("cartSummary");
  //   const cart = readCart();

  //   if (!container || !summary) return;

  //   // ✅ remember selected indices before re-render
  //   const previouslySelected = new Set(
  //     Array.from(container.querySelectorAll(".cart-select:checked"))
  //       .map(cb => parseInt(cb.dataset.index, 10))
  //   );

  //   if (!cart.length) {
  //     container.innerHTML = "<p>Your cart is empty.</p>";
  //     summary.innerHTML = "";
  //     updateNavbarCountsSafe();
  //     return;
  //   }

  //   container.innerHTML = "";
  //   let total = 0;

  //   cart.forEach((item, index) => {
  //     if (!item.qty || item.qty < 1) item.qty = 1;

  //     const card = document.createElement("div");
  //     card.classList.add("cart-card");
  //     card.innerHTML = `
  //       <input type="checkbox" class="cart-select" data-index="${index}" />
  //       <img src="${item.image || 'images/placeholder.png'}" alt="${item.name}">
  //       <div class="cart-details">
  //         <h3>${item.name}</h3>
  //         ${item.size ? `<p>Size: ${item.size}</p>` : ""}
  //         <p>₹${item.price}</p>
  //         <div class="qty-controls">
  //           <button class="qty-decrement">-</button>
  //           <span class="qty-value">${item.qty}</span>
  //           <button class="qty-increment">+</button>
  //         </div>
  //         <button class="remove-cart">Remove</button>
  //       </div>
  //     `;

  //     // increment
  //     card.querySelector(".qty-increment").addEventListener("click", () => {
  //       item.qty++;
  //       writeCart(cart);
  //       renderCart();
  //     });

  //     // decrement
  //     card.querySelector(".qty-decrement").addEventListener("click", () => {
  //       if (item.qty > 1) item.qty--;
  //       else cart.splice(index, 1);
  //       writeCart(cart);
  //       renderCart();
  //     });

  //     // remove
  //     card.querySelector(".remove-cart").addEventListener("click", () => {
  //       cart.splice(index, 1);
  //       writeCart(cart);
  //       renderCart();
  //     });

  //     container.appendChild(card);
  //   });

  //   // --- Update summary with only selected items ---
  //   function updateSummary() {
  //     const selectedCheckboxes = container.querySelectorAll(".cart-select:checked");
  //     let total = 0;
  //     const selectedItems = [];

  //     selectedCheckboxes.forEach(cb => {
  //       const idx = parseInt(cb.dataset.index, 10);
  //       const item = cart[idx];
  //       if (item) {
  //         total += (item.price || 0) * (item.qty || 1);
  //         selectedItems.push(item);
  //       }
  //     });

  //     summary.innerHTML = `
  //       <h3>Total: ₹${total}</h3>
  //       <button class="btn-checkout" ${selectedItems.length ? "" : "disabled"}>Proceed to Checkout</button>
  //     `;

  //     // cart.js
  //   const checkoutBtn = document.querySelector(".btn-checkout");
  //   checkoutBtn.addEventListener("click", () => {
  //     const container = document.getElementById("cartItems");
  //     const selectedEls = container.querySelectorAll(".cart-select:checked");
  //     if (!selectedEls.length) {
  //       alert("Please select at least one product to checkout.");
  //       return;
  //     }

  //     const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  //     const selectedItems = [];

  //     selectedEls.forEach(cb => {
  //       const index = parseInt(cb.dataset.index, 10);
  //       if (!isNaN(index) && cart[index]) {
  //         // push a copy of the item
  //         selectedItems.push({ ...cart[index] });
  //       }
  //     });

  //     // Save all selected items
  //     sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(selectedItems));

  //     // Redirect to address page
  //     window.location.href = "addresses.html";
  //   });

  //   }

  //   // Attach listener for checkboxes
  //   container.querySelectorAll(".cart-select").forEach(cb => {
  //     cb.addEventListener("change", updateSummary);
  //   });

  //   // initialize summary
  //   updateSummary();

  //   updateNavbarCountsSafe();
  // }

  function renderCart() {
    const container = document.getElementById("cartItems");
    const summary = document.getElementById("cartSummary");
    const cart = readCart();

    if (!container || !summary) return;

    // ✅ remember selected indices before re-render
    const previouslySelected = new Set(
      Array.from(container.querySelectorAll(".cart-select:checked"))
        .map(cb => parseInt(cb.dataset.index, 10))
    );

    if (!cart.length) {
      container.innerHTML = "<p>Your cart is empty.</p>";
      summary.innerHTML = "";
      updateNavbarCountsSafe();
      return;
    }

    container.innerHTML = "";
    cart.forEach((item, index) => {
      if (!item.qty || item.qty < 1) item.qty = 1;

      const card = document.createElement("div");
      card.classList.add("cart-card");
      card.innerHTML = `
        <input type="checkbox" class="cart-select" data-index="${index}" />
        <img src="${item.image || 'images/placeholder.png'}" alt="${item.name}">
        <div class="cart-details">
          <h3>${item.name}</h3>
          ${item.size ? `<p>Size: ${item.size}</p>` : ""}
          <p>₹${item.price}</p>
          <div class="qty-controls">
            <button class="qty-decrement">-</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-increment">+</button>
          </div>
          <button class="remove-cart">Remove</button>
        </div>
      `;

      // ✅ restore checkbox state if previously selected
      if (previouslySelected.has(index)) {
        card.querySelector(".cart-select").checked = true;
      }

      // increment
      card.querySelector(".qty-increment").addEventListener("click", () => {
        item.qty++;
        writeCart(cart);
        renderCart();
      });

      // decrement
      card.querySelector(".qty-decrement").addEventListener("click", () => {
        if (item.qty > 1) item.qty--;
        else cart.splice(index, 1);
        writeCart(cart);
        renderCart();
      });

      // remove
      card.querySelector(".remove-cart").addEventListener("click", () => {
        cart.splice(index, 1);
        writeCart(cart);
        renderCart();
      });

      container.appendChild(card);
    });

    // --- Summary ---
    function updateSummary() {
      const selectedCheckboxes = container.querySelectorAll(".cart-select:checked");
      let total = 0;
      const selectedItems = [];

      selectedCheckboxes.forEach(cb => {
        const idx = parseInt(cb.dataset.index, 10);
        const item = cart[idx];
        if (item) {
          total += (item.price || 0) * (item.qty || 1);
          selectedItems.push(item);
        }
      });

      summary.innerHTML = `
        <h3>Total: ₹${total}</h3>
        <button class="btn-checkout" ${selectedItems.length ? "" : "disabled"}>Proceed to Checkout</button>
      `;

      const checkoutBtn = summary.querySelector(".btn-checkout");
      checkoutBtn.addEventListener("click", () => {
        if (!selectedItems.length) {
          alert("Please select at least one product to checkout.");
          return;
        }
        sessionStorage.setItem("checkout_items", JSON.stringify(selectedItems));
        window.location.href = "addresses.html";
      });
    }

    // attach listeners
    container.querySelectorAll(".cart-select").forEach(cb => {
      cb.addEventListener("change", updateSummary);
    });

    // ✅ run once immediately
    updateSummary();

    updateNavbarCountsSafe();
  }


  window.renderCart = renderCart;

  // --- inside cart.js after rendering ---
  function attachCheckoutHandler() {
    const checkoutBtn = document.querySelector(".btn-checkout");
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener("click", () => {
      // collect only selected items
      const selectedEls = document.querySelectorAll(".cart-select:checked");
      if (!selectedEls.length) {
        alert("Please select at least one product to checkout.");
        return;
      }

      const cart = readCart();
      const selectedItems = [];

      selectedEls.forEach(cb => {
        const index = parseInt(cb.dataset.index, 10);
        if (!isNaN(index) && cart[index]) {
          selectedItems.push(cart[index]);
        }
      });

      // save to sessionStorage
      sessionStorage.setItem("checkout_items", JSON.stringify(selectedItems));

      // go to addresses
      window.location.href = "addresses.html";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderCart();
  });
})();