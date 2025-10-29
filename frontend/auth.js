
// // ✅ Use Firebase app initialized in profile.html
// const auth = firebase.auth();

// // ==============================
// // Helpers
// // ==============================

// // API base (adjust if backend is on another port)
// const API_BASE = "/";

// // Save user+token to localStorage
// function saveUser(user, idToken) {
//   const userInfo = {
//     uid: user.uid,
//     name: user.displayName || user.email,
//     email: user.email,
//     idToken: idToken
//   };
//   localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
//   return userInfo;
// }

// // Read current logged user from storage
// function getStoredUser() {
//   return JSON.parse(localStorage.getItem("loggedInUser"));
// }

// // Send token to backend to sync/create user
// async function syncWithBackend(idToken) {
//   const res = await fetch(API_BASE + "signup", {
//     method: "POST",
//     headers: { "Authorization": "Bearer " + idToken }
//   });
//   return await res.json();
// }

// // Display user in navbar/header (stub: implement in your layout)
// function showUser(nameOrEmail) {
//   const userDisplay = document.getElementById("user-display");
//   if (userDisplay) {
//     userDisplay.textContent = "Hello, " + nameOrEmail;
//   }
// }

// // ==============================
// // Auto login on page reload
// // ==============================
// window.onload = async () => {
//   const stored = getStoredUser();
//   const userDisplay = document.getElementById("user-display");
//   const authLink = document.getElementById("auth-link");
//   const loggedInLinks = document.getElementById("logged-in-links");

//   if (stored && stored.idToken) {
//     try {
//       const res = await fetch(API_BASE + "me", {
//         headers: { "Authorization": "Bearer " + stored.idToken }
//       });
//       if (res.ok) {
//         const user = await res.json();
//         userDisplay.textContent = "Hello, " + (user.name || user.email);
//         if (authLink) authLink.classList.add("hidden");
//         if (loggedInLinks) loggedInLinks.classList.remove("hidden");
//       } else {
//         logout();
//       }
//     } catch {
//       logout();
//     }
//   } else {
//     // Not logged in
//     if (userDisplay) userDisplay.textContent = "Login / Signup";
//     if (authLink) authLink.classList.remove("hidden");
//     if (loggedInLinks) loggedInLinks.classList.add("hidden");
//   }
// };


// // ==============================
// // Google Login
// // ==============================
// const googleLoginBtn = document.getElementById("google-login");
// if (googleLoginBtn) {
//   googleLoginBtn.addEventListener("click", () => {
//     const provider = new firebase.auth.GoogleAuthProvider();
//     auth.signInWithPopup(provider)
//       .then(async result => {
//         const user = result.user;
//         const idToken = await user.getIdToken();
//         saveUser(user, idToken);
//         await syncWithBackend(idToken);
//         showUser(user.displayName || user.email);
//         window.location.href = "/";
//       })
//       .catch(err => alert("Google login failed: " + err.message));
//   });
// }

// // ==============================
// // Email/Password Login
// // ==============================
// const loginForm = document.getElementById("email-login-form");
// if (loginForm) {
//   loginForm.addEventListener("submit", async e => {
//     e.preventDefault();
//     const email = document.getElementById("login-email").value;
//     const password = document.getElementById("login-password").value;
//     try {
//       const result = await auth.signInWithEmailAndPassword(email, password);
//       const user = result.user;
//       const idToken = await user.getIdToken();
//       saveUser(user, idToken);
//       await syncWithBackend(idToken);
//       showUser(user.email);
//       window.location.href = "/";
//     } catch (err) {
//       alert("Login failed: " + err.message);
//     }
//   });
// }

// // ==============================
// // Email/Password Signup
// // ==============================
// const signupForm = document.getElementById("email-signup-form");
// if (signupForm) {
//   signupForm.addEventListener("submit", async e => {
//     e.preventDefault();
//     const email = document.getElementById("signup-email").value;
//     const password = document.getElementById("signup-password").value;
//     try {
//       const result = await auth.createUserWithEmailAndPassword(email, password);
//       const user = result.user;
//       const idToken = await user.getIdToken();
//       saveUser(user, idToken);
//       await syncWithBackend(idToken);
//       showUser(user.email);
//       window.location.href = "/";
//     } catch (err) {
//       alert("Signup failed: " + err.message);
//     }
//   });
// }

