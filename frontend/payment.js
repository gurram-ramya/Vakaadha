// // frontend/payment.js — Integrated Razorpay + Backend Checkout

// function showToast(message, bg = "#28a745") {
//   const toast = document.createElement("div");
//   toast.textContent = message;
//   Object.assign(toast.style, {
//     position: "fixed",
//     top: "20px",
//     right: "20px",
//     background: bg,
//     color: "#fff",
//     padding: "10px 15px",
//     borderRadius: "6px",
//     boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
//     zIndex: "9999",
//     opacity: "0",
//     transition: "opacity 0.3s ease",
//   });
//   document.body.appendChild(toast);
//   requestAnimationFrame(() => (toast.style.opacity = "1"));
//   setTimeout(() => {
//     toast.style.opacity = "0";
//     setTimeout(() => toast.remove(), 300);
//   }, 2000);
// }

// document.addEventListener("DOMContentLoaded", () => {
//   const addressEl = document.getElementById("deliveryAddress");
//   const summaryEl = document.getElementById("orderSummary");
//   const totalEl = document.getElementById("orderTotal");
//   const placeOrderBtn = document.getElementById("placeOrder");

//   const SELECTED_ADDRESS_KEY = "selectedAddress";
//   const BUY_NOW_KEY = "buyNowItem";
//   const CHECKOUT_KEY = "checkout_items";
//   const CART_KEY = "vakaadha_cart_v1";
//   const USER_KEY = "user_profile"; // assumed user info in local/session storage

//   // ---- Address ----
//   const selectedAddress = JSON.parse(sessionStorage.getItem(SELECTED_ADDRESS_KEY) || "null");
//   if (selectedAddress) {
//     addressEl.innerHTML = `
//       <p><strong>${selectedAddress.name}</strong><br>
//       ${selectedAddress.street}, ${selectedAddress.city} - ${selectedAddress.zip}</p>
//     `;
//   } else {
//     addressEl.innerHTML = `<p style="color:red;">No address selected. <a href="addresses.html">Choose one</a></p>`;
//   }

//   // ---- Items ----
//   let items = [];
//   let mode = "";
//   const buyNowItem = JSON.parse(sessionStorage.getItem(BUY_NOW_KEY) || "null");
//   const checkoutItems = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || "[]");
//   if (buyNowItem) {
//     items = [buyNowItem];
//     mode = "BUY_NOW";
//   } else if (checkoutItems && checkoutItems.length) {
//     items = checkoutItems;
//     mode = "CART";
//   }

//   // ---- Render ----
//   if (items.length) {
//     summaryEl.innerHTML = items
//       .map((item) => {
//         const subtotal = (item.price || 0) * (item.qty || 1);
//         return `
//         <div class="order-item">
//           <span>${item.name} ${item.size ? `(${item.size})` : ""} × ${item.qty || 1}</span>
//           <span>₹${subtotal}</span>
//         </div>`;
//       })
//       .join("");
//     const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);
//     totalEl.textContent = total;
//   } else {
//     summaryEl.innerHTML = "<p>No items to checkout.</p>";
//     totalEl.textContent = "0";
//   }

//   // ---- Place Order ----
//   placeOrderBtn.addEventListener("click", async () => {
//     if (!selectedAddress) {
//       alert("Please select an address before placing order.");
//       return;
//     }
//     if (!items.length) {
//       alert("No products to checkout.");
//       return;
//     }

//     const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
//     const totalAmount = parseInt(totalEl.textContent, 10);
//     const user = JSON.parse(localStorage.getItem(USER_KEY) || "{}");
//     const user_id = user.user_id || 1; // fallback for test mode

//     try {
//       // 1. Create order in backend
//       const orderResp = await fetch("/api/orders/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           user_id,
//           address: selectedAddress,
//           items,
//           total_cents: totalAmount * 100,
//         }),
//       });
//       const orderData = await orderResp.json();
//       if (!orderResp.ok) throw new Error(orderData.error || "Failed to create order");

//       const { order_id } = orderData;

//       // 2. Create Razorpay payment order
//       const paymentResp = await fetch("/api/payments/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           user_id,
//           order_id,
//           amount_cents: totalAmount * 100,
//         }),
//       });
//       const paymentData = await paymentResp.json();
//       if (!paymentResp.ok) throw new Error(paymentData.error || "Payment init failed");

//       // 3. Launch Razorpay Checkout
//       const options = {
//         key: paymentData.razorpay_key_id,
//         amount: paymentData.amount,
//         currency: paymentData.currency,
//         name: "VAKAADHA",
//         description: "Order Payment",
//         order_id: paymentData.razorpay_order_id,
//         handler: async function (response) {
//           // 4. Verify payment on backend
//           const verifyResp = await fetch("/api/payments/verify", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//               razorpay_order_id: response.razorpay_order_id,
//               razorpay_payment_id: response.razorpay_payment_id,
//               razorpay_signature: response.razorpay_signature,
//             }),
//           });
//           const verifyData = await verifyResp.json();

