// public/js/orders.js — synced with backend /api/orders
document.addEventListener("DOMContentLoaded", async () => {
  const ordersList = document.getElementById("ordersList");
  const orderModal = document.getElementById("orderModal");
  const orderDetails = document.getElementById("orderDetails");
  const closeBtn = orderModal.querySelector(".close");

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.user_id) {
    ordersList.innerHTML = "<p>Please log in to view orders.</p>";
    return;
  }

  try {
    const res = await fetch(`/api/orders/user/${user.user_id}`);
    if (!res.ok) throw new Error("Failed to fetch orders");
    const orders = await res.json();

    if (!orders.length) {
      ordersList.innerHTML = "<p>No orders placed yet.</p>";
      return;
    }

    ordersList.innerHTML = orders.map(order => {
      const firstItem = order.items?.[0] || {};
      return `
        <div class="order-card">
          <div class="order-header">
            <span>Order #${order.order_no || order.order_id}</span>
            <span>Status: ${order.status}</span>
          </div>
          <div class="order-items">
            <img src="${firstItem.image_url || './placeholder.png'}" alt="${firstItem.product_name || ''}"/>
            <div>
              <p>${firstItem.product_name || 'Unknown'} (${firstItem.size || "-"}) × ${firstItem.quantity || 1}</p>
              <p><strong>₹${(order.total_cents / 100).toFixed(2)}</strong></p>
              <p><small>${order.created_at || ''}</small></p>
            </div>
          </div>
          <button class="view-btn" data-id="${order.order_id}">View Details</button>
        </div>
      `;
    }).join("");
  } catch (err) {
    ordersList.innerHTML = `<p>Error loading orders: ${err.message}</p>`;
  }

  // Modal logic
  ordersList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".view-btn");
    if (!btn) return;

    const orderId = parseInt(btn.dataset.id, 10);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error("Failed to fetch order details");
      const order = await res.json();

      orderDetails.innerHTML = `
        <h3>Order #${order.order_no || order.order_id}</h3>
        <p><strong>Status:</strong> ${order.status}</p>
        <p><strong>Date:</strong> ${order.created_at}</p>
        <p><strong>Payment:</strong> ${order.payment_status}</p>
        <h4>Shipping Address:</h4>
        <p>${order.address?.name || ""}<br>
        ${order.address?.line1 || ""}, ${order.address?.city || ""} - ${order.address?.pincode || ""}</p>
        <h4>Items:</h4>
        ${order.items.map(item => `
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
            <img src="${item.image_url || './placeholder.png'}" width="50"/>
            <div>
              <p>${item.product_name} (${item.size || "-"}) × ${item.quantity}</p>
              <p>₹${(item.price_cents / 100).toFixed(2)} each</p>
            </div>
          </div>
        `).join("")}
        <h4>Total: ₹${(order.total_cents / 100).toFixed(2)}</h4>
      `;
      orderModal.classList.remove("hidden");
    } catch (err) {
      alert("Failed to load order details");
    }
  });

  closeBtn.addEventListener("click", () => orderModal.classList.add("hidden"));
  window.addEventListener("click", (e) => {
    if (e.target === orderModal) orderModal.classList.add("hidden");
  });
});
