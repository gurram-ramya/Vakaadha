// =============================================================
// profile_edit.js — VAKAADHA PROFILE EDIT & IDENTITY INTENT
// -------------------------------------------------------------
// Responsibilities:
// • Load editable user profile from backend
// • Persist non-identity profile fields
// • Detect email / phone changes
// • Express LINK intent (EMAIL / PHONE) via sessionStorage
// • Redirect to login.js for Firebase execution
// • Restore state after credential linking
//
// Explicit Non-Responsibilities:
// • No Firebase SDK calls
// • No token management
// • No auth/session guessing
// • No backend registration logic
// =============================================================

(function () {
  if (window.__profile_edit_js_bound__) return;
  window.__profile_edit_js_bound__ = true;

  const FLOW_KEY = "__vakaadha_auth_flow__";

  // ------------------------------------------------------------
  // DOM references (must match profile_edit.html exactly)
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
  // Internal identity baseline
  // ------------------------------------------------------------
  let originalIdentity = {
    email: null,
    phone: null,
  };

  // ------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------
  function normalize(val) {
    return val === undefined || val === null || String(val).trim() === ""
      ? null
      : String(val).trim();
  }

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

  function readFlow() {
    try {
      return JSON.parse(sessionStorage.getItem(FLOW_KEY) || "null");
    } catch {
      return null;
    }
  }

  function clearFlow() {
    try {
      sessionStorage.removeItem(FLOW_KEY);
    } catch {}
  }

  // ------------------------------------------------------------
  // Load editable profile from backend
  // ------------------------------------------------------------
  async function loadProfile() {
    let me;
    try {
      me = await window.apiRequest("/api/users/me");
    } catch (err) {
      console.error("[profile_edit.js] Failed to load profile:", err);
      window.location.href = "login.html";
      return;
    }

    originalIdentity.email = normalize(me.email);
    originalIdentity.phone = normalize(me.phone);

    els.name.value = me.name || "";
    els.email.value = me.email || "";
    els.phone.value = me.phone || "";

    els.gender.value = me.profile?.gender || "";
    els.dob.value = me.profile?.dob || "";
    els.location.value = me.profile?.location || "";
    els.altMobile.value = me.profile?.alt_mobile || "";
    els.hint.value = me.profile?.hint_name || "";
  }

  // ------------------------------------------------------------
  // Persist non-identity profile fields
  // ------------------------------------------------------------
  async function saveProfileFields(payload) {
    await window.apiRequest("/api/users/profile", {
      method: "PUT",
      body: payload,
    });
  }

  // ------------------------------------------------------------
  // Express identity-link intent and delegate execution
  // ------------------------------------------------------------
  function triggerIdentityLink(type, value) {
    const flow = {
      mode: "LINK",
      type,                  // "EMAIL" | "PHONE"
      value,
      returnTo: "profile_edit.html",
      initiatedAt: Date.now(),
    };

    try {
      sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
    } catch {}

    window.location.href = "login.html";
  }

  // ------------------------------------------------------------
  // Save handler
  // ------------------------------------------------------------
  async function handleSave(e) {
    e.preventDefault();
    clearError();

    const updatedProfile = {
      name: normalize(els.name.value),
      gender: normalize(els.gender.value),
      dob: normalize(els.dob.value),
      location: normalize(els.location.value),
      alt_mobile: normalize(els.altMobile.value),
      hint_name: normalize(els.hint.value),
    };

    const newEmail = normalize(els.email.value);
    const newPhone = normalize(els.phone.value);

    const emailChanged = newEmail !== originalIdentity.email;
    const phoneChanged = newPhone !== originalIdentity.phone;

    try {
      // Always persist non-identity fields first
      await saveProfileFields(updatedProfile);

      // Identity changes require verification via login.js
      if (emailChanged && newEmail) {
        triggerIdentityLink("EMAIL", newEmail);
        return;
      }

      if (phoneChanged && newPhone) {
        triggerIdentityLink("PHONE", newPhone);
        return;
      }

      // No identity changes
      window.location.href = "profile.html";

    } catch (err) {
      console.error("[profile_edit.js] Save failed:", err);
      showError("Failed to save profile. Please try again.");
    }
  }

  // ------------------------------------------------------------
  // Handle return from login.js after LINK completion
  // ------------------------------------------------------------
  async function handleReturnFromLink() {
    const flow = readFlow();
    if (!flow || flow.returnTo !== "profile_edit.html") return;

    clearFlow();
    await loadProfile();
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------
  function bindEvents() {
    if (els.form) {
      els.form.addEventListener("submit", handleSave);
    }

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
