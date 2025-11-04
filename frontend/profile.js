// // ============================================================
// // profile.js — Revised with Deep Debug Hooks
// // ============================================================

// const { apiRequest, getAuth, setAuth, clearAuth } = window;

// /* ---------------- Firebase init ---------------- */
// const firebaseConfig = {
//   apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
//   authDomain: "vakaadha.firebaseapp.com",
//   projectId: "vakaadha",
//   storageBucket: "vakaadha.appspot.com",
//   messagingSenderId: "395786980107",
//   appId: "1:395786980107:web:6678e452707296df56b00e",
// };
// if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
// const auth = () => firebase.auth();
// auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => {
//   console.warn("[profile.js] LOCAL persistence failed:", e);
// });

// /* ---------------- DOM refs ---------------- */
// const $ = (s) => document.querySelector(s);
// const els = {
//   authSection: $("#auth-section"),
//   profileSection: $("#profile-section"),
//   loginForm: $("#login-form"),
//   loginEmail: $("#login-email"),
//   loginPassword: $("#login-password"),
//   loginSubmit: $("#login-submit"),
//   googleBtn: $("#google-btn"),
//   openSignup: $("#open-signup"),
//   signupForm: $("#signup-form"),
//   signupName: $("#signup-name"),
//   signupEmail: $("#signup-email"),
//   signupPassword: $("#signup-password"),
//   signupPasswordConfirm: $("#signup-password-confirm"),
//   signupSubmit: $("#signup-submit"),
//   cancelSignup: $("#cancel-signup"),
//   verifyBanner: $("#verify-banner"),
//   resendVerification: $("#resend-verification"),
//   refreshVerification: $("#refresh-verification"),
//   profileForm: $("#profile-form"),
//   profileName: $("#profile-name"),
//   profileEmail: $("#profile-email"),
//   profileDob: $("#profile-dob"),
//   profileGender: $("#profile-gender"),
//   profileAvatar: $("#profile-avatar"),
//   profileSave: $("#profile-save"),
//   logout: $("#profile-logout"),
//   toast: $("#toast"),
// };

// /* ---------------- UI helpers ---------------- */
// function toast(msg, bad = false, ms = 2200) {
//   if (!els.toast) return;
//   console.debug("[toast]", msg);
//   els.toast.textContent = msg;
//   els.toast.style.background = bad ? "#b00020" : "#333";
//   els.toast.style.opacity = "1";
//   els.toast.style.visibility = "visible";
//   clearTimeout(toast._t);
//   toast._t = setTimeout(() => {
//     els.toast.style.opacity = "0";
//     els.toast.style.visibility = "hidden";
//   }, ms);
// }

// function show(section) {
//   if (els.authSection) els.authSection.classList.toggle("hidden", section !== "auth");
//   if (els.profileSection) els.profileSection.classList.toggle("hidden", section !== "profile");
//   console.debug("[UI] Switched to", section, "view");
// }

// function redirectPostLogin() {
//   try {
//     const url = sessionStorage.getItem("postLoginRedirect") || "index.html";
//     sessionStorage.removeItem("postLoginRedirect");
//     window.location.href = url;
//   } catch {
//     window.location.href = "index.html";
//   }
// }

// /* ---------------- Bootstrap ---------------- */
// if (!window.__profile_js_bound__) {
//   window.__profile_js_bound__ = true;
//   document.addEventListener("DOMContentLoaded", () => {
//     wireHandlers();
//     initAuthState();
//   });
// }

// /* ---------------- Event handlers ---------------- */
// function wireHandlers() {
//   els.openSignup?.addEventListener("click", () => {
//     els.signupForm?.classList.remove("hidden");
//     els.signupName?.focus();
//   });
//   els.cancelSignup?.addEventListener("click", () => {
//     els.signupForm?.classList.add("hidden");
//   });

//   // Email login
//   els.loginForm?.addEventListener("submit", async (e) => {
//     e.preventDefault();
//     els.loginSubmit.disabled = true;
//     try {
//       console.debug("[Login] Signing in with email/password");
//       const cred = await auth().signInWithEmailAndPassword(
//         els.loginEmail.value.trim(),
//         els.loginPassword.value
//       );
//       await afterFirebaseAuth(cred.user);
//       toast("Logged in");
//       redirectPostLogin();
//     } catch (err) {
//       console.error("[Login error]", err);
//       toast("Login failed: " + (err.message || ""), true);
//     } finally {
//       els.loginSubmit.disabled = false;
//     }
//   });

//   // Google sign-in
//   els.googleBtn?.addEventListener("click", async () => {
//     els.googleBtn.disabled = true;
//     try {
//       console.debug("[Google] Starting sign-in");
//       const provider = new firebase.auth.GoogleAuthProvider();
//       provider.setCustomParameters({ prompt: "select_account" });
//       const result = await auth().signInWithPopup(provider);
//       await afterFirebaseAuth(result.user);
//       toast("Signed in with Google");
//       redirectPostLogin();
//     } catch (err) {
//       console.error("[Google error]", err);
//       toast("Google sign-in failed.", true);
//     } finally {
//       els.googleBtn.disabled = false;
//     }
//   });

