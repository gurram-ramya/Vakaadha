// // addresses.js — modal-based redesign for addresses.html
// // import { apiRequest } from "./api/client.js";

// const apiRequest = window.apiRequest;
// if (typeof apiRequest !== "function") {
//   console.error("apiRequest not found — ensure client.js loaded before addresses.js");
//   return;
// }

// (function () {
//   if (window.__addresses_js_bound__) return;
//   window.__addresses_js_bound__ = true;

//   const ENDPOINT = "/api/addresses";
//   let editingId = null;
//   let selectedId = null;

//   // -------------------------------
//   // Element references
//   // -------------------------------
//   const els = {
//     container: document.getElementById("address-list"),
//     addBtn: document.getElementById("addAddressBtn"),
//     proceedBtn: document.getElementById("proceedToPayment"),
//     toast: document.getElementById("toast"),

//     // Modal
//     modal: document.getElementById("addressModal"),
//     modalTitle: document.getElementById("modalTitle"),
//     name: document.getElementById("addrName"),
//     phone: document.getElementById("addrPhone"),
//     line1: document.getElementById("addrLine1"),
//     line2: document.getElementById("addrLine2"),
//     city: document.getElementById("addrCity"),
//     state: document.getElementById("addrState"),
//     zip: document.getElementById("addrZip"),
//     saveBtn: document.getElementById("saveAddressBtn"),
//     cancelBtn: document.getElementById("cancelModalBtn"),
//   };

//   // -------------------------------
//   // Toast helper
//   // -------------------------------
//   function toast(msg, bad = false, ms = 2200) {
//     let t = els.toast;
//     if (!t) {
//       t = document.createElement("div");
//       t.id = "toast";
//       Object.assign(t.style, {
//         position: "fixed",
//         bottom: "20px",
//         left: "50%",
//         transform: "translateX(-50%)",
//         background: "#333",
//         color: "#fff",
//         padding: "10px 16px",
//         borderRadius: "6px",
//         opacity: "0",
//         transition: "opacity .3s ease",
//         zIndex: "9999",
//       });
//       document.body.appendChild(t);
//       els.toast = t;
//     }
//     t.textContent = msg;
//     t.style.background = bad ? "#b00020" : "#333";
//     t.style.opacity = "1";
//     clearTimeout(toast._t);
//     toast._t = setTimeout(() => (t.style.opacity = "0"), ms);
//   }

//   // -------------------------------
//   // Modal controls
//   // -------------------------------
//   function openModal(editMode = false, data = null) {
//     els.modalTitle.textContent = editMode ? "Edit Address" : "Add Address";
//     if (editMode && data) {
//       editingId = data.address_id;
//       els.name.value = data.name || "";
//       els.phone.value = data.phone || "";
//       els.line1.value = data.line1 || "";
//       els.line2.value = data.line2 || "";
//       els.city.value = data.city || "";
//       els.state.value = data.state || "";
//       els.zip.value = data.pincode || "";
//     } else {
//       editingId = null;
//       els.name.value = "";
//       els.phone.value = "";
//       els.line1.value = "";
//       els.line2.value = "";
//       els.city.value = "";
//       els.state.value = "";
//       els.zip.value = "";
//     }
//     els.modal.classList.add("active");
//   }

//   function closeModal() {
//     els.modal.classList.remove("active");
//     editingId = null;
//   }

//   // -------------------------------
//   // Render Address List
//   // -------------------------------
//   function renderAddresses(list = []) {
//     if (!els.container) return;
//     if (!list.length) {
//       els.container.innerHTML = `<p class="empty">No saved addresses. Add one below.</p>`;
//       els.proceedBtn.disabled = true;
//       return;
//     }

//     els.container.innerHTML = list
//       .map(
//         (a) => `
//         <div class="address-card ${a.address_id == selectedId ? "selected" : ""}">
//           <div class="address-info" data-id="${a.address_id}">
//             <strong>${a.name || ""}</strong><br>
//             ${a.phone || ""}<br>
//             ${(a.line1 || "")} ${(a.line2 || "")}<br>
//             ${a.city || ""}, ${a.state || ""} - ${a.pincode || ""}
//           </div>
//           <div class="address-actions">
//             <button class="select-btn" data-id="${a.address_id}">
//               ${a.address_id == selectedId ? "Selected" : "Select"}
//             </button>
//             <button class="edit-btn" data-id="${a.address_id}">Edit</button>
//             <button class="delete-btn" data-id="${a.address_id}">Delete</button>
//           </div>
//         </div>`
//       )
//       .join("");
//   }

