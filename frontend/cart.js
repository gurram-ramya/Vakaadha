// cart.js
import { apiRequest } from "./api/client.js";

(function () {
  async function renderCart() {
    const emptyEl = document.getElementById("cart-empty");
    const container = document.getElementById("cart-items");
    const summary = document.getElementById("cart-summary");
    if (!container || !summary || !emptyEl) return;

    try {
      const cart = await apiRequest("/api/cart");
      const items = cart.items || [];

      container.innerHTML = "";
      summary.classList.add("hidden");
      emptyEl.classList.add("hidden");

      if (items.length === 0) {
        emptyEl.classList.remove("hidden");
        if (typeof updateNavbarCounts === "function") updateNavbarCounts();
        return;
      }

      let subtotal = 0;
      items.forEach((item) => {
        subtotal += item.subtotal || 0;
        const row = document.createElement("div");
        row.classList.add("cart-item");
        row.innerHTML = `
          <img src="${item.image_url || "Images/default.jpg"}" alt="${item.product_name}">
          <div class="details">
            <h3>${item.product_name}</h3>
            <p>${item.variant?.size || ""} ${item.variant?.color || ""} ${item.variant?.sku || ""}</p>
            <p>₹${item.price.toFixed(2)}</p>
            <div class="qty-controls">
              <input type="number" min="1" value="${item.quantity}" class="qty-input" data-id="${item.cart_item_id}">
            </div>
            <p class="subtotal">Subtotal: ₹${item.subtotal.toFixed(2)}</p>
            <button class="remove-btn" data-id="${item.cart_item_id}">Remove</button>
            <div class="error-msg" id="err-${item.cart_item_id}"></div>
          </div>
        `;
        container.appendChild(row);
      });

      document.getElementById("cart-subtotal").textContent = `₹${subtotal.toFixed(2)}`;
      document.getElementById("cart-total").textContent = `₹${subtotal.toFixed(2)}`;
      const checkoutBtn = document.getElementById("checkout-btn");
      checkoutBtn.disabled = items.length === 0;
      summary.classList.remove("hidden");

      container.querySelectorAll(".qty-input").forEach((input) => {
        input.addEventListener("change", async (e) => {
          const id = e.target.dataset.id;
          const qty = parseInt(e.target.value, 10);
          if (qty < 1) {
            e.target.value = 1;
            return;
          }
          try {
            await apiRequest(`/api/cart/${id}`, { method: "PUT", body: { quantity: qty } });
            renderCart();
          } catch (err) {
            document.getElementById(`err-${id}`).textContent = err.message;
          }
        });
      });

      container.querySelectorAll(".remove-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          try {
            await apiRequest(`/api/cart/${id}`, { method: "DELETE" });
            renderCart();
          } catch (err) {
            document.getElementById(`err-${id}`).textContent = err.message;
          }
        });
      });

      checkoutBtn.onclick = () => {
        if (items.length === 0) return;
        window.location.href = "checkout.html";
      };

      if (typeof updateNavbarCounts === "function") updateNavbarCounts();
    } catch (err) {
      emptyEl.innerHTML = `<p class="error">Failed to load cart: ${err.message}</p>`;
      emptyEl.classList.remove("hidden");
    }
  }

  document.addEventListener("DOMContentLoaded", renderCart);
})();
