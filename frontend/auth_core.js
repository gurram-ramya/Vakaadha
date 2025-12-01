// auth_core.js — shared Firebase → backend sync for Vakaadha

(function () {
  if (window.__auth_core_bound__) return;
  window.__auth_core_bound__ = true;

  const GUEST_KEY = "guest_id";

  /**
   * Core sync after Firebase sign-in (phone, email, Google, etc.)
   * - Refreshes token
   * - Registers/merges user with backend
   * - Fetches /api/users/me
   * - Aligns Firebase displayName with backend name
   * - Updates auth cache (setAuth)
   *
   * Does NOT touch DOM or redirect.
   */
  async function afterFirebaseAuth(user, opts = {}) {
    const { providedName = null, silent = false } = opts || {};
    console.groupCollapsed("[AuthCore] afterFirebaseAuth()");
    try {
      if (!user) throw new Error("No Firebase user provided");

      await user.reload();
      const idToken = await user.getIdToken(true);

      console.debug("[AuthCore] Firebase UID:", user.uid);
      console.debug("[AuthCore] Email:", user.email);
      console.debug("[AuthCore] DisplayName:", user.displayName);
      console.debug("[AuthCore] PhotoURL:", user.photoURL);
      console.debug("[AuthCore] Token sample:", idToken.slice(0, 32) + "...");

      const guestId = localStorage.getItem(GUEST_KEY);
      console.debug("[AuthCore] GuestID local:", guestId);

      // Seed auth cache so apiRequest() can attach Authorization
      if (window.setAuth) {
        window.setAuth({
          idToken,
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email,
          photoURL: user.photoURL || null,
        });
      }

      let backendUser = null;
      let me = null;
      try {
        console.debug("[AuthCore] -> POST /api/auth/register");

        const body = {};
        if (providedName) body.name = providedName;

        const regRes = await window.apiRequest("/api/auth/register", {
          method: "POST",
          body,
          headers: guestId ? { "X-Guest-Id": guestId } : {},
        });

        console.debug("[AuthCore] register() returned:", regRes);
        backendUser = regRes?.user || regRes;

        console.debug("[AuthCore] -> GET /api/users/me");
        me = await window.apiRequest("/api/users/me");
        console.debug("[AuthCore] /me payload:", me);

        // Align Firebase displayName with backend name
        if (me && me.name && (!user.displayName || user.displayName !== me.name)) {
          try {
            await user.updateProfile({ displayName: me.name });
            await user.reload();
            console.debug("[AuthCore] Firebase displayName updated from backend name");
          } catch (e) {
            console.warn("[AuthCore] Failed to update Firebase displayName:", e);
          }
        }
      } catch (err) {
        console.error("[AuthCore] Backend sync error:", err);
      }

      // Merge user_id into auth cache
      try {
        const current = (window.getAuth && window.getAuth()) || {};
        if (window.setAuth) {
          window.setAuth({
            ...current,
            user_id: backendUser?.user_id || me?.user_id || current.user_id || null,
          });
        }
      } catch (e) {
        console.warn("[AuthCore] Failed to extend auth cache with user_id:", e);
      }

      // Clear guest id if present
      if (guestId) {
        localStorage.removeItem(GUEST_KEY);
        console.debug("[AuthCore] GuestID cleared from localStorage");
      }

      return { me, backendUser };
    } finally {
      console.groupEnd();
    }
  }

  window.AuthCore = {
    afterFirebaseAuth,
  };
})();
