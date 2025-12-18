// // =============================================================
// // VAKAADHA • PROFILE PAGE JS
// // Fetches user details, fills profile fields,
// // handles auth state + navbar, redirects when needed.
// // =============================================================

// // 1. Redirect to login if no token exists.
// const token = localStorage.getItem("token");
// if (!token) {
//     window.location.href = "login.html";
// }

// // 2. DOM references (matches profile.html EXACTLY)
// const fullNameEl = document.getElementById("profile-fullname");
// const mobileEl   = document.getElementById("profile-mobile");
// const emailEl    = document.getElementById("profile-email");
// const genderEl   = document.getElementById("profile-gender");
// const dobEl      = document.getElementById("profile-dob");
// const locationEl = document.getElementById("profile-location");
// const altMobileEl = document.getElementById("profile-altmobile");
// const hintNameEl = document.getElementById("profile-hintname");

// // Navbar elements
// const userDisplay = document.getElementById("user-display");
// const loggedInLinks = document.getElementById("logged-in-links");
// const authLink = document.getElementById("auth-link");
// const navbarLogout = document.getElementById("navbar-logout");


// // =============================================================
// //  Function: Fill the profile card
// // =============================================================
// function fillProfile(data) {

//     fullNameEl.textContent    = data.fullName ?? "- not added -";
//     mobileEl.textContent      = data.mobile ?? "- not added -";
//     emailEl.textContent       = data.email ?? "- not added -";
//     genderEl.textContent      = data.gender ?? "- not added -";
//     dobEl.textContent         = data.dob ?? "- not added -";
//     locationEl.textContent    = data.location ?? "- not added -";
//     altMobileEl.textContent   = data.altMobile ?? "- not added -";
//     hintNameEl.textContent    = data.hintName ?? "- not added -";

//     // Navbar "Hi, Name"
//     if (data.fullName) {
//         userDisplay.textContent = data.fullName.split(" ")[0];
//     }
// }


// // =============================================================
// //  Function: Fetch user data from backend
// // =============================================================
// async function loadUser() {
//     try {
//         const res = await fetch("/api/users/me", {
//             headers: {
//                 "Authorization": `Bearer ${token}`
//             }
//         });

//         if (!res.ok) {
//             // Token invalid → logout and send user to login
//             localStorage.removeItem("token");
//             window.location.href = "login.html";
//             return;
//         }

//         const data = await res.json();
//         fillProfile(data);

//         // Navbar state
//         loggedInLinks.classList.remove("hidden");
//         authLink.style.display = "none";

//     } catch (err) {
//         console.error("Profile fetch failed:", err);
//         localStorage.removeItem("token");
//         window.location.href = "login.html";
//     }
// }

// loadUser();


// // =============================================================
// // Logout button
// // =============================================================
// if (navbarLogout) {
//     navbarLogout.addEventListener("click", () => {
//         localStorage.removeItem("token");
//         window.location.href = "index.html";
//     });
// }
// =============================================================
// profile.js — VAKAADHA USER PROFILE (READ-ONLY VIEW)
// -------------------------------------------------------------
// Responsibilities:
// • Ensure user is authenticated (via auth.js)
// • Fetch user profile from backend (via client.js)
// • Render profile fields into profile.html DOM
// • Delegate navbar & logout to navbar.js
//
// Non-Responsibilities (intentional):
// • No Firebase calls
// • No token handling
// • No navbar manipulation
// • No logout logic
// • No credential linking
// =============================================================

(function () {
  if (window.__profile_js_bound__) return;
  window.__profile_js_bound__ = true;

  // ------------------------------------------------------------
  // DOM references — MUST match profile.html exactly
  // ------------------------------------------------------------
  const els = {
    name: document.getElementById("p-name"),
    phone: document.getElementById("p-phone"),
    email: document.getElementById("p-email"),
    gender: document.getElementById("p-gender"),
    dob: document.getElementById("p-dob"),
    location: document.getElementById("p-location"),
    altMobile: document.getElementById("p-alt-mobile"),
    hint: document.getElementById("p-hint"),
  };

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function safeText(el, value) {
    if (!el) return;
    el.textContent =
      value === null || value === undefined || value === ""
        ? "–"
        : String(value);
  }

  function normalizeProfilePayload(me) {
    // Backend may evolve; tolerate missing fields
    return {
      name: me?.name || null,
      phone: me?.phone || null,
      email: me?.email || null,
      gender: me?.profile?.gender || null,
      dob: me?.profile?.dob || null,
      location: me?.profile?.location || null,
      altMobile: me?.profile?.alt_mobile || null,
      hint: me?.profile?.hint_name || null,
    };
  }

  function renderProfile(me) {
    const p = normalizeProfilePayload(me);

    safeText(els.name, p.name);
    safeText(els.phone, p.phone);
    safeText(els.email, p.email);
    safeText(els.gender, p.gender);
    safeText(els.dob, p.dob);
    safeText(els.location, p.location);
    safeText(els.altMobile, p.altMobile);
    safeText(els.hint, p.hint);
  }

  // ------------------------------------------------------------
  // Auth guard — Firebase-backed, backend-verified
  // ------------------------------------------------------------
  async function ensureAuthenticated() {
    // auth.js owns session truth
    if (!window.auth || !window.auth.getToken) {
      // catastrophic mis-load; fail closed
      window.location.href = "login.html";
      return false;
    }

    const token = await window.auth.getToken();
    if (!token) {
      window.location.href = "login.html";
      return false;
    }

    return true;
  }

  // ------------------------------------------------------------
  // Load profile from backend
  // ------------------------------------------------------------
  async function loadProfile() {
    try {
      const me = await window.apiRequest("/api/users/me");
      renderProfile(me);
    } catch (err) {
      // Auth expired or backend rejected → full re-auth
      console.error("[profile.js] Failed to load profile:", err);
      window.location.href = "login.html";
    }
  }

  // ------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------
  async function initProfile() {
    const ok = await ensureAuthenticated();
    if (!ok) return;

    await loadProfile();
  }

  document.addEventListener("DOMContentLoaded", initProfile);
})();
