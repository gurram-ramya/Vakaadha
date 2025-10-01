// frontend/profile.js
import { apiRequest, getAuth, setAuth, clearAuth } from "./api/client.js";

/* ---------------- Firebase init ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
  authDomain: "vakaadha.firebaseapp.com",
  projectId: "vakaadha",
  storageBucket: "vakaadha.appspot.com",
  messagingSenderId: "395786980107",
  appId: "1:395786980107:web:6678e452707296df56b00e",
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = () => firebase.auth();
auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => {
  console.warn("Could not set LOCAL persistence:", e);
});

/* ---------------- DOM refs ---------------- */
const $ = (s) => document.querySelector(s);

const els = {
  authSection: $("#auth-section"),
  profileSection: $("#profile-section"),

  // login
  loginForm: $("#login-form"),
  loginEmail: $("#login-email"),
  loginPassword: $("#login-password"),
  loginSubmit: $("#login-submit"),

  // google
  googleBtn: $("#google-btn"),

  // signup
  openSignup: $("#open-signup"),
  signupForm: $("#signup-form"),
  signupName: $("#signup-name"),
  signupEmail: $("#signup-email"),
  signupPassword: $("#signup-password"),
  signupPasswordConfirm: $("#signup-password-confirm"),
  signupSubmit: $("#signup-submit"),
  cancelSignup: $("#cancel-signup"),

  // profile
  verifyBanner: $("#verify-banner"),
  resendVerification: $("#resend-verification"),
  refreshVerification: $("#refresh-verification"),

  profileForm: $("#profile-form"),
  profileName: $("#profile-name"),
  profileEmail: $("#profile-email"),
  profileDob: $("#profile-dob"),
  profileGender: $("#profile-gender"),
  profileAvatar: $("#profile-avatar"),
  profileSave: $("#profile-save"),

  // fixed logout ID
  logout: $("#profile-logout"),

  toast: $("#toast"),
};

/* ---------------- Helpers ---------------- */
function toast(msg, bad = false, ms = 2200) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.style.background = bad ? "#b00020" : "#333";
  els.toast.style.opacity = "1";
  els.toast.style.visibility = "visible";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    els.toast.style.opacity = "0";
    els.toast.style.visibility = "hidden";
  }, ms);
}

function show(section) {
  if (els.authSection) els.authSection.classList.toggle("hidden", section !== "auth");
  if (els.profileSection) els.profileSection.classList.toggle("hidden", section !== "profile");
}

function redirectPostLogin() {
  try {
    const url = sessionStorage.getItem("postLoginRedirect") || "index.html";
    sessionStorage.removeItem("postLoginRedirect");
    window.location.href = url;
  } catch {
    window.location.href = "index.html";
  }
}

/* ---------------- Bootstrap ---------------- */
if (!window.__profile_js_bound__) {
  window.__profile_js_bound__ = true;
  document.addEventListener("DOMContentLoaded", () => {
    wireHandlers();
    initAuthState();
  });
}

/* ---------------- Event handlers ---------------- */
function wireHandlers() {
  // Toggle signup
  els.openSignup?.addEventListener("click", () => {
    els.signupForm?.classList.remove("hidden");
    els.signupName?.focus();
  });
  els.cancelSignup?.addEventListener("click", () => {
    els.signupForm?.classList.add("hidden");
  });

  // Email login
  els.loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.loginSubmit.disabled = true;
    try {
      const cred = await auth().signInWithEmailAndPassword(
        els.loginEmail.value.trim(),
        els.loginPassword.value
      );
      await afterFirebaseAuth(cred.user);
      updateNavbarUser({
        name: cred.user.displayName,
        email: cred.user.email,
      });
      toast("Logged in");
      redirectPostLogin();
    } catch (err) {
      console.error(err);
      toast("Login failed: " + (err.message || ""), true);
    } finally {
      els.loginSubmit.disabled = false;
    }
  });

  // Google sign-in
  els.googleBtn?.addEventListener("click", async () => {
    els.googleBtn.disabled = true;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await auth().signInWithPopup(provider);
      await afterFirebaseAuth(result.user);
      toast("Signed in with Google");
      redirectPostLogin();
    } catch (err) {
      console.error(err);
      toast("Google sign-in failed.", true);
    } finally {
      els.googleBtn.disabled = false;
    }
  });

  // Signup
  els.signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.signupSubmit.disabled = true;

    const name = els.signupName.value.trim();
    const email = els.signupEmail.value.trim();
    const pw = els.signupPassword.value;
    const pw2 = els.signupPasswordConfirm.value;

    if (!name) { toast("Enter your name.", true); els.signupSubmit.disabled = false; return; }
    if (pw.length < 6) { toast("Password must be at least 6 chars.", true); els.signupSubmit.disabled = false; return; }
    if (pw !== pw2) { toast("Passwords do not match.", true); els.signupSubmit.disabled = false; return; }

    try {
      const cred = await auth().createUserWithEmailAndPassword(email, pw);
      await cred.user.updateProfile({ displayName: name }).catch(() => {});
      await afterFirebaseAuth(cred.user);
      els.signupForm.classList.add("hidden");
      toast("Account created");
      redirectPostLogin();
    } catch (err) {
      console.error(err);
      toast("Signup failed: " + (err.message || ""), true);
    } finally {
      els.signupSubmit.disabled = false;
    }
  });

  // Profile save
  els.profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.profileSave.disabled = true;
    try {
      const body = {
        name: els.profileName.value.trim() || null,
        dob: els.profileDob.value || null,
        gender: els.profileGender.value || null,
        avatar_url: els.profileAvatar.value.trim() || null,
      };
      const updated = await apiRequest("/api/users/me/profile", { method: "PUT", body });
      populateProfile(updated);
      toast("Profile saved");
    } catch (err) {
      console.error(err);
      toast("Failed to save profile.", true);
    } finally {
      els.profileSave.disabled = false;
    }
  });

  // Logout (fixed id)
  els.logout?.addEventListener("click", async () => {
    try { await auth().signOut(); } catch {}
    clearAuth();
    location.href = "index.html";
  });
}

