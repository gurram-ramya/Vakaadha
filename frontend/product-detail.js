document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  if (!productId) {
    document.getElementById('productDetails').innerHTML = "<p>Invalid product.</p>";
    return;
  }

  fetch(`/products/${productId}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        document.getElementById('productDetails').innerHTML = `<p>${data.error}</p>`;
        return;
      }

      const skuOptions = data.inventory.map(sku => `
        <option value="${sku.sku_id}">${sku.size} / ${sku.color} (${sku.quantity} left)</option>
      `).join('');

      const productHTML = `
        <div class="product-card product-detail">
          <img src="./Images/${data.inventory[0].image_name}" alt="${data.name}" />
          <div class="product-info">
            <h2>${data.name}</h2>
            <p><strong>₹${data.price}</strong></p>
            <p>${data.description}</p>

            <label for="skuSelect">Select Variant:</label>
            <select id="skuSelect">${skuOptions}</select>

            <button onclick="addToCart()">Add to Cart</button>
          </div>
        </div>
      `;

      document.getElementById('productDetails').innerHTML = productHTML;
    })
    .catch(err => {
      console.error("Error loading product:", err);
      document.getElementById('productDetails').innerHTML = "<p>Failed to load product details.</p>";
    });
});

async function addToCart() {
  const skuId = document.getElementById('skuSelect').value;
  const user = firebase.auth().currentUser;
  const token = await user.getIdToken();

  fetch('/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sku_id: parseInt(skuId),
      quantity: 1
    })
  })
  .then(res => res.json())
  .then(data => {
    alert("Added to cart!");
  })
  .catch(err => {
    console.error("Add to cart failed:", err);
    alert("Could not add to cart.");
  });
}

