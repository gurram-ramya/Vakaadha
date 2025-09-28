  // Close modals on outside click
  window.onclick = function (event) {
    const aboutModal = document.getElementById('aboutModal');
    const contactModal = document.getElementById('contactModal');
    if (event.target === aboutModal) {
      closeModal('aboutModal');
    } else if (event.target === contactModal) {
      closeModal('contactModal');
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'block';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'none';
    }
  }

/* ===========================
   Wishlist and Add to Cart Functionality
   =========================== */
/** script.js **/

// (() => {
//   const CART_KEY = "vakaadha_cart_v1";
//   const WISHLIST_KEY = "vakaadha_wishlist_v1";

//   // ==============================
//   // Helpers
//   // ==============================
//   function read(key) {
//     try { return JSON.parse(localStorage.getItem(key) || "[]"); }
//     catch { return []; }
//   }
//   function write(key, val) { localStorage.setItem(key, JSON.stringify(val || [])); }
//   function safeParsePrice(str) { return parseInt(String(str).replace(/[^0-9]/g, ""), 10) || 0; }

//   // ==============================
//   // Navbar counts
//   // ==============================
//   function updateCounts() {
//     const cart = read(CART_KEY);
//     const wishlist = read(WISHLIST_KEY);
//     const cartCount = cart.reduce((sum, p) => sum + (Number(p.qty) || 1), 0);
//     const wishlistCount = wishlist.length;
//     const cartEl = document.getElementById("cartCount");
//     const wishEl = document.getElementById("wishlistCount");
//     if (cartEl) cartEl.textContent = cartCount;
//     if (wishEl) wishEl.textContent = wishlistCount;
//   }
//   window.updateCounts = updateCounts;

//   // ==============================
//   // Toast
//   // ==============================
//   function showToast(message, color = "#00c4a7") {
//     let container = document.getElementById("toast-container");
//     if (!container) {
//       container = document.createElement("div");
//       container.id = "toast-container";
//       container.style.position = "fixed";
//       container.style.top = "20px";
//       container.style.right = "20px";
//       container.style.zIndex = "9999";
//       document.body.appendChild(container);
//     }
//     const toast = document.createElement("div");
//     toast.textContent = message;
//     toast.style.background = "#fff";
//     toast.style.borderLeft = `6px solid ${color}`;
//     toast.style.padding = "8px 12px";
//     toast.style.marginTop = "8px";
//     toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
//     container.appendChild(toast);
//     setTimeout(() => toast.remove(), 2400);
//   }

//   // ==============================
//   // Extract product info from DOM
//   // ==============================
//   function extractProduct(card, trigger = null) {
//     const d = trigger?.dataset || {};
//     return {
//       id: String(d.id ?? card?.dataset.productId ?? Date.now()),
//       name: (d.name ?? card?.querySelector("h3")?.textContent ?? "Unnamed").trim(),
//       price: safeParsePrice(d.price ?? card?.querySelector(".price")?.textContent ?? "0"),
//       image: d.image ?? card?.querySelector("img")?.src ?? ""
//     };
//   }

//   // ==============================
//   // Add to Wishlist
//   // ==============================
//   function addToWishlist(product) {
//     if (!product) return;
//     const wishlist = read(WISHLIST_KEY);
//     if (!wishlist.find(p => p.id === product.id)) {
//       wishlist.push(product);
//       write(WISHLIST_KEY, wishlist);
//       updateCounts();
//       showToast("❤️ Added to wishlist");
//     } else {
//       showToast("Already in wishlist", "#ff9800");
//     }
//   }
//   window.addToWishlist = addToWishlist;

//   // ==============================
//   // Add to Cart
//   // ==============================
//   function addToCart(product, trigger = null) {
//     if (!product) return;

//     const normalized = {
//       id: String(product.id ?? Date.now()),
//       name: product.name ?? "Unnamed",
//       price: safeParsePrice(product.price ?? 0),
//       image: product.image ?? "",
//       qty: 1
//     };

