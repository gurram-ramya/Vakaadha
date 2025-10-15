// // checkout.js — Amazon/Flipkart style, wired to backend

// // --- Helpers ---
// function fmtINR(cents) {
//   return (cents / 100).toFixed(2);
// }
// function $(sel) {
//   return document.querySelector(sel);
// }
// function show(el) {
//   el.style.display = "";
// }
// function hide(el) {
//   el.style.display = "none";
// }

// // Keep references to sections
// const addressSection = document.getElementById("addressSection");
// const paymentSection = document.getElementById("paymentSection");
// const confirmationSection = document.getElementById("confirmationSection");

// // Stepper helpers
// function setStep(active) {
//   document.querySelectorAll(".stepper .step").forEach((node) => {
//     if (node.dataset.step === active) node.classList.add("active");
//     else node.classList.remove("active");
//   });
// }

// // --- Auth bootstrap ---
// document.addEventListener("DOMContentLoaded", () => {
//   firebase.auth().onAuthStateChanged(async (user) => {
//     if (!user) {
//       alert("Please log in to proceed with checkout.");
//       window.location.href = "profile.html";
//       return;
//     }

//     const token = await user.getIdToken();
//     localStorage.setItem(
//       "loggedInUser",
//       JSON.stringify({ email: user.email, idToken: token })
//     );

//     // Wire buttons
//     document.getElementById("addAddressBtn").onclick = showAddressForm;
//     document.getElementById("continueToPayment").onclick = proceedToPayment;
//     document.getElementById("completePayment").onclick = completePayment;
//     document.getElementById("backToAddress").onclick = backToAddress;

//     // Load data
//     await loadAddresses();
//     await loadOrderSummary(); // Preload summary so Payment step is instant
//   });
// });

// // --- Addresses (backend) ---
// async function loadAddresses() {
//   const user = JSON.parse(localStorage.getItem("loggedInUser"));
//   const list = document.getElementById("addressList");
//   const contBtn = document.getElementById("continueToPayment");

//   try {
//     const res = await fetch("/users/me/addresses", {
//       headers: { Authorization: `Bearer ${user.idToken}` },
//     });
//     if (!res.ok) throw new Error("Failed to load addresses");
//     const addresses = await res.json();

//     if (!addresses || addresses.length === 0) {
//       list.innerHTML = '<p>No saved addresses. Please add one.</p>';
//       contBtn.disabled = true;
//       return;
//     }

//     // Render as radio list
//     list.innerHTML = addresses
//       .map(
//         (addr) => `
//       <div class="address-option">
//         <input type="radio" name="selectedAddress" value="${addr.address_id}">
//         <label>
//           <strong>${addr.full_name}</strong> (${addr.phone})<br/>
//           ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br/>
//           ${addr.city}${addr.state ? ", " + addr.state : ""} - ${addr.zip}<br/>
//           ${addr.country}
//         </label>
//       </div>
//     `
//       )
//       .join("");

//     contBtn.disabled = false;
//   } catch (err) {
//     console.error(err);
//     list.innerHTML = "<p>Could not load addresses.</p>";
//     contBtn.disabled = true;
//   }
// }

// function showAddressForm() {
//   const formWrap = document.getElementById("addressFormContainer");
//   show(formWrap);

//   formWrap.innerHTML = `
//     <form id="addressForm">
//       <input name="full_name" placeholder="Full Name" required><br/>
//       <input name="phone" placeholder="Mobile Number" required><br/>
//       <input name="line1" placeholder="Address Line 1" required><br/>
//       <input name="line2" placeholder="Address Line 2"><br/>
//       <input name="city" placeholder="City" required><br/>
//       <input name="state" placeholder="State"><br/>
//       <input name="zip" placeholder="PIN Code" required><br/>
//       <input name="country" placeholder="Country" value="India"><br/>
//       <button type="submit">Save</button>
//       <button type="button" id="cancelAddr">Cancel</button>
//     </form>
//   `;

//   document.getElementById("cancelAddr").onclick = () => hide(formWrap);

//   document.getElementById("addressForm").onsubmit = async (e) => {
//     e.preventDefault();
//     const fd = new FormData(e.target);
//     const user = JSON.parse(localStorage.getItem("loggedInUser"));

