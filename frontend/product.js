
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  if (!productId) {
    document.getElementById("productDetails").innerHTML = "<p>Invalid Product ID</p>";
    return;
  }

  fetch(`http://127.0.0.1:5000/products/${productId}`)
    .then(res => res.json())
    .then(product => renderProduct(product))
    .catch(err => {
      console.error("Failed to load product", err);
      document.getElementById("productDetails").innerHTML = "<p>Product not found.</p>";
    });
});

function renderProduct(product) {
  const container = document.getElementById("productDetails");

  container.innerHTML = `
    <div class="product-view">
      <img src="${product.image_url}" alt="${product.name}" />
      <div class="product-info">
        <h2>${product.name}</h2>
        <p>${product.description}</p>
        <p><strong>₹${product.price.toFixed(2)}</strong></p>

        <label for="size">Size:</label>
        <select id="size">
          <option value="M">M</option>
          <option value="L">L</option>
          <option value="XL">XL</option>
        </select>

        <label for="color">Color:</label>
        <select id="color">
          <option value="Black">Black</option>
          <option value="White">White</option>
          <option value="Red">Red</option>
        </select>

        <label for="qty">Quantity:</label>
        <input type="number" id="qty" value="1" min="1" max="10" />

        <button class="btn-primary" onclick="addToCart(${product.product_id})">Add to Cart</button>
      </div>
    </div>
  `;
}

async function addToCart(productId) {
  const user = firebase.auth().currentUser;

  if (!user) {
    alert("⚠️ Please login to add items to cart.");
    return;
  }

  const size = document.getElementById("size").value;
  const color = document.getElementById("color").value;
  const quantity = parseInt(document.getElementById("qty").value);

  try {
    // Step 1: Fetch SKU ID
    const skuRes = await fetch(`http://127.0.0.1:5000/sku?product_id=${productId}&size=${size}&color=${color}`);
    const skuData = await skuRes.json();

    if (!skuData.sku_id) {
      alert("❌ SKU not found. Please try a different size/color.");
      return;
    }

    const sku_id = skuData.sku_id;

    // Log payload before sending
    console.log("👤 Firebase user:", user);
    console.log("📦 Sending to /cart:", {
      user_id: user.uid,
      sku_id: sku_id,
      quantity: quantity
    });

    // Step 2: Post to /cart
    const cartRes = await fetch("http://127.0.0.1:5000/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.email,
        sku_id: sku_id,
        quantity: quantity
      })
    });

    const cartResult = await cartRes.json();

    if (cartRes.ok) {
      alert("✅ " + cartResult.message);
    } else {
      console.error("❌ Backend error:", cartResult);
      alert("❌ Failed to add to cart: " + (cartResult.error || "Unknown error"));
    }

  } catch (err) {
    console.error("❌ Add to Cart Exception:", err);
    alert("❌ Unexpected error occurred. See console for details.");
  }
}