//     if (trigger) {
//       const card = trigger.closest(".product-card");
//       const activeSize = card?.querySelector(".size-btn.active");
//       if (!activeSize) {
//         showToast("⚠️ Please select a size", "#ff9800");
//         return;
//       }
//       normalized.size = activeSize.textContent.trim();
//     }

//     const cart = read(CART_KEY);
//     const existing = cart.find(p => p.id === normalized.id && p.size === normalized.size);
//     if (existing) existing.qty = (Number(existing.qty) || 1) + 1;
//     else cart.push(normalized);

//     write(CART_KEY, cart);
//     updateCounts();
//     showToast(`🛒 Added ${normalized.name}${normalized.size ? ` (${normalized.size})` : ""} to cart`);
//   }
//   window.addToCart = (product) => addToCart(product, event?.target || null);

//   // ==============================
//   // Wishlist page render
//   // ==============================
//   function renderWishlistPage() {
//     const container = document.getElementById("wishlist-items");
//     if (!container) return;

//     const wishlist = read(WISHLIST_KEY);
//     if (!wishlist.length) {
//       container.innerHTML = `<p>Your wishlist is empty. <a href="index.html">Shop now</a></p>`;
//       return;
//     }

//     container.innerHTML = wishlist.map((p, i) => `
//       <div class="wishlist-card">
//         <img src="${p.image || 'images/placeholder.png'}" alt="${p.name}">
//         <h3>${p.name}</h3>
//         <p>₹${p.price}</p>
//         <div class="wishlist-actions">
//           <button class="move-to-cart-btn" data-index="${i}">Move to Cart</button>
//           <button class="remove-from-wishlist-btn" data-index="${i}">Remove</button>
//         </div>
//       </div>
//     `).join("");
//   }
//   window.renderWishlistPage = renderWishlistPage;

//   // ==============================
//   // Event delegation
//   // ==============================
//   document.addEventListener("click", (e) => {
//     // size buttons
//     const sizeBtn = e.target.closest(".size-btn");
//     if (sizeBtn) {
//       const card = sizeBtn.closest(".product-card");
//       card.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
//       sizeBtn.classList.add("active");
//       return;
//     }

//     // wishlist
//     const wishBtn = e.target.closest(".wishlist-btn");
//     if (wishBtn) {
//       const card = wishBtn.closest(".product-card");
//       const product = extractProduct(card, wishBtn);
//       addToWishlist(product);
//       const icon = wishBtn.querySelector("i");
//       if (icon) { icon.classList.remove("far"); icon.classList.add("fas"); }
//       return;
//     }

//     // add to cart
//     const cartBtn = e.target.closest(".add-to-cart, .add-to-cart-btn");
//     if (cartBtn) {
//       const card = cartBtn.closest(".product-card");
//       const product = extractProduct(card, cartBtn);
//       addToCart(product, cartBtn);
//       return;
//     }

//     // move to cart
//     const moveBtn = e.target.closest(".move-to-cart-btn");
//     if (moveBtn) {
//       const idx = +moveBtn.dataset.index;
//       const wishlist = read(WISHLIST_KEY);
//       if (idx < 0 || idx >= wishlist.length) return;

//       const item = wishlist.splice(idx, 1)[0];
//       write(WISHLIST_KEY, wishlist);

//       const cart = read(CART_KEY);
//       const found = cart.find(p => String(p.id) === String(item.id) && p.size === item.size);
//       if (found) found.qty = (Number(found.qty) || 1) + 1;
//       else cart.push({ ...item, qty: 1 });
//       write(CART_KEY, cart);

//       updateCounts();
//       renderWishlistPage();
//       showToast("Moved to cart");
//       return;
//     }

