/* =========================================================
   GADGET BAZAR BD — ADMIN PANEL
   SUPABASE VERSION
========================================================= */

const SUPABASE_URL =
  'https://vwwysrdqexjtlmpmevub.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax';

const sb =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

const BUCKET =
  'product images';

const ADMIN_UID =
  '9aa2e054-a19a-4f86-aaf7-25f13e720722';

let productsCache = [];
let ordersCache = [];
let categoriesCache = [];

let currentSection =
  'dashboard';

let editingProductId =
  null;


/* =========================================================
   HELPERS
========================================================= */

function $(id){
  return document.getElementById(id);
}

function esc(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function money(value){
  return '৳' +
    Number(value || 0)
      .toLocaleString('en-BD');
}

function showError(error){

  console.error(error);

  alert(
    'Something went wrong.\n\n' +
    (
      error?.message ||
      error ||
      'Unknown error'
    )
  );
}

function closeModal(){

  if($('modal')){
    $('modal')
      .classList
      .add('hidden');
  }

}

function openModal(title,body){

  if($('modalTitle')){
    $('modalTitle')
      .textContent = title;
  }

  if($('modalBody')){
    $('modalBody')
      .innerHTML = body;
  }

  if($('modal')){
    $('modal')
      .classList
      .remove('hidden');
  }

}


/* =========================================================
   AUTH
========================================================= */

async function checkAdmin(){

  const {
    data:{session}
  } =
    await sb.auth.getSession();

  if(!session){

    location.href =
      'login.html';

    return false;
  }

  if(
    session.user.id !==
    ADMIN_UID
  ){

    await sb.auth.signOut();

    alert(
      'You are not authorized as admin.'
    );

    location.href =
      'login.html';

    return false;
  }

  return true;
}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

async function uploadImage(
  file,
  id
){

  if(!file) return '';

  const ext =
    (
      file.name
        .split('.')
        .pop() ||
      'jpg'
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ''
      );

  const path =
    `products/${id}_${Date.now()}.${ext}`;

  const {
    error
  } =
    await sb.storage
      .from(BUCKET)
      .upload(
        path,
        file,
        {
          upsert:true,
          contentType:file.type
        }
      );

  if(error)
    throw error;

  const {
    data
  } =
    sb.storage
      .from(BUCKET)
      .getPublicUrl(path);

  return data.publicUrl;
}


/* =========================================================
   LOAD CLOUD DATA
========================================================= */

async function loadCloud(){

  const [
    productsResult,
    ordersResult,
    categoriesResult
  ] =
    await Promise.all([

      sb
        .from('products')
        .select('*')
        .order(
          'created_at',
          {ascending:false}
        ),

      sb
        .from('orders')
        .select('*')
        .order(
          'created_at',
          {ascending:false}
        ),

      sb
        .from('categories')
        .select('*')
        .order(
          'name',
          {ascending:true}
        )

    ]);

  if(productsResult.error)
    throw productsResult.error;

  if(ordersResult.error)
    throw ordersResult.error;

  if(categoriesResult.error)
    throw categoriesResult.error;

  productsCache =
    productsResult.data || [];

  ordersCache =
    ordersResult.data || [];

  categoriesCache =
    categoriesResult.data || [];

}


/* =========================================================
   REFRESH PRODUCTS
========================================================= */

async function refreshProducts(){

  const {
    data,
    error
  } =
    await sb
      .from('products')
      .select('*')
      .order(
        'created_at',
        {ascending:false}
      );

  if(error)
    throw error;

  productsCache =
    data || [];

}


/* =========================================================
   REFRESH ORDERS
========================================================= */

async function refreshOrders(){

  const {
    data,
    error
  } =
    await sb
      .from('orders')
      .select('*')
      .order(
        'created_at',
        {ascending:false}
      );

  if(error)
    throw error;

  ordersCache =
    data || [];

}


/* =========================================================
   DASHBOARD
========================================================= */

function dashboard(){

  const totalProducts =
    productsCache.length;

  const activeProducts =
    productsCache.filter(
      p => p.active !== false
    ).length;

  const totalOrders =
    ordersCache.length;

  const pendingOrders =
    ordersCache.filter(
      o =>
        (o.status || 'Pending') ===
        'Pending'
    ).length;

  const deliveredOrders =
    ordersCache.filter(
      o =>
        (o.status || '') ===
        'Delivered'
    ).length;

  const revenue =
    ordersCache
      .filter(
        o =>
          (o.status || '') !==
          'Cancelled'
      )
      .reduce(
        (sum,o) =>
          sum +
          Number(
            o.total ||
            (
              Number(o.subtotal || 0) +
              Number(
                o.delivery_charge || 0
              )
            )
          ),
        0
      );

  const recent =
    ordersCache.slice(0,5);

  return `

    <div class="section-head">

      <div>
        <h3>Dashboard</h3>
        <p>Gadget Bazar BD overview</p>
      </div>

      <button
        class="btn muted"
        onclick="refreshDashboard()">
        ↻ Refresh
      </button>

    </div>

    <div class="stats-grid">

      <div class="stat-card">
        <div class="stat-label">
          Total Products
        </div>
        <div class="stat-value">
          ${totalProducts}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Active Products
        </div>
        <div class="stat-value">
          ${activeProducts}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Total Orders
        </div>
        <div class="stat-value">
          ${totalOrders}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Pending Orders
        </div>
        <div class="stat-value">
          ${pendingOrders}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Delivered
        </div>
        <div class="stat-value">
          ${deliveredOrders}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Revenue
        </div>
        <div class="stat-value">
          ${money(revenue)}
        </div>
      </div>

    </div>

    <div class="section-head">
      <h3>Recent Orders</h3>
    </div>

    <div class="table-wrap">

      <table class="table">

        <thead>

          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Total</th>
            <th>Status</th>
          </tr>

        </thead>

        <tbody>

          ${
            recent.length
            ? recent.map(o => {

                const status =
                  o.status ||
                  'Pending';

                const orderNumber =
                  o.order_number ||
                  o.order_id ||
                  o.id ||
                  '';

                const customerName =
                  o.customer_name ||
                  o.customer?.name ||
                  o.name ||
                  '—';

                const phone =
                  o.phone ||
                  o.customer_phone ||
                  o.customer?.phone ||
                  '—';

                const total =
                  o.total ||
                  (
                    Number(
                      o.subtotal || 0
                    ) +
                    Number(
                      o.delivery_charge || 0
                    )
                  );

                return `

                  <tr>

                    <td>
                      ${esc(orderNumber)}
                    </td>

                    <td>
                      ${esc(customerName)}
                    </td>

                    <td>
                      ${esc(phone)}
                    </td>

                    <td>
                      ${money(total)}
                    </td>

                    <td>

                      <span class="pill ${
                        status === 'Delivered'
                          ? 'green'
                          : status === 'Cancelled'
                          ? 'red'
                          : status === 'Pending'
                          ? 'yellow'
                          : 'blue'
                      }">

                        ${esc(status)}

                      </span>

                    </td>

                  </tr>

                `;

              }).join('')
            : `

              <tr>

                <td
                  colspan="5"
                  class="empty">

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


/* =========================================================
   PRODUCTS
========================================================= */

function products(){

  const rows =
    productsCache
      .map((p,i) => {

        const active =
          p.active !== false;

        return `

          <tr>

            <td>

              ${
                p.image
                ? `

                  <img
                    src="${esc(p.image)}"
                    style="
                      width:50px;
                      height:50px;
                      object-fit:cover;
                      border-radius:10px;
                    "
                  >

                `
                : '—'
              }

            </td>

            <td>
              ${esc(p.name)}
            </td>

            <td>
              ${esc(
                p.category || '—'
              )}
            </td>

            <td>
              ${money(p.price)}
            </td>

            <td>
              ${esc(p.stock ?? 0)}
            </td>

            <td>

              <span class="pill ${
                active
                  ? 'green'
                  : 'red'
              }">

                ${
                  active
                  ? 'Active'
                  : 'Inactive'
                }

              </span>

            </td>

            <td class="actions">

              <button
                class="btn"
                onclick="editProduct(${i})">

                Edit

              </button>

              <button
                class="btn danger"
                onclick="deleteProduct(${i})">

                Delete

              </button>

            </td>

          </tr>

        `;

      })
      .join('');

  return `

    <div class="section-head">

      <div>

        <h3>Products</h3>

        <p>
          Manage your Gadget Bazar BD products
        </p>

      </div>

      <div class="toolbar">

        <button
          class="btn primary"
          onclick="addProduct()">

          + Add Product

        </button>

        <button
          class="btn muted"
          onclick="
            refreshProducts()
              .then(render)
              .catch(showError)
          ">

          ↻ Refresh

        </button>

      </div>

    </div>

    <div class="table-wrap">

      <table class="table">

        <thead>

          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Action</th>
          </tr>

        </thead>

        <tbody>

          ${
            rows ||
            `

              <tr>

                <td
                  colspan="7"
                  class="empty">

                  No products yet

                </td>

              </tr>

            `
          }

        </tbody>

      </table>

    </div>

  `;

}


/* =========================================================
   ADD PRODUCT
========================================================= */

function addProduct(){

  editingProductId =
    null;

  openModal(
    'Add Product',
    productForm()
  );

}


/* =========================================================
   EDIT PRODUCT
========================================================= */

function editProduct(i){

  const p =
    productsCache[i];

  if(!p) return;

  editingProductId =
    p.id;

  openModal(
    'Edit Product',
    productForm(p)
  );

}


/* =========================================================
   PRODUCT FORM
========================================================= */

function productForm(p = {}){

  const categories =
    categoriesCache
      .map(c => c.name)
      .filter(Boolean);

  const categoryOptions =
    categories
      .map(
        c => `
          <option
            value="${esc(c)}"
            ${
              p.category === c
                ? 'selected'
                : ''
            }>
            ${esc(c)}
          </option>
        `
      )
      .join('');

  return `

    <div class="form-grid">

      <label>

        Product Name

        <input
          id="productName"
          value="${esc(
            p.name || ''
          )}"
          placeholder="Product name"
        >

      </label>

      <label>

        Category

        <input
          id="productCategory"
          list="categoryList"
          value="${esc(
            p.category || ''
          )}"
          placeholder="Audio"
        >

        <datalist id="categoryList">

          ${categoryOptions}

        </datalist>

      </label>

      <label>

        Price

        <input
          id="productPrice"
          type="number"
          min="0"
          value="${Number(
            p.price || 0
          )}"
        >

      </label>

      <label>

        Discount

        <input
          id="productDiscount"
          type="number"
          min="0"
          value="${Number(
            p.discount || 0
          )}"
        >

      </label>

      <label>

        Stock

        <input
          id="productStock"
          type="number"
          min="0"
          value="${Number(
            p.stock || 0
          )}"
        >

      </label>

      <label>

        Status

        <select id="productActive">

          <option
            value="true"
            ${
              p.active !== false
                ? 'selected'
                : ''
            }>

            Active

          </option>

          <option
            value="false"
            ${
              p.active === false
                ? 'selected'
                : ''
            }>

            Inactive

          </option>

        </select>

      </label>

      <label
        style="grid-column:1/-1">

        Product Image

        <input
          id="productImage"
          type="file"
          accept="image/*"
        >

      </label>

      ${
        p.image
        ? `

          <div
            style="grid-column:1/-1">

            <img
              src="${esc(p.image)}"
              style="
                width:100px;
                height:100px;
                object-fit:cover;
                border-radius:12px;
              "
            >

          </div>

        `
        : ''
      }

    </div>

    <div class="btn-row">

      <button
        class="btn muted"
        onclick="closeModal()">

        Cancel

      </button>

      <button
        class="btn primary"
        onclick="saveProduct()">

        Save Product

      </button>

    </div>

  `;

}


/* =========================================================
   SAVE PRODUCT
========================================================= */

async function saveProduct(){

  const name =
    $('productName')
      ?.value
      .trim();

  const category =
    $('productCategory')
      ?.value
      .trim();

  const price =
    Number(
      $('productPrice')
        ?.value || 0
    );

  const discount =
    Number(
      $('productDiscount')
        ?.value || 0
    );

  const stock =
    Number(
      $('productStock')
        ?.value || 0
    );

  const active =
    $('productActive')
      ?.value === 'true';

  const file =
    $('productImage')
      ?.files?.[0];

  if(!name){

    alert(
      'Product name is required.'
    );

    return;
  }

  try{

    const id =
      editingProductId ||
      crypto.randomUUID();

    const oldProduct =
      productsCache.find(
        p => p.id === id
      );

    let image =
      oldProduct?.image || '';

    if(file){

      image =
        await uploadImage(
          file,
          id
        );

    }

    const payload = {

      id,
      name,
      category,
      price,
      discount,
      stock,
      active,
      image

    };

    const {
      error
    } =
      await sb
        .from('products')
        .upsert(
          payload,
          {
            onConflict:'id'
          }
        );

    if(error)
      throw error;

    await refreshProducts();

    closeModal();

    render();

    alert(
      editingProductId
        ? 'Product updated successfully.'
        : 'Product added successfully.'
    );

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   DELETE PRODUCT
========================================================= */

async function deleteProduct(i){

  const p =
    productsCache[i];

  if(!p) return;

  if(
    !confirm(
      `Delete "${p.name}"?`
    )
  ){

    return;

  }

  try{

    const {
      error
    } =
      await sb
        .from('products')
        .delete()
        .eq(
          'id',
          p.id
        );

    if(error)
      throw error;

    await refreshProducts();

    render();

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   ORDERS
========================================================= */

function orders(){

  const rows =
    ordersCache
      .map((o,i) => {

        const status =
          o.status ||
          'Pending';

        const orderNumber =
          o.order_number ||
          o.order_id ||
          o.id ||
          '#' + (i + 1);

        const total =
          o.total ||
          (
            Number(
              o.subtotal || 0
            ) +
            Number(
              o.delivery_charge || 0
            )
          );

        let buttons = '';

        /* Pending → Confirm */

        if(
          status === 'Pending'
        ){

          buttons += `

            <button
              class="btn primary"
              onclick="
                updateOrderStatus(
                  ${i},
                  'Confirmed'
                )
              ">

              Confirm

            </button>

          `;

        }

        /* Confirmed → Processing */

        if(
          status === 'Confirmed'
        ){

          buttons += `

            <button
              class="btn primary"
              onclick="
                updateOrderStatus(
                  ${i},
                  'Processing'
                )
              ">

              Processing

            </button>

          `;

        }

        /* Processing → Shipped */

        if(
          status === 'Processing'
        ){

          buttons += `

            <button
              class="btn primary"
              onclick="
                updateOrderStatus(
                  ${i},
                  'Shipped'
                )
              ">

              Shipped

            </button>

          `;

        }

        /* Shipped → Delivered */

        if(
          status === 'Shipped'
        ){

          buttons += `

            <button
              class="btn primary"
              onclick="
                updateOrderStatus(
                  ${i},
                  'Delivered'
                )
              ">

              Delivered

            </button>

          `;

        }

        /* Cancel */

        if(
          status !== 'Delivered' &&
          status !== 'Cancelled'
        ){

          buttons += `

            <button
              class="btn danger"
              onclick="
                updateOrderStatus(
                  ${i},
                  'Cancelled'
                )
              ">

              Cancel

            </button>

          `;

        }

        return `

          <tr>

            <td>
              ${esc(orderNumber)}
            </td>

            <td>
              ${esc(
                o.customer_name ||
                o.customer?.name ||
                o.name ||
                '—'
              )}
            </td>

            <td>
              ${esc(
                o.phone ||
                o.customer_phone ||
                o.customer?.phone ||
                '—'
              )}
            </td>

            <td>
              ${money(total)}
            </td>

            <td>
              ${esc(
                o.payment_method ||
                o.paymentMethod ||
                'COD'
              )}
            </td>

            <td>

              <span class="pill ${
                status === 'Delivered'
                  ? 'green'
                  : status === 'Cancelled'
                  ? 'red'
                  : status === 'Pending'
                  ? 'yellow'
                  : 'blue'
              }">

                ${esc(status)}

              </span>

            </td>

            <td class="actions">

              <button
                class="btn"
                onclick="viewOrder(${i})">

                View

              </button>

              ${buttons}

            </td>

          </tr>

        `;

      })
      .join('');

  return `

    <div class="section-head">

      <div>

        <h3>Orders</h3>

        <p>
          Manage customer orders
        </p>

      </div>

      <div class="toolbar">

        <button
          class="btn muted"
          onclick="
            refreshOrders()
              .then(render)
              .catch(showError)
          ">

          ↻ Refresh

        </button>

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

        <tbody>

          ${
            rows ||
            `

              <tr>

                <td
                  colspan="7"
                  class="empty">

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


/* =========================================================
   VIEW ORDER
========================================================= */

function viewOrder(i){

  const o =
    ordersCache[i];

  if(!o) return;

  const orderNumber =
    o.order_number ||
    o.order_id ||
    o.id ||
    '';

  const name =
    o.customer_name ||
    o.customer?.name ||
    o.name ||
    '';

  const phone =
    o.phone ||
    o.customer_phone ||
    o.customer?.phone ||
    '';

  const district =
    o.district ||
    o.customer?.district ||
    '';

  const upazila =
    o.upazila ||
    o.customer?.upazila ||
    '';

  const address =
    o.address ||
    o.customer?.address ||
    '';

  const payment =
    o.payment_method ||
    o.paymentMethod ||
    'COD';

  const total =
    o.total ||
    (
      Number(
        o.subtotal || 0
      ) +
      Number(
        o.delivery_charge || 0
      )
    );

  const status =
    o.status ||
    'Pending';

  openModal(

    'Order ' +
      orderNumber,

    `

      <div class="card">

        <b>Customer</b>

        <p>
          ${esc(name)}
          ·
          ${esc(phone)}
        </p>

        <p>

          ${esc(district)}

          ${
            district ||
            upazila
              ? ', '
              : ''
          }

          ${esc(upazila)}

        </p>

        <p>
          ${esc(address)}
        </p>

        <hr>

        <p>

          <b>Payment:</b>

          ${esc(payment)}

          ${
            o.transaction_id
              ? ' · TXN: ' +
                esc(
                  o.transaction_id
                )
              : ''
          }

        </p>

        <p>

          <b>Status:</b>
          ${esc(status)}

        </p>

        <p>

          <b>Subtotal:</b>
          ${money(o.subtotal)}

        </p>

        <p>

          <b>Delivery:</b>
          ${money(
            o.delivery_charge
          )}

        </p>

        <p>

          <b>Total:</b>
          ${money(total)}

        </p>

        <p>

          <b>Note:</b>
          ${esc(
            o.note || '—'
          )}

        </p>

      </div>

      <div class="btn-row">

        ${
          status === 'Pending'
            ? `

              <button
                class="btn primary"
                onclick="
                  updateOrderStatus(
                    ${i},
                    'Confirmed'
                  )
                ">

                Confirm Order

              </button>

            `
            : ''
        }

        ${
          status === 'Confirmed'
            ? `

              <button
                class="btn primary"
                onclick="
                  updateOrderStatus(
                    ${i},
                    'Processing'
                  )
                ">

                Processing

              </button>

            `
            : ''
        }

        ${
          status === 'Processing'
            ? `

              <button
                class="btn primary"
                onclick="
                  updateOrderStatus(
                    ${i},
                    'Shipped'
                  )
                ">

                Shipped

              </button>

            `
            : ''
        }

        ${
          status === 'Shipped'
            ? `

              <button
                class="btn primary"
                onclick="
                  updateOrderStatus(
                    ${i},
                    'Delivered'
                  )
                ">

                Delivered

              </button>

            `
            : ''
        }

        ${
          status !== 'Delivered' &&
          status !== 'Cancelled'
            ? `

              <button
                class="btn danger"
                onclick="
                  updateOrderStatus(
                    ${i},
                    'Cancelled'
                  )
                ">

                Cancel

              </button>

            `
            : ''
        }

      </div>

    `
  );

}


/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

async function updateOrderStatus(
  i,
  newStatus
){

  const order =
    ordersCache[i];

  if(!order)
    return;

  const oldStatus =
    order.status ||
    'Pending';

  if(
    oldStatus === newStatus
  )
    return;

  const orderNumber =
    order.order_number ||
    order.order_id ||
    order.id ||
    '';

  if(
    !confirm(
      `Order ${orderNumber}\n\n` +
      `Change status to "${newStatus}"?`
    )
  ){

    return;

  }

  try{

    const {
      error
    } =
      await sb
        .from('orders')
        .update({
          status:newStatus
        })
        .eq(
          'id',
          order.id
        );

    if(error)
      throw error;

    ordersCache[i].status =
      newStatus;

    await refreshOrders();

    closeModal();

    render();

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   CATEGORIES
========================================================= */

function categories(){

  const rows =
    categoriesCache
      .map(
        (c,i) => `

          <tr>

            <td>
              ${esc(c.name)}
            </td>

            <td>
              ${esc(
                c.slug || '—'
              )}
            </td>

            <td>

              <button
                class="btn danger"
                onclick="
                  deleteCategory(${i})
                ">

                Delete

              </button>

            </td>

          </tr>

        `
      )
      .join('');

  return `

    <div class="section-head">

      <div>

        <h3>Categories</h3>

        <p>
          Manage product categories
        </p>

      </div>

      <button
        class="btn primary"
        onclick="addCategory()">

        + Add Category

      </button>

    </div>

    <div class="table-wrap">

      <table class="table">

        <thead>

          <tr>

            <th>Name</th>
            <th>Slug</th>
            <th>Action</th>

          </tr>

        </thead>

        <tbody>

          ${
            rows ||
            `

              <tr>

                <td
                  colspan="3"
                  class="empty">

                  No categories

                </td>

              </tr>

            `
          }

        </tbody>

      </table>

    </div>

  `;

}


/* =========================================================
   ADD CATEGORY
========================================================= */

function addCategory(){

  openModal(

    'Add Category',

    `

      <label>

        Category Name

        <input
          id="categoryName"
          placeholder="Audio"
          style="
            width:100%;
            margin-top:6px;
            padding:10px;
            border:1px solid #dce3ec;
            border-radius:8px;
          "
        >

      </label>

      <div class="btn-row">

        <button
          class="btn muted"
          onclick="closeModal()">

          Cancel

        </button>

        <button
          class="btn primary"
          onclick="saveCategory()">

          Save

        </button>

      </div>

    `
  );

}


/* =========================================================
   SAVE CATEGORY
========================================================= */

async function saveCategory(){

  const name =
    $('categoryName')
      ?.value
      .trim();

  if(!name){

    alert(
      'Category name is required.'
    );

    return;

  }

  try{

    const slug =
      name
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          '-'
        )
        .replace(
          /^-|-$/g,
          ''
        );

    const {
      error
    } =
      await sb
        .from('categories')
        .insert({
          name,
          slug
        });

    if(error)
      throw error;

    const {
      data,
      error:loadError
    } =
      await sb
        .from('categories')
        .select('*')
        .order('name');

    if(loadError)
      throw loadError;

    categoriesCache =
      data || [];

    closeModal();

    render();

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   DELETE CATEGORY
========================================================= */

async function deleteCategory(i){

  const c =
    categoriesCache[i];

  if(!c)
    return;

  if(
    !confirm(
      `Delete category "${c.name}"?`
    )
  ){

    return;

  }

  try{

    const {
      error
    } =
      await sb
        .from('categories')
        .delete()
        .eq(
          'id',
          c.id
        );

    if(error)
      throw error;

    categoriesCache =
      categoriesCache.filter(
        x => x.id !== c.id
      );

    render();

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   DELIVERY
========================================================= */

function delivery(){

  return `

    <div class="section-head">

      <div>

        <h3>
          Delivery Settings
        </h3>

        <p>
          Delivery settings
        </p>

      </div>

    </div>

    <div class="card">

      <p>
        Delivery settings section is ready.
      </p>

      <p>
        You can configure Dhaka,
        nearby districts and
        outside Dhaka delivery charges here.
      </p>

    </div>

  `;

}


/* =========================================================
   PAYMENT
========================================================= */

function payment(){

  return `

    <div class="section-head">

      <div>

        <h3>
          Payment Settings
        </h3>

        <p>
          Payment settings
        </p>

      </div>

    </div>

    <div class="card">

      <p>
        Payment settings will be configured later.
      </p>

      <p>
        Current checkout continues to support
        Cash on Delivery and the existing
        payment options.
      </p>

    </div>

  `;

}


/* =========================================================
   STORE SETTINGS
========================================================= */

function settings(){

  return `

    <div class="section-head">

      <div>

        <h3>
          Store Settings
        </h3>

        <p>
          Gadget Bazar BD
        </p>

      </div>

    </div>

    <div class="card">

      <p>
        Store settings are connected to Supabase.
      </p>

    </div>

  `;

}


/* =========================================================
   CUSTOMERS
========================================================= */

function customers(){

  const unique = {};

  ordersCache.forEach(o => {

    const phone =
      o.phone ||
      o.customer_phone ||
      o.customer?.phone ||
      '';

    if(!phone)
      return;

    unique[phone] = {

      name:
        o.customer_name ||
        o.customer?.name ||
        o.name ||
        '—',

      phone,

      orders:
        (
          unique[phone]?.orders ||
          0
        ) + 1

    };

  });

  const list =
    Object.values(unique);

  return `

    <div class="section-head">

      <div>

        <h3>
          Customers
        </h3>

        <p>
          Customers from your orders
        </p>

      </div>

    </div>

    <div class="table-wrap">

      <table class="table">

        <thead>

          <tr>

            <th>Name</th>
            <th>Phone</th>
            <th>Orders</th>

          </tr>

        </thead>

        <tbody>

          ${
            list.length
            ? list.map(
                c => `

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

                  </tr>

                `
              ).join('')
            : `

              <tr>

                <td
                  colspan="3"
                  class="empty">

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


/* =========================================================
   NAVIGATION
========================================================= */

function go(section){

  currentSection =
    section;

  document
    .querySelectorAll('.nav')
    .forEach(el => {

      el.classList.toggle(
        'active',
        el.dataset.page ===
        section
      );

    });

  const titleMap = {

    dashboard:'Dashboard',
    products:'Products',
    orders:'Orders',
    customers:'Customers',
    categories:'Categories',
    delivery:'Delivery',
    payments:'Payments',
    settings:'Settings'

  };

  const subtitleMap = {

    dashboard:'Store overview',
    products:'Manage products',
    orders:'Manage customer orders',
    customers:'Customer list',
    categories:'Manage categories',
    delivery:'Delivery settings',
    payments:'Payment settings',
    settings:'Store settings'

  };

  if($('pageTitle')){

    $('pageTitle')
      .textContent =
      titleMap[section] ||
      'Dashboard';

  }

  if($('pageSub')){

    $('pageSub')
      .textContent =
      subtitleMap[section] ||
      'Store overview';

  }

  render();

  if(
    window.innerWidth <= 720
  ){

    const sidebar =
      document.querySelector(
        '.sidebar'
      );

    sidebar?.classList
      .remove('open');

  }

}


/* =========================================================
   RENDER
========================================================= */

function render(){

  const content =
    $('content');

  if(!content)
    return;

  let html = '';

  switch(
    currentSection
  ){

    case 'dashboard':
      html = dashboard();
      break;

    case 'products':
      html = products();
      break;

    case 'orders':
      html = orders();
      break;

    case 'customers':
      html = customers();
      break;

    case 'categories':
      html = categories();
      break;

    case 'delivery':
      html = delivery();
      break;

    case 'payments':
      html = payment();
      break;

    case 'settings':
      html = settings();
      break;

    default:
      html = dashboard();

  }

  content.innerHTML =
    html;

}


/* =========================================================
   REFRESH DASHBOARD
========================================================= */

async function refreshDashboard(){

  try{

    await loadCloud();

    render();

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   LOGIN
========================================================= */

async function login(){

  const email =
    $('loginUser')
      ?.value
      .trim();

  const password =
    $('loginPass')
      ?.value;

  if(
    !email ||
    !password
  ){

    alert(
      'Please enter admin email and password.'
    );

    return;

  }

  try{

    const {
      data,
      error
    } =
      await sb.auth
        .signInWithPassword({
          email,
          password
        });

    if(error)
      throw error;

    if(!data?.user){

      alert(
        'Login failed.'
      );

      return;

    }

    if(
      data.user.id !==
      ADMIN_UID
    ){

      await sb.auth.signOut();

      alert(
        'You are not authorized as admin.'
      );

      return;

    }

    $('login')
      ?.classList
      .add('hidden');

    $('app')
      ?.classList
      .remove('hidden');

    await loadCloud();

    render();

  }catch(e){

    console.error(
      'LOGIN ERROR:',
      e
    );

    alert(
      'Login failed.\n\n' +
      (
        e?.message ||
        'Invalid email or password.'
      )
    );

  }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout(){

  try{

    await sb.auth.signOut();

    location.href =
      'login.html';

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function toggleSidebar(){

  const sidebar =
    document.querySelector(
      '.sidebar'
    );

  if(sidebar){

    sidebar.classList.toggle(
      'open'
    );

  }

}


/* =========================================================
   NAV BUTTON EVENTS
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    document
      .querySelectorAll(
        '.nav'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            go(
              button.dataset.page
            );

          }
        );

      });

  }
);


/* =========================================================
   INITIALIZE
========================================================= */

async function init(){

  try{

    const ok =
      await checkAdmin();

    if(!ok)
      return;

    $('login')
      ?.classList
      .add('hidden');

    $('app')
      ?.classList
      .remove('hidden');

    await loadCloud();

    render();

  }catch(e){

    showError(e);

  }

}


/* =========================================================
   AUTO START
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  init
);


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.$ =
  $;

window.login =
  login;

window.render =
  render;

window.go =
  go;

window.logout =
  logout;

window.closeModal =
  closeModal;

window.openModal =
  openModal;

window.toggleSidebar =
  toggleSidebar;

window.addProduct =
  addProduct;

window.editProduct =
  editProduct;

window.saveProduct =
  saveProduct;

window.deleteProduct =
  deleteProduct;

window.viewOrder =
  viewOrder;

window.updateOrderStatus =
  updateOrderStatus;

window.addCategory =
  addCategory;

window.saveCategory =
  saveCategory;

window.deleteCategory =
  deleteCategory;

window.refreshProducts =
  refreshProducts;

window.refreshOrders =
  refreshOrders;

window.refreshDashboard =
  refreshDashboard;
