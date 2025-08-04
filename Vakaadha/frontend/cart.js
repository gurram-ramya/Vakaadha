// ✅ Toggle wishlist status (add/remove)
async function toggleWishlist(productId) {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.user_id) {
    alert("Please log in first.");
    return;
  }

  const userId = user.user_id;

  const res = await fetch(`/wishlist?user_id=${userId}`);
  const items = await res.json();
  const inWishlist = items.includes(productId);

  if (inWishlist) {
    // Remove from wishlist
    await fetch(`/wishlist?user_id=${userId}&product_id=${productId}`, {
      method: "DELETE"
    });
    alert("Removed from wishlist");
  } else {
    // Add to wishlist
    await fetch("/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, product_id: productId })
    });
    alert("Added to wishlist");
  }

  updateWishlistCount();
  if (typeof loadWishlist === "function") loadWishlist();
}

// ✅ Update the wishlist counter badge in header
async function updateWishlistCount() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.user_id) return;

  const res = await fetch(`/wishlist?user_id=${user.user_id}`);
  const data = await res.json();

  const badge = document.getElementById("wishlistCount");
  if (badge) badge.textContent = data.length;
}

// ✅ Load wishlist products (for wishlist.html)
async function loadWishlist() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.user_id) {
    document.getElementById("wishlist-container").innerHTML = "<p>Please log in to see your wishlist.</p>";
    return;
  }

  const userId = user.user_id;

  const res = await fetch(`/wishlist?user_id=${userId}`);
  const productIds = await res.json();

  if (!productIds.length) {
    document.getElementById("wishlist-container").innerHTML = "<p>Your wishlist is empty.</p>";
    return;
  }

  const productsRes = await fetch("/featured-products");
  const allProducts = await productsRes.json();

  const wishlistProducts = allProducts.filter(p => productIds.includes(p.sku_id));
  renderWishlist(wishlistProducts);
}

// ✅ Render wishlist items
function renderWishlist(products) {
  const container = document.getElementById("wishlist-container");
  container.innerHTML = "";

  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "wishlist-item";
    card.innerHTML = `
      <img src="./Images/${product.image_name}" alt="${product.name}" />
      <h3>${product.name}</h3>
      <p>₹${product.price}</p>
      <button onclick="addToCartFromWishlist(${product.sku_id})">Add to Cart</button>
      <button onclick="toggleWishlist(${product.sku_id})">Remove</button>
    `;
    container.appendChild(card);
  });
}

// ✅ Add to cart from wishlist
async function addToCartFromWishlist(productId) {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.user_id) {
    alert("Please log in first.");
    return;
  }

  const res = await fetch("/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id, product_id: productId, quantity: 1 })
  });

  if (res.ok) {
    alert("Added to cart");
  } else {
    alert("Failed to add to cart");
  }
}

// DOMContent Loaded
document.addEventListener("DOMContentLoaded", () => {
  updateWishlistCount();
  updateCartCount();
  if (window.location.pathname.includes("wishlist.html")) {
    loadWishlist();
  }
  // if (window.location.pathname.includes("cart.html")) {
  //   loadCartItems();
  // }
});



// ✅ Update cart item count in header
// ✅ Load and render cart items
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  loadCartItems();
});

async function loadCartItems() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.email) {
    document.getElementById("cartItems").innerHTML = "<p>Please log in to see your cart.</p>";
    return;
  }

  try {
    const res = await fetch(`/cart?user_id=${user.email}`);
    const cartData = await res.json();

    if (!cartData.length) {
      document.getElementById("cartItems").innerHTML = "<p>Your cart is empty.</p>";
      document.getElementById("cartTotal").textContent = "0.00";
      return;
    }

    renderCartItems(cartData);
  } catch (err) {
    console.error("❌ Error fetching cart data:", err);
    document.getElementById("cartItems").innerHTML = "<p>Error loading cart.</p>";
  }
}

function renderCartItems(cartItems) {
  const container = document.getElementById("cartItems");
  container.innerHTML = "";

  let total = 0;

  cartItems.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const card = document.createElement("div");
    card.className = "cart-item";
    card.innerHTML = `
      <img src="./Images/${item.image_name}" alt="${item.name}" />
      <div class="cart-details">
        <h3>${item.name}</h3>
        <p>Price: ₹${item.price.toFixed(2)}</p>
        <p>Quantity: ${item.quantity}</p>
        <p>Subtotal: ₹${subtotal.toFixed(2)}</p>
        <button onclick="removeFromCart(${item.sku_id})">Remove</button>
      </div>
    `;

    container.appendChild(card);
  });

  document.getElementById("cartTotal").textContent = total.toFixed(2);
}

// ✅ Remove item from cart
async function removeFromCart(productId) {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.email) {
    alert("Please log in.");
    return;
  }

  // try {
  //   const res = await fetch(`/cart?user_id=${user.email}&product_id=${productId}`, {
  //     method: "DELETE"
  //   });
  try {
    const res = await fetch("/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.email, product_id: productId })
    });

    
    if (res.ok) {
      alert("Removed from cart");
      loadCartItems();
      updateCartCount();
    } else {
      alert("Failed to remove from cart");
    }
  } catch (err) {
    console.error("❌ Error removing item:", err);
  }
}

// ✅ Update cart badge count in header
async function updateCartCount() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.email) return;

  try {
    const res = await fetch(`/cart?user_id=${user.email}`);
    const cartItems = await res.json();
    const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById("cartCount");
    if (badge) badge.textContent = totalQty;
  } catch (err) {
    console.error("❌ Failed to update cart count:", err);
  }
}