//     // remove from wishlist
//     const removeBtn = e.target.closest(".remove-from-wishlist-btn");
//     if (removeBtn) {
//       const idx = +removeBtn.dataset.index;
//       const wishlist = read(WISHLIST_KEY);
//       if (idx < 0 || idx >= wishlist.length) return;
//       wishlist.splice(idx, 1);
//       write(WISHLIST_KEY, wishlist);
//       updateCounts();
//       renderWishlistPage();
//       showToast("Removed from wishlist", "#ff4d4d");
//       return;
//     }
//   });

//   // ==============================
//   // Init
//   // ==============================
//   document.addEventListener("DOMContentLoaded", () => {
//     updateCounts();
//     renderWishlistPage();
//   });

// })();

// script.js
(() => {
  const CART_KEY = "vakaadha_cart_v1";
  const WISHLIST_KEY = "vakaadha_wishlist_v1";

  // ---------- helpers ----------
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { return []; }
  }
  function write(key, val) { localStorage.setItem(key, JSON.stringify(val || [])); }
  function safeParsePrice(str) { return parseInt(String(str).replace(/[^0-9]/g, ""), 10) || 0; }

  // ---------- toast ----------
  function showToast(message, color = "#00c4a7") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.position = "fixed";
      container.style.top = "20px";
      container.style.right = "20px";
      container.style.zIndex = "9999";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.background = "#fff";
    toast.style.borderLeft = `6px solid ${color}`;
    toast.style.padding = "8px 12px";
    toast.style.marginTop = "8px";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  }

  // ---------- extract product info from a product-card DOM node ----------
  function extractProduct(card, trigger = null) {
    const d = trigger?.dataset || {};
    const name = (d.name ?? card?.querySelector("h3")?.textContent ?? "Unnamed").trim();
    const price = safeParsePrice(d.price ?? card?.querySelector(".price")?.textContent ?? "0");
    const image = d.image ?? card?.querySelector("img")?.src ?? "";

    // create stable id from name+price+image
    const baseId = `${name}-${price}-${image}`;
    return {
      id: baseId, // stable unique ID for same product
      name,
      price,
      image
    };
  }


  // ---------- unified "update" (calls navbar's update function if present) ----------
  function updateCountsFallback() {
    // fallback local update (only used if navbar.js wasn't loaded)
    const cart = read(CART_KEY);
    const wishlist = read(WISHLIST_KEY);
    const cartCount = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0) : 0;
    const wishlistCount = Array.isArray(wishlist) ? wishlist.length : 0;
    const cartEl = document.getElementById("cartCount");
    const wishEl = document.getElementById("wishlistCount");
    if (cartEl) cartEl.textContent = cartCount;
    if (wishEl) wishEl.textContent = wishlistCount;
  }

  function updateNavbarCountsSafe() {
    if (typeof window.updateNavbarCounts === "function") window.updateNavbarCounts();
    else updateCountsFallback();
  }

  // ---------- Add to wishlist ----------
  function addToWishlist(product) {
    if (!product) return;
    const wishlist = read(WISHLIST_KEY);

    const size = product.size ? String(product.size).trim() : "";

    // Check if same product+size already exists
    const exists = wishlist.find(
      p => p.id === product.id && (p.size || "") === size
    );

    if (exists) {
      showToast("⚠️ Already in wishlist", "#ff9800");
      return;
    }

    wishlist.push({ ...product, size });
    write(WISHLIST_KEY, wishlist);
    updateNavbarCountsSafe();
    showToast("❤️ Added to wishlist");
  }


  // ---------- Add to cart (enforces size selection when trigger exists) ----------
  function addToCart(product, trigger = null) {
    if (!product) return;

    const normalized = {
      id: String(product.id ?? Date.now()),
      name: product.name ?? "Unnamed",
      price: safeParsePrice(product.price ?? 0),
      image: product.image ?? "",
      qty: 1
    };

    // if a trigger (button inside product card) is supplied, require size selection
    if (trigger) {
      const card = trigger.closest(".product-card");
      const activeSize = card?.querySelector(".size-btn.active");
      if (!activeSize) {
        showToast("⚠️ Please select a size", "#ff9800");
        return;
      }
      normalized.size = activeSize.textContent.trim();
    }

    // if no trigger we still allow adding (useful for programmatic adds), but it's strongly recommended to provide a trigger
    const cart = read(CART_KEY);

    const existing = cart.find(p => String(p.id) === normalized.id && (p.size || "") === (normalized.size || ""));
    if (existing) existing.qty = (Number(existing.qty) || 1) + 1;
    else cart.push(normalized);

    write(CART_KEY, cart);
    updateNavbarCountsSafe();
    showToast(`🛒 Added ${normalized.name}${normalized.size ? ` (${normalized.size})` : ""} to cart`);
  }
  // expose a safe global method — prefer event-delegation flow where trigger is available
  if (!window.addToCart) window.addToCart = (product) => addToCart(product, null);

  // ---------- Wishlist page renderer (works if wishlist section present) ----------
  function renderWishlistPage() {
    const container = document.getElementById("wishlist-items");
    if (!container) return;
    const wishlist = read(WISHLIST_KEY);
    if (!wishlist.length) {
      container.innerHTML = `<p>Your wishlist is empty. <a href="index.html">Shop now</a></p>`;
      return;
    }
    container.innerHTML = wishlist.map((p, i) => `
      <div class="wishlist-card">
        <img src="${p.image || 'images/placeholder.png'}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>₹${p.price}</p>
        <div class="wishlist-actions">
          <button class="move-to-cart-btn" data-index="${i}">Move to Cart</button>
          <button class="remove-from-wishlist-btn" data-index="${i}">Remove</button>
        </div>
      </div>
    `).join("");
  }
  // expose so wishlist page can call it
  window.renderWishlistPage = renderWishlistPage;

