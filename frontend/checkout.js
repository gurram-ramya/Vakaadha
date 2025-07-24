// // document.addEventListener("DOMContentLoaded", function() {
// //   // Initialize checkout process
// //   initCheckout();
// // });

// // function initCheckout() {
// //   // Load product from session storage
// //   const product = JSON.parse(sessionStorage.getItem("checkoutProduct"));
// //   if (!product) {
// //     window.location.href = "index.html";
// //     return;
// //   }

// //   // Check if user is logged in
// //   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
// //   if (!loggedInUser) {
// //     alert("Please login to proceed with checkout");
// //     window.location.href = "profile.html";
// //     return;
// //   }

// //   // Load addresses
// //   loadAddresses();
  
// //   // Set up event listeners
// //   document.getElementById("addAddressBtn").addEventListener("click", showAddressForm);
// //   document.getElementById("continueToPayment").addEventListener("click", proceedToPayment);
// //   document.getElementById("completePayment").addEventListener("click", completePayment);
// // }

// // function loadAddresses() {
// //   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
// //   const storageKey = `user_${loggedInUser.email}_addresses`;
// //   const addresses = JSON.parse(localStorage.getItem(storageKey)) || [];
// //   const addressList = document.getElementById("addressList");

// //   if (addresses.length === 0) {
// //     addressList.innerHTML = '<p class="no-address">No saved addresses found. Please add one.</p>';
// //     document.getElementById("continueToPayment").disabled = true;
// //     return;
// //   }

// //   addressList.innerHTML = addresses.map((addr, i) => `
// //     <div class="address-option ${addr.isDefault ? 'default' : ''}">
// //       <input type="radio" name="selectedAddress" id="addr-${i}" 
// //              value="${i}" ${addr.isDefault ? 'checked' : ''}>
// //       <label for="addr-${i}">
// //         <strong>${addr.name}</strong>
// //         <p>${addr.address}</p>
// //         <p>${addr.city}, ${addr.state} - ${addr.pincode}</p>
// //         <p>Mobile: ${addr.mobile}</p>
// //         ${addr.isDefault ? '<span class="default-badge">Default</span>' : ''}
// //       </label>
// //     </div>
// //   `).join('');
// // }

// // function showAddressForm() {
// //   const container = document.getElementById("addressFormContainer");
// //   container.style.display = "block";
// //   container.innerHTML = `
// //     <form id="addressForm">
// //       <div class="form-group">
// //         <label>Full Name</label>
// //         <input type="text" name="name" required>
// //       </div>
// //       <div class="form-group">
// //         <label>Mobile Number</label>
// //         <input type="tel" name="mobile" required>
// //       </div>
// //       <div class="form-group">
// //         <label>Pincode</label>
// //         <input type="text" name="pincode" required>
// //       </div>
// //       <div class="form-group">
// //         <label>Address</label>
// //         <textarea name="address" required></textarea>
// //       </div>
// //       <div class="form-row">
// //         <div class="form-group">
// //           <label>City</label>
// //           <input type="text" name="city" required>
// //         </div>
// //         <div class="form-group">
// //           <label>State</label>
// //           <input type="text" name="state" required>
// //         </div>
// //       </div>
// //       <div class="form-actions">
// //         <button type="submit">Save Address</button>
// //       </div>
// //     </form>
// //   `;

// //   document.getElementById("addressForm").addEventListener("submit", function(e) {
// //     e.preventDefault();
// //     saveNewAddress(this);
// //   });
// // }

// // function saveNewAddress(form) {
// //   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
// //   const storageKey = `user_${loggedInUser.email}_addresses`;
// //   const addresses = JSON.parse(localStorage.getItem(storageKey)) || [];
  
// //   const formData = new FormData(form);
// //   const newAddress = {
// //     id: Date.now(),
// //     name: formData.get("name"),
// //     mobile: formData.get("mobile"),
// //     pincode: formData.get("pincode"),
// //     city: formData.get("city"),
// //     state: formData.get("state"),
// //     address: formData.get("address"),
// //     isDefault: addresses.length === 0
// //   };
  
