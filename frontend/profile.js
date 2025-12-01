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
