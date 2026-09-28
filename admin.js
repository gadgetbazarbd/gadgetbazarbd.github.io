const KEY = 'gbbd_admin_v1';

const seedProducts = [
  {
    id: 'p1',
    name: 'TWS AirBuds Pro',
    category: 'Audio',
    price: 1290,
    discount: 0,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=800',
    description: 'Wireless earbuds with charging case',
    active: true
  },
  {
    id: 'p2',
    name: 'Bluetooth Speaker Mini',
    category: 'Audio',
    price: 990,
    discount: 0,
    stock: 15,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800',
    description: 'Compact Bluetooth speaker',
    active: true
  },
  {
    id: 'p3',
    name: 'Smart Watch S9',
    category: 'Wearables',
    price: 1850,
    discount: 0,
    stock: 10,
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800',
    description: 'Smart wearable watch',
    active: true
  }
];

let db = load();
let page = 'dashboard';

/* =========================
   HELPERS
========================= */

function $(id) {
  return document.getElementById(id);
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

/* =========================
   DATABASE
========================= */

function defaultDB() {
  return {
    products: seedProducts,
    orders: [],
    customers: [],
    categories: [
      'Audio',
      'Wearables',
      'Power & Charging',
      'Mobile Accessories',
      'RGB & Lighting',
      'Home Gadgets',
      'Gaming'
    ],
    delivery: {
      dhaka: 60,
      nearby: 100,
      outside: 130,
      nearbyDistricts:
        'Gazipur, Narayanganj, Narsingdi, Munshiganj, Manikganj'
    },
    payments: {
      cod: true,
      bkash: true,
      nagad: true,
      bkashNumber: '',
      nagadNumber: ''
    },
    settings: {
      store: 'Gadget Bazar BD',
      phone: '',
      email: '',
      logo: '',
      admin: 'Administrator'
    }
  };
}

function load() {
  try {
    const saved = localStorage.getItem(KEY);

    if (saved) {
      return JSON.parse(saved);
    }

    const fresh = defaultDB();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;

  } catch (e) {
    return defaultDB();
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

/* =========================
   LOGIN
========================= */

function login() {
  const username = $('loginUser').value.trim();
  const password = $('loginPass').value;

  if (username === 'admin' && password === 'admin123') {
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    render();
  } else {
    alert('Invalid username or password');
  }
}

function logout() {
  location.reload();
}

/* =========================
   SIDEBAR
========================= */

function toggleSide() {
  const sidebar = document.querySelector('.sidebar');

  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

/* =========================
   NAVIGATION
========================= */

function setupNavigation() {
  document.querySelectorAll('.nav').forEach(function (button) {
    button.onclick = function () {
      page = button.dataset.page;
      render();

      const sidebar = document.querySelector('.sidebar');

      if (sidebar) {
        sidebar.classList.remove('open');
      }
    };
  });
}

/* =========================
   MAIN RENDER
========================= */

function render() {
  document.querySelectorAll('.nav').forEach(function (button) {
    button.classList.toggle(
      'active',
      button.dataset.page === page
    );
  });

  if ($('pageTitle')) {
    $('pageTitle').textContent =
      page.charAt(0).toUpperCase() + page.slice(1);
  }

  if ($('pageSub')) {
    $('pageSub').textContent =
      page === 'dashboard'
        ? 'Store overview'
        : 'Manage your store';
  }

  let html = '';

  if (page === 'dashboard') html = dashboard();
  if (page === 'products') html = products();
  if (page === 'orders') html = orders();
  if (page === 'customers') html = customers();
  if (page === 'categories') html = categories();
  if (page === 'delivery') html = delivery();
  if (page === 'payments') html = payments();
  if (page === 'settings') html = settings();

  if ($('content')) {
    $('content').innerHTML = html;
  }
}

/* =========================
   DASHBOARD
========================= */

function dashboard() {
  const sales = db.orders.reduce(
    function (total, order) {
      return total + Number(order.total || 0);
    },
    0
  );

  const pending = db.orders.filter(
    function (order) {
      return order.status === 'Pending';
    }
  ).length;

  const processing = db.orders.filter(
    function (order) {
      return order.status === 'Processing';
    }
  ).length;

  const delivered = db.orders.filter(
    function (order) {
      return order.status === 'Delivered';
    }
  ).length;

  const cancelled = db.orders.filter(
    function (order) {
      return order.status === 'Cancelled';
    }
  ).length;

  return `
    <div class="cards">

      <div class="card stat">
        <div>
          <div class="label">Total Products</div>
          <div class="value">${db.products.length}</div>
        </div>
        <div class="ico">▣</div>
      </div>

      <div class="card stat">
        <div>
          <div class="label">Total Orders</div>
          <div class="value">${db.orders.length}</div>
        </div>
        <div class="ico">▤</div>
      </div>

      <div class="card stat">
        <div>
          <div class="label">Pending Orders</div>
          <div class="value">${pending}</div>
        </div>
        <div class="ico">◷</div>
      </div>

      <div class="card stat">
        <div>
          <div class="label">Total Sales</div>
          <div class="value">
            ৳${sales.toLocaleString()}
          </div>
        </div>
        <div class="ico">৳</div>
      </div>

    </div>

    <div class="cards">

      <div class="card stat">
        <div>
          <div class="label">Processing</div>
          <div class="value">${processing}</div>
        </div>
        <div class="ico">⚙</div>
      </div>

      <div class="card stat">
        <div>
          <div class="label">Delivered</div>
          <div class="value">${delivered}</div>
        </div>
        <div class="ico">✓</div>
      </div>

      <div class="card stat">
        <div>
          <div class="label">Cancelled</div>
          <div class="value">${cancelled}</div>
        </div>
        <div class="ico">×</div>
      </div>

      <div class="card stat">
        <div>
          <div class="label">Customers</div>
          <div class="value">${getCustomerCount()}</div>
        </div>
        <div class="ico">👤</div>
      </div>

    </div>

    <div class="grid2">

      <div class="card">
        <div class="section-head">
          <h3>Sales Overview</h3>
        </div>

        <div class="chart">
          ${[
            32, 54, 45, 70, 52, 84,
            64, 92, 74, 60, 88, 78
          ]
            .map(function (v) {
              return `<div class="bar" style="height:${v}%"></div>`;
            })
            .join('')}
        </div>
      </div>

      <div class="card">

        <div class="section-head">
          <h3>Recent Orders</h3>

          <button
            class="btn muted"
            onclick="page='orders';render()"
          >
            View all
          </button>
        </div>

        <div class="mini-list">

          ${
            db.orders
              .slice(-5)
              .reverse()
              .map(function (o) {
                return `
                  <div class="mini-item">
                    <span>
                      ${esc(o.orderId || o.id || 'Order')}
                    </span>

                    <b>
                      ৳${Number(o.total || 0).toLocaleString()}
                    </b>
                  </div>
                `;
              })
              .join('') ||
            '<div class="empty">No orders yet</div>'
          }

        </div>

      </div>

    </div>
  `;
}

function getCustomerCount() {
  const names = {};

  db.orders.forEach(function (o) {
    const name =
      o.customer?.name ||
      o.name ||
      'Unknown';

    names[name] = true;
  });

  return Object.keys(names).length;
}

/* =========================
   PRODUCTS
========================= */

function products() {
  return `
    <div class="section-head">

      <h3>Products</h3>

      <div class="toolbar">

        <input
          class="input"
          id="psearch"
          placeholder="Search products..."
          oninput="filterProducts()"
        >

        <select
          class="select"
          id="stockfilter"
          onchange="filterProducts()"
        >
          <option value="all">All stock</option>
          <option value="low">Low stock</option>
          <option value="off">Disabled</option>
        </select>

        <button
          class="btn primary"
          onclick="openProduct()"
        >
          ＋ Add Product
        </button>

      </div>

    </div>

    <div
      id="productGrid"
      class="product-grid"
    >
      ${productCards(db.products)}
    </div>
  `;
}

function productCards(arr) {
  if (!arr.length) {
    return '<div class="empty">No products found</div>';
  }

  return arr
    .map(function (p) {
      return `
        <div class="product-card">

          <img
            src="${esc(
              p.image ||
              'https://placehold.co/800x500?text=Product'
            )}"
            onerror="this.src='https://placehold.co/800x500?text=Product'"
          >

          <div class="product-info">

            <h4>
              ${esc(p.name)}

              ${
                p.active
                  ? ''
                  : '<span class="pill red">Disabled</span>'
              }
            </h4>

            <p>
              ${esc(p.category)}
              · Stock: ${p.stock}
            </p>

            <div class="price">
              ৳${Number(p.price).toLocaleString()}
            </div>

            <div
              class="actions"
              style="margin-top:10px"
            >

              <button
                onclick="openProduct('${p.id}')"
              >
                Edit
              </button>

              <button
                onclick="toggleProduct('${p.id}')"
              >
                ${p.active ? 'Disable' : 'Enable'}
              </button>

              <button
                onclick="deleteProduct('${p.id}')"
              >
                Delete
              </button>

            </div>

          </div>

        </div>
      `;
    })
    .join('');
}

function filterProducts() {
  const q =
    ($('psearch')?.value || '')
      .toLowerCase();

  const filter =
    $('stockfilter')?.value || 'all';

  const productsList = db.products
    .filter(function (p) {
      return (
        p.name +
        ' ' +
        p.category
      )
        .toLowerCase()
        .includes(q);
    })
    .filter(function (p) {
      if (filter === 'low') {
        return p.stock < 5;
      }

      if (filter === 'off') {
        return !p.active;
      }

      return true;
    });

  if ($('productGrid')) {
    $('productGrid').innerHTML =
      productCards(productsList);
  }
}

/* =========================
   ADD / EDIT PRODUCT
========================= */

function openProduct(id = '') {
  const p =
    db.products.find(function (x) {
      return x.id === id;
    }) ||
    {
      id: '',
      name: '',
      category:
        db.categories[0] || 'Audio',
      price: '',
      discount: 0,
      stock: 0,
      image: '',
      description: '',
      active: true
    };

  $('modalTitle').textContent =
    id ? 'Edit Product' : 'Add Product';

  $('modalBody').innerHTML = `
    <div class="form-grid">

      <label>
        Product Name
        <input
          id="f_name"
          value="${esc(p.name)}"
        >
      </label>

      <label>
        Category

        <select id="f_cat">

          ${db.categories
            .map(function (c) {
              return `
                <option
                  ${
                    c === p.category
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(c)}
                </option>
              `;
            })
            .join('')}

        </select>

      </label>

      <label>
        Price
        <input
          id="f_price"
          type="number"
          value="${p.price}"
        >
      </label>

      <label>
        Discount Price
        <input
          id="f_discount"
          type="number"
          value="${p.discount || 0}"
        >
      </label>

      <label>
        Stock Quantity
        <input
          id="f_stock"
          type="number"
          value="${p.stock}"
        >
      </label>

      <label>
        Image URL
        <input
          id="f_image"
          value="${esc(p.image || '')}"
        >
      </label>

      <label class="full">
        Description

        <textarea id="f_desc">${esc(
          p.description || ''
        )}</textarea>

      </label>

    </div>

    <div class="btn-row">

      <button
        class="btn muted"
        onclick="closeModal()"
      >
        Cancel
      </button>

      <button
        class="btn primary"
        onclick="saveProduct('${id}')"
      >
        Save Product
      </button>

    </div>
  `;

  $('modal').classList.remove('hidden');
}

function saveProduct(id) {
  const name =
    $('f_name').value.trim();

  if (!name) {
    alert('Please enter product name');
    return;
  }

  const p = {
    id: id || 'p_' + Date.now(),
    name: name,
    category: $('f_cat').value,
    price: Number(
      $('f_price').value || 0
    ),
    discount: Number(
      $('f_discount').value || 0
    ),
    stock: Number(
      $('f_stock').value || 0
    ),
    image:
      $('f_image').value.trim(),
    description:
      $('f_desc').value.trim(),
    active: true
  };

  const index =
    db.products.findIndex(function (x) {
      return x.id === p.id;
    });

  if (index >= 0) {
    p.active =
      db.products[index].active;

    db.products[index] = p;
  } else {
    db.products.push(p);
  }

  save();
  closeModal();
  render();
}

function toggleProduct(id) {
  const p =
    db.products.find(function (x) {
      return x.id === id;
    });

  if (!p) return;

  p.active = !p.active;

  save();
  render();
}

function deleteProduct(id) {
  if (
    confirm(
      'Delete this product permanently?'
    )
  ) {
    db.products =
      db.products.filter(function (p) {
        return p.id !== id;
      });

    save();
    render();
  }
}

/* =========================
   ORDERS
========================= */

function orders() {
  const rows = db.orders
    .map(function (o, i) {
      return `
        <tr>

          <td>
            ${esc(
              o.orderId ||
              o.id ||
              '#' + (i + 1)
            )}
          </td>

          <td>
            ${esc(
              o.customer?.name ||
              o.name ||
              '—'
            )}
          </td>

          <td>
            ${esc(
              o.customer?.phone ||
              o.phone ||
              '—'
            )}
          </td>

          <td>
            ৳${Number(
              o.total || 0
            ).toLocaleString()}
          </td>

          <td>
            ${esc(
              o.paymentMethod ||
              'COD'
            )}
          </td>

          <td>
            <span
              class="pill ${
                o.status === 'Delivered'
                  ? 'green'
                  : o.status === 'Cancelled'
                  ? 'red'
                  : o.status === 'Pending'
                  ? 'yellow'
                  : 'blue'
              }"
            >
              ${esc(
                o.status ||
                'Pending'
              )}
            </span>
          </td>

          <td class="actions">

            <button
              onclick="viewOrder(${i})"
            >
              View
            </button>

            <button
              onclick="statusOrder(${i})"
            >
              Status
            </button>

          </td>

        </tr>
      `;
    })
    .join('');

  return `
    <div class="section-head">

      <h3>Orders</h3>

      <div class="toolbar">

        <input
          class="input"
          placeholder="Search order/customer"
          oninput="searchOrders(this.value)"
        >

      </div>

    </div>

    <div class="table-wrap">

      <table class="table">

        <thead>

          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Action</th>
          </tr>

        </thead>

        <tbody id="orderRows">

          ${
            rows ||
            `
              <tr>
                <td
                  colspan="7"
                  class="empty"
                >
                  No orders yet
                </td>
              </tr>
            `
          }

        </tbody>

      </table>

    </div>
  `;
}

function searchOrders(q) {
  q = q.toLowerCase();

  document
    .querySelectorAll(
      '#orderRows tr'
    )
    .forEach(function (row) {
      row.style.display =
        row.innerText
          .toLowerCase()
          .includes(q)
          ? ''
          : 'none';
    });
}

/* =========================
   ORDER DETAILS
========================= */

function viewOrder(i) {
  const o = db.orders[i];

  if (!o) return;

  $('modalTitle').textContent =
    'Order ' +
    (o.orderId || o.id || '');

  $('modalBody').innerHTML = `
    <div class="card">

      <b>Customer</b>

      <p>
        ${esc(
          o.customer?.name ||
          o.name ||
          ''
        )}
        ·
        ${esc(
          o.customer?.phone ||
          o.phone ||
          ''
        )}
      </p>

      <p>
        ${esc(
          o.customer?.district ||
          o.district ||
          ''
        )}
        ,
        ${esc(
          o.customer?.upazila ||
          o.area ||
          ''
        )}
      </p>

      <p>
        ${esc(
          o.customer?.address ||
          o.address ||
          ''
        )}
      </p>

      <hr>

      <p>
        <b>Payment:</b>
        ${esc(
          o.paymentMethod ||
          'COD'
        )}

        ${
          o.transactionId
            ? ' · TXN: ' +
              esc(o.transactionId)
            : ''
        }
      </p>

      <p>
        <b>Subtotal:</b>
        ৳${Number(
          o.subtotal || 0
        ).toLocaleString()}
      </p>

      <p>
        <b>Delivery:</b>
        ৳${Number(
          o.delivery || 0
        ).toLocaleString()}
      </p>

      <p>
        <b>Total:</b>
        ৳${Number(
          o.total || 0
        ).toLocaleString()}
      </p>

      <p>
        <b>Note:</b>
        ${esc(o.note || '—')}
      </p>

    </div>

    <div class="btn-row">

      <button
        class="btn primary"
        onclick="statusOrder(${i})"
      >
        Change Status
      </button>

    </div>
  `;

  $('modal').classList.remove('hidden');
}

function statusOrder(i) {
  const current =
    db.orders[i].status ||
    'Pending';

  const status = prompt(
    'Status: Pending, Confirmed, Processing, Shipped, Delivered, Cancelled',
    current
  );

  const valid = [
    'Pending',
    'Confirmed',
    'Processing',
    'Shipped',
    'Delivered',
    'Cancelled'
  ];

  if (valid.includes(status)) {
    db.orders[i].status =
      status;

    save();
    closeModal();
    render();
  }
}

/* =========================
   CUSTOMERS
========================= */

function customers() {
  const map = {};

  db.orders.forEach(function (o) {
    const name =
      o.customer?.name ||
      o.name ||
      'Unknown';

    if (!map[name]) {
      map[name] = {
        name: name,
        phone:
          o.customer?.phone ||
          o.phone ||
          '',
        orders: 0,
        spent: 0
      };
    }

    map[name].orders++;
    map[name].spent +=
      Number(o.total || 0);
  });

  return `
    <div class="section-head">
      <h3>Customers</h3>
    </div>

    <div class="table-wrap">

      <table class="table">

        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Orders</th>
            <th>Total Spent</th>
          </tr>
        </thead>

        <tbody>

          ${
            Object.values(map)
              .map(function (c) {
                return `
                  <tr>
                    <td>
                      ${esc(c.name)}
                    </td>

                    <td>
                      ${esc(c.phone)}
                    </td>

                    <td>
                      ${c.orders}
                    </td>

                    <td>
                      ৳${c.spent.toLocaleString()}
                    </td>
                  </tr>
                `;
              })
              .join('') ||
            `
              <tr>
                <td
                  colspan="4"
                  class="empty"
                >
                  No customers yet
                </td>
              </tr>
            `
          }

        </tbody>

      </table>

    </div>
  `;
}

/* =========================
   CATEGORIES
========================= */

function categories() {
  return `
    <div class="grid2">

      <div class="card">

        <div class="section-head">

          <h3>Categories</h3>

          <button
            class="btn primary"
            onclick="addCategory()"
          >
            ＋ Add
          </button>

        </div>

        <div class="mini-list">

          ${db.categories
            .map(function (c, i) {
              return `
                <div class="mini-item">

                  <span>
                    ${esc(c)}
                  </span>

                  <span>

                    <button
                      class="btn muted"
                      onclick="renameCategory(${i})"
                    >
                      Edit
                    </button>

                    <button
                      class="btn danger"
                      onclick="deleteCategory(${i})"
                    >
                      Delete
                    </button>

                  </span>

                </div>
              `;
            })
            .join('')}

        </div>

      </div>

      <div class="card">

        <h3>Category Control</h3>

        <p class="label">
          Products are grouped by these
          categories.
        </p>

      </div>

    </div>
  `;
}

function addCategory() {
  const c =
    prompt('Category name');

  if (
    c &&
    c.trim() &&
    !db.categories.includes(
      c.trim()
    )
  ) {
    db.categories.push(
      c.trim()
    );

    save();
    render();
  }
}

function renameCategory(i) {
  const c = prompt(
    'New name',
    db.categories[i]
  );

  if (c && c.trim()) {
    db.products.forEach(
      function (p) {
        if (
          p.category ===
          db.categories[i]
        ) {
          p.category =
            c.trim();
        }
      }
    );

    db.categories[i] =
      c.trim();

    save();
    render();
  }
}

function deleteCategory(i) {
  if (
    confirm(
      'Delete category?'
    )
  ) {
    db.categories.splice(
      i,
      1
    );

    save();
    render();
  }
}

/* =========================
   DELIVERY
========================= */

function delivery() {
  return `
    <div class="card">

      <div class="section-head">
        <h3>Delivery Settings</h3>
      </div>

      <div class="form-grid">

        <label>
          Dhaka City Fee

          <input
            id="d_dhaka"
            type="number"
            value="${db.delivery.dhaka}"
          >
        </label>

        <label>
          Nearby Dhaka Fee

          <input
            id="d_nearby"
            type="number"
            value="${db.delivery.nearby}"
          >
        </label>

        <label>
          Outside Dhaka Fee

          <input
            id="d_outside"
            type="number"
            value="${db.delivery.outside}"
          >
        </label>

        <label class="full">
          Nearby Districts
          (comma separated)

          <input
            id="d_dist"
            value="${esc(
              db.delivery.nearbyDistricts
            )}"
          >
        </label>

      </div>

      <div class="btn-row">

        <button
          class="btn primary"
          onclick="saveDelivery()"
        >
          Save Delivery Settings
        </button>

      </div>

    </div>
  `;
}

function saveDelivery() {
  db.delivery = {
    dhaka: Number(
      $('d_dhaka').value
    ),

    nearby: Number(
      $('d_nearby').value
    ),

    outside: Number(
      $('d_outside').value
    ),

    nearbyDistricts:
      $('d_dist').value
  };

  save();

  alert(
    'Delivery settings saved'
  );

  render();
}

/* =========================
   PAYMENTS
========================= */

function payments() {
  return `
    <div class="card">

      <div class="form-grid">

        <label>
          Cash on Delivery

          <select id="pay_cod">

            <option
              value="true"
              ${
                db.payments.cod
                  ? 'selected'
                  : ''
              }
            >
              Enabled
            </option>

            <option
              value="false"
              ${
                !db.payments.cod
                  ? 'selected'
                  : ''
              }
            >
              Disabled
            </option>

          </select>
        </label>

        <label>
          bKash

          <select id="pay_bk">

            <option
              value="true"
              ${
                db.payments.bkash
                  ? 'selected'
                  : ''
              }
            >
              Enabled
            </option>

            <option
              value="false"
              ${
                !db.payments.bkash
                  ? 'selected'
                  : ''
              }
            >
              Disabled
            </option>

          </select>
        </label>

        <label>
          Nagad

          <select id="pay_ng">

            <option
              value="true"
              ${
                db.payments.nagad
                  ? 'selected'
                  : ''
              }
            >
              Enabled
            </option>

            <option
              value="false"
              ${
                !db.payments.nagad
                  ? 'selected'
                  : ''
              }
            >
              Disabled
            </option>

          </select>
        </label>

        <label>
          bKash Number

          <input
            id="pay_bn"
            value="${esc(
              db.payments.bkashNumber ||
              ''
            )}"
          >
        </label>

        <label>
          Nagad Number

          <input
            id="pay_nn"
            value="${esc(
              db.payments.nagadNumber ||
              ''
            )}"
          >
        </label>

      </div>

      <div class="btn-row">

        <button
          class="btn primary"
          onclick="savePayments()"
        >
          Save Payment Settings
        </button>

      </div>

    </div>
  `;
}

function savePayments() {
  db.payments = {
    cod:
      $('pay_cod').value ===
      'true',

    bkash:
      $('pay_bk').value ===
      'true',

    nagad:
      $('pay_ng').value ===
      'true',

    bkashNumber:
      $('pay_bn').value,

    nagadNumber:
      $('pay_nn').value
  };

  save();

  alert(
    'Payment settings saved'
  );

  render();
}

/* =========================
   STORE SETTINGS
========================= */

function settings() {
  return `
    <div class="card">

      <div class="form-grid">

        <label>
          Store Name

          <input
            id="s_store"
            value="${esc(
              db.settings.store ||
              'Gadget Bazar BD'
            )}"
          >
        </label>

        <label>
          Admin Name

          <input
            id="s_admin"
            value="${esc(
              db.settings.admin ||
              'Administrator'
            )}"
          >
        </label>

        <label>
          Phone

          <input
            id="s_phone"
            value="${esc(
              db.settings.phone ||
              ''
            )}"
          >
        </label>

        <label>
          Email

          <input
            id="s_email"
            value="${esc(
              db.settings.email ||
              ''
            )}"
          >
        </label>

        <label class="full">
          Logo URL

          <input
            id="s_logo"
            value="${esc(
              db.settings.logo ||
              ''
            )}"
          >
        </label>

      </div>

      <div class="btn-row">

        <button
          class="btn primary"
          onclick="saveSettings()"
        >
          Save Settings
        </button>

      </div>

    </div>

    <div
      class="card"
      style="margin-top:16px"
    >

      <h3>
        Data & Connection
      </h3>

      <p class="label">
        This version uses browser storage.
        Live customer website synchronization
        will be connected separately.
      </p>

    </div>
  `;
}

function saveSettings() {
  db.settings = {
    store:
      $('s_store').value,

    admin:
      $('s_admin').value,

    phone:
      $('s_phone').value,

    email:
      $('s_email').value,

    logo:
      $('s_logo').value
  };

  save();

  alert(
    'Settings saved'
  );

  render();
}

/* =========================
   MODAL
========================= */

function closeModal() {
  if ($('modal')) {
    $('modal').classList.add(
      'hidden'
    );
  }
}

/* =========================
   EXPORT
========================= */

 function exportData() {
  const blob =
    new Blob(
      [
        JSON.stringify(
          db,
          null,