// ---------- Buy Now ----------
function buyNow(product, trigger = null) {
  if (!product) return;

  const normalized = {
    id: String(product.id ?? Date.now()),
    name: product.name ?? "Unnamed",
    price: safeParsePrice(product.price ?? 0),
    image: product.image ?? "",
    qty: 1
  };

  // require size if coming from product card
  if (trigger) {
    const card = trigger.closest(".product-card");
    const activeSize = card?.querySelector(".size-btn.active");
    if (!activeSize) {
      showToast("⚠️ Please select a size", "#ff9800");
      return;
    }
    normalized.size = activeSize.textContent.trim();
  }

  // Save this product only in sessionStorage
  sessionStorage.setItem("buyNowItem", JSON.stringify(normalized));

  // Redirect to addresses
  window.location.href = "addresses.html";
}

window.buyNow = (product) => buyNow(product, event?.target || null);


  // ---------- event delegation for product / wishlist actions ----------
  document.addEventListener("click", (e) => {
    // size select
    const sizeBtn = e.target.closest(".size-btn");
    if (sizeBtn) {
      const card = sizeBtn.closest(".product-card");
      if (!card) return;
      card.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
      sizeBtn.classList.add("active");
      return;
    }

    // // wishlist button inside card
    // const wishBtn = e.target.closest(".wishlist-btn");
    // if (wishBtn) {
    //   const card = wishBtn.closest(".product-card");
    //   const product = extractProduct(card, wishBtn);

    //   // check if already in wishlist
    //   const wishlist = read(WISHLIST_KEY);
    //   const exists = wishlist.find(p => p.id === product.id);

    //   const icon = wishBtn.querySelector("i");

    //   if (exists) {
    //     showToast("⚠️ Already in wishlist", "#ff9800");
    //     if (icon) { icon.classList.remove("far"); icon.classList.add("fas"); }
    //   } else {
    //     addToWishlist(product);
    //     if (icon) { icon.classList.remove("far"); icon.classList.add("fas"); }
    //   }
    //   return;
    // }

    // wishlist button inside card
    const wishBtn = e.target.closest(".wishlist-btn");
    if (wishBtn) {
      const card = wishBtn.closest(".product-card");
      const product = extractProduct(card, wishBtn);
      const wishlist = read(WISHLIST_KEY);

      const icon = wishBtn.querySelector("i");

      // Check if product exists
      const index = wishlist.findIndex(p => p.id === product.id);

      if (index > -1) {
        // Already exists -> remove
        wishlist.splice(index, 1);
        write(WISHLIST_KEY, wishlist);
        updateNavbarCountsSafe();
        if (icon) { icon.classList.remove("fas"); icon.classList.add("far"); }
        showToast("Removed from wishlist", "#ff4d4d");
      } else {
        // Doesn't exist -> add
        wishlist.push(product);
        write(WISHLIST_KEY, wishlist);
        updateNavbarCountsSafe();
        if (icon) { icon.classList.remove("far"); icon.classList.add("fas"); }
        showToast("❤️ Added to wishlist");
      }
      return;
    }



    // add-to-cart buttons
    const cartBtn = e.target.closest(".add-to-cart, .add-to-cart-btn");
    if (cartBtn) {
      const card = cartBtn.closest(".product-card");
      const product = extractProduct(card, cartBtn);
      // addToCart will check size if trigger is provided
      addToCart(product, cartBtn);
      return;
    }

    // buy now button
    const buyBtn = e.target.closest(".buy-now");
    if (buyBtn) {
      const card = buyBtn.closest(".product-card");
      const product = extractProduct(card, buyBtn);
      buyNow(product, buyBtn);
      return;
    }


    // wishlist page: move -> cart
    const moveBtn = e.target.closest(".move-to-cart-btn");
    if (moveBtn) {
      const idx = +moveBtn.dataset.index;
      const wishlist = read(WISHLIST_KEY);
      if (idx < 0 || idx >= wishlist.length) return;
      const item = wishlist.splice(idx, 1)[0];
      write(WISHLIST_KEY, wishlist);

      const cart = read(CART_KEY);
      const found = cart.find(p => String(p.id) === String(item.id) && (p.size || "") === (item.size || ""));
      if (found) found.qty = (Number(found.qty) || 1) + 1;
      else cart.push({ ...item, qty: 1 });

      write(CART_KEY, cart);
      updateNavbarCountsSafe();
      renderWishlistPage();
      showToast("Moved to cart");
      return;
    }

    // wishlist page: remove
    const removeBtn = e.target.closest(".remove-from-wishlist-btn");
    if (removeBtn) {
      const idx = +removeBtn.dataset.index;
      const wishlist = read(WISHLIST_KEY);
      if (idx < 0 || idx >= wishlist.length) return;
      wishlist.splice(idx, 1);
      write(WISHLIST_KEY, wishlist);
      updateNavbarCountsSafe();
      renderWishlistPage();
      showToast("Removed from wishlist", "#ff4d4d");
      return;
    }
  });

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    updateNavbarCountsSafe();
    renderWishlistPage();
  });

})();

//SHARE BUTTONS
document.querySelectorAll(".share-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Get product info
    const card = e.target.closest(".product-card");
    const productName = card.querySelector("h3").innerText;
    const productUrl = window.location.origin + "/product.html?name=" + encodeURIComponent(productName);

    // Native Web Share API (mobile)
    if (navigator.share) {
      navigator.share({
        title: productName,
        text: "Check out this product on VAKAADHA!",
        url: productUrl
      }).catch(err => console.log("Share cancelled:", err));
    } else {
      // Fallback → open custom share modal
      openModal("shareModal");

      // Set share links
      document.getElementById("share-whatsapp").href =
        `https://wa.me/?text=${encodeURIComponent(productName + " - " + productUrl)}`;
      document.getElementById("share-facebook").href =
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
      document.getElementById("share-twitter").href =
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(productName)}&url=${encodeURIComponent(productUrl)}`;

      // Copy link
      document.getElementById("copy-link").onclick = () => {
        navigator.clipboard.writeText(productUrl).then(() => {
          alert("Link copied to clipboard!");
        });
      };
    }
  });
});
