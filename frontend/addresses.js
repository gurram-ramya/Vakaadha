// frontend/addresses.js — consistent with backend schema (no redundant navbar calls)
(function () {
  const addressList = document.getElementById("address-list");
  const addAddressBtn = document.getElementById("addAddressBtn");
  const proceedBtn = document.getElementById("proceedToPayment");
  const toast = document.getElementById("toast");
  const modal = document.getElementById("addressModal");

  const modalTitle = document.getElementById("modalTitle");
  const addrName = document.getElementById("addrName");
  const addrPhone = document.getElementById("addrPhone");
  const addrLine1 = document.getElementById("addrLine1");
  const addrLine2 = document.getElementById("addrLine2");
  const addrCity = document.getElementById("addrCity");
  const addrState = document.getElementById("addrState");
  const addrZip = document.getElementById("addrZip");
  const saveBtn = document.getElementById("saveAddressBtn");
  const cancelBtn = document.getElementById("cancelModalBtn");

  let addresses = [];
  let selectedAddressId = null;
  let editingAddressId = null;

  // ---------------- Toast Helper ----------------
  function showToast(msg, bad = false, ms = 2200) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = bad ? "#b00020" : "#333";
    toast.style.opacity = "1";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toast.style.opacity = "0"), ms);
  }

  // ---------------- Modal ----------------
  function openModal(editId = null) {
    editingAddressId = editId;
    modal.classList.add("active");
    if (editId) {
      modalTitle.textContent = "Edit Address";
      const a = addresses.find((x) => x.address_id === editId || x.id === editId);
      if (a) {
        addrName.value = a.name || "";
        addrPhone.value = a.phone || "";
        addrLine1.value = a.line1 || "";
        addrLine2.value = a.line2 || "";
        addrCity.value = a.city || "";
        addrState.value = a.state || "";
        addrZip.value = a.pincode || "";
      }
    } else {
      modalTitle.textContent = "Add Address";
      [addrName, addrPhone, addrLine1, addrLine2, addrCity, addrState, addrZip].forEach(
        (i) => (i.value = "")
      );
    }
  }

  function closeModal() {
    modal.classList.remove("active");
    editingAddressId = null;
  }

  cancelBtn.addEventListener("click", closeModal);
  addAddressBtn.addEventListener("click", () => openModal());

  // ---------------- Render ----------------
  function renderAddresses() {
    addressList.innerHTML = "";
    if (!addresses.length) {
      addressList.innerHTML = `<p style="grid-column:1/-1;color:#777;">No addresses found.</p>`;
      proceedBtn.disabled = true;
      return;
    }

    addresses.forEach((addr) => {
      const card = document.createElement("div");
      card.className =
        "address-card" + (addr.address_id === selectedAddressId ? " selected" : "");
      card.innerHTML = `
        <div class="address-info">
          <strong>${addr.name}</strong><br>
          ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br>
          ${addr.city}, ${addr.state} - ${addr.pincode}<br>
          📞 ${addr.phone}
        </div>
      `;

      const actions = document.createElement("div");
      const isDefault = !!addr.is_default;
      actions.className = "address-actions";
      actions.innerHTML = `
        <button class="${isDefault ? "default-btn" : "set-default-btn"}" data-id="${addr.address_id}">
          ${isDefault ? "Default" : "Set Default"}
        </button>
        <button class="edit-btn" data-id="${addr.address_id}">Edit</button>
        <button class="delete-btn" data-id="${addr.address_id}">Delete</button>
      `;
      card.appendChild(actions);

      card.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") return;
        selectedAddressId = addr.address_id;
        renderAddresses();
        proceedBtn.disabled = false;
      });

      actions.querySelector(".edit-btn").onclick = (e) => {
        e.stopPropagation();
        openModal(addr.address_id);
      };

      actions.querySelector(".delete-btn").onclick = (e) => {
        e.stopPropagation();
        deleteAddress(addr.address_id);
      };

      actions.querySelector(".set-default-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        setDefaultAddress(addr.address_id);
      });

      addressList.appendChild(card);
    });
  }

  // ---------------- API ----------------
  async function getStableToken(maxWait = 4000) {
    let token = localStorage.getItem("auth_token");
    if (token) return token;
    if (window.auth?.initSession) await window.auth.initSession();

    const start = Date.now();
    while (!token && Date.now() - start < maxWait) {
      token = await window.auth.getToken();
      if (token) {
        localStorage.setItem("auth_token", token);
        return token;
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    return null;
  }

  async function fetchAddresses() {
    console.time("⏱ fetchAddresses");
    try {
      const token = await getStableToken();
      if (!token) {
        showToast("Please log in to manage addresses", "error");
        setTimeout(() => (window.location.href = "profile.html"), 1000);
        return;
      }

      const res = await fetch("/api/addresses", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.status === 401) {
        showToast("Please log in to manage addresses", "error");
        setTimeout(() => (window.location.href = "profile.html"), 1000);
        return;
      }

      const data = await res.json();
      addresses = Array.isArray(data) ? data : [];
      renderAddresses();
      console.timeEnd("⏱ fetchAddresses");
    } catch (err) {
      console.error("Failed to fetch addresses:", err);
      showToast("Failed to load addresses", "error");
    }
  }

  // ---------------- Save Address ----------------
  async function saveAddress() {
    const name = addrName.value.trim();
    const phone = addrPhone.value.trim();
    const line1 = addrLine1.value.trim();
    const line2 = addrLine2.value.trim() || null;
    const city = addrCity.value.trim();
    const state = addrState.value.trim();
    const pincode = addrZip.value.trim();

    if (!name || !phone || !line1 || !city || !state || !pincode) {
      return showToast("Please fill all required fields", true);
    }

    const payload = { name, phone, line1, line2, city, state, pincode };

    try {
      if (editingAddressId) {
        await apiClient.put(`/api/addresses/${editingAddressId}`, payload);
        showToast("Address updated");
      } else {
        await apiClient.post("/api/addresses", payload);
        showToast("Address added");
      }
      closeModal();
      await fetchAddresses();
    } catch (err) {
      console.error("Save failed:", err);
      showToast("Failed to save address", true);
    }
  }

  async function deleteAddress(id) {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      await apiClient.delete(`/api/addresses/${id}`);
      showToast("Address deleted");
      await fetchAddresses();
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Failed to delete address", true);
    }
  }

  async function setDefaultAddress(id) {
    try {
      await apiClient.patch(`/api/addresses/${id}/default`);
      showToast("Default address updated");
      await fetchAddresses();
    } catch (err) {
      console.error("Set default failed:", err);
      showToast("Failed to set default address", true);
    }
  }

  // ---------------- Proceed to Payment ----------------
  proceedBtn.addEventListener("click", () => {
    if (!selectedAddressId)
      return showToast("Select an address to proceed", true);
    window.location.href = `payment.html?addressId=${selectedAddressId}`;
  });

  saveBtn.addEventListener("click", saveAddress);

  // ---------------- Init ----------------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (window.auth?.initSession) await window.auth.initSession();
      const user = firebase.auth().currentUser;
      if (!user) {
        window.location.href = "profile.html";
        return;
      }
      const token = await user.getIdToken(true);
      localStorage.setItem("auth_token", token);
      await fetchAddresses();

      // ✅ Force-refresh navbar counts once token is ready
      if (window.updateNavbarCounts) window.updateNavbarCounts(true);

    } catch (err) {
      console.error("[addresses.js] init failed:", err);
      showToast("Error initializing addresses", true);
    }
  });

})();
