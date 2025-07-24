// document.addEventListener("DOMContentLoaded", () => {
//   fetchOrders();
// });

// function fetchOrders() {
//   const user = JSON.parse(localStorage.getItem("loggedInUser"));
//   if (!user || !user.token) {
//     document.getElementById("ordersContainer").innerHTML =
//       "<p>Please login to view your orders.</p>";
//     return;
//   }

//   fetch("http://127.0.0.1:5000/orders", {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${user.token}`,
//     },
//   })
//     .then((res) => res.json())
//     .then((orders) => renderOrders(orders))
//     .catch((err) => {
//       console.error("Failed to fetch orders", err);
//       document.getElementById("ordersContainer").innerHTML =
//         "<p class='empty-state'>Failed to load order history.</p>";
//     });
// }

// function renderOrders(orders) {
//   const container = document.getElementById("ordersContainer");
//   container.innerHTML = "";

//   if (!orders.length) {
//     container.innerHTML =
//       "<div class='empty-state'><i class='fa fa-box-open'></i><p>No past orders found.</p></div>";
//     return;
//   }

//   orders.forEach((order) => {
//     const card = document.createElement("div");
//     card.className = "order-card";
//     card.innerHTML = `
//       <h3>Order #${order.order_id}</h3>
//       <p><strong>Status:</strong> ${order.status}</p>
//       <p><strong>Date:</strong> ${new Date(order.order_date).toLocaleString()}</p>
//       <p><strong>Total:</strong> ₹${order.total_amount.toFixed(2)}</p>
//       <button onclick="viewOrder(${order.order_id})" class="btn-primary">View Details</button>
//     `;
//     container.appendChild(card);
//   });
// }

// function viewOrder(orderId) {
//   alert(`View details for order #${orderId}`);
//   window.location.href = `order-details.html?id=${orderId}`;
// }



document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.idToken) {
    alert("Please log in to view your orders.");
    return window.location.href = "profile.html";
  }

  try {
    const res = await fetch("/orders", {
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
        <a href="order-details.html?id=${order.order_id}">View Details →</a>
      </div>
    `).join("");
  } catch (err) {
    console.error("Error loading orders:", err);
    alert("Failed to load orders.");
  }
});
