function showToast(message, bg = "#28a745") {
  let toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.right = "20px";
  toast.style.background = bg;
  toast.style.color = "#fff";
  toast.style.padding = "10px 15px";
  toast.style.borderRadius = "6px";
  toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  toast.style.zIndex = "9999";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease";

  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = "1"; });

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  const addressEl = document.getElementById("deliveryAddress");
  const summaryEl = document.getElementById("orderSummary");
  const totalEl = document.getElementById("orderTotal");
  const placeOrderBtn = document.getElementById("placeOrder");

  const SELECTED_ADDRESS_KEY = "selectedAddress";
  const BUY_NOW_KEY = "buyNowItem";
  const CHECKOUT_KEY = "checkout_items";
  const CART_KEY = "vakaadha_cart_v1";

  // ---- Address ----
  const selectedAddress = JSON.parse(sessionStorage.getItem(SELECTED_ADDRESS_KEY) || "null");
  if (selectedAddress) {
    addressEl.innerHTML = `
      <p><strong>${selectedAddress.name}</strong><br>
      ${selectedAddress.street}, ${selectedAddress.city} - ${selectedAddress.zip}</p>
    `;
  } else {
    addressEl.innerHTML = `<p style="color:red;">No address selected. <a href="addresses.html">Choose one</a></p>`;
  }

  // ---- Items ----
  let items = [];
  let mode = "";

  const buyNowItem = JSON.parse(sessionStorage.getItem(BUY_NOW_KEY) || "null");
const checkoutItems = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || "[]");
if (checkoutItems.length) {
  items = checkoutItems;
  mode = "CART";
}

  if (buyNowItem) {
    items = [buyNowItem];
    mode = "BUY_NOW";
  } else if (checkoutItems && checkoutItems.length) {
    items = checkoutItems;
    mode = "CART";
  }

  // ---- Render ----
  if (items.length) {
    summaryEl.innerHTML = items.map(item => {
      const subtotal = (item.price || 0) * (item.qty || 1);
      return `
        <div class="order-item">
          <span>${item.name} ${item.size ? `(${item.size})` : ""} × ${item.qty || 1}</span>
          <span>₹${subtotal}</span>
        </div>
      `;
    }).join("");

    const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);
    totalEl.textContent = total;
  } else {
    summaryEl.innerHTML = "<p>No items to checkout.</p>";
    totalEl.textContent = "0";
  }

  // ---- Place Order ----
  placeOrderBtn.addEventListener("click", () => {
    if (!selectedAddress) {
      alert("Please select an address before placing order.");
      return;
    }
    if (!items.length) {
      alert("No products to checkout.");
      return;
    }

    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const orders = JSON.parse(localStorage.getItem("orders") || "[]");

    const newOrder = {
      id: Date.now(),
      items,
      total: totalEl.textContent,
      address: selectedAddress,
      payment: paymentMethod,
      date: new Date().toLocaleString(),
      status: "Placed"
    };

    orders.push(newOrder);
    localStorage.setItem("orders", JSON.stringify(orders));

    if (mode === "BUY_NOW") {
      sessionStorage.removeItem(BUY_NOW_KEY);
    } else if (mode === "CART") {
      sessionStorage.removeItem(CHECKOUT_KEY);

      // keep unselected cart items
      const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      const remaining = cart.filter(cartItem =>
        !items.find(chk => chk.id === cartItem.id && chk.size === cartItem.size)
      );
      localStorage.setItem(CART_KEY, JSON.stringify(remaining));
    }
    showToast("✅ Order placed successfully!");
    setTimeout(() => {
      window.location.href = "orders.html";
    }, 1200); // give user time to see toast
  });
});