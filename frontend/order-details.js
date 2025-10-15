

// document.addEventListener("DOMContentLoaded", async () => {
//   const user = JSON.parse(localStorage.getItem("loggedInUser"));
//   if (!user || !user.idToken) {
//     alert("Please log in to view order details.");
//     return window.location.href = "profile.html";
//   }

//   const urlParams = new URLSearchParams(window.location.search);
//   const orderId = urlParams.get("id");

//   const container = document.getElementById("orderDetailsContainer");
//   if (!orderId) {
//     container.innerHTML = "<p>Invalid order ID.</p>";
//     return;
//   }

//   try {
//     const res = await fetch(`/orders/${orderId}`, {
//       headers: {
//         Authorization: `Bearer ${user.idToken}`
//       }
//     });

//     if (!res.ok) {
//       const errData = await res.json();
//       throw new Error(errData.error || "Failed to fetch order details");
//     }

//     const order = await res.json();

//     const itemsHTML = order.items.map(item => {
//       const imgFile = `./Images/${item.product_name.replace(/\s+/g, '_')}.jpg`; // Replace spaces
//       return `
//         <div class="order-item">
//           <img src="${imgFile}" alt="${item.product_name}" onerror="this.src='./Images/default.jpg'" />
//           <div class="item-info">
//             <h4>${item.product_name}</h4>
//             <p>Quantity: ${item.quantity}</p>
//             <p>Price: ₹${item.price}</p>
//             <p>Subtotal: ₹${(item.quantity * item.price).toFixed(2)}</p>
//           </div>
//         </div>
//       `;
//     }).join("");

//     container.innerHTML = `
//       <div class="order-summary">
//         <h3>Order #${order.order_id}</h3>
//         <p>Status: ${order.status}</p>
//         <p>Date: ${new Date(order.order_date).toLocaleDateString()}</p>
//         <p>Total: ₹${order.total_amount.toFixed(2)}</p>
//       </div>
//       <h4>Items:</h4>
//       <div class="order-items">${itemsHTML}</div>
//     `;
//   } catch (err) {
//     console.error("Error fetching order details:", err);
//     container.innerHTML = `<p>Error: ${err.message}</p>`;
//   }
// });

// order-details.js
import { apiRequest } from "./api/client.js";

(function () {
  if (window.__order_details_js_bound__) return;
  window.__order_details_js_bound__ = true;

  const ORDER_ENDPOINT = "/api/orders";
  const els = {
    container: document.getElementById("order-details"),
    orderIdLabel: document.getElementById("order-id"),
    status: document.getElementById("order-status"),
    date: document.getElementById("order-date"),
    items: document.getElementById("order-items"),
    address: document.getElementById("order-address"),
    subtotal: document.getElementById("order-subtotal"),
    shipping: document.getElementById("order-shipping"),
    total: document.getElementById("order-total"),
    toast: document.getElementById("toast"),
  };

  // -------------------------------------------------------------
  // Toast helper
  // -------------------------------------------------------------
  function toast(msg, bad = false, ms = 2400) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.style.background = bad ? "#b00020" : "#333";
    els.toast.style.opacity = "1";
    els.toast.style.visibility = "visible";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      els.toast.style.opacity = "0";
      els.toast.style.visibility = "hidden";
    }, ms);
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function getOrderIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("order_id");
  }

  function formatDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  // -------------------------------------------------------------
  // Render order details
  // -------------------------------------------------------------
  function renderOrder(order) {
    if (!order || !els.container) {
      els.container.innerHTML = `<p>Order not found.</p>`;
      return;
    }

    // Header info
    if (els.orderIdLabel) els.orderIdLabel.textContent = `#${order.order_id}`;
    if (els.status) els.status.textContent = order.status || "Pending";
    if (els.date) els.date.textContent = formatDate(order.created_at);

    // Address
    if (els.address) {
      const a = order.shipping_address || {};
      els.address.innerHTML = `
        <p><strong>${a.name || ""}</strong></p>
        <p>${a.line1 || ""}</p>
        ${a.line2 ? `<p>${a.line2}</p>` : ""}
        <p>${a.city || ""}, ${a.state || ""} - ${a.pincode || ""}</p>
        <p>Phone: ${a.phone || ""}</p>`;
    }

    // Items
    if (els.items && Array.isArray(order.items)) {
      els.items.innerHTML = order.items
        .map(
          (i) => `
          <div class="order-item">
            <div class="order-item-info">
              <h4>${i.product_name}</h4>
              <p>${i.variant_name || ""}</p>
              <p>Qty: ${i.quantity}</p>
            </div>
            <div class="order-item-price">₹${(i.price * i.quantity).toFixed(2)}</div>
          </div>`
        )
        .join("");
    }

    // Totals
    if (els.subtotal) els.subtotal.textContent = `₹${(order.subtotal || 0).toFixed(2)}`;
    if (els.shipping) els.shipping.textContent = `₹${(order.shipping || 0).toFixed(2)}`;
    if (els.total) els.total.textContent = `₹${(order.total || 0).toFixed(2)}`;

    // Payment status or CTA
    if (order.payment_status === "pending" && order.payment_link) {
      const payBtn = document.createElement("a");
      payBtn.href = order.payment_link;
      payBtn.className = "btn pay-now";
      payBtn.textContent = "Complete Payment";
      els.container.appendChild(payBtn);
    }

    if (window.updateNavbarCounts) window.updateNavbarCounts();
  }

  // -------------------------------------------------------------
  // Load order from backend
  // -------------------------------------------------------------
  async function loadOrder() {
    const orderId = getOrderIdFromURL();
    if (!orderId) {
      toast("Missing order ID", true);
      if (els.container) els.container.innerHTML = `<p>Invalid order link.</p>`;
      return;
    }

    try {
      const user = await window.auth.getCurrentUser();
      if (!user) {
        toast("Please sign in to view order", true);
        window.location.href = "profile.html";
        return;
      }

      const order = await apiRequest(`${ORDER_ENDPOINT}/${orderId}`);
      renderOrder(order);
    } catch (err) {
      console.error("Failed to fetch order:", err);
      if (err?.status === 401) {
        toast("Session expired. Please sign in again.", true);
        window.location.href = "profile.html";
      } else {
        toast("Could not load order details", true);
      }
      if (els.container) els.container.innerHTML = `<p>Could not load order details.</p>`;
    }
  }

  // -------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", loadOrder);
})();
