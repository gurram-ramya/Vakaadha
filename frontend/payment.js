// // frontend/payment.js — Checkout flow for VAKAADHA (enhanced with product details + counts)
// (async function () {
//   const deliveryAddressDiv = document.getElementById("deliveryAddress");
//   const orderSummaryDiv = document.getElementById("orderSummary");
//   const orderTotalEl = document.getElementById("orderTotal");
//   const placeOrderBtn = document.getElementById("placeOrder");

//   // 🆕 Modal elements
//   const addressModal = document.getElementById("addressSelectModal");
//   const addressListModal = document.getElementById("addressListModal");
//   const closeModalBtn = document.getElementById("closeAddressModal");
//   const changeAddressBtn = document.getElementById("changeAddressBtn");

//   // ---------------- Utils ----------------
//   function showToast(msg, type = "info") {
//     console.log(`[Toast:${type}]`, msg);
//     const toast = document.getElementById("toast");
//     if (toast) {
//       toast.textContent = msg;
//       toast.style.background = type === "error" ? "#b00020" : "#333";
//       toast.style.opacity = "1";
//       clearTimeout(showToast._t);
//       showToast._t = setTimeout(() => (toast.style.opacity = "0"), 2500);
//     } else alert(msg);
//   }

//   function getQueryParam(key) {
//     return new URLSearchParams(window.location.search).get(key);
//   }

//   async function getToken() {
//     let t = localStorage.getItem("auth_token");
//     if (t) return t;
//     if (window.auth?.initSession) await window.auth.initSession();
//     t = await window.auth.getToken();
//     if (t) localStorage.setItem("auth_token", t);
//     return t;
//   }

//   async function authFetch(url, options = {}) {
//     const token = await getToken();
//     const headers = options.headers || {};
//     headers["Authorization"] = `Bearer ${token}`;
//     const res = await fetch(url, { ...options, headers, credentials: "include" });
//     if (res.status === 401) {
//       showToast("Please log in again", "error");
//       setTimeout(() => (window.location.href = "profile.html"), 1000);
//       throw new Error("Unauthorized");
//     }
//     if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
//     return res.json();
//   }

//   // ---------------- Load Address ----------------
//   async function loadDeliveryAddress(addressId = null) {
//     addressId = addressId || getQueryParam("addressId");
//     if (!addressId) {
//       deliveryAddressDiv.innerHTML = `<p>No address selected. <a href="addresses.html">Choose one</a>.</p>`;
//       return null;
//     }

//     try {
//       const addr = await authFetch(`/api/addresses/${addressId}`);
//       if (!addr) throw new Error("Invalid address");
//       deliveryAddressDiv.innerHTML = `
//         <div class="address-info">
//           <strong>${addr.name}</strong><br>
//           ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br>
//           ${addr.city}, ${addr.state} - ${addr.pincode}<br>
//           📞 ${addr.phone}
//         </div>
//       `;
//       deliveryAddressDiv.dataset.addressId = addr.address_id || addressId;
//       return addr;
//     } catch (err) {
//       console.error("Failed to load address:", err);
//       deliveryAddressDiv.innerHTML = `<p>Error loading address. <a href="addresses.html">Choose another</a>.</p>`;
//       return null;
//     }
//   }

//   // ---------------- Load Cart Summary (Compact Order Review) ----------------
//   async function getCart() {
//     const token = localStorage.getItem("auth_token");
//     const guestId = localStorage.getItem("guest_id");
//     const headers = token ? { Authorization: `Bearer ${token}` } : {};
//     const url = guestId ? `/api/cart?guest_id=${guestId}` : "/api/cart";
//     const res = await fetch(url, { headers, credentials: "include" });
//     if (!res.ok) throw new Error(`Cart fetch failed: ${res.status}`);
//     return res.json();
//   }

//   async function loadCartSummary() {
//     try {
//       const cart = await getCart();
//       const items = cart.items || [];
//       if (!items.length) {
//         orderSummaryDiv.innerHTML = `<p>Your cart is empty.</p>`;
//         orderTotalEl.textContent = "0";
//         return 0;
//       }

