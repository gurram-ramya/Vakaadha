// // ======================================================
// //  Load Logged-In User + Prefill Fields
// // ======================================================
// document.addEventListener("DOMContentLoaded", async () => {
//     fetchUser();
//     setupGenderButtons();
//     setupMobileChange();
//     setupFormSubmit();
// });

// let CURRENT_USER = null;

// // ------------------------------------------------------
// // Fetch user data
// // ------------------------------------------------------
// async function fetchUser() {
//     try {
//         const res = await fetch("/api/users/me", {
//             method: "GET",
//             credentials: "include"
//         });

//         if (!res.ok) {
//             window.location.href = "/login.html";
//             return;
//         }

//         CURRENT_USER = await res.json();
//         fillForm(CURRENT_USER);

//     } catch (err) {
//         console.error("Profile load failed:", err);
//         window.location.href = "/login.html";
//     }
// }

// // ------------------------------------------------------
// // Prefill inputs
// // ------------------------------------------------------
// function fillForm(u) {
//     document.getElementById("navProfileName").textContent = u.fullName || "Account";

//     document.getElementById("mobile").value = u.mobile || "";
//     document.getElementById("fullName").value = u.fullName || "";
//     document.getElementById("email").value = u.email || "";
//     document.getElementById("dob").value = u.dob || "";
//     document.getElementById("altMobile").value = u.altMobile || "";
//     document.getElementById("hintName").value = u.hintName || "";

//     // Gender button activation
//     if (u.gender) {
//         const btn = document.querySelector(`.gender-btn[data-value="${u.gender}"]`);
//         if (btn) btn.classList.add("active");
//     }
// }

// // ======================================================
// //  Gender Selection
// // ======================================================
// function setupGenderButtons() {
//     const buttons = document.querySelectorAll(".gender-btn");

//     buttons.forEach(btn => {
//         btn.addEventListener("click", () => {
//             buttons.forEach(b => b.classList.remove("active"));
//             btn.classList.add("active");
//         });
//     });
// }

// // ======================================================
// //  MOBILE CHANGE WORKFLOW (Frontend Only)
// // ======================================================
// function setupMobileChange() {
//     const changeBtn = document.getElementById("changeMobileBtn");
//     const mobileInput = document.getElementById("mobile");

//     changeBtn.addEventListener("click", () => {
//         const newMobile = prompt("Enter new mobile number:");

//         if (!newMobile) return;

//         if (!/^\d{6,15}$/.test(newMobile)) {
//             alert("Enter a valid mobile number.");
//             return;
//         }

//         // Future: trigger OTP here
//         alert("Mobile change requires OTP verification (backend needed).");

//         // For now just update the UI (not saved yet)
//         mobileInput.value = newMobile;
//     });
// }

// // ======================================================
// //  SAVE DETAILS
// // ======================================================
// function setupFormSubmit() {
//     const form = document.getElementById("editProfileForm");

//     form.addEventListener("submit", async (e) => {
//         e.preventDefault();

//         const updated = collectUpdatedFields();

//         if (Object.keys(updated).length === 0) {
//             alert("No changes to save.");
//             return;
//         }

//         try {
//             const res = await fetch("/api/users/update", {
//                 method: "PUT",
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 credentials: "include",
//                 body: JSON.stringify(updated)
//             });

//             if (!res.ok) {
//                 alert("Failed to update profile.");
//                 return;
//             }

//             alert("Profile updated successfully.");
//             window.location.href = "/profile.html";

//         } catch (err) {
//             alert("Error saving profile.");
//         }
//     });
// }

// // ------------------------------------------------------
// // Only send changed fields
// // ------------------------------------------------------
// function collectUpdatedFields() {
//     const u = CURRENT_USER;
//     const out = {};

//     const fullName = document.getElementById("fullName").value.trim();
//     const email = document.getElementById("email").value.trim();
//     const dob = document.getElementById("dob").value.trim();
//     const altMobile = document.getElementById("altMobile").value.trim();
//     const hintName = document.getElementById("hintName").value.trim();
//     const mobile = document.getElementById("mobile").value.trim();

//     const genderBtn = document.querySelector(".gender-btn.active");
//     const gender = genderBtn ? genderBtn.getAttribute("data-value") : null;

//     if (fullName !== (u.fullName || "")) out.fullName = fullName;
//     if (email !== (u.email || "")) out.email = email;
//     if (dob !== (u.dob || "")) out.dob = dob;
//     if (altMobile !== (u.altMobile || "")) out.altMobile = altMobile;
//     if (hintName !== (u.hintName || "")) out.hintName = hintName;
//     if (mobile !== (u.mobile || "")) out.mobile = mobile;
//     if (gender && gender !== u.gender) out.gender = gender;

//     return out;
// }

