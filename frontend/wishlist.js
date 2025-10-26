// frontend/wishlist.js — Vakaadha Wishlist v3 (Fixed Guest Context + API)
(function () {
  const wishlistContainer = document.getElementById("wishlist-items");
  const guestPrompt = document.getElementById("wishlist-guest");
  const loadingEl = document.getElementById("loading");
  const emptyState = document.getElementById("emptyState");

  // ----------------------------
  // Helpers
  // ----------------------------
  function toast(msg, bad = false, ms = 2200) {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return console.log(msg);
    toastEl.textContent = msg;
    toastEl.style.background = bad ? "#b00020" : "#493628";
    toastEl.style.opacity = "1";
    toastEl.style.visibility = "visible";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.style.opacity = "0";
      toastEl.style.visibility = "hidden";
    }, ms);
  }

  function getGuestId() {
    try {
      return localStorage.getItem("guest_id") || null;
    } catch {
      return null;
    }
  }

  async function safeApiRequest(endpoint, options = {}) {
    const guestId = getGuestId();
    const url = guestId ? `${endpoint}?guest_id=${guestId}` : endpoint;
    return await window.apiRequest(url, options);
  }

  // ----------------------------
  // Load Wishlist (with guest context)
  // ----------------------------
  async function loadWishlist() {
    try {
      if (loadingEl) loadingEl.classList.remove("hidden");
      wishlistContainer.innerHTML = "";
      if (emptyState) emptyState.classList.add("hidden");

      const res = await safeApiRequest("/api/wishlist", { method: "GET" });
      const items = res?.items ?? [];

      if (!Array.isArray(items) || items.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        wishlistContainer.innerHTML = "";
        return;
      }

      renderWishlist(items);
      if (guestPrompt) guestPrompt.style.display = "none";
    } catch (err) {
      console.warn("Failed to load wishlist:", err);
      if (err.status === 401 || err.status === 410) {
        wishlistContainer.innerHTML = "";
        if (guestPrompt) guestPrompt.style.display = "block";
      } else {
        toast("Error loading wishlist", true);
      }
    } finally {
      if (loadingEl) loadingEl.classList.add("hidden");
      window.updateNavbarCounts?.(true);
    }
  }

  // ----------------------------
  // Render Wishlist Items (matches DB schema)
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
      .map((item) => {
        const image = item.image_url
          ? item.image_url.startsWith("http")
            ? item.image_url
            : `Images/${item.image_url}`
          : "Images/placeholder.png";

        const price =
          typeof item.price_cents === "number"
            ? `₹${(item.price_cents / 100).toFixed(0)}`
            : "₹—";

        return `
          <div class="wishlist-card" data-product-id="${item.product_id}">
            <div class="wishlist-img">
              <img src="${image}" alt="${item.name || "Product"}" loading="lazy">
            </div>
            <div class="wishlist-info">
              <h3>${item.name || "Product"}</h3>
              <p class="price">${price}</p>
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
          </div>`;
      })
      .join("");
  }

  // ----------------------------
  // Remove Wishlist Item
  // ----------------------------
  async function removeItem(productId) {
    try {
      const res = await safeApiRequest(`/api/wishlist/${productId}`, { method: "DELETE" });
      if (res?.status === "success") {
        toast("Removed from wishlist ❤️‍🔥");
        await loadWishlist();
      } else {
        toast(res?.message || "Failed to remove item", true);
      }
    } catch (err) {
      console.error("Failed to remove wishlist item:", err);
      toast("Failed to remove item", true);
    }
  }

  // ----------------------------
  // Move to Cart (size selection)
  // ----------------------------
  async function moveToCart(productId) {
    try {
      const variants = await safeApiRequest(`/api/products/${productId}/variants`);
      if (!Array.isArray(variants) || variants.length === 0) {
        toast("No size options available for this product.", true);
        return;
      }

      const variantId = await promptForSize(variants);
      if (!variantId) {
        toast("Size selection cancelled.");
        return;
      }

      const res = await safeApiRequest("/api/wishlist/move-to-cart", {
        method: "POST",
        body: { product_id: productId, variant_id: variantId },
      });

      if (res?.status === "success") {
        toast("Moved to bag 🛍️");
        await removeItem(productId);
      } else {
        toast(res?.message || "Failed to move item", true);
      }
    } catch (err) {
      if (err.status === 409) toast("Out of stock", true);
      else if (err.status === 401 || err.status === 410)
        toast("Login required to move item", true);
      else toast("Failed to move item to cart", true);
      console.error("Move-to-cart failed:", err);
    }
  }

  // ----------------------------
  // Variant Selector Modal (unchanged)
  // ----------------------------
  function promptForSize(variants) {
    return new Promise((resolve) => {
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
          background: #fffaf5;
          padding: 20px;
          border-radius: 8px;
          max-width: 320px;
          text-align: center;
          box-shadow: 0 5px 20px rgba(0,0,0,0.3);
          color: #493628;
        }
        .size-options {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin: 15px 0;
        }
        .size-option {
          border: 1px solid #70513b;
          padding: 8px 12px;
          border-radius: 5px;
          background: #f8eee5;
          color: #493628;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .size-option:hover {
          background: #493628;
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

      modal.addEventListener("click", (e) => {
        const btn = e.target.closest(".size-option");
        if (btn) {
          const variantId = btn.dataset.variantId;
          modal.remove();
          style.remove();
          resolve(variantId);
        }
        if (
          e.target.classList.contains("close-size-modal") ||
          e.target.classList.contains("size-modal-backdrop")
        ) {
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
  document.addEventListener("DOMContentLoaded", async () => {
    await loadWishlist();
    await window.updateNavbarCounts?.(true);
  });
})();