// //   addresses.push(newAddress);
// //   localStorage.setItem(storageKey, JSON.stringify(addresses));
  
// //   // Reload addresses
// //   loadAddresses();
// //   document.getElementById("addressFormContainer").style.display = "none";
// // }

// // function proceedToPayment() {
// //   // Validate address selection
// //   const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked');
// //   if (!selectedAddress) {
// //     alert("Please select a delivery address");
// //     return;
// //   }

// //   // Save selected address
// //   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
// //   const storageKey = `user_${loggedInUser.email}_addresses`;
// //   const addresses = JSON.parse(localStorage.getItem(storageKey)) || [];
// //   const addressIndex = selectedAddress.value;
// //   sessionStorage.setItem("selectedAddress", JSON.stringify(addresses[addressIndex]));

// //   // Show payment section
// //   document.getElementById("addressSection").style.display = "none";
// //   document.getElementById("paymentSection").style.display = "block";
  
// //   // Update active step
// //   document.querySelector('.step[data-step="address"]').classList.remove("active");
// //   document.querySelector('.step[data-step="payment"]').classList.add("active");

// //   // Load order summary
// //   loadOrderSummary();
// //   loadPaymentMethods();
// // }

// // function loadOrderSummary() {
// //   const product = JSON.parse(sessionStorage.getItem("checkoutProduct"));
// //   const summary = document.getElementById("orderSummaryContent");
  
// //   summary.innerHTML = `
// //     <div class="product-summary">
// //       <img src="${product.img}" alt="${product.name}">
// //       <div>
// //         <h4>${product.name}</h4>
// //         <p>Size: ${product.size}</p>
// //         <p>Quantity: ${product.qty}</p>
// //         <p>Price: ₹${product.price.toFixed(2)}</p>
// //       </div>
// //     </div>
// //     <div class="summary-total">
// //       <p><strong>Total:</strong> ₹${product.price.toFixed(2)}</p>
// //     </div>
// //   `;
// // }

// // function loadPaymentMethods() {
// //   const methods = [
// //     { id: "cod", name: "Cash on Delivery", icon: "money-bill-wave" },
// //     { id: "card", name: "Credit/Debit Card", icon: "credit-card" },
// //     { id: "upi", name: "UPI Payment", icon: "mobile-screen" }
// //   ];

// //   const container = document.getElementById("paymentMethods");
// //   container.innerHTML = methods.map(method => `
// //     <div class="payment-method">
// //       <input type="radio" name="paymentMethod" id="${method.id}" value="${method.id}" ${method.id === "cod" ? "checked" : ""}>
// //       <label for="${method.id}">
// //         <i class="fas fa-${method.icon}"></i>
// //         ${method.name}
// //       </label>
// //     </div>
// //   `).join("");
// // }

// // function backToAddress() {
// //   document.getElementById("paymentSection").style.display = "none";
// //   document.getElementById("addressSection").style.display = "block";
// //   document.querySelector('.step[data-step="payment"]').classList.remove("active");
// //   document.querySelector('.step[data-step="address"]').classList.add("active");
// // }

// // function completePayment() {
// //   const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
// //   const product = JSON.parse(sessionStorage.getItem("checkoutProduct"));
// //   const address = JSON.parse(sessionStorage.getItem("selectedAddress"));

// //   // Create order
// //   const order = {
// //     id: Date.now(),
// //     date: new Date().toISOString(),
// //     products: [product],
// //     address,
// //     paymentMethod,
// //     status: paymentMethod === "cod" ? "confirmed" : "pending",
// //     total: product.price * product.qty
// //   };

// //   // Save order to user's order history
// //   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
// //   if (loggedInUser) {
// //     const storageKey = `user_${loggedInUser.email}_orders`;
// //     const orders = JSON.parse(localStorage.getItem(storageKey)) || [];
// //     orders.push(order);
// //     localStorage.setItem(storageKey, JSON.stringify(orders));
// //   }