//     const payload = {
//       full_name: fd.get("full_name"),
//       phone: fd.get("phone"),
//       type: "shipping",
//       line1: fd.get("line1"),
//       line2: fd.get("line2"),
//       city: fd.get("city"),
//       state: fd.get("state"),
//       zip: fd.get("zip"),
//       country: fd.get("country") || "India",
//     };

//     try {
//       const res = await fetch("/users/me/addresses", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${user.idToken}`,
//         },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) {
//         const j = await res.json().catch(() => ({}));
//         throw new Error(j.error || "Failed to save address");
//       }
//       await loadAddresses();
//       hide(formWrap);
//     } catch (err) {
//       console.error(err);
//       alert(err.message || "Could not save address");
//     }
//   };
// }

// // --- Order Summary (from backend cart) ---
// async function loadOrderSummary() {
//   const user = JSON.parse(localStorage.getItem("loggedInUser"));
//   const container = document.getElementById("orderSummaryContent");

//   try {
//     const res = await fetch("/users/me/cart", {
//       headers: { Authorization: `Bearer ${user.idToken}` },
//     });
//     if (!res.ok) throw new Error("Failed to load cart");
//     const cart = await res.json();

//     if (!cart.items || cart.items.length === 0) {
//       container.innerHTML = "<p>Your cart is empty.</p>";
//       return;
//     }

//     let totalCents = 0;
//     const html = cart.items
//       .map((item) => {
//         const line = (item.price_cents || 0) * (item.quantity || 1);
//         totalCents += line;
//         return `
//         <div class="product-summary">
//           <img src="${item.image_url}" alt="${item.name}" />
//           <div>
//             <h4>${item.name}</h4>
//             <p>${[item.color, item.size].filter(Boolean).join(" • ") || ""}</p>
//             <p>Qty: ${item.quantity}</p>
//             <p>Line Total: ₹${fmtINR(line)}</p>
//           </div>
//         </div>
//       `;
//       })
//       .join("");

//     container.innerHTML =
//       html + `<div class="summary-total"><strong>Total: ₹${fmtINR(totalCents)}</strong></div>`;
//   } catch (err) {
//     console.error(err);
//     container.innerHTML = "<p>Could not load order summary.</p>";
//   }
// }

// // --- Payment Methods (simple radio cards) ---
// function loadPaymentMethods() {
//   const container = document.getElementById("paymentMethods");
//   container.innerHTML = `
//     <div class="payment-option selected">
//       <input type="radio" name="paymentMethod" id="upi" value="UPI" checked />
//       <label for="upi">
//         <div><strong>UPI</strong></div>
//         <div class="payment-description">Pay via PhonePe, GPay, or BHIM</div>
//       </label>
//       <div class="payment-icon"><i class="fas fa-mobile-alt"></i></div>
//     </div>

//     <div class="payment-option">
//       <input type="radio" name="paymentMethod" id="cod" value="COD" />
//       <label for="cod">
//         <div><strong>Cash on Delivery</strong></div>
//         <div class="payment-description">Pay with cash once you receive your order</div>
//       </label>
//       <div class="payment-icon"><i class="fas fa-money-bill-wave"></i></div>
//     </div>
    
//     <div class="payment-option">
//       <input type="radio" name="paymentMethod" id="card" value="CARD" />
//       <label for="card">
//         <div><strong>Card Payment</strong></div>
//         <div class="payment-description">Pay securely using your credit or debit card</div>
//       </label>
//       <div class="payment-icon"><i class="fas fa-credit-card"></i></div>
//     </div>
//   `;
// }

// // --- Step navigation ---
// function proceedToPayment() {
//   const chosen = document.querySelector('input[name="selectedAddress"]:checked');
//   if (!chosen) {
//     alert("Select a shipping address.");
//     return;
//   }
//   hide(addressSection);
//   show(paymentSection);
//   setStep("payment");
//   loadPaymentMethods();
// }

// function backToAddress() {
//   hide(paymentSection);
//   show(addressSection);
//   setStep("address");
// }

// // --- Place Order ---
// async function completePayment() {
//   const user = JSON.parse(localStorage.getItem("loggedInUser"));
//   const token = user?.idToken;

