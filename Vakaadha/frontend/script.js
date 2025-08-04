function increment(button) {
  const countSpan = button.parentElement.querySelector(".qty-count");
  let value = parseInt(countSpan.textContent);
  countSpan.textContent = value + 1;
}

function decrement(button) {
  const countSpan = button.parentElement.querySelector(".qty-count");
  let value = parseInt(countSpan.textContent);
  if (value > 0) {
    countSpan.textContent = value - 1;
  }
}

  function openModal(id) {
    document.getElementById(id).style.display = 'block';
  }

  function closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }

  // Close modals on outside click
  window.onclick = function (event) {
    const aboutModal = document.getElementById('aboutModal');
    const contactModal = document.getElementById('contactModal');
    if (event.target === aboutModal) {
      closeModal('aboutModal');
    } else if (event.target === contactModal) {
      closeModal('contactModal');
    }
  }

function openModal(id) {
  document.getElementById(id).style.display = "block";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'block';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Optional: Close modal on clicking outside
  window.onclick = function (event) {
    document.querySelectorAll(".modal").forEach(modal => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        updateWishlistCount();  // ✅ Call here
      }
    });
  });


