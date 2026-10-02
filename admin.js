/* =========================================================
   GADGET BAZAR BD — FINAL ADMIN PANEL
   Supabase + mobile responsive + Catalog UI
   Delivery + Payment + Category management
========================================================= */

const SUPABASE_URL='https://vwwysrdqexjtlmpmevub.supabase.co';
const SUPABASE_KEY='sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const BUCKET='product images';
const ADMIN_UID='9aa2e054-a19a-4f86-aaf7-25f13e720722';

let productsCache=[];
let ordersCache=[];
let categoriesCache=[];
let deliverySettingsCache=null;
let paymentSettingsFull={
  cod_enabled:true,
  bkash_enabled:false,
  bkash_number:'',
  nagad_enabled:false,
  nagad_number:''
};
let currentSection='dashboard';
let editingProductId=null;
let catalogOpen=true;

const DEFAULT_CATEGORIES=[
  'Audio','Wearables','Power & Charging','Mobile Accessories',
  'RGB & Lighting','Home Gadgets','Gaming'
];

function $(id){return document.getElementById(id)}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function money(v){return '৳'+Number(v||0).toLocaleString('en-BD')}
function showError(e){console.error(e);alert('Something went wrong.\n\n'+(e?.message||e||'Unknown error'))}
function closeModal(){$('modal')?.classList.add('hidden')}
function openModal(title,body){
  if($('modalTitle'))$('modalTitle').textContent=title;
  if($('modalBody'))$('modalBody').innerHTML=body;
  $('modal')?.classList.remove('hidden')
}

async function checkAdmin(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){showLogin();return false}
  if(session.user.id!==ADMIN_UID){
    await sb.auth.signOut();
    showLogin();
    alert('You are not authorized as admin.');
    return false
  }
  return true
}
function showLogin(){$('login')?.classList.remove('hidden');$('app')?.classList.add('hidden')}
function showApp(){$('login')?.classList.add('hidden');$('app')?.classList.remove('hidden')}

