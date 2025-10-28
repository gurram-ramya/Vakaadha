// ============================================================
// profile.js — Deep Debug Instrumentation Build (fixed logout)
// ============================================================

const { apiRequest, getAuth, setAuth, clearAuth } = window;

/* ---------------- Firebase init ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
  authDomain: "vakaadha.firebaseapp.com",
  projectId: "vakaadha",
  storageBucket: "vakaadha.appspot.com",
  messagingSenderId: "395786980107",
  appId: "1:395786980107:web:6678e452707296df56b00e",
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = () => firebase.auth();
auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => {
  console.warn("[profile.js] LOCAL persistence failed:", e);
});

/* ---------------- DOM refs ---------------- */
const $ = (s) => document.querySelector(s);
const els = {
  authSection: $("#auth-section"),
  profileSection: $("#profile-section"),
  loginForm: $("#login-form"),
  loginEmail: $("#login-email"),
  loginPassword: $("#login-password"),
  loginSubmit: $("#login-submit"),
  googleBtn: $("#google-btn"),
  openSignup: $("#open-signup"),
  signupForm: $("#signup-form"),
  signupName: $("#signup-name"),
  signupEmail: $("#signup-email"),
  signupPassword: $("#signup-password"),
  signupPasswordConfirm: $("#signup-password-confirm"),
  signupSubmit: $("#signup-submit"),
  cancelSignup: $("#cancel-signup"),
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
  logout: $("#profile-logout"),
  toast: $("#toast"),
};

/* ---------------- UI helpers ---------------- */
function toast(msg, bad = false, ms = 2200) {
  if (!els.toast) return;
  console.debug("[toast]", msg);
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
  console.debug(`[UI] view => ${section}`);
}

/* ---------------- Bootstrap ---------------- */
if (!window.__profile_js_bound__) {
  window.__profile_js_bound__ = true;
  document.addEventListener("DOMContentLoaded", () => {
    console.debug("[BOOT] DOM ready, binding handlers");
    wireHandlers();
    initAuthState();
  });
}

/* ---------------- Event handlers ---------------- */
function wireHandlers() {
  console.debug("[WIRE] Registering UI handlers");

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
    console.debug("[LOGIN] Submitting email/password");
    els.loginSubmit.disabled = true;
    try {
      const cred = await auth().signInWithEmailAndPassword(
        els.loginEmail.value.trim(),
        els.loginPassword.value
      );
      console.debug("[LOGIN] Firebase credential received:", cred.user?.uid);
      await afterFirebaseAuth(cred.user);
      toast("Logged in");
    } catch (err) {
      console.error("[LOGIN ERROR]", err);
      toast("Login failed: " + (err.message || ""), true);
    } finally {
      els.loginSubmit.disabled = false;
    }
  });

  // Google sign-in
  els.googleBtn?.addEventListener("click", async () => {
    console.debug("[GOOGLE] Initiating Google sign-in flow");
    els.googleBtn.disabled = true;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await auth().signInWithPopup(provider);
      console.debug("[GOOGLE] Firebase user:", result.user?.uid);
      await afterFirebaseAuth(result.user);
      toast("Signed in with Google");
    } catch (err) {
      console.error("[GOOGLE ERROR]", err);
      toast("Google sign-in failed.", true);
    } finally {
      els.googleBtn.disabled = false;
    }
  });

  // Profile save
  els.profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.profileSave.disabled = true;
    const body = {
      name: els.profileName.value.trim() || null,
      dob: els.profileDob.value || null,
      gender: els.profileGender.value || null,
      avatar_url: els.profileAvatar.value.trim() || null,
    };
    console.debug("[PROFILE SAVE] Sending:", body);
    try {
      const updated = await apiRequest("/api/users/me/profile", { method: "PUT", body });
      console.debug("[PROFILE SAVE] Response:", updated);
      populateProfile(updated);
      toast("Profile saved");
    } catch (err) {
      console.error("[PROFILE SAVE ERROR]", err);
      toast("Failed to save profile.", true);
    } finally {
      els.profileSave.disabled = false;
    }
  });

  // Logout (restored)
  els.logout?.addEventListener("click", async () => {
    console.debug("[LOGOUT] Performing full logout");
    try {
      if (window.auth?.logout) {
        await window.auth.logout();
      } else {
        await auth().signOut();
      }
    } catch (err) {
      console.warn("[LOGOUT] Firebase logout failed:", err);
      try { await auth().signOut(); } catch {}
    }
    clearAuth();
    location.href = "index.html";
  });
}

