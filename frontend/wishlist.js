// frontend\wishlist.js
// wishlist.js — Final Version

import { apiRequest } from "./api/client.js";

(function () {
  const wishlistContainer = document.getElementById("wishlist-items");
  const guestPrompt = document.getElementById("wishlist-guest");

  // ----------------------------
  // Toast Helper
  // ----------------------------
  function toast(msg, bad = false, ms = 2200) {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return alert(msg);
    toastEl.textContent = msg;
    toastEl.style.background = bad ? "#b00020" : "#333";
    toastEl.style.opacity = "1";
    toastEl.style.visibility = "visible";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.style.opacity = "0";
      toastEl.style.visibility = "hidden";
    }, ms);
  }

  // ----------------------------
  // Fetch Wishlist
  // ----------------------------
  async function loadWishlist() {
    try {
      const items = await apiRequest("/api/wishlist");
      renderWishlist(items);
      if (guestPrompt) guestPrompt.style.display = "none";
    } catch (err) {
      console.warn("Failed to load wishlist:", err);
      if (err.status === 401 || err.status === 410) {
        // User not logged in — show guest prompt
        wishlistContainer.innerHTML = "";
        if (guestPrompt) guestPrompt.style.display = "block";
      } else {
        toast("Error loading wishlist", true);
      }
    } finally {
      window.updateNavbarCounts?.(true);
    }
  }

  // ----------------------------
  // Render Wishlist Items
  // ----------------------------
  function renderWishlist(items = []) {
    if (!wishlistContainer) return;
    if (!items.length) {
      wishlistContainer.innerHTML = `
        <p class="empty">
          Your wishlist is empty. <a href="index.html">Shop now</a>
        </p>`;
      return;
    }

    wishlistContainer.innerHTML = items
      .map(
        (item) => `
        <div class="wishlist-card" data-id="${item.wishlist_item_id}">
          <div class="wishlist-img">
            <img src="${item.image_url || "Images/placeholder.png"}" alt="${item.name || "Product"}">
          </div>
          <div class="wishlist-info">
            <h3>${item.name || "Product"}</h3>
            <p class="price">₹${item.price ? Number(item.price).toFixed(0) : "—"}</p>
            <p class="status ${item.available ? "in-stock" : "out-of-stock"}">
              ${item.available ? "In Stock" : "Out of Stock"}
            </p>
          </div>
          <div class="wishlist-actions">
            <button class="move-to-cart" 
                    data-variant-id="${item.variant_id}" 
                    ${item.available ? "" : "disabled"}>
              Move to Bag
            </button>
            <button class="remove-item">Remove</button>
          </div>
        </div>`
      )
      .join("");
  }

  // ----------------------------
  // Remove Wishlist Item
  // ----------------------------
  async function removeItem(wishlistItemId) {
    try {
      await apiRequest(`/api/wishlist/${wishlistItemId}`, {
        method: "DELETE",
      });
      toast("Removed from wishlist ❤️‍🔥");
      await loadWishlist();
    } catch (err) {
      console.error("Failed to remove wishlist item:", err);
      toast("Failed to remove item", true);
    }
  }

  // ----------------------------
  // Move to Cart
  // ----------------------------
  async function moveToCart(variantId, wishlistItemId) {
    try {
      await apiRequest("/api/wishlist/move-to-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      toast("Moved to bag 🛍️");
      await removeItem(wishlistItemId);
      window.updateNavbarCounts?.(true);
    } catch (err) {
      if (err.status === 409) toast("Out of stock", true);
      else if (err.status === 401 || err.status === 410)
        toast("Login required to move item", true);
      else toast("Failed to move item to cart", true);
      console.error("Move-to-cart failed:", err);
    }
  }

  // ----------------------------
  // Event Delegation
  // ----------------------------
  document.addEventListener("click", async (e) => {
    const removeBtn = e.target.closest(".remove-item");
    const moveBtn = e.target.closest(".move-to-cart");

    if (removeBtn) {
      const card = removeBtn.closest(".wishlist-card");
      const wishlistItemId = card?.dataset?.id;
      if (wishlistItemId) await removeItem(wishlistItemId);
    }

    if (moveBtn) {
      const card = moveBtn.closest(".wishlist-card");
      const wishlistItemId = card?.dataset?.id;
      const variantId = moveBtn.dataset.variantId;
      if (variantId) await moveToCart(variantId, wishlistItemId);
    }
  });

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    loadWishlist();
  });
})();