//   const selected = document.querySelector('input[name="selectedAddress"]:checked');
//   if (!selected) {
//     alert("Select a shipping address.");
//     return;
//   }
//   const addressId = parseInt(selected.value, 10);

//   const paymentMethod =
//     (document.querySelector('input[name="paymentMethod"]:checked') || {}).value || "UPI";

//   try {
//     const res = await fetch("/users/me/orders/checkout", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//       body: JSON.stringify({
//         address_id: addressId,
//         payment_method: paymentMethod,
//       }),
//     });

//     const result = await res.json();

//     if (!res.ok) {
//       alert(result.error || "Order failed.");
//       return;
//     }

//     // Success UI
//     hide(paymentSection);
//     show(confirmationSection);
//     setStep("confirmation");

//     document.getElementById("orderConfirmationDetails").innerHTML = `
//       <p>Order ID: <strong>#${result.order_id}</strong></p>
//       <p>Total Paid: ₹<strong>${fmtINR(result.total_cents)}</strong></p>
//       <p>Payment Mode: ${String(result.payment_method || paymentMethod).toUpperCase()}</p>
//     `;

//     // Optional: you may also want to refresh header cart count via some global fn
//   } catch (err) {
//     console.error("Order error:", err);
//     alert("Something went wrong.");
//   }
// }

// checkout.js
import { apiRequest } from "./api/client.js";

