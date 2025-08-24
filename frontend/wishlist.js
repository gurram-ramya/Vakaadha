// ==============================
// frontend/wishlist.js
// Clean style wishlist
// ==============================

import { apiClient } from "./api/client.js";

const wishlistContainer = document.getElementById("wishlist-items");
const guestPrompt = document.getElementById("wishlist-guest");

// Load wishlist
async function loadWishlist() {
  const stored = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!stored || !stored.idToken) {
    guestPrompt.style.display = "block";
    wishlistContainer.style.display = "none";
    return;
  }

  try {
    const items = await apiClient.get("users/me/wishlist");
    renderWishlist(items);
  } catch (err) {
    console.error("Failed to load wishlist:", err);
    guestPrompt.style.display = "block";
    wishlistContainer.style.display = "none";
  }
}

// Render wishlist items
function renderWishlist(items) {
  wishlistContainer.innerHTML = "";

  if (!items || items.length === 0) {
    wishlistContainer.innerHTML = "<p style='text-align:center;'>Your wishlist is empty.</p>";
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "wishlist-card";
    card.innerHTML = `
      <img src="${item.image_url || './Images/placeholder.png'}" alt="${item.name}">
      <h3>${item.name}</h3>
      <p>₹${(item.price_cents / 100).toFixed(2)}</p>
      <button class="cart-btn" data-id="${item.product_id}">Move to Cart</button>
      <button class="remove-btn" data-id="${item.product_id}">Remove</button>
    `;
    wishlistContainer.appendChild(card);
  });

  // Attach events
  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const productId = e.target.dataset.id;
      await apiClient.delete(`users/me/wishlist/${productId}`);
      loadWishlist();
    });
  });

  document.querySelectorAll(".cart-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const productId = e.target.dataset.id;
      await apiClient.post("users/me/cart", { product_id: productId, quantity: 1 });
      await apiClient.delete(`users/me/wishlist/${productId}`);
      loadWishlist();
    });
  });
}

// Init
document.addEventListener("DOMContentLoaded", loadWishlist);
