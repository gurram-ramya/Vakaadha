document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.idToken) {
    alert("Please log in to view your orders.");
    return window.location.href = "profile.html";
  }

  try {
    const res = await fetch("/users/me/orders", {
      headers: {
        Authorization: `Bearer ${user.idToken}`
      }
    });
    const orders = await res.json();

    const container = document.getElementById("ordersContainer");
    if (orders.length === 0) {
      container.innerHTML = "<p>No orders found.</p>";
      return;
    }

    container.innerHTML = orders.map(order => `
      <div class="order-card">
        <h3>Order #${order.order_id}</h3>
        <p>Date: ${new Date(order.order_date).toLocaleDateString()}</p>
        <p>Status: ${order.status}</p>
        <p>Total: ₹${order.total_amount.toFixed(2)}</p>
        <p>Payment: ${order.payment_method || "N/A"}</p>
      </div>
    `).join("");
  } catch (err) {
    console.error("Error loading orders:", err);
    alert("Failed to load orders.");
  }
});