// //   // Show confirmation
// //   document.getElementById("paymentSection").style.display = "none";
// //   document.getElementById("confirmationSection").style.display = "block";
// //   document.querySelector('.step[data-step="payment"]').classList.remove("active");
// //   document.querySelector('.step[data-step="confirmation"]').classList.add("active");

// //   // Display order details
// //   document.getElementById("orderConfirmationDetails").innerHTML = `
// //     <p>Order ID: <strong>#${order.id}</strong></p>
// //     <p>Total Paid: <strong>₹${order.total.toFixed(2)}</strong></p>
// //     <p>Payment Method: <strong>${getPaymentMethodName(order.paymentMethod)}</strong></p>
// //   `;

// //   // Clear checkout data
// //   sessionStorage.removeItem("checkoutProduct");
// //   sessionStorage.removeItem("selectedAddress");
// // }

// // function getPaymentMethodName(method) {
// //   switch(method) {
// //     case "cod": return "Cash on Delivery";
// //     case "card": return "Credit/Debit Card";
// //     case "upi": return "UPI Payment";
// //     default: return method;
// //   }
// // }

// // // At the start of your checkout processing:
// // function processCheckout() {
// //   // Check for both single product and multiple products
// //   const singleProduct = JSON.parse(sessionStorage.getItem("checkoutProduct"));
// //   const multipleProducts = JSON.parse(sessionStorage.getItem("checkoutProducts"));
  
// //   const productsToCheckout = singleProduct 
// //     ? [singleProduct] 
// //     : multipleProducts || [];

// //   if (productsToCheckout.length === 0) {
// //     alert("No products to checkout!");
// //     window.location.href = "cart.html";
// //     return;
// //   }

// //   // Calculate grand total
// //   const grandTotal = productsToCheckout.reduce(
// //     (sum, product) => sum + (product.price * product.qty), 
// //     0
// //   );

// //   // Create order with all products
// //   const order = {
// //     id: Date.now(),
// //     date: new Date().toISOString(),
// //     products: productsToCheckout,
// //     total: grandTotal,
// //     // ... rest of your order properties
// //   };

// //   // Save order to user's history
// //   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
// //   if (loggedInUser) {
// //     const storageKey = `user_${loggedInUser.email}_orders`;
// //     const orders = JSON.parse(localStorage.getItem(storageKey)) || [];
// //     orders.push(order);
// //     localStorage.setItem(storageKey, JSON.stringify(orders));
// //   }

// //   // Clear cart if this was a "Buy All" purchase
// //   if (multipleProducts) {
// //     localStorage.setItem("cart", JSON.stringify([]));
// //   }

// //   // Clear checkout data
// //   sessionStorage.removeItem("checkoutProduct");
// //   sessionStorage.removeItem("checkoutProducts");

// //   // Show confirmation
// //   showOrderConfirmation(order);
// // }

// // // Update your order summary display to handle multiple products
// // function showOrderSummary() {
// //   const singleProduct = JSON.parse(sessionStorage.getItem("checkoutProduct"));
// //   const multipleProducts = JSON.parse(sessionStorage.getItem("checkoutProducts"));
// //   const products = singleProduct ? [singleProduct] : multipleProducts || [];
  
// //   const summaryContainer = document.getElementById('orderSummary');
// //   if (!summaryContainer) return;

// //   if (products.length === 0) {
// //     summaryContainer.innerHTML = '<p>No products in order</p>';
// //     return;
// //   }

// //   const total = products.reduce((sum, p) => sum + (p.price * p.qty), 0);
  
// //   summaryContainer.innerHTML = `
// //     <h3>Order Summary (${products.length} ${products.length === 1 ? 'item' : 'items'})</h3>
// //     <div class="order-products">
// //       ${products.map(product => `
// //         <div class="order-product">
// //           <img src="${product.img}" alt="${product.name}">
// //           <div>
// //             <h4>${product.name}</h4>
// //             <p>Size: ${product.size}</p>
// //             <p>Quantity: ${product.qty}</p>
// //             <p>Price: ₹${(product.price * product.qty).toFixed(2)}</p>
// //           </div>
// //         </div>
// //       `).join('')}
// //     </div>
// //     <div class="order-total">
// //       <h4>Total: ₹${total.toFixed(2)}</h4>
// //     </div>
// //   `;
// // }