//           showToast("Payment successful!", "#28a745");
//           setTimeout(() => {
//             window.location.href = `/order_confirmation.html?order_id=${order_id}`;
//           }, 1500);
//           if (!verifyResp.ok || verifyData.status !== "success") {
//             showToast("Payment verification failed", "#dc3545");
//             return;
//           }

//           // 5. Clean up session/cart and redirect
//           if (mode === "BUY_NOW") sessionStorage.removeItem(BUY_NOW_KEY);
//           else if (mode === "CART") {
//             sessionStorage.removeItem(CHECKOUT_KEY);
//             const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
//             const remaining = cart.filter(
//               (cartItem) =>
//                 !items.find((chk) => chk.id === cartItem.id && chk.size === cartItem.size)
//             );
//             localStorage.setItem(CART_KEY, JSON.stringify(remaining));
//           }

//           showToast("✅ Payment successful! Redirecting...");
//           setTimeout(() => (window.location.href = "orders.html"), 1500);
//         },
//         prefill: {
//           name: user.name || selectedAddress.name,
//           email: user.email || "",
//           contact: selectedAddress.phone || "",
//         },
//         theme: { color: "#3399cc" },
//       };

//       const rzp = new Razorpay(options);
//       rzp.open();
//     } catch (err) {
//       console.error("Payment error:", err);
//       showToast("Payment failed: " + err.message, "#dc3545");
//     }
//   });
// });

