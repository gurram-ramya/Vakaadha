// document.addEventListener("DOMContentLoaded", () => {
//   const params = new URLSearchParams(window.location.search);
//   const orderId = params.get("id");
//   if (!orderId) {
//     document.getElementById("orderDetails").innerHTML =
//       "<p>Order ID not found in URL.</p>";
//     return;
//   }

//   fetchOrderDetails(orderId);
// });

// function fetchOrderDetails(orderId) {
//   const user = JSON.parse(localStorage.getItem("loggedInUser"));
//   if (!user || !user.token) {
//     document.getElementById("orderDetails").innerHTML =
//       "<p>Please login to view order details.</p>";
//     return;
//   }

//   fetch(`http://127.0.0.1:5000/orders/${orderId}`, {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${user.token}`,
//     },
//   })
//     .then((res) => res.json())
//     .then((order) => renderOrder(order))
//     .catch((err) => {
//       console.error("Error fetching order", err);
//       document.getElementById("orderDetails").innerHTML =
//         "<p class='empty-state'>Failed to load order details.</p>";
//     });
// }

// function renderOrder(order) {
//   const container = document.getElementById("orderDetails");
//   container.innerHTML = `
//     <div class="order-summary">
//       <h3>Order #${order.order_id}</h3>
//       <p><strong>Status:</strong> ${order.status}</p>
//       <p><strong>Placed:</strong> ${new Date(order.order_date).toLocaleString()}</p>
//       <p><strong>Total:</strong> ₹${order.total_amount.toFixed(2)}</p>
//       <hr>
//       <h4>Items:</h4>
//       <div class="order-items">
//         ${order.items
//           .map(
//             (item) => `
//           <div class="order-item">
//             <span><strong>${item.product_name}</strong> (x${item.quantity})</span>
//             <span>₹${(item.price * item.quantity).toFixed(2)}</span>
//           </div>
//         `
//           )
//           .join("")}
//       </div>
//     </div>
//   `;
// }


document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.idToken) {
    alert("Please log in to view order details.");
    return window.location.href = "profile.html";
  }

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");

  try {
    const res = await fetch(`/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${user.idToken}`
      }
    });
    const order = await res.json();

    const container = document.getElementById("orderDetailContent");
    container.innerHTML = `
      <h3>Order #${order.order_id}</h3>
      <p>Date: ${new Date(order.order_date).toLocaleDateString()}</p>
      <p>Status: ${order.status}</p>
      <p>Total Paid: ₹${order.total_amount.toFixed(2)}</p>
      <hr />
      <h4>Items:</h4>
      ${order.items.map(item => `
        <div class="order-item">
          <p>${item.product_name} x${item.quantity} – ₹${(item.price * item.quantity).toFixed(2)}</p>
        </div>
      `).join("")}
    `;
  } catch (err) {
    console.error("Error loading order:", err);
    document.getElementById("orderDetailContent").innerHTML = "<p>Failed to load order details.</p>";
  }
});