// document.addEventListener("DOMContentLoaded", function() {
//   // Initialize checkout process
//   initCheckout();
// });

// function initCheckout() {
//   // Load products from session storage (check for both single and multiple products)
//   const singleProduct = JSON.parse(sessionStorage.getItem("checkoutProduct"));
//   const multipleProducts = JSON.parse(sessionStorage.getItem("checkoutProducts"));
//   const products = singleProduct ? [singleProduct] : multipleProducts || [];
  
//   // if (products.length === 0) {
//   //   window.location.href = "index.html";
//   //   return;
//   // }

//   // Check if user is logged in
//   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
//   if (!loggedInUser) {
//     alert("Please login to proceed with checkout");
//     window.location.href = "profile.html";
//     return;
//   }

//   // Load addresses
//   loadAddresses();
  
//   // Set up event listeners
//   document.getElementById("addAddressBtn")?.addEventListener("click", showAddressForm);
//   document.getElementById("continueToPayment")?.addEventListener("click", proceedToPayment);
//   document.getElementById("completePayment")?.addEventListener("click", completePayment);
//   document.getElementById("backToAddress")?.addEventListener("click", backToAddress);
// }

// function loadAddresses() {
//   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
//   const storageKey = `user_${loggedInUser.email}_addresses`;
//   const addresses = JSON.parse(localStorage.getItem(storageKey)) || [];
//   const addressList = document.getElementById("addressList");

//   if (addresses.length === 0) {
//     addressList.innerHTML = '<p class="no-address">No saved addresses found. Please add one.</p>';
//     document.getElementById("continueToPayment").disabled = true;
//     return;
//   }

//   addressList.innerHTML = addresses.map((addr, i) => `
//     <div class="address-option ${addr.isDefault ? 'default' : ''}">
//       <input type="radio" name="selectedAddress" id="addr-${i}" 
//              value="${i}" ${addr.isDefault ? 'checked' : ''}>
//       <label for="addr-${i}">
//         <strong>${addr.name}</strong>
//         <p>${addr.address}</p>
//         <p>${addr.city}, ${addr.state} - ${addr.pincode}</p>
//         <p>Mobile: ${addr.mobile}</p>
//         ${addr.isDefault ? '<span class="default-badge">Default</span>' : ''}
//       </label>
//     </div>
//   `).join('');
// }

// function showAddressForm() {
//   const container = document.getElementById("addressFormContainer");
//   container.style.display = "block";
//   container.innerHTML = `
//     <form id="addressForm">
//       <div class="form-group">
//         <label>Full Name</label>
//         <input type="text" name="name" required>
//       </div>
//       <div class="form-group">
//         <label>Mobile Number</label>
//         <input type="tel" name="mobile" required>
//       </div>
//       <div class="form-group">
//         <label>Pincode</label>
//         <input type="text" name="pincode" required>
//       </div>
//       <div class="form-group">
//         <label>Address</label>
//         <textarea name="address" required></textarea>
//       </div>
//       <div class="form-row">
//         <div class="form-group">
//           <label>City</label>
//           <input type="text" name="city" required>
//         </div>
//         <div class="form-group">
//           <label>State</label>
//           <input type="text" name="state" required>
//         </div>
//       </div>
//       <div class="form-actions">
//         <button type="submit">Save Address</button>
//         <button type="button" id="cancelAddressForm">Cancel</button>
//       </div>
//     </form>
//   `;

//   document.getElementById("addressForm").addEventListener("submit", function(e) {
//     e.preventDefault();
//     saveNewAddress(this);
//   });

//   document.getElementById("cancelAddressForm").addEventListener("click", function() {
//     document.getElementById("addressFormContainer").style.display = "none";
//   });
// }

// function saveNewAddress(form) {
//   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
//   const storageKey = `user_${loggedInUser.email}_addresses`;
//   const addresses = JSON.parse(localStorage.getItem(storageKey)) || [];
  
