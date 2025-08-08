// // ✅ Toggle wishlist status (add/remove)
// async function toggleWishlist(productId) {
//   const user = firebase.auth().currentUser;
//   if (!user) {
//     alert("Please log in first.");
//     return;
//   }

//   const email = user.email;

//   // Check if already in wishlist
//   // const res = await fetch(`/wishlist?user_id=${email}`);
//   // const items = await res.json();
//   // const inWishlist = items.includes(productId); // Simplified, as backend returns array of product IDs

//   // if (inWishlist) {
//     // Remove from wishlist
//   //   await fetch(`/wishlist?user_id=${email}&product_id=${productId}`, {
//   //     method: "DELETE"
//   //   });
//   //   alert("Removed from wishlist");
//   // } else {
//     // Add to wishlist
// //     await fetch("/wishlist", {
// //       method: "POST",
// //       headers: { "Content-Type": "application/json" },
// //       body: JSON.stringify({ user_id: email, product_id: productId })
// //     });
// //     alert("Added to wishlist");
// //   }

// //   updateWishlistCount();
// //   if (typeof loadWishlist === "function") loadWishlist(); // Refresh display
// // }


// // ✅ Update the wishlist counter badge in header
// // async function updateWishlistCount() {
// //   const user = firebase.auth().currentUser;
// //   if (!user) return;

// //   const res = await fetch(`/wishlist?user_id=${user.email}`);
// //   const data = await res.json();

// //   const badge = document.getElementById("wishlistCount");
// //   if (badge) badge.textContent = data.length;
// }


// // ✅ Load wishlist products (for wishlist.html)
// async function loadWishlist() {
//   const user = firebase.auth().currentUser;
//   if (!user) {
//     document.getElementById("wishlist-container").innerHTML = "<p>Please log in to see your wishlist.</p>";
//     return;
//   }

//   const email = user.email;

//   // Get product IDs
//   const res = await fetch(`/wishlist?user_id=${email}`);
//   const productIds = await res.json();

//   if (!productIds.length) {
//     document.getElementById("wishlist-container").innerHTML = "<p>Your wishlist is empty.</p>";
//     return;
//   }

//   // Get full product details
//   const productsRes = await fetch("/featured-products"); // Or a route to get all products
//   const allProducts = await productsRes.json();

//   // Filter by wishlist items
//   const wishlistProducts = allProducts.filter(p => productIds.includes(p.sku_id));

//   renderWishlist(wishlistProducts);
// }


// // ✅ Render wishlist items as cards with add-to-cart
// function renderWishlist(products) {
//   const container = document.getElementById("wishlist-container");
//   container.innerHTML = "";

//   products.forEach(product => {
//     const card = document.createElement("div");
//     card.className = "wishlist-item";
//     card.innerHTML = `
//       <img src="./Images/${product.image_name}" alt="${product.name}" />
//       <h3>${product.name}</h3>
//       <p>₹${product.price}</p>
//       <button onclick="addToCartFromWishlist(${product.sku_id})">Add to Cart</button>
//       <button onclick="toggleWishlist(${product.sku_id})">Remove</button>
//     `;
//     container.appendChild(card);
//   });
// }


// // ✅ Add to cart from wishlist
// async function addToCartFromWishlist(productId) {
//   const user = firebase.auth().currentUser;
//   if (!user) {
//     alert("Please log in first.");
//     return;
//   }

//   const email = user.email;

//   const res = await fetch("/cart", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ user_id: email, product_id: productId, quantity: 1 })
//   });

//   if (res.ok) {
//     alert("Added to cart");
//   } else {
//     alert("Failed to add to cart");
//   }
// }


// ✅ Toggle wishlist status (add/remove)
async function toggleWishlist(productId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in first.");
    return;
  }

  const email = user.email;

  // Check if already in wishlist
  const res = await fetch(`/wishlist?user_id=${email}`);
  const items = await res.json();
  const inWishlist = items.some(item => item.product_id === productId);

  if (inWishlist) {
    // Remove from wishlist
    await fetch(`/wishlist?user_id=${email}&product_id=${productId}`, {
      method: "DELETE"
    });
    alert("Removed from wishlist");
  } else {
    // Add to wishlist
    await fetch("/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: email, product_id: productId })
    });
    alert("Added to wishlist");
  }

  updateWishlistCount();
  if (typeof loadWishlist === "function") loadWishlist(); // Refresh display
}


// ✅ Update the wishlist counter badge in header
async function updateWishlistCount() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const res = await fetch(`/wishlist?user_id=${user.email}`);
  const data = await res.json();

  const badge = document.getElementById("wishlistCount");
  if (badge) badge.textContent = data.length;
}


// ✅ Load wishlist products (for wishlist.html)
async function loadWishlist() {
  const user = firebase.auth().currentUser;
  if (!user) {
    document.getElementById("wishlist-container").innerHTML = "<p>Please log in to see your wishlist.</p>";
    return;
  }

  const email = user.email;

  // Get wishlist items
  const res = await fetch(`/wishlist?user_id=${email}`);
  const wishlistItems = await res.json();
  const productIds = wishlistItems.map(item => item.product_id);

  if (!productIds.length) {
    document.getElementById("wishlist-container").innerHTML = "<p>Your wishlist is empty.</p>";
    return;
  }

  // Get full product details
  const productsRes = await fetch("/featured-products"); // This must return all product objects
  const allProducts = await productsRes.json();

  // Filter by wishlist items
  const wishlistProducts = allProducts.filter(p => productIds.includes(p.sku_id));

  renderWishlist(wishlistProducts);
}


// ✅ Render wishlist items as cards with add-to-cart
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
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in first.");
    return;
  }

  const email = user.email;

  const res = await fetch("/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: email, sku_id: productId, quantity: 1 })
  });

  if (res.ok) {
    alert("Added to cart");
  } else {
    alert("Failed to add to cart");
  }
}
