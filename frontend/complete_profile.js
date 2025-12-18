// =============================================================
// complete_profile.js — INITIAL PROFILE COMPLETION
// -------------------------------------------------------------
// Responsibilities:
// • Collect required profile fields
// • Save non-identity data to backend
// • Dispatch identity verification if needed
// • Redirect to home when complete
//
// Non-responsibilities:
// • No Firebase
// • No auth logic
// • No token handling
// =============================================================

(function () {
  if (window.__complete_profile_js_bound__) return;
  window.__complete_profile_js_bound__ = true;

  const FLOW_KEY = "__vakaadha_auth_flow__";

  // ------------------------------------------------------------
  // DOM references (must match complete_profile.html)
  // ------------------------------------------------------------
  const els = {
    form: document.getElementById("complete-profile-form"),
    name: document.getElementById("cp-name"),
    email: document.getElementById("cp-email"),
    phone: document.getElementById("cp-phone"),
    submit: document.getElementById("cp-submit"),
    error: document.getElementById("cp-error"),
  };

  function showError(msg) {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = "block";
  }

  function clearError() {
    if (!els.error) return;
    els.error.textContent = "";
    els.error.style.display = "none";
  }

  function normalize(v) {
    return v && v.trim() ? v.trim() : null;
  }

  function triggerLink(type, value) {
    sessionStorage.setItem(
      FLOW_KEY,
      JSON.stringify({
        mode: "LINK",
        type,
        value,
        returnTo: "complete_profile.html",
        initiatedAt: Date.now(),
      })
    );

    window.location.href = "login.html";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();

    const name = normalize(els.name.value);
    const email = normalize(els.email.value);
    const phone = normalize(els.phone.value);

    if (!name) {
      showError("Name is required");
      return;
    }

    try {
      // Save required non-identity data
      await window.apiRequest("/api/users/profile", {
        method: "PUT",
        body: { name },
      });

      // Identity linking if needed
      if (email) {
        triggerLink("EMAIL", email);
        return;
      }

      if (phone) {
        triggerLink("PHONE", phone);
        return;
      }

      // No identity added → rely on existing verified identity
      window.location.href = "index.html";

    } catch (err) {
      console.error("[complete_profile.js] failed:", err);
      showError("Failed to complete profile. Try again.");
    }
  }

  async function init() {
    try {
      const me = await window.apiRequest("/api/users/me");

      if (me?.name) els.name.value = me.name;
      if (me?.email) els.email.value = me.email;
      if (me?.phone) els.phone.value = me.phone;

    } catch {
      window.location.href = "login.html";
    }

    if (els.form) els.form.addEventListener("submit", handleSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