/* ---------------- Auth state ---------------- */
function initAuthState() {
  auth().onAuthStateChanged(async (user) => {
    if (!user) { clearAuth(); show("auth"); return; }

    const existing = getAuth();
    if (existing?.idToken && auth().currentUser) {
      try {
        const me = await apiRequest("/api/users/me");
        populateProfile(me);
        show("profile");
        return;
      } catch {
        console.warn("Stored token rejected, refreshing…");
      }
    }

    try {
      await afterFirebaseAuth(user, true);
      show("profile");
    } catch (e) {
      console.error(e);
      show("auth");
    }
  });
}

/* ---------------- Auth + Profile sync ---------------- */
async function afterFirebaseAuth(user, silent = false) {
  await user.reload();
  const idToken = await user.getIdToken(true);

  // Grab any guest_id
  const guestId = localStorage.getItem("guest_id");

  // Register user with backend (send guest_id for merge)
  let backendUser;
  try {
    const res = await apiRequest("/api/auth/register", {
      method: "POST",
      body: guestId ? { guest_id: guestId } : {},
    });
    backendUser = res; // must include user_id
  } catch (e) {
    console.warn("Register sync failed:", e);
  }

  // Store enriched auth state
  setAuth({
    idToken,
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email,
    photoURL: user.photoURL || null,
    user_id: backendUser?.user_id || null,
  });

  // Always drop guest_id after merge attempt
  if (guestId) {
    localStorage.removeItem("guest_id");
  }

  if (!silent) toast("Signed in");
}

function populateProfile(me) {
  if (!els.profileSection) return;
  if (els.profileName)   els.profileName.value   = me.name || "";
  if (els.profileEmail)  els.profileEmail.value  = me.email || "";
  if (els.profileDob)    els.profileDob.value    = me.dob || "";
  if (els.profileGender) els.profileGender.value = me.gender || "";
  if (els.profileAvatar) els.profileAvatar.value = me.avatar_url || "";

  // Pass backend-enriched user to navbar
  if (window.updateNavbarUser) {
    window.updateNavbarUser({
      user_id: me.user_id,
      name: me.name,
      email: me.email,
    });
  }
}

async function refreshEmailVerified() {
  try {
    const user = auth().currentUser;
    if (!user) return;
    await user.reload();
    const token = await user.getIdToken(true);
    setAuth({ ...getAuth(), idToken: token });
    const me = await apiRequest("/api/users/me");
    updateVerifyBanner(me);
  } catch (e) {
    console.error(e);
  }
}

function updateVerifyBanner(me) {
  if (!els.verifyBanner) return;
  const user = auth().currentUser;
  const verified = (user && user.emailVerified) || !!me?.email_verified;
  els.verifyBanner.classList.toggle("hidden", !!verified);
  document.body.classList.toggle("unverified", !verified);
}

function updateNavbarUser(me) {
  const el = document.getElementById("user-display");
  if (el) {
    el.textContent = me?.name || me?.email || "";
  }
}
