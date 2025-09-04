// frontend/profile.js

(() => {
  // ===== Config =====
  const STORAGE_KEY = "auth"; // stores {"email":"...","idToken":"..."}
  const USERS_ME_ENDPOINT = "/users/me";
  const USERS_SIGNUP_ENDPOINT = "/signup"; // silent local-user ensure
  const REDIRECT_AFTER_LOGIN = "index.html"; // change to "profile.html" if you prefer staying

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);

  const els = {
    // Sections
    loginSection: $("#login-section"),
    profileSection: $("#profile-section"),

    // Forms / controls (IDs from your HTML)
    loginForm: $("#email-login-form"),
    signupForm: $("#email-signup-form"),
    googleBtn: $("#google-login"),
    logoutBtn: $("#logout"),

    // Profile fields (read-only display or editable form; we just fill them)
    profileName: $("#profile-name"),
    profileEmail: $("#profile-email"),
    profileDob: $("#profile-dob"),
    profileGender: $("#profile-gender"),
    profileAvatar: $("#profile-avatar"),

    // Modal (optional)
    registerModal: $("#registerModal"),

    // Toast
    toast: $("#toast"),
  };

  // Provide the toggle function your HTML calls (safe if modal missing)
  // explicitly attach to window
  window.toggleRegisterModal = function toggleRegisterModal() {
    const modal = document.getElementById("registerModal");
    if (!modal) return;
    const visible = modal.style.display === "block";
    modal.style.display = visible ? "none" : "block";
  };


  // ===== UI helpers =====
  function show(section) {
    const map = {
      login: els.loginSection,
      profile: els.profileSection,
    };
    Object.values(map).forEach((el) => el && (el.style.display = "none"));
    if (map[section]) map[section].style.display = "";
  }

  function setText(el, text) {
    if (el) el.value !== undefined ? (el.value = text ?? "") : (el.textContent = text ?? "");
  }

  function showToast(msg, isError = false, ms = 2500) {
    if (!els.toast) {
      // Fallback
      if (isError) console.error(msg);
      else console.log(msg);
      return;
    }
    els.toast.textContent = msg;
    els.toast.style.background = isError ? "#b00020" : "#333";
    els.toast.style.color = "#fff";
    els.toast.style.opacity = "1";
    els.toast.style.visibility = "visible";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.style.opacity = "0";
      els.toast.style.visibility = "hidden";
    }, ms);
  }

  function setButtonLoading(formOrBtnEl, isLoading) {
    if (!formOrBtnEl) return;
    if (formOrBtnEl.tagName === "FORM") {
      const btn = formOrBtnEl.querySelector('[type="submit"]');
      if (!btn) return;
      btn.disabled = !!isLoading;
      if (isLoading) {
        btn.dataset._label = btn.textContent;
        btn.textContent = "Please wait…";
      } else if (btn.dataset._label) {
        btn.textContent = btn.dataset._label;
        delete btn.dataset._label;
      }
    } else if (formOrBtnEl.tagName === "BUTTON") {
      const btn = formOrBtnEl;
      btn.disabled = !!isLoading;
      if (isLoading) {
        btn.dataset._label = btn.textContent;
        btn.textContent = "Please wait…";
      } else if (btn.dataset._label) {
        btn.textContent = btn.dataset._label;
        delete btn.dataset._label;
      }
    }
  }

  // ===== Storage =====
  function saveAuth({ email, idToken }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, idToken }));
  }
  function loadAuth() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function clearAuth() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ===== Firebase adapter (compat first, modular fallback) =====
  function getFirebaseAuthAPI() {
    const hasCompat = typeof window !== "undefined" && window.firebase && typeof window.firebase.auth === "function";
    if (hasCompat) {
      const auth = firebase.auth();
      return {
        auth,
        createUserWithEmailAndPassword: (email, password) => auth.createUserWithEmailAndPassword(email, password),
        signInWithEmailAndPassword: (email, password) => auth.signInWithEmailAndPassword(email, password),
        signInWithGooglePopup: async () => {
          const provider = new firebase.auth.GoogleAuthProvider();
          try {
            return await auth.signInWithPopup(provider);
          } catch (err) {
            // Fallback for popup blockers
            if (err && (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user")) {
              await auth.signInWithRedirect(provider);
              // When redirect completes, onAuthStateChanged will fire.
              return null;
            }
            throw err;
          }
        },
        signOut: () => auth.signOut(),
        onAuthStateChanged: (cb) => auth.onAuthStateChanged(cb),
        getIdToken: (user) => user.getIdToken(),
      };
    }

    // Best-effort modular detection (only if someone loaded it globally)
    const hasModular =
      typeof window !== "undefined" &&
      window.firebase === undefined &&
      (typeof window.getAuth === "function" ||
        (window.firebaseAuth && typeof window.firebaseAuth.getAuth === "function"));
    if (hasModular) {
      const getAuth = window.getAuth || (window.firebaseAuth && window.firebaseAuth.getAuth);
      const _create =
        window.createUserWithEmailAndPassword ||
        (window.firebaseAuth && window.firebaseAuth.createUserWithEmailAndPassword);
      const _signIn =
        window.signInWithEmailAndPassword ||
        (window.firebaseAuth && window.firebaseAuth.signInWithEmailAndPassword);
      const _signOut = window.signOut || (window.firebaseAuth && window.firebaseAuth.signOut);
      const _onAuthStateChanged =
        window.onAuthStateChanged || (window.firebaseAuth && window.firebaseAuth.onAuthStateChanged);

      const auth = getAuth();
      return {
        auth,
        createUserWithEmailAndPassword: (email, password) => _create(auth, email, password),
        signInWithEmailAndPassword: (email, password) => _signIn(auth, email, password),
        // For Google sign-in you'd need to expose GoogleAuthProvider globally in modular too.
        signInWithGooglePopup: async () => {
          throw new Error("Google sign-in requires compat SDK in this setup.");
        },
        signOut: () => _signOut(auth),
        onAuthStateChanged: (cb) => _onAuthStateChanged(auth, cb),
        getIdToken: (user) => user.getIdToken(),
      };
    }

    throw new Error(
      "Firebase Auth SDK not found. Include compat scripts in <head> and initialize firebase.initializeApp(firebaseConfig)."
    );
  }

  // ===== Validators & error mapping =====
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateLogin({ email, password }) {
    if (!email || !emailRegex.test(email)) return "Please enter a valid email.";
    if (!password || password.length < 6) return "Please enter your password (min 6 characters).";
    return null;
  }

  function mapFirebaseError(code) {
    const c = (code || "").toString();
    if (c.includes("email-already-in-use")) return "Email already exists.";
    if (c.includes("invalid-email")) return "That email address looks invalid.";
    if (c.includes("weak-password")) return "Password must be at least 6 characters.";
    if (c.includes("user-not-found")) return "No account found for that email.";
    if (c.includes("wrong-password")) return "Wrong password.";
    if (c.includes("too-many-requests")) return "Too many attempts. Please try again later.";
    if (c.includes("network-request-failed")) return "Network error. Check your connection.";
    if (c.includes("popup-blocked")) return "Popup blocked. Please allow popups or try again.";
    return "Something went wrong. Please try again.";
  }

  // ===== Backend calls =====
  async function ensureLocalUser(idToken) {
    // Create local DB user if not exists; backend should be idempotent
    try {
      await fetch(USERS_SIGNUP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });
    } catch {
      // ignore; it's best-effort
    }
  }

  async function fetchProfile(idToken) {
    const res = await fetch(USERS_ME_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!res.ok) {
      const message =
        res.status === 401 || res.status === 403 ? "Session expired. Please log in again." : `Failed to load profile (${res.status}).`;
      const err = new Error(message);
      err.status = res.status;
      err.body = await res.text().catch(() => "");
      throw err;
    }
    return res.json();
  }

  // ===== Render profile =====
  function renderProfile(info) {
    // We do NOT force the user to fill anything; we just display what we have.
    setText(els.profileEmail, info.email || "");
    setText(els.profileName, info.name || info.display_name || "");
    if (els.profileDob && info.dob) setText(els.profileDob, info.dob);
    if (els.profileGender && info.gender) els.profileGender.value = info.gender || "";
    if (els.profileAvatar && info.avatar_url) setText(els.profileAvatar, info.avatar_url);
  }

  // ===== Auth handlers =====
