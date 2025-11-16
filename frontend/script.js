// frontend/script.js
// ============================================================
// Product Grid + Wishlist + Cart (auth-first; guest when anon)
// ============================================================

(function () {
  const productGrid = document.getElementById("productGrid");
  const toastEl = document.getElementById("toast");

  // ----------------------------
  // Toast
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
  // Session introspection (debug)
  // ----------------------------
  function sessionSnapshot(tag) {
    const token = (window.auth && window.auth.getToken && window.auth.getToken()) || null;
    const gid = (window.getGuestId && window.getGuestId()) || null; // mirrored cookie if any
    console.debug(`[script.js] ${tag} → mode=${token ? "AUTH" : "GUEST"} token=${!!token} guest_id=${gid || "∅"}`);
    return { token, gid };
  }

  // ----------------------------
  // Load & Render Products
  // ----------------------------
  async function loadProducts() {
    try {
      sessionSnapshot("loadProducts:pre-wishlist");
      await fetchWishlistItems(); // preload wishlist to render heart state

      sessionSnapshot("loadProducts:products");
      const products = await window.apiRequest("/api/products");
      if (!Array.isArray(products) || products.length === 0) {
        productGrid.innerHTML = `<p>No products available.</p>`;
        return;
      }

      productGrid.innerHTML = products.map(renderProductCard).join("");

      productGrid.querySelectorAll(".product-card").forEach((card) => {
        card.querySelectorAll(".size-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            card.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
          });
        });
      });

      wireWishlistButtons();
    } catch (err) {
      console.error("Failed to load products:", err);
      productGrid.innerHTML = `<p class="error">Error loading products.</p>`;
      toast("Failed to load products", true);
    }
  }

  // ----------------------------
  // Render Product Card
  // ----------------------------
  function renderProductCard(prod) {
    const price = typeof prod.price_cents === "number" ? "₹" + (prod.price_cents / 100).toFixed(0) : "₹—";
    const img = prod.image_url ? `Images/${prod.image_url}` : "Images/placeholder.png";

    let sizesHtml = "";
    if (Array.isArray(prod.variants) && prod.variants.length > 0) {
      sizesHtml = `
        <div class="sizes">
          ${prod.variants.map((v) => `<button class="size-btn" data-variant-id="${v.variant_id}">${v.size}</button>`).join("")}
        </div>`;
    }

    const isWishlisted = window.currentWishlist?.has(prod.product_id) ?? false;

    return `
      <div class="product-card" data-id="${prod.product_id}">
        <div class="product-actions">
          <button class="wishlist-btn" data-product-id="${prod.product_id}">
            <i class="${isWishlisted ? "fas" : "far"} fa-heart"></i>
          </button>
          <button class="share-btn" data-product-id="${prod.product_id}">
            <i class="fas fa-share-alt"></i>
          </button>
        </div>

        <a href="details.html?id=${prod.product_id}" class="product-link">
          <img src="${img}" alt="${escapeHtml(prod.name || "Product")}">
          <h3 style="text-decoration: none;">${escapeHtml(prod.name || "")}</h3>
        </a>

        <p class="price">${price}</p>
        ${sizesHtml}
        <div class="card-actions">
          <button class="btn add-to-cart">Add to Cart</button>
          <button class="btn buy-now">Buy Now</button>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ----------------------------
  // Add to Cart
  // ----------------------------
  async function handleAddToCart(productCard) {
    try {
      const variantId = getSelectedVariant(productCard);
      if (!variantId) return;

      sessionSnapshot("addToCart");
      await window.apiRequest("/api/cart", {
        method: "POST",
        body: { variant_id: variantId, quantity: 1 },
      });

      toast("Added to cart!");
      window.updateNavbarCounts?.(true);
    } catch (err) {
      console.error("Add to cart failed:", err);
      if (err.status === 410) {
        console.warn("Cart session expired; will reload");
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

  // ============================================================
  // Wishlist helpers (Auth-first; guest only when anonymous)
  // ============================================================

  async function fetchWishlistItems() {
    try {
      sessionSnapshot("wishlist:GET");
      const res = await window.apiRequest("/api/wishlist", { method: "GET" });
      if (res && Array.isArray(res.items)) {
        const productIds = res.items.map((i) => i.product_id);
        window.currentWishlist = new Set(productIds);
      } else {
        window.currentWishlist = new Set();
      }
    } catch (err) {
      console.error("Failed to fetch wishlist items:", err);
      window.currentWishlist = new Set();
    }
  }

  async function addToWishlist(productId) {
    try {
      sessionSnapshot("wishlist:POST");
      const res = await window.apiRequest("/api/wishlist", {
        method: "POST",
        body: { product_id: productId },
      });

      if (res?.status === "success") {
        window.currentWishlist.add(productId);
        await updateWishlistCount();
        toast("Added to wishlist");
      } else {
        toast(res?.message || "Unable to add to wishlist", true);
      }
    } catch (err) {
      console.error("Add to wishlist failed:", err);
      toast("Unable to add item to wishlist", true);
    }
  }

  async function removeFromWishlist(productId) {
    try {
      sessionSnapshot("wishlist:DELETE");
      const res = await window.apiRequest(`/api/wishlist/${productId}`, { method: "DELETE" });

      if (res?.status === "success") {
        window.currentWishlist.delete(productId);
        await updateWishlistCount();
        toast("Removed from wishlist");
      } else {
        toast(res?.message || "Unable to remove item from wishlist", true);
      }
    } catch (err) {
      console.error("Remove from wishlist failed:", err);
      toast("Unable to remove item from wishlist", true);
    }
  }

  async function updateWishlistCount() {
    try {
      sessionSnapshot("wishlist:COUNT");
      const res = await window.apiRequest("/api/wishlist/count", { method: "GET" });
      const count = res?.count ?? 0;
      const badge = document.querySelector(".wishlist-count");
      if (badge) badge.textContent = count;
      window.updateNavbarCounts?.(true);
    } catch (err) {
      console.warn("Failed to update wishlist count:", err);
    }
  }

  // ----------------------------
  // Wishlist Button Wiring
  // ----------------------------
  function wireWishlistButtons() {
    document.querySelectorAll(".wishlist-btn").forEach((btn) => {
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const productId = parseInt(btn.dataset.productId, 10);
        const icon = btn.querySelector("i");
        const isActive = icon.classList.contains("fas");

        btn.disabled = true;
        try {
          if (isActive) {
            await removeFromWishlist(productId);
            icon.classList.replace("fas", "far");
          } else {
            await addToWishlist(productId);
            icon.classList.replace("far", "fas");
          }
        } finally {
          btn.disabled = false;
        }
      };
    });
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
    const shareBtn = e.target.closest(".share-btn");

    if (addBtn) handleAddToCart(addBtn.closest(".product-card"));
    if (buyBtn) handleAddToCart(buyBtn.closest(".product-card")).then(() => (window.location.href = "cart.html"));
    if (shareBtn) openShare(shareBtn.closest(".product-card"));
  });

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    if (window.auth?.initSession) {
      try { await window.auth.initSession(); } catch {}
    }
    await updateWishlistCount();
    await loadProducts();
    window.updateNavbarCounts?.(true);
  });

  // Global access
  window.toast = toast;
})();