//   const formData = new FormData(form);
//   const newAddress = {
//     id: Date.now(),
//     name: formData.get("name"),
//     mobile: formData.get("mobile"),
//     pincode: formData.get("pincode"),
//     city: formData.get("city"),
//     state: formData.get("state"),
//     address: formData.get("address"),
//     isDefault: addresses.length === 0
//   };
  
//   addresses.push(newAddress);
//   localStorage.setItem(storageKey, JSON.stringify(addresses));
  
//   // Reload addresses
//   loadAddresses();
//   document.getElementById("addressFormContainer").style.display = "none";
// }

// function proceedToPayment() {
//   // Validate address selection
//   const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked');
//   if (!selectedAddress) {
//     alert("Please select a delivery address");
//     return;
//   }

//   // Save selected address
//   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
//   const storageKey = `user_${loggedInUser.email}_addresses`;
//   const addresses = JSON.parse(localStorage.getItem(storageKey)) || [];
//   const addressIndex = selectedAddress.value;
//   sessionStorage.setItem("selectedAddress", JSON.stringify(addresses[addressIndex]));

//   // Show payment section
//   document.getElementById("addressSection").style.display = "none";
//   document.getElementById("paymentSection").style.display = "block";
  
//   // Update active step
//   document.querySelector('.step[data-step="address"]').classList.remove("active");
//   document.querySelector('.step[data-step="payment"]').classList.add("active");

//   // Load order summary and payment methods
//   loadOrderSummary();
//   loadPaymentMethods();
// }

// function loadOrderSummary() {
//   const singleProduct = JSON.parse(sessionStorage.getItem("checkoutProduct"));
//   const multipleProducts = JSON.parse(sessionStorage.getItem("checkoutProducts"));
//   const products = singleProduct ? [singleProduct] : multipleProducts || [];
//   const summary = document.getElementById("orderSummaryContent");

//   if (products.length === 0) {
//     summary.innerHTML = "<p>Your cart is empty</p>";
//     return;
//   }

//   let productsHTML = '';
//   let subtotal = 0;
  
//   // Generate HTML for each product
//   products.forEach(product => {
//     const productTotal = product.price * product.qty;
//     productsHTML += `
//       <div class="product-summary">
//         <img src="${product.img}" alt="${product.name}">
//         <div>
//           <h4>${product.name}</h4>
//           <p>Size: ${product.size}</p>
//           <p>Quantity: ${product.qty}</p>
//           <p>Price: ₹${productTotal.toFixed(2)}</p>
//         </div>
//       </div>
//     `;
    
//     subtotal += productTotal;
//   });

//   // Calculate total (you might want to add shipping, taxes, etc. here)
//   const total = subtotal;
  
//   summary.innerHTML = `
//     ${productsHTML}
//     <div class="summary-total">
//       <p><strong>Subtotal:</strong> ₹${subtotal.toFixed(2)}</p>
//       <p><strong>Total:</strong> ₹${total.toFixed(2)}</p>
//     </div>
//   `;
// }

// function loadPaymentMethods() {
//   const methods = [
//     { id: "cod", name: "Cash on Delivery", icon: "money-bill-wave" },
//     { id: "card", name: "Credit/Debit Card", icon: "credit-card" },
//     { id: "upi", name: "UPI Payment", icon: "mobile-screen" }
//   ];

//   const container = document.getElementById("paymentMethods");
//   container.innerHTML = methods.map(method => `
//     <div class="payment-method">
//       <input type="radio" name="paymentMethod" id="${method.id}" value="${method.id}" ${method.id === "cod" ? "checked" : ""}>
//       <label for="${method.id}">
//         <i class="fas fa-${method.icon}"></i>
//         ${method.name}
//       </label>
//     </div>
//   `).join("");
// }

// function backToAddress() {
//   document.getElementById("paymentSection").style.display = "none";
//   document.getElementById("addressSection").style.display = "block";
//   document.querySelector('.step[data-step="payment"]').classList.remove("active");
//   document.querySelector('.step[data-step="address"]').classList.add("active");
// }