//       let total = 0;
//       orderSummaryDiv.innerHTML = items.map((item) => {
//         const name = item.product_name || item.name || "Product";
//         const img = item.image_url || "Images/default.jpg";
//         const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);
//         total += parseFloat(subtotal);
//         return `
//           <div class="order-item">
//             <img src="${img}" alt="${name}" class="order-thumb" />
//             <div class="order-info">
//               <span class="order-name">${name}</span>
//               <span class="order-qty">Qty: ${item.quantity}</span>
//             </div>
//             <div class="order-price">₹${subtotal}</div>
//           </div>
//         `;
//       }).join("");

//       orderTotalEl.textContent = total.toFixed(2);
//       return total;
//     } catch (err) {
//       console.error("Failed to load cart:", err);
//       orderSummaryDiv.innerHTML = `<p>Failed to load cart.</p>`;
//       orderTotalEl.textContent = "0";
//       return 0;
//     }
//   }

//   // ---------------- Create Payment Order ----------------
//   async function createPaymentOrder(addressId, method) {
//     const body = { address_id: addressId, payment_method: method };
//     return authFetch("/api/payments/create-order", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });
//   }

//   // ---------------- Verify Payment ----------------
//   async function verifyPayment(payload) {
//     return authFetch("/api/payments/verify", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload),
//     });
//   }

//   // ---------------- Razorpay Integration ----------------
//   function launchRazorpay(orderInfo) {
//     return new Promise((resolve, reject) => {
//       const options = {
//         key: orderInfo.key_id,
//         amount: orderInfo.amount,
//         currency: "INR",
//         name: "VAKAADHA",
//         description: "Order Payment",
//         order_id: orderInfo.razorpay_order_id,
//         handler: function (response) {
//           resolve({
//             razorpay_order_id: response.razorpay_order_id,
//             razorpay_payment_id: response.razorpay_payment_id,
//             razorpay_signature: response.razorpay_signature,
//           });
//         },
//         prefill: orderInfo.prefill || {},
//         theme: { color: "#333" },
//       };
//       const rzp = new Razorpay(options);
//       rzp.on("payment.failed", (resp) => reject(resp.error));
//       rzp.open();
//     });
//   }

//   // ---------------- Main Checkout Flow ----------------
//   async function handlePlaceOrder() {
//     const addressId = deliveryAddressDiv.dataset.addressId || getQueryParam("addressId");
//     if (!addressId) return showToast("Select a delivery address first", "error");

//     const method = document.querySelector('input[name="payment"]:checked')?.value || "COD";
//     const total = parseFloat(orderTotalEl.textContent);
//     if (!total || total <= 0) return showToast("Your cart is empty", "error");

//     placeOrderBtn.disabled = true;
//     placeOrderBtn.textContent = "Processing...";

//     try {
//       const orderData = await createPaymentOrder(addressId, method);

//       if (method === "COD") {
//         showToast("Order placed successfully (Cash on Delivery)");
//         window.location.href = `order-success.html?orderId=${orderData.order_id}`;
//         return;
//       }

//       const paymentResp = await launchRazorpay(orderData);
//       const verifyResp = await verifyPayment(paymentResp);

//       if (verifyResp?.status === "success") {
//         showToast("Payment successful!");
//         window.location.href = `order-success.html?orderId=${orderData.order_id}`;
//       } else {
//         showToast("Payment verification failed", "error");
//       }
//     } catch (err) {
//       console.error("Checkout failed:", err);
//       showToast("Payment process failed", "error");
//     } finally {
//       placeOrderBtn.disabled = false;
//       placeOrderBtn.textContent = "Place Order";
//     }
//   }

//   // ---------------- Address Modal Handling ----------------
//   async function openAddressModal() {
//     try {
//       addressListModal.innerHTML = `<p>Loading...</p>`;
//       addressModal.classList.add("active");

//       const addrs = await authFetch("/api/addresses");
//       if (!addrs.length) {
//         addressListModal.innerHTML = `<p>No saved addresses found.</p>`;
//         return;
//       }

