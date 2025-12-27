// ============================================================
// order_confirmation.js — Auth-aligned, token-safe, deterministic
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  const orderSummaryEl = document.getElementById("orderSummary");

  function fail(msg, redirect = true) {
    orderSummaryEl.innerHTML = `<p>${msg}</p>`;
    if (redirect) {
      setTimeout(() => {
        window.location.href = "orders.html";
      }, 2000);
    }
  }

  // ------------------------------------------------------------
  // Parse order_id
  // ------------------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order_id");

  if (!orderId) {
    fail("Invalid or missing order reference.");
    return;
  }

  // ------------------------------------------------------------
  // Ensure apiRequest is available
  // ------------------------------------------------------------
  if (typeof window.apiRequest !== "function") {
    fail("Application error. Please reload.");
    return;
  }

  // ------------------------------------------------------------
  // Fetch order confirmation (backend enforces ownership)
  // ------------------------------------------------------------
  let order;
  try {
    order = await window.apiRequest(`/api/orders/confirmation/${orderId}`);
  } catch (err) {
    const status = Number(err?.status || 0);

    if (status === 401) {
      fail("Please log in to view your order.");
      return;
    }

    if (status === 404) {
      fail("Order not found.");
      return;
    }

    console.error("[order_confirmation] fetch failed", err);
    fail("Unable to load order details.");
    return;
  }

  // ------------------------------------------------------------
  // Render order
  // ------------------------------------------------------------
  const itemsHTML = (order.items || [])
    .map(item => `
      <div class="order-item">
        <span>
          ${item.product_name}
          ${item.size ? `(${item.size})` : ""}
          × ${item.quantity}
        </span>
        <span>₹${(item.price_cents / 100).toFixed(2)}</span>
      </div>
    `)
    .join("");

  const address = order.address || {};

  orderSummaryEl.innerHTML = `
    <h3>Order #${order.order_no || order.order_id}</h3>

    <p><strong>Status:</strong> ${order.status}</p>
    <p><strong>Date:</strong> ${order.created_at}</p>
    <p><strong>Payment:</strong> ${order.payment_status || "Confirmed"}</p>
    <p><strong>Transaction ID:</strong>
      ${order.razorpay_payment_id || order.payment_txn_id || "—"}
    </p>

    <h4>Delivery Address</h4>
    <p>
      ${address.name || ""}<br>
      ${address.line1 || ""}<br>
      ${address.city || ""} ${address.pincode || ""}
    </p>

    <h4>Items</h4>
    ${itemsHTML}

    <h4>Total: ₹${(order.total_cents / 100).toFixed(2)}</h4>
  `;
});
