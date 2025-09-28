(function () {
  const ADDRESSES_KEY = "addresses";
  const SELECTED_ADDRESS_KEY = "selectedAddress";
  const SELECTED_ADDRESS_INDEX_KEY = "selectedAddressIndex";

  function readAddresses() {
    try { return JSON.parse(localStorage.getItem(ADDRESSES_KEY) || "[]"); }
    catch { return []; }
  }
  function writeAddresses(addresses) {
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
  }

  let addresses = readAddresses();
  let selectedIndex = JSON.parse(sessionStorage.getItem(SELECTED_ADDRESS_INDEX_KEY) || "null");

  const listEl = document.getElementById("address-list");
  const addBtn = document.getElementById("addAddressBtn");
  const formEl = document.getElementById("addressForm");
  const cancelBtn = document.getElementById("cancelForm");
  const proceedBtn = document.getElementById("proceedToPayment");

  function render() {
    if (!listEl) return;
    if (!addresses.length) {
      listEl.innerHTML = "<p>No saved addresses. Please add one.</p>";
      return;
    }

    listEl.innerHTML = addresses.map((addr, i) => `
      <div class="address-entry ${i === selectedIndex ? "selected" : ""}" data-index="${i}">
        <label class="address-label">
          <input type="radio" name="selectedAddress" value="${i}" ${i === selectedIndex ? "checked" : ""}/>
          <div class="address-details">
            <p><b>${addr.name}</b></p>
            <p>${addr.street}, ${addr.city} - ${addr.zip}</p>
          </div>
        </label>
        <div class="actions">
          <button class="edit-btn" data-index="${i}">Edit</button>
          <button class="remove-btn" data-index="${i}">Remove</button>
        </div>
      </div>
    `).join("");
  }

  // Add new address
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      formEl.style.display = "block";
      formEl.reset();
      formEl.dataset.editIndex = ""; // reset edit mode
    });
  }

  // Cancel form
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      formEl.style.display = "none";
    });
  }

  // Save address
  if (formEl) {
    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      const newAddr = {
        name: document.getElementById("addrName").value,
        street: document.getElementById("addrStreet").value,
        city: document.getElementById("addrCity").value,
        zip: document.getElementById("addrZip").value,
      };

      const editIndex = formEl.dataset.editIndex;
      if (editIndex !== "" && editIndex !== undefined) {
        addresses[editIndex] = newAddr;
      } else {
        addresses.push(newAddr);
        selectedIndex = addresses.length - 1; // auto-select last added
      }

      writeAddresses(addresses);
      sessionStorage.setItem(SELECTED_ADDRESS_INDEX_KEY, selectedIndex);
      sessionStorage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(newAddr));

      render();
      formEl.style.display = "none";
    });
  }

  // Handle edit/remove/select
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("remove-btn")) {
        const idx = e.target.dataset.index;
        if (confirm("Remove this address?")) {
          addresses.splice(idx, 1);
          if (selectedIndex == idx) {
            selectedIndex = null;
            sessionStorage.removeItem(SELECTED_ADDRESS_INDEX_KEY);
            sessionStorage.removeItem(SELECTED_ADDRESS_KEY);
          }
          writeAddresses(addresses);
          render();
        }
      }

      if (e.target.classList.contains("edit-btn")) {
        const idx = e.target.dataset.index;
        const addr = addresses[idx];
        document.getElementById("addrName").value = addr.name;
        document.getElementById("addrStreet").value = addr.street;
        document.getElementById("addrCity").value = addr.city;
        document.getElementById("addrZip").value = addr.zip;
        formEl.dataset.editIndex = idx;
        formEl.style.display = "block";
      }
    });

    listEl.addEventListener("change", (e) => {
      if (e.target.type === "radio") {
        selectedIndex = +e.target.value;
        sessionStorage.setItem(SELECTED_ADDRESS_INDEX_KEY, selectedIndex);
        sessionStorage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(addresses[selectedIndex]));
        render();
      }
    });
  }

  // Proceed to payment
  if (proceedBtn) {
    proceedBtn.addEventListener("click", () => {
      if (selectedIndex === null || selectedIndex === undefined || !addresses[selectedIndex]) {
        alert("Please select an address before proceeding to payment.");
        return;
      }

      // Save chosen address
      sessionStorage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(addresses[selectedIndex]));

      // Redirect to payment page
      window.location.href = "payment.html";
    });
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    render();
  });
})();
