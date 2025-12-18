// =============================================================
// profile_state.js — PROFILE COMPLETENESS GUARD
// -------------------------------------------------------------
// Responsibilities:
// • Determine whether user profile is complete
// • Redirect to complete_profile.html if incomplete
//
// Non-responsibilities:
// • No Firebase calls
// • No profile updates
// • No auth handling
// =============================================================

(function () {
  if (window.__profile_state_js_bound__) return;
  window.__profile_state_js_bound__ = true;

  function isProfileComplete(me) {
    if (!me) return false;

    const hasName = typeof me.name === "string" && me.name.trim().length > 0;

    const hasVerifiedEmail =
      !!me.email && me.email_verified === true;

    const hasVerifiedPhone =
      !!me.phone && me.phone_verified === true;

    return hasName && (hasVerifiedEmail || hasVerifiedPhone);
  }

  async function ensureProfileComplete() {
    try {
      const me = await window.apiRequest("/api/users/me");

      if (!isProfileComplete(me)) {
        window.location.href = "complete_profile.html";
        return false;
      }

      return true;
    } catch (err) {
      console.error("[profile_state.js] failed:", err);
      window.location.href = "login.html";
      return false;
    }
  }

  window.profileState = {
    ensureProfileComplete,
  };
})();
