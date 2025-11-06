/* admin.js — Vakaadha Admin single entry
   Hard dependencies: pages include this file at the end of <body>.
   DB/API: same backend; endpoints under /admin/*
   Authoritative redirects: admin-login.html ↔ adminportal.html
*/

/* =========================
   Core Config + Utilities
   ========================= */
const ADMIN_API = (window.ADMIN_API && typeof window.ADMIN_API === "object")
  ? window.ADMIN_API
  : {
      baseUrl: "", // same origin
      endpoints: {
        login: "/admin/login",
        products: "/admin/products",
        productById: (id) => `/admin/products/${encodeURIComponent(id)}`,
        orders: "/admin/orders",
        orderById: (id) => `/admin/orders/${encodeURIComponent(id)}`,
        promotions: "/admin/promotions",
        promotionById: (id) => `/admin/promotions/${encodeURIComponent(id)}`,
        mediaList: "/admin/media",
        mediaUpload: "/admin/media/upload",
        mediaById: (id) => `/admin/media/${encodeURIComponent(id)}`,
        analyticsSummary: "/admin/analytics/summary",
      },
    };

const AdminStore = {
  tokenKey: "vakaadha_admin_token",
  get token() { return localStorage.getItem(this.tokenKey); },
  set token(v) { v ? localStorage.setItem(this.tokenKey, v) : localStorage.removeItem(this.tokenKey); },
  logout() { this.token = ""; },
};

