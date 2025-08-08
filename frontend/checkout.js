
document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
      alert("Please log in to proceed with checkout.");
      return window.location.href = "profile.html";
    }

    const token = await user.getIdToken();
    localStorage.setItem("loggedInUser", JSON.stringify({ email: user.email, idToken: token }));

    loadAddresses();
    document.getElementById("addAddressBtn").onclick = showAddressForm;
    document.getElementById("continueToPayment").onclick = proceedToPayment;
    document.getElementById("completePayment").onclick = completePayment;
    document.getElementById("backToAddress").onclick = backToAddress;
  });
});

function loadAddresses() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const key = `user_${user.email}_addresses`;
  const addresses = JSON.parse(localStorage.getItem(key)) || [];

  const list = document.getElementById("addressList");
  const btn = document.getElementById("continueToPayment");

  if (addresses.length === 0) {
    list.innerHTML = '<p>No saved addresses. Please add one.</p>';
    btn.disabled = true;
    return;
  }

  list.innerHTML = addresses.map((addr, i) => `
    <div class="address-option">
      <input type="radio" name="selectedAddress" value="${i}" ${addr.isDefault ? 'checked' : ''}>
      <label>
        <strong>${addr.name}</strong><br/>
        ${addr.address}, ${addr.city}, ${addr.state} - ${addr.pincode}<br/>
        Mobile: ${addr.mobile}
      </label>
    </div>
  `).join("");

  btn.disabled = false;
}

function showAddressForm() {
  const form = document.getElementById("addressFormContainer");
  form.style.display = "block";
  form.innerHTML = `
    <form id="addressForm">
      <input name="name" placeholder="Full Name" required><br/>
      <input name="mobile" placeholder="Mobile" required><br/>
      <input name="pincode" placeholder="PIN Code" required><br/>
      <input name="address" placeholder="Address" required><br/>
      <input name="city" placeholder="City" required><br/>
      <input name="state" placeholder="State" required><br/>
      <button type="submit">Save</button>
      <button type="button" onclick="document.getElementById('addressFormContainer').style.display='none'">Cancel</button>
    </form>
  `;

  document.getElementById("addressForm").onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newAddress = {
      name: fd.get("name"),
      mobile: fd.get("mobile"),
      pincode: fd.get("pincode"),
      address: fd.get("address"),
      city: fd.get("city"),
      state: fd.get("state"),
      isDefault: false
    };

    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    const key = `user_${user.email}_addresses`;
    const addresses = JSON.parse(localStorage.getItem(key)) || [];

    if (addresses.length === 0) newAddress.isDefault = true;

    addresses.push(newAddress);
    localStorage.setItem(key, JSON.stringify(addresses));
    loadAddresses();
    document.getElementById("addressFormContainer").style.display = "none";
  };
}

function proceedToPayment() {
  const selected = document.querySelector('input[name="selectedAddress"]:checked');
  if (!selected) return alert("Select a shipping address.");

  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const key = `user_${user.email}_addresses`;
  const addresses = JSON.parse(localStorage.getItem(key));
  const address = addresses[selected.value];

  sessionStorage.setItem("selectedAddress", JSON.stringify(address));

  document.getElementById("addressSection").style.display = "none";
  document.getElementById("paymentSection").style.display = "block";

  document.querySelector('.step[data-step="address"]').classList.remove("active");
  document.querySelector('.step[data-step="payment"]').classList.add("active");

  loadOrderSummary();
  loadPaymentMethods();
}

function loadOrderSummary() {
  const cartProducts = JSON.parse(sessionStorage.getItem("checkoutProducts")) || [];
  const container = document.getElementById("orderSummaryContent");

  if (cartProducts.length === 0) return container.innerHTML = "<p>Your cart is empty.</p>";

  let total = 0;
  container.innerHTML = cartProducts.map(p => {
    const lineTotal = p.price * p.qty;
    total += lineTotal;
    return `
      <div class="product-summary">
        <img src="./Images/${p.img}" alt="${p.name}" />
        <div>
          <h4>${p.name}</h4>
          <p>Size: ${p.size}</p>
          <p>Qty: ${p.qty}</p>
          <p>Total: ₹${lineTotal.toFixed(2)}</p>
        </div>
      </div>
    `;
  }).join("") + `<div class="summary-total"><strong>Total: ₹${total.toFixed(2)}</strong></div>`;
}

function loadPaymentMethods() {
  const container = document.getElementById("paymentMethods");
  // container.innerHTML = `
  //   <label><input type="radio" name="paymentMethod" value="cod" checked> Cash on Delivery</label><br/>
  //   <label><input type="radio" name="paymentMethod" value="upi"> UPI</label><br/>
  //   <label><input type="radio" name="paymentMethod" value="card"> Card</label>
  // `;
  container.innerHTML = `<div class="payment-option selected">
            <input type="radio" name="paymentMethod" id="upi" value="UPI" checked />
            <label for="upi">
              <div><strong>UPI</strong></div>
              <div class="payment-description">Pay via PhonePe, GPay, or BHIM</div>
            </label>
            <div class="payment-icon"><i class="fas fa-mobile-alt"></i></div>
          </div>

          <div class="payment-option">
            <input type="radio" name="paymentMethod" id="cod" value="COD" />
            <label for="cod">
              <div><strong>Cash on Delivery</strong></div>
              <div class="payment-description">Pay with cash once you receive your order</div>
            </label>
            <div class="payment-icon"><i class="fas fa-money-bill-wave"></i></div>
          </div>
          
          <div class="payment-option">
            <input type="radio" name="paymentMethod" id="card" value="CARD" />
            <label for="card">
              <div><strong>Card Payment</strong></div>
              <div class="payment-description">Pay securely using your credit or debit card</div>
            </label>
            <div class="payment-icon"><i class="fas fa-credit-card"></i></div>
          </div>
        `;

}

function backToAddress() {
  document.getElementById("paymentSection").style.display = "none";
  document.getElementById("addressSection").style.display = "block";

  document.querySelector('.step[data-step="payment"]').classList.remove("active");
  document.querySelector('.step[data-step="address"]').classList.add("active");
}

async function completePayment() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const token = user?.idToken;
  const address = JSON.parse(sessionStorage.getItem("selectedAddress"));
  const products = JSON.parse(sessionStorage.getItem("checkoutProducts")) || [];

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

  if (!products.length) return alert("No items to order.");

  try {
    const res = await fetch("/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        address,
        payment_method: paymentMethod,
        cart_items:products
      })
    });

    const result = await res.json();

    if (res.ok) {
      document.getElementById("paymentSection").style.display = "none";
      document.getElementById("confirmationSection").style.display = "block";

      document.querySelector('.step[data-step="payment"]').classList.remove("active");
      document.querySelector('.step[data-step="confirmation"]').classList.add("active");

      document.getElementById("orderConfirmationDetails").innerHTML = `
        <p>Order ID: <strong>#${result.order_id}</strong></p>
        <p>Total Paid: ₹<strong>${result.total_amount.toFixed(2)}</strong></p>
        <p>Payment Mode: ${paymentMethod.toUpperCase()}</p>
      `;

      sessionStorage.clear();
      localStorage.removeItem("cart");
    } else {
      alert(result.error || "Order failed.");
    }
  } catch (err) {
    console.error("Order error:", err);
    alert("Something went wrong.");
  }
}
