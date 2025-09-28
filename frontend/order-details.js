

document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.idToken) {
    alert("Please log in to view order details.");
    return window.location.href = "profile.html";
  }

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("id");

  const container = document.getElementById("orderDetailsContainer");
  if (!orderId) {
    container.innerHTML = "<p>Invalid order ID.</p>";
    return;
  }

  try {
    const res = await fetch(`/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${user.idToken}`
      }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to fetch order details");
    }

    const order = await res.json();

    const itemsHTML = order.items.map(item => {
      const imgFile = `./Images/${item.product_name.replace(/\s+/g, '_')}.jpg`; // Replace spaces
      return `
        <div class="order-item">
          <img src="${imgFile}" alt="${item.product_name}" onerror="this.src='./Images/default.jpg'" />
          <div class="item-info">
            <h4>${item.product_name}</h4>
            <p>Quantity: ${item.quantity}</p>
            <p>Price: ₹${item.price}</p>
            <p>Subtotal: ₹${(item.quantity * item.price).toFixed(2)}</p>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="order-summary">
        <h3>Order #${order.order_id}</h3>
        <p>Status: ${order.status}</p>
        <p>Date: ${new Date(order.order_date).toLocaleDateString()}</p>
        <p>Total: ₹${order.total_amount.toFixed(2)}</p>
      </div>
      <h4>Items:</h4>
      <div class="order-items">${itemsHTML}</div>
    `;
  } catch (err) {
    console.error("Error fetching order details:", err);
    container.innerHTML = `<p>Error: ${err.message}</p>`;
  }
});
