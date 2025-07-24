async function toggleWishlist(productId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in first.");
    return;
  }

  const email = user.email;

  // Check if already in wishlist
  const existing = await fetch(`/wishlist?user_id=${email}`);
  const items = await existing.json();
  const inWishlist = items.some(item => item.product_id == productId);

  if (inWishlist) {
    // Remove
    fetch(`/wishlist?user_id=${email}&product_id=${productId}`, {
      method: "DELETE"
    })
    .then(() => {
      alert("Removed from wishlist");
      updateWishlistCount();
    });
  } else {
    // Add
    fetch("/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: email, product_id: productId })
    })
    .then(() => {
      alert("Added to wishlist");
      updateWishlistCount();
    });
  }
}

async function updateWishlistCount() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const res = await fetch(`/wishlist?user_id=${user.email}`);
  const data = await res.json();
  document.getElementById("wishlistCount").textContent = data.length;
}