// frontend/payment.js — Checkout flow for VAKAADHA (enhanced with product details + counts)
(async function () {
  const deliveryAddressDiv = document.getElementById("deliveryAddress");
  const orderSummaryDiv = document.getElementById("orderSummary");
  const orderTotalEl = document.getElementById("orderTotal");
  const placeOrderBtn = document.getElementById("placeOrder");

  // 🆕 Modal elements
  const addressModal = document.getElementById("addressSelectModal");
  const addressListModal = document.getElementById("addressListModal");
  const closeModalBtn = document.getElementById("closeAddressModal");
  const changeAddressBtn = document.getElementById("changeAddressBtn");

  // ---------------- Utils ----------------
  function showToast(msg, type = "info") {
    console.log(`[Toast:${type}]`, msg);
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = msg;
      toast.style.background = type === "error" ? "#b00020" : "#333";
      toast.style.opacity = "1";
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => (toast.style.opacity = "0"), 2500);
    } else alert(msg);
  }

  function getQueryParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  async function getToken() {
    let t = localStorage.getItem("auth_token");
    if (t) return t;
    if (window.auth?.initSession) await window.auth.initSession();
    t = await window.auth.getToken();
    if (t) localStorage.setItem("auth_token", t);
    return t;
  }

  async function authFetch(url, options = {}) {
    const token = await getToken();
    const headers = options.headers || {};
    headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers, credentials: "include" });
    if (res.status === 401) {
      showToast("Please log in again", "error");
      setTimeout(() => (window.location.href = "profile.html"), 1000);
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  }

  // ---------------- Load Address ----------------
  async function loadDeliveryAddress(addressId = null) {
    addressId = addressId || getQueryParam("addressId");
    if (!addressId) {
      deliveryAddressDiv.innerHTML = `<p>No address selected. <a href="addresses.html">Choose one</a>.</p>`;
      return null;
    }

    try {
      const addr = await authFetch(`/api/addresses/${addressId}`);
      if (!addr) throw new Error("Invalid address");
      deliveryAddressDiv.innerHTML = `
        <div class="address-info">
          <strong>${addr.name}</strong><br>
          ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br>
          ${addr.city}, ${addr.state} - ${addr.pincode}<br>
          📞 ${addr.phone}
        </div>
      `;
      deliveryAddressDiv.dataset.addressId = addr.address_id || addressId;
      return addr;
    } catch (err) {
      console.error("Failed to load address:", err);
      deliveryAddressDiv.innerHTML = `<p>Error loading address. <a href="addresses.html">Choose another</a>.</p>`;
      return null;
    }
  }

  // ---------------- Load Cart Summary (Compact Order Review) ----------------
  async function getCart() {
    const token = localStorage.getItem("auth_token");
    const guestId = localStorage.getItem("guest_id");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const url = guestId ? `/api/cart?guest_id=${guestId}` : "/api/cart";
    const res = await fetch(url, { headers, credentials: "include" });
    if (!res.ok) throw new Error(`Cart fetch failed: ${res.status}`);
    return res.json();
  }

  async function loadCartSummary() {
    try {
      const cart = await getCart();
      const items = cart.items || [];
      if (!items.length) {
        orderSummaryDiv.innerHTML = `<p>Your cart is empty.</p>`;
        orderTotalEl.textContent = "0";
        return 0;
      }

      let total = 0;
      orderSummaryDiv.innerHTML = items.map((item) => {
        const name = item.product_name || item.name || "Product";
        const img = item.image_url || "Images/default.jpg";
        const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);
        total += parseFloat(subtotal);
        return `
          <div class="order-item">
            <img src="${img}" alt="${name}" class="order-thumb" />
            <div class="order-info">
              <span class="order-name">${name}</span>
              <span class="order-qty">Qty: ${item.quantity}</span>
            </div>
            <div class="order-price">₹${subtotal}</div>
          </div>
        `;
      }).join("");

      orderTotalEl.textContent = total.toFixed(2);
      return total;
    } catch (err) {
      console.error("Failed to load cart:", err);
      orderSummaryDiv.innerHTML = `<p>Failed to load cart.</p>`;
      orderTotalEl.textContent = "0";
      return 0;
    }
  }

  // ---------------- Create Payment Order ----------------
  async function createPaymentOrder(addressId, method) {
    const body = { address_id: addressId, payment_method: method };
    return authFetch("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // ---------------- Verify Payment ----------------
  async function verifyPayment(payload) {
    return authFetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // ---------------- Razorpay Integration ----------------
  function launchRazorpay(orderInfo) {
    return new Promise((resolve, reject) => {
      const options = {
        key: orderInfo.key_id,
        amount: orderInfo.amount,
        currency: "INR",
        name: "VAKAADHA",
        description: "Order Payment",
        order_id: orderInfo.razorpay_order_id,
        handler: function (response) {
          resolve({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: orderInfo.prefill || {},
        theme: { color: "#333" },
      };
      const rzp = new Razorpay(options);
      rzp.on("payment.failed", (resp) => reject(resp.error));
      rzp.open();
    });
  }

  // ---------------- Main Checkout Flow ----------------
  async function handlePlaceOrder() {
    const addressId = deliveryAddressDiv.dataset.addressId || getQueryParam("addressId");
    if (!addressId) return showToast("Select a delivery address first", "error");

    const method = document.querySelector('input[name="payment"]:checked')?.value || "COD";
    const total = parseFloat(orderTotalEl.textContent);
    if (!total || total <= 0) return showToast("Your cart is empty", "error");

    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = "Processing...";

    try {
      const orderData = await createPaymentOrder(addressId, method);

      if (method === "COD") {
        showToast("Order placed successfully (Cash on Delivery)");
        window.location.href = `order-success.html?orderId=${orderData.order_id}`;
        return;
      }

      const paymentResp = await launchRazorpay(orderData);
      const verifyResp = await verifyPayment(paymentResp);

      if (verifyResp?.status === "success") {
        showToast("Payment successful!");
        window.location.href = `order-success.html?orderId=${orderData.order_id}`;
      } else {
        showToast("Payment verification failed", "error");
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      showToast("Payment process failed", "error");
    } finally {
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = "Place Order";
    }
  }

  // ---------------- Address Modal Handling ----------------
  async function openAddressModal() {
    try {
      addressListModal.innerHTML = `<p>Loading...</p>`;
      addressModal.classList.add("active");

      const addrs = await authFetch("/api/addresses");
      if (!addrs.length) {
        addressListModal.innerHTML = `<p>No saved addresses found.</p>`;
        return;
      }

      addressListModal.innerHTML = addrs.map((a) => `
        <div class="address-card" data-id="${a.address_id}">
          <strong>${a.name}</strong><br>
          ${a.line1}${a.line2 ? ", " + a.line2 : ""}<br>
          ${a.city}, ${a.state} - ${a.pincode}<br>
          📞 ${a.phone}<br>
          <button class="small selectAddrBtn" data-id="${a.address_id}">Deliver Here</button>
        </div>`).join("");

      addressListModal.querySelectorAll(".selectAddrBtn").forEach((btn) =>
        btn.addEventListener("click", async (e) => {
          const selectedId = e.target.dataset.id;
          await loadDeliveryAddress(selectedId);
          addressModal.classList.remove("active");
          history.replaceState({}, "", `?addressId=${selectedId}`);
        })
      );
    } catch (err) {
      console.error("Failed to load addresses:", err);
      addressListModal.innerHTML = `<p>Error loading addresses</p>`;
    }
  }

  closeModalBtn.addEventListener("click", () => addressModal.classList.remove("active"));
  if (changeAddressBtn) changeAddressBtn.addEventListener("click", openAddressModal);

  // ---------------- Init ----------------
  document.addEventListener("DOMContentLoaded", async () => {
    console.time("🕒 payment_init_total");
    try {
      if (window.auth?.initSession) await window.auth.initSession();

      const readyUser = firebase.auth().currentUser || await new Promise((res) => {
        const unsub = firebase.auth().onAuthStateChanged((u) => { unsub(); res(u); });
      });

      if (!readyUser) {
        console.warn("⚠️ No user logged in, redirecting to profile");
        window.location.href = "profile.html";
        return;
      }

      const token = await readyUser.getIdToken(true);
      localStorage.setItem("auth_token", token);

      // ✅ Force navbar counts to refresh after auth
      if (window.updateNavbarCounts) await window.updateNavbarCounts(true);

      console.timeLog("🕒 payment_init_total", "Auth ready ✅");

      await loadDeliveryAddress();
      await loadCartSummary();

      if (placeOrderBtn) placeOrderBtn.addEventListener("click", handlePlaceOrder);

      console.timeEnd("🕒 payment_init_total");
    } catch (err) {
      console.error("[payment.js] init failed:", err);
      showToast("Error initializing payment page", "error");
    }
  });
})();
