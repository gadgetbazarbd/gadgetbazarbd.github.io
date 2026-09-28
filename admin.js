let products = JSON.parse(
  localStorage.getItem("products")
) || [];

let orders = JSON.parse(
  localStorage.getItem("orders")
) || [];

let editingIndex = -1;


// Page navigation

function showPage(page) {

  document.querySelectorAll(".page").forEach(section => {
    section.classList.add("hidden");
  });

  document.getElementById(page).classList.remove("hidden");

  document.querySelectorAll(".menu").forEach(button => {
    button.classList.remove("active");
  });

  event.currentTarget.classList.add("active");

  if (page === "products") {
    renderProducts();
  }

  if (page === "dashboard") {
    updateDashboard();
  }

  if (page === "orders") {
    renderOrders();
  }
}


// Dashboard

function updateDashboard() {

  document.getElementById("totalProducts").textContent =
    products.length;

  document.getElementById("totalOrders").textContent =
    orders.length;

  const pending = orders.filter(
    order => order.status === "Pending"
  ).length;

  document.getElementById("pendingOrders").textContent =
    pending;
}


// Product form

function openProductForm(index = -1) {

  editingIndex = index;

  document.getElementById("productModal")
    .classList.remove("hidden");

  if (index >= 0) {

    const product = products[index];

    document.getElementById("modalTitle")
      .textContent = "Edit Product";

    document.getElementById("productName")
      .value = product.name;

    document.getElementById("productPrice")
      .value = product.price;

    document.getElementById("productStock")
      .value = product.stock;

    document.getElementById("productCategory")
      .value = product.category;

    document.getElementById("productImage")
      .value = product.image;

  } else {

    document.getElementById("modalTitle")
      .textContent = "Add Product";

    document.querySelectorAll(".modal-box input")
      .forEach(input => input.value = "");
  }
}


function closeProductForm() {

  document.getElementById("productModal")
    .classList.add("hidden");

  editingIndex = -1;
}


// Save product

function saveProduct() {

  const name =
    document.getElementById("productName").value.trim();

  const price =
    Number(document.getElementById("productPrice").value);

  const stock =
    Number(document.getElementById("productStock").value);

  const category =
    document.getElementById("productCategory").value.trim();

  const image =
    document.getElementById("productImage").value.trim();


  if (!name || !price) {
    alert("Product name and price are required.");
    return;
  }


  const product = {
    id:
      editingIndex >= 0
        ? products[editingIndex].id
        : Date.now(),

    name,
    price,
    stock,
    category,
    image
  };


  if (editingIndex >= 0) {

    products[editingIndex] = product;

  } else {

    products.push(product);

  }


  localStorage.setItem(
    "products",
    JSON.stringify(products)
  );


  closeProductForm();
  renderProducts();
  updateDashboard();
}


// Render products

function renderProducts() {

  const container =
    document.getElementById("productList");

  container.innerHTML = "";


  if (products.length === 0) {

    container.innerHTML =
      `<p class="empty">No products added.</p>`;

    return;
  }


  products.forEach((product, index) => {

    const div =
      document.createElement("div");

    div.className = "product";


    div.innerHTML = `

      <img
        src="${product.image || 'https://via.placeholder.com/70'}"
        alt=""
      >

      <div class="product-info">

        <h3>${product.name}</h3>

        <p>
          Price: ৳${product.price}
          |
          Stock: ${product.stock}
          |
          Category: ${product.category || "None"}
        </p>

      </div>

      <div class="product-actions">

        <button
          class="edit"
          onclick="openProductForm(${index})">
          Edit
        </button>

        <button
          class="delete"
          onclick="deleteProduct(${index})">
          Delete
        </button>

      </div>
    `;


    container.appendChild(div);

  });
}


// Delete

function deleteProduct(index) {

  if (!confirm("Delete this product?")) {
    return;
  }

  products.splice(index, 1);

  localStorage.setItem(
    "products",
    JSON.stringify(products)
  );

  renderProducts();
  updateDashboard();
}


// Orders

function renderOrders() {

  const container =
    document.getElementById("orderList");

  if (orders.length === 0) {

    container.innerHTML =
      `<p class="empty">No orders yet.</p>`;

    return;
  }

  container.innerHTML =
    orders.map((order, index) => `

      <div class="product">

        <div class="product-info">

          <h3>
            Order #${order.id || index + 1}
          </h3>

          <p>
            Customer:
            ${order.customer || "Unknown"}
          </p>

          <p>
            Total:
            ৳${order.total || 0}
          </p>

          <p>
            Status:
            ${order.status || "Pending"}
          </p>

        </div>

      </div>

    `).join("");
}


// Settings

function saveSettings() {

  const name =
    document.getElementById("storeName").value;

  localStorage.setItem(
    "storeName",
    name
  );

  alert("Settings saved.");
}


// Initial load

updateDashboard();
renderProducts();
