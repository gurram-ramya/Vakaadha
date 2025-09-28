// Handle size selection
const sizeButtons = document.querySelectorAll(".size-btn");
sizeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    sizeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Wishlist toggle
const wishlistBtn = document.querySelector(".wishlist");
wishlistBtn.addEventListener("click", () => {
  wishlistBtn.textContent = wishlistBtn.textContent.includes("♡")
    ? "♥ Added to Wishlist"
    : "♡ Wishlist";
});

// Add to Cart
document.querySelector(".add-to-cart").addEventListener("click", () => {
  alert("Product added to cart!");
});

// Buy Now
document.querySelector(".buy-now").addEventListener("click", () => {
  alert("Proceeding to checkout...");
});

// Image Carousel
const images = document.querySelectorAll(".image-container img");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let currentIndex = 0;

function showImage(index) {
  images.forEach((img, i) => img.classList.toggle("active", i === index));
}

prevBtn.addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  showImage(currentIndex);
});

nextBtn.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % images.length;
  showImage(currentIndex);
});

// Show first image by default
showImage(currentIndex);