async function uploadImage(file,id){
  if(!file)return '';
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`products/${id}_${Date.now()}.${ext}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:true,contentType:file.type});
  if(error)throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ===================== CLOUD DATA ===================== */

async function loadDeliverySettings(){
  const {data,error}=await sb.from('delivery_settings').select('*').order('id',{ascending:true}).limit(1);
  if(error)throw error;
  deliverySettingsCache=data?.[0]||null;
}

async function loadPaymentSettingsFull(){
  const {data,error}=await sb.from('payment_settings').select('*').limit(1).maybeSingle();
  if(error)throw error;
  if(data){
    paymentSettingsFull={
      cod_enabled:data.cod_enabled!==false,
      bkash_enabled:data.bkash_enabled===true,
      bkash_number:data.bkash_number||'',
      nagad_enabled:data.nagad_enabled===true,
      nagad_number:data.nagad_number||''
    };
  }
}

async function ensureDefaultCategories(){
  const existing=new Set(categoriesCache.map(c=>String(c.name||'').trim().toLowerCase()));
  const missing=DEFAULT_CATEGORIES.filter(name=>!existing.has(name.toLowerCase()));
  if(!missing.length)return;
  const rows=missing.map(name=>({
    name,
    slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  }));
  const {error}=await sb.from('categories').insert(rows);
  if(error)throw error;
  const {data,error:e}=await sb.from('categories').select('*').order('name',{ascending:true});
  if(e)throw e;
  categoriesCache=data||[];
}

async function loadCloud(){
  const [p,o,c,d]=await Promise.all([
    sb.from('products').select('*').order('created_at',{ascending:false}),
    sb.from('orders').select('*').order('created_at',{ascending:false}),
    sb.from('categories').select('*').order('name',{ascending:true}),
    sb.from('delivery_settings').select('*').order('id',{ascending:true}).limit(1)
  ]);
  if(p.error)throw p.error;
  if(o.error)throw o.error;
  if(c.error)throw c.error;
  if(d.error)throw d.error;

  productsCache=p.data||[];
  ordersCache=o.data||[];
  categoriesCache=c.data||[];
  await ensureDefaultCategories();
  deliverySettingsCache=d.data?.[0]||null;
  await loadPaymentSettingsFull();

  if($('connectionStatus')){
    $('connectionStatus').textContent='● Connected';
    $('connectionStatus').className='live'
  }
}

async function refreshProducts(){
  const {data,error}=await sb.from('products').select('*').order('created_at',{ascending:false});
  if(error)throw error;
  productsCache=data||[]
}
async function refreshOrders(){
  const {data,error}=await sb.from('orders').select('*').order('created_at',{ascending:false});
  if(error)throw error;
}
async function refreshDeliverySettings(){
  await loadDeliverySettings();
  render();
}
function statusClass(s){return s==='Delivered'?'green':s==='Cancelled'?'red':s==='Pending'?'yellow':'blue'}

/* ===================== DASHBOARD ===================== */

function dashboard(){
  const total=productsCache.length;
  const active=productsCache.filter(p=>p.active!==false).length;
  const stock=productsCache.reduce((n,p)=>n+Number(p.stock||0),0);
  const totalOrders=ordersCache.length;
  const pending=ordersCache.filter(o=>(o.status||'Pending')==='Pending').length;
  const delivered=ordersCache.filter(o=>(o.status||'')==='Delivered').length;
  const revenue=ordersCache.filter(o=>(o.status||'')!=='Cancelled')
    .reduce((s,o)=>s+Number(o.total??(Number(o.subtotal||0)+Number(o.delivery_charge||0))),0);
  const recent=ordersCache.slice(0,6);
  return `<div class="section-head"><div><h3>Dashboard</h3><p>Gadget Bazar BD overview</p></div><button class="btn muted" onclick="refreshDashboard()">↻ Refresh</button></div>
  <div class="stats-grid">
    ${stat('▣','Total Products',total)}${stat('✓','Active Products',active)}${stat('▤','Total Orders',totalOrders)}${stat('!','Pending Orders',pending)}
    ${stat('✓','Delivered',delivered)}${stat('৳','Revenue',money(revenue))}${stat('◉','Total Stock',stock)}${stat('⌁','Categories',categoriesCache.length)}
  </div>
  <div class="section-head"><div><h3>Recent Orders</h3><p>Latest customer orders</p></div><button class="btn primary" onclick="go('orders')">View All Orders</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Total</th><th>Status</th></tr></thead><tbody>
  ${recent.length?recent.map(o=>{const s=o.status||'Pending';const id=o.order_number||o.order_id||o.id||'';const total=o.total??(Number(o.subtotal||0)+Number(o.delivery_charge||0));return `<tr><td>${esc(id)}</td><td>${esc(o.customer_name||o.customer?.name||o.name||'—')}</td><td>${esc(o.phone||o.customer_phone||o.customer?.phone||'—')}</td><td>${money(total)}</td><td><span class="pill ${statusClass(s)}">${esc(s)}</span></td></tr>`}).join(''):`<tr><td colspan="5" class="empty">No orders yet</td></tr>`}
  </tbody></table></div>`
}
function stat(icon,label,value){return `<div class="stat-card"><div class="stat-icon">${icon}</div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`}

/* ===================== PRODUCTS ===================== */

function products(){
  return `<div class="section-head"><div><h3>Products</h3><p>Manage your product catalog</p></div><div class="toolbar"><button class="btn primary" onclick="addProduct()">＋ Add Product</button><button class="btn muted" onclick="refreshProducts().then(render).catch(showError)">↻ Refresh</button></div></div>
  <div class="filters"><div class="search-wrap"><input class="input" id="productSearch" placeholder="Search products..." oninput="filterProducts()"></div><select class="select" id="productCategoryFilter" onchange="filterProducts()"><option value="">All Categories</option>${categoriesCache.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select><select class="select" id="productStockFilter" onchange="filterProducts()"><option value="">All Stock</option><option value="in">In Stock</option><option value="out">Out of Stock</option></select></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody id="productRows">${productRows(productsCache)}</tbody></table></div>`
}
function productRows(list){
  if(!list.length)return `<tr><td colspan="7" class="empty">No products found</td></tr>`;
  return list.map(p=>`<tr><td>${p.image?`<img class="thumb" src="${esc(p.image)}" alt="">`:'—'}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.category||'—')}</td><td>${money(p.price)}</td><td>${Number(p.stock||0)}</td><td><span class="pill ${p.active!==false?'green':'red'}">${p.active!==false?'Active':'Inactive'}</span></td><td class="actions"><button class="btn muted" onclick="editProduct(${productsCache.indexOf(p)})">Edit</button><button class="btn danger" onclick="deleteProduct(${productsCache.indexOf(p)})">Delete</button></td></tr>`).join('')
}
function filterProducts(){
  const q=($('productSearch')?.value||'').toLowerCase().trim();
  const cat=$('productCategoryFilter')?.value||'';
  const stock=$('productStockFilter')?.value||'';
  const list=productsCache.filter(p=>{
    const text=`${p.name||''} ${p.category||''}`.toLowerCase();
    const stockOk=!stock||(stock==='in'?Number(p.stock||0)>0:Number(p.stock||0)<=0);
    return text.includes(q)&&(!cat||p.category===cat)&&stockOk;
  });
  const rows=$('productRows');if(rows)rows.innerHTML=productRows(list)
}
function addProduct(){editingProductId=null;openModal('Add Product',productForm())}
function editProduct(i){const p=productsCache[i];if(!p)return;editingProductId=p.id;openModal('Edit Product',productForm(p))}
function productForm(p={}){
  const opts=categoriesCache.map(c=>`<option value="${esc(c.name)}" ${p.category===c.name?'selected':''}>${esc(c.name)}</option>`).join('');
  return `<div class="form-grid">
    <label>Product Name<input id="productName" value="${esc(p.name||'')}" placeholder="e.g. TWS AirBuds Pro"></label>
    <label>Category<select id="productCategory"><option value="">Select category</option>${opts}</select></label>
    <label>Price<input id="productPrice" type="number" min="0" value="${Number(p.price||0)}"></label>
    <label>Discount<input id="productDiscount" type="number" min="0" value="${Number(p.discount||0)}"></label>
    <label>Stock<input id="productStock" type="number" min="0" value="${Number(p.stock||0)}"></label>
    <label>Status<select id="productActive"><option value="true" ${p.active!==false?'selected':''}>Active</option><option value="false" ${p.active===false?'selected':''}>Inactive</option></select></label>
    <label class="full">Product Image<input id="productImage" type="file" accept="image/*"></label>
    ${p.image?`<label class="full">Current Image<img class="product-preview" src="${esc(p.image)}" alt=""></label>`:''}
  </div><div class="btn-row"><button class="btn muted" onclick="closeModal()">Cancel</button><button class="btn primary" id="saveProductBtn" onclick="saveProduct()">Save Product</button></div>`
}
async function saveProduct(){
  const name=$('productName')?.value.trim(),category=$('productCategory')?.value.trim();
  const price=Number($('productPrice')?.value??0),discount=Number($('productDiscount')?.value??0),stock=Number($('productStock')?.value??0);
  if(!Number.isFinite(price)||!Number.isFinite(discount)||!Number.isFinite(stock)||price<0||discount<0||stock<0){alert('Please enter valid non-negative numbers for Price, Discount and Stock.');return}
  if(price>999999999999||discount>999999999999||stock>2147483647){alert('The number is too large.');return}
  const active=$('productActive')?.value==='true',file=$('productImage')?.files?.[0];
  if(!name){alert('Product name is required.');return}
  try{
    const isEdit=!!editingProductId,id=editingProductId||crypto.randomUUID(),old=productsCache.find(p=>p.id===id);
    let image=old?.image||'';
    const btn=$('saveProductBtn');if(btn){btn.disabled=true;btn.textContent='Saving...'}
    if(file)image=await uploadImage(file,id);
    const {error}=await sb.from('products').upsert({id,name,category,price,discount,stock,active,image},{onConflict:'id'});
    if(error)throw error;
    await refreshProducts();closeModal();render();alert(isEdit?'Product updated successfully.':'Product added successfully.')
  }catch(e){showError(e);const btn=$('saveProductBtn');if(btn){btn.disabled=false;btn.textContent='Save Product'}}
}
async function deleteProduct(i){
  const p=productsCache[i];if(!p)return;
  if(!confirm(`Delete "${p.name}"?`))return;
  try{const {error}=await sb.from('products').delete().eq('id',p.id);if(error)throw error;await refreshProducts();render()}catch(e){showError(e)}
}

/* ===================== ORDERS ===================== */

function orders(){
  const rows=ordersCache.map((o,i)=>{
    const s=o.status||'Pending',id=o.order_number||o.order_id||o.id||'#'+(i+1),total=o.total??(Number(o.subtotal||0)+Number(o.delivery_charge||0));
    let next='';
    if(s==='Pending')next=actionBtn(i,'Confirmed','Confirm','primary');
    else if(s==='Confirmed')next=actionBtn(i,'Processing','Processing','primary');
    else if(s==='Processing')next=actionBtn(i,'Shipped','Shipped','primary');
    else if(s==='Shipped')next=actionBtn(i,'Delivered','Delivered','primary');
    const cancel=(s!=='Delivered'&&s!=='Cancelled')?actionBtn(i,'Cancelled','Cancel','danger'):'';
    return `<tr><td>${esc(id)}</td><td>${esc(o.customer_name||o.customer?.name||o.name||'—')}</td><td>${esc(o.phone||o.customer_phone||o.customer?.phone||'—')}</td><td>${money(total)}</td><td>${esc(o.payment_method||o.paymentMethod||'COD')}</td><td><span class="pill ${statusClass(s)}">${esc(s)}</span></td><td class="actions"><button class="btn muted" onclick="viewOrder(${i})">View</button>${next}${cancel}</td></tr>`
  }).join('');
  return `<div class="section-head"><div><h3>Orders</h3><p>Manage customer orders</p></div><button class="btn muted" onclick="refreshOrders().then(render).catch(showError)">↻ Refresh</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows||`<tr><td colspan="7" class="empty">No orders yet</td></tr>`}</tbody></table></div>`
}
function actionBtn(i,status,label,cls){return `<button class="btn ${cls}" onclick="updateOrderStatus(${i},'${status}')">${label}</button>`}
function viewOrder(i){
  const o=ordersCache[i];if(!o)return;
  const id=o.order_number||o.order_id||o.id||'',name=o.customer_name||o.customer?.name||o.name||'',phone=o.phone||o.customer_phone||o.customer?.phone||'';
  const district=o.district||o.customer?.district||'',upazila=o.upazila||o.customer?.upazila||'',address=o.address||o.customer?.address||'';
  const payment=o.payment_method||o.paymentMethod||'COD',s=o.status||'Pending',total=o.total??(Number(o.subtotal||0)+Number(o.delivery_charge||0));
  let items=o.items,itemHtml='';
  if(typeof items==='string'){try{items=JSON.parse(items)}catch{}}
  if(Array.isArray(items))itemHtml=items.map(x=>`<div class="order-item"><span>${esc(x.name||x.title||'Product')} × ${esc(x.qty||x.quantity||1)}</span><b>${money(Number(x.price||0)*Number(x.qty||x.quantity||1))}</b></div>`).join('');
  return openModal('Order '+id,`<div class="card"><b>Customer</b><p>${esc(name)} · ${esc(phone)}</p><p>${esc([district,upazila].filter(Boolean).join(', '))}</p><p>${esc(address||'—')}</p><hr><p><b>Payment:</b> ${esc(payment)}${o.transaction_id?' · TXN: '+esc(o.transaction_id):''}</p><p><b>Status:</b> <span class="pill ${statusClass(s)}">${esc(s)}</span></p><p><b>Subtotal:</b> ${money(o.subtotal)}</p><p><b>Delivery:</b> ${money(o.delivery_charge)}</p><p><b>Total:</b> ${money(total)}</p><p><b>Note:</b> ${esc(o.note||'—')}</p>${itemHtml?`<hr><b>Items</b><div class="order-items">${itemHtml}</div>`:''}</div>
  <div class="btn-row">${s==='Pending'?actionBtn(i,'Confirmed','Confirm Order','primary'):''}${s==='Confirmed'?actionBtn(i,'Processing','Processing','primary'):''}${s==='Processing'?actionBtn(i,'Shipped','Shipped','primary'):''}${s==='Shipped'?actionBtn(i,'Delivered','Delivered','primary'):''}${s!=='Delivered'&&s!=='Cancelled'?actionBtn(i,'Cancelled','Cancel','danger'):''}</div>`)
}
async function updateOrderStatus(i,newStatus){
  const order=ordersCache[i];if(!order)return;
  const old=order.status||'Pending';if(old===newStatus)return;
  const id=order.order_number||order.order_id||order.id||'';
  if(!confirm(`Order ${id}\n\nChange status to "${newStatus}"?`))return;
  try{const {error}=await sb.from('orders').update({status:newStatus}).eq('id',order.id);if(error)throw error;await refreshOrders();closeModal();render()}catch(e){showError(e)}
}

/* ===================== CATEGORIES ===================== */

function categories(){
  const rows=categoriesCache.map((c,i)=>`<tr><td>${esc(c.name)}</td><td>${esc(c.slug||'—')}</td><td><button class="btn danger" onclick="deleteCategory(${i})">Delete</button></td></tr>`).join('');
  return `<div class="section-head"><div><h3>Categories</h3><p>Manage product categories</p></div><button class="btn primary" onclick="addCategory()">＋ Add Category</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Slug</th><th>Action</th></tr></thead><tbody>${rows||`<tr><td colspan="3" class="empty">No categories</td></tr>`}</tbody></table></div>`
}
function addCategory(){
  openModal('Add Category',`<label class="form-grid"><span class="full">Category Name<input id="categoryName" placeholder="Audio"></span></label><div class="btn-row"><button class="btn muted" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveCategory()">Save</button></div>`)
}
async function saveCategory(){
  const name=$('categoryName')?.value.trim();
  if(!name){alert('Category name is required.');return}
  try{
    const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const {error}=await sb.from('categories').insert({name,slug});
    if(error)throw error;
    const {data,error:e}=await sb.from('categories').select('*').order('name');
    if(e)throw e;
    categoriesCache=data||[];closeModal();render()
  }catch(e){showError(e)}
}
async function deleteCategory(i){
  const c=categoriesCache[i];if(!c)return;
  if(!confirm(`Delete category "${c.name}"?`))return;
  try{const {error}=await sb.from('categories').delete().eq('id',c.id);if(error)throw error;categoriesCache=categoriesCache.filter(x=>x.id!==c.id);render()}catch(e){showError(e)}
}