//       addressListModal.innerHTML = addrs.map((a) => `
//         <div class="address-card" data-id="${a.address_id}">
//           <strong>${a.name}</strong><br>
//           ${a.line1}${a.line2 ? ", " + a.line2 : ""}<br>
//           ${a.city}, ${a.state} - ${a.pincode}<br>
//           📞 ${a.phone}<br>
//           <button class="small selectAddrBtn" data-id="${a.address_id}">Deliver Here</button>
//         </div>`).join("");

//       addressListModal.querySelectorAll(".selectAddrBtn").forEach((btn) =>
//         btn.addEventListener("click", async (e) => {
//           const selectedId = e.target.dataset.id;
//           await loadDeliveryAddress(selectedId);
//           addressModal.classList.remove("active");
//           history.replaceState({}, "", `?addressId=${selectedId}`);
//         })
//       );
//     } catch (err) {
//       console.error("Failed to load addresses:", err);
//       addressListModal.innerHTML = `<p>Error loading addresses</p>`;
//     }
//   }

//   closeModalBtn.addEventListener("click", () => addressModal.classList.remove("active"));
//   if (changeAddressBtn) changeAddressBtn.addEventListener("click", openAddressModal);

//   // ---------------- Init ----------------
//   document.addEventListener("DOMContentLoaded", async () => {
//     console.time("🕒 payment_init_total");
//     try {
//       if (window.auth?.initSession) await window.auth.initSession();

//       const readyUser = firebase.auth().currentUser || await new Promise((res) => {
//         const unsub = firebase.auth().onAuthStateChanged((u) => { unsub(); res(u); });
//       });

//       if (!readyUser) {
//         console.warn("⚠️ No user logged in, redirecting to profile");
//         window.location.href = "profile.html";
//         return;
//       }

//       const token = await readyUser.getIdToken(true);
//       localStorage.setItem("auth_token", token);

//       // ✅ Force navbar counts to refresh after auth
//       if (window.updateNavbarCounts) await window.updateNavbarCounts(true);

//       console.timeLog("🕒 payment_init_total", "Auth ready ✅");

//       await loadDeliveryAddress();
//       await loadCartSummary();

//       if (placeOrderBtn) placeOrderBtn.addEventListener("click", handlePlaceOrder);

//       console.timeEnd("🕒 payment_init_total");
//     } catch (err) {
//       console.error("[payment.js] init failed:", err);
//       showToast("Error initializing payment page", "error");
//     }
//   });
// })();


// frontend/payment.js — Updated Checkout flow for VAKAADHA
(async function () {
  const deliveryAddressDiv = document.getElementById("deliveryAddress");
  const orderSummaryDiv = document.getElementById("orderSummary");
  const orderTotalEl = document.getElementById("orderTotal");
  const placeOrderBtn = document.getElementById("placeOrder");

  // Persistent session state
  let CURRENT_ORDER_ID = null;          
  let CURRENT_RAZORPAY_ORDER_ID = null; 
  let PAYMENT_IN_PROGRESS = false;      
  let PAYMENT_ATTEMPTED = false;        

  // ---------------- Utils ----------------
  function showToast(msg, type = "info") {
    console.log(`[Toast:${type}]`, msg);
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = msg;
      toast.style.background = type === "error" ? "#b00020" : "#333";
      toast.style.opacity = "1";
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => (toast.style.opacity = "0"), 2500);
    } else alert(msg);
  }

  function getQueryParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  async function getToken() {
    let t = localStorage.getItem("auth_token");
    if (t) return t;
    if (window.auth?.initSession) await window.auth.initSession();
    t = await window.auth.getToken();
    if (t) localStorage.setItem("auth_token", t);
    return t;
  }

  async function authFetch(url, options = {}) {
    const token = await getToken();
    const headers = options.headers || {};
    headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers, credentials: "include" });
    if (res.status === 401) {
      showToast("Please log in again", "error");
      setTimeout(() => (window.location.href = "payment.html"), 1000);
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  }

  // ---------------- Load Address ----------------
  async function loadDeliveryAddress(addressId = null) {
    addressId = addressId || getQueryParam("addressId");
    if (!addressId) {
      deliveryAddressDiv.innerHTML = `<p>No address selected. <a href="addresses.html">Choose one</a>.</p>`;
      return null;
    }

    try {
      const addr = await authFetch(`/api/addresses/${addressId}`);
      if (!addr) throw new Error("Invalid address");

      deliveryAddressDiv.innerHTML = `
        <div class="address-info">
          <strong>${addr.name}</strong><br>
          ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br>
          ${addr.city}, ${addr.state} - ${addr.pincode}<br>
          ${addr.phone}
        </div>
      `;
      deliveryAddressDiv.dataset.addressId = addr.address_id || addressId;
      return addr;
    } catch (err) {
      console.error("Failed to load address:", err);
      deliveryAddressDiv.innerHTML = `<p>Error loading address. <a href="addresses.html">Choose another</a>.</p>`;
      return null;
    }
  }

  // ---------------- Cart Summary ----------------
  // function getSelectedItemsFromStorage() {
  //   try {
  //     return JSON.parse(localStorage.getItem("checkout_items")) || null;
  //   } catch {
  //     return null;
  //   }
  // }
