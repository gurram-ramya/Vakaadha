// frontend/profile_edit.js

/**
 * PROFILE EDIT (auth-first; no redirects unless truly unauthenticated)
 * - Loads profile via /api/users/me
 * - On 404: calls /api/auth/register, then retries /me
 * - Saves *only* allowed fields (name, gender, dob) to /api/users/me/profile
 * - If email/phone changed, records LINK intent then sends user to login.html
 */
(function () {
  if (window.__profile_edit_js_bound__) return;
  window.__profile_edit_js_bound__ = true;

  const FLOW_KEY = "__vakaadha_auth_flow__";
  const ME_ENDPOINT = "/api/users/me";
  const REGISTER_ENDPOINT = "/api/auth/register";
  const PROFILE_PUT_ENDPOINT = "/api/users/me/profile";

  const els = {
    form: document.getElementById("profile-edit-form"),

    name: document.getElementById("edit-name"),
    email: document.getElementById("edit-email"),
    phone: document.getElementById("edit-phone"),

    // These exist in the page but are NOT persisted by backend presently.
    gender: document.getElementById("edit-gender"),
    dob: document.getElementById("edit-dob"),
    location: document.getElementById("edit-location"),
    altMobile: document.getElementById("edit-alt-mobile"),
    hint: document.getElementById("edit-hint"),

    saveBtn: document.getElementById("save-profile"),
    cancelBtn: document.getElementById("cancel-edit"),
    errorBox: document.getElementById("profile-edit-error"),
  };

  let originalIdentity = { email: null, phone: null };

  // --------------- utils ---------------
  function normalize(v) {
    return v == null ? null : (String(v).trim() || null);
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
  function setVal(el, v) { if (el) el.value = v == null ? "" : String(v); }

  async function ensureAuthReady() {
    try { await window.auth?.initSession?.(); } catch {}
    try { await window.auth?.waitForReady?.(5000); } catch {}
  }
  async function getTokenSafe() {
    try {
      const t1 = await window.auth?.getToken?.({ forceRefresh: false });
      if (t1) return t1;
      await new Promise(r => setTimeout(r, 150));
      return await window.auth?.getToken?.({ forceRefresh: true });
    } catch { return null; }
  }

  function readFlow() {
    try { return JSON.parse(sessionStorage.getItem(FLOW_KEY) || "null"); } catch { return null; }
  }
  function clearFlow() {
    try { sessionStorage.removeItem(FLOW_KEY); } catch {}
  }
  function triggerIdentityLink(type, value) {
    try {
      sessionStorage.setItem(FLOW_KEY, JSON.stringify({
        mode: "LINK",
        type,            // "EMAIL" | "PHONE"
        value,
        returnTo: "profile_edit.html",
        initiatedAt: Date.now(),
      }));
    } catch {}
    window.location.href = "login.html";
  }

  // --------------- backend calls ---------------
  async function fetchMe() {
    return window.apiRequest(ME_ENDPOINT);
  }

  async function registerIf404() {
    try {
      await window.apiRequest(REGISTER_ENDPOINT, { method: "POST", body: {} });
      return true;
    } catch (e) {
      console.warn("[profile_edit] /auth/register failed:", e && e.status, e && e.message);
      return false;
    }
  }

  async function loadProfile() {
    // Returns `me` or throws (only throws on 401/real errors; 404 is handled)
    try {
      return await fetchMe();
    } catch (e) {
      if (e && e.status === 401) {
        // truly unauthenticated
        window.location.href = "login.html";
        throw e;
      }
      if (e && e.status === 404) {
        const ok = await registerIf404();
        if (ok) {
          return await fetchMe();
        }
        showError("Could not complete registration. Please retry.");
        throw e;
      }
      // non-auth backend failure – surface but do not force login
      showError(`Failed to load profile (status ${e && e.status || "?"}).`);
      throw e;
    }
  }

  // --------------- init + render ---------------
  function populateForm(me) {
    // service.py returns full_name, email, mobile; profile fields are limited on backend
    setVal(els.name, me.full_name ?? me.name ?? "");
    setVal(els.email, me.email ?? "");
    setVal(els.phone, me.mobile ?? me.phone ?? "");

    // These are NOT persisted by backend currently; keep visual only
    setVal(els.gender, me.gender ?? me.profile?.gender ?? "");
    setVal(els.dob, me.dob ?? me.profile?.dob ?? "");
    setVal(els.location, me.location ?? me.profile?.location ?? "");
    setVal(els.altMobile, me.alt_mobile ?? me.profile?.alt_mobile ?? "");
    setVal(els.hint, me.hint_name ?? me.profile?.hint_name ?? "");

    originalIdentity.email = normalize(me.email);
    originalIdentity.phone = normalize(me.mobile ?? me.phone);
  }

  async function saveProfileFields() {
    // Only send fields allowed by backend route:
    // routes/users.py → allowed_fields = {"name","dob","gender","avatar_url"}
    const payload = {
      name: normalize(els.name?.value),
      dob: normalize(els.dob?.value),
      gender: normalize(els.gender?.value),
      // avatar_url: null // include if/when you actually support it in UI
    };
    return window.apiRequest(PROFILE_PUT_ENDPOINT, { method: "PUT", body: payload });
  }

  async function handleSave(e) {
    e.preventDefault();
    clearError();

    const newEmail = normalize(els.email?.value);
    const newPhone = normalize(els.phone?.value);

    const emailChanged = newEmail !== originalIdentity.email;
    const phoneChanged = newPhone !== originalIdentity.phone;

    try {
      await saveProfileFields();

      if (emailChanged && newEmail) {
        triggerIdentityLink("EMAIL", newEmail);
        return;
      }
      if (phoneChanged && newPhone) {
        triggerIdentityLink("PHONE", newPhone);
        return;
      }

      // no identity change; go back to profile
      window.refreshNavbarAuth?.();
      window.location.href = "profile.html";
    } catch (err) {
      console.error("[profile_edit] save failed:", err);
      if (err && err.status === 401) {
        window.location.href = "login.html";
        return;
      }
      showError("Failed to save profile. Please try again.");
    }
  }

  async function handleReturnFromLink() {
    const flow = readFlow();
    if (!flow || flow.returnTo !== "profile_edit.html") return;
    clearFlow();
    try { const me = await fetchMe(); populateForm(me); } catch {}
  }

  function bindEvents() {
    if (els.form) els.form.addEventListener("submit", handleSave);
    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        window.location.href = "profile.html";
      });
    }
  }

  async function init() {
    await ensureAuthReady();
    const tok = await getTokenSafe();
    if (!tok) { window.location.href = "login.html"; return; }

    let me;
    try { me = await loadProfile(); }
    catch { return; } // error already surfaced

    populateForm(me);
    await handleReturnFromLink();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