//   // -------------------------------
//   // Load Addresses
//   // -------------------------------
//   async function loadAddresses() {
//     try {
//       const data = await apiRequest(ENDPOINT);
//       renderAddresses(Array.isArray(data) ? data : []);
//     } catch (err) {
//       console.error("Failed to load addresses:", err);
//       toast("Failed to load addresses", true);
//       renderAddresses([]);
//     }
//   }

//   // -------------------------------
//   // Save Address
//   // -------------------------------
//   async function saveAddress() {
//     const payload = {
//       name: els.name.value.trim(),
//       phone: els.phone.value.trim(),
//       line1: els.line1.value.trim(),
//       line2: els.line2.value.trim(),
//       city: els.city.value.trim(),
//       state: els.state.value.trim(),
//       pincode: els.zip.value.trim(),
//     };

//     if (!payload.name || !payload.phone || !payload.line1 || !payload.city || !payload.state || !payload.pincode) {
//       toast("Fill all required fields", true);
//       return;
//     }

//     try {
//       if (editingId) {
//         await apiRequest(`${ENDPOINT}/${editingId}`, {
//           method: "PUT",
//           body: payload,
//         });
//         toast("Address updated");
//       } else {
//         await apiRequest(ENDPOINT, {
//           method: "POST",
//           body: payload,
//         });
//         toast("Address added");
//       }
//       closeModal();
//       await loadAddresses();
//     } catch (err) {
//       console.error("Save address failed:", err);
//       toast("Failed to save address", true);
//     }
//   }

//   // -------------------------------
//   // Delete Address
//   // -------------------------------
//   async function deleteAddress(id) {
//     if (!confirm("Delete this address?")) return;
//     try {
//       await apiRequest(`${ENDPOINT}/${id}`, { method: "DELETE" });
//       toast("Address removed");
//       await loadAddresses();
//     } catch (err) {
//       console.error("Delete failed:", err);
//       toast("Failed to delete address", true);
//     }
//   }

//   // -------------------------------
//   // Select Address
//   // -------------------------------
//   function selectAddress(id) {
//     selectedId = id;
//     els.proceedBtn.disabled = false;
//     const cards = document.querySelectorAll(".address-card");
//     cards.forEach((card) => {
//       if (Number(card.querySelector(".address-info").dataset.id) === Number(id)) {
//         card.classList.add("selected");
//         card.querySelector(".select-btn").textContent = "Selected";
//       } else {
//         card.classList.remove("selected");
//         card.querySelector(".select-btn").textContent = "Select";
//       }
//     });
//   }

//   // -------------------------------
//   // Event delegation
//   // -------------------------------
//   document.addEventListener("click", async (e) => {
//     const select = e.target.closest(".select-btn");
//     const edit = e.target.closest(".edit-btn");
//     const del = e.target.closest(".delete-btn");

//     if (select) {
//       selectAddress(select.dataset.id);
//       return;
//     }

//     if (del) {
//       deleteAddress(del.dataset.id);
//       return;
//     }

//     if (edit) {
//       try {
//         const data = await apiRequest(`${ENDPOINT}/${edit.dataset.id}`);
//         openModal(true, data);
//       } catch (err) {
//         console.error("Fetch for edit failed:", err);
//         toast("Failed to load address", true);
//       }
//     }
//   });

//   // -------------------------------
//   // Wire modal buttons
//   // -------------------------------
//   els.addBtn?.addEventListener("click", () => openModal(false));
//   els.cancelBtn?.addEventListener("click", closeModal);
//   els.saveBtn?.addEventListener("click", saveAddress);

//   // -------------------------------
//   // Proceed to Payment
//   // -------------------------------
//   els.proceedBtn?.addEventListener("click", async () => {
//     if (!selectedId) {
//       toast("Select an address first", true);
//       return;
//     }
//     try {
//       const data = await apiRequest(`${ENDPOINT}/${selectedId}`);
//       sessionStorage.setItem("selectedAddress", JSON.stringify(data));