/* ===================== CUSTOMERS ===================== */

function customers(){
  const unique={};
  ordersCache.forEach(o=>{
    const phone=o.phone||o.customer_phone||o.customer?.phone||'';
    if(!phone)return;
    unique[phone]={name:o.customer_name||o.customer?.name||o.name||'—',phone,orders:(unique[phone]?.orders||0)+1}
  });
  const list=Object.values(unique);
  return `<div class="section-head"><div><h3>Customers</h3><p>Customers from your orders</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th></tr></thead><tbody>
  ${list.length?list.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${c.orders}</td></tr>`).join(''):`<tr><td colspan="3" class="empty">No customers yet</td></tr>`}
  </tbody></table></div>`
}

/* ===================== DELIVERY ===================== */

function delivery(){
  const d=deliverySettingsCache||{};
  const dhaka=d.dhaka_charge??60,nearby=d.nearby_charge??100,outside=d.outside_charge??130;
  const districts=d.nearby_districts??'Gazipur, Narayanganj, Narsingdi, Munshiganj, Manikganj';
  return `<div class="section-head"><div><h3>Delivery Settings</h3><p>Manage delivery charges used by customer checkout</p></div><button class="btn muted" onclick="refreshDeliverySettings()">↻ Refresh</button></div>
  <div class="card"><div class="form-grid">
    <label>Dhaka Charge<input id="deliveryDhaka" type="number" min="0" step="1" value="${Number(dhaka)}"><small>Delivery charge for Dhaka city.</small></label>
    <label>Nearby Charge<input id="deliveryNearby" type="number" min="0" step="1" value="${Number(nearby)}"><small>Charge for nearby districts.</small></label>
    <label>Outside Charge<input id="deliveryOutside" type="number" min="0" step="1" value="${Number(outside)}"><small>Charge for other districts.</small></label>
    <label class="full">Nearby Districts<textarea id="deliveryDistricts" rows="4">${esc(districts)}</textarea><small>Write district names separated by commas.</small></label>
  </div><div class="btn-row"><button class="btn primary" id="saveDeliveryBtn" onclick="saveDeliverySettings()">Save Delivery Settings</button></div>
  <hr><p><b>Current settings:</b> Dhaka ৳${Number(dhaka).toLocaleString('en-BD')} · Nearby ৳${Number(nearby).toLocaleString('en-BD')} · Outside ৳${Number(outside).toLocaleString('en-BD')}</p>
  ${d.updated_at?`<p><small>Last updated: ${esc(new Date(d.updated_at).toLocaleString('en-BD'))}</small></p>`:''}</div>`
}
async function saveDeliverySettings(){
  const dhaka=Number($('deliveryDhaka')?.value??''),nearby=Number($('deliveryNearby')?.value??''),outside=Number($('deliveryOutside')?.value??''),districtsRaw=$('deliveryDistricts')?.value??'';
  if(!Number.isFinite(dhaka)||!Number.isFinite(nearby)||!Number.isFinite(outside)||dhaka<0||nearby<0||outside<0){alert('Please enter valid non-negative delivery charges.');return}
  const nearbyDistricts=districtsRaw.split(',').map(x=>x.trim()).filter(Boolean).join(', ');
  const btn=$('saveDeliveryBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const row={id:deliverySettingsCache?.id??1,dhaka_charge:dhaka,nearby_charge:nearby,outside_charge:outside,nearby_districts:nearbyDistricts,updated_at:new Date().toISOString()};
    const {data,error}=await sb.from('delivery_settings').upsert(row,{onConflict:'id'}).select().single();
    if(error)throw error;
    deliverySettingsCache=data||row;alert('Delivery settings saved successfully.');render()
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save Delivery Settings'}}
}

/* ===================== PAYMENTS ===================== */

function payments(){
  const p=paymentSettingsFull;
  return `<div class="section-head"><div><h3>Payment Settings</h3><p>Manage COD, bKash and Nagad</p></div><button class="btn muted" onclick="loadPaymentSettingsFull().then(render).catch(showError)">↻ Refresh</button></div>
  <div class="card"><div class="form-grid">
    <label class="full"><input id="codEnabled" type="checkbox" ${p.cod_enabled?'checked':''}> <b>Enable Cash on Delivery (COD)</b></label>
    <label class="full"><input id="bkashEnabled" type="checkbox" ${p.bkash_enabled?'checked':''}> <b>Enable bKash</b></label>
    <label>bKash Number<input id="bkashNumber" type="tel" value="${esc(p.bkash_number)}" placeholder="01XXXXXXXXX"></label>
    <label class="full"><input id="nagadEnabled" type="checkbox" ${p.nagad_enabled?'checked':''}> <b>Enable Nagad</b></label>
    <label>Nagad Number<input id="nagadNumber" type="tel" value="${esc(p.nagad_number)}" placeholder="01XXXXXXXXX"></label>
  </div><div class="btn-row"><button class="btn primary" id="savePaymentBtn" onclick="savePaymentSettingsFull()">Save Payment Settings</button></div></div>`
}
async function savePaymentSettingsFull(){
  const cod=!!$('codEnabled')?.checked,bkash=!!$('bkashEnabled')?.checked,nagad=!!$('nagadEnabled')?.checked;
  const bn=($('bkashNumber')?.value||'').trim(),nn=($('nagadNumber')?.value||'').trim();
  if(bkash&&!bn){alert('Please enter bKash number.');return}
  if(nagad&&!nn){alert('Please enter Nagad number.');return}
  try{
    const {data:row,error:rerr}=await sb.from('payment_settings').select('id').limit(1).maybeSingle();
    if(rerr)throw rerr;
    const payload={cod_enabled:cod,bkash_enabled:bkash,bkash_number:bn,nagad_enabled:nagad,nagad_number:nn};
    const res=row?.id?await sb.from('payment_settings').update(payload).eq('id',row.id):await sb.from('payment_settings').insert(payload);
    if(res.error)throw res.error;
    paymentSettingsFull={cod_enabled:cod,bkash_enabled:bkash,bkash_number:bn,nagad_enabled:nagad,nagad_number:nn};
    alert('Payment settings saved successfully.');render()
  }catch(e){showError(e)}
}

/* ===================== STORE SETTINGS ===================== */

function settings(){
  return `<div class="section-head"><div><h3>Store Settings</h3><p>Gadget Bazar BD</p></div></div>
  <div class="card"><p>Store settings are connected to Supabase.</p><p>Admin account and product storage are active.</p></div>`
}

/* ===================== NAVIGATION ===================== */

function toggleCatalog(){
  catalogOpen=!catalogOpen;
  $('catalogMenu')?.classList.toggle('hidden',!catalogOpen);
  if($('catalogArrow'))$('catalogArrow').textContent=catalogOpen?'⌄':'›'
}
function setNavActive(section){
  document.querySelectorAll('.nav[data-page],.nav[data-section]').forEach(x=>x.classList.toggle('active',(x.dataset.page||x.dataset.section)===section));
  document.querySelectorAll('.subnav-item').forEach(x=>x.classList.toggle('active-sub',(x.dataset.page||x.dataset.section)===section));
  if(section==='products'||section==='categories'){
    catalogOpen=true;$('catalogMenu')?.classList.remove('hidden');
    if($('catalogArrow'))$('catalogArrow').textContent='⌄'
  }
}
function go(section){
  const allowed=['dashboard','products','orders','customers','categories','delivery','payments','settings'];
  if(!allowed.includes(section))section='dashboard';
  currentSection=section;
  setNavActive(section);
  const titles={dashboard:['Dashboard','Store overview'],products:['Products','Manage products'],orders:['Orders','Manage customer orders'],customers:['Customers','Customer list'],categories:['Categories','Manage categories'],delivery:['Delivery','Delivery settings'],payments:['Payments','Payment settings'],settings:['Settings','Store settings']};
  const t=titles[section];
  if($('pageTitle'))$('pageTitle').textContent=t[0];
  if($('pageSub'))$('pageSub').textContent=t[1];
  render();
  if(window.innerWidth<=720)toggleSidebar(false);
}
function render(){
  const c=$('content');if(!c)return;
  const map={dashboard,products,orders,customers,categories,delivery,payments,settings};
  c.innerHTML=(map[currentSection]||dashboard)();
}
function toggleSidebar(force){
  const side=document.querySelector('.sidebar'),overlay=$('sidebarOverlay');if(!side)return;
  const open=typeof force==='boolean'?force:!side.classList.contains('open');
  side.classList.toggle('open',open);overlay?.classList.toggle('show',open);
}
async function refreshDashboard(){try{await loadCloud();render()}catch(e){showError(e)}}

/* ===================== AUTH ===================== */

async function login(){
  const email=($('loginEmail')?.value||$('loginUser')?.value||'').trim();
  const password=$('loginPassword')?.value??$('loginPass')?.value;
  if(!email||!password){alert('Please enter admin email and password.');return}
  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(data?.user?.id!==ADMIN_UID){await sb.auth.signOut();alert('You are not authorized as admin.');return}
    showApp();await loadCloud();render()
  }catch(e){alert('Login failed.\n\n'+(e?.message||'Invalid email or password.'))}
}
async function logout(){try{await sb.auth.signOut()}catch(e){console.error(e)}showLogin()}

/* ===================== EXPORT / IMPORT ===================== */

function exportData(){
  const data={exportedAt:new Date().toISOString(),products:productsCache,orders:ordersCache,categories:categoriesCache,delivery_settings:deliverySettingsCache,payment_settings:paymentSettingsFull};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gadget-bazar-admin-export.json';a.click();URL.revokeObjectURL(a.href)
}
async function importData(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(Array.isArray(data.products))for(const p of data.products){const {error}=await sb.from('products').upsert(p,{onConflict:'id'});if(error)throw error}
    await loadCloud();render();alert('Import completed.')
  }catch(err){showError(err)}
  e.target.value=''
}

/* ===================== START ===================== */

document.addEventListener('DOMContentLoaded',()=>{
  // One navigation handler only. Supports both old data-page and new data-section markup.
  document.querySelectorAll('.nav[data-page],.nav[data-section],.subnav-item[data-page],.subnav-item[data-section]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      const section=btn.dataset.section||btn.dataset.page;
      if(section)go(section);
    })
  });
  $('importFile')?.addEventListener('change',importData);
  const pass=$('loginPassword')||$('loginPass');
  pass?.addEventListener('keydown',e=>{if(e.key==='Enter')login()});
  $('modal')?.addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
  init()
});

async function init(){
  try{
    const ok=await checkAdmin();if(!ok)return;
    showApp();await loadCloud();render()
  }catch(e){showError(e)}
}

/* ===================== GLOBALS ===================== */

Object.assign(window,{
  $,
  login,logout,go,render,
  closeModal,openModal,
  addProduct,editProduct,saveProduct,deleteProduct,
  filterProducts,
  viewOrder,updateOrderStatus,
  addCategory,saveCategory,deleteCategory,
  refreshProducts,refreshOrders,refreshDashboard,
  refreshDeliverySettings,saveDeliverySettings,
  loadPaymentSettingsFull,savePaymentSettingsFull,
  toggleSidebar,toggleSide:toggleSidebar,toggleCatalog,
  exportData
});
