// // frontend/profile_edit.js

// /**
//  * PROFILE EDIT (auth-first; no redirects unless truly unauthenticated)
//  * - Loads profile via /api/users/me
//  * - On 404: calls /api/auth/register, then retries /me
//  * - Saves *only* allowed fields (name, gender, dob) to /api/users/me/profile
//  * - If email/phone changed, records LINK intent then sends user to login.html
//  * - After returning from a link, mirrors identities via POST /api/auth/register and refetches /me
//  */
// (function () {
//   if (window.__profile_edit_js_bound__) return;
//   window.__profile_edit_js_bound__ = true;

//   const FLOW_KEY = "__vakaadha_auth_flow__";
//   const ME_ENDPOINT = "/api/users/me";
//   const REGISTER_ENDPOINT = "/api/auth/register";
//   const PROFILE_PUT_ENDPOINT = "/api/users/me/profile";

//   // Map to *actual* IDs/classes in profile_edit.html
//   const els = {
//     form: document.getElementById("editProfileForm"),

//     name: document.getElementById("fullName"),
//     email: document.getElementById("email"),
//     phone: document.getElementById("mobile"),

//     // Visual-only (backend currently ignores altMobile/hint)
//     dob: document.getElementById("dob"),
//     altMobile: document.getElementById("altMobile"),
//     hint: document.getElementById("hintName"),

//     // Gender control is two buttons with .gender-btn and data-value="Male|Female"
//     genderButtons: Array.from(document.querySelectorAll(".gender-btn")),

//     // Identity link trigger
//     changeMobileBtn: document.getElementById("changeMobileBtn"),

//     // Optional error area (page may not have it)
//     errorBox: document.getElementById("profile-edit-error"),
//   };

//   let originalIdentity = { email: null, phone: null };
//   let currentGender = null; // "male" | "female" | "other" | null

//   // ---------------- utils ----------------
//   function normalize(v) {
//     return v == null ? null : (String(v).trim() || null);
//   }
//   function setVal(el, v) { if (el) el.value = v == null ? "" : String(v); }
//   function showError(msg) {
//     if (!els.errorBox) { console.warn("[profile_edit]", msg); return; }
//     els.errorBox.textContent = msg;
//     els.errorBox.style.display = "block";
//   }
//   function clearError() {
//     if (!els.errorBox) return;
//     els.errorBox.textContent = "";
//     els.errorBox.style.display = "none";
//   }

//   async function ensureAuthReady() {
//     try { await window.auth?.initSession?.(); } catch {}
//     try { await window.auth?.waitForReady?.(5000); } catch {}
//   }
//   async function getTokenSafe() {
//     try {
//       const t1 = await window.auth?.getToken?.({ forceRefresh: false });
//       if (t1) return t1;
//       await new Promise(r => setTimeout(r, 150));
//       return await window.auth?.getToken?.({ forceRefresh: true });
//     } catch { return null; }
//   }

//   function readFlow() {
//     try { return JSON.parse(sessionStorage.getItem(FLOW_KEY) || "null"); } catch { return null; }
//   }
//   function clearFlow() {
//     try { sessionStorage.removeItem(FLOW_KEY); } catch {}
//   }
//   function triggerIdentityLink(type, value) {
//     try {
//       sessionStorage.setItem(FLOW_KEY, JSON.stringify({
//         mode: "LINK",
//         type,                  // "EMAIL" | "PHONE"
//         value,                 // optional
//         returnTo: "profile_edit.html",
//         initiatedAt: Date.now(),
//       }));
//     } catch {}
//     window.location.href = "login.html";
//   }

//   // --------------- backend calls ---------------
//   async function fetchMe() {
//     return window.apiRequest(ME_ENDPOINT);
//   }

//   async function registerIf404() {
//     try {
//       await window.apiRequest(REGISTER_ENDPOINT, { method: "POST", body: {} });
//       return true;
//     } catch (e) {
//       console.warn("[profile_edit] /auth/register failed:", e && e.status, e && e.message);
//       return false;
//     }
//   }

//   async function loadProfile() {
//     // Returns `me` or throws (only throws on 401/real errors; 404 is handled)
//     try {
//       return await fetchMe();
//     } catch (e) {
//       if (e && e.status === 401) {
//         window.location.href = "login.html";
//         throw e;
//       }
//       if (e && e.status === 404) {
//         const ok = await registerIf404();
//         if (ok) return await fetchMe();
//         showError("Could not complete registration. Please retry.");
//         throw e;
//       }
//       showError(`Failed to load profile (status ${e && e.status || "?"}).`);
//       throw e;
//     }
//   }

//   // --------------- init + render ---------------
//   function populateForm(me) {
//     // service.py returns full_name, email, mobile
//     setVal(els.name, me.full_name ?? me.name ?? "");
//     setVal(els.email, me.email ?? "");
//     setVal(els.phone, me.mobile ?? me.phone ?? "");

