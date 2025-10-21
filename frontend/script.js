// ============================================================
// script.js — Phase 2 Final (restored product grid + 410 handling)
// ============================================================

(function () {
  const productGrid = document.getElementById("productGrid");
  const toastEl = document.getElementById("toast");

  // ----------------------------
  // Toast Utility
  // ----------------------------
  function toast(msg, bad = false, ms = 2200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.background = bad ? "#b00020" : "#333";
    toastEl.style.opacity = "1";
    toastEl.style.visibility = "visible";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toastEl.style.opacity = "0";
      toastEl.style.visibility = "hidden";
    }, ms);
  }

  // ----------------------------
  // Load & Render Products
  // ----------------------------
  async function loadProducts() {
    try {
      const products = await window.apiRequest("/api/products");
      if (!Array.isArray(products) || products.length === 0) {
        productGrid.innerHTML = `<p>No products available.</p>`;
        return;
      }

      productGrid.innerHTML = products.map(renderProductCard).join("");

      // Size selection
      productGrid.querySelectorAll(".product-card").forEach((card) => {
        card.querySelectorAll(".size-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            card.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
          });
        });
      });
    } catch (err) {
      console.error("Failed to load products:", err);
      productGrid.innerHTML = `<p class="error">Error loading products.</p>`;
      toast("Failed to load products", true);
    }
  }

  function renderProductCard(prod) {
    const price = typeof prod.price_cents === "number"
      ? "₹" + (prod.price_cents / 100).toFixed(0)
      : "₹—";
    const img = prod.image_url ? `Images/${prod.image_url}` : "Images/placeholder.png";

    let sizesHtml = "";
    if (Array.isArray(prod.variants) && prod.variants.length > 0) {
      sizesHtml = `
        <div class="sizes">
          ${prod.variants
            .map(
              (v) =>
                `<button class="size-btn" data-variant-id="${v.variant_id}">${v.size}</button>`
            )
            .join("")}
        </div>`;
    }

    return `
      <div class="product-card" data-id="${prod.product_id}">
        <div class="product-actions">
          <button class="wishlist-btn" data-product-id="${prod.product_id}">
            <i class="far fa-heart"></i>
          </button>
          <button class="share-btn" data-product-id="${prod.product_id}">
            <i class="fas fa-share-alt"></i>
          </button>
        </div>
        <img src="${img}" alt="${escapeHtml(prod.name || "Product")}">
        <h3>${escapeHtml(prod.name || "")}</h3>
        <p class="price">${price}</p>
        ${sizesHtml}
        <div class="card-actions">
          <button class="btn add-to-cart">Add to Cart</button>
          <button class="btn buy-now">Buy Now</button>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ----------------------------
  // Add to Cart (410 handling)
  // ----------------------------
  async function handleAddToCart(productCard) {
    try {
      const variantId = getSelectedVariant(productCard);
      if (!variantId) return;

      await window.apiRequest("/api/cart", {
        method: "POST",
        body: { variant_id: variantId, quantity: 1 },
      });

      toast("Added to cart!");
      window.updateNavbarCounts?.(true);
    } catch (err) {
      console.error("Add to cart failed:", err);
      if (err.status === 410) {
        toast("Session expired. Reloading...", true);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast("Failed to add to cart", true);
      }
    }
  }

  function getSelectedVariant(card) {
    const sizeButtons = card.querySelectorAll(".size-btn");
    if (!sizeButtons.length) {
      toast("This product has no selectable variant", true);
      return null;
    }
    const active = card.querySelector(".size-btn.active");
    if (!active) {
      toast("Please select a size", true);
      return null;
    }
    return Number(active.getAttribute("data-variant-id"));
  }

  // ----------------------------
  // Wishlist add
  // ----------------------------
  async function handleWishlist(productCard) {
    const productId = productCard?.dataset?.id;
    if (!productId) return;
    try {
      await window.apiRequest("/api/wishlist", {
        method: "POST",
        body: { product_id: Number(productId) },
      });
      toast("Added to wishlist");
      window.updateNavbarCounts?.(true);
    } catch (err) {
      console.warn("Wishlist add failed:", err);
      toast("Login required for wishlist", true);
    }
  }

  // ----------------------------
  // Share Modal
  // ----------------------------
  function openShare(productCard) {
    const pid = productCard?.dataset?.id;
    const name = productCard?.querySelector("h3")?.textContent || "Product";
    const url = `${location.origin}${location.pathname}?p=${encodeURIComponent(pid)}`;

    const modal = document.getElementById("shareModal");
    const w = document.getElementById("share-whatsapp");
    const f = document.getElementById("share-facebook");
    const t = document.getElementById("share-twitter");
    const c = document.getElementById("copy-link");
    if (!modal || !w || !f || !t || !c) return;

    w.href = `https://wa.me/?text=${encodeURIComponent(`${name} - ${url}`)}`;
    f.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    t.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${name} - ${url}`)}`;

    c.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied!");
      } catch {
        toast("Copy failed", true);
      }
    };

    modal.style.display = "block";
  }

  // ----------------------------
  // Event Delegation
  // ----------------------------
  document.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".add-to-cart");
    const buyBtn = e.target.closest(".buy-now");
    const wishBtn = e.target.closest(".wishlist-btn");
    const shareBtn = e.target.closest(".share-btn");

    if (addBtn) handleAddToCart(addBtn.closest(".product-card"));
    if (buyBtn)
      handleAddToCart(buyBtn.closest(".product-card")).then(
        () => (window.location.href = "cart.html")
      );
    if (wishBtn) handleWishlist(wishBtn.closest(".product-card"));
    if (shareBtn) openShare(shareBtn.closest(".product-card"));
  });

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await loadProducts();
    window.updateNavbarCounts?.(true);
  });

  // Global access
  window.toast = toast;
})();