// async function completePayment() {
//   const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
//   const singleProduct = JSON.parse(sessionStorage.getItem("checkoutProduct"));
//   const multipleProducts = JSON.parse(sessionStorage.getItem("checkoutProducts"));
//   const products = singleProduct ? [singleProduct] : multipleProducts || [];
//   const address = JSON.parse(sessionStorage.getItem("selectedAddress"));

//   if (products.length === 0) {
//     alert("No products in order!");
//     return;
//   }

//   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
//   const idToken = loggedInUser?.idToken;

//   if (!idToken) {
//     alert("Login required.");
//     return window.location.href = "profile.html";
//   }

//   const orderPayload = {
//     address,
//     payment_method: paymentMethod,
//     products: products.map(p => ({
//       product_id: p.id,
//       quantity: p.qty,
//       price: p.price
//     }))
//   };

//   try {
//     const response = await fetch("http://127.0.0.1:5000/orders", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${idToken}`
//       },
//       body: JSON.stringify(orderPayload)
//     });

//     const result = await response.json();

//     if (response.ok) {
//       // 🎉 Success
//       document.getElementById("paymentSection").style.display = "none";
//       document.getElementById("confirmationSection").style.display = "block";
//       document.querySelector('.step[data-step="payment"]').classList.remove("active");
//       document.querySelector('.step[data-step="confirmation"]').classList.add("active");

//       document.getElementById("orderConfirmationDetails").innerHTML = `
//         <p>Order ID: <strong>#${result.order_id}</strong></p>
//         <p>Total Paid: <strong>₹${result.total.toFixed(2)}</strong></p>
//         <p>Payment Method: <strong>${getPaymentMethodName(paymentMethod)}</strong></p>
//         <p>Items: <strong>${products.length}</strong></p>
//       `;

//       sessionStorage.removeItem("checkoutProduct");
//       sessionStorage.removeItem("checkoutProducts");
//       sessionStorage.removeItem("selectedAddress");
//       localStorage.setItem("cart", JSON.stringify([]));
//     } else {
//       alert(result.error || "Order failed");
//     }

//   } catch (error) {
//     console.error("Checkout Error:", error);
//     alert("Something went wrong. Please try again.");
//   }
// }


// // function completePayment() {
// //   const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
// //   const singleProduct = JSON.parse(sessionStorage.getItem("checkoutProduct"));
// //   const multipleProducts = JSON.parse(sessionStorage.getItem("checkoutProducts"));
// //   const products = singleProduct ? [singleProduct] : multipleProducts || [];
// //   const address = JSON.parse(sessionStorage.getItem("selectedAddress"));

// //   if (products.length === 0) {
// //     alert("No products in order!");
// //     return;
// //   }

// //   // Calculate total
// //   const total = products.reduce((sum, product) => sum + (product.price * product.qty), 0);

// //   // Create order
// //   const order = {
// //     id: Date.now(),
// //     date: new Date().toISOString(),
// //     products: products,
// //     address,
// //     paymentMethod,
// //     status: paymentMethod === "cod" ? "confirmed" : "pending",
// //     total: total
// //   };

// //   // Save order to user's order history
// //   const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
// //   if (loggedInUser) {
// //     const storageKey = `user_${loggedInUser.email}_orders`;
// //     const orders = JSON.parse(localStorage.getItem(storageKey)) || [];
// //     orders.push(order);
// //     localStorage.setItem(storageKey, JSON.stringify(orders));
    
// //     // Clear cart if this was a multi-product checkout
// //     if (multipleProducts) {
// //       localStorage.setItem("cart", JSON.stringify([]));
// //     }
// //   }

// //   // Show confirmation
// //   document.getElementById("paymentSection").style.display = "none";
// //   document.getElementById("confirmationSection").style.display = "block";
// //   document.querySelector('.step[data-step="payment"]').classList.remove("active");
// //   document.querySelector('.step[data-step="confirmation"]').classList.add("active");

