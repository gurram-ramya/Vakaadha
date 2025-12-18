// // ======================================================
// //  Load Logged-In User + Prefill Fields
// // ======================================================
// document.addEventListener("DOMContentLoaded", async () => {
//     fetchUser();
//     setupGenderButtons();
//     setupMobileChange();
//     setupFormSubmit();
// });

// let CURRENT_USER = null;

// // ------------------------------------------------------
// // Fetch user data
// // ------------------------------------------------------
// async function fetchUser() {
//     try {
//         const res = await fetch("/api/users/me", {
//             method: "GET",
//             credentials: "include"
//         });

//         if (!res.ok) {
//             window.location.href = "/login.html";
//             return;
//         }

//         CURRENT_USER = await res.json();
//         fillForm(CURRENT_USER);

//     } catch (err) {
//         console.error("Profile load failed:", err);
//         window.location.href = "/login.html";
//     }
// }

// // ------------------------------------------------------
// // Prefill inputs
// // ------------------------------------------------------
// function fillForm(u) {
//     document.getElementById("navProfileName").textContent = u.fullName || "Account";

//     document.getElementById("mobile").value = u.mobile || "";
//     document.getElementById("fullName").value = u.fullName || "";
//     document.getElementById("email").value = u.email || "";
//     document.getElementById("dob").value = u.dob || "";
//     document.getElementById("altMobile").value = u.altMobile || "";
//     document.getElementById("hintName").value = u.hintName || "";

//     // Gender button activation
//     if (u.gender) {
//         const btn = document.querySelector(`.gender-btn[data-value="${u.gender}"]`);
//         if (btn) btn.classList.add("active");
//     }
// }

// // ======================================================
// //  Gender Selection
// // ======================================================
// function setupGenderButtons() {
//     const buttons = document.querySelectorAll(".gender-btn");

//     buttons.forEach(btn => {
//         btn.addEventListener("click", () => {
//             buttons.forEach(b => b.classList.remove("active"));
//             btn.classList.add("active");
//         });
//     });
// }

// // ======================================================
// //  MOBILE CHANGE WORKFLOW (Frontend Only)
// // ======================================================
// function setupMobileChange() {
//     const changeBtn = document.getElementById("changeMobileBtn");
//     const mobileInput = document.getElementById("mobile");

//     changeBtn.addEventListener("click", () => {
//         const newMobile = prompt("Enter new mobile number:");

//         if (!newMobile) return;

//         if (!/^\d{6,15}$/.test(newMobile)) {
//             alert("Enter a valid mobile number.");
//             return;
//         }

//         // Future: trigger OTP here
//         alert("Mobile change requires OTP verification (backend needed).");

//         // For now just update the UI (not saved yet)
//         mobileInput.value = newMobile;
//     });
// }

// // ======================================================
// //  SAVE DETAILS
// // ======================================================
// function setupFormSubmit() {
//     const form = document.getElementById("editProfileForm");

//     form.addEventListener("submit", async (e) => {
//         e.preventDefault();

//         const updated = collectUpdatedFields();

//         if (Object.keys(updated).length === 0) {
//             alert("No changes to save.");
//             return;
//         }

//         try {
//             const res = await fetch("/api/users/update", {
//                 method: "PUT",
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 credentials: "include",
//                 body: JSON.stringify(updated)
//             });

//             if (!res.ok) {
//                 alert("Failed to update profile.");
//                 return;
//             }

//             alert("Profile updated successfully.");
//             window.location.href = "/profile.html";

//         } catch (err) {
//             alert("Error saving profile.");
//         }
//     });
// }

// // ------------------------------------------------------
// // Only send changed fields
// // ------------------------------------------------------
// function collectUpdatedFields() {
//     const u = CURRENT_USER;
//     const out = {};

//     const fullName = document.getElementById("fullName").value.trim();
//     const email = document.getElementById("email").value.trim();
//     const dob = document.getElementById("dob").value.trim();
//     const altMobile = document.getElementById("altMobile").value.trim();
//     const hintName = document.getElementById("hintName").value.trim();
//     const mobile = document.getElementById("mobile").value.trim();

//     const genderBtn = document.querySelector(".gender-btn.active");
//     const gender = genderBtn ? genderBtn.getAttribute("data-value") : null;

//     if (fullName !== (u.fullName || "")) out.fullName = fullName;
//     if (email !== (u.email || "")) out.email = email;
//     if (dob !== (u.dob || "")) out.dob = dob;
//     if (altMobile !== (u.altMobile || "")) out.altMobile = altMobile;
//     if (hintName !== (u.hintName || "")) out.hintName = hintName;
//     if (mobile !== (u.mobile || "")) out.mobile = mobile;
//     if (gender && gender !== u.gender) out.gender = gender;

//     return out;
// }

// =============================================================
// profile_edit.js — VAKAADHA PROFILE EDIT & IDENTITY DISPATCH
// -------------------------------------------------------------
// Responsibilities:
// • Load editable profile data
// • Submit non-identity profile updates to backend
// • Detect email / phone changes
// • Trigger Firebase verification via login.js (LINK mode)
// • Restore state after credential linking
//
// Non-responsibilities:
// • No Firebase calls
// • No token handling
// • No navbar logic
// • No auth state guessing
// =============================================================

