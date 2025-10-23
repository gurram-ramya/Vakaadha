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
      const items = await window.apiRequest("/api/wishlist");
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
        <div class="wishlist-card" data-product-id="${item.product_id}">
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
            <button class="move-to-cart" ${item.available ? "" : "disabled"}>
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
  async function removeItem(productId) {
    try {
      await apiRequest(`/api/wishlist`, {
        method: "DELETE",
        body: { product_id: productId },
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


  async function moveToCart(productId) {
    try {
      // Fetch available variants for this product
      const variants = await apiRequest(`/api/products/${productId}/variants`);

      if (!variants || variants.length === 0) {
        toast("No size options available for this product.", true);
        return;
      }

      // Show popup for size selection
      const variantId = await promptForSize(variants);
      if (!variantId) {
        toast("Size selection cancelled.");
        return;
      }

      // Proceed with moving item to cart
      await apiRequest("/api/wishlist/move-to-cart", {
        method: "POST",
        body: { product_id: productId, variant_id: variantId },
      });

      toast("Moved to bag 🛍️");
      await removeItem(productId);
      window.updateNavbarCounts?.(true);
    } catch (err) {
      if (err.status === 409) toast("Out of stock", true);
      else if (err.status === 401 || err.status === 410)
        toast("Login required to move item", true);
      else toast("Failed to move item to cart", true);
      console.error("Move-to-cart failed:", err);
    }
  }

  function promptForSize(variants) {
    return new Promise((resolve) => {
      // Remove existing modal if any
      document.querySelector("#sizeModal")?.remove();

      const modal = document.createElement("div");
      modal.id = "sizeModal";
      modal.innerHTML = `
        <div class="size-modal-backdrop"></div>
        <div class="size-modal-content">
          <h3>Select a Size</h3>
          <div class="size-options">
            ${variants
              .map(
                (v) => `
                <button class="size-option" data-variant-id="${v.variant_id}">
                  ${v.size_label || v.size || "Size"}
                </button>`
              )
              .join("")}
          </div>
          <button class="close-size-modal">Cancel</button>
        </div>
      `;

      document.body.appendChild(modal);

      // CSS for modal (you can move this to wishlist.css)
      const style = document.createElement("style");
      style.textContent = `
        #sizeModal {
          position: fixed; inset: 0;
          display: flex; align-items: center; justify-content: center;
          z-index: 9999;
        }
        .size-modal-backdrop {
          position: absolute; inset: 0;
          background: rgba(0, 0, 0, 0.4);
        }
        .size-modal-content {
          position: relative;
          background: white;
          padding: 20px;
          border-radius: 8px;
          max-width: 300px;
          text-align: center;
          box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        }
        .size-options {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin: 15px 0;
        }
        .size-option {
          border: 1px solid #ccc;
          padding: 8px 12px;
          border-radius: 5px;
          background: #f9f9f9;
          cursor: pointer;
        }
        .size-option:hover {
          background: #333;
          color: #fff;
        }
        .close-size-modal {
          border: none;
          background: #b00020;
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
      `;
      document.head.appendChild(style);

      // Event listeners
      modal.addEventListener("click", (e) => {
        const btn = e.target.closest(".size-option");
        if (btn) {
          const variantId = btn.dataset.variantId;
          modal.remove();
          style.remove();
          resolve(variantId);
        }

        if (e.target.classList.contains("close-size-modal") || e.target.classList.contains("size-modal-backdrop")) {
          modal.remove();
          style.remove();
          resolve(null);
        }
      });
    });
  }



  // ----------------------------
  // Event Delegation
  // ----------------------------
  // document.addEventListener("click", async (e) => {
  //   const removeBtn = e.target.closest(".remove-item");
  //   const moveBtn = e.target.closest(".move-to-cart");

  //   if (removeBtn) {
  //     const card = removeBtn.closest(".wishlist-card");
  //     const wishlistItemId = card?.dataset?.id;
  //     if (wishlistItemId) await removeItem(wishlistItemId);
  //   }

  //   if (moveBtn) {
  //     const card = moveBtn.closest(".wishlist-card");
  //     const wishlistItemId = card?.dataset?.id;
  //     const variantId = moveBtn.dataset.variantId;
  //     if (variantId) await moveToCart(variantId, wishlistItemId);
  //   }
  // });

  document.addEventListener("click", async (e) => {
    const removeBtn = e.target.closest(".remove-item");
    const moveBtn = e.target.closest(".move-to-cart");

    if (removeBtn) {
      const card = removeBtn.closest(".wishlist-card");
      const productId = card?.dataset?.productId;
      if (productId) await removeItem(productId);
    }

    if (moveBtn) {
      const card = moveBtn.closest(".wishlist-card");
      const productId = card?.dataset?.productId;
      if (productId) await moveToCart(productId);
    }
  });


  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    loadWishlist();
  });
})();