// //   // Display order details
// //   document.getElementById("orderConfirmationDetails").innerHTML = `
// //     <p>Order ID: <strong>#${order.id}</strong></p>
// //     <p>Total Paid: <strong>₹${order.total.toFixed(2)}</strong></p>
// //     <p>Payment Method: <strong>${getPaymentMethodName(order.paymentMethod)}</strong></p>
// //     <p>Items: <strong>${order.products.length}</strong></p>
// //   `;

// //   // Clear checkout data
// //   sessionStorage.removeItem("checkoutProduct");
// //   sessionStorage.removeItem("checkoutProducts");
// //   sessionStorage.removeItem("selectedAddress");
// // }

// function getPaymentMethodName(method) {
//   switch(method) {
//     case "cod": return "Cash on Delivery";
//     case "card": return "Credit/Debit Card";
//     case "upi": return "UPI Payment";
//     default: return method;
//   }
// }

document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
      alert("Please log in to proceed with checkout.");
      return window.location.href = "profile.html";
    }

    const token = await user.getIdToken();
    localStorage.setItem("loggedInUser", JSON.stringify({ email: user.email, idToken: token }));

    loadAddresses();
    document.getElementById("addAddressBtn").onclick = showAddressForm;
    document.getElementById("continueToPayment").onclick = proceedToPayment;
    document.getElementById("completePayment").onclick = completePayment;
    document.getElementById("backToAddress").onclick = backToAddress;
  });
});

function loadAddresses() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const key = `user_${user.email}_addresses`;
  const addresses = JSON.parse(localStorage.getItem(key)) || [];

  const list = document.getElementById("addressList");
  const btn = document.getElementById("continueToPayment");

  if (addresses.length === 0) {
    list.innerHTML = '<p>No saved addresses. Please add one.</p>';
    btn.disabled = true;
    return;
  }

  list.innerHTML = addresses.map((addr, i) => `
    <div class="address-option">
      <input type="radio" name="selectedAddress" value="${i}" ${addr.isDefault ? 'checked' : ''}>
      <label>
        <strong>${addr.name}</strong><br/>
        ${addr.address}, ${addr.city}, ${addr.state} - ${addr.pincode}<br/>
        Mobile: ${addr.mobile}
      </label>
    </div>
  `).join("");

  btn.disabled = false;
}

function showAddressForm() {
  const form = document.getElementById("addressFormContainer");
  form.style.display = "block";
  form.innerHTML = `
    <form id="addressForm">
      <input name="name" placeholder="Full Name" required><br/>
      <input name="mobile" placeholder="Mobile" required><br/>
      <input name="pincode" placeholder="PIN Code" required><br/>
      <input name="address" placeholder="Address" required><br/>
      <input name="city" placeholder="City" required><br/>
      <input name="state" placeholder="State" required><br/>
      <button type="submit">Save</button>
      <button type="button" onclick="document.getElementById('addressFormContainer').style.display='none'">Cancel</button>
    </form>
  `;

  document.getElementById("addressForm").onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newAddress = {
      name: fd.get("name"),
      mobile: fd.get("mobile"),
      pincode: fd.get("pincode"),
      address: fd.get("address"),
      city: fd.get("city"),
      state: fd.get("state"),
      isDefault: false
    };

    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    const key = `user_${user.email}_addresses`;
    const addresses = JSON.parse(localStorage.getItem(key)) || [];

    if (addresses.length === 0) newAddress.isDefault = true;

    addresses.push(newAddress);
    localStorage.setItem(key, JSON.stringify(addresses));
    loadAddresses();
    document.getElementById("addressFormContainer").style.display = "none";
  };
}

function proceedToPayment() {
  const selected = document.querySelector('input[name="selectedAddress"]:checked');
  if (!selected) return alert("Select a shipping address.");

  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const key = `user_${user.email}_addresses`;
  const addresses = JSON.parse(localStorage.getItem(key));
  const address = addresses[selected.value];

  sessionStorage.setItem("selectedAddress", JSON.stringify(address));

  document.getElementById("addressSection").style.display = "none";
  document.getElementById("paymentSection").style.display = "block";

  document.querySelector('.step[data-step="address"]').classList.remove("active");
  document.querySelector('.step[data-step="payment"]').classList.add("active");

  loadOrderSummary();
  loadPaymentMethods();
}

