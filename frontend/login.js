// ============================================================
// login.js — Vakaadha Auth Flow Controller (Firebase-first)
// Supports pages: login.html, otp.html, email.html
//
// Updated execution model:
// - OTP / Google / Email-link success => Firebase-only authenticated state
// - Then route decision is based on backend user existence ONLY (no register call here)
//   • if backend user exists => index.html (skip complete_profile even if profile incomplete)
//   • if backend user does NOT exist => complete_profile.html (first-time prompt)
// - Pure registration + guest cart/wishlist merge must happen ONLY when user clicks
//   "Create account" on complete_profile.html (handled elsewhere)
//
// Storage rules kept:
// - sessionStorage is primary flow state (tab scoped)
// - localStorage allowed only for non-auth identifiers (email/phone) + token/cache managed by auth.js
// ============================================================
let __otp_inflight = false;
let __otp_success = false;

(function () {
  if (window.__login_js_bound__) return;
  window.__login_js_bound__ = true;

  // -----------------------------
  // Shared flow state
  // -----------------------------
  const FLOW_KEY = "__vakaadha_auth_flow__";

  // non-auth identifier persistence (safe to keep across tabs)
  const LS_LAST_EMAIL = "__vakaadha_last_email__";
  const LS_LAST_PHONE = "__vakaadha_last_phone__";

  const MODE = { LOGIN: "LOGIN", LINK: "LINK" };
  const TYPE = { PHONE: "PHONE", EMAIL: "EMAIL", GOOGLE: "GOOGLE" };

  // Production-safe timeouts
  const MAX_FLOW_AGE_MS = 30 * 60 * 1000;          // 30 minutes
  const OTP_RESEND_COOLDOWN_MS = 60 * 1000;        // 60 seconds
  const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;      // 60 seconds
  const WAIT_FOR_USER_TIMEOUT_MS = 7000;           // 7 seconds

  function nowMs() { return Date.now(); }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function getFlow() {
    const raw = sessionStorage.getItem(FLOW_KEY);
    const obj = safeJsonParse(raw);
    return obj && typeof obj === "object" ? obj : {};
  }

  function setFlow(patch) {
    const next = { ...getFlow(), ...patch };
    try { sessionStorage.setItem(FLOW_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  function clearFlow() {
    try { sessionStorage.removeItem(FLOW_KEY); } catch {}
  }

  function markFlowTouched() {
    const f = getFlow();
    if (!f.createdAt) setFlow({ createdAt: nowMs() });
    setFlow({ lastTouchedAt: nowMs() });
  }

  function flowExpired(flow) {
    const created = Number(flow?.createdAt || 0);
    if (!created) return false;
    return (nowMs() - created) > MAX_FLOW_AGE_MS;
  }

  function assertFirebaseAvailable() {
    if (!window.firebase || !firebase.auth) {
      throw new Error("Firebase Auth not available (firebase/auth not loaded)");
    }
  }

  function getCurrentUser() {
    try { return firebase.auth().currentUser || null; } catch { return null; }
  }

  function resolveMode() {
    return getCurrentUser() ? MODE.LINK : MODE.LOGIN;
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function normalizeDigitsPlus(value) {
    return (value || "").replace(/[^\d+]/g, "");
  }

  function normalizePhoneDigits(value) {
    return (value || "").replace(/[^\d]/g, "");
  }

  function pageName() {
    const p = (location.pathname || "").toLowerCase();
    if (p.includes("otp.html")) return "otp";
    if (p.includes("email.html")) return "email";
    return "login";
  }

  function directoryBaseUrl() {
    const url = new URL(window.location.href);
    const parts = url.pathname.split("/");
    parts.pop();
    url.pathname = parts.join("/") + "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function emailContinueUrl() {
    return directoryBaseUrl() + "email.html";
  }

  function redirectToLogin(reason) {
    clearFlow();
    try {
      if (reason) alert(reason);
    } catch {}
    window.location.href = "login.html";
  }

  function hardFail(message, err) {
    try { console.error("[login.js]", message, err || ""); } catch {}
    try { alert(message); } catch {}
  }

  async function waitForFirebaseUser(timeoutMs) {
    assertFirebaseAvailable();
    const auth = firebase.auth();

    const existing = auth.currentUser;
    if (existing) return existing;

    const deadline = nowMs() + (timeoutMs || WAIT_FOR_USER_TIMEOUT_MS);

    return new Promise((resolve, reject) => {
      let done = false;
      let unsub = null;

      function finish(ok, val) {
        if (done) return;
        done = true;
        try { if (unsub) unsub(); } catch {}
        if (ok) resolve(val);
        else reject(val);
      }

      try {
        unsub = auth.onAuthStateChanged((u) => {
          if (u) finish(true, u);
        });
      } catch {}

      (function spin() {
        if (done) return;
        const u = auth.currentUser;
        if (u) return finish(true, u);
        if (nowMs() > deadline) return finish(false, new Error("Firebase auth state not ready"));
        setTimeout(spin, 120);
      })();
    });
  }

  /* ===========================================================
   * POST-FIREBASE ROUTING (NO REGISTRATION HERE)
   * ===========================================================
   * - login.js must NOT call /api/auth/register anywhere.
   * - It only checks whether a backend user already exists.
   * - Existing backend user => index.html
   * - No backend user => complete_profile.html
   */

  function assertApiClientAvailable() {
    if (typeof window.apiRequest !== "function") {
      throw new Error("apiRequest not available (client.js not loaded)");
    }
  }

  // NEW: ensure token is immediately available for api/client.js
  function cacheTokenForApiClient(idToken) {
    try {
      if (idToken && String(idToken).trim()) {
        localStorage.setItem("auth_token", String(idToken));
      }
    } catch {}
  }

  async function ensureAuthSessionPrimed() {
    // Ensure auth.js listener is bound, then force a token read once.
    try {
      if (window.auth?.initSession) await window.auth.initSession();
    } catch {}

    try {
      // Works with both old and new auth.js signatures.
      const t = window.auth?.getToken ? await window.auth.getToken({ forceRefresh: true }) : null;
      if (t) cacheTokenForApiClient(t);
    } catch {}
  }

  async function ensureFreshIdToken(user) {
    if (!user || !user.getIdToken) {
      throw new Error("Firebase user missing after auth");
    }

    // Force mint
    const token = await user.getIdToken(true);
    if (!token) {
      throw new Error("Failed to mint Firebase ID token");
    }

    // Make it visible immediately
    localStorage.setItem("auth_token", token);

    // HARD BARRIER: wait until auth.js can read it
    let attempts = 0;
    while (attempts < 15) {
      const t = await window.auth?.getToken?.();
      if (t) return;
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    throw new Error("Auth token not visible to auth.js");
  }

  async function waitUntilAuthTokenAvailable(timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const t = await window.auth?.getToken?.();
        if (typeof t === "string" && t.trim()) return t;
      } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error("Auth token not available for API client");
  }


  async function backendUserExistsOrThrow() {
    assertApiClientAvailable();

    // If /api/users/me returns 200 => exists
    // If it returns 404 => does not exist (first-time prompt)
    // If it returns 401 after apiRequest retry => auth/token mismatch (fatal, not "new user")
    try {
      await window.apiRequest("/api/users/me");
      return true;
    } catch (err) {
      const st = Number(err?.status || 0);

      if (st === 404) return false;

      if (st === 401) {
        const e = new Error("Backend rejected Firebase token (401). Check token wiring / backend verifier config.");
        e.cause = err;
        throw e;
      }

      throw err;
    }
  }

  async function routeAfterFirebaseAuth() {
    const user = await waitForFirebaseUser(WAIT_FOR_USER_TIMEOUT_MS);

    await syncTokenIntoAuthJs(user);

    let exists;
    try {
      exists = await backendUserExistsOrThrow();
    } finally {
      clearFlow();
    }

    window.location.href = exists ? "index.html" : "complete_profile.html";
  }


  async function syncTokenIntoAuthJs(user) {
    const token = await user.getIdToken(true);
    if (!token) throw new Error("Failed to mint Firebase token");

    // 1. Make token visible immediately
    localStorage.setItem("auth_token", token);

    // 2. FORCE auth.js to ingest it
    if (window.auth?.setToken) {
      window.auth.setToken(token);
    }

    // 3. HARD WAIT until auth.js confirms
    let tries = 0;
    while (tries < 20) {
      const t = await window.auth?.getToken?.();
      if (t) return;
      await new Promise(r => setTimeout(r, 100));
      tries++;
    }

    throw new Error("auth.js did not ingest token");
  }



  // -----------------------------
  // Legacy backend-driven redirect (kept for safety, not used)
  // -----------------------------
  async function reconcileAndRedirect(force) {
    if (!window.AuthCore || !window.AuthCore.afterFirebaseAuth) {
      throw new Error("AuthCore.afterFirebaseAuth not available");
    }

    const user = await waitForFirebaseUser(WAIT_FOR_USER_TIMEOUT_MS);

    let rec;
    rec = await window.AuthCore.afterFirebaseAuth(user, {
      force: !!force,
      reason: (getFlow().mode === MODE.LINK ? "link" : "login"),
    });

    // Canonical user must come from AuthCore
    let me = rec && rec.backend_user ? rec.backend_user : null;

    // Defensive fallback to cached user_info written by AuthCore
    if (!me) {
      try { me = JSON.parse(localStorage.getItem("user_info") || "null"); } catch { me = null; }
    }

    clearFlow();

    if (me && (me.profile_complete === true || me.profile_complete === 1)) {
      window.location.href = "index.html";
      return;
    }

    window.location.href = "complete_profile.html";
  }

  // ============================================================
  // Country data + UI (login.html)
  // ============================================================

  let selectedCountry = {
    name: "India",
    code: "+91",
    flag: "🇮🇳",
  };

  const countries = [
    { name: "Afghanistan", code: "+93", flag: "🇦🇫" },
    { name: "Albania", code: "+355", flag: "🇦🇱" },
    { name: "Algeria", code: "+213", flag: "🇩🇿" },
    { name: "Andorra", code: "+376", flag: "🇦🇩" },
    { name: "Angola", code: "+244", flag: "🇦🇴" },
    { name: "Antigua and Barbuda", code: "+1", flag: "🇦🇬" },
    { name: "Argentina", code: "+54", flag: "🇦🇷" },
    { name: "Armenia", code: "+374", flag: "🇦🇲" },
    { name: "Australia", code: "+61", flag: "🇦🇺" },
    { name: "Austria", code: "+43", flag: "🇦🇹" },
    { name: "Azerbaijan", code: "+994", flag: "🇦🇿" },
    { name: "Bahamas", code: "+1", flag: "🇧🇸" },
    { name: "Bahrain", code: "+973", flag: "🇧🇭" },
    { name: "Bangladesh", code: "+880", flag: "🇧🇩" },
    { name: "Barbados", code: "+1", flag: "🇧🇧" },
    { name: "Belarus", code: "+375", flag: "🇧🇾" },
    { name: "Belgium", code: "+32", flag: "🇧🇪" },
    { name: "Belize", code: "+501", flag: "🇧🇿" },
    { name: "Benin", code: "+229", flag: "🇧🇯" },
    { name: "Bhutan", code: "+975", flag: "🇧🇹" },
    { name: "Bolivia", code: "+591", flag: "🇧🇴" },
    { name: "Bosnia and Herzegovina", code: "+387", flag: "🇧🇦" },
    { name: "Botswana", code: "+267", flag: "🇧🇼" },
    { name: "Brazil", code: "+55", flag: "🇧🇷" },
    { name: "Brunei", code: "+673", flag: "🇧🇳" },
    { name: "Bulgaria", code: "+359", flag: "🇧🇬" },
    { name: "Burkina Faso", code: "+226", flag: "🇧🇫" },
    { name: "Burundi", code: "+257", flag: "🇧🇮" },
    { name: "Cambodia", code: "+855", flag: "🇰🇭" },
    { name: "Cameroon", code: "+237", flag: "🇨🇲" },
    { name: "Canada", code: "+1", flag: "🇨🇦" },
    { name: "Cape Verde", code: "+238", flag: "🇨🇻" },
    { name: "Central African Republic", code: "+236", flag: "🇨🇫" },
    { name: "Chad", code: "+235", flag: "🇹🇩" },
    { name: "Chile", code: "+56", flag: "🇨🇱" },
    { name: "China", code: "+86", flag: "🇨🇳" },
    { name: "Colombia", code: "+57", flag: "🇨🇴" },
    { name: "Comoros", code: "+269", flag: "🇰🇲" },
    { name: "Congo", code: "+242", flag: "🇨🇬" },
    { name: "Costa Rica", code: "+506", flag: "🇨🇷" },
    { name: "Croatia", code: "+385", flag: "🇭🇷" },
    { name: "Cuba", code: "+53", flag: "🇨🇺" },
    { name: "Cyprus", code: "+357", flag: "🇨🇾" },
    { name: "Czech Republic", code: "+420", flag: "🇨🇿" },
    { name: "Denmark", code: "+45", flag: "🇩🇰" },
    { name: "Djibouti", code: "+253", flag: "🇩🇯" },
    { name: "Dominica", code: "+1", flag: "🇩🇲" },
    { name: "Dominican Republic", code: "+1", flag: "🇩🇴" },
    { name: "Ecuador", code: "+593", flag: "🇪🇨" },
    { name: "Egypt", code: "+20", flag: "🇪🇬" },
    { name: "El Salvador", code: "+503", flag: "🇸🇻" },
    { name: "Equatorial Guinea", code: "+240", flag: "🇬🇶" },
    { name: "Eritrea", code: "+291", flag: "🇪🇷" },
    { name: "Estonia", code: "+372", flag: "🇪🇪" },
    { name: "Eswatini", code: "+268", flag: "🇸🇿" },
    { name: "Ethiopia", code: "+251", flag: "🇪🇹" },
    { name: "Fiji", code: "+679", flag: "🇫🇯" },
    { name: "Finland", code: "+358", flag: "🇫🇮" },
    { name: "France", code: "+33", flag: "🇫🇷" },
    { name: "Gabon", code: "+241", flag: "🇬🇦" },
    { name: "Gambia", code: "+220", flag: "🇬🇲" },
    { name: "Georgia", code: "+995", flag: "🇬🇪" },
    { name: "Germany", code: "+49", flag: "🇩🇪" },
    { name: "Ghana", code: "+233", flag: "🇬🇭" },
    { name: "Greece", code: "+30", flag: "🇬🇷" },
    { name: "Grenada", code: "+1", flag: "🇬🇩" },
    { name: "Guatemala", code: "+502", flag: "🇬🇹" },
    { name: "Guinea", code: "+224", flag: "🇬🇳" },
    { name: "Guyana", code: "+592", flag: "🇬🇾" },
    { name: "Haiti", code: "+509", flag: "🇭🇹" },
    { name: "Honduras", code: "+504", flag: "🇭🇳" },
    { name: "Hungary", code: "+36", flag: "🇭🇺" },
    { name: "Iceland", code: "+354", flag: "🇮🇸" },
    { name: "India", code: "+91", flag: "🇮🇳" },
    { name: "Indonesia", code: "+62", flag: "🇮🇩" },
    { name: "Iran", code: "+98", flag: "🇮🇷" },
    { name: "Iraq", code: "+964", flag: "🇮🇶" },
    { name: "Ireland", code: "+353", flag: "🇮🇪" },
    { name: "Israel", code: "+972", flag: "🇮🇱" },
    { name: "Italy", code: "+39", flag: "🇮🇹" },
    { name: "Jamaica", code: "+1", flag: "🇯🇲" },
    { name: "Japan", code: "+81", flag: "🇯🇵" },
    { name: "Jordan", code: "+962", flag: "🇯🇴" },
    { name: "Kazakhstan", code: "+7", flag: "🇰🇿" },
    { name: "Kenya", code: "+254", flag: "🇰🇪" },
    { name: "Kuwait", code: "+965", flag: "🇰🇼" },
    { name: "Kyrgyzstan", code: "+996", flag: "🇰🇬" },
    { name: "Laos", code: "+856", flag: "🇱🇦" },
    { name: "Latvia", code: "+371", flag: "🇱🇻" },
    { name: "Lebanon", code: "+961", flag: "🇱🇧" },
    { name: "Lesotho", code: "+266", flag: "🇱🇸" },
    { name: "Liberia", code: "+231", flag: "🇱🇷" },
    { name: "Libya", code: "+218", flag: "🇱🇾" },
    { name: "Lithuania", code: "+370", flag: "🇱🇹" },
    { name: "Luxembourg", code: "+352", flag: "🇱🇺" },
    { name: "Malaysia", code: "+60", flag: "🇲🇾" },
    { name: "Maldives", code: "+960", flag: "🇲🇻" },
    { name: "Mexico", code: "+52", flag: "🇲🇽" },
    { name: "Mongolia", code: "+976", flag: "🇲🇳" },
    { name: "Morocco", code: "+212", flag: "🇲🇦" },
    { name: "Nepal", code: "+977", flag: "🇳🇵" },
    { name: "Netherlands", code: "+31", flag: "🇳🇱" },
    { name: "New Zealand", code: "+64", flag: "🇳🇿" },
    { name: "Nigeria", code: "+234", flag: "🇳🇬" },
    { name: "Norway", code: "+47", flag: "🇳🇴" },
    { name: "Oman", code: "+968", flag: "🇴🇲" },
    { name: "Pakistan", code: "+92", flag: "🇵🇰" },
    { name: "Philippines", code: "+63", flag: "🇵🇭" },
    { name: "Poland", code: "+48", flag: "🇵🇱" },
    { name: "Portugal", code: "+351", flag: "🇵🇹" },
    { name: "Qatar", code: "+974", flag: "🇶🇦" },
    { name: "Romania", code: "+40", flag: "🇷🇴" },
    { name: "Russia", code: "+7", flag: "🇷🇺" },
    { name: "Saudi Arabia", code: "+966", flag: "🇸🇦" },
    { name: "Singapore", code: "+65", flag: "🇸🇬" },
    { name: "South Africa", code: "+27", flag: "🇿🇦" },
    { name: "South Korea", code: "+82", flag: "🇰🇷" },
    { name: "Spain", code: "+34", flag: "🇪🇸" },
    { name: "Sri Lanka", code: "+94", flag: "🇱🇰" },
    { name: "Sweden", code: "+46", flag: "🇸🇪" },
    { name: "Switzerland", code: "+41", flag: "🇨🇭" },
    { name: "Thailand", code: "+66", flag: "🇹🇭" },
    { name: "Turkey", code: "+90", flag: "🇹🇷" },
    { name: "UAE", code: "+971", flag: "🇦🇪" },
    { name: "Ukraine", code: "+380", flag: "🇺🇦" },
    { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
    { name: "United States", code: "+1", flag: "🇺🇸" },
    { name: "Vietnam", code: "+84", flag: "🇻🇳" },
    { name: "Yemen", code: "+967", flag: "🇾🇪" },
    { name: "Zambia", code: "+260", flag: "🇿🇲" },
    { name: "Zimbabwe", code: "+263", flag: "🇿🇼" },
  ];

  function renderCountries(list) {
    const container = document.getElementById("countries");
    if (!container) return;
    container.innerHTML = "";
    list.forEach((c) => {
      const div = document.createElement("div");
      div.className = "country-item";
      div.innerHTML = `<span>${c.flag} ${c.name}</span><span>${c.code}</span>`;
      div.onclick = () => selectCountry(c);
      container.appendChild(div);
    });
  }

  function applyCountryToUI(c) {
    const flagEl = document.getElementById("flag");
    const codeEl = document.getElementById("code");
    if (flagEl) flagEl.innerText = c.flag;
    if (codeEl) codeEl.innerText = c.code;
  }

  function selectCountry(c) {
    selectedCountry = c;
    applyCountryToUI(c);
    const list = document.getElementById("countryList");
    if (list) list.style.display = "none";
    setFlow({ country: c });
  }

  // Globals required by login.html
  window.toggleCountryList = function toggleCountryList() {
    const identifier = document.getElementById("identifier");
    const list = document.getElementById("countryList");
    if (!identifier || !list) return;

    const input = identifier.value || "";
    if (/[a-zA-Z]/.test(input)) return;

    list.style.display = list.style.display === "block" ? "none" : "block";
  };

  window.filterCountries = function filterCountries(val) {
    const v = (val || "").toLowerCase();
    const filtered = countries.filter((c) => c.name.toLowerCase().includes(v));
    renderCountries(filtered);
  };

  window.detectCountry = function detectCountry(value) {
    const v = (value || "").trim();
    const countryUI = document.getElementById("countryUI");
    const countryList = document.getElementById("countryList");
    if (!countryUI || !countryList) return;

    if (/[a-zA-Z]/.test(v)) {
      countryUI.style.display = "none";
      countryList.style.display = "none";
      return;
    }

    if (v === "") {
      countryUI.style.display = "none";
      countryList.style.display = "none";
      return;
    }

    if (/^[\d\s+]+$/.test(v)) {
      countryUI.style.display = "flex";
    }
  };

  // ============================================================
  // login.html actions
  // ============================================================

  function persistIdentifier(email, phoneE164) {
    try {
      if (email) localStorage.setItem(LS_LAST_EMAIL, email);
      if (phoneE164) localStorage.setItem(LS_LAST_PHONE, phoneE164);
    } catch {}
  }

  window.startAuth = async function startAuth() {
    try {
      assertFirebaseAvailable();
    } catch (e) {
      hardFail("Auth system not ready", e);
      return;
    }

    const identifierEl = document.getElementById("identifier");
    if (!identifierEl) return;

    const raw = (identifierEl.value || "").trim();
    const compact = raw.replace(/\s/g, "");

    if (!compact) {
      hardFail("Enter a valid email or mobile number");
      return;
    }

    const modeActual = resolveMode();
    const mode = modeActual;

    // EMAIL
    if (/[a-zA-Z]/.test(compact)) {
      if (!isEmail(compact)) {
        hardFail("Enter a valid email address");
        return;
      }

      persistIdentifier(compact, null);

      setFlow({
        mode,
        type: TYPE.EMAIL,
        email: compact,
        createdAt: nowMs(),
        emailLink: { sentAt: null, continueUrl: emailContinueUrl() },
      });

      window.location.href = "email.html";
      return;
    }

    // PHONE
    const digits = normalizePhoneDigits(compact);
    const hasPlus = compact.startsWith("+");
    const codeEl = document.getElementById("code");
    const countryCode = codeEl ? (codeEl.innerText || selectedCountry.code) : selectedCountry.code;

    let phoneE164 = "";
    if (hasPlus) phoneE164 = normalizeDigitsPlus(compact);
    else phoneE164 = `${countryCode}${digits}`;

    if (!/^\+\d{6,15}$/.test(phoneE164)) {
      hardFail("Enter a valid email or mobile number");
      return;
    }

    persistIdentifier(null, phoneE164);

    setFlow({
      mode,
      type: TYPE.PHONE,
      phoneE164,
      createdAt: nowMs(),
      phone: { otpSentAt: null, verificationId: null, method: null },
    });

    window.location.href = "otp.html";
  };

  window.googleLogin = async function googleLogin() {
    try {
      assertFirebaseAvailable();
    } catch (e) {
      hardFail("Auth system not ready", e);
      return;
    }

    markFlowTouched();

    const mode = resolveMode();
    setFlow({ mode, type: TYPE.GOOGLE, createdAt: nowMs() });

    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
      if (mode === MODE.LINK) {
        const u = auth.currentUser;
        if (!u) throw new Error("No currentUser for linking Google");
        await u.linkWithPopup(provider);
      } else {
        await auth.signInWithPopup(provider);
      }
    } catch (e) {
      const codeStr = String(e?.code || "");
      if (codeStr === "auth/popup-closed-by-user") {
        hardFail("Sign-in canceled");
        return;
      }
      hardFail("Google sign-in failed", e);
      return;
    }

    try {
      await routeAfterFirebaseAuth();
    } catch (e) {
      hardFail("Login succeeded but post-auth routing failed", e);
    }
  };

  // ============================================================
  // otp.html logic (phone OTP)
  // ============================================================

  const OTP_SECONDS = 60;
  let otpTimerId = null;

  function setOtpTimerUI(secondsLeft) {
    const timerEl = document.getElementById("timer");
    if (timerEl) timerEl.innerText = String(secondsLeft);
  }

  function setResendEnabled(enabled) {
    const btn = document.getElementById("resendBtn");
    if (btn) btn.disabled = !enabled;
  }

  function startOtpTimer() {
    if (otpTimerId) clearInterval(otpTimerId);

    let t = OTP_SECONDS;
    setResendEnabled(false);
    setOtpTimerUI(t);

    otpTimerId = setInterval(() => {
      t -= 1;
      setOtpTimerUI(t);
      if (t <= 0) {
        clearInterval(otpTimerId);
        otpTimerId = null;
        setResendEnabled(true);
      }
    }, 1000);
  }

  function ensureRecaptchaContainer() {
    let el = document.getElementById("recaptcha-container");
    if (el) return el;

    el = document.createElement("div");
    el.id = "recaptcha-container";
    el.style.position = "absolute";
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    el.style.width = "1px";
    el.style.height = "1px";
    document.body.appendChild(el);
    return el;
  }

  function clearRecaptchaVerifier() {
    try {
      if (window.__vakaadha_recaptcha_verifier__) {
        try { window.__vakaadha_recaptcha_verifier__.clear(); } catch {}
      }
    } catch {}
    try { window.__vakaadha_recaptcha_verifier__ = null; } catch {}
  }

  function currentOtpInputValue() {
    const otpEl = document.getElementById("otp");
    return otpEl ? String(otpEl.value || "").trim() : "";
  }

  async function initOtpPage() {
    const flow = getFlow();

    if (!flow || flow.type !== TYPE.PHONE || !flow.phoneE164) {
      redirectToLogin("Invalid OTP state. Start again.");
      return;
    }

    if (flowExpired(flow)) {
      redirectToLogin("OTP session expired. Start again.");
      return;
    }

    // If flow says LINK but actual session is not present, downgrade to LOGIN
    const actualMode = resolveMode();
    // if (flow.mode === MODE.LINK && actualMode !== MODE.LINK) {
    //   setFlow({ mode: MODE.LOGIN });
    // }
    const isUpdatePhone = (flow.origin === "profile_edit" && flow.intent === "update_phone");
    if (flow.mode === MODE.LINK && actualMode !== MODE.LINK && !isUpdatePhone) {
      setFlow({ mode: MODE.LOGIN });
    }


    // const otpText = document.getElementById("otpText");
    // if (otpText) otpText.innerText = "We’ve sent a one-time password to " + flow.phoneE164;
    const otpText = document.getElementById("otpText");
    if (otpText) {
      const updateMode = (flow.origin === "profile_edit" && flow.intent === "update_phone");
      otpText.innerText = updateMode
        ? "We’ve sent an OTP to " + flow.phoneE164 + " to update your mobile number."
        : "We’ve sent a one-time password to " + flow.phoneE164;
    }

    // Send OTP on page entry if verificationId missing
    if (!flow.phone || !flow.phone.verificationId) {
      try {
        await sendPhoneOtp(flow.phoneE164);
      } catch (e) {
        hardFail("Failed to send OTP", e);
        return;
      }
    }

    startOtpTimer();
  }

  // LOGIN mode: signInWithPhoneNumber → confirmationResult.verificationId
  async function sendOtpLoginMode(phoneE164, verifier) {
    const auth = firebase.auth();
    const confirmationResult = await auth.signInWithPhoneNumber(phoneE164, verifier);
    return { verificationId: confirmationResult.verificationId, method: "signInWithPhoneNumber" };
  }

  // LINK mode: PhoneAuthProvider.verifyPhoneNumber → verificationId (no sign-in side effect)
  async function sendOtpLinkMode(phoneE164, verifier) {
    const provider = new firebase.auth.PhoneAuthProvider();
    const verificationId = await provider.verifyPhoneNumber(phoneE164, verifier);
    return { verificationId, method: "verifyPhoneNumber" };
  }

  async function sendPhoneOtp(phoneE164) {
    assertFirebaseAvailable();
    markFlowTouched();

    const flow = getFlow();
    const mode = flow.mode || resolveMode();

    // enforce resend cooldown
    const lastSent = Number(flow?.phone?.otpSentAt || 0);
    if (lastSent && (nowMs() - lastSent) < OTP_RESEND_COOLDOWN_MS) {
      throw new Error("OTP resend cooldown active");
    }

    ensureRecaptchaContainer();
    clearRecaptchaVerifier();

    const verifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", { size: "invisible" });
    window.__vakaadha_recaptcha_verifier__ = verifier;

    let out;
    try {
      if (mode === MODE.LINK) {
        out = await sendOtpLinkMode(phoneE164, verifier);
      } else {
        out = await sendOtpLoginMode(phoneE164, verifier);
      }
    } finally {
      clearRecaptchaVerifier(); // MUST be here
    }

    setFlow({
      type: TYPE.PHONE,
      phoneE164,
      createdAt: flow.createdAt || nowMs(),
      phone: {
        otpSentAt: nowMs(),
        verificationId: out.verificationId,
        method: out.method,
      },
    });

    setResendEnabled(false);
  }

  

  window.verifyOtp = async function verifyOtp() {
    // Defensive guard: if this is a profile-edit phone update flow,
    // let otp.html's override handle it (do nothing here).
    const __f = getFlow();
    if (__f && __f.origin === "profile_edit" && __f.intent === "update_phone") {
      return; // otp.html has its own verifyOtp that updates same UID + mirrors to backend
    }

    try {
      assertFirebaseAvailable();
    } catch (e) {
      hardFail("Auth system not ready", e);
      return;
    }
    // debounce + UI disable
    const btn = document.getElementById("verifyBtn");
    if (__otp_inflight) return;
    __otp_inflight = true;
    if (btn) btn.disabled = true;
      markFlowTouched();

    const flow = getFlow();
    if (!flow || flow.type !== TYPE.PHONE || !flow.phoneE164) {
      redirectToLogin("Invalid OTP state. Start again.");
      return;
    }

    if (flowExpired(flow)) {
      redirectToLogin("OTP session expired. Start again.");
      return;
    }

    if (!flow.phone || !flow.phone.verificationId) {
      hardFail("OTP session missing. Resend OTP.");
      return;
    }

    const code = currentOtpInputValue();
    if (!/^\d{4,8}$/.test(code)) {
      hardFail("Enter a valid OTP");
      return;
    }

    const auth = firebase.auth();
    const mode = flow.mode || resolveMode();

    const cred = firebase.auth.PhoneAuthProvider.credential(flow.phone.verificationId, code);

    try {
      if (mode === MODE.LINK) {
        const u = await waitForFirebaseUser(WAIT_FOR_USER_TIMEOUT_MS);
        await u.linkWithCredential(cred);
      } else {
        // When OTP was sent using signInWithPhoneNumber, using signInWithCredential is correct
        await auth.signInWithCredential(cred);
      }
    } catch (e) {
      const codeStr = String(e?.code || "");

      if (codeStr === "auth/invalid-verification-code" || codeStr === "auth/code-expired") {
        hardFail("Invalid or expired OTP");
        return;
      }
      if (codeStr === "auth/credential-already-in-use" || codeStr === "auth/account-exists-with-different-credential") {
        hardFail("This phone number is already linked to another account");
        return;
      }
      if (codeStr === "auth/too-many-requests") {
        hardFail("Too many attempts. Try again later.");
        return;
      }

      hardFail("OTP verification failed", e);
      return;
    }

    try {
      await routeAfterFirebaseAuth();
    } catch (e) {
      hardFail("Login succeeded but post-auth routing failed", e);
    } finally {
      __otp_inflight = false;
      __otp_success = false;
      if (btn) btn.disabled = false;
    }

    function unlock() {
      __otp_inflight = false;
      __otp_success = false;
      if (btn) btn.disabled = false;
    }
  };

  window.resendOtp = async function resendOtp() {
    markFlowTouched();

    const flow = getFlow();
    if (!flow || flow.type !== TYPE.PHONE || !flow.phoneE164) {
      redirectToLogin("Invalid OTP state. Start again.");
      return;
    }

    if (flowExpired(flow)) {
      redirectToLogin("OTP session expired. Start again.");
      return;
    }

    // reset verificationId and resend
    setFlow({
      type: TYPE.PHONE,
      phoneE164: flow.phoneE164,
      createdAt: flow.createdAt || nowMs(),
      phone: { otpSentAt: null, verificationId: null, method: null },
    });

    try {
      await sendPhoneOtp(flow.phoneE164);
      startOtpTimer();
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("cooldown")) {
        hardFail("Wait before resending OTP");
        return;
      }
      hardFail("Failed to resend OTP", e);
    }
  };

  // ============================================================
  // email.html logic (email magic link)
  // ============================================================

  function readLastEmailFallback() {
    try { return localStorage.getItem(LS_LAST_EMAIL) || ""; } catch { return ""; }
  }

  async function initEmailPage() {
    const flow = getFlow();

    // If tab lost sessionStorage (new tab from email app), recover from safe fallback
    if ((!flow || flow.type !== TYPE.EMAIL || !flow.email) && readLastEmailFallback()) {
      setFlow({
        mode: resolveMode(),
        type: TYPE.EMAIL,
        email: readLastEmailFallback(),
        createdAt: nowMs(),
        emailLink: { sentAt: null, continueUrl: emailContinueUrl() },
      });
    }

    const f = getFlow();
    if (!f || f.type !== TYPE.EMAIL || !f.email) {
      redirectToLogin("Email session not found. Start again.");
      return;
    }

    if (flowExpired(f)) {
      redirectToLogin("Email session expired. Start again.");
      return;
    }

    // If flow says LINK but actual session is not present, downgrade to LOGIN
    const actualMode = resolveMode();
    if (f.mode === MODE.LINK && actualMode !== MODE.LINK) {
      setFlow({ mode: MODE.LOGIN });
    }

    const emailText = document.getElementById("emailText");
    if (emailText) emailText.innerText = "We’ve sent a sign-in link to " + f.email;

    assertFirebaseAvailable();
    const auth = firebase.auth();

    const href = window.location.href;

    // If current URL is a sign-in email link, consume it
    if (auth.isSignInWithEmailLink(href)) {
      await consumeEmailLink(f.email, href);
      return;
    }

    // Ensure link is sent, enforce resend cooldown and expiry handling
    const sentAt = Number(f?.emailLink?.sentAt || 0);
    const tooSoon = sentAt && (nowMs() - sentAt) < EMAIL_RESEND_COOLDOWN_MS;

    if (!sentAt) {
      try { await sendEmailLink(f.email); }
      catch (e) { hardFail("Failed to send email sign-in link", e); }
      return;
    }

    // If sent long ago within the flow TTL, auto-resend once
    if (!tooSoon && (nowMs() - sentAt) > (10 * 60 * 1000)) {
      try { await sendEmailLink(f.email); } catch {}
    }
  }

  async function sendEmailLink(email) {
    assertFirebaseAvailable();
    markFlowTouched();

    const flow = getFlow();
    const sentAt = Number(flow?.emailLink?.sentAt || 0);
    if (sentAt && (nowMs() - sentAt) < EMAIL_RESEND_COOLDOWN_MS) {
      throw new Error("Email resend cooldown active");
    }

    const auth = firebase.auth();

    const actionCodeSettings = {
      url: emailContinueUrl(),
      handleCodeInApp: true,
    };

    await auth.sendSignInLinkToEmail(email, actionCodeSettings);

    persistIdentifier(email, null);

    setFlow({
      type: TYPE.EMAIL,
      email,
      createdAt: flow.createdAt || nowMs(),
      emailLink: { sentAt: nowMs(), continueUrl: actionCodeSettings.url },
    });
  }

  async function consumeEmailLink(email, href) {
    assertFirebaseAvailable();
    markFlowTouched();

    const auth = firebase.auth();
    const flow = getFlow();
    const mode = (flow.mode || resolveMode());

    try {
      if (mode === MODE.LINK) {
        const u = await waitForFirebaseUser(WAIT_FOR_USER_TIMEOUT_MS);
        const cred = firebase.auth.EmailAuthProvider.credentialWithLink(email, href);
        await u.linkWithCredential(cred);
      } else {
        await auth.signInWithEmailLink(email, href);
      }
    } catch (e) {
      const codeStr = String(e?.code || "");

      if (codeStr === "auth/invalid-action-code" || codeStr === "auth/expired-action-code") {
        hardFail("Email link is invalid or expired. Resend the link.");
        return;
      }
      if (codeStr === "auth/credential-already-in-use" || codeStr === "auth/email-already-in-use") {
        hardFail("This email is already linked to another account");
        return;
      }
      if (codeStr === "auth/account-exists-with-different-credential") {
        hardFail("This email belongs to an account with a different sign-in method");
        return;
      }

      hardFail("Email sign-in failed", e);
      return;
    }

    try {
      await routeAfterFirebaseAuth();
    } catch (e) {
      hardFail("Login succeeded but post-auth routing failed", e);
    }
  }

  window.openEmail = function openEmail() {
    hardFail("Open your email inbox and tap the sign-in link to continue.");
  };

  window.resendEmail = async function resendEmail() {
    markFlowTouched();

    const flow = getFlow();
    if (!flow || flow.type !== TYPE.EMAIL || !flow.email) {
      redirectToLogin("Invalid email state. Start again.");
      return;
    }

    if (flowExpired(flow)) {
      redirectToLogin("Email session expired. Start again.");
      return;
    }

    try {
      await sendEmailLink(flow.email);
      alert("Email link resent");
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("cooldown")) {
        hardFail("Wait before resending the email link");
        return;
      }
      hardFail("Failed to resend email link", e);
    }
  };

  // ============================================================
  // Initialization per page
  // ============================================================

  function initLoginPage() {
    // restore country
    const flow = getFlow();
    if (flow && flow.country) selectedCountry = flow.country;

    applyCountryToUI(selectedCountry);
    renderCountries(countries);

    // start hidden
    const countryUI = document.getElementById("countryUI");
    const countryList = document.getElementById("countryList");
    const identifierEl = document.getElementById("identifier");

    if (countryUI) countryUI.style.display = "none";
    if (countryList) countryList.style.display = "none";

    if (identifierEl) window.detectCountry(identifierEl.value || "");
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const p = pageName();

    try {
      if (p === "login") initLoginPage();
      if (p === "otp") await initOtpPage();
      if (p === "email") await initEmailPage();
    } catch (e) {
      hardFail("Auth page initialization failed", e);
    }
  });
})();
