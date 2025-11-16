// // Handle size selection
// const sizeButtons = document.querySelectorAll(".size-btn");
// sizeButtons.forEach(btn => {
//   btn.addEventListener("click", () => {
//     sizeButtons.forEach(b => b.classList.remove("active"));
//     btn.classList.add("active");
//   });
// });

// // Wishlist toggle
// const wishlistBtn = document.querySelector(".wishlist");
// wishlistBtn.addEventListener("click", () => {
//   wishlistBtn.textContent = wishlistBtn.textContent.includes("♡")
//     ? "♥ Added to Wishlist"
//     : "♡ Wishlist";
// });

// // Add to Cart
// document.querySelector(".add-to-cart").addEventListener("click", () => {
//   alert("Product added to cart!");
// });

// // Buy Now
// document.querySelector(".buy-now").addEventListener("click", () => {
//   alert("Proceeding to checkout...");
// });

// // Image Carousel
// const images = document.querySelectorAll(".image-container img");
// const prevBtn = document.getElementById("prevBtn");
// const nextBtn = document.getElementById("nextBtn");

// let currentIndex = 0;

// function showImage(index) {
//   images.forEach((img, i) => img.classList.toggle("active", i === index));
// }

// prevBtn.addEventListener("click", () => {
//   currentIndex = (currentIndex - 1 + images.length) % images.length;
//   showImage(currentIndex);
// });

// nextBtn.addEventListener("click", () => {
//   currentIndex = (currentIndex + 1) % images.length;
//   showImage(currentIndex);
// });

// // Show first image by default
// showImage(currentIndex);

// ============================================================
// details.js — Dynamic Product Detail (API-integrated)
// ============================================================