s



  async function getCart() {
    const token = localStorage.getItem("auth_token");
    const guestId = localStorage.getItem("guest_id");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const url = guestId ? `/api/cart?guest_id=${guestId}` : "/api/cart";
    const res = await fetch(url, { headers, credentials: "include" });
    if (!res.ok) throw new Error(`Cart fetch failed: ${res.status}`);
    return res.json();
  }

  async function loadCartSummary() {
     try {
      // 1️⃣ Try to load selected items first
      const selected = getSelectedItemsFromStorage();

      let items = [];

      if (selected && selected.length) {
        console.log("🟢 Using selected items for checkout:", selected);
        items = selected;   // 👍 Only selected items
      } else {
        console.log("⚠️ No selection found → fallback to full cart");
        const cart = await getCart();
        items = cart.items || [];
      }

      let total = 0;
      orderSummaryDiv.innerHTML = items
        .map((item) => {
          const name = item.product_name || item.name || "Product";
          const img = item.image_url || "Images/default.jpg";
          const subtotal = ((item.price_cents * item.quantity) / 100).toFixed(2);
          total += parseFloat(subtotal);
          return `
          <div class="order-item">
            <img src="${img}" alt="${name}" class="order-thumb" />
            <div class="order-info">
              <span class="order-name">${name}</span>
              <span class="order-qty">Qty: ${item.quantity}</span>
            </div>
            <div class="order-price">₹${subtotal}</div>
          </div>
        `;
        })
        .join("");

      orderTotalEl.textContent = total.toFixed(2);
      return total;
    } catch (err) {
      console.error("Failed to load cart:", err);
      orderSummaryDiv.innerHTML = `<p>Failed to load cart.</p>`;
      orderTotalEl.textContent = "0";
      return 0;
    }
  }

  // ---------------- Create Payment Order ----------------
  async function createPaymentOrder(addressId, method) {
    const body = { address_id: addressId, payment_method: method };
    return authFetch("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // ---------------- Verify Payment ----------------
  async function verifyPayment(payload) {
    return authFetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // ---------------- Razorpay Integration ----------------
  function launchRazorpay(orderInfo) {
    return new Promise((resolve, reject) => {
      const options = {
        key: orderInfo.key_id,
        amount: orderInfo.amount,
        currency: "INR",
        name: "VAKAADHA",
        description: "Order Payment",
        order_id: orderInfo.razorpay_order_id,
        handler: function (response) {
          PAYMENT_ATTEMPTED = true;
          resolve({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: orderInfo.prefill || {},
        theme: { color: "#333" },
      };

      const rzp = new Razorpay(options);

      rzp.on("payment.failed", (resp) => {
        PAYMENT_ATTEMPTED = true;
        reject(resp.error);
      });

      rzp.open();
    });
  }

  // ---------------- Payment Cancel Route ----------------
  async function cancelOrder(orderId) {
    return authFetch("/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
  }

  // ---------------- Abandon Checkout Route ----------------
  async function abandonOrder(orderId) {
    return authFetch("/api/payments/abandon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
  }

  // On page exit — abandon if no payment attempted
  window.addEventListener("beforeunload", async () => {
    if (CURRENT_ORDER_ID && !PAYMENT_ATTEMPTED) {
      await abandonOrder(CURRENT_ORDER_ID);
    }
  });

  // ---------------- Main Checkout Flow ----------------
  async function handlePlaceOrder() {

    //Payment using cards
    if (method === "Card" || method === "CARD" || method === "Card".toUpperCase()) {
      try {
        const cards = await getSavedCards();

        // Show UI and let user pick/add card
        await new Promise((resolve, reject) => {
          showCardSelectionModal(cards, async (selectedCardId, newCardData) => {
            try {
              // selectedCardId => server card_id returned by /api/cards
              // If newCardData provided, saveNewCardToServer already handled saving in our modal flow
              const cardToCharge = selectedCardId;
              if (!cardToCharge) {
                showToast("No card selected", "error");
                return reject(new Error("no card"));
              }

              // amount in paise
              const amountPaise = Math.round(parseFloat(orderTotalEl.textContent) * 100);

              const chargeResp = await chargeCardOnServer(cardToCharge, amountPaise);

              if (chargeResp.status === "success") {
                await authFetch("/api/cart/clear", { method: "DELETE" });
                window.location.href = `order-success.html?orderId=${chargeResp.order_id}`;
                resolve();
              } else {
                showToast("Card payment failed", "error");
                reject(new Error("charge failed"));
              }
            } catch (err) {
              reject(err);
            }
          });
        });

        return; // early return since card flow ended by redirect
      } catch (err) {
        console.error("Card flow failed", err);
        showToast("Card payment failed", "error");
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "Place Order";
        return;
      }
    }


    const addressId = deliveryAddressDiv.dataset.addressId || getQueryParam("addressId");
    if (!addressId) return showToast("Select a delivery address first", "error");

    const method = document.querySelector('input[name="payment"]:checked')?.value || "COD";
    const total = parseFloat(orderTotalEl.textContent);
    if (!total || total <= 0) return showToast("Your cart is empty", "error");

    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = "Processing...";

    try {
      // If already have an order, do NOT create again
      let orderData = null;

      if (!CURRENT_ORDER_ID) {
        orderData = await createPaymentOrder(addressId, method);
        CURRENT_ORDER_ID = orderData.order_id;
        CURRENT_RAZORPAY_ORDER_ID = orderData.razorpay_order_id;
      } else {
        // retry flow
        orderData = {
          order_id: CURRENT_ORDER_ID,
          razorpay_order_id: CURRENT_RAZORPAY_ORDER_ID,
          amount: parseFloat(orderTotalEl.textContent) * 100,
          key_id: window.RAZORPAY_KEY_ID,
        };
      }

      if (method === "COD") {
        showToast("Order placed successfully (Cash on Delivery)");
        await authFetch("/api/cart/clear", { method: "DELETE" });
        window.location.href = `order-success.html?orderId=${CURRENT_ORDER_ID}`;
        return;
      }

      // Razorpay Payment
      const paymentResp = await launchRazorpay(orderData);
      const verifyResp = await verifyPayment(paymentResp);

      CURRENT_ORDER_ID = verifyResp.order_id;

      if (verifyResp?.status === "success") {
        await authFetch("/api/cart/clear", { method: "DELETE" });
        window.location.href = `order-success.html?orderId=${verifyResp.order_id}`;
      } else {
        showToast("Payment failed. Retry or cancel.", "error");

        const retry = confirm("Payment failed. Try again?");
        if (!retry) {
          await cancelOrder(CURRENT_ORDER_ID);
          window.location.href = "cart.html";
        }
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      showToast("Payment process failed", "error");
    } finally {
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = "Place Order";
    }
  }

  // ---------------- Init ----------------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (window.auth?.initSession) await window.auth.initSession();

      const readyUser =
        firebase.auth().currentUser ||
        (await new Promise((res) => {
          const unsub = firebase.auth().onAuthStateChanged((u) => {
            unsub();
            res(u);
          });
        }));

      if (!readyUser) {
        window.location.href = "payment.html";
        return;
      }

      const token = await readyUser.getIdToken(true);
      localStorage.setItem("auth_token", token);

      if (window.updateNavbarCounts) await window.updateNavbarCounts(true);

      await loadDeliveryAddress();
      await loadCartSummary();

      if (placeOrderBtn) placeOrderBtn.addEventListener("click", handlePlaceOrder);
    } catch (err) {
      console.error("[payment.js] init failed:", err);
      showToast("Error initializing payment page", "error");
    }
  });
})();


// ---------- Saved Card helpers ----------
async function getSavedCards() {
  try {
    return await authFetch("/api/cards");
  } catch (err) {
    console.warn("Could not fetch saved cards:", err);
    return [];
  }
}

async function saveNewCardToServer(cardData) {
  // Expects { number, name, expiry, cvv }.
  // In production you should call gateway client-side tokenization and send only token to server.
  // Here we POST raw card data to /api/cards which will mock-tokenize for demo.
  return authFetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardData),
  });
}

async function chargeCardOnServer(card_id, amount_paise) {
  return authFetch("/api/payments/card-charge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_id, amount: amount_paise }),
  });
}

