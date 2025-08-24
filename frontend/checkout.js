// checkout.js — Amazon/Flipkart style, wired to backend

// --- Helpers ---
function fmtINR(cents) {
  return (cents / 100).toFixed(2);
}
function $(sel) {
  return document.querySelector(sel);
}
function show(el) {
  el.style.display = "";
}
function hide(el) {
  el.style.display = "none";
}

// Keep references to sections
const addressSection = document.getElementById("addressSection");
const paymentSection = document.getElementById("paymentSection");
const confirmationSection = document.getElementById("confirmationSection");

// Stepper helpers
function setStep(active) {
  document.querySelectorAll(".stepper .step").forEach((node) => {
    if (node.dataset.step === active) node.classList.add("active");
    else node.classList.remove("active");
  });
}

// --- Auth bootstrap ---
document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      alert("Please log in to proceed with checkout.");
      window.location.href = "profile.html";
      return;
    }

    const token = await user.getIdToken();
    localStorage.setItem(
      "loggedInUser",
      JSON.stringify({ email: user.email, idToken: token })
    );

    // Wire buttons
    document.getElementById("addAddressBtn").onclick = showAddressForm;
    document.getElementById("continueToPayment").onclick = proceedToPayment;
    document.getElementById("completePayment").onclick = completePayment;
    document.getElementById("backToAddress").onclick = backToAddress;

    // Load data
    await loadAddresses();
    await loadOrderSummary(); // Preload summary so Payment step is instant
  });
});

// --- Addresses (backend) ---
async function loadAddresses() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const list = document.getElementById("addressList");
  const contBtn = document.getElementById("continueToPayment");

  try {
    const res = await fetch("/users/me/addresses", {
      headers: { Authorization: `Bearer ${user.idToken}` },
    });
    if (!res.ok) throw new Error("Failed to load addresses");
    const addresses = await res.json();

    if (!addresses || addresses.length === 0) {
      list.innerHTML = '<p>No saved addresses. Please add one.</p>';
      contBtn.disabled = true;
      return;
    }

    // Render as radio list
    list.innerHTML = addresses
      .map(
        (addr) => `
      <div class="address-option">
        <input type="radio" name="selectedAddress" value="${addr.address_id}">
        <label>
          <strong>${addr.full_name}</strong> (${addr.phone})<br/>
          ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br/>
          ${addr.city}${addr.state ? ", " + addr.state : ""} - ${addr.zip}<br/>
          ${addr.country}
        </label>
      </div>
    `
      )
      .join("");

    contBtn.disabled = false;
  } catch (err) {
    console.error(err);
    list.innerHTML = "<p>Could not load addresses.</p>";
    contBtn.disabled = true;
  }
}

function showAddressForm() {
  const formWrap = document.getElementById("addressFormContainer");
  show(formWrap);

  formWrap.innerHTML = `
    <form id="addressForm">
      <input name="full_name" placeholder="Full Name" required><br/>
      <input name="phone" placeholder="Mobile Number" required><br/>
      <input name="line1" placeholder="Address Line 1" required><br/>
      <input name="line2" placeholder="Address Line 2"><br/>
      <input name="city" placeholder="City" required><br/>
      <input name="state" placeholder="State"><br/>
      <input name="zip" placeholder="PIN Code" required><br/>
      <input name="country" placeholder="Country" value="India"><br/>
      <button type="submit">Save</button>
      <button type="button" id="cancelAddr">Cancel</button>
    </form>
  `;

  document.getElementById("cancelAddr").onclick = () => hide(formWrap);

  document.getElementById("addressForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const user = JSON.parse(localStorage.getItem("loggedInUser"));

    const payload = {
      full_name: fd.get("full_name"),
      phone: fd.get("phone"),
      type: "shipping",
      line1: fd.get("line1"),
      line2: fd.get("line2"),
      city: fd.get("city"),
      state: fd.get("state"),
      zip: fd.get("zip"),
      country: fd.get("country") || "India",
    };

    try {
      const res = await fetch("/users/me/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.idToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save address");
      }
      await loadAddresses();
      hide(formWrap);
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not save address");
    }
  };
}

// --- Order Summary (from backend cart) ---
async function loadOrderSummary() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const container = document.getElementById("orderSummaryContent");

  try {
    const res = await fetch("/users/me/cart", {
      headers: { Authorization: `Bearer ${user.idToken}` },
    });
    if (!res.ok) throw new Error("Failed to load cart");
    const cart = await res.json();

    if (!cart.items || cart.items.length === 0) {
      container.innerHTML = "<p>Your cart is empty.</p>";
      return;
    }

    let totalCents = 0;
    const html = cart.items
      .map((item) => {
        const line = (item.price_cents || 0) * (item.quantity || 1);
        totalCents += line;
        return `
        <div class="product-summary">
          <img src="${item.image_url}" alt="${item.name}" />
          <div>
            <h4>${item.name}</h4>
            <p>${[item.color, item.size].filter(Boolean).join(" • ") || ""}</p>
            <p>Qty: ${item.quantity}</p>
            <p>Line Total: ₹${fmtINR(line)}</p>
          </div>
        </div>
      `;
      })
      .join("");

    container.innerHTML =
      html + `<div class="summary-total"><strong>Total: ₹${fmtINR(totalCents)}</strong></div>`;
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Could not load order summary.</p>";
  }
}

// --- Payment Methods (simple radio cards) ---
function loadPaymentMethods() {
  const container = document.getElementById("paymentMethods");
  container.innerHTML = `
    <div class="payment-option selected">
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

// --- Step navigation ---
function proceedToPayment() {
  const chosen = document.querySelector('input[name="selectedAddress"]:checked');
  if (!chosen) {
    alert("Select a shipping address.");
    return;
  }
  hide(addressSection);
  show(paymentSection);
  setStep("payment");
  loadPaymentMethods();
}

function backToAddress() {
  hide(paymentSection);
  show(addressSection);
  setStep("address");
}

// --- Place Order ---
async function completePayment() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const token = user?.idToken;

  const selected = document.querySelector('input[name="selectedAddress"]:checked');
  if (!selected) {
    alert("Select a shipping address.");
    return;
  }
  const addressId = parseInt(selected.value, 10);

  const paymentMethod =
    (document.querySelector('input[name="paymentMethod"]:checked') || {}).value || "UPI";

  try {
    const res = await fetch("/users/me/orders/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        address_id: addressId,
        payment_method: paymentMethod,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || "Order failed.");
      return;
    }

    // Success UI
    hide(paymentSection);
    show(confirmationSection);
    setStep("confirmation");

    document.getElementById("orderConfirmationDetails").innerHTML = `
      <p>Order ID: <strong>#${result.order_id}</strong></p>
      <p>Total Paid: ₹<strong>${fmtINR(result.total_cents)}</strong></p>
      <p>Payment Mode: ${String(result.payment_method || paymentMethod).toUpperCase()}</p>
    `;

    // Optional: you may also want to refresh header cart count via some global fn
  } catch (err) {
    console.error("Order error:", err);
    alert("Something went wrong.");
  }
}