(function () {
  if (window.__checkout_js_bound__) return;
  window.__checkout_js_bound__ = true;

  const CART_ENDPOINT = "/api/cart";
  const ADDRESSES_ENDPOINT = "/api/addresses";
  const ORDER_ENDPOINT = "/api/orders";
  const CART_CLEAR_ENDPOINT = "/api/cart/clear";

  const els = {
    cartSummary: document.getElementById("cart-summary"),
    addressSelector: document.getElementById("address-selector"),
    subtotal: document.getElementById("subtotal"),
    shipping: document.getElementById("shipping"),
    total: document.getElementById("total"),
    placeOrderBtn: document.getElementById("place-order-btn"),
    toast: document.getElementById("toast"),
  };

  let cartItems = [];
  let selectedAddressId = null;

  // -------------------------------------------------------------
  // Toast helper
  // -------------------------------------------------------------
  function toast(msg, bad = false, ms = 2400) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.style.background = bad ? "#b00020" : "#333";
    els.toast.style.opacity = "1";
    els.toast.style.visibility = "visible";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      els.toast.style.opacity = "0";
      els.toast.style.visibility = "hidden";
    }, ms);
  }

  // -------------------------------------------------------------
  // Fetch and render cart
  // -------------------------------------------------------------
  async function loadCart() {
    try {
      const data = await apiRequest(CART_ENDPOINT);
      if (!data || !Array.isArray(data.items) || !data.items.length) {
        renderEmptyCart();
        return;
      }
      cartItems = data.items;
      renderCart(cartItems);
    } catch (err) {
      console.error("Failed to load cart:", err);
      toast("Failed to load cart", true);
      renderEmptyCart();
    }
  }

  function renderEmptyCart() {
    if (els.cartSummary) {
      els.cartSummary.innerHTML = `
        <div class="empty-cart">
          <p>Your cart is empty.</p>
          <a href="index.html" class="btn">Shop Now</a>
        </div>`;
    }
    if (els.placeOrderBtn) els.placeOrderBtn.disabled = true;
  }

  function renderCart(items) {
    if (!els.cartSummary) return;
    if (!Array.isArray(items) || !items.length) return renderEmptyCart();

    let subtotal = 0;
    els.cartSummary.innerHTML = items
      .map((i) => {
        const lineTotal = (Number(i.price) || 0) * (Number(i.quantity) || 1);
        subtotal += lineTotal;
        return `
          <div class="checkout-item">
            <div class="checkout-info">
              <h4>${i.product_name}</h4>
              <p>${i.variant_name || ""}</p>
              <p>Qty: ${i.quantity}</p>
            </div>
            <div class="checkout-price">₹${lineTotal.toFixed(2)}</div>
          </div>`;
      })
      .join("");

    const { shipping, total } = calculateTotals(subtotal);
    if (els.subtotal) els.subtotal.textContent = `₹${subtotal.toFixed(2)}`;
    if (els.shipping) els.shipping.textContent = `₹${shipping.toFixed(2)}`;
    if (els.total) els.total.textContent = `₹${total.toFixed(2)}`;
  }

  function calculateTotals(subtotal) {
    const shipping = subtotal > 1000 ? 0 : 50;
    const total = subtotal + shipping;
    return { shipping, total };
  }

  // -------------------------------------------------------------
  // Fetch and render addresses
  // -------------------------------------------------------------
  async function loadAddresses() {
    try {
      const addresses = await apiRequest(ADDRESSES_ENDPOINT);
      if (!Array.isArray(addresses) || !addresses.length) {
        renderNoAddresses();
        return;
      }
      renderAddresses(addresses);
    } catch (err) {
      console.error("Failed to load addresses:", err);
      renderNoAddresses();
    }
  }

  function renderNoAddresses() {
    if (els.addressSelector) {
      els.addressSelector.innerHTML = `
        <div class="no-address">
          <p>No saved addresses.</p>
          <a href="addresses.html" class="btn">Add Address</a>
        </div>`;
    }
  }

  function renderAddresses(addresses) {
    if (!els.addressSelector) return;

    els.addressSelector.innerHTML = addresses
      .map(
        (a) => `
        <label class="address-option">
          <input type="radio" name="address" value="${a.address_id}" ${
          a.is_default ? "checked" : ""
        }>
          <div class="address-card ${a.is_default ? "default" : ""}">
            <strong>${a.name}</strong><br>
            ${a.line1}<br>
            ${a.line2 ? `${a.line2}<br>` : ""}
            ${a.city}, ${a.state} - ${a.pincode}<br>
            Phone: ${a.phone}
          </div>
        </label>`
      )
      .join("");

    const defaultAddr = addresses.find((a) => a.is_default);
    if (defaultAddr) selectedAddressId = defaultAddr.address_id;

    els.addressSelector.addEventListener("change", (e) => {
      if (e.target.name === "address") {
        selectedAddressId = Number(e.target.value);
      }
    });
  }

  // -------------------------------------------------------------
  // Place order
  // -------------------------------------------------------------
  async function placeOrder() {
    if (!selectedAddressId) {
      toast("Please select a delivery address", true);
      return;
    }

    const paymentMethodEl = document.querySelector(
      'input[name="payment-method"]:checked'
    );
    const paymentMethod = paymentMethodEl ? paymentMethodEl.value : "cod";

    els.placeOrderBtn.disabled = true;

    try {
      const order = await apiRequest(ORDER_ENDPOINT, {
        method: "POST",
        body: {
          address_id: selectedAddressId,
          payment_method: paymentMethod,
        },
      });

      if (order && order.order_id) {
        await apiRequest(CART_CLEAR_ENDPOINT, { method: "POST" });
        toast("Order placed successfully!");
        setTimeout(() => {
          window.location.href = `order-details.html?order_id=${order.order_id}`;
        }, 1000);
      } else {
        toast("Failed to place order", true);
      }
    } catch (err) {
      console.error("Order placement failed:", err);
      if (err?.status === 401) {
        toast("Session expired. Please sign in again.", true);
        window.location.href = "profile.html";
      } else {
        toast("Failed to place order", true);
      }
    } finally {
      els.placeOrderBtn.disabled = false;
    }
  }

  // -------------------------------------------------------------
  // Initialize Checkout Page
  // -------------------------------------------------------------
  async function initCheckout() {
    try {
      const user = await window.auth.getCurrentUser();
      if (!user) {
        toast("Please sign in to continue", true);
        window.location.href = "profile.html";
        return;
      }

      await loadCart();
      await loadAddresses();
      if (window.updateNavbarCounts) window.updateNavbarCounts();

      if (els.placeOrderBtn)
        els.placeOrderBtn.addEventListener("click", placeOrder);
    } catch (err) {
      console.error("Checkout init failed:", err);
      toast("Checkout failed to initialize", true);
    }
  }

  // -------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", initCheckout);
})();