async function afterAuthSuccess(user, api, silent = false) {
  const idToken = await api.getIdToken(user);

  // Save full user info to localStorage
  localStorage.setItem("loggedInUser", JSON.stringify({
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || "",
    idToken
  }));

  // Ensure user exists in backend DB
  await ensureLocalUser(idToken);

  try {
    // Load extra profile info (dob, gender, etc.)
    const data = await fetchProfile(idToken);

    // Merge backend profile name if Firebase didn't have it
    if (data?.name && !user.displayName) {
      const stored = JSON.parse(localStorage.getItem("loggedInUser"));
      stored.name = data.name;
      localStorage.setItem("loggedInUser", JSON.stringify(stored));
    }

    if (!silent) showToast("Logged in successfully.");

    // Always redirect home (Amazon-style)
    window.location.href = REDIRECT_AFTER_LOGIN;

  } catch (err) {
    clearAuth();
    show("login");
    showToast(err.message || "Could not load your profile.", true);
  }
}


async function handleEmailLogin(e, api) {
  e.preventDefault();
  const email = (e.target.querySelector("#login-email")?.value || "").trim();
  const password = e.target.querySelector("#login-password")?.value || "";

  const validation = validateLogin({ email, password });
  if (validation) return showToast(validation, true);

  try {
    setButtonLoading(els.loginForm, true);
    const cred = await api.signInWithEmailAndPassword(email, password);
    if (!cred?.user) throw new Error("Login failed.");

    if (!cred.user.emailVerified) {
      showToast("Please verify your email before logging in.", true, 4000);
      await api.signOut();
      return;
    }

    await afterAuthSuccess(cred.user, api);
  } catch (err) {
    showToast(mapFirebaseError(err.code) || err.message || "Login failed.", true);
  } finally {
    setButtonLoading(els.loginForm, false);
  }
}


