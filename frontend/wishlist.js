
// frontend/wishlist.js
// Wishlist UI + service integration (auth.js + api/client.js aligned)
// Goals:
// - Never hand-build auth headers or guest_id query params here
// - Use window.apiRequest for all backend calls (token + guest handled centrally)
// - Preserve existing DOM IDs and UI behavior

(function () {
  if (window.__wishlist_js_bound__) return;
  window.__wishlist_js_bound__ = true;

  const loadingEl = document.getElementById("loading");
  const guestPromptEl = document.getElementById("wishlist-guest");
  const wishlistEl = document.getElementById("wishlist-items");
  const emptyStateEl = document.getElementById("emptyState");
  const toastEl = document.getElementById("toast");

  function toast(msg, bad = false, ms = 2200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.background = bad ? "#b00020" : "#111";
    toastEl.style.opacity = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toastEl.style.opacity = "0"), ms);
  }

  function show(el) {
    if (!el) return;
    el.style.display = "";
  }

  function hide(el) {
    if (!el) return;
    el.style.display = "none";
  }

  function setLoading(on) {
    if (!loadingEl) return;
    loadingEl.style.display = on ? "" : "none";
  }

  function clearList() {
    if (wishlistEl) wishlistEl.innerHTML = "";
  }

  function showEmpty() {
    clearList();
    hide(guestPromptEl);
    show(emptyStateEl);
  }

  function showGuestPrompt() {
    clearList();
    hide(emptyStateEl);
    show(guestPromptEl);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function api(endpoint, opts) {
    if (typeof window.apiRequest !== "function") {
      throw new Error("apiRequest not available (api/client.js not loaded)");
    }
    return window.apiRequest(endpoint, opts || {});
  }

  async function primeSessionBestEffort() {
    try {
      if (window.auth && typeof window.auth.initSession === "function") {
        await window.auth.initSession();
      }
    } catch {}
  }

  function normalizeWishlistItems(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.wishlist)) return payload.wishlist;
    if (Array.isArray(payload)) return payload;
    return [];
  }

  function render(items) {
    hide(guestPromptEl);

    if (!wishlistEl) return;
    wishlistEl.innerHTML = "";

    if (!items || items.length === 0) {
      showEmpty();
      return;
    }

    hide(emptyStateEl);

    const html = items
      .map((item) => {
        const wishlistId = item.wishlist_item_id ?? item.id ?? "";
        const productId = item.product_id ?? "";
        const name = escapeHtml(item.product_name ?? item.name ?? "Product");
        const brand = escapeHtml(item.brand ?? "");
        const img = escapeHtml(item.image_url ?? item.image ?? "Images/default.jpg");
        const priceCents = Number(item.price_cents ?? item.price ?? 0);
        const price = Number.isFinite(priceCents) ? (priceCents / 100).toFixed(2) : "0.00";
        const size = escapeHtml(item.size ?? "");
        const color = escapeHtml(item.color ?? "");
        const variant = [size, color].filter(Boolean).join(" ");

        return `
          <div class="wishlist-item" data-wishlist-id="${escapeHtml(wishlistId)}" data-product-id="${escapeHtml(productId)}">
            <div class="wishlist-img">
              <img src="${img}" alt="${name}">
            </div>
            <div class="wishlist-info">
              ${brand ? `<div class="wishlist-brand">${brand}</div>` : ""}
              <div class="wishlist-name">${name}</div>
              ${variant ? `<div class="wishlist-variant">${variant}</div>` : ""}
              <div class="wishlist-price">₹${price}</div>
              <div class="wishlist-actions">
                <button class="btn-move-to-cart" type="button">Move to cart</button>
                <button class="btn-remove" type="button" aria-label="Remove">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    wishlistEl.innerHTML = html;
  }

  async function loadWishlist() {
    setLoading(true);
    hide(emptyStateEl);
    hide(guestPromptEl);

    try {
      await primeSessionBestEffort();

      const payload = await api("/api/wishlist", { method: "GET" });
      if (!payload || payload.expired) {
        showEmpty();
        return;
      }

      const items = normalizeWishlistItems(payload);
      render(items);
    } catch (err) {
      const st = Number(err?.status || 0);

      if (st === 401) {
        // In this architecture, guest wishlist should still work.
        // 401 usually indicates token/verifier mismatch; show login prompt to recover.
        showGuestPrompt();
        return;
      }

      showEmpty();
      toast("Error loading wishlist", true);
      try { console.error("[wishlist.js] loadWishlist failed:", err); } catch {}
    } finally {
      setLoading(false);
      try { window.updateNavbarCounts && window.updateNavbarCounts(true); } catch {}
    }
  }

  async function removeItem(wishlistItemId) {
    if (!wishlistItemId) return;

    try {
      await api(`/api/wishlist/${encodeURIComponent(wishlistItemId)}`, { method: "DELETE" });
      toast("Removed from wishlist");
      await loadWishlist();
    } catch (err) {
      toast("Failed to remove item", true);
      try { console.error("[wishlist.js] removeItem failed:", err); } catch {}
    } finally {
      try { window.updateNavbarCounts && window.updateNavbarCounts(true); } catch {}
    }
  }

  async function moveToCart(wishlistItemId) {
    if (!wishlistItemId) return;

    try {
      await api("/api/wishlist/move-to-cart", {
        method: "POST",
        body: { wishlist_item_id: wishlistItemId },
      });

      toast("Moved to cart");
      await loadWishlist();
    } catch (err) {
      toast("Failed to move to cart", true);
      try { console.error("[wishlist.js] moveToCart failed:", err); } catch {}
    } finally {
      try { window.updateNavbarCounts && window.updateNavbarCounts(true); } catch {}
    }
  }

  document.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".btn-remove");
    const moveBtn = e.target.closest(".btn-move-to-cart");

    if (!removeBtn && !moveBtn) return;

    const itemEl = e.target.closest(".wishlist-item");
    const wishlistId = itemEl ? itemEl.getAttribute("data-wishlist-id") : null;

    if (removeBtn) {
      removeItem(wishlistId);
      return;
    }

    if (moveBtn) {
      moveToCart(wishlistId);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    loadWishlist();
  });

  // If user navigates back after login/logout, refresh deterministically
  window.addEventListener("pageshow", () => {
    loadWishlist();
  });
})();