//       const items = JSON.parse(sessionStorage.getItem("checkout_items") || "[]");
//       if (!items.length) {
//         toast("No items in checkout", true);
//         return;
//       }
//       window.location.href = "payment.html";
//     } catch (err) {
//       console.error("Proceed to payment failed:", err);
//       toast("Unable to continue", true);
//     }
//   });

//   // -------------------------------
//   // Init (fixed)
//   // -------------------------------
//   // document.addEventListener("DOMContentLoaded", async () => {
//   //   await window.auth.initSession();
//   //   const user = await window.auth.getCurrentUser();
//   //   if (!user) {
//   //     toast("Please log in to manage addresses", true);
//   //     setTimeout(() => (window.location.href = "profile.html"), 1200);
//   //     return;
//   //   }

//   //   // Bind modal buttons only after DOM is ready
//   //   els.addBtn?.addEventListener("click", () => {
//   //     openModal(false);
//   //   });

//   //   els.cancelBtn?.addEventListener("click", closeModal);
//   //   els.saveBtn?.addEventListener("click", saveAddress);

//   //   await loadAddresses();
//   //   if (window.updateNavbarCounts) await window.updateNavbarCounts(true);
//   // });
//   document.addEventListener("DOMContentLoaded", async () => {
//     const apiRequest = window.apiRequest;
//     if (typeof apiRequest !== "function") {
//       console.error("apiRequest not found — client.js not yet loaded");
//       return;
//     }

//     // Bind modal buttons first
//     els.addBtn?.addEventListener("click", () => openModal(false));
//     els.cancelBtn?.addEventListener("click", closeModal);
//     els.saveBtn?.addEventListener("click", saveAddress);

//     try {
//       await window.auth.initSession();
//       const user = await window.auth.getCurrentUser();
//       if (!user) {
//         toast("Please log in to manage addresses", true);
//         setTimeout(() => (window.location.href = "profile.html"), 1200);
//         return;
//       }

//       els.proceedBtn?.addEventListener("click", async () => {
//         if (!selectedId) {
//           toast("Select an address first", true);
//           return;
//         }
//         const data = await apiRequest(`${ENDPOINT}/${selectedId}`);
//         sessionStorage.setItem("selectedAddress", JSON.stringify(data));

//         const items = JSON.parse(sessionStorage.getItem("checkout_items") || "[]");
//         if (!items.length) {
//           toast("No items in checkout", true);
//           return;
//         }

//         window.location.href = "payment.html";
//       });

//       await loadAddresses();
//       if (window.updateNavbarCounts) await window.updateNavbarCounts(true);
//     } catch (err) {
//       console.error("Init failed:", err);
//     }
//   });


// })();



// //   // -------------------------------
// //   // Init
// //   // -------------------------------
// //   document.addEventListener("DOMContentLoaded", async () => {
// //     await window.auth.initSession();
// //     const user = await window.auth.getCurrentUser();
// //     if (!user) {
// //       toast("Please log in to manage addresses", true);
// //       setTimeout(() => (window.location.href = "profile.html"), 1200);
// //       return;
// //     }
// //     await loadAddresses();
// //     if (window.updateNavbarCounts) await window.updateNavbarCounts(true);
// //   });
// // })();

// frontend/addresses.js

// // frontend/addresses.js — consistent with cart.js (user-only but tolerant init)
// (function () {
//   const addressList = document.getElementById("address-list");
//   const addAddressBtn = document.getElementById("addAddressBtn");
//   const proceedBtn = document.getElementById("proceedToPayment");
//   const toast = document.getElementById("toast");
//   const modal = document.getElementById("addressModal");

//   const modalTitle = document.getElementById("modalTitle");
//   const addrName = document.getElementById("addrName");
//   const addrPhone = document.getElementById("addrPhone");
//   const addrLine1 = document.getElementById("addrLine1");
//   const addrLine2 = document.getElementById("addrLine2");
//   const addrCity = document.getElementById("addrCity");
//   const addrState = document.getElementById("addrState");
//   const addrZip = document.getElementById("addrZip");
//   const saveBtn = document.getElementById("saveAddressBtn");
//   const cancelBtn = document.getElementById("cancelModalBtn");

//   let addresses = [];
//   let selectedAddressId = null;
//   let editingAddressId = null;

