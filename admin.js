/* =========================================================
   GADGET BAZAR BD — FINAL ADMIN PANEL
   Supabase + Mobile Responsive + Catalog UI
   Delivery + Payment Settings Management
========================================================= */

const SUPABASE_URL='https://vwwysrdqexjtlmpmevub.supabase.co';
const SUPABASE_KEY='sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax';

const sb=window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const BUCKET='product images';

const ADMIN_UID='9aa2e054-a19a-4f86-aaf7-25f13e720722';


let productsCache=[];
let ordersCache=[];
let categoriesCache=[];
let deliverySettingsCache=null;

let paymentSettings={
  cod_enabled:true,
  bkash_enabled:false,
  bkash_number:'',
  nagad_enabled:false,
  nagad_number:''
};

let storeSettings={
  store_name:'Gadget Bazar BD',
  phone:'',
  address:''
};

let currentSection='dashboard';
let editingProductId=null;
let catalogOpen=true;


/* =========================================================
   HELPERS
========================================================= */

function $(id){
  return document.getElementById(id);
}


function esc(v){

  return String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

}


function money(v){

  return '৳'+Number(v||0).toLocaleString('en-BD');

}


function showError(e){

  console.error(e);

  alert(
    'Something went wrong.\n\n'+
    (e?.message||e||'Unknown error')
  );

}


function closeModal(){

  $('modal')?.classList.add('hidden');

}


function openModal(title,body){

  if($('modalTitle'))
    $('modalTitle').textContent=title;

  if($('modalBody'))
    $('modalBody').innerHTML=body;

  $('modal')?.classList.remove('hidden');

}


/* =========================================================
   AUTH
========================================================= */

async function checkAdmin(){

  const {
    data:{session}
  }=await sb.auth.getSession();


  if(!session){

    showLogin();

    return false;

  }


  if(session.user.id!==ADMIN_UID){

    await sb.auth.signOut();

    showLogin();

    alert('You are not authorized as admin.');

    return false;

  }


  return true;

}


function showLogin(){

  $('login')?.classList.remove('hidden');

  $('app')?.classList.add('hidden');

}


function showApp(){

  $('login')?.classList.add('hidden');

  $('app')?.classList.remove('hidden');

}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

async function uploadImage(file,id){

  if(!file)return '';

  const ext=
    (file.name.split('.').pop()||'jpg')
      .toLowerCase()
      .replace(/[^a-z0-9]/g,'')||'jpg';


  const path=
    `products/${id}_${Date.now()}.${ext}`;


  const {error}=await sb
    .storage
    .from(BUCKET)
    .upload(
      path,
      file,
      {
        upsert:true,
        contentType:file.type
      }
    );


  if(error)throw error;


  return sb
    .storage
    .from(BUCKET)
    .getPublicUrl(path)
    .data
    .publicUrl;

}


/* =========================================================
   CLOUD DATA
========================================================= */

async function loadDeliverySettings(){

  const {data,error}=await sb
    .from('delivery_settings')
    .select('*')
    .order('id',{ascending:true})
    .limit(1);


  if(error)throw error;


  deliverySettingsCache=data?.[0]||null;

}


async function loadCloud(){

  const [
    p,
    o,
    c,
    d,
    pay,
    store
  ]=await Promise.all([

    sb
      .from('products')
      .select('*')
      .order('created_at',{ascending:false}),

    sb
      .from('orders')
      .select('*')
      .order('created_at',{ascending:false}),

    sb
      .from('categories')
      .select('*')
      .order('name',{ascending:true}),

    sb
      .from('delivery_settings')
      .select('*')
      .order('id',{ascending:true})
      .limit(1),

    sb
      .from('payment_settings')
      .select('*')
      .order('id',{ascending:true})
      .limit(1),

    sb
      .from('store_settings')
      .select('*')
      .order('id',{ascending:true})
      .limit(1)

  ]);


  if(p.error)throw p.error;
  if(o.error)throw o.error;
  if(c.error)throw c.error;
  if(d.error)throw d.error;
  if(pay.error)throw pay.error;
  if(store.error)throw store.error;


  productsCache=p.data||[];

  ordersCache=o.data||[];

  categoriesCache=c.data||[];

  deliverySettingsCache=d.data?.[0]||null;


  /* =======================================================
     PAYMENT SETTINGS
  ======================================================= */

  const payRow=pay.data?.[0];


  if(payRow){

    paymentSettings={

      cod_enabled:
        payRow.cod_enabled!==false,

      bkash_enabled:
        payRow.bkash_enabled===true,

      bkash_number:
        payRow.bkash_number||'',

      nagad_enabled:
        payRow.nagad_enabled===true,

      nagad_number:
        payRow.nagad_number||''

    };

  }


  /* =======================================================
     STORE SETTINGS
  ======================================================= */

  const storeRow=store.data?.[0];


  if(storeRow){

    storeSettings={

      store_name:
        storeRow.store_name??'Gadget Bazar BD',

      phone:
        storeRow.phone??'',

      address:
        storeRow.address??''

    };

  }


  if($('connectionStatus')){

    $('connectionStatus').textContent='● Connected';

    $('connectionStatus').className='live';

  }

}


