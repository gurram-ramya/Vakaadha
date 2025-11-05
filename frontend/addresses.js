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

// addresses.js — modal-based redesign for addresses.html
// import { apiRequest } from "./api/client.js";

// addresses.js — modal-based redesign for addresses.html
// import { apiRequest } from "./api/client.js";

document.addEventListener("DOMContentLoaded", () => {
  // Wait until client.js and auth.js are available
  async function waitForDependencies(maxWait = 3000) {
    const start = Date.now();
    while (
      (!window.apiRequest || typeof window.apiRequest !== "function" || !window.auth || !firebase?.apps?.length) &&
      Date.now() - start < maxWait
    ) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!window.apiRequest || typeof window.apiRequest !== "function") throw new Error("client.js not loaded");
    if (!window.auth) throw new Error("auth.js not loaded");
  }

  (async function init() {
    try {
      await waitForDependencies();

      const apiRequest = window.apiRequest;
      if (window.__addresses_js_bound__) return;
      window.__addresses_js_bound__ = true;

      const ENDPOINT = "/api/addresses";
      let editingId = null;
      let selectedId = null;

      const els = {
        container: document.getElementById("address-list"),
        addBtn: document.getElementById("addAddressBtn"),
        proceedBtn: document.getElementById("proceedToPayment"),
        toast: document.getElementById("toast"),

        modal: document.getElementById("addressModal"),
        modalTitle: document.getElementById("modalTitle"),
        name: document.getElementById("addrName"),
        phone: document.getElementById("addrPhone"),
        line1: document.getElementById("addrLine1"),
        line2: document.getElementById("addrLine2"),
        city: document.getElementById("addrCity"),
        state: document.getElementById("addrState"),
        zip: document.getElementById("addrZip"),
        saveBtn: document.getElementById("saveAddressBtn"),
        cancelBtn: document.getElementById("cancelModalBtn"),
      };

      function toast(msg, bad = false, ms = 2200) {
        let t = els.toast;
        if (!t) {
          t = document.createElement("div");
          t.id = "toast";
          Object.assign(t.style, {
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#333",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "6px",
            opacity: "0",
            transition: "opacity .3s ease",
            zIndex: "9999",
          });
          document.body.appendChild(t);
          els.toast = t;
        }
        t.textContent = msg;
        t.style.background = bad ? "#b00020" : "#333";
        t.style.opacity = "1";
        clearTimeout(toast._t);
        toast._t = setTimeout(() => (t.style.opacity = "0"), ms);
      }

      function openModal(editMode = false, data = null) {
        els.modalTitle.textContent = editMode ? "Edit Address" : "Add Address";
        if (editMode && data) {
          editingId = data.address_id;
          els.name.value = data.name || "";
          els.phone.value = data.phone || "";
          els.line1.value = data.line1 || "";
          els.line2.value = data.line2 || "";
          els.city.value = data.city || "";
          els.state.value = data.state || "";
          els.zip.value = data.pincode || "";
        } else {
          editingId = null;
          els.name.value =
            els.phone.value =
            els.line1.value =
            els.line2.value =
            els.city.value =
            els.state.value =
            els.zip.value =
              "";
        }
        els.modal.classList.add("active");
      }

      function closeModal() {
        els.modal.classList.remove("active");
        editingId = null;
      }

      function renderAddresses(list = []) {
        if (!els.container) return;
        if (!list.length) {
          els.container.innerHTML = `<p class="empty">No saved addresses. Add one below.</p>`;
          els.proceedBtn.disabled = true;
          return;
        }

        els.container.innerHTML = list
          .map(
            (a) => `
          <div class="address-card ${a.address_id == selectedId ? "selected" : ""}">
            <div class="address-info" data-id="${a.address_id}">
              <strong>${a.name || ""}</strong><br>
              ${a.phone || ""}<br>
              ${(a.line1 || "")} ${(a.line2 || "")}<br>
              ${a.city || ""}, ${a.state || ""} - ${a.pincode || ""}
            </div>
            <div class="address-actions">
              <button class="select-btn" data-id="${a.address_id}">
                ${a.address_id == selectedId ? "Selected" : "Select"}
              </button>
              <button class="edit-btn" data-id="${a.address_id}">Edit</button>
              <button class="delete-btn" data-id="${a.address_id}">Delete</button>
            </div>
          </div>`
          )
          .join("");
      }

      async function loadAddresses() {
        try {
          const data = await apiRequest(ENDPOINT);
          renderAddresses(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error("Failed to load addresses:", err);
          toast("Failed to load addresses", true);
          renderAddresses([]);
        }
      }

      async function saveAddress() {
        const payload = {
          name: els.name.value.trim(),
          phone: els.phone.value.trim(),
          line1: els.line1.value.trim(),
          line2: els.line2.value.trim(),
          city: els.city.value.trim(),
          state: els.state.value.trim(),
          pincode: els.zip.value.trim(),
        };

        if (!payload.name || !payload.phone || !payload.line1 || !payload.city || !payload.state || !payload.pincode) {
          toast("Fill all required fields", true);
          return;
        }

        try {
          if (editingId) {
            await apiRequest(`${ENDPOINT}/${editingId}`, { method: "PUT", body: payload });
            toast("Address updated");
          } else {
            await apiRequest(ENDPOINT, { method: "POST", body: payload });
            toast("Address added");
          }
          closeModal();
          await loadAddresses();
        } catch (err) {
          console.error("Save address failed:", err);
          toast("Failed to save address", true);
        }
      }

      async function deleteAddress(id) {
        if (!confirm("Delete this address?")) return;
        try {
          await apiRequest(`${ENDPOINT}/${id}`, { method: "DELETE" });
          toast("Address removed");
          await loadAddresses();
        } catch (err) {
          console.error("Delete failed:", err);
          toast("Failed to delete address", true);
        }
      }

      function selectAddress(id) {
        selectedId = id;
        els.proceedBtn.disabled = false;
        const cards = document.querySelectorAll(".address-card");
        cards.forEach((card) => {
          if (Number(card.querySelector(".address-info").dataset.id) === Number(id)) {
            card.classList.add("selected");
            card.querySelector(".select-btn").textContent = "Selected";
          } else {
            card.classList.remove("selected");
            card.querySelector(".select-btn").textContent = "Select";
          }
        });
      }

      document.addEventListener("click", async (e) => {
        const select = e.target.closest(".select-btn");
        const edit = e.target.closest(".edit-btn");
        const del = e.target.closest(".delete-btn");

        if (select) return selectAddress(select.dataset.id);
        if (del) return deleteAddress(del.dataset.id);

        if (edit) {
          try {
            const data = await apiRequest(`${ENDPOINT}/${edit.dataset.id}`);
            openModal(true, data);
          } catch (err) {
            console.error("Fetch for edit failed:", err);
            toast("Failed to load address", true);
          }
        }
      });

      els.addBtn?.addEventListener("click", () => openModal(false));
      els.cancelBtn?.addEventListener("click", closeModal);
      els.saveBtn?.addEventListener("click", saveAddress);

      els.proceedBtn?.addEventListener("click", async () => {
        if (!selectedId) return toast("Select an address first", true);
        try {
          const data = await apiRequest(`${ENDPOINT}/${selectedId}`);
          sessionStorage.setItem("selectedAddress", JSON.stringify(data));

          const items = JSON.parse(sessionStorage.getItem("checkout_items") || "[]");
          if (!items.length) return toast("No items in checkout", true);

          window.location.href = "payment.html";
        } catch (err) {
          console.error("Proceed to payment failed:", err);
          toast("Unable to continue", true);
        }
      });

      // ✅ Wait until Firebase Auth state is confirmed (fixes false logout)
    //   await window.auth.initSession();

    //   const user = await new Promise((resolve) => {
    //     const unsub = firebase.auth().onAuthStateChanged((u) => {
    //       unsub();
    //       resolve(u);
    //     });
    //   });

    //   if (!user) {
    //     toast("Please log in to manage addresses", true);
    //     setTimeout(() => (window.location.href = "profile.html"), 1200);
    //     return;
    //   }

    //   await loadAddresses();
    //   if (window.updateNavbarCounts) await window.updateNavbarCounts(true);
    // } catch (err) {
    //   console.error("Addresses init failed:", err);
    // }

      // ✅ Ensure Firebase Auth ready before any API call
      await window.auth.initSession();

      const user = await new Promise((resolve) => {
        const unsub = firebase.auth().onAuthStateChanged((u) => {
          if (u) {
            unsub();
            resolve(u);
          }
        });
        // failsafe timeout if no user appears within 5s
        setTimeout(() => {
          unsub();
          resolve(null);
        }, 5000);
      });

      if (!user) {
        console.warn("Auth session not ready or expired");
        toast("Please log in to manage addresses", true);
        setTimeout(() => (window.location.href = "profile.html"), 1200);
        return;
      }

      // 🔒 force token retrieval to verify auth chain before first API call
      try {
        const token = await user.getIdToken(true);
        if (!token) throw new Error("Missing ID token");
        console.log("Firebase token acquired, proceeding with requests");
      } catch (err) {
        console.error("Token acquisition failed:", err);
        toast("Authentication error", true);
        setTimeout(() => (window.location.href = "profile.html"), 1200);
        return;
      }

      await loadAddresses();
      if (window.updateNavbarCounts) await window.updateNavbarCounts(true);
    } catch (err) {
      console.error("Addresses init failed:", err);
    }
  })();
});