//   // ---------------- Toast Helper ----------------
//   function showToast(msg, bad = false, ms = 2200) {
//     if (!toast) return;
//     toast.textContent = msg;
//     toast.style.background = bad ? "#b00020" : "#333";
//     toast.style.opacity = "1";
//     clearTimeout(showToast._t);
//     showToast._t = setTimeout(() => (toast.style.opacity = "0"), ms);
//   }

//   // ---------------- Modal ----------------
//   function openModal(editId = null) {
//     editingAddressId = editId;
//     modal.classList.add("active");
//     if (editId) {
//       modalTitle.textContent = "Edit Address";
//       const a = addresses.find((x) => x.id === editId);
//       if (a) {
//         addrName.value = a.fullName || "";
//         addrPhone.value = a.phone || "";
//         addrLine1.value = a.line1 || "";
//         addrLine2.value = a.line2 || "";
//         addrCity.value = a.city || "";
//         addrState.value = a.state || "";
//         addrZip.value = a.zip || "";
//       }
//     } else {
//       modalTitle.textContent = "Add Address";
//       [addrName, addrPhone, addrLine1, addrLine2, addrCity, addrState, addrZip]
//         .forEach((i) => (i.value = ""));
//     }
//   }

//   function closeModal() {
//     modal.classList.remove("active");
//     editingAddressId = null;
//   }

//   cancelBtn.addEventListener("click", closeModal);
//   addAddressBtn.addEventListener("click", () => openModal());

//   // ---------------- Render ----------------
//   function renderAddresses() {
//     addressList.innerHTML = "";
//     if (!addresses.length) {
//       addressList.innerHTML = `<p style="grid-column:1/-1;color:#777;">No addresses found.</p>`;
//       proceedBtn.disabled = true;
//       return;
//     }

//     addresses.forEach((addr) => {
//       const card = document.createElement("div");
//       card.className =
//         "address-card" + (addr.id === selectedAddressId ? " selected" : "");
//       card.innerHTML = `
//         <div class="address-info">
//           <strong>${addr.fullName}</strong><br>
//           ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br>
//           ${addr.city}, ${addr.state} - ${addr.zip}<br>
//           📞 ${addr.phone}
//         </div>
//       `;
//       const actions = document.createElement("div");
//       const isDefault = !!addr.is_default;
//       actions.className = "address-actions";
//       actions.innerHTML = `
//         <button class="${isDefault ? "default-btn" : "set-default-btn"}" data-id="${addr.id}">
//           ${isDefault ? "Default" : "Set Default"}
//         </button>
//         <button class="edit-btn" data-id="${addr.id}">Edit</button>
//         <button class="delete-btn" data-id="${addr.id}">Delete</button>
//       `;
//       card.appendChild(actions);

//       card.addEventListener("click", (e) => {
//         if (e.target.tagName === "BUTTON") return;
//         selectedAddressId = addr.id;
//         renderAddresses();
//         proceedBtn.disabled = false;
//       });

//       actions.querySelector(".edit-btn").onclick = (e) => {
//         e.stopPropagation();
//         openModal(addr.id);
//       };

//       actions.querySelector(".delete-btn").onclick = (e) => {
//         e.stopPropagation();
//         deleteAddress(addr.id);
//       };

//       actions.querySelector(".set-default-btn")?.addEventListener("click", (e) => {
//         e.stopPropagation();
//         setDefaultAddress(addr.id);
//       });

//       addressList.appendChild(card);
//     });
//   }

//   // ---------------- API ----------------
//   async function safeFetch(url, options = {}) {
//     const token = localStorage.getItem("auth_token");
//     const headers = options.headers || {};
//     if (token) headers["Authorization"] = `Bearer ${token}`;
//     const res = await fetch(url, { ...options, headers, credentials: "include" });
//     if (res.status === 401) return null;
//     if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
//     return res.json();
//   }

//   async function getStableToken(maxWait = 4000) {
//     let token = localStorage.getItem("auth_token");
//     if (token) return token;
//     if (window.auth?.initSession) await window.auth.initSession();

//     const start = Date.now();
//     while (!token && Date.now() - start < maxWait) {
//       token = await window.auth.getToken();
//       if (token) {
//         localStorage.setItem("auth_token", token);
//         return token;
//       }
//       await new Promise((res) => setTimeout(res, 250));
//     }
//     return null;
//   }