async function refreshProducts(){

  const {data,error}=await sb
    .from('products')
    .select('*')
    .order('created_at',{ascending:false});


  if(error)throw error;


  productsCache=data||[];

}


async function refreshOrders(){

  const {data,error}=await sb
    .from('orders')
    .select('*')
    .order('created_at',{ascending:false});


  if(error)throw error;


  ordersCache=data||[];

}


async function refreshDeliverySettings(){

  await loadDeliverySettings();

  render();

}


function statusClass(s){

  return s==='Delivered'
    ?'green'
    :s==='Cancelled'
    ?'red'
    :s==='Pending'
    ?'yellow'
    :'blue';

}


/* =========================================================
   DASHBOARD
========================================================= */

function dashboard(){

  const total=productsCache.length;

  const active=
    productsCache.filter(
      p=>p.active!==false
    ).length;

  const stock=
    productsCache.reduce(
      (n,p)=>n+Number(p.stock||0),
      0
    );

  const totalOrders=ordersCache.length;

  const pending=
    ordersCache.filter(
      o=>(o.status||'Pending')==='Pending'
    ).length;

  const delivered=
    ordersCache.filter(
      o=>(o.status||'')==='Delivered'
    ).length;

  const revenue=
    ordersCache
      .filter(
        o=>(o.status||'')!=='Cancelled'
      )
      .reduce(
        (s,o)=>
          s+
          Number(
            o.total ??
            (
              Number(o.subtotal||0)+
              Number(o.delivery_charge||0)
            )
          ),
        0
      );


  const recent=ordersCache.slice(0,6);


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

    ${stat('▣','Total Products',total)}

    ${stat('✓','Active Products',active)}

    ${stat('▤','Total Orders',totalOrders)}

    ${stat('!','Pending Orders',pending)}

    ${stat('✓','Delivered',delivered)}

    ${stat('৳','Revenue',money(revenue))}

    ${stat('◉','Total Stock',stock)}

    ${stat('⌁','Categories',categoriesCache.length)}

  </div>


  <div class="section-head">

    <div>

      <h3>Recent Orders</h3>

      <p>Latest customer orders</p>

    </div>

    <button
      class="btn primary"
      onclick="go('orders')">

      View All Orders

    </button>

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

          ?

          recent.map(o=>{

            const s=o.status||'Pending';

            const id=
              o.order_number||
              o.order_id||
              o.id||
              '';

            const total=
              o.total ??
              (
                Number(o.subtotal||0)+
                Number(o.delivery_charge||0)
              );


            return `

            <tr>

              <td>${esc(id)}</td>

              <td>
                ${esc(
                  o.customer_name||
                  o.customer?.name||
                  o.name||
                  '—'
                )}
              </td>

              <td>
                ${esc(
                  o.phone||
                  o.customer_phone||
                  o.customer?.phone||
                  '—'
                )}
              </td>

              <td>${money(total)}</td>

              <td>

                <span class="pill ${statusClass(s)}">

                  ${esc(s)}

                </span>

              </td>

            </tr>

            `;

          }).join('')

          :

          `

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


function stat(icon,label,value){

  return `

  <div class="stat-card">

    <div class="stat-icon">
      ${icon}
    </div>

    <div class="stat-label">
      ${label}
    </div>

    <div class="stat-value">
      ${value}
    </div>

  </div>

  `;

}


/* =========================================================
   PRODUCTS
========================================================= */

function products(){

  return `

  <div class="section-head">

    <div>

      <h3>Products</h3>

      <p>Manage your product catalog</p>

    </div>


    <div class="toolbar">

      <button
        class="btn primary"
        onclick="addProduct()">

        ＋ Add Product

      </button>


      <button
        class="btn muted"
        onclick="refreshProducts().then(render).catch(showError)">

        ↻ Refresh

      </button>

    </div>

  </div>


  <div class="filters">

    <div class="search-wrap">

      <input
        class="input"
        id="productSearch"
        placeholder="Search products..."
        oninput="filterProducts()">

    </div>


    <select
      class="select"
      id="productCategoryFilter"
      onchange="filterProducts()">

      <option value="">
        All Categories
      </option>

      ${
        categoriesCache
          .map(c=>`

            <option value="${esc(c.name)}">

              ${esc(c.name)}

            </option>

          `)
          .join('')
      }

    </select>


    <select
      class="select"
      id="productStockFilter"
      onchange="filterProducts()">

      <option value="">
        All Stock
      </option>

      <option value="in">
        In Stock
      </option>

      <option value="out">
        Out of Stock
      </option>

    </select>

  </div>


  <div class="table-wrap">

    <table class="table">

      <thead>

        <tr>

          <th>Image</th>
          <th>Product</th>
          <th>Category</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Status</th>
          <th>Actions</th>

        </tr>

      </thead>


      <tbody id="productRows">

        ${productRows(productsCache)}

      </tbody>

    </table>

  </div>

  `;

}


function productRows(list){

  if(!list.length){

    return `

    <tr>

      <td
        colspan="7"
        class="empty">

        No products found

      </td>

    </tr>

    `;

  }


  return list.map(p=>`

    <tr>

      <td>

        ${
          p.image

          ?

          `

          <img
            class="thumb"
            src="${esc(p.image)}"
            alt="">

          `

          :

          '—'
        }

      </td>


      <td>

        <b>
          ${esc(p.name)}
        </b>

      </td>


      <td>
        ${esc(p.category||'—')}
      </td>


      <td>
        ${money(p.price)}
      </td>


      <td>
        ${Number(p.stock||0)}
      </td>


      <td>

        <span
          class="pill ${p.active!==false?'green':'red'}">

          ${
            p.active!==false
            ?
            'Active'
            :
            'Inactive'
          }

        </span>

      </td>


      <td class="actions">

        <button
          class="btn muted"
          onclick="editProduct(${productsCache.indexOf(p)})">

          Edit

        </button>


        <button
          class="btn danger"
          onclick="deleteProduct(${productsCache.indexOf(p)})">

          Delete

        </button>

      </td>

    </tr>

  `).join('');

}


function filterProducts(){

  const q=
    ($('productSearch')?.value||'')
      .toLowerCase()
      .trim();

  const cat=
    $('productCategoryFilter')?.value||'';

  const stock=
    $('productStockFilter')?.value||'';


  const list=
    productsCache.filter(p=>{

      const text=
        `${p.name||''} ${p.category||''}`
          .toLowerCase();


      const stockOk=
        !stock||

        (
          stock==='in'
          ?
          Number(p.stock||0)>0
          :
          Number(p.stock||0)<=0
        );


      return
        text.includes(q)&&
        (!cat||p.category===cat)&&
        stockOk;

    });


  const rows=$('productRows');


  if(rows)
    rows.innerHTML=productRows(list);

}


function addProduct(){

  editingProductId=null;

  openModal(
    'Add Product',
    productForm()
  );

}


function editProduct(i){

  const p=productsCache[i];

  if(!p)return;

  editingProductId=p.id;

  openModal(
    'Edit Product',
    productForm(p)
  );

}


function productForm(p={}){

  const opts=
    categoriesCache
      .map(c=>`

        <option
          value="${esc(c.name)}"
          ${p.category===c.name?'selected':''}>

          ${esc(c.name)}

        </option>

      `)
      .join('');


  return `

  <div class="form-grid">

    <label>

      Product Name

      <input
        id="productName"
        value="${esc(p.name||'')}"
        placeholder="e.g. TWS AirBuds Pro">

    </label>


    <label>

      Category

      <input
        id="productCategory"
        list="categoryList"
        value="${esc(p.category||'')}"
        placeholder="Audio">


      <datalist id="categoryList">

        ${opts}

      </datalist>

    </label>


    <label>

      Price

      <input
        id="productPrice"
        type="number"
        min="0"
        value="${Number(p.price||0)}">

    </label>


    <label>

      Discount

      <input
        id="productDiscount"
        type="number"
        min="0"
        value="${Number(p.discount||0)}">

    </label>


    <label>

      Stock

      <input
        id="productStock"
        type="number"
        min="0"
        value="${Number(p.stock||0)}">

    </label>


    <label>

      Status

      <select id="productActive">

        <option
          value="true"
          ${p.active!==false?'selected':''}>

          Active

        </option>


        <option
          value="false"
          ${p.active===false?'selected':''}>

          Inactive

        </option>

      </select>

    </label>


    <label class="full">

      Product Image

      <input
        id="productImage"
        type="file"
        accept="image/*">

    </label>


    ${
      p.image

      ?

      `

      <label class="full">

        Current Image

        <img
          class="product-preview"
          src="${esc(p.image)}"
          alt="">

      </label>

      `

      :

      ''
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
      id="saveProductBtn"
      onclick="saveProduct()">

      Save Product

    </button>

  </div>

  `;

}


async function saveProduct(){

  const name=
    $('productName')?.value.trim();

  const category=
    $('productCategory')?.value.trim();

  const priceRaw=
    $('productPrice')?.value ?? '0';

  const discountRaw=
    $('productDiscount')?.value ?? '0';

  const stockRaw=
    $('productStock')?.value ?? '0';


  const price=Number(priceRaw);
  const discount=Number(discountRaw);
  const stock=Number(stockRaw);


  if(
    !Number.isFinite(price)||
    !Number.isFinite(discount)||
    !Number.isFinite(stock)||
    price<0||
    discount<0||
    stock<0
  ){

    alert(
      'Please enter valid non-negative numbers for Price, Discount and Stock.'
    );

    return;

  }


  if(
    price>999999999999||
    discount>999999999999||
    stock>2147483647
  ){

    alert(
      'The number is too large. Please enter a smaller Price, Discount or Stock value.'
    );

    return;

  }


  const active=
    $('productActive')?.value==='true';

  const file=
    $('productImage')?.files?.[0];


  if(!name){

    alert('Product name is required.');

    return;

  }


  try{

    const isEdit=!!editingProductId;

    const id=
      editingProductId||
      crypto.randomUUID();


    const old=
      productsCache.find(
        p=>p.id===id
      );


    let image=
      old?.image||'';


    const btn=
      $('saveProductBtn');


    if(btn){

      btn.disabled=true;

      btn.textContent='Saving...';

    }


    if(file)
      image=await uploadImage(
        file,
        id
      );


    const {error}=await sb
      .from('products')
      .upsert(
        {
          id,
          name,
          category,
          price,
          discount,
          stock,
          active,
          image
        },
        {
          onConflict:'id'
        }
      );


    if(error)throw error;


    await refreshProducts();

    closeModal();

    render();


    alert(
      isEdit
      ?
      'Product updated successfully.'
      :
      'Product added successfully.'
    );


  }catch(e){

    showError(e);


    const btn=
      $('saveProductBtn');


    if(btn){

      btn.disabled=false;

      btn.textContent='Save Product';

    }

  }

}


async function deleteProduct(i){

  const p=productsCache[i];

  if(!p)return;


  if(!confirm(`Delete "${p.name}"?`))
    return;


  try{

    const {error}=await sb
      .from('products')
      .delete()
      .eq('id',p.id);


    if(error)throw error;


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

  const rows=
    ordersCache.map((o,i)=>{

      const s=
        o.status||'Pending';


      const id=
        o.order_number||
        o.order_id||
        o.id||
        '#'+(i+1);


      const total=
        o.total ??
        (
          Number(o.subtotal||0)+
          Number(o.delivery_charge||0)
        );


      let next='';


      if(s==='Pending')

        next=
          actionBtn(
            i,
            'Confirmed',
            'Confirm',
            'primary'
          );


      else if(s==='Confirmed')

        next=
          actionBtn(
            i,
            'Processing',
            'Processing',
            'primary'
          );


      else if(s==='Processing')

        next=
          actionBtn(
            i,
            'Shipped',
            'Shipped',
            'primary'
          );


      else if(s==='Shipped')

        next=
          actionBtn(
            i,
            'Delivered',
            'Delivered',
            'primary'
          );


      const cancel=

        (
          s!=='Delivered'&&
          s!=='Cancelled'
        )

        ?

        actionBtn(
          i,
          'Cancelled',
          'Cancel',
          'danger'
        )

        :

        '';


      return `

      <tr>

        <td>${esc(id)}</td>


        <td>
          ${esc(
            o.customer_name||
            o.customer?.name||
            o.name||
            '—'
          )}
        </td>


        <td>
          ${esc(
            o.phone||
            o.customer_phone||
            o.customer?.phone||
            '—'
          )}
        </td>


        <td>
          ${money(total)}
        </td>


        <td>
          ${esc(
            o.payment_method||
            o.paymentMethod||
            'COD'
          )}
        </td>


        <td>

          <span class="pill ${statusClass(s)}">

            ${esc(s)}

          </span>

        </td>


        <td class="actions">

          <button
            class="btn muted"
            onclick="viewOrder(${i})">

            View

          </button>

          ${next}

          ${cancel}

        </td>

      </tr>

      `;

    }).join('');


  return `

  <div class="section-head">

    <div>

      <h3>Orders</h3>

      <p>Manage customer orders</p>

    </div>


    <button
      class="btn muted"
      onclick="refreshOrders().then(render).catch(showError)">

      ↻ Refresh

    </button>

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
          rows

          ||

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


function actionBtn(i,status,label,cls){

  return `

  <button
    class="btn ${cls}"
    onclick="updateOrderStatus(${i},'${status}')">

    ${label}

  </button>

  `;

}


function viewOrder(i){

  const o=ordersCache[i];

  if(!o)return;


  const id=
    o.order_number||
    o.order_id||
    o.id||
    '';


  const name=
    o.customer_name||
    o.customer?.name||
    o.name||
    '';


  const phone=
    o.phone||
    o.customer_phone||
    o.customer?.phone||
    '';


  const district=
    o.district||
    o.customer?.district||
    '';


  const upazila=
    o.upazila||
    o.customer?.upazila||
    '';


  const address=
    o.address||
    o.customer?.address||
    '';


  const payment=
    o.payment_method||
    o.paymentMethod||
    'COD';


  const s=
    o.status||'Pending';


  const total=
    o.total ??
    (
      Number(o.subtotal||0)+
      Number(o.delivery_charge||0)
    );


  let items=o.items;

  let itemHtml='';


  if(typeof items==='string'){

    try{

      items=JSON.parse(items);

    }catch{}

  }


  if(Array.isArray(items)){

    itemHtml=
      items.map(x=>`

        <div class="order-item">

          <span>

            ${esc(
              x.name||
              x.title||
              'Product'
            )}

            ×

            ${esc(
              x.qty||
              x.quantity||
              1
            )}

          </span>


          <b>

            ${
              money(
                Number(x.price||0)*
                Number(
                  x.qty||
                  x.quantity||
                  1
                )
              )
            }

          </b>

        </div>

      `).join('');

  }


  return openModal(

    'Order '+id,

    `

    <div class="card">

      <b>Customer</b>

      <p>
        ${esc(name)} · ${esc(phone)}
      </p>


      <p>

        ${esc(
          [district,upazila]
            .filter(Boolean)
            .join(', ')
        )}

      </p>


      <p>
        ${esc(address||'—')}
      </p>


      <hr>


      <p>

        <b>Payment:</b>

        ${esc(payment)}

        ${
          o.transaction_id

          ?

          ' · TXN: '+
          esc(o.transaction_id)

          :

          ''
        }

      </p>


      <p>

        <b>Status:</b>

        <span class="pill ${statusClass(s)}">

          ${esc(s)}

        </span>

      </p>


      <p>

        <b>Subtotal:</b>

        ${money(o.subtotal)}

      </p>


      <p>

        <b>Delivery:</b>

        ${money(o.delivery_charge)}

      </p>


      <p>

        <b>Total:</b>

        ${money(total)}

      </p>


      <p>

        <b>Note:</b>

        ${esc(o.note||'—')}

      </p>


      ${
        itemHtml

        ?

        `

        <hr>

        <b>Items</b>

        <div class="order-items">

          ${itemHtml}

        </div>

        `

        :

        ''
      }

    </div>


    <div class="btn-row">

      ${
        s==='Pending'

        ?

        actionBtn(
          i,
          'Confirmed',
          'Confirm Order',
          'primary'
        )

        :

        ''
      }


      ${
        s==='Confirmed'

        ?

        actionBtn(
          i,
          'Processing',
          'Processing',
          'primary'
        )

        :

        ''
      }


      ${
        s==='Processing'

        ?

        actionBtn(
          i,
          'Shipped',
          'Shipped',
          'primary'
        )

        :

        ''
      }


      ${
        s==='Shipped'

        ?

        actionBtn(
          i,
          'Delivered',
          'Delivered',
          'primary'
        )

        :

        ''
      }


      ${
        s!=='Delivered'&&
        s!=='Cancelled'

        ?

        actionBtn(
          i,
          'Cancelled',
          'Cancel',
          'danger'
        )

        :

        ''
      }

    </div>

    `
  );

}


async function updateOrderStatus(i,newStatus){

  const order=ordersCache[i];

  if(!order)return;


  const old=
    order.status||'Pending';


  if(old===newStatus)return;


  const id=
    order.order_number||
    order.order_id||
    order.id||
    '';


  if(
    !confirm(
      `Order ${id}\n\nChange status to "${newStatus}"?`
    )
  )
    return;


  try{

    const {error}=await sb
      .from('orders')
      .update({
        status:newStatus
      })
      .eq('id',order.id);


    if(error)throw error;


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

  const rows=
    categoriesCache.map((c,i)=>`

      <tr>

        <td>
          ${esc(c.name)}
        </td>

        <td>
          ${esc(c.slug||'—')}
        </td>

        <td>

          <button
            class="btn danger"
            onclick="deleteCategory(${i})">

            Delete

          </button>

        </td>

      </tr>

    `).join('');


  return `

  <div class="section-head">

    <div>

      <h3>Categories</h3>

      <p>Manage product categories</p>

    </div>


    <button
      class="btn primary"
      onclick="addCategory()">

      ＋ Add Category

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
          rows

          ||

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


function addCategory(){

  openModal(

    'Add Category',

    `

    <label class="form-grid">

      <span class="full">

        Category Name

        <input
          id="categoryName"
          placeholder="Audio">

      </span>

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


async function saveCategory(){

  const name=
    $('categoryName')?.value.trim();


  if(!name){

    alert('Category name is required.');

    return;

  }


  try{

    const slug=
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g,'-')
        .replace(/^-|-$/g,'');


    const {error}=await sb
      .from('categories')
      .insert({
        name,
        slug
      });


    if(error)throw error;


    const {
      data,
      error:e
    }=await sb
      .from('categories')
      .select('*')
      .order('name');


    if(e)throw e;


    categoriesCache=data||[];

    closeModal();

    render();


  }catch(e){

    showError(e);

  }

}


async function deleteCategory(i){

  const c=categoriesCache[i];

  if(!c)return;


  if(
    !confirm(
      `Delete category "${c.name}"?`
    )
  )
    return;


  try{

    const {error}=await sb
      .from('categories')
      .delete()
      .eq('id',c.id);


    if(error)throw error;


    categoriesCache=
      categoriesCache.filter(
        x=>x.id!==c.id
      );


    render();


  }catch(e){

    showError(e);

  }

}


/* =========================================================
   CUSTOMERS
========================================================= */

function customers(){

  const unique={};


  ordersCache.forEach(o=>{

    const phone=
      o.phone||
      o.customer_phone||
      o.customer?.phone||
      '';


    if(!phone)return;


    unique[phone]={

      name:
        o.customer_name||
        o.customer?.name||
        o.name||
        '—',

      phone,

      orders:
        (unique[phone]?.orders||0)+1

    };

  });


  const list=
    Object.values(unique);


  return `

  <div class="section-head">

    <div>

      <h3>Customers</h3>

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

          ?

          list.map(c=>`

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

          `).join('')

          :

          `

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
   DELIVERY SETTINGS
========================================================= */

function delivery(){

  const d=
    deliverySettingsCache||{};


  const dhaka=
    d.dhaka_charge??60;

  const nearby=
    d.nearby_charge??100;

  const outside=
    d.outside_charge??130;


  return `

  <div class="section-head">

    <div>

      <h3>Delivery Settings</h3>

      <p>
        Manage delivery charges used by customer checkout
      </p>

    </div>


    <button
      class="btn muted"
      onclick="refreshDeliverySettings()">

      ↻ Refresh

    </button>

  </div>


  <div class="card">

    <div class="form-grid">

      <label>

        Dhaka Charge

        <input
          id="deliveryDhaka"
          type="number"
          min="0"
          step="1"
          value="${Number(dhaka)}">

      </label>


      <label>

        Nearby Dhaka Charge

        <input
          id="deliveryNearby"
          type="number"
          min="0"
          step="1"
          value="${Number(nearby)}">

      </label>


      <label>

        Outside Dhaka Charge

        <input
          id="deliveryOutside"
          type="number"
          min="0"
          step="1"
          value="${Number(outside)}">

      </label>

    </div>


    <div class="btn-row">

      <button
        class="btn primary"
        id="saveDeliveryBtn"
        onclick="saveDeliverySettings()">

        Save Delivery Settings

      </button>

    </div>


    <hr>


    <p>

      <b>Current:</b>

      Dhaka ৳${Number(dhaka).toLocaleString('en-BD')}

      · Nearby ৳${Number(nearby).toLocaleString('en-BD')}

      · Outside ৳${Number(outside).toLocaleString('en-BD')}

    </p>

  </div>

  `;

}


async function saveDeliverySettings(){

  const dhaka=
    Number($('deliveryDhaka')?.value);

  const nearby=
    Number($('deliveryNearby')?.value);

  const outside=
    Number($('deliveryOutside')?.value);


  if(
    !Number.isFinite(dhaka)||
    !Number.isFinite(nearby)||
    !Number.isFinite(outside)||
    dhaka<0||
    nearby<0||
    outside<0
  ){

    alert(
      'Please enter valid delivery charges.'
    );

    return;

  }


  const btn=
    $('saveDeliveryBtn');


  if(btn){

    btn.disabled=true;

    btn.textContent='Saving...';

  }


  try{

    const {
      data:row,
      error:readError
    }=await sb
      .from('delivery_settings')
      .select('*')
      .order('id',{ascending:true})
      .limit(1)
      .maybeSingle();


    if(readError)
      throw readError;


    const payload={

      dhaka_charge:dhaka,

      nearby_charge:nearby,

      outside_charge:outside

    };


    let error;


    if(row?.id){

      ({
        error
      }=await sb
        .from('delivery_settings')
        .update(payload)
        .eq('id',row.id));

    }else{

      ({
        error
      }=await sb
        .from('delivery_settings')
        .insert(payload));

    }


    if(error)throw error;


    deliverySettingsCache={
      ...(deliverySettingsCache||{}),
      ...payload
    };


    alert(
      'Delivery settings saved successfully.'
    );


    render();


  }catch(e){

    showError(e);

  }finally{

    if(btn){

      btn.disabled=false;

      btn.textContent=
        'Save Delivery Settings';

    }

  }

}


/* =========================================================
   PAYMENT SETTINGS
========================================================= */

function payments(){

  return `

  <div class="section-head">

    <div>

      <h3>Payment Settings</h3>

      <p>
        Enable or disable payment methods and manage payment numbers
      </p>

    </div>


    <button
      class="btn muted"
      onclick="loadCloud().then(render).catch(showError)">

      ↻ Refresh

    </button>

  </div>


  <div class="card">

    <div class="form-grid">


      <!-- COD -->

      <label class="full">

        <input
          id="codEnabled"
          type="checkbox"
          ${
            paymentSettings.cod_enabled
            ?
            'checked'
            :
            ''
          }>

        <b>
          Enable Cash on Delivery (COD)
        </b>

        <small>
          Allow customers to select Cash on Delivery.
        </small>

      </label>


      <!-- BKASH -->

      <label class="full">

        <input
          id="bkashEnabled"
          type="checkbox"
          ${
            paymentSettings.bkash_enabled
            ?
            'checked'
            :
            ''
          }>

        <b>
          Enable bKash
        </b>

        <small>
          Allow customers to select manual bKash payment.
        </small>

      </label>


      <label class="full">

        bKash Number

        <input
          id="bkashNumber"
          type="tel"
          inputmode="numeric"
          maxlength="20"
          value="${esc(paymentSettings.bkash_number||'')}"
          placeholder="01XXXXXXXXX">

        <small>
          This number will be shown to customers when bKash is enabled.
        </small>

      </label>


      <!-- NAGAD -->

      <label class="full">

        <input
          id="nagadEnabled"
          type="checkbox"
          ${
            paymentSettings.nagad_enabled
            ?
            'checked'
            :
            ''
          }>

        <b>
          Enable Nagad
        </b>

        <small>
          Allow customers to select manual Nagad payment.
        </small>

      </label>


      <label class="full">

        Nagad Number

        <input
          id="nagadNumber"
          type="tel"
          inputmode="numeric"
          maxlength="20"
          value="${esc(paymentSettings.nagad_number||'')}"
          placeholder="01XXXXXXXXX">

        <small>
          This number will be shown to customers when Nagad is enabled.
        </small>

      </label>


    </div>


    <div class="btn-row">

      <button
        class="btn primary"
        id="savePaymentBtn"
        onclick="savePaymentSettings()">

        Save Payment Settings

      </button>

    </div>


    <hr>


    <p>

      <b>Current:</b>

      COD:
      ${
        paymentSettings.cod_enabled
        ?
        'ON'
        :
        'OFF'
      }

      ·

      bKash:
      ${
        paymentSettings.bkash_enabled
        ?
        'ON'
        :
        'OFF'
      }

      ·

      Nagad:
      ${
        paymentSettings.nagad_enabled
        ?
        'ON'
        :
        'OFF'
      }

    </p>


  </div>

  `;

}


async function savePaymentSettings(){

  const cod=
    !!$('codEnabled')?.checked;

  const bkash=
    !!$('bkashEnabled')?.checked;

  const nagad=
    !!$('nagadEnabled')?.checked;


  const bkashNumber=
    ($('bkashNumber')?.value||'')
      .trim();

  const nagadNumber=
    ($('nagadNumber')?.value||'')
      .trim();


  /* -------------------------------------------------------
     VALIDATION
  ------------------------------------------------------- */

  if(
    bkash &&
    !bkashNumber
  ){

    alert(
      'Please enter the bKash number before enabling bKash.'
    );

    return;

  }


  if(
    nagad &&
    !nagadNumber
  ){

    alert(
      'Please enter the Nagad number before enabling Nagad.'
    );

    return;

  }


  if(
    !cod &&
    !bkash &&
    !nagad
  ){

    if(
      !confirm(
        'All payment methods are disabled. Customers will not have an available payment method. Continue?'
      )
    )
      return;

  }


  const btn=
    $('savePaymentBtn');


  if(btn){

    btn.disabled=true;

    btn.textContent='Saving...';

  }


  try{

    const {
      data:row,
      error:readError
    }=await sb
      .from('payment_settings')
      .select('*')
      .order('id',{ascending:true})
      .limit(1)
      .maybeSingle();


    if(readError)
      throw readError;


    const payload={

      cod_enabled:cod,

      bkash_enabled:bkash,

      bkash_number:bkashNumber,

      nagad_enabled:nagad,

      nagad_number:nagadNumber

    };


    let error;


    if(row?.id){

      ({
        error
      }=await sb
        .from('payment_settings')
        .update(payload)
        .eq('id',row.id));

    }else{

      ({
        error
      }=await sb
        .from('payment_settings')
        .insert(payload));

    }


    if(error)
      throw error;


    paymentSettings={
      ...payload
    };


    alert(
      'Payment settings saved successfully.'
    );


    render();


  }catch(e){

    showError(e);

  }finally{

    if(btn){

      btn.disabled=false;

      btn.textContent=
        'Save Payment Settings';

    }

  }

}


/* =========================================================
   STORE SETTINGS
========================================================= */

function settings(){

  return `

  <div class="section-head">

    <div>

      <h3>Store Settings</h3>

      <p>
        Manage basic store information
      </p>

    </div>

  </div>


  <div class="card">

    <div class="form-grid">


      <label>

        Store Name

        <input
          id="storeName"
          value="${esc(storeSettings.store_name||'Gadget Bazar BD')}">

      </label>


      <label>

        Phone

        <input
          id="storePhone"
          type="tel"
          value="${esc(storeSettings.phone||'')}">

      </label>


      <label class="full">

        Address

        <textarea
          id="storeAddress"
          rows="3">${esc(storeSettings.address||'')}</textarea>

      </label>


    </div>


    <div class="btn-row">

      <button
        class="btn primary"
        id="saveStoreBtn"
        onclick="saveStoreSettings()">

        Save Settings

      </button>

    </div>

  </div>

  `;

}


async function saveStoreSettings(){

  const store_name=
    $('storeName')?.value.trim()||
    'Gadget Bazar BD';

  const phone=
    $('storePhone')?.value.trim()||'';

  const address=
    $('storeAddress')?.value.trim()||'';


  const btn=
    $('saveStoreBtn');


  if(btn){

    btn.disabled=true;

    btn.textContent='Saving...';

  }


  try{

    const {
      data:row,
      error:readError
    }=await sb
      .from('store_settings')
      .select('*')
      .order('id',{ascending:true})
      .limit(1)
      .maybeSingle();


    if(readError)
      throw readError;


    const payload={
      store_name,
      phone,
      address
    };


    let error;


    if(row?.id){

      ({
        error
      }=await sb
        .from('store_settings')
        .update(payload)
        .eq('id',row.id));

    }else{

      ({
        error
      }=await sb
        .from('store_settings')
        .insert(payload));

    }


    if(error)
      throw error;


    storeSettings={
      ...payload
    };


    alert(
      'Store settings saved successfully.'
    );


    render();


  }catch(e){

    showError(e);

  }finally{

    if(btn){

      btn.disabled=false;

      btn.textContent='Save Settings';

    }

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

function go(section){

  currentSection=section;

  render();

  closeSidebar();

}


function toggleCatalog(){

  catalogOpen=!catalogOpen;

  const el=
    $('catalogMenu');

  if(el)
    el.classList.toggle(
      'open',
      catalogOpen
    );

}


function closeSidebar(){

  document
    .querySelector('.sidebar')
    ?.classList.remove('open');

}


function toggleSidebar(){

  document
    .querySelector('.sidebar')
    ?.classList.toggle('open');

}


/* =========================================================
   RENDER
========================================================= */

function render(){

  const content=
    $('content');

  if(!content)return;


  let html='';


  switch(currentSection){

    case 'dashboard':
      html=dashboard();
      break;

    case 'products':
      html=products();
      break;

    case 'categories':
      html=categories();
      break;

    case 'orders':
      html=orders();
      break;

    case 'customers':
      html=customers();
      break;

    case 'delivery':
      html=delivery();
      break;

    case 'payments':
      html=payments();
      break;

    case 'settings':
      html=settings();
      break;

    default:
      html=dashboard();

  }


  content.innerHTML=html;


  updateActiveNav();

}


function updateActiveNav(){

  document
    .querySelectorAll('[data-section]')
    .forEach(el=>{

      el.classList.toggle(
        'active',
        el.dataset.section===currentSection
      );

    });

}


/* =========================================================
   DASHBOARD REFRESH
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

  const email=
    $('loginEmail')?.value.trim();

  const password=
    $('loginPassword')?.value||'';


  if(!email||!password){

    alert(
      'Enter email and password.'
    );

    return;

  }


  const btn=
    $('loginBtn');


  if(btn){

    btn.disabled=true;

    btn.textContent='Signing in...';

  }


  try{

    const {
      data,
      error
    }=await sb.auth.signInWithPassword({

      email,
      password

    });


    if(error)
      throw error;


    if(
      data?.user?.id!==ADMIN_UID
    ){

      await sb.auth.signOut();

      throw new Error(
        'This account is not authorized as admin.'
      );

    }


    showApp();

    await loadCloud();

    render();


  }catch(e){

    alert(
      e?.message||
      'Login failed.'
    );


  }finally{

    if(btn){

      btn.disabled=false;

      btn.textContent='Login';

    }

  }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout(){

  if(
    !confirm(
      'Are you sure you want to logout?'
    )
  )
    return;


  await sb.auth.signOut();

  showLogin();

}


/* =========================================================
   EXPORT DATA
========================================================= */

function exportData(){

  const data={

    products:productsCache,

    orders:ordersCache,

    categories:categoriesCache,

    deliverySettings:
      deliverySettingsCache,

    paymentSettings:
      paymentSettings,

    storeSettings:
      storeSettings

  };


  const blob=
    new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        )
      ],
      {
        type:'application/json'
      }
    );


  const url=
    URL.createObjectURL(blob);


  const a=
    document.createElement('a');


  a.href=url;

  a.download=
    'gadget-bazar-bd-backup.json';


  document.body.appendChild(a);

  a.click();

  a.remove();


  URL.revokeObjectURL(url);

}


/* =========================================================
   IMPORT DATA
========================================================= */

function importData(){

  openModal(

    'Import Backup',

    `

    <div class="card">

      <p>
        Select a Gadget Bazar BD JSON backup file.
      </p>


      <input
        id="importFile"
        type="file"
        accept=".json,application/json">


    </div>


    <div class="btn-row">

      <button
        class="btn muted"
        onclick="closeModal()">

        Cancel

      </button>


      <button
        class="btn primary"
        onclick="processImport()">

        Import

      </button>

    </div>

    `
  );

}


async function processImport(){

  const file=
    $('importFile')?.files?.[0];


  if(!file){

    alert(
      'Please select a JSON file.'
    );

    return;

  }


  try{

    const text=
      await file.text();


    const data=
      JSON.parse(text);


    if(
      !data||
      typeof data!=='object'
    ){

      throw new Error(
        'Invalid backup file.'
      );

    }


    alert(
      'Backup file loaded. Database import is not performed automatically for safety.'
    );


    closeModal();


  }catch(e){

    showError(e);

  }

}


/* =========================================================
   AUTH STATE
========================================================= */

sb.auth.onAuthStateChange(
  async (_event,session)=>{

    if(
      session &&
      session.user.id===ADMIN_UID
    ){

      showApp();

    }else{

      showLogin();

    }

  }
);


/* =========================================================
   INIT
========================================================= */

async function init(){

  try{

    const ok=
      await checkAdmin();


    if(!ok)return;


    showApp();


    await loadCloud();


    render();


  }catch(e){

    console.error(e);

    showLogin();

    alert(
      'Could not connect to Supabase.\n\n'+
      (e?.message||e)
    );

  }

}


/* =========================================================
   GLOBAL FUNCTIONS
   Needed for onclick="" in HTML
========================================================= */

window.$=$;

window.go=go;

window.toggleCatalog=
  toggleCatalog;

window.toggleSidebar=
  toggleSidebar;

window.closeSidebar=
  closeSidebar;

window.closeModal=
  closeModal;

window.openModal=
  openModal;

window.login=
  login;

window.logout=
  logout;

window.addProduct=
  addProduct;

window.editProduct=
  editProduct;

window.saveProduct=
  saveProduct;

window.deleteProduct=
  deleteProduct;

window.filterProducts=
  filterProducts;

window.viewOrder=
  viewOrder;

window.updateOrderStatus=
  updateOrderStatus;

window.addCategory=
  addCategory;

window.saveCategory=
  saveCategory;

window.deleteCategory=
  deleteCategory;

window.saveDeliverySettings=
  saveDeliverySettings;

window.refreshDeliverySettings=
  refreshDeliverySettings;

window.savePaymentSettings=
  savePaymentSettings;

window.saveStoreSettings=
  saveStoreSettings;

window.refreshProducts=
  refreshProducts;

window.refreshOrders=
  refreshOrders;

window.refreshDashboard=
  refreshDashboard;

window.exportData=
  exportData;

window.importData=
  importData;

window.processImport=
  processImport;


/* =========================================================
   START
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  init
);
