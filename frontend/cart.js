document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      loadCart(); // No token required in headers
    } else {
      alert("Please login to view your cart.");
      window.location.href = "profile.html";
    }
  });
});

async function loadCart() {
  const user = firebase.auth().currentUser;
  const email = user.email;

  fetch(`http://127.0.0.1:5000/cart?user_id=${encodeURIComponent(email)}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      renderCartItems(data);
    })
    .catch(err => {
      // console.error("❌ Failed to fetch cart:", err);
      document.getElementById("cartItems").innerHTML = `<p style="color:red;">Could not load cart.</p>`;
    });
}

function renderCartItems(items) {
  const container = document.getElementById("cartItems");
  const totalElem = document.getElementById("cartTotal");

  container.innerHTML = "";
  let total = 0;

  if (items.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    totalElem.innerText = "0.00";
    return;
  }

  items.forEach(item => {
    total += item.price * item.quantity;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div class="cart-item-inner">
        <img src="./Images/${item.image_name}" alt="${item.product_name}" width="80">
        <div>
          <h4>${item.product_name}</h4>
          <p>Size: ${item.size}</p>
          <p>₹${item.price}</p>
          <div class="qty-controls">
            <button onclick="updateQuantity(${item.cart_id}, ${item.quantity - 1})">-</button>
            <span class="qty-count">${item.quantity}</span>
            <button onclick="updateQuantity(${item.cart_id}, ${item.quantity + 1})">+</button>
          </div>
          <button class="remove-btn" onclick="removeItem(${item.cart_id})">Remove</button>
        </div>
      </div>
      <hr/>
    `;
    container.appendChild(div);
  });

  totalElem.innerText = total.toFixed(2);
}

async function updateQuantity(cartId, newQty) {
  if (newQty <= 0) return removeItem(cartId);

  fetch(`http://127.0.0.1:5000/cart/${cartId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ quantity: newQty })
  })
    .then(res => res.json())
    .then(() => loadCart())
    .catch(err => console.error("Update error:", err));
}

async function removeItem(cartId) {
  fetch(`http://127.0.0.1:5000/cart/${cartId}`, {
    method: "DELETE"
  })
    .then(() => loadCart())
    .catch(err => console.error("Remove error:", err));
}

// Checkout
document.getElementById('checkoutBtn')?.addEventListener('click', () => {
  const cartData = [];

  document.querySelectorAll(".cart-item").forEach(item => {
    cartData.push({
      name: item.querySelector("h4").textContent,
      qty: parseInt(item.querySelector(".qty-count").textContent),
      price: parseFloat(item.querySelector("p:nth-of-type(2)").textContent.replace("₹", "")),
      size: item.querySelector("p:nth-of-type(1)").textContent.replace("Size: ", ""),
      img: item.querySelector("img").getAttribute("src").split("/").pop()
    });
  });

  sessionStorage.setItem("checkoutProducts", JSON.stringify(cartData));
  window.location.href = "checkout.html";
});
