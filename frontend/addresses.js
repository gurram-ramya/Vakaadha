// addresses.js
import { apiRequest } from "./api/client.js";

(function () {
  if (window.__addresses_js_bound__) return;
  window.__addresses_js_bound__ = true;

  const ENDPOINT = "/api/addresses";

  const els = {
    container: document.getElementById("address-list"),
    addBtn: document.getElementById("add-address-btn"),
    form: document.getElementById("address-form"),
    name: document.getElementById("addr-name"),
    line1: document.getElementById("addr-line1"),
    line2: document.getElementById("addr-line2"),
    city: document.getElementById("addr-city"),
    state: document.getElementById("addr-state"),
    pincode: document.getElementById("addr-pincode"),
    phone: document.getElementById("addr-phone"),
    cancelBtn: document.getElementById("cancel-address"),
    submitBtn: document.getElementById("save-address"),
    toast: document.getElementById("toast"),
  };

  let editingId = null;

  // -------------------------------
  // Toast Helper
  // -------------------------------
  function toast(msg, bad = false, ms = 2200) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.style.background = bad ? "#b00020" : "#333";
    els.toast.style.opacity = "1";
    els.toast.style.visibility = "visible";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      els.toast.style.opacity = "0";
      els.toast.style.visibility = "hidden";
    }, ms);
  }

  // -------------------------------
  // Render Address List
  // -------------------------------
  function renderAddresses(list = []) {
    if (!els.container) return;

    if (!list.length) {
      els.container.innerHTML = `<p class="empty">No saved addresses. Add one below.</p>`;
      return;
    }

    els.container.innerHTML = list
      .map(
        (a) => `
      <div class="address-card ${a.is_default ? "default" : ""}">
        <div class="address-info">
          <strong>${a.name}</strong><br>
          ${a.line1}<br>
          ${a.line2 ? a.line2 + "<br>" : ""}
          ${a.city}, ${a.state} - ${a.pincode}<br>
          Phone: ${a.phone}
        </div>
        <div class="address-actions">
          ${
            a.is_default
              ? `<button class="default-btn" disabled>Default</button>`
              : `<button class="set-default-btn" data-id="${a.address_id}">Set Default</button>`
          }
          <button class="edit-btn" data-id="${a.address_id}">Edit</button>
          <button class="delete-btn" data-id="${a.address_id}">Delete</button>
        </div>
      </div>`
      )
      .join("");
  }

  // -------------------------------
  // Load Addresses from Backend
  // -------------------------------
  async function loadAddresses() {
    try {
      const data = await apiRequest(ENDPOINT);
      if (Array.isArray(data)) renderAddresses(data);
      else renderAddresses([]);
    } catch (err) {
      console.warn("Failed to load addresses:", err);
      toast("Failed to load addresses", true);
      renderAddresses([]);
    }
  }

  // -------------------------------
  // Save (Add or Update) Address
  // -------------------------------
  async function saveAddress(e) {
    e.preventDefault();
    if (!els.form) return;
    els.submitBtn.disabled = true;

    const payload = {
      name: els.name.value.trim(),
      line1: els.line1.value.trim(),
      line2: els.line2.value.trim(),
      city: els.city.value.trim(),
      state: els.state.value.trim(),
      pincode: els.pincode.value.trim(),
      phone: els.phone.value.trim(),
    };

    try {
      if (editingId) {
        await apiRequest(`${ENDPOINT}/${editingId}`, {
          method: "PUT",
          body: payload,
        });
        toast("Address updated");
      } else {
        await apiRequest(ENDPOINT, {
          method: "POST",
          body: payload,
        });
        toast("Address added");
      }
      editingId = null;
      els.form.reset();
      els.form.classList.add("hidden");
      loadAddresses();
    } catch (err) {
      console.error("Save address failed:", err);
      toast("Failed to save address", true);
    } finally {
      els.submitBtn.disabled = false;
    }
  }

  // -------------------------------
  // Delete Address
  // -------------------------------
  async function deleteAddress(id) {
    if (!confirm("Delete this address?")) return;
    try {
      await apiRequest(`${ENDPOINT}/${id}`, { method: "DELETE" });
      toast("Address removed");
      loadAddresses();
    } catch (err) {
      console.error("Delete failed:", err);
      toast("Failed to delete address", true);
    }
  }

  // -------------------------------
  // Set Default Address
  // -------------------------------
  async function setDefaultAddress(id) {
    try {
      await apiRequest(`${ENDPOINT}/${id}/default`, { method: "POST" });
      toast("Default address set");
      loadAddresses();
    } catch (err) {
      console.error("Set default failed:", err);
      toast("Failed to set default", true);
    }
  }

  // -------------------------------
  // Edit Address (Prefill form)
  // -------------------------------
  function editAddress(data) {
    editingId = data.address_id;
    els.name.value = data.name || "";
    els.line1.value = data.line1 || "";
    els.line2.value = data.line2 || "";
    els.city.value = data.city || "";
    els.state.value = data.state || "";
    els.pincode.value = data.pincode || "";
    els.phone.value = data.phone || "";
    els.form.classList.remove("hidden");
    els.name.focus();
  }

  // -------------------------------
  // Event Delegation for Actions
  // -------------------------------
  document.addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".delete-btn");
    const editBtn = e.target.closest(".edit-btn");
    const defBtn = e.target.closest(".set-default-btn");

    if (delBtn) {
      const id = delBtn.dataset.id;
      deleteAddress(id);
    } else if (editBtn) {
      const id = editBtn.dataset.id;
      try {
        const data = await apiRequest(`${ENDPOINT}/${id}`);
        editAddress(data);
      } catch (err) {
        console.error("Fetch address for edit failed:", err);
      }
    } else if (defBtn) {
      const id = defBtn.dataset.id;
      setDefaultAddress(id);
    }
  });

  // -------------------------------
  // Wire Add and Cancel Buttons
  // -------------------------------
  els.addBtn?.addEventListener("click", () => {
    editingId = null;
    els.form.reset();
    els.form.classList.remove("hidden");
    els.name.focus();
  });

  els.cancelBtn?.addEventListener("click", () => {
    els.form.reset();
    els.form.classList.add("hidden");
    editingId = null;
  });

  els.form?.addEventListener("submit", saveAddress);

  // -------------------------------
  // Init on DOM Ready
  // -------------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await window.auth.getCurrentUser();
    if (!user) {
      toast("Please sign in to manage addresses", true);
      renderAddresses([]);
      return;
    }
    loadAddresses();
    if (window.updateNavbarCounts) window.updateNavbarCounts();
  });
})();