//     // Gender visual state (backend expects lowercase male|female|other)
//     const g = (me.gender ?? me.profile?.gender ?? "").toString().toLowerCase();
//     currentGender = (g === "male" || g === "female" || g === "other") ? g : null;
//     if (els.genderButtons && els.genderButtons.length) {
//       els.genderButtons.forEach(btn => {
//         const val = (btn.dataset.value || "").toString().toLowerCase();
//         btn.classList.toggle("active", currentGender && val === currentGender);
//       });
//     }

//     // Visual-only fields for now
//     setVal(els.dob, me.dob ?? me.profile?.dob ?? "");
//     setVal(els.altMobile, me.alt_mobile ?? me.profile?.alt_mobile ?? "");
//     setVal(els.hint, me.hint_name ?? me.profile?.hint_name ?? "");

//     originalIdentity.email = normalize(me.email);
//     originalIdentity.phone = normalize(me.mobile ?? me.phone);
//   }

//   async function saveProfileFields() {
//     // Only send fields allowed by backend route:
//     // routes/users.py → allowed_fields = {"name","dob","gender","avatar_url"}
//     const payload = {
//       name: normalize(els.name?.value),
//       dob: normalize(els.dob?.value),
//       gender: currentGender,  // already lowercase or null
//       // avatar_url: null
//     };
//     return window.apiRequest(PROFILE_PUT_ENDPOINT, { method: "PUT", body: payload });
//   }

//   async function handleSave(e) {
//     e.preventDefault();
//     clearError();

//     const newEmail = normalize(els.email?.value);
//     const newPhone = normalize(els.phone?.value);

//     const emailChanged = newEmail !== originalIdentity.email;
//     const phoneChanged = newPhone !== originalIdentity.phone;

//     try {
//       await saveProfileFields();

//       if (emailChanged && newEmail) {
//         // Start EMAIL linking flow
//         triggerIdentityLink("EMAIL", newEmail);
//         return;
//       }
//       if (phoneChanged && newPhone) {
//         // Start PHONE linking flow
//         triggerIdentityLink("PHONE", newPhone);
//         return;
//       }

//       // No identity change; go back to profile
//       window.refreshNavbarAuth?.();
//       window.location.href = "profile.html";
//     } catch (err) {
//       console.error("[profile_edit] save failed:", err);
//       if (err && err.status === 401) {
//         window.location.href = "login.html";
//         return;
//       }
//       showError("Failed to save profile. Please try again.");
//     }
//   }

//   async function handleReturnFromLink() {
//     const flow = readFlow();
//     if (!flow || flow.returnTo !== "profile_edit.html") return;
//     clearFlow();
//     // Mirror identities server-side once after linking
//     try { await window.apiRequest(REGISTER_ENDPOINT, { method: "POST", body: {} }); } catch {}
//     try { const me = await fetchMe(); populateForm(me); } catch {}
//   }

//   function bindEvents() {
//     if (els.form) els.form.addEventListener("submit", handleSave);

//     if (els.genderButtons && els.genderButtons.length) {
//       els.genderButtons.forEach(btn => {
//         btn.addEventListener("click", () => {
//           const val = (btn.dataset.value || "").toString().toLowerCase();
//           currentGender = (val === "male" || val === "female" || val === "other") ? val : null;
//           els.genderButtons.forEach(b => b.classList.toggle("active", b === btn));
//         });
//       });
//     }

//     if (els.changeMobileBtn) {
//       els.changeMobileBtn.addEventListener("click", () => {
//         // Start PHONE link; let login.js handle OTP flow
//         triggerIdentityLink("PHONE", null);
//       });
//     }
//   }

//   async function init() {
//     await ensureAuthReady();
//     const tok = await getTokenSafe();
//     if (!tok) { window.location.href = "login.html"; return; }

//     let me;
//     try { me = await loadProfile(); }
//     catch { return; } // error already surfaced

//     populateForm(me);
//     await handleReturnFromLink();
//     bindEvents();
//   }

//   document.addEventListener("DOMContentLoaded", init);
// })();


// frontend/profile_edit.js

/**
 * PROFILE EDIT (auth-first; identities updated via update.html)
 * - Loads profile via /api/users/me
 * - On 404: POST /api/auth/register, then retry /me
 * - Saves ONLY allowed fields (name, gender, dob) to /api/users/me/profile
 * - Email/phone are read-only here; CHANGE/UPDATE buttons route to update.html
 * - After returning from update.html (linking/verification complete), we mirror
 *   identities server-side via POST /api/auth/register and refetch /me
 */
