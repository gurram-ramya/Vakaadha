// script.js — Homepage product listing & backend-integrated cart actions
// Requires window.apiRequest (classic client.js) and optional window.updateNavbarCounts()

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
      // Backend route per your catalog.py
      const products = await window.apiRequest("/api/products");

      if (!Array.isArray(products) || products.length === 0) {
        productGrid.innerHTML = `<p>No products available.</p>`;
        return;
      }

      productGrid.innerHTML = products
        .map((prod) => renderProductCard(prod))
        .join("");

      // Size button behavior (toggle .active)
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

    const img = prod.image_url
      ? `Images/${prod.image_url}`
      : "Images/placeholder.png";

    // Build size buttons with data-variant-id for a definite variant resolution
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
  // Add to Cart
  // ----------------------------
  async function handleAddToCart(productCard) {
    const productId = productCard?.dataset?.id;
    if (!productId) return;

    try {
      // Determine a valid variant_id
      const sizeButtons = productCard.querySelectorAll(".size-btn");
      let variantId = null;

      if (sizeButtons.length > 0) {
        const active = productCard.querySelector(".size-btn.active");
        if (!active) {
          toast("Please select a size", true);
          return;
        }
        variantId = Number(active.getAttribute("data-variant-id"));
      } else {
        // No variants exposed; backend must accept product_id as variant_id only if that's your schema.
        // In your schema, cart expects a real variant_id. If products always have variants, you should
        // render at least one. If there's truly one implicit variant, you must return it in /api/products.
        // We fail loudly here to avoid DBError.
        toast("This product has no selectable variant", true);
        return;
      }

      if (!variantId || Number.isNaN(variantId)) {
        toast("Invalid variant selected", true);
        return;
      }

      // POST /api/cart (do NOT add guest_id in URL; backend sets cookie)
      await window.apiRequest("/api/cart", {
        method: "POST",
        body: { variant_id: variantId, quantity: 1 },
      });

      toast("Added to cart!");
      if (typeof window.updateNavbarCounts === "function") {
        window.updateNavbarCounts();
      }
    } catch (err) {
      console.error("Add to cart failed:", err);
      toast("Failed to add to cart", true);
    }
  }

  // ----------------------------
  // Wishlist click (auth required)
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
      if (typeof window.updateNavbarCounts === "function") {
        window.updateNavbarCounts();
      }
    } catch (err) {
      console.warn("Wishlist add failed (likely not logged in):", err);
      toast("Login required for wishlist", true);
    }
  }

  // ----------------------------
  // Share Modal (optional)
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

    if (addBtn) {
      const card = addBtn.closest(".product-card");
      handleAddToCart(card);
    }

    if (buyBtn) {
      const card = buyBtn.closest(".product-card");
      // For now, just add to cart then navigate to cart page
      handleAddToCart(card).then(() => (window.location.href = "cart.html"));
    }

    if (wishBtn) {
      const card = wishBtn.closest(".product-card");
      handleWishlist(card);
    }

    if (shareBtn) {
      const card = shareBtn.closest(".product-card");
      openShare(card);
    }
  });

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await loadProducts();
    if (typeof window.updateNavbarCounts === "function") {
      window.updateNavbarCounts();
    }
  });
})();