// // ==============================
// // Logout
// // ==============================
// const logoutBtn = document.getElementById("logout");
// if (logoutBtn) {
//   logoutBtn.addEventListener("click", () => logout());
// }

// function logout() {
//   auth.signOut().finally(() => {
//     localStorage.removeItem("loggedInUser");
//     window.location.href = "/"; // back to homepage
//   });
// }


// auth.js — current user service + guest/cart continuity (minimal correction)
(function () {
  const TOKEN_KEY = "auth_token";
  const USER_KEY  = "user_info";
  const GUEST_KEY = "guest_id"; // maintained via backend cookie only

  if (window.__auth_js_bound__) return;
  window.__auth_js_bound__ = true;

  // ---------------------- Cookie helper ----------------------
  function getCookie(name) {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : null;
  }

  // ---------------------- Helpers ----------------------
  function setToken(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
  }
  function setUserCached(user) {
    try { user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY); } catch {}
  }
  function clearSession() {
    setToken(null);
    setUserCached(null);
  }

  async function fetchMe(token) {
    const res = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
    return res;
  }
  function applyNavbar(userOrNull) {
    if (typeof window.updateNavbarUser === "function") window.updateNavbarUser(userOrNull || null);
    if (typeof window.updateNavbarCounts === "function") window.updateNavbarCounts();
  }

  async function backendLogout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  }

  async function getFreshToken() {
    if (!window.firebase || !firebase.auth || !firebase.auth().currentUser) return null;
    try {
      const token = await firebase.auth().currentUser.getIdToken(true);
      setToken(token);
      return token;
    } catch {
      clearSession();
      return null;
    }
  }

  // ---------------------- Core Session Flow ----------------------
  async function initSession() {
    // Wait for Firebase state first
    if (window.firebase && firebase.auth) {
      await new Promise(resolve => {
        const unsub = firebase.auth().onAuthStateChanged(async (user) => {
          unsub();
          if (!user) {
            clearSession();
            applyNavbar(null);
            // ensure guest_id from cookie is persisted
            const g = getCookie(GUEST_KEY);
            if (g) localStorage.setItem(GUEST_KEY, g);
            return resolve();
          }

          const token = await getFreshToken();
          if (!token) {
            clearSession();
            applyNavbar(null);
            return resolve();
          }

          // Sync backend user
          try {
            const regRes = await fetch("/api/auth/register", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify({ guest_id: localStorage.getItem(GUEST_KEY) })
            });
            if (!regRes.ok) throw new Error("register failed");
            const data = await regRes.json();
            setUserCached(data.user);
            applyNavbar(data.user);
          } catch {
            clearSession();
            applyNavbar(null);
          }
          resolve();
        });
      });
    } else {
      // Firebase not loaded → treat as guest
      const g = getCookie(GUEST_KEY);
      if (g) localStorage.setItem(GUEST_KEY, g);
      applyNavbar(null);
    }
  }

  async function getCurrentUser() {
    const cached = (() => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }})();
    if (cached) return cached;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const res = await fetchMe(token);
      if (!res.ok) return null;
      const me = await res.json();
      setUserCached(me);
      return me;
    } catch {
      return null;
    }
  }

  // ---------------------- Logout flow ----------------------
  async function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      if (token) await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.warn("[auth.js] backend logout failed:", e);
    }

    clearSession();

    if (window.firebase && firebase.auth && firebase.auth().currentUser) {
      try { await firebase.auth().signOut(); } catch {}
    }

    // capture new guest_id cookie issued by backend logout
    const newGuest = getCookie(GUEST_KEY);
    if (newGuest) localStorage.setItem(GUEST_KEY, newGuest);

    applyNavbar(null);
    window.location.href = "index.html";
  }

  // ---------------------- Expose ----------------------
  window.auth = { initSession, getCurrentUser, logout };

  document.addEventListener("DOMContentLoaded", initSession);
})();
