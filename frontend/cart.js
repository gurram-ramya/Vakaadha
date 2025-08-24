// cart.js
import { apiRequest, getToken } from "./api/client.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!getToken()) {
    document.getElementById("cartItems").innerHTML =
      "<p>Please <a href='profile.html'>log in</a> to view your cart.</p>";
    return;
  }
  await loadCart();
});

async function loadCart() {
  const res = await apiRequest("/users/me/cart", { method: "GET" });

  const itemsContainer = document.getElementById("cartItems");
  const summaryContainer = document.getElementById("cartSummary");

  if (!res.items || res.items.length === 0) {
    itemsContainer.innerHTML =
      "<p>Your cart is empty. <a href='index.html'>Shop now</a>.</p>";
    summaryContainer.innerHTML = "";
    return;
  }

  // Render cart items
  itemsContainer.innerHTML = `
    <table class="cart-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Variant</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Subtotal</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${res.items
          .map(
            (item) => `
          <tr>
            <td>
              <img src="${item.image_url}" alt="${item.name}" class="cart-img"/>
              <span>${item.name}</span>
            </td>
            <td>${item.color || ""} ${item.size || ""}</td>
            <td>₹${(item.price_cents / 100).toFixed(2)}</td>
            <td>
              <input type="number" value="${item.quantity}" min="1"
                class="qty-input"
                onchange="updateQuantity(${item.cart_item_id}, this.value)" />
            </td>
            <td>₹${((item.price_cents * item.quantity) / 100).toFixed(2)}</td>
            <td>
              <button class="remove-btn" onclick="removeItem(${item.cart_item_id})">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  // Render summary
  summaryContainer.innerHTML = `
    <p>Total: ₹${(res.subtotal_cents / 100).toFixed(2)}</p>
    <button id="checkoutBtn" class="btn-checkout" onclick="checkout()">Proceed to Checkout</button>
  `;
}

// Update quantity
window.updateQuantity = async function (itemId, qty) {
  await apiRequest(`/users/me/cart/${itemId}`, {
    method: "PUT",
    body: { quantity: parseInt(qty) },
  });
  await loadCart();
};

// Remove item
window.removeItem = async function (itemId) {
  await apiRequest(`/users/me/cart/${itemId}`, { method: "DELETE" });
  await loadCart();
};

// Checkout
window.checkout = async function () {
  const res = await apiRequest("/users/me/orders/checkout", { method: "POST" });
  if (res.error) {
    alert("Checkout failed: " + res.error);
    return;
  }
  alert("Order placed successfully!");
  window.location.href = "orders.html";
};