//   // Signup
//   els.signupForm?.addEventListener("submit", async (e) => {
//     e.preventDefault();
//     els.signupSubmit.disabled = true;
//     const name = els.signupName.value.trim();
//     const email = els.signupEmail.value.trim();
//     const pw = els.signupPassword.value;
//     const pw2 = els.signupPasswordConfirm.value;

//     if (!name || pw.length < 6 || pw !== pw2) {
//       toast("Invalid signup info.", true);
//       els.signupSubmit.disabled = false;
//       return;
//     }

//     try {
//       console.debug("[Signup] Creating user", email);
//       const cred = await auth().createUserWithEmailAndPassword(email, pw);
//       await cred.user.updateProfile({ displayName: name }).catch(() => {});
//       await afterFirebaseAuth(cred.user);
//       els.signupForm.classList.add("hidden");
//       toast("Account created");
//       redirectPostLogin();
//     } catch (err) {
//       console.error("[Signup error]", err);
//       toast("Signup failed: " + (err.message || ""), true);
//     } finally {
//       els.signupSubmit.disabled = false;
//     }
//   });

//   // Profile save
//   els.profileForm?.addEventListener("submit", async (e) => {
//     e.preventDefault();
//     els.profileSave.disabled = true;
//     try {
//       const body = {
//         name: els.profileName.value.trim() || null,
//         dob: els.profileDob.value || null,
//         gender: els.profileGender.value || null,
//         avatar_url: els.profileAvatar.value.trim() || null,
//       };
//       console.debug("[Profile PUT] Sending body", body);
//       const updated = await apiRequest("/api/users/me/profile", { method: "PUT", body });
//       console.debug("[Profile PUT] Response", updated);
//       populateProfile(updated);
//       toast("Profile saved");
//     } catch (err) {
//       console.error("[Profile save error]", err);
//       toast("Failed to save profile.", true);
//     } finally {
//       els.profileSave.disabled = false;
//     }
//   });

//   // Logout
//   els.logout?.addEventListener("click", async () => {
//     console.debug("[Logout] Performing full logout via auth.js");
//     try {
//       await window.auth.logout(); // ensures backend + firebase + guest reset
//     } catch (e) {
//       console.warn("[Logout] auth.js logout failed:", e);
//       try { await auth().signOut(); } catch {}
//       clearAuth();
//     }
//     location.href = "index.html";
//   });


// }

// /* ---------------- Auth state ---------------- */
// function initAuthState() {
//   console.info("[AuthState] Initializing listener");
//   auth().onAuthStateChanged(async (user) => {
//     console.info("[AuthStateChanged] user =", user ? user.uid : "none");
//     if (!user) { clearAuth(); show("auth"); return; }

//     try {
//       await afterFirebaseAuth(user, true);
//       show("profile");
//     } catch (e) {
//       console.error("[AuthState] Sync error", e);
//       show("auth");
//     }
//   });
// }

// /* ---------------- Sync + Profile ---------------- */
// async function afterFirebaseAuth(user, silent = false) {
//   await user.reload();
//   const idToken = await user.getIdToken(true);
//   console.debug("[Firebase] UID:", user.uid, "| Email:", user.email);
//   console.debug("[Firebase] Token prefix:", idToken.slice(0, 40));

//   const guestId = localStorage.getItem("guest_id");
//   setAuth({
//     idToken,
//     uid: user.uid,
//     email: user.email,
//     name: user.displayName || user.email,
//     photoURL: user.photoURL || null,
//   });

//   let backendUser = null;
//   try {
//     console.debug("[Backend] POST /api/auth/register guest_id =", guestId);
//     const res = await apiRequest("/api/auth/register", {
//       method: "POST",
//       body: guestId ? { guest_id: guestId } : {},
//     });
//     backendUser = res?.user || res;
//     console.debug("[Backend] register response:", backendUser);

//     console.debug("[Backend] GET /api/users/me …");
//     const me = await apiRequest("/api/users/me");
//     console.debug("[Backend] /me result:", me);
//     populateProfile(me);
//   } catch (err) {
//     console.warn("[Sync] Failed to register/profile:", err);
//   }

//   setAuth({
//     ...getAuth(),
//     user_id: backendUser?.user_id || null,
//   });

//   if (guestId) localStorage.removeItem("guest_id");
//   if (!silent) toast("Signed in");
// }

// /* ---------------- Populate Profile ---------------- */
// function populateProfile(me) {
//   console.debug("[PopulateProfile] incoming", me);
//   if (!me || !els.profileSection) return;

//   els.profileName.value = me.name || "";
//   els.profileEmail.value = me.email || "";
//   els.profileDob.value = me.dob || "";
//   els.profileGender.value = me.gender || "";
//   els.profileAvatar.value = me.avatar_url || "";

//   console.debug("[PopulateProfile] DOM updated");
//   if (window.updateNavbarUser) {
//     console.debug("[Navbar Sync] Updating navbar with", me.name || me.email);
//     window.updateNavbarUser({
//       user_id: me.user_id,
//       name: me.name,
//       email: me.email,
//     });
//   }
// }

