// ==============================
// frontend/profile.js
// User profile page logic
// ==============================

import { apiClient } from "./api/client.js";

// DOM references
const profileForm = document.getElementById("profile-form");
const nameInput = document.getElementById("profile-name");
const emailInput = document.getElementById("profile-email");
const dobInput = document.getElementById("profile-dob");
const genderInput = document.getElementById("profile-gender");
const avatarInput = document.getElementById("profile-avatar");
const saveBtn = document.getElementById("profile-save");

// Load profile data
async function loadProfile() {
  try {
    const user = await apiClient.get("users/me");
    nameInput.value = user.name || "";
    emailInput.value = user.email || "";
    if (user.profile) {
      dobInput.value = user.profile.dob || "";
      genderInput.value = user.profile.gender || "";
      avatarInput.value = user.profile.avatar_url || "";
    }
  } catch (err) {
    alert("Failed to load profile: " + err.message);
  }
}

// Save profile changes
async function saveProfile(e) {
  e.preventDefault();
  try {
    // Update core user info
    await apiClient.put("users/me", {
      name: nameInput.value,
      email: emailInput.value
    });

    // Update extended profile
    await apiClient.put("users/me/profile", {
      dob: dobInput.value,
      gender: genderInput.value,
      avatar_url: avatarInput.value
    });

    alert("Profile updated successfully!");
  } catch (err) {
    alert("Failed to save profile: " + err.message);
  }
}

// Attach events
if (profileForm) {
  profileForm.addEventListener("submit", saveProfile);
}

// Init
document.addEventListener("DOMContentLoaded", loadProfile);