// UI for card selection/adding
function showCardSelectionModal(cards, callback) {
  const modal = document.getElementById("cardPaymentModal");
  const savedCardsDiv = document.getElementById("savedCardsDiv");
  const newCardForm = document.getElementById("newCardForm");
  modal.classList.add("active"); // show modal (your modal CSS uses .active)
  savedCardsDiv.innerHTML = "";

  if (!cards || cards.length === 0) {
    savedCardsDiv.innerHTML = "<p>No saved cards found.</p>";
  } else {
    cards.forEach(c => {
      const div = document.createElement("div");
      div.className = "card-option";
      div.innerHTML = `
        <div>
          <strong>${c.card_brand || "Card"}</strong> •••• ${c.card_last4}<br>
          Exp: ${c.expiry_month || "--"}/${c.expiry_year ? String(c.expiry_year).slice(-2) : "--"}
        </div>
        <div>
          <button class="small use-card-btn">Pay</button>
        </div>
      `;
      div.querySelector(".use-card-btn").addEventListener("click", (ev) => {
        ev.stopPropagation();
        modal.classList.remove("active");
        callback(c.card_id, null);
      });
      savedCardsDiv.appendChild(div);
    });
  }

  document.getElementById("addCardBtn").onclick = () => {
    newCardForm.style.display = "block";
  };

  document.getElementById("saveCardBtn").onclick = async () => {
    const number = document.getElementById("cardNumber").value.trim();
    const name = document.getElementById("cardName").value.trim();
    const expiry = document.getElementById("cardExpiry").value.trim();
    const cvv = document.getElementById("cardCvv").value.trim();

    // lightweight validation
    if (!/^\d{12,19}$/.test(number.replace(/\s+/g, ""))) {
      showToast("Invalid card number", "error");
      return;
    }
    if (!/^\d{2}\/\d{2,4}$/.test(expiry)) {
      showToast("Invalid expiry", "error");
      return;
    }
    if (!/^\d{3,4}$/.test(cvv)) {
      showToast("Invalid CVV", "error");
      return;
    }

    // disable button while saving
    document.getElementById("saveCardBtn").disabled = true;
    try {
      const resp = await saveNewCardToServer({ number, name, expiry, cvv });
      // resp should include card_id
      modal.classList.remove("active");
      callback(resp.card_id, null); // we pass card_id so caller charges the card
    } catch (err) {
      console.error("save card failed", err);
      showToast("Failed to save card", "error");
    } finally {
      document.getElementById("saveCardBtn").disabled = false;
    }
  };

  document.getElementById("closeCardModal").onclick = () => {
    modal.classList.remove("active");
  };
}