//   async function fetchAddresses() {
//     try {
//       const token = await getStableToken();
//       if (!token) {
//         showToast("Please log in to manage addresses", "error");
//         setTimeout(() => (window.location.href = "profile.html"), 1000);
//         return;
//       }

//       const res = await fetch("/api/addresses", {
//         headers: { Authorization: `Bearer ${token}` },
//         credentials: "include",
//       });

//       if (res.status === 401) {
//         showToast("Please log in to manage addresses", "error");
//         setTimeout(() => (window.location.href = "profile.html"), 1000);
//         return;
//       }

//       const data = await res.json();
//       addresses = Array.isArray(data) ? data : [];
//       renderAddresses();
//     } catch (err) {
//       console.error("Failed to fetch addresses:", err);
//       showToast("Failed to load addresses", "error");
//     }
//   }

//   async function saveAddress() {

//     const payload = {
//       name: addrName.value.trim(),
//       phone: addrPhone.value.trim(),
//       line1: addrLine1.value.trim(),
//       line2: addrLine2.value.trim(),
//       city: addrCity.value.trim(),
//       state: addrState.value.trim(),
//       pincode: addrZip.value.trim(),   // ✅ correct key name
//     };
//     if (
//       !payload.fullName ||
//       !payload.phone ||
//       !payload.line1 ||
//       !payload.city ||
//       !payload.state ||
//       !payload.zip
//     ) {
//       return showToast("Please fill all required fields", true);
//     }

//     try {
//       if (editingAddressId) {
//         await apiClient.put(`/api/addresses/${editingAddressId}`, payload);
//         showToast("Address updated");
//       } else {
//         await apiClient.post("/api/addresses", payload);
//         showToast("Address added");
//       }
//       closeModal();
//       await fetchAddresses();
//     } catch (err) {
//       console.error("Save failed:", err);
//       showToast("Failed to save address", true);
//     }
//   }

//   async function deleteAddress(id) {
//     if (!confirm("Are you sure you want to delete this address?")) return;
//     try {
//       await apiClient.delete(`/api/addresses/${id}`);
//       showToast("Address deleted");
//       await fetchAddresses();
//     } catch (err) {
//       console.error("Delete failed:", err);
//       showToast("Failed to delete address", true);
//     }
//   }

//   async function setDefaultAddress(id) {
//     try {
//       await apiClient.patch(`/api/addresses/${id}/default`);
//       showToast("Default address updated");
//       await fetchAddresses();
//     } catch (err) {
//       console.error("Set default failed:", err);
//       showToast("Failed to set default address", true);
//     }
//   }

//   // ---------------- Proceed to Payment ----------------
//   proceedBtn.addEventListener("click", () => {
//     if (!selectedAddressId)
//       return showToast("Select an address to proceed", true);
//     window.location.href = `payment.html?addressId=${selectedAddressId}`;
//   });

//   saveBtn.addEventListener("click", saveAddress);

//   // ---------------- Init ----------------
//   document.addEventListener("DOMContentLoaded", async () => {
//     try {
//       const readyUser = firebase.auth().currentUser || (await new Promise((res) => {
//         const unsub = firebase.auth().onAuthStateChanged((u) => {
//           unsub();
//           res(u);
//         });
//       }));

//       if (!readyUser) {
//         window.location.href = "profile.html";
//         return;
//       }

//       const token = await readyUser.getIdToken(true);
//       localStorage.setItem("auth_token", token);
//       await fetchAddresses();
//     } catch (err) {
//       console.error("[addresses.js] init failed:", err);
//       showToast("Error initializing addresses", true);
//     }
//   });

// })(); // ✅ Properly closed IIFE

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
  // document.addEventListener("DOMContentLoaded", async () => {
  //   try {
  //     if (window.auth?.initSession) await window.auth.initSession();
  //     const user = firebase.auth().currentUser;
  //     if (!user) {
  //       window.location.href = "profile.html";
  //       return;
  //     }
  //     const token = await user.getIdToken(true);
  //     localStorage.setItem("auth_token", token);
  //     await fetchAddresses();
  //   } catch (err) {
  //     console.error("[addresses.js] init failed:", err);
  //     showToast("Error initializing addresses", true);
  //   }
  // });
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