(function () {
  if (window.__profile_edit_js_bound__) return;
  window.__profile_edit_js_bound__ = true;

  const FLOW_KEY = "__vakaadha_auth_flow__";           // used to detect return from update.html
  const ME_ENDPOINT = "/api/users/me";
  const REGISTER_ENDPOINT = "/api/auth/register";
  const PROFILE_PUT_ENDPOINT = "/api/users/me/profile";

  // Map to *actual* IDs/classes in profile_edit.html
  const els = {
    form: document.getElementById("editProfileForm"),

    name: document.getElementById("fullName"),
    email: document.getElementById("email"),
    phone: document.getElementById("mobile"),

    // Visual-only (backend currently ignores altMobile/hint)
    dob: document.getElementById("dob"),
    altMobile: document.getElementById("altMobile"),
    hint: document.getElementById("hintName"),

    // Gender control is two buttons with .gender-btn and data-value="Male|Female"
    genderButtons: Array.from(document.querySelectorAll(".gender-btn")),

    // Identity change triggers (route to update.html)
    changeMobileBtn: document.getElementById("changeMobileBtn"),
    changeEmailBtn: document.getElementById("changeEmailBtn"),

    // Optional error area
    errorBox: document.getElementById("profile-edit-error"),
  };

  let currentGender = null; // "male" | "female" | "other" | null

  // ---------------- utils ----------------
  function normalize(v) {
    return v == null ? null : (String(v).trim() || null);
  }
  function setVal(el, v) { if (el) el.value = v == null ? "" : String(v); }
  function showError(msg) {
    if (!els.errorBox) { console.warn("[profile_edit]", msg); return; }
    els.errorBox.textContent = msg;
    els.errorBox.style.display = "block";
  }
  function clearError() {
    if (!els.errorBox) return;
    els.errorBox.textContent = "";
    els.errorBox.style.display = "none";
  }

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
        window.location.href = "login.html";
        throw e;
      }
      if (e && e.status === 404) {
        const ok = await registerIf404();
        if (ok) return await fetchMe();
        showError("Could not complete registration. Please retry.");
        throw e;
      }
      showError(`Failed to load profile (status ${e && e.status || "?"}).`);
      throw e;
    }
  }

  // --------------- init + render ---------------
  function populateForm(me) {
    // service.py returns full_name, email, mobile
    setVal(els.name, me.full_name ?? me.name ?? "");
    setVal(els.email, me.email ?? "");
    setVal(els.phone, me.mobile ?? me.phone ?? "");

    // Force read-only for identity fields (managed via update.html)
    if (els.email) els.email.readOnly = true;
    if (els.phone) els.phone.readOnly = true;

    // Gender visual state (backend expects lowercase male|female|other)
    const g = (me.gender ?? me.profile?.gender ?? "").toString().toLowerCase();
    currentGender = (g === "male" || g === "female" || g === "other") ? g : null;
    if (els.genderButtons && els.genderButtons.length) {
      els.genderButtons.forEach(btn => {
        const val = (btn.dataset.value || "").toString().toLowerCase();
        btn.classList.toggle("active", currentGender && val === currentGender);
      });
    }

    // Visual-only fields for now
    setVal(els.dob, me.dob ?? me.profile?.dob ?? "");
    setVal(els.altMobile, me.alt_mobile ?? me.profile?.alt_mobile ?? "");
    setVal(els.hint, me.hint_name ?? me.profile?.hint_name ?? "");
  }

  async function saveProfileFields() {
    // Only send fields allowed by backend route:
    // routes/users.py → allowed_fields = {"name","dob","gender","avatar_url"}
    const payload = {
      name: normalize(els.name?.value),
      dob: normalize(els.dob?.value),
      gender: currentGender,  // already lowercase or null
      // avatar_url: null
    };
    return window.apiRequest(PROFILE_PUT_ENDPOINT, { method: "PUT", body: payload });
  }

  async function handleSave(e) {
    e.preventDefault();
    clearError();

    try {
      await saveProfileFields();
      // Identities are not changed from here; go back to profile view
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
    // If update.html (or underlying flows) left a flow cookie for us, consume it
    const flow = readFlow();
    if (!flow || flow.returnTo !== "profile_edit.html") return;
    clearFlow();

    // Mirror identities server-side once after return (idempotent)
    try { await window.apiRequest(REGISTER_ENDPOINT, { method: "POST", body: {} }); } catch {}
    try { const me = await fetchMe(); populateForm(me); } catch {}
  }

  function bindEvents() {
    if (els.form) els.form.addEventListener("submit", handleSave);

    if (els.genderButtons && els.genderButtons.length) {
      els.genderButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          const val = (btn.dataset.value || "").toString().toLowerCase();
          currentGender = (val === "male" || val === "female" || val === "other") ? val : null;
          els.genderButtons.forEach(b => b.classList.toggle("active", b === btn));
        });
      });
    }

    // Route to middle page for identity updates
    if (els.changeMobileBtn) {
      els.changeMobileBtn.addEventListener("click", () => {
        window.location.href = "update.html?target=phone&returnTo=profile_edit.html";
      });
    }
    if (els.changeEmailBtn) {
      els.changeEmailBtn.addEventListener("click", () => {
        window.location.href = "update.html?target=email&returnTo=profile_edit.html";
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
