// frontend/payment.js — Updated Checkout flow for VAKAADHA
(async function () {
  const deliveryAddressDiv = document.getElementById("deliveryAddress");
  const orderSummaryDiv = document.getElementById("orderSummary");
  const orderTotalEl = document.getElementById("orderTotal");
  const placeOrderBtn = document.getElementById("placeOrder");

  // Persistent session state
  let CURRENT_ORDER_ID = null;          
  let CURRENT_RAZORPAY_ORDER_ID = null; 
  let PAYMENT_IN_PROGRESS = false;      
  let PAYMENT_ATTEMPTED = false;        

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

  // ---------------- Cart Summary ----------------
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
    let items = JSON.parse(localStorage.getItem("selected_items")) || [];

    if (!items.length) {
      orderSummaryDiv.innerHTML = `<p>No items selected.</p>`;
      orderTotalEl.textContent = "0";
      return 0;
    }

    let total = 0;
    orderSummaryDiv.innerHTML = items.map(item => {
      const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);
      total += parseFloat(subtotal);
      return `
        <div class="order-item">
          <img src="${item.image_url}" class="order-thumb" />
          <div class="order-info">
            <span class="order-name">${item.product_name}</span>
            <span class="order-qty">Qty: ${item.quantity}</span>
          </div>
          <div class="order-price">₹${subtotal}</div>
        </div>
      `;
    }).join("");

    orderTotalEl.textContent = total.toFixed(2);
    return total;
  } catch (err) {
    console.error("Failed:", err);
    orderSummaryDiv.innerHTML = `<p>Error loading order.</p>`;
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
          PAYMENT_ATTEMPTED = true;
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

      rzp.on("payment.failed", (resp) => {
        PAYMENT_ATTEMPTED = true;
        reject(resp.error);
      });

      rzp.open();
    });
  }

  // ---------------- Payment Cancel Route ----------------
  async function cancelOrder(orderId) {
    return authFetch("/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
  }

  // ---------------- Abandon Checkout Route ----------------
  async function abandonOrder(orderId) {
    return authFetch("/api/payments/abandon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
  }

  // On page exit — abandon if no payment attempted
  window.addEventListener("beforeunload", async () => {
    if (CURRENT_ORDER_ID && !PAYMENT_ATTEMPTED) {
      await abandonOrder(CURRENT_ORDER_ID);
    }
  });

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
      // If already have an order, do NOT create again
      let orderData = null;

      if (!CURRENT_ORDER_ID) {
        orderData = await createPaymentOrder(addressId, method);
        CURRENT_ORDER_ID = orderData.order_id;
        CURRENT_RAZORPAY_ORDER_ID = orderData.razorpay_order_id;
      } else {
        // retry flow
        orderData = {
          order_id: CURRENT_ORDER_ID,
          razorpay_order_id: CURRENT_RAZORPAY_ORDER_ID,
          amount: parseFloat(orderTotalEl.textContent) * 100,
          key_id: window.RAZORPAY_KEY_ID,
        };
      }

      if (method === "COD") {
        showToast("Order placed successfully (Cash on Delivery)");
        await authFetch("/api/cart/clear", { method: "DELETE" });
        window.location.href = `order-success.html?orderId=${CURRENT_ORDER_ID}`;
        return;
      }

      // Razorpay Payment
      const paymentResp = await launchRazorpay(orderData);
      const verifyResp = await verifyPayment(paymentResp);

      CURRENT_ORDER_ID = verifyResp.order_id;

      if (verifyResp?.status === "success") {
        await authFetch("/api/cart/clear", { method: "DELETE" });
        window.location.href = `order-success.html?orderId=${verifyResp.order_id}`;
      } else {
        showToast("Payment failed. Retry or cancel.", "error");

        const retry = confirm("Payment failed. Try again?");
        if (!retry) {
          await cancelOrder(CURRENT_ORDER_ID);
          window.location.href = "cart.html";
        }
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      showToast("Payment process failed", "error");
    } finally {
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = "Place Order";
    }
  }

  // ---------------- Init ----------------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (window.auth?.initSession) await window.auth.initSession();

      const readyUser =
        firebase.auth().currentUser ||
        (await new Promise((res) => {
          const unsub = firebase.auth().onAuthStateChanged((u) => {
            unsub();
            res(u);
          });
        }));

      if (!readyUser) {
        window.location.href = "profile.html";
        return;
      }

      const token = await readyUser.getIdToken(true);
      localStorage.setItem("auth_token", token);

      if (window.updateNavbarCounts) await window.updateNavbarCounts(true);

      await loadDeliveryAddress();
      await loadCartSummary();

      if (placeOrderBtn) placeOrderBtn.addEventListener("click", handlePlaceOrder);
    } catch (err) {
      console.error("[payment.js] init failed:", err);
      showToast("Error initializing payment page", "error");
    }
  });
})();
