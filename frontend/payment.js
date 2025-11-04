// frontend/payment.js — Integrated Razorpay + Backend Checkout

function showToast(message, bg = "#28a745") {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    background: bg,
    color: "#fff",
    padding: "10px 15px",
    borderRadius: "6px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.3s ease",
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => (toast.style.opacity = "1"));
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  const addressEl = document.getElementById("deliveryAddress");
  const summaryEl = document.getElementById("orderSummary");
  const totalEl = document.getElementById("orderTotal");
  const placeOrderBtn = document.getElementById("placeOrder");

  const SELECTED_ADDRESS_KEY = "selectedAddress";
  const BUY_NOW_KEY = "buyNowItem";
  const CHECKOUT_KEY = "checkout_items";
  const CART_KEY = "vakaadha_cart_v1";
  const USER_KEY = "user_profile"; // assumed user info in local/session storage

  // ---- Address ----
  const selectedAddress = JSON.parse(sessionStorage.getItem(SELECTED_ADDRESS_KEY) || "null");
  if (selectedAddress) {
    addressEl.innerHTML = `
      <p><strong>${selectedAddress.name}</strong><br>
      ${selectedAddress.street}, ${selectedAddress.city} - ${selectedAddress.zip}</p>
    `;
  } else {
    addressEl.innerHTML = `<p style="color:red;">No address selected. <a href="addresses.html">Choose one</a></p>`;
  }

  // ---- Items ----
  let items = [];
  let mode = "";
  const buyNowItem = JSON.parse(sessionStorage.getItem(BUY_NOW_KEY) || "null");
  const checkoutItems = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || "[]");
  if (buyNowItem) {
    items = [buyNowItem];
    mode = "BUY_NOW";
  } else if (checkoutItems && checkoutItems.length) {
    items = checkoutItems;
    mode = "CART";
  }

  // ---- Render ----
  if (items.length) {
    summaryEl.innerHTML = items
      .map((item) => {
        const subtotal = (item.price || 0) * (item.qty || 1);
        return `
        <div class="order-item">
          <span>${item.name} ${item.size ? `(${item.size})` : ""} × ${item.qty || 1}</span>
          <span>₹${subtotal}</span>
        </div>`;
      })
      .join("");
    const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);
    totalEl.textContent = total;
  } else {
    summaryEl.innerHTML = "<p>No items to checkout.</p>";
    totalEl.textContent = "0";
  }

  // ---- Place Order ----
  placeOrderBtn.addEventListener("click", async () => {
    if (!selectedAddress) {
      alert("Please select an address before placing order.");
      return;
    }
    if (!items.length) {
      alert("No products to checkout.");
      return;
    }

    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const totalAmount = parseInt(totalEl.textContent, 10);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || "{}");
    const user_id = user.user_id || 1; // fallback for test mode

    try {
      // 1. Create order in backend
      const orderResp = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          address: selectedAddress,
          items,
          total_cents: totalAmount * 100,
        }),
      });
      const orderData = await orderResp.json();
      if (!orderResp.ok) throw new Error(orderData.error || "Failed to create order");

      const { order_id } = orderData;

      // 2. Create Razorpay payment order
      const paymentResp = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          order_id,
          amount_cents: totalAmount * 100,
        }),
      });
      const paymentData = await paymentResp.json();
      if (!paymentResp.ok) throw new Error(paymentData.error || "Payment init failed");

      // 3. Launch Razorpay Checkout
      const options = {
        key: paymentData.razorpay_key_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        name: "VAKAADHA",
        description: "Order Payment",
        order_id: paymentData.razorpay_order_id,
        handler: async function (response) {
          // 4. Verify payment on backend
          const verifyResp = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyResp.json();

          showToast("Payment successful!", "#28a745");
          setTimeout(() => {
            window.location.href = `/order_confirmation.html?order_id=${order_id}`;
          }, 1500);
          if (!verifyResp.ok || verifyData.status !== "success") {
            showToast("Payment verification failed", "#dc3545");
            return;
          }

          // 5. Clean up session/cart and redirect
          if (mode === "BUY_NOW") sessionStorage.removeItem(BUY_NOW_KEY);
          else if (mode === "CART") {
            sessionStorage.removeItem(CHECKOUT_KEY);
            const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
            const remaining = cart.filter(
              (cartItem) =>
                !items.find((chk) => chk.id === cartItem.id && chk.size === cartItem.size)
            );
            localStorage.setItem(CART_KEY, JSON.stringify(remaining));
          }

          showToast("✅ Payment successful! Redirecting...");
          setTimeout(() => (window.location.href = "orders.html"), 1500);
        },
        prefill: {
          name: user.name || selectedAddress.name,
          email: user.email || "",
          contact: selectedAddress.phone || "",
        },
        theme: { color: "#3399cc" },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err);
      showToast("Payment failed: " + err.message, "#dc3545");
    }
  });
});
