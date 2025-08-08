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


document.querySelectorAll('.add-to-cart-btn').forEach(button => {
  button.addEventListener('click', async () => {
    const user = firebase.auth().currentUser;
    if (!user) {
      alert('Please login first to add to cart.');
      return;
    }

    const userId = user.email;
    const productId = button.dataset.productId;
    const productSize = button.dataset.productSize;

    if (!productSize) {
      alert("Please select a size before adding to cart.");
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:5000/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          product_id: productId,
          size: productSize
        })
      });

      const result = await response.json();
      alert(result.message || "Added to cart!");
    } catch (err) {
      console.error('Error adding to cart:', err);
      alert("Something went wrong!");
    }
  });
});

// Wishlist message
function showToast(message, color = "#00ffd5") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toast.style.borderLeftColor = color;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