(async function () {
  const toastEl = document.getElementById("toast");

  // Toast utility
  function toast(msg, bad = false, ms = 2200) {
    if (!toastEl) return alert(msg);
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

  // Parse product_id from URL (?id=123)
  const params = new URLSearchParams(window.location.search);
  const productId = parseInt(params.get("id"), 10);
  if (!productId) {
    document.body.innerHTML = "<p>Invalid product ID.</p>";
    return;
  }

  // DOM targets
  const nameEl = document.querySelector(".product-name");
  const subtitleEl = document.querySelector(".product-subtitle");
  const priceEl = document.querySelector(".product-price");
  const descEl = document.querySelector(".product-description");
  const highlightsEl = document.querySelector(".highlights ul");
  const imageContainer = document.querySelector(".image-container");
  const sizeContainer = document.querySelector(".size-options");

  const addToCartBtn = document.querySelector(".add-to-cart");
  const buyNowBtn = document.querySelector(".buy-now");
  const wishlistBtn = document.querySelector(".wishlist");

  let variants = [];
  let selectedVariant = null;
  let currentImages = [];

  // ============================================================
  // Fetch Product Detail
  // ============================================================
  async function fetchProductDetail() {
    try {
      const product = await window.apiRequest(`/api/products/${productId}`);
      renderProductDetail(product);
    } catch (err) {
      console.error("Failed to load product:", err);
      toast("Failed to load product info", true);
    }
  }

  async function fetchVariants() {
    try {
      variants = await window.apiRequest(`/api/products/${productId}/variants`);
      renderVariants();
    } catch (err) {
      console.error("Failed to load variants:", err);
    }
  }

  // function renderProductDetail(prod) {
  //   nameEl.textContent = prod.name || "Unnamed Product";
  //   if (subtitleEl) subtitleEl.textContent = prod.subtitle || "";
  //   priceEl.textContent = prod.price_cents
  //     ? "₹" + (prod.price_cents / 100).toFixed(0)
  //     : "₹—";
  //   descEl.textContent = prod.description || "";

  //   if (Array.isArray(prod.highlights) && highlightsEl) {
  //     highlightsEl.innerHTML = prod.highlights
  //       .map((h) => `<li>${h}</li>`)
  //       .join("");
  //   }

  //   const imgs = prod.images || [];
  //   imageContainer.innerHTML = imgs
  //     .map(
  //       (url, i) =>
  //         `<img src="${url}" alt="${prod.name}" class="${i === 0 ? "active" : ""}">`
  //     )
  //     .join("");
  //   currentImages = Array.from(imageContainer.querySelectorAll("img"));
  //   showImage(0);
  // }
// ============================================================
// Render Product Detail
// ============================================================
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderProductDetail(prod) {
    nameEl.textContent = prod.name || "Unnamed Product";
    if (subtitleEl) subtitleEl.textContent = prod.subtitle || "";
    priceEl.textContent = prod.price_cents
      ? "₹" + (prod.price_cents / 100).toFixed(0)
      : "₹—";
    descEl.textContent = prod.description || "";

    if (Array.isArray(prod.highlights) && highlightsEl) {
      highlightsEl.innerHTML = prod.highlights.map((h) => `<li>${h}</li>`).join("");
    }

    // ----- Image logic identical to script.js -----
    let imgs = [];
    if (Array.isArray(prod.images) && prod.images.length > 0) {
      imgs = prod.images.map(
        (u) => (u.startsWith("Images/") ? u : `Images/${u}`)
      );
    } else if (prod.image_url) {
      imgs = [`Images/${prod.image_url}`];
    } else {
      imgs = ["Images/placeholder.png"];
    }

    // Encode spaces but keep relative path intact
    imgs = imgs.map((url) => encodeURI(url));

    imageContainer.innerHTML = imgs
      .map(
        (url, i) =>
          `<img src="${url}" alt="${escapeHtml(prod.name || "Product")}" class="${
            i === 0 ? "active" : ""
          }">`
      )
      .join("");

    currentImages = Array.from(imageContainer.querySelectorAll("img"));
    showImage(0);
  }


  function renderVariants() {
    if (!Array.isArray(variants) || variants.length === 0) return;
    sizeContainer.innerHTML = variants
      .map(
        (v) =>
          `<button class="size-btn" data-variant-id="${v.variant_id}">
             ${v.size_label || v.size}
           </button>`
      )
      .join("");

    sizeContainer.querySelectorAll(".size-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        sizeContainer
          .querySelectorAll(".size-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedVariant = Number(btn.getAttribute("data-variant-id"));
      });
    });
  }

  // ============================================================
  // Cart and Wishlist Integration
  // ============================================================
  addToCartBtn.onclick = async () => {
    if (!selectedVariant) return toast("Select a size first", true);
    try {
      await window.apiRequest("/api/cart", {
        method: "POST",
        body: { variant_id: selectedVariant, quantity: 1 },
      });
      toast("Added to cart");
      window.updateNavbarCounts?.(true);
    } catch (err) {
      console.error("Add to cart failed:", err);
      toast("Failed to add to cart", true);
    }
  };

  buyNowBtn.onclick = async () => {
    if (!selectedVariant) return toast("Select a size first", true);
    await addToCartBtn.onclick();
    window.location.href = "cart.html";
  };

  wishlistBtn.onclick = async () => {
    try {
      const isActive = wishlistBtn.classList.toggle("active");
      if (isActive) {
        await window.apiRequest("/api/wishlist", {
          method: "POST",
          body: { product_id: productId },
        });
        wishlistBtn.textContent = "♥ Added to Wishlist";
      } else {
        await window.apiRequest(`/api/wishlist/${productId}`, {
          method: "DELETE",
        });
        wishlistBtn.textContent = "♡ Wishlist";
      }
      await window.updateNavbarCounts?.(true);
    } catch (err) {
      console.error("Wishlist toggle failed:", err);
      toast("Wishlist update failed", true);
    }
  };

  // ============================================================
  // Carousel
  // ============================================================
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  let currentIndex = 0;

  function showImage(index) {
    if (!currentImages.length) return;
    currentImages.forEach((img, i) =>
      img.classList.toggle("active", i === index)
    );
  }

  prevBtn?.addEventListener("click", () => {
    if (!currentImages.length) return;
    currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
    showImage(currentIndex);
  });

  nextBtn?.addEventListener("click", () => {
    if (!currentImages.length) return;
    currentIndex = (currentIndex + 1) % currentImages.length;
    showImage(currentIndex);
  });

  // ============================================================
  // Init
  // ============================================================
  await fetchProductDetail();
  await fetchVariants();
})();
