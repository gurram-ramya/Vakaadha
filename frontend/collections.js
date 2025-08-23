/* collections.js
 * Catalog page client for GET /products
 * - Reads filters from the UI (search, category, attr.color/size, min/max price, sort)
 * - Calls backend, renders grid, facets, and pagination
 * - Keeps URL query params in sync (deep-linkable)
 */

(function () {
  const API_BASE = ""; // same-origin (Flask serves /products)
  const LIST_ENDPOINT = "/products";

  // ---------- small utils ----------
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on  = (el, evt, cb, opts) => el && el.addEventListener(evt, cb, opts);
  const fmtMoney = (cents) => (cents == null || isNaN(cents)) ? "" : (cents / 100).toFixed(2);
  const rupeesToCents = (val) => {
    if (val == null || val === "") return null;
    const n = Number(val);
    return isNaN(n) ? null : Math.round(n * 100);
  };
  const debounce = (fn, ms = 300) => { let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };

  // containers — defensive; if an element is missing, code skips it
  const els = {
    grid: qs("#product-grid") || qs('#productDetails') || qs('[data-products]') || qs("#products"),
    search: qs('#search') || qs('input[name="search"]'),
    category: qs('#category') || qs('select[name="category"]'),
    sort: qs('#sort') || qs('select[name="sort"]'),
    minPrice: qs('#minPrice') || qs('input[name="minPrice"]'),
    maxPrice: qs('#maxPrice') || qs('input[name="maxPrice"]'),
    filtersForm: qs("#filters") || qs('form[data-filters="true"]'),
    paginationTop: qs('#paginationTop') || qs('[data-pagination="top"]'),
    paginationBottom: qs('#paginationBottom') || qs('[data-pagination="bottom"]') || qs('#pagination'),
    facetCats: qs('#facet-categories'),
    facetColors: qs('#facet-colors'),
    facetSizes: qs('#facet-sizes'),
    facetPrice: qs('#facet-price'),
    totalBadge: qs('#resultsCount') || qs('[data-results-count]')
  };

  // ---------- query <-> UI ----------
  function readQuery() {
    const sp = new URLSearchParams(window.location.search);
    const get = (k, d = null) => sp.get(k) ?? d;
    const attrs = {};
    sp.forEach((v, k) => { if (k.startsWith("attr.")) attrs[k.slice(5)] = v.split(",").map(s=>s.trim()).filter(Boolean); });
    return {
      search: get("search") || "",
      category: get("category") || "",
      minPrice: get("minPrice"),
      maxPrice: get("maxPrice"),
      sort: get("sort") || "newest",
      page: Number(get("page") || "1"),
      pageSize: Number(get("pageSize") || "24"),
      attrs
    };
  }

  function writeQuery(q) {
    const sp = new URLSearchParams();
    if (q.search) sp.set("search", q.search);
    if (q.category) sp.set("category", q.category);
    if (q.minPrice != null && q.minPrice !== "") sp.set("minPrice", q.minPrice);
    if (q.maxPrice != null && q.maxPrice !== "") sp.set("maxPrice", q.maxPrice);
    if (q.sort) sp.set("sort", q.sort);
    if (q.page) sp.set("page", String(q.page));
    if (q.pageSize) sp.set("pageSize", String(q.pageSize));
    Object.entries(q.attrs || {}).forEach(([name, values]) => { if (values && values.length) sp.set(`attr.${name}`, values.join(",")); });
    const url = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState(null, "", url);
  }

  function uiToQuery() {
    const q = readQuery();
    if (els.search) q.search = els.search.value.trim();
    if (els.category) q.category = els.category.value;
    if (els.sort) q.sort = els.sort.value;

    const pMin = els.minPrice ? rupeesToCents(els.minPrice.value) : null;
    const pMax = els.maxPrice ? rupeesToCents(els.maxPrice.value) : null;
    q.minPrice = pMin != null ? String(pMin) : "";
    q.maxPrice = pMax != null ? String(pMax) : "";

    const attrInputs = qsa('[name^="attr."]');
    const attrs = {};
    for (const input of attrInputs) {
      const attrName = input.name.slice(5);
      if (!attrName) continue;
      if (["checkbox","radio"].includes(input.type)) {
        if (input.checked) (attrs[attrName] = attrs[attrName] || []).push(input.value);
      } else if (input.tagName === "SELECT" && input.multiple) {
        const vals = Array.from(input.selectedOptions).map(o => o.value).filter(Boolean);
        if (vals.length) attrs[attrName] = vals;
      } else if (input.value) {
        attrs[attrName] = input.value.split(",").map(s => s.trim()).filter(Boolean);
      }
    }
    q.attrs = attrs;
    q.page = 1;
    return q;
  }

  function queryToUI(q) {
    if (els.search) els.search.value = q.search || "";
    if (els.category) els.category.value = q.category || "";
    if (els.sort) els.sort.value = q.sort || "newest";
    if (els.minPrice) els.minPrice.value = q.minPrice ? (Number(q.minPrice) / 100) : "";
    if (els.maxPrice) els.maxPrice.value = q.maxPrice ? (Number(q.maxPrice) / 100) : "";

    const inputs = qsa('[name^="attr."]');
    for (const input of inputs) {
      const name = input.name.slice(5);
      const sel = (q.attrs && q.attrs[name]) || [];
      if (["checkbox","radio"].includes(input.type)) input.checked = sel.includes(input.value);
      else if (input.tagName === "SELECT" && input.multiple) Array.from(input.options).forEach(opt => opt.selected = sel.includes(opt.value));
      else input.value = sel.join(",");
    }
  }

  // ---------- fetch ----------
  async function fetchProducts(q) {
    const sp = new URLSearchParams();
    if (q.search) sp.set("search", q.search);
    if (q.category) sp.set("category", q.category);
    if (q.minPrice) sp.set("minPrice", q.minPrice);
    if (q.maxPrice) sp.set("maxPrice", q.maxPrice);
    if (q.sort) sp.set("sort", q.sort);
    sp.set("page", String(q.page || 1));
    sp.set("pageSize", String(q.pageSize || 24));
    Object.entries(q.attrs || {}).forEach(([name, values]) => { if (values && values.length) sp.set(`attr.${name}`, values.join(",")); });
    const url = `${API_BASE}${LIST_ENDPOINT}?${sp.toString()}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ---------- render ----------
  function renderProducts(data) {
    if (!els.grid) return;
    const items = data.items || [];
    els.grid.innerHTML = items.map(cardHTML).join("") || `<div class="empty">No products found. Try clearing some filters.</div>`;

    els.grid.querySelectorAll("[data-href]").forEach(n => on(n, "click", () => window.location.href = n.getAttribute("data-href")));

    if (els.totalBadge) els.totalBadge.textContent = (data.total ?? items.length).toString();

    renderFacets(data.facets || {}, readQuery());
    renderPagination(data);
  }

  function imgSrc(item) {
    return (item.image_url) || (item.image && item.image.url) || "/media/placeholder.png";
  }

  function priceLabel(item) {
    const minC = item.minPriceCents;
    const maxC = item.maxPriceCents;
    if (minC != null && maxC != null) {
      if (minC === maxC) return `₹ ${fmtMoney(minC)}`;
      return `₹ ${fmtMoney(minC)} - ₹ ${fmtMoney(maxC)}`;
    }
    if (item.price != null) return `₹ ${Number(item.price).toFixed(2)}`;
    return "";
  }

  function cardHTML(item) {
    const pid = item.productId || item.product_id;
    const href = `/product.html?id=${encodeURIComponent(pid)}`; // <-- updated target
    const image = imgSrc(item);
    const price = priceLabel(item);
    const cats = item.category ? `<div class="product-cat">${escapeHTML(item.category)}</div>` : "";
    return `
      <a class="product-card" href="${href}" data-href="${href}">
        <div class="product-thumb">
          <img src="${image}" alt="${escapeHTML(item.name || "")}" loading="lazy">
        </div>
        <div class="product-body">
          ${cats}
          <div class="product-name">${escapeHTML(item.name || "")}</div>
          <div class="product-price">${price}</div>
        </div>
      </a>
    `;
  }

  function escapeHTML(s) { return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function cssSafe(v) { return String(v).toLowerCase().replace(/[^a-z0-9_-]+/g, "-"); }

  function renderFacets(facets, q) {
    if (els.facetCats && facets.categories) {
      els.facetCats.innerHTML = facets.categories.map(c => {
        const checked = q.category === c.value ? "checked" : "";
        const id = `cat_${cssSafe(c.value)}`;
        return `
          <div class="facet-item">
            <input type="radio" name="facet-category" id="${id}" value="${escapeHTML(c.value)}" ${checked}>
            <label for="${id}">${escapeHTML(c.value)} <span class="count">(${c.count})</span></label>
          </div>
        `;
      }).join("") + `
        <div class="facet-item">
          <input type="radio" name="facet-category" id="cat_all" value="" ${q.category ? "" : "checked"}>
          <label for="cat_all">All</label>
        </div>`;
      qsa('input[name="facet-category"]', els.facetCats).forEach(input => {
        on(input, "change", () => {
          const next = readQuery(); next.category = input.value; next.page = 1; writeQuery(next); load();
        });
      });
    }

    if (els.facetColors && facets.attributes && facets.attributes.color) {
      const selected = (q.attrs && q.attrs.color) || [];
      els.facetColors.innerHTML = facets.attributes.color.map(c => {
        const id = `color_${cssSafe(c.value)}`;
        const checked = selected.includes(String(c.value).toLowerCase()) ? "checked" : "";
        return `
          <div class="facet-item">
            <input type="checkbox" id="${id}" value="${escapeHTML(c.value)}" ${checked} data-attr="color">
            <label for="${id}">${escapeHTML(c.value)} <span class="count">(${c.count})</span></label>
          </div>
        `;
      }).join("");
      qsa('input[type="checkbox"][data-attr="color"]', els.facetColors).forEach(cb => {
        on(cb, "change", () => {
          const next = readQuery();
          const set = new Set((next.attrs && next.attrs.color) || []);
          if (cb.checked) set.add(cb.value.toLowerCase()); else set.delete(cb.value.toLowerCase());
          next.attrs = { ...(next.attrs || {}), color: Array.from(set) };
          next.page = 1; writeQuery(next); load();
        });
      });
    }

    if (els.facetSizes && facets.attributes && facets.attributes.size) {
      const selected = (q.attrs && q.attrs.size) || [];
      els.facetSizes.innerHTML = facets.attributes.size.map(s => {
        const id = `size_${cssSafe(s.value)}`;
        const checked = selected.includes(String(s.value).toLowerCase()) ? "checked" : "";
        return `
          <div class="facet-item">
            <input type="checkbox" id="${id}" value="${escapeHTML(s.value)}" ${checked} data-attr="size">
            <label for="${id}">${escapeHTML(s.value)} <span class="count">(${s.count})</span></label>
          </div>
        `;
      }).join("");
      qsa('input[type="checkbox"][data-attr="size"]', els.facetSizes).forEach(cb => {
        on(cb, "change", () => {
          const next = readQuery();
          const set = new Set((next.attrs && next.attrs.size) || []);
          if (cb.checked) set.add(cb.value.toLowerCase()); else set.delete(cb.value.toLowerCase());
          next.attrs = { ...(next.attrs || {}), size: Array.from(set) };
          next.page = 1; writeQuery(next); load();
        });
      });
    }

    if (els.facetPrice && facets.price) {
      const { min, max } = facets.price;
      els.facetPrice.textContent = (min != null && max != null) ? `₹ ${fmtMoney(min)} – ₹ ${fmtMoney(max)}` : "";
    }
  }

  function renderPagination(data) {
    const page = data.page ?? (data.pagination && data.pagination.page) || 1;
    const totalPages = data.totalPages ?? (data.pagination && data.pagination.totalPages) || 1;
    const total = data.total ?? (data.pagination && data.pagination.total) || 0;

    const html = paginationHTML(page, totalPages, total);
    if (els.paginationTop) els.paginationTop.innerHTML = html;
    if (els.paginationBottom) els.paginationBottom.innerHTML = html;

    const bind = (container) => {
      if (!container) return;
      qsa("[data-page]", container).forEach(a => {
        on(a, "click", (e) => {
          e.preventDefault();
          const p = Number(a.getAttribute("data-page"));
          const q = readQuery(); q.page = p; writeQuery(q); load();
          container.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    };
    bind(els.paginationTop);
    bind(els.paginationBottom);
  }

  function paginationHTML(page, totalPages, total) {
    if (totalPages <= 1) {
      return `<div class="pagination"><span class="info">${total} item${total === 1 ? "" : "s"}</span></div>`;
    }
    const maxBtns = 5, half = Math.floor(maxBtns / 2);
    let start = Math.max(1, page - half), end = Math.min(totalPages, start + maxBtns - 1);
    if (end - start + 1 < maxBtns) start = Math.max(1, end - maxBtns + 1);

    const pageBtn = (p, label = p, disabled = false, active = false) => {
      if (disabled) return `<span class="page disabled">${label}</span>`;
      if (active) return `<span class="page active">${label}</span>`;
      return `<a href="#" class="page" data-page="${p}">${label}</a>`;
    };

    const prev = pageBtn(page - 1, "‹ Prev", page <= 1);
    const next = pageBtn(page + 1, "Next ›", page >= totalPages);
    const nums = [];
    for (let p = start; p <= end; p++) nums.push(pageBtn(p, p, false, p === page));

    return `<div class="pagination">
      <span class="info">${total} item${total === 1 ? "" : "s"}</span>
      ${prev}
      ${start > 1 ? pageBtn(1, "1") + (start > 2 ? '<span class="ellipsis">…</span>' : "") : ""}
      ${nums.join("")}
      ${end < totalPages ? (end < totalPages - 1 ? '<span class="ellipsis">…</span>' : "") + pageBtn(totalPages, totalPages) : ""}
      ${next}
    </div>`;
  }

  // ---------- events ----------
  function wireUI() {
    if (els.filtersForm) on(els.filtersForm, "submit", (e) => { e.preventDefault(); const q = uiToQuery(); writeQuery(q); load(); });
    if (els.search) on(els.search, "input", debounce(() => { const q = uiToQuery(); writeQuery(q); load(); }, 350));
    if (els.category) on(els.category, "change", () => { const q = uiToQuery(); writeQuery(q); load(); });
    if (els.sort) on(els.sort, "change", () => { const q = readQuery(); q.sort = els.sort.value; q.page = 1; writeQuery(q); load(); });

    qsa('[name^="attr."]').forEach(el => on(el, "change", () => { const q = uiToQuery(); writeQuery(q); load(); }));
    if (els.minPrice) on(els.minPrice, "change", () => { const q = uiToQuery(); writeQuery(q); load(); });
    if (els.maxPrice) on(els.maxPrice, "change", () => { const q = uiToQuery(); writeQuery(q); load(); });
  }

  async function load() {
    const q = readQuery();
    queryToUI(q);
    try {
      const data = await fetchProducts(q);
      renderProducts(data);
    } catch (err) {
      console.error(err);
      if (els.grid) els.grid.innerHTML = `<div class="error">Failed to load products.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => { wireUI(); load(); });
})();


/* this code provide the list of the collecgtions in the inventory. This code is partially designed. I have added placed holders. Will complete the code once all features added */