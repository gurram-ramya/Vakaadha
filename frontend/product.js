// document.addEventListener("DOMContentLoaded", () => {
//   fetch("http://127.0.0.1:5000/products")
//     .then(res => res.json())
//     .then(products => {
//       const container = document.getElementById("product-list");
//       container.innerHTML = "";

//       products.forEach(product => {
//         const card = document.createElement("div");
//         card.className = "product-card";

//         card.innerHTML = `
//           <div class="product-image">
//             <img src="${product.image_url}" alt="${product.name}" />
//           </div>
//           <div class="product-info">
//             <h3>${product.name}</h3>
//             <p>₹${product.price}</p>
//             <div class="btn-group">
//               <button class="btn-cart">Add to Cart</button>
//               <button class="btn-buy">Buy Now</button>
//             </div>
//           </div>
//         `;
//         container.appendChild(card);
//       });
//     })
//     .catch(err => {
//       console.error("Failed to load products:", err);
//     });
// });


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

function addToCart(productId) {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || !user.token) {
    alert("Please login to add items to cart.");
    return;
  }

  const size = document.getElementById("size").value;
  const color = document.getElementById("color").value;
  const quantity = parseInt(document.getElementById("qty").value);

  fetch("http://127.0.0.1:5000/cart", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${user.token}`
    },
    body: JSON.stringify({
      product_id: productId,
      size,
      color,
      quantity
    })
  })
    .then(res => res.json())
    .then(data => {
      alert("✅ Item added to cart!");
    })
    .catch(err => {
      console.error("Add to cart failed", err);
      alert("Could not add to cart");
    });
}