// /* ---------------- Verification ---------------- */
// async function refreshEmailVerified() {
//   try {
//     const user = auth().currentUser;
//     if (!user) return;
//     await user.reload();
//     const token = await user.getIdToken(true);
//     setAuth({ ...getAuth(), idToken: token });
//     const me = await apiRequest("/api/users/me");
//     updateVerifyBanner(me);
//   } catch (e) {
//     console.error("[EmailVerify] refresh failed", e);
//   }
// }

// function updateVerifyBanner(me) {
//   if (!els.verifyBanner) return;
//   const user = auth().currentUser;
//   const verified = (user && user.emailVerified) || !!me?.email_verified;
//   els.verifyBanner.classList.toggle("hidden", !!verified);
//   document.body.classList.toggle("unverified", !verified);
//   console.debug("[VerifyBanner] email_verified =", verified);
// }

// function updateNavbarUser(me) {
//   const el = document.getElementById("user-display");
//   if (el) el.textContent = me?.name || me?.email || "";
// }




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

  // Signup (email/password)
  els.signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.signupSubmit.disabled = true;

    const name = els.signupName.value.trim();
    const email = els.signupEmail.value.trim();
    const pw = els.signupPassword.value;
    const pw2 = els.signupPasswordConfirm.value;

    if (!name || !email || pw.length < 6 || pw !== pw2) {
      toast("Invalid signup info.", true);
      els.signupSubmit.disabled = false;
      return;
    }

    try {
      console.debug("[SIGNUP] Creating Firebase account:", email);
      const cred = await auth().createUserWithEmailAndPassword(email, pw);

      // 1. Set name
      await cred.user.updateProfile({ displayName: name });

      // 2. Reload to sync name with Firebase backend
      await cred.user.reload();

      // 3. Force new token containing displayName
      const refreshedToken = await cred.user.getIdToken(true);
      console.debug("[SIGNUP] Token refreshed after name update");

      // 4. Proceed with backend sync using fresh user object
      await afterFirebaseAuth(cred.user, false, name);
      toast("Account created");
    } catch (err) {
      console.error("[SIGNUP ERROR]", err);
      toast("Signup failed: " + (err.message || ""), true);
    } finally {
      els.signupSubmit.disabled = false;
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
  // els.logout?.addEventListener("click", async () => {
  //   console.debug("[LOGOUT] Performing full logout");
  //   try {
  //     if (window.auth?.logout) {
  //       await window.auth.logout();
  //     } else {
  //       await auth().signOut();
  //     }
  //   } catch (err) {
  //     console.warn("[LOGOUT] Firebase logout failed:", err);
  //     try { await auth().signOut(); } catch {}
  //   }
  //   clearAuth();
  //   location.href = "index.html";
  // });

  // Logout (delegated to global navbar logout)
  els.logout?.addEventListener("click", async () => {
    console.debug("[LOGOUT] Triggered from profile section");
    window.__logout_in_progress__ = true;
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
    location.href = "/";
  });

}

/* ---------------- Auth state ---------------- */
function initAuthState() {
  console.debug("[AUTH] Setting up Firebase auth listener");
  auth().onAuthStateChanged(async (user) => {
    console.debug("[AUTHSTATE] Changed:", user ? user.uid : "none");

    // Guard: skip handling while logout is in progress
    if (window.__logout_in_progress__) {
      console.debug("[AUTHSTATE] Skipped (logout in progress)");
      return;
    }

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
async function afterFirebaseAuth(user, silent = false, providedName = null) {
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
      const body = guestId ? { guest_id: guestId } : {};
      if (providedName) body.name = providedName;
      const regRes = await apiRequest("/api/auth/register", {
        method: "POST",
        body,
      });
      console.debug("[SYNC] register() returned:", regRes);
      backendUser = regRes?.user || regRes;

      console.debug("[SYNC] -> GET /api/users/me");
      const me = await apiRequest("/api/users/me");
      console.debug("[SYNC] /me payload:", me);
      populateProfile(me);

      // ensure frontend Firebase user matches backend name
      if (me && me.name && (!user.displayName || user.displayName !== me.name)) {
        try {
          await user.updateProfile({ displayName: me.name });
          await user.reload();
          console.debug("[SYNC] Local Firebase profile updated with backend name");
        } catch (e) {
          console.warn("[SYNC] Failed to update Firebase displayName:", e);
        }
      }
    } catch (err) {
      console.error("[SYNC ERROR]", err);
    }

    // setAuth({ ...getAuth(), user_id: backendUser?.user_id || null });
    // if (guestId) localStorage.removeItem("guest_id");
    // if (!silent) toast("Signed in");

    setAuth({ ...getAuth(), user_id: backendUser?.user_id || null });
    if (guestId) localStorage.removeItem("guest_id");

    // Force profile refresh and DOM population
    try {
      const me = await apiRequest("/api/users/me");
      populateProfile(me);
      show("profile");
    } catch (err) {
      console.error("[POST-AUTH PROFILE REFRESH ERROR]", err);
    }

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