(function () {
  if (window.__profile_edit_js_bound__) return;
  window.__profile_edit_js_bound__ = true;

  const FLOW_KEY = "__vakaadha_auth_flow__";

  // ------------------------------------------------------------
  // DOM references (must match profile_edit.html)
  // ------------------------------------------------------------
  const els = {
    form: document.getElementById("profile-edit-form"),

    name: document.getElementById("edit-name"),
    email: document.getElementById("edit-email"),
    phone: document.getElementById("edit-phone"),

    gender: document.getElementById("edit-gender"),
    dob: document.getElementById("edit-dob"),
    location: document.getElementById("edit-location"),
    altMobile: document.getElementById("edit-alt-mobile"),
    hint: document.getElementById("edit-hint"),

    saveBtn: document.getElementById("save-profile"),
    cancelBtn: document.getElementById("cancel-edit"),
    errorBox: document.getElementById("profile-edit-error"),
  };

  // ------------------------------------------------------------
  // Internal state
  // ------------------------------------------------------------
  let original = {
    email: null,
    phone: null,
  };

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function showError(msg) {
    if (!els.errorBox) return;
    els.errorBox.textContent = msg;
    els.errorBox.style.display = "block";
  }

  function clearError() {
    if (!els.errorBox) return;
    els.errorBox.textContent = "";
    els.errorBox.style.display = "none";
  }

  function normalize(val) {
    return val === undefined || val === null || val === ""
      ? null
      : String(val).trim();
  }

  function getFlowState() {
    try {
      return JSON.parse(sessionStorage.getItem(FLOW_KEY) || "null");
    } catch {
      return null;
    }
  }

  function clearFlowState() {
    sessionStorage.removeItem(FLOW_KEY);
  }

  // ------------------------------------------------------------
  // Load editable profile
  // ------------------------------------------------------------
  async function loadProfile() {
    try {
      const me = await window.apiRequest("/api/users/me");

      // core identities
      original.email = normalize(me.email);
      original.phone = normalize(me.phone);

      // populate form
      els.name.value = me.name || "";
      els.email.value = me.email || "";
      els.phone.value = me.phone || "";

      els.gender.value = me.profile?.gender || "";
      els.dob.value = me.profile?.dob || "";
      els.location.value = me.profile?.location || "";
      els.altMobile.value = me.profile?.alt_mobile || "";
      els.hint.value = me.profile?.hint_name || "";

    } catch (err) {
      console.error("[profile_edit.js] Failed to load profile:", err);
      window.location.href = "login.html";
    }
  }

  // ------------------------------------------------------------
  // Submit non-identity profile changes
  // ------------------------------------------------------------
  async function saveProfileFields(payload) {
    await window.apiRequest("/api/users/profile", {
      method: "PUT",
      body: payload,
    });
  }

  // ------------------------------------------------------------
  // Trigger credential linking via login.js
  // ------------------------------------------------------------
  function triggerLinking(type, value) {
    const flow = {
      mode: "LINK",
      type,            // "EMAIL" or "PHONE"
      value,
      returnTo: "profile_edit.html",
      initiatedAt: Date.now(),
    };

    sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
    window.location.href = "login.html";
  }

  // ------------------------------------------------------------
  // Save handler
  // ------------------------------------------------------------
  async function handleSave(e) {
    e.preventDefault();
    clearError();

    const updated = {
      name: normalize(els.name.value),
      gender: normalize(els.gender.value),
      dob: normalize(els.dob.value),
      location: normalize(els.location.value),
      alt_mobile: normalize(els.altMobile.value),
      hint_name: normalize(els.hint.value),
    };

    const newEmail = normalize(els.email.value);
    const newPhone = normalize(els.phone.value);

    const emailChanged = newEmail !== original.email;
    const phoneChanged = newPhone !== original.phone;

    try {
      // Always save non-identity fields first
      await saveProfileFields(updated);

      // Identity change requires verification
      if (emailChanged && newEmail) {
        triggerLinking("EMAIL", newEmail);
        return;
      }

      if (phoneChanged && newPhone) {
        triggerLinking("PHONE", newPhone);
        return;
      }

      // No identity change → done
      window.location.href = "profile.html";

    } catch (err) {
      console.error("[profile_edit.js] Save failed:", err);
      showError("Failed to save profile. Please try again.");
    }
  }

  // ------------------------------------------------------------
  // Return-from-link handling
  // ------------------------------------------------------------
  async function handleReturnFromLink() {
    const flow = getFlowState();
    if (!flow || flow.returnTo !== "profile_edit.html") return;

    clearFlowState();
    await loadProfile();
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------
  function bindEvents() {
    if (els.form) els.form.addEventListener("submit", handleSave);

    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "profile.html";
      });
    }
  }

  async function init() {
    await loadProfile();
    await handleReturnFromLink();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
