// product-detail.js
(function () {
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const on  = (el, evt, cb) => el && el.addEventListener(evt, cb);
  const fmtMoneyFromCents = (c) => (c == null) ? "" : `₹ ${(c/100).toFixed(2)}`;
  const fmtMoney = (r) => (r == null) ? "" : `₹ ${Number(r).toFixed(2)}`;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Mount container (common ids/classes used in your pages)
    const mount = qs('#productDetails') || qs('#product-detail') || qs('.product-detail-container');
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      mount.innerHTML = `<p>Invalid product.</p>`;
      return;
    }

    try {
      const res = await fetch(`/products/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Normalize a few fields
      const images    = Array.isArray(data.images) && data.images.length ? data.images
                        : (data.image_url ? [{role:'main', url:data.image_url, alt:data.name}] : []);
      const variants  = Array.isArray(data.variants) ? data.variants : [];
      const inv       = Array.isArray(data.inventory) ? data.inventory : [];
      const reviews   = data.reviews ?? data.reviewSummary ?? { count: 0, average: null, distribution: {} };
      const details   = data.details ?? null;

      // Build color/size sets from variants
      const colors = [...new Set(variants.map(v => (v.color||"").toLowerCase()).filter(Boolean))];
      const sizes  = [...new Set(variants.map(v => (v.size||"").toLowerCase()).filter(Boolean))];

      // Pick initial variant (first variant if any)
      let selectedColor = colors[0] || null;
      let selectedSize  = sizes[0]  || null;
      let currentVariant = pickVariant(variants, selectedColor, selectedSize) || variants[0] || null;

      // Build HTML shell
      mount.innerHTML = `
        <div class="pdp">
          <div class="pdp-grid">
            <div class="pdp-media">
              <div class="pdp-main">
                ${renderMainImage(images[0], data.name)}
              </div>
              ${renderThumbs(images)}
            </div>

            <div class="pdp-info">
              <h1 class="pdp-title">${esc(data.name || "")}</h1>
              <div class="pdp-meta">
                ${renderPriceBlock(data, currentVariant)}
                ${renderReviewSummary(reviews)}
              </div>

              ${renderVariantSelectors(colors, sizes, currentVariant)}

              <div class="pdp-cta">
                <button id="addToCartBtn" class="btn primary" ${currentVariant ? "" : "disabled"}>Add to Cart</button>
                <span id="stockBadge" class="stock-badge"></span>
              </div>

              <div class="pdp-desc">${esc(data.description || "")}</div>

              ${renderDetails(details)}
            </div>
          </div>
        </div>
      `;

      // Wire gallery thumbs
      qsa('.pdp-thumbs img', mount).forEach(img => {
        on(img, 'click', () => {
          const main = qs('.pdp-main', mount);
          main.innerHTML = renderMainImage({
            url: img.dataset.url,
            alt: img.alt,
            width: Number(img.dataset.w || 0) || null,
            height: Number(img.dataset.h || 0) || null
          }, data.name);
        });
      });

      // Wire variant selects
      const colorSel = qs('#variantColor', mount);
      const sizeSel  = qs('#variantSize', mount);
      if (colorSel) on(colorSel, 'change', () => { selectedColor = colorSel.value || null; syncVariant(); });
      if (sizeSel)  on(sizeSel,  'change', () => { selectedSize  = sizeSel.value  || null; syncVariant(); });

      // Wire add-to-cart (adjust endpoint/payload if your backend differs)
      const addBtn = qs('#addToCartBtn', mount);
      on(addBtn, 'click', async () => {
        if (!currentVariant) return;
        try {
          const payload = { variant_id: currentVariant.variantId ?? currentVariant.id ?? currentVariant, quantity: 1 };
          const resp = await fetch('/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (resp.status === 401) { alert('Please login to add to cart.'); return; }
          const msg = await resp.json().catch(() => ({}));
          alert(msg.message || 'Added to cart');
        } catch (e) {
          console.error(e);
          alert('Could not add to cart.');
        }
      });

      // Initial stock badge
      updateStockBadge(inv, currentVariant);

      // Helpers
      function syncVariant() {
        currentVariant = pickVariant(variants, selectedColor, selectedSize) || null;

        // Update price
        const priceEl = qs('#pdpPrice', mount);
        if (priceEl) priceEl.textContent = currentVariant
          ? fmtMoneyFromCents(currentVariant.priceCents)
          : (data.price != null ? fmtMoney(data.price) : '');

        // Enable/disable button
        const btn = qs('#addToCartBtn', mount);
        if (btn) btn.disabled = !currentVariant;

        // Stock badge
        updateStockBadge(inv, currentVariant);
      }

    } catch (err) {
      console.error(err);
      mount.innerHTML = `<p>Failed to load product.</p>`;
    }
  }

  // ---------- render bits ----------
  function renderMainImage(img, fallbackAlt) {
    if (!img || !img.url) return `<div class="pdp-img ph"></div>`;
    const { url, alt, width, height } = img;
    const dims = (width && height) ? `width="${width}" height="${height}"` : '';
    return `<img class="pdp-img" src="${escAttr(url)}" alt="${escAttr(alt || fallbackAlt || '')}" ${dims} />`;
  }

  function renderThumbs(images) {
    if (!images || !images.length) return '';
    return `
      <div class="pdp-thumbs">
        ${images.map(i => `
          <img src="${escAttr(i.url)}"
               alt="${escAttr(i.alt || '')}"
               data-url="${escAttr(i.url)}"
               data-w="${i.width || ''}"
               data-h="${i.height || ''}"
               loading="lazy">
        `).join('')}
      </div>
    `;
  }

  function renderPriceBlock(data, currentVariant) {
    // prefer variant price; fallback to product.price
    const priceText = currentVariant
      ? fmtMoneyFromCents(currentVariant.priceCents)
      : (data.price != null ? fmtMoney(data.price) : '');
    return `<div class="pdp-price"><span id="pdpPrice">${priceText}</span></div>`;
  }

  function renderVariantSelectors(colors, sizes, currentVariant) {
    const colorSel = colors.length ? `
      <label>Color</label>
      <select id="variantColor">${colors.map(c => `<option value="${escAttr(c)}" ${sel(c, currentVariant?.color)}>${esc(c)}</option>`).join('')}</select>
    ` : '';

    const sizeSel = sizes.length ? `
      <label>Size</label>
      <select id="variantSize">${sizes.map(s => `<option value="${escAttr(s)}" ${sel(s, currentVariant?.size)}>${esc(s)}</option>`).join('')}</select>
    ` : '';

    if (!colorSel && !sizeSel) return '';
    return `<div class="pdp-variants">${colorSel}${sizeSel}</div>`;
  }

  function renderDetails(details) {
    if (!details) return '';
    const longDesc = details.longDescription ? `<div class="pdp-longdesc">${nl2br(esc(details.longDescription))}</div>` : '';
    const specs = renderSpecs(details.specs);
    const care  = details.careHtml ? `<div class="pdp-care">${details.careHtml}</div>` : '';
    return `<div class="pdp-details">${longDesc}${specs}${care}</div>`;
  }

  function renderSpecs(specs) {
    if (!specs) return '';
    if (Array.isArray(specs)) {
      return `<ul class="pdp-specs">${specs.map(s => `<li>${esc(String(s))}</li>`).join('')}</ul>`;
    }
    if (typeof specs === 'object') {
      return `<ul class="pdp-specs">${Object.entries(specs).map(([k,v]) => `<li><strong>${esc(k)}:</strong> ${esc(String(v))}</li>`).join('')}</ul>`;
    }
    return '';
  }

  function renderReviewSummary(rev) {
    if (!rev) return '';
    const count = rev.count ?? 0;
    const avg   = (rev.average != null) ? Number(rev.average).toFixed(1) : '—';
    return `
      <div class="pdp-reviews">
        <span class="stars">${renderStars(Number(rev.average) || 0)}</span>
        <span class="avg">${avg}</span>
        <span class="count">(${count})</span>
      </div>
    `;
  }

  function renderStars(avg) {
    const full = Math.floor(avg);
    const half = (avg - full) >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '☆' : '') + '✩'.repeat(empty);
  }

  function updateStockBadge(inv, variant) {
    const el = qs('#stockBadge');
    if (!el) return;
    if (!inv || !inv.length || !variant) { el.textContent = ''; return; }
    const line = inv.find(i => (i.sku_id === (variant.variantId ?? variant.id)) ||
                               ((i.color||'').toLowerCase() === (variant.color||'').toLowerCase() &&
                                (i.size ||'').toLowerCase() === (variant.size ||'').toLowerCase()));
    if (!line || line.quantity == null) { el.textContent = ''; return; }
    el.textContent = (line.quantity > 0) ? `In stock: ${line.quantity}` : 'Out of stock';
  }

  function pickVariant(variants, color, size) {
    if (!variants || !variants.length) return null;
    const c = color ? String(color).toLowerCase() : null;
    const s = size  ? String(size).toLowerCase()  : null;
    // best match: both color+size; fallback to one
    return variants.find(v =>
      (c ? (String(v.color||'').toLowerCase() === c) : true) &&
      (s ? (String(v.size ||'').toLowerCase() === s) : true)
    ) || null;
  }

  // ---------- utils ----------
  function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }
  function escAttr(s) { return esc(s); }
  function sel(val, from) { return (String(from||'').toLowerCase() === String(val||'').toLowerCase()) ? 'selected' : ''; }
  function nl2br(s) { return String(s).replace(/\n/g, '<br>'); }
})();