/* ---------------- Auth state ---------------- */
function initAuthState() {
  console.debug("[AUTH] Setting up Firebase auth listener");
  auth().onAuthStateChanged(async (user) => {
    console.debug("[AUTHSTATE] Changed:", user ? user.uid : "none");
    if (!user) {
      clearAuth();
      show("auth");
      return;
    }
    try {
      await afterFirebaseAuth(user, true);
      show("profile");
    } catch (e) {
      console.error("[AUTHSTATE ERROR]", e);
      show("auth");
    }
  });
}

/* ---------------- Sync + Profile ---------------- */
async function afterFirebaseAuth(user, silent = false) {
  console.groupCollapsed("[SYNC] afterFirebaseAuth()");
  try {
    await user.reload();
    const idToken = await user.getIdToken(true);
    console.debug("Firebase UID:", user.uid);
    console.debug("Email:", user.email);
    console.debug("DisplayName:", user.displayName);
    console.debug("PhotoURL:", user.photoURL);
    console.debug("Token sample:", idToken.slice(0, 32) + "...");

    const guestId = localStorage.getItem("guest_id");
    console.debug("GuestID local:", guestId);

    setAuth({
      idToken,
      uid: user.uid,
      email: user.email,
      name: user.displayName || user.email,
      photoURL: user.photoURL || null,
    });

    let backendUser = null;
    try {
      console.debug("[SYNC] -> POST /api/auth/register");
      const regRes = await apiRequest("/api/auth/register", {
        method: "POST",
        body: guestId ? { guest_id: guestId } : {},
      });
      console.debug("[SYNC] register() returned:", regRes);
      backendUser = regRes?.user || regRes;

      console.debug("[SYNC] -> GET /api/users/me");
      const me = await apiRequest("/api/users/me");
      console.debug("[SYNC] /me payload:", me);
      populateProfile(me);
    } catch (err) {
      console.error("[SYNC ERROR]", err);
    }

    setAuth({ ...getAuth(), user_id: backendUser?.user_id || null });
    if (guestId) localStorage.removeItem("guest_id");
    if (!silent) toast("Signed in");
  } finally {
    console.groupEnd();
  }
}

/* ---------------- Populate Profile ---------------- */
function populateProfile(me) {
  console.groupCollapsed("[POPULATE PROFILE]");
  try {
    console.debug("Incoming data:", me);
    if (!me || !els.profileSection) {
      console.warn("Profile data or section missing");
      return;
    }

    els.profileName.value = me.name || "";
    els.profileEmail.value = me.email || "";
    els.profileDob.value = me.dob || "";
    els.profileGender.value = me.gender || "";
    els.profileAvatar.value = me.avatar_url || "";

    console.table({
      name: els.profileName.value,
      email: els.profileEmail.value,
      dob: els.profileDob.value,
      gender: els.profileGender.value,
      avatar_url: els.profileAvatar.value,
    });
    console.debug("DOM updated successfully");
  } finally {
    console.groupEnd();
  }
}

/* ---------------- Verification ---------------- */
function updateVerifyBanner(me) {
  const user = auth().currentUser;
  const verified = (user && user.emailVerified) || !!me?.email_verified;
  console.debug("[VERIFY] Email verified =", verified);
  if (els.verifyBanner) {
    els.verifyBanner.classList.toggle("hidden", !!verified);
    document.body.classList.toggle("unverified", !verified);
  }
}