async function handleEmailSignup(e, api) {
  e.preventDefault();
  const email = (e.target.querySelector("#signup-email")?.value || "").trim();
  const name = (e.target.querySelector("#signup-name")?.value || "").trim();
  const password = e.target.querySelector("#signup-password")?.value || "";
  const confirm = e.target.querySelector("#signup-password-confirm")?.value || "";

  let validation = null;
  if (!emailRegex.test(email)) validation = "Please enter a valid email.";
  else if (!name) validation = "Please enter your full name.";
  else if (password.length < 6) validation = "Password must be at least 6 characters.";
  else if (password !== confirm) validation = "Passwords do not match.";

  if (validation) return showToast(validation, true);

  try {
    setButtonLoading(els.signupForm, true);
    const cred = await api.createUserWithEmailAndPassword(email, password);
    if (!cred?.user) throw new Error("Signup failed.");

    // Set displayName
    await cred.user.updateProfile({ displayName: name });

    // Send email verification
    await cred.user.sendEmailVerification();

    // Close modal if present
    if (els.registerModal) els.registerModal.style.display = "none";

    showToast("Account created! Please verify your email before logging in.", false, 4000);
  } catch (err) {
    showToast(mapFirebaseError(err.code) || err.message || "Signup failed.", true);
  } finally {
    setButtonLoading(els.signupForm, false);
  }
}


  async function handleGoogleLogin(api) {
    try {
      setButtonLoading(els.googleBtn, true);
      const cred = await api.signInWithGooglePopup();
      // If redirect flow was triggered, cred may be null; the onAuthStateChanged will handle it.
      if (cred && cred.user) {
        await afterAuthSuccess(cred.user, api);
      } else {
        showToast("Continue Google sign-in…");
      }
    } catch (err) {
      showToast(`Google login failed: ${err.code || err.message || err}`, true);
    } finally {
      setButtonLoading(els.googleBtn, false);
    }
  }

  async function handleLogout(api) {
    try {
      setButtonLoading(els.logoutBtn, true);
      clearAuth();
      await api.signOut();
    } catch {
      // ignore
    } finally {
      setButtonLoading(els.logoutBtn, false);
      window.location.href = "profile.html";
    }
  }

  // ===== Boot =====
  document.addEventListener("DOMContentLoaded", async () => {
    let api;
    try {
      api = getFirebaseAuthAPI();
    } catch (e) {
      console.error(e);
      showToast("Auth not initialized. Check Firebase SDK & CSP.", true);
      show("login");
      return;
    }

    // Wire forms
    if (els.loginForm) els.loginForm.addEventListener("submit", (e) => handleEmailLogin(e, api));
    if (els.signupForm) els.signupForm.addEventListener("submit", (e) => handleEmailSignup(e, api));
    if (els.googleBtn) els.googleBtn.addEventListener("click", (e) => { e.preventDefault(); handleGoogleLogin(api); });
    if (els.logoutBtn) els.logoutBtn.addEventListener("click", (e) => { e.preventDefault(); handleLogout(api); });

    // Initial state
    const stored = loadAuth();
    if (stored?.idToken) {
      try {
        const data = await fetchProfile(stored.idToken);
        renderProfile(data);
        show("profile");
      } catch {
        clearAuth();
        show("login");
      }
    } else {
      show("login");
    }

    // Keep Firebase state in sync (also handles Google redirect)
    try {
      api.onAuthStateChanged(async (user) => {
        if (!user) return;
        // If we already have a token stored, skip (avoid double redirects)
        const st = loadAuth();
        if (st?.idToken) return;
        try {
          await afterAuthSuccess(user, api, /*silent*/ true);
        } catch (e) {
          console.error(e);
        }
      });
    } catch {
      // ignore
    }
  });
})();
