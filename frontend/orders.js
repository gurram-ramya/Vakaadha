// ============================================================
// orders.js — Orders listing (token-derived identity)
// Compatible with new Firebase + backend auth model
// ============================================================

(function () {
  if (window.__orders_js_bound__) return;
  window.__orders_js_bound__ = true;

  const ordersContainer = document.getElementById("orders-container");
  const emptyEl = document.getElementById("orders-empty");
  const errorEl = document.getElementById("orders-error");

  function showEmpty() {
    if (ordersContainer) ordersContainer.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("hidden");
  }

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg || "Unable to load orders";
      errorEl.classList.remove("hidden");
    }
  }

  function hideStates() {
    if (emptyEl) emptyEl.classList.add("hidden");
    if (errorEl) errorEl.classList.add("hidden");
  }

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleDateString();
    } catch {
      return "";
    }
  }

  function renderOrders(orders) {
    if (!Array.isArray(orders) || orders.length === 0) {
      showEmpty();
      return;
    }

    hideStates();

    const html = orders.map((o) => {
      return `
        <div class="order-card">
          <div class="order-header">
            <span class="order-id">Order #${o.order_id}</span>
            <span class="order-date">${formatDate(o.created_at)}</span>
          </div>

          <div class="order-body">
            <p><strong>Status:</strong> ${o.status}</p>
            <p><strong>Total:</strong> ₹${(o.total_cents / 100).toFixed(2)}</p>
            <p><strong>Items:</strong> ${o.item_count}</p>
          </div>

          <div class="order-footer">
            <button class="view-order-btn" data-id="${o.order_id}">
              View Details
            </button>
          </div>
        </div>
      `;
    }).join("");

    ordersContainer.innerHTML = html;
  }

  async function loadOrders() {
    if (!window.apiRequest) {
      showError("API not available");
      return;
    }

    try {
      const data = await window.apiRequest("/api/orders/me");

      if (!data || !Array.isArray(data.orders)) {
        showEmpty();
        return;
      }

      renderOrders(data.orders);
    } catch (err) {
      const status = Number(err?.status || 0);

      if (status === 401) {
        showError("Please log in to view your orders.");
        return;
      }

      console.error("[orders.js] loadOrders failed:", err);
      showError("Failed to load orders. Try again later.");
    }
  }

  // ------------------------------------
  // Order details navigation
  // ------------------------------------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-order-btn");
    if (!btn) return;

    const orderId = btn.dataset.id;
    if (!orderId) return;

    sessionStorage.setItem("selected_order_id", orderId);
    window.location.href = "order_details.html";
  });

  document.addEventListener("DOMContentLoaded", loadOrders);
})();