async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${ADMIN_API.baseUrl}${path}`;
  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (AdminStore.token) headers.set("Authorization", `Bearer ${AdminStore.token}`);
  const res = await fetch(url, { credentials: "same-origin", ...opts, headers });
  if (res.status === 204) return null;
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function guardAuth() {
  const protectedPages = [
    "/adminportal.html",
    "/admin-products.html",
    "/admin-orders.html",
    "/admin-promotions.html",
    "/admin-media.html",
    "/admin-analytics.html",
  ];
  const path = location.pathname.split("/").pop();
  if (protectedPages.includes(`/${path}`) && !AdminStore.token) {
    location.replace("./admin-login.html");
  }
}

function wireLogoutIfPresent() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", () => {
    AdminStore.logout();
    location.replace("./admin-login.html");
  });
}

/* =========================
   Page Router
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  guardAuth();
  wireLogoutIfPresent();

  const page = location.pathname.split("/").pop().toLowerCase();
  switch (page) {
    case "admin-login.html": initLoginPage(); break;                 // :contentReference[oaicite:7]{index=7}
    case "adminportal.html": initPortalPage(); break;                 // :contentReference[oaicite:8]{index=8}
    case "admin-products.html": initProductsPage(); break;            // :contentReference[oaicite:9]{index=9}
    case "admin-orders.html": initOrdersPage(); break;                // :contentReference[oaicite:10]{index=10}
    case "admin-promotions.html": initPromotionsPage(); break;        // :contentReference[oaicite:11]{index=11}
    case "admin-media.html": initMediaPage(); break;                  // :contentReference[oaicite:12]{index=12}
    case "admin-analytics.html": initAnalyticsPage(); break;          // :contentReference[oaicite:13]{index=13}
    default: break;
  }
});

/* =========================
   Login
   ========================= */
function initLoginPage() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return; // defensive
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    // POST /admin/login {email, password} -> {token}
    try {
      const data = await apiFetch(ADMIN_API.endpoints.login, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!data || !data.token) throw new Error("Missing token");
      AdminStore.token = data.token;
      location.replace("./adminportal.html");
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  });
}

/* =========================
   Portal
   ========================= */
function initPortalPage() {
  // Page is link hub; guard already applied. Nothing else mandatory. :contentReference[oaicite:14]{index=14}
}

/* =========================
   Products
   ========================= */
function initProductsPage() {
  const form = document.getElementById("productForm");
  const table = document.querySelector("#productsTable tbody");
  const preview = document.getElementById("imagePreview");
  const imageInput = document.getElementById("productImage");
  if (!form || !table) return;

  // Image preview
  if (imageInput && preview) {
    imageInput.addEventListener("change", () => {
      const f = imageInput.files && imageInput.files[0];
      if (!f) { preview.style.display = "none"; return; }
      const r = new FileReader();
      r.onload = () => { preview.src = r.result; preview.style.display = "block"; };
      r.readAsDataURL(f);
    });
  }

  // Load list
  (async function loadProducts() {
    try {
      const list = await apiFetch(ADMIN_API.endpoints.products, { method: "GET" });
      renderProducts(table, Array.isArray(list) ? list : (list.items || []));
    } catch (err) {
      console.error("Products load error:", err.message);
    }
  })();

  // Create/Update
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = collectProductForm();
    const id = payload.id;
    try {
      let result;
      if (imageInput && imageInput.files && imageInput.files[0]) {
        // multipart if image provided
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, String(v)); });
        fd.delete("id");
        fd.append("image", imageInput.files[0]);
        result = await apiFetch(id ? ADMIN_API.endpoints.productById(id) : ADMIN_API.endpoints.products, {
          method: id ? "PUT" : "POST",
          body: fd,
          headers: { /* Content-Type omitted for FormData */ },
        });
      } else {
        result = await apiFetch(id ? ADMIN_API.endpoints.productById(id) : ADMIN_API.endpoints.products, {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
      }
      upsertRow(table, result);
      form.reset();
      if (preview) { preview.style.display = "none"; preview.src = ""; }
      document.getElementById("productId").value = "";
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });

  function collectProductForm() {
    const id = document.getElementById("productId").value || undefined;
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value.trim();
    const brand = document.getElementById("productBrand").value.trim();
    const tags = document.getElementById("productTags").value.split(",").map(s => s.trim()).filter(Boolean);
    const price = parseFloat(document.getElementById("productPrice").value);
    const discount = parseFloat(document.getElementById("productDiscount").value || "0");
    const tax = parseFloat(document.getElementById("productTax").value || "0");
    const sizes = document.getElementById("productSizes").value.split(",").map(s => s.trim()).filter(Boolean);
    const colors = document.getElementById("productColors").value.split(",").map(s => s.trim()).filter(Boolean);
    const sku = document.getElementById("productSKU").value.trim();
    const stock = document.getElementById("productStock").value;
    return { id, name, category, brand, tags, price, discount, tax, sizes, colors, sku, stock };
  }

  function renderProducts(tbody, products) {
    tbody.innerHTML = "";
    products.forEach(p => tbody.appendChild(productRow(p)));
  }

  function upsertRow(tbody, p) {
    const tr = tbody.querySelector(`tr[data-id="${CSS.escape(String(p.id))}"]`);
    if (tr) {
      const fresh = productRow(p);
      tr.replaceWith(fresh);
    } else {
      tbody.prepend(productRow(p));
    }
  }

  function productRow(p) {
    const tr = document.createElement("tr");
    tr.dataset.id = p.id;
    const imgSrc = p.image_url || p.image || "";
    tr.innerHTML = `
      <td>${imgSrc ? `<img src="${imgSrc}" alt="${escapeHtml(p.name)}" style="max-width:60px">` : ""}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category || "")}</td>
      <td>${Number(p.price || 0).toFixed(2)}</td>
      <td>${escapeHtml(p.stock || "")}</td>
      <td>
        <button class="edit">Edit</button>
        <button class="del">Delete</button>
      </td>
    `;
    tr.querySelector(".edit").addEventListener("click", () => {
      document.getElementById("productId").value = p.id || "";
      document.getElementById("productName").value = p.name || "";
      document.getElementById("productCategory").value = p.category || "";
      document.getElementById("productBrand").value = p.brand || "";
      document.getElementById("productTags").value = Array.isArray(p.tags) ? p.tags.join(",") : (p.tags || "");
      document.getElementById("productPrice").value = p.price || 0;
      document.getElementById("productDiscount").value = p.discount || 0;
      document.getElementById("productTax").value = p.tax || 0;
      document.getElementById("productSizes").value = Array.isArray(p.sizes) ? p.sizes.join(",") : (p.sizes || "");
      document.getElementById("productColors").value = Array.isArray(p.colors) ? p.colors.join(",") : (p.colors || "");
      document.getElementById("productSKU").value = p.sku || "";
      document.getElementById("productStock").value = p.stock || "In Stock";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    tr.querySelector(".del").addEventListener("click", async () => {
      if (!confirm("Delete this product?")) return;
      try {
        await apiFetch(ADMIN_API.endpoints.productById(p.id), { method: "DELETE" });
        tr.remove();
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
      }
    });
    return tr;
  }
}

/* =========================
   Orders
   ========================= */
function initOrdersPage() {
  const tbody = document.getElementById("ordersBody");
  const filter = document.getElementById("orderStatusFilter");
  if (!tbody || !filter) return;

  let ordersCache = [];

  (async function loadOrders() {
    try {
      const list = await apiFetch(ADMIN_API.endpoints.orders, { method: "GET" });
      ordersCache = Array.isArray(list) ? list : (list.items || []);
      renderOrders(ordersCache);
    } catch (err) {
      console.error("Orders load error:", err.message);
    }
  })();

  filter.addEventListener("change", () => {
    const val = filter.value;
    if (val === "all") return renderOrders(ordersCache);
    renderOrders(ordersCache.filter(o => (o.status || "").toLowerCase() === val));
  });

  function renderOrders(items) {
    tbody.innerHTML = "";
    items.forEach(o => tbody.appendChild(orderRow(o)));
  }

  function orderRow(o) {
    const tr = document.createElement("tr");
    tr.dataset.id = o.id;
    tr.innerHTML = `
      <td>#${escapeHtml(String(o.id))}</td>
      <td>${escapeHtml(o.customer_name || o.customer || "")}</td>
      <td>${escapeHtml(o.product_summary || "")}</td>
      <td>${Number(o.amount || 0).toFixed(2)}</td>
      <td><span class="pay-status ${clsPay(o.payment_status)}">${escapeHtml(o.payment_status || "")}</span></td>
      <td><span class="ship-status ${clsShip(o.shipment_status)}">${escapeHtml(o.shipment_status || "")}</span></td>
      <td><span class="order-status ${clsOrder(o.status)}">${escapeHtml(o.status || "")}</span></td>
      <td class="order-controls">
        <button class="btn-update">Update</button>
        <button class="btn-refund">Refund</button>
      </td>
    `;
    tr.querySelector(".btn-update").addEventListener("click", async () => {
      const next = prompt("Set order status (active|fulfilled|cancelled):", (o.status || "active"));
      if (!next) return;
      try {
        const updated = await apiFetch(ADMIN_API.endpoints.orderById(o.id), {
          method: "PUT",
          body: JSON.stringify({ status: next }),
        });
        tr.replaceWith(orderRow(updated));
      } catch (err) {
        alert(`Update failed: ${err.message}`);
      }
    });
    tr.querySelector(".btn-refund").addEventListener("click", async () => {
      if (!confirm("Issue refund?")) return;
      try {
        const updated = await apiFetch(ADMIN_API.endpoints.orderById(o.id), {
          method: "POST",
          body: JSON.stringify({ action: "refund" }),
        });
        tr.replaceWith(orderRow(updated));
      } catch (err) {
        alert(`Refund failed: ${err.message}`);
      }
    });
    return tr;
  }

  function clsPay(s) { s = String(s || "").toLowerCase(); return s.includes("paid") ? "paid" : (s.includes("pending") ? "pending" : ""); }
  function clsShip(s){ s = String(s || "").toLowerCase(); if (s.includes("processing")) return "processing"; if (s.includes("shipped")) return "shipped"; if (s.includes("delivered")) return "delivered"; return ""; }
  function clsOrder(s){ s = String(s || "").toLowerCase(); if (s.includes("active")) return "active"; if (s.includes("fulfilled")) return "fulfilled"; if (s.includes("cancelled")) return "cancelled"; return ""; }
}

/* =========================
   Promotions
   ========================= */
function initPromotionsPage() {
  // Honor existing inline handlers if present (the HTML page included demo JS).
  const form = document.getElementById("couponForm");
  const table = document.getElementById("promoTableBody");
  if (!form || !table) return;

  (async function loadPromos() {
    try {
      const list = await apiFetch(ADMIN_API.endpoints.promotions, { method: "GET" });
      renderPromos(Array.isArray(list) ? list : (list.items || []));
    } catch (err) {
      // fall through; page may be using inline demo
      console.warn("Promotions load error:", err.message);
    }
  })();

  // Intercept submit to persist to backend too.
  if (!form.__adminHooked) {
    form.addEventListener("submit", async (e) => {
      // If inline script already did DOM append, we still persist to server.
      try {
        const payload = gatherPromoForm();
        const created = await apiFetch(ADMIN_API.endpoints.promotions, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        // ensure row exists or is updated
        const codeCell = Array.from(table.querySelectorAll("tr td:first-child")).find(td => td.textContent.trim() === created.code);
        if (!codeCell) appendPromoRow(created);
      } catch (err) {
        alert(`Save coupon failed: ${err.message}`);
      }
    });
    form.__adminHooked = true;
  }

  function renderPromos(items) {
    table.innerHTML = "";
    items.forEach(appendPromoRow);
  }

  function appendPromoRow(p) {
    const tr = document.createElement("tr");
    tr.dataset.id = p.id || p.code;
    tr.innerHTML = `
      <td>${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.type)}</td>
      <td>${escapeHtml(String(p.value))}</td>
      <td>${escapeHtml(p.start_date)} → ${escapeHtml(p.end_date)}</td>
      <td>${escapeHtml(p.usage_limit == null ? "Unlimited" : String(p.usage_limit))}</td>
      <td>${escapeHtml(p.apply_to)}</td>
      <td><button class="btn danger">Delete</button></td>
    `;
    tr.querySelector(".btn.danger").addEventListener("click", async () => {
      if (!confirm("Delete coupon?")) return;
      try {
        await apiFetch(ADMIN_API.endpoints.promotionById(p.id || p.code), { method: "DELETE" });
        tr.remove();
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
      }
    });
    table.appendChild(tr);
  }

  function gatherPromoForm() {
    const code = document.getElementById("code").value.trim();
    const type = document.getElementById("type").value;
    const value = Number(document.getElementById("value").value);
    const start_date = document.getElementById("startDate").value;
    const end_date = document.getElementById("endDate").value;
    const usage_limit_raw = document.getElementById("usageLimit").value;
    const usage_limit = usage_limit_raw === "" ? null : Number(usage_limit_raw);
    const apply_to = document.getElementById("applyTo").value;
    // Optional extra field:
    const categoryName = document.getElementById("categoryName")?.value?.trim();
    const productId = document.getElementById("productId")?.value?.trim();

    const scope = apply_to === "category" ? { category: categoryName }
                : apply_to === "product"  ? { product_id: productId }
                : {};
    return { code, type, value, start_date, end_date, usage_limit, apply_to, ...scope };
  }
}

/* =========================
   Media
   ========================= */
function initMediaPage() {
  const uploadBtn = document.getElementById("uploadBtn");
  const mediaUpload = document.getElementById("mediaUpload");
  const gallery = document.getElementById("gallery");
  if (!uploadBtn || !mediaUpload || !gallery) return;

  (async function loadMedia() {
    try {
      const list = await apiFetch(ADMIN_API.endpoints.mediaList, { method: "GET" });
      renderGallery(Array.isArray(list) ? list : (list.items || []));
    } catch (err) {
      console.warn("Media load error:", err.message);
    }
  })();

  uploadBtn.addEventListener("click", async () => {
    const files = Array.from(mediaUpload.files || []);
    if (files.length === 0) { alert("Select images to upload."); return; }
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      const created = await apiFetch(ADMIN_API.endpoints.mediaUpload, { method: "POST", body: fd, headers: {} });
      if (created && created.items) renderGallery(created.items);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      mediaUpload.value = "";
    }
  });

  function renderGallery(items) {
    if (!items.length) { gallery.innerHTML = `<p class="empty-text">No media uploaded yet.</p>`; return; }
    gallery.innerHTML = items.map((img, i) => `
      <div class="media-card" data-id="${escapeHtml(String(img.id || i))}">
        <img src="${img.url}" alt="${escapeHtml(img.name || "image")}">
        <div class="media-controls">
          <input type="file" id="replace-${i}" accept="image/*" hidden>
          <button data-action="replace" data-i="${i}">Replace</button>
          <button class="delete" data-action="delete" data-i="${i}">Delete</button>
        </div>
        <span class="filename">${escapeHtml(img.name || "")}</span>
      </div>
    `).join("");

    gallery.querySelectorAll("button[data-action='replace']").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = btn.dataset.i;
        const input = document.getElementById(`replace-${i}`);
        if (!input) return;
        input.onchange = async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const id = gallery.querySelectorAll(".media-card")[i].dataset.id;
            const fd = new FormData();
            fd.append("file", file);
            const updated = await apiFetch(ADMIN_API.endpoints.mediaById(id), { method: "PUT", body: fd, headers: {} });
            // simple refresh
            const list = await apiFetch(ADMIN_API.endpoints.mediaList, { method: "GET" });
            renderGallery(Array.isArray(list) ? list : (list.items || []));
          } catch (err) {
            alert(`Replace failed: ${err.message}`);
          } finally { input.value = ""; }
        };
        input.click();
      });
    });

    gallery.querySelectorAll("button[data-action='delete']").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this image?")) return;
        const i = btn.dataset.i;
        const card = gallery.querySelectorAll(".media-card")[i];
        const id = card.dataset.id;
        try {
          await apiFetch(ADMIN_API.endpoints.mediaById(id), { method: "DELETE" });
          card.remove();
        } catch (err) {
          alert(`Delete failed: ${err.message}`);
        }
      });
    });
  }
}

/* =========================
   Analytics
   ========================= */
function initAnalyticsPage() {
  // This page already renders charts with inline script.
  // Augment stats if backend summary is available.
  const rangeSales = document.getElementById("rangeSales");
  const activeUsers = document.getElementById("activeUsers");
  const lowStock = document.getElementById("lowStock");
  if (!rangeSales || !activeUsers || !lowStock) return;

  (async function hydrate() {
    try {
      const s = await apiFetch(ADMIN_API.endpoints.analyticsSummary, { method: "GET" });
      if (s && typeof s.total_sales === "number") rangeSales.textContent = `₹${s.total_sales.toLocaleString()}`;
      if (s && typeof s.active_users === "number") activeUsers.textContent = String(s.active_users);
      if (s && typeof s.low_stock_count === "number") lowStock.textContent = String(s.low_stock_count);
    } catch (err) {
      console.warn("Analytics hydrate error:", err.message);
    }
  })();
}

/* =========================
   Helpers
   ========================= */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
