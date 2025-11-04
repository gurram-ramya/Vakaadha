// frontend/order_confirmation.js — fetches and renders a single order confirmation

document.addEventListener("DOMContentLoaded", async () => {
  const orderSummaryEl = document.getElementById("orderSummary");

  // Parse order_id from query parameter
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order_id");

  if (!orderId) {
    orderSummaryEl.innerHTML = "<p>Invalid or missing order reference.</p>";
    setTimeout(() => window.location.href = "orders.html", 2000);
    return;
  }

  // Fetch the authenticated user
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.user_id) {
    orderSummaryEl.innerHTML = "<p>Please log in to view your order confirmation.</p>";
    setTimeout(() => window.location.href = "profile.html", 2000);
    return;
  }

  try {
    // Fetch order details from backend
    // const res = await fetch(`/api/orders/${orderId}`);
    const res = await fetch(`/api/orders/confirmation/${orderId}`);
    if (!res.ok) throw new Error("Failed to load order data");

    const order = await res.json();

    // Validate ownership
    if (order.user_id && order.user_id !== user.user_id) {
      orderSummaryEl.innerHTML = "<p>Unauthorized access to order.</p>";
      return;
    }

    const itemsHTML = (order.items || [])
      .map(item => `
        <div class="order-item">
          <span>${item.product_name} (${item.size || "-"}) × ${item.quantity}</span>
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
      <p><strong>Transaction ID:</strong> ${order.razorpay_payment_id || order.payment_txn_id || "—"}</p>


      <h4>Delivery Address:</h4>
      <p>${address.name || ""}<br>
      ${address.line1 || ""}, ${address.city || ""} - ${address.pincode || ""}</p>

      <h4>Items:</h4>
      ${itemsHTML}

      <h4>Total: ₹${(order.total_cents / 100).toFixed(2)}</h4>
    `;
  } catch (err) {
    console.error(err);
    orderSummaryEl.innerHTML = "<p>Unable to load order details.</p>";
  }
});