function loadOrderSummary() {
  const cartProducts = JSON.parse(sessionStorage.getItem("checkoutProducts")) || [];
  const container = document.getElementById("orderSummaryContent");

  if (cartProducts.length === 0) return container.innerHTML = "<p>Your cart is empty.</p>";

  let total = 0;
  container.innerHTML = cartProducts.map(p => {
    const lineTotal = p.price * p.qty;
    total += lineTotal;
    return `
      <div class="product-summary">
        <img src="./Images/${p.img}" alt="${p.name}" />
        <div>
          <h4>${p.name}</h4>
          <p>Size: ${p.size}</p>
          <p>Qty: ${p.qty}</p>
          <p>Total: ₹${lineTotal.toFixed(2)}</p>
        </div>
      </div>
    `;
  }).join("") + `<div class="summary-total"><strong>Total: ₹${total.toFixed(2)}</strong></div>`;
}

function loadPaymentMethods() {
  const container = document.getElementById("paymentMethods");
  // container.innerHTML = `
  //   <label><input type="radio" name="paymentMethod" value="cod" checked> Cash on Delivery</label><br/>
  //   <label><input type="radio" name="paymentMethod" value="upi"> UPI</label><br/>
  //   <label><input type="radio" name="paymentMethod" value="card"> Card</label>
  // `;
  container.innerHTML = `<div class="payment-option selected">
            <input type="radio" name="paymentMethod" id="upi" value="UPI" checked />
            <label for="upi">
              <div><strong>UPI</strong></div>
              <div class="payment-description">Pay via PhonePe, GPay, or BHIM</div>
            </label>
            <div class="payment-icon"><i class="fas fa-mobile-alt"></i></div>
          </div>

          <div class="payment-option">
            <input type="radio" name="paymentMethod" id="cod" value="COD" />
            <label for="cod">
              <div><strong>Cash on Delivery</strong></div>
              <div class="payment-description">Pay with cash once you receive your order</div>
            </label>
            <div class="payment-icon"><i class="fas fa-money-bill-wave"></i></div>
          </div>
          
          <div class="payment-option">
            <input type="radio" name="paymentMethod" id="card" value="CARD" />
            <label for="card">
              <div><strong>Card Payment</strong></div>
              <div class="payment-description">Pay securely using your credit or debit card</div>
            </label>
            <div class="payment-icon"><i class="fas fa-credit-card"></i></div>
          </div>
        `;

}

function backToAddress() {
  document.getElementById("paymentSection").style.display = "none";
  document.getElementById("addressSection").style.display = "block";

  document.querySelector('.step[data-step="payment"]').classList.remove("active");
  document.querySelector('.step[data-step="address"]').classList.add("active");
}

async function completePayment() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const token = user?.idToken;
  const address = JSON.parse(sessionStorage.getItem("selectedAddress"));
  const products = JSON.parse(sessionStorage.getItem("checkoutProducts")) || [];

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

  if (!products.length) return alert("No items to order.");

  try {
    const res = await fetch("/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        address,
        payment_method: paymentMethod
      })
    });

    const result = await res.json();

    if (res.ok) {
      document.getElementById("paymentSection").style.display = "none";
      document.getElementById("confirmationSection").style.display = "block";

      document.querySelector('.step[data-step="payment"]').classList.remove("active");
      document.querySelector('.step[data-step="confirmation"]').classList.add("active");

      document.getElementById("orderConfirmationDetails").innerHTML = `
        <p>Order ID: <strong>#${result.order_id}</strong></p>
        <p>Total Paid: ₹<strong>${result.total_amount.toFixed(2)}</strong></p>
        <p>Payment Mode: ${paymentMethod.toUpperCase()}</p>
      `;

      sessionStorage.clear();
      localStorage.removeItem("cart");
    } else {
      alert(result.error || "Order failed.");
    }
  } catch (err) {
    console.error("Order error:", err);
    alert("Something went wrong.");
  }
}
