document.addEventListener("DOMContentLoaded", () => {
  const ordersList = document.getElementById("ordersList");
  const orderModal = document.getElementById("orderModal");
  const orderDetails = document.getElementById("orderDetails");
  const closeBtn = orderModal.querySelector(".close");

  const orders = JSON.parse(localStorage.getItem("orders") || "[]");

  if (!orders.length) {
    ordersList.innerHTML = "<p>No orders placed yet.</p>";
    return;
  }

  // Render Orders
  ordersList.innerHTML = orders.map(order => {
    const firstItem = order.items[0];
    return `
      <div class="order-card">
        <div class="order-header">
          <span>Order ID: ${order.id}</span>
          <span>Status: ${order.status}</span>
        </div>
        <div class="order-items">
          <img src="${firstItem.image || './placeholder.png'}" alt="${firstItem.name}"/>
          <div>
            <p>${firstItem.name} (${firstItem.size || "-"}) × ${firstItem.qty || 1}</p>
            <p><strong>₹${order.total}</strong></p>
            <p><small>${order.date}</small></p>
          </div>
        </div>
        <button class="view-btn" data-id="${order.id}">View Details</button>
      </div>
    `;
  }).join("");

  // Handle modal open
  ordersList.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-btn");
    if (!btn) return;

    const id = parseInt(btn.dataset.id, 10);
    const order = orders.find(o => o.id === id);

    if (order) {
      orderDetails.innerHTML = `
        <h3>Order ID: ${order.id}</h3>
        <p><strong>Status:</strong> ${order.status}</p>
        <p><strong>Date:</strong> ${order.date}</p>
        <p><strong>Payment:</strong> ${order.payment}</p>
        <h4>Delivery Address:</h4>
        <p>${order.address.name}<br>
        ${order.address.street}, ${order.address.city} - ${order.address.zip}</p>
        <h4>Items:</h4>
        ${order.items.map(item => `
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
            <img src="${item.image || './placeholder.png'}" width="50"/>
            <div>
              <p>${item.name} (${item.size || "-"}) × ${item.qty || 1}</p>
              <p>₹${item.price} each</p>
            </div>
          </div>
        `).join("")}
        <h4>Total: ₹${order.total}</h4>
      `;
      orderModal.classList.remove("hidden");
    }
  });

  // Close modal
  closeBtn.addEventListener("click", () => {
    orderModal.classList.add("hidden");
  });

  window.addEventListener("click", (e) => {
    if (e.target === orderModal) {
      orderModal.classList.add("hidden");
    }
  });
});
