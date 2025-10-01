// navbar.js – unified token handling
(function () {
  const WISHLIST_KEY = "vakaadha_wishlist_v1";
  const GUEST_KEY = "guest_id";
  const API_BASE = "/api/cart";

  function getToken() {
    try {
      const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
      return user && user.idToken ? user.idToken : null;
    } catch {
      return null;
    }
  }

  function getGuestId() {
    let gid = localStorage.getItem(GUEST_KEY);
    if (!gid) {
      gid = crypto.randomUUID();
      localStorage.setItem(GUEST_KEY, gid);
    }
    return gid;
  }

  async function fetchCartCount() {
    const token = getToken();
    let url = API_BASE;
    if (!token) {
      url += `?guest_id=${getGuestId()}`;
    }

    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Cart fetch failed");
      const data = await res.json();
      if (!data || !Array.isArray(data.items)) return 0;
      return data.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    } catch (err) {
      console.warn("Cart count update failed:", err);
      return 0;
    }
  }

  function readWishlist() {
    try {
      return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    } catch {
      return [];
    }
  }

  async function updateNavbarCounts() {
    const wishlist = readWishlist();
    const wishlistCount = Array.isArray(wishlist) ? wishlist.length : 0;
    const wishEl = document.getElementById("wishlistCount");
    if (wishEl) wishEl.textContent = wishlistCount;

    const cartCount = await fetchCartCount();
    const cartEl = document.getElementById("cartCount");
    if (cartEl) cartEl.textContent = cartCount;
  }

  function updateAuthUI() {
    const auth = JSON.parse(localStorage.getItem("loggedInUser") || "null");
    const loginLink = document.getElementById("loginLink");
    const profileLink = document.getElementById("profileLink");
    const logoutLink = document.getElementById("navbar-logout");

    if (auth && auth.idToken) {
      if (loginLink) loginLink.style.display = "none";
      if (profileLink) profileLink.style.display = "inline-block";
      if (logoutLink) logoutLink.style.display = "inline-block";
    } else {
      if (loginLink) loginLink.style.display = "inline-block";
      if (profileLink) profileLink.style.display = "none";
      if (logoutLink) logoutLink.style.display = "none";
    }
  }

  // --- merge guest cart into user cart after login ---
  async function mergeCartOnLogin() {
    const token = getToken();
    const guestId = localStorage.getItem(GUEST_KEY);
    if (!token || !guestId) return;

    try {
      const res = await fetch("/api/cart/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ guest_id: guestId }),
      });
      if (!res.ok) throw new Error("Cart merge failed");
      await res.json();
      localStorage.removeItem(GUEST_KEY); // Clear guest ID after merge
      if (typeof updateNavbarCounts === "function") updateNavbarCounts();
    } catch (err) {
      console.warn("Cart merge failed:", err);
    }
  }

  function wireLogout() {
    const logoutLink = document.getElementById("navbar-logout");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (window.firebase && firebase.auth) {
          await firebase.auth().signOut();
        }
      } catch (err) {
        console.warn("Firebase signOut failed:", err);
      }
      localStorage.removeItem("loggedInUser");
      localStorage.removeItem(GUEST_KEY);
      localStorage.setItem(GUEST_KEY, crypto.randomUUID()); // new guest cart
      window.location.href = "index.html";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateNavbarCounts();
    updateAuthUI();
    wireLogout();
  });

  window.updateNavbarCounts = updateNavbarCounts;
  window.refreshCartCount = updateNavbarCounts;

  window.updateNavbarUser = function (user) {
    const el = document.getElementById("user-display");
    if (el) el.textContent = user?.name || user?.email || "";
    if (user) {
      localStorage.setItem("loggedInUser", JSON.stringify(user));
      mergeCartOnLogin();
    }
    updateAuthUI();
    updateNavbarCounts();
  };
})();
