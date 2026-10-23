/* =========================================================
   GADGET BAZAR BD — FINAL ADMIN PANEL
   Supabase + mobile responsive + Catalog UI
   Delivery Settings management added
========================================================= */

const SUPABASE_URL='https://vwwysrdqexjtlmpmevub.supabase.co';
const SUPABASE_KEY='sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const BUCKET='product images';
const ADMIN_UID='9aa2e054-a19a-4f86-aaf7-25f13e720722';

let productsCache=[];
let ordersCache=[];
let categoriesCache=[];
let offersCache=[];
let editingOfferId=null;
let deliverySettingsCache=null;
let storeSettingsCache={store_name:'Gadget Bazar BD',phone:'',email:'',address:'',support_hours:''};
let currentSection='dashboard';
let editingProductId=null;
let catalogOpen=true;

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

/* Photos from phones are 3-8 MB. Shrink to max 1200px and WebP before upload so the shop loads fast. */
async function prepareImage(file,maxSide=1200){
  if(!file||!/^image\//.test(file.type)||/svg|gif/.test(file.type))return file;
  try{
    let bmp;
    try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){bmp=await createImageBitmap(file)}
    const scale=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
    const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');ctx.drawImage(bmp,0,0,w,h);
    let blob=await new Promise(res=>c.toBlob(res,'image/webp',0.82));
    let ext='webp';
    if(!blob||blob.type!=='image/webp'){
      ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
      blob=await new Promise(res=>c.toBlob(res,'image/jpeg',0.85));ext='jpg';
    }
    if(!blob||(scale===1&&blob.size>=file.size))return file;
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.'+ext,{type:blob.type});
  }catch(e){console.warn('Image optimisation skipped',e);return file}
}
function previewProductImages(input){
  const box=$('productImagePreview');if(!box)return;
  const files=[...(input.files||[])];
  box.innerHTML=files.map(f=>`<div style="display:inline-block;margin:6px 8px 0 0;text-align:center;font-size:11px"><img src="${URL.createObjectURL(f)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:10px;display:block"><span>${(f.size/1048576).toFixed(1)} MB</span></div>`).join('')+(files.length?`<div style="font-size:12px;margin-top:6px;color:#64748b">Photos are automatically resized and compressed when you save.</div>`:'');
}
async function uploadImage(file,id){
  if(!file)return '';
  if(file.size>25*1048576)throw new Error('Image is too large (max 25 MB): '+file.name);
  file=await prepareImage(file);
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`products/${id}_${Date.now()}.${ext}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:true,contentType:file.type});
  if(error)throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
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
  const [p,o,c,d,of]=await Promise.all([
    sb.from('products').select('*').order('created_at',{ascending:false}),
    sb.from('orders').select('*').order('created_at',{ascending:false}),
    sb.from('categories').select('*').order('name',{ascending:true}),
    sb.from('delivery_settings').select('*').order('id',{ascending:true}).limit(1),
    sb.from('offers').select('*').order('created_at',{ascending:false})
  ]);

  if(p.error)throw p.error;
  if(o.error)throw o.error;
  if(c.error)throw c.error;
  if(d.error)throw d.error;

  productsCache=p.data||[];
  ordersCache=o.data||[];
  categoriesCache=c.data||[];
  deliverySettingsCache=d.data?.[0]||null;
  // Offers are optional: a missing table or permission must not block login or the dashboard.
  if(of.error){offersCache=[];console.warn('Offers table permission/schema issue:',of.error.message)}
  else offersCache=of.data||[];

  if($('connectionStatus')){
    $('connectionStatus').textContent=of.error?'● Connected (offers need setup)':'● Connected';
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
  ordersCache=data||[];
}
async function refreshDeliverySettings(){
  await loadDeliverySettings();
  render();
}

function statusClass(s){return s==='Delivered'?'green':s==='Cancelled'?'red':s==='Pending'?'yellow':'blue'}

/* =========================================================
   DASHBOARD
========================================================= */

function dashboard(){
  const total=productsCache.length;
  const active=productsCache.filter(p=>p.active!==false).length;
  const stock=productsCache.reduce((n,p)=>n+Number(p.stock||0),0);
  const totalOrders=ordersCache.length;
  const pending=ordersCache.filter(o=>(o.status||'Pending')==='Pending').length;
  const delivered=ordersCache.filter(o=>(o.status||'')==='Delivered').length;
  const revenue=ordersCache
    .filter(o=>(o.status||'')!=='Cancelled')
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

/* =========================================================
   PRODUCTS
========================================================= */

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
  let gallery=p.images??p.gallery??p.image_urls??[];
  if(typeof gallery==='string'){try{gallery=JSON.parse(gallery)}catch(e){gallery=[]}}
  if(!Array.isArray(gallery))gallery=[];
  const currentImages=[...new Set([p.image,...gallery].filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))];
  const specs=p.specifications??p.specs??'';
  const specsText=typeof specs==='string'?specs:(Array.isArray(specs)?specs.map(x=>typeof x==='object'&&x?`${x.name||x.label||'Feature'}: ${x.value||x.detail||''}`:String(x)).join('\n'):JSON.stringify(specs,null,2));
  return `<div class="form-grid">
    <label>Product Name<input id="productName" value="${esc(p.name||'')}" placeholder="e.g. TWS AirBuds Pro" required></label>
    <label>Category<input id="productCategory" list="categoryList" value="${esc(p.category||'')}" placeholder="Audio"><datalist id="categoryList">${opts}</datalist></label>
    <label>Price (৳)<input id="productPrice" type="number" min="0" value="${Number(p.price||0)}"></label>
    <label>Discount (%)<input id="productDiscount" type="number" min="0" max="100" value="${Number(p.discount||0)}"></label>
    <label>Stock<input id="productStock" type="number" min="0" value="${Number(p.stock||0)}"></label>
    <label>Status<select id="productActive"><option value="true" ${p.active!==false?'selected':''}>Active</option><option value="false" ${p.active===false?'selected':''}>Inactive</option></select></label>
    <label>Brand<input id="productBrand" value="${esc(p.brand||'')}" placeholder="e.g. Xiaomi"></label>
    <label>Model<input id="productModel" value="${esc(p.model||'')}" placeholder="e.g. Redmi Buds"></label>
    <label>Warranty<input id="productWarranty" value="${esc(p.warranty||'')}" placeholder="e.g. 7 days replacement"></label>
    <label>Color<input id="productColor" value="${esc(p.color||'')}" placeholder="Black"></label>
    <label>Connectivity<input id="productConnectivity" value="${esc(p.connectivity||'')}" placeholder="Bluetooth 5.3 / USB-C"></label>
    <label>Battery life<input id="productBatteryLife" value="${esc(p.battery_life||'')}" placeholder="e.g. Up to 20 hours"></label>
    <label class="full">Compatibility<input id="productCompatibility" value="${esc(p.compatibility||'')}" placeholder="Compatible devices / systems"></label>
    <label class="full">Full Description<textarea id="productDescription" rows="4" placeholder="Write the full product description...">${esc(p.description||'')}</textarea></label>
    <label class="full">Specifications (one per line: Feature: Value)<textarea id="productSpecifications" rows="5" placeholder="Bluetooth: 5.3&#10;Battery: 400mAh&#10;Charging: USB-C">${esc(specsText||'')}</textarea><small>Write one specification per line. You do not need to open Supabase Table Editor for each product.</small></label>
    <label class="full">Product Images (select multiple)<input id="productImages" type="file" accept="image/*" multiple onchange="previewProductImages(this)"><small>Choose multiple photos. Existing photos are kept unless you remove them below.</small><div id="productImagePreview"></div></label>
    ${currentImages.length?`<div class="full admin-current-gallery"><strong>Saved images</strong><div class="admin-gallery-grid">${currentImages.map((src,i)=>`<label class="admin-gallery-item"><img src="${esc(src)}" alt="Saved product image ${i+1}"><span><input type="checkbox" class="remove-product-image" value="${esc(src)}"> Remove</span></label>`).join('')}</div></div>`:''}
    <label class="full admin-checkline"><input id="productIsDeal" type="checkbox" ${p.is_deal||Number(p.discount)>=70?'checked':''}> Show this product in the 70% OFF Deals page (it will also remain in Home and its category)</label>
  </div><div class="btn-row"><button class="btn muted" onclick="closeModal()">Cancel</button><button class="btn primary" id="saveProductBtn" onclick="saveProduct()">Save Product</button></div>`
}
async function saveProduct(){
  const name=$('productName')?.value.trim(),category=$('productCategory')?.value.trim();
  const priceRaw=$('productPrice')?.value ?? '0',discountRaw=$('productDiscount')?.value ?? '0',stockRaw=$('productStock')?.value ?? '0';
  const price=Number(priceRaw),discount=Number(discountRaw),stock=Number(stockRaw);
  if(!Number.isFinite(price)||!Number.isFinite(discount)||!Number.isFinite(stock)||price<0||discount<0||discount>100||stock<0){
    alert('Enter valid values: price and stock must be 0 or more, discount must be between 0 and 100.');return;
  }
  if(price>999999999999||stock>2147483647){alert('The number is too large.');return;}
  const active=$('productActive')?.value==='true';
  const files=[...($('productImages')?.files||[])];
  if(!name){alert('Product name is required.');return}
  try{
    const isEdit=!!editingProductId,id=editingProductId||crypto.randomUUID(),old=productsCache.find(p=>String(p.id)===String(id));
    const btn=$('saveProductBtn');if(btn){btn.disabled=true;btn.textContent='Saving...'}
    let images=old?.images??old?.gallery??old?.image_urls??[];
    if(typeof images==='string'){try{images=JSON.parse(images)}catch(e){images=[]}}
    if(!Array.isArray(images))images=[];
    images=[...new Set([old?.image,...images].filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))];
    const remove=new Set([...document.querySelectorAll('.remove-product-image:checked')].map(x=>x.value));
    images=images.filter(x=>!remove.has(x));
    for(const file of files){const url=await uploadImage(file,id);if(url)images.push(url)}
    images=[...new Set(images)];
    const image=images[0]||'';
    const rawSpecs=$('productSpecifications')?.value.trim()||'';
    const specifications=rawSpecs.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const at=line.indexOf(':');return at<0?{name:line,value:''}:{name:line.slice(0,at).trim(),value:line.slice(at+1).trim()};
    }).filter(x=>x.name);
    const product={
      id,name,category,price,discount,stock,active,image,images,
      brand:$('productBrand')?.value.trim()||'',
      model:$('productModel')?.value.trim()||'',
      warranty:$('productWarranty')?.value.trim()||'',
      color:$('productColor')?.value.trim()||'',
      connectivity:$('productConnectivity')?.value.trim()||'',
      battery_life:$('productBatteryLife')?.value.trim()||'',
      compatibility:$('productCompatibility')?.value.trim()||'',
      description:$('productDescription')?.value.trim()||'',
      specifications,
      is_deal:!!$('productIsDeal')?.checked
    };
    const {error}=await sb.from('products').upsert(product,{onConflict:'id'});
    if(error)throw error;
    await refreshProducts();closeModal();render();
    alert(isEdit?'Product updated successfully.':'Product added successfully.');
  }catch(e){
    showError(e);
    const btn=$('saveProductBtn');if(btn){btn.disabled=false;btn.textContent='Save Product'}
  }
}
async function deleteProduct(i){
  const p=productsCache[i];if(!p)return;
  if(!confirm(`Delete "${p.name}"?`))return;
  try{
    const {error}=await sb.from('products').delete().eq('id',p.id);
    if(error)throw error;
    await refreshProducts();
    render()
  }catch(e){showError(e)}
}

/* =========================================================
   ORDERS
========================================================= */

function orderMatches(o,q,status,payment){
  const id=String(o.order_number||o.order_id||o.id||'');
  const name=String(o.customer_name||o.customer?.name||o.name||'');
  const phone=String(o.phone||o.customer_phone||o.customer?.phone||'');
  const address=[o.district,o.upazila,o.address].filter(Boolean).join(' ');
  const haystack=`${id} ${name} ${phone} ${address}`.toLowerCase();
  const s=o.status||'Pending';
  const pm=o.payment_method||o.paymentMethod||'COD';
  return haystack.includes(q)&&(!status||s===status)&&(!payment||pm.toLowerCase()===payment.toLowerCase());
}
function getFilteredOrders(){
  const q=String($('orderSearch')?.value||'').trim().toLowerCase();
  const status=$('orderStatusFilter')?.value||'';
  const payment=$('orderPaymentFilter')?.value||'';
  return ordersCache.map((o,i)=>({o,i})).filter(x=>orderMatches(x.o,q,status,payment));
}
function orderRows(list){
  if(!list.length)return `<tr><td colspan="8" class="empty">No matching orders found</td></tr>`;
  return list.map(({o,i})=>{
    const s=o.status||'Pending';
    const id=o.order_number||o.order_id||o.id||'#'+(i+1);
    const total=o.total??(Number(o.subtotal||0)+Number(o.delivery_charge??o.delivery_fee??0));
    const name=o.customer_name||o.customer?.name||o.name||'—';
    const phone=o.phone||o.customer_phone||o.customer?.phone||'—';
    const created=o.created_at?new Date(o.created_at).toLocaleString('en-BD'):'—';
    let next='';
    if(s==='Pending')next=actionBtn(i,'Confirmed','Confirm','primary');
    else if(s==='Confirmed')next=actionBtn(i,'Processing','Processing','primary');
    else if(s==='Processing')next=actionBtn(i,'Shipped','Shipped','primary');
    else if(s==='Shipped')next=actionBtn(i,'Delivered','Delivered','primary');
    const cancel=(s!=='Delivered'&&s!=='Cancelled')?actionBtn(i,'Cancelled','Cancel','danger'):'';
    return `<tr><td><b>${esc(id)}</b><br><small>${esc(created)}</small></td><td>${esc(name)}</td><td>${esc(phone)}</td><td>${money(total)}</td><td>${esc(o.payment_method||o.paymentMethod||'COD')}${o.transaction_id?`<br><small>TXN: ${esc(o.transaction_id)}</small>`:''}</td><td><span class="pill ${statusClass(s)}">${esc(s)}</span></td><td class="actions"><button class="btn muted" onclick="viewOrder(${i})">View</button><button class="btn" style="background:#1fa855;color:#fff" onclick="whatsappOrder(${i})" title="Message customer on WhatsApp">WhatsApp</button>${next}${cancel}</td></tr>`
  }).join('');
}
function orders(){
  const filtered=getFilteredOrders();
  return `<div class="section-head"><div><h3>Orders</h3><p>Manage, search and update customer orders</p></div><div class="toolbar"><button class="btn muted" onclick="refreshOrders().then(()=>render()).catch(showError)">↻ Refresh</button><button class="btn primary" onclick="exportOrdersCSV()">Export CSV</button></div></div>
  <div class="filters"><div class="search-wrap"><input class="input" id="orderSearch" value="${esc($('orderSearch')?.value||'')}" placeholder="Search order ID, customer, phone, address..." oninput="filterOrders()"></div><select class="select" id="orderStatusFilter" onchange="filterOrders()"><option value="">All Statuses</option>${['Pending','Confirmed','Processing','Shipped','Delivered','Cancelled'].map(s=>`<option value="${s}" ${$('orderStatusFilter')?.value===s?'selected':''}>${s}</option>`).join('')}</select><select class="select" id="orderPaymentFilter" onchange="filterOrders()"><option value="">All Payments</option>${['COD','bKash','Nagad'].map(s=>`<option value="${s}" ${$('orderPaymentFilter')?.value===s?'selected':''}>${s}</option>`).join('')}</select></div>
  <p class="orders-count"><small>Showing ${filtered.length} of ${ordersCache.length} orders.</small></p>
  <div class="table-wrap"><table class="table"><thead><tr><th>Order ID / Date</th><th>Customer</th><th>Phone</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody id="orderRows">${orderRows(filtered)}</tbody></table></div>`
}
function filterOrders(){
  const rows=$('orderRows');
  if(rows)rows.innerHTML=orderRows(getFilteredOrders());
  const count=document.querySelector('#content .orders-count');
  if(count)count.textContent=`Showing ${getFilteredOrders().length} of ${ordersCache.length} orders.`;
}
function actionBtn(i,status,label,cls){return `<button class="btn ${cls}" onclick="updateOrderStatus(${i},'${status}')">${label}</button>`}
function exportOrdersCSV(){
  const list=getFilteredOrders().map(({o})=>({
    order_id:o.order_number||o.order_id||o.id||'',
    date:o.created_at||'',customer:o.customer_name||o.customer?.name||o.name||'',
    phone:o.phone||o.customer_phone||o.customer?.phone||'',district:o.district||'',upazila:o.upazila||'',address:o.address||'',
    items:formatOrderItems(o.items),subtotal:Number(o.subtotal||0),delivery:Number(o.delivery_charge??o.delivery_fee??0),
    total:Number(o.total??(Number(o.subtotal||0)+Number(o.delivery_charge??o.delivery_fee??0))),
    payment:o.payment_method||o.paymentMethod||'COD',transaction_id:o.transaction_id||'',status:o.status||'Pending',note:o.note||''
  }));
  if(!list.length){alert('No orders to export.');return}
  const keys=Object.keys(list[0]);
  const csv=[keys.join(','),...list.map(row=>keys.map(k=>'"'+String(row[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='gadget-bazar-orders.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function formatOrderItems(items){
  if(typeof items==='string'){try{items=JSON.parse(items)}catch{return items}}
  if(!Array.isArray(items))return '';
  return items.map(x=>`${x.name||x.title||'Product'} x${x.qty||x.quantity||1}`).join('; ');
}
function viewOrder(i){
  const o=ordersCache[i];if(!o)return;
  const id=o.order_number||o.order_id||o.id||'',name=o.customer_name||o.customer?.name||o.name||'',phone=o.phone||o.customer_phone||o.customer?.phone||'';
  const district=o.district||o.customer?.district||'',upazila=o.upazila||o.customer?.upazila||'',address=o.address||o.customer?.address||'';
  const payment=o.payment_method||o.paymentMethod||'COD',s=o.status||'Pending',delivery=Number(o.delivery_charge??o.delivery_fee??0),total=o.total??(Number(o.subtotal||0)+delivery);
  let items=o.items;let itemHtml='';
  if(typeof items==='string'){try{items=JSON.parse(items)}catch{items=[]}}
  if(Array.isArray(items))itemHtml=items.map(x=>{const qty=Number(x.qty||x.quantity||1);const price=Number(x.price||x.unit_price||0);return `<div class="order-item"><span>${esc(x.name||x.title||'Product')} × ${qty}</span><b>${money(price*qty)}</b></div>`}).join('');
  const created=o.created_at?new Date(o.created_at).toLocaleString('en-BD'):'—';
  openModal('Order '+id,`<div class="card"><b>Order Information</b><p><b>Order ID:</b> ${esc(id)}</p><p><b>Placed:</b> ${esc(created)}</p><p><b>Status:</b> <span class="pill ${statusClass(s)}">${esc(s)}</span></p><hr><b>Customer</b><p>${esc(name)} · ${esc(phone)}</p><p>${esc([district,upazila].filter(Boolean).join(', '))}</p><p>${esc(address||'—')}</p><hr><p><b>Payment:</b> ${esc(payment)}</p><p><b>Transaction ID:</b> ${esc(o.transaction_id||'—')}</p><p><b>Subtotal:</b> ${money(o.subtotal)}</p><p><b>Delivery:</b> ${money(delivery)}</p><p><b>Total:</b> <b>${money(total)}</b></p><p><b>Customer note:</b> ${esc(o.note||'—')}</p>${itemHtml?`<hr><b>Items</b><div class="order-items">${itemHtml}</div>`:'<hr><p>No item details saved with this order.</p>'}</div><div class="btn-row"><button class="btn" style="background:#1fa855;color:#fff" onclick="whatsappOrder(${i})">WhatsApp Customer</button>${s==='Pending'?actionBtn(i,'Confirmed','Confirm Order','primary'):''}${s==='Confirmed'?actionBtn(i,'Processing','Start Processing','primary'):''}${s==='Processing'?actionBtn(i,'Shipped','Mark Shipped','primary'):''}${s==='Shipped'?actionBtn(i,'Delivered','Mark Delivered','primary'):''}${s!=='Delivered'&&s!=='Cancelled'?actionBtn(i,'Cancelled','Cancel Order','danger'):''}</div>`);
}
/* WhatsApp helpers: the status is always changed in this panel (single source of truth);
   WhatsApp is only used to message the customer. */
function waPhone(v){
  let d=String(v||'').replace(/\D/g,'');
  if(!d)return '';
  if(d.startsWith('00'))d=d.slice(2);
  if(d.startsWith('880'))return d;
  if(d.startsWith('0'))return '88'+d;
  if(d.length===10&&d.startsWith('1'))return '880'+d;
  return d;
}
function waMessage(o){
  const s=o.status||'Pending';
  const id=o.order_number||o.order_id||o.id||'';
  const name=o.customer_name||o.name||'';
  const total=o.total??(Number(o.subtotal||0)+Number(o.delivery_charge??o.delivery_fee??0));
  const head=`আসসালামু আলাইকুম${name?' '+name:''}, Gadget Bazar BD থেকে বলছি।\nঅর্ডার নং: ${id}\nমোট: ${money(total)}\n`;
  const tail={
    Pending:'আপনার অর্ডারটি আমরা পেয়েছি। কনফার্ম করার জন্য যোগাযোগ করছি, দয়া করে ঠিকানা ও নম্বর ঠিক আছে কিনা জানাবেন।',
    Confirmed:'আপনার অর্ডারটি কনফার্ম করা হয়েছে। শীঘ্রই প্রস্তুত করে পাঠানো হবে। ধন্যবাদ!',
    Processing:'আপনার অর্ডারটি প্রস্তুত করা হচ্ছে।',
    Shipped:'আপনার অর্ডারটি কুরিয়ারে পাঠানো হয়েছে। শীঘ্রই পৌঁছে যাবে।',
    Delivered:'আপনার অর্ডারটি ডেলিভারি হয়েছে। আমাদের থেকে কেনার জন্য ধন্যবাদ!',
    Cancelled:'দুঃখিত, আপনার অর্ডারটি বাতিল করা হয়েছে। কোনো প্রশ্ন থাকলে জানাবেন।'
  }[s]||'';
  return head+tail;
}
function waLink(o){
  const ph=waPhone(o.phone||o.customer_phone||o.customer?.phone);
  return ph?`https://wa.me/${ph}?text=${encodeURIComponent(waMessage(o))}`:'';
}
function whatsappOrder(i){
  const o=ordersCache[i];if(!o)return;
  const url=waLink(o);
  if(!url){alert('This order has no phone number.');return}
  window.open(url,'_blank','noopener');
}
function updateOrderBadge(){
  const n=ordersCache.filter(o=>(o.status||'Pending')==='Pending').length;
  const btn=document.querySelector('.nav[data-section="orders"]');if(!btn)return;
  let b=btn.querySelector('.nav-badge');
  if(!b){b=document.createElement('em');b.className='nav-badge';b.style.cssText='margin-left:auto;background:#ef4444;color:#fff;border-radius:99px;font-style:normal;font-size:11px;font-weight:700;padding:1px 7px';btn.appendChild(b)}
  b.textContent=n;b.style.display=n?'inline-block':'none';
}
async function updateOrderStatus(i,newStatus){
  const order=ordersCache[i];if(!order)return;
  const allowed=['Confirmed','Processing','Shipped','Delivered','Cancelled'];
  if(!allowed.includes(newStatus)){alert('Invalid order status.');return}
  const old=order.status||'Pending';if(old===newStatus)return;
  const id=order.order_number||order.order_id||order.id||'';
  if(newStatus==='Cancelled'&&old==='Delivered'){alert('A delivered order cannot be cancelled here.');return}
  if(!confirm(`Order ${id}\n\nChange status from "${old}" to "${newStatus}"?`))return;
  try{
    const {error}=await sb.from('orders').update({status:newStatus,updated_at:new Date().toISOString()}).eq('id',order.id);
    if(error)throw error;
    await refreshOrders();
    if(newStatus==='Cancelled'){try{await refreshProducts()}catch(e){console.warn(e)}}
    closeModal();
    render();
  }catch(e){showError(e)}
}

/* =========================================================
   CATEGORIES
========================================================= */

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
    categoriesCache=data||[];
    closeModal();
    render()
  }catch(e){showError(e)}
}
async function deleteCategory(i){
  const c=categoriesCache[i];if(!c)return;
  if(!confirm(`Delete category "${c.name}"?`))return;
  try{
    const {error}=await sb.from('categories').delete().eq('id',c.id);
    if(error)throw error;
    categoriesCache=categoriesCache.filter(x=>x.id!==c.id);
    render()
  }catch(e){showError(e)}
}

/* =========================================================
   CUSTOMERS
========================================================= */

function customers(){
  const unique={};
  ordersCache.forEach(o=>{
    const phone=o.phone||o.customer_phone||o.customer?.phone||'';
    if(!phone)return;
    unique[phone]={
      name:o.customer_name||o.customer?.name||o.name||'—',
      phone,
      orders:(unique[phone]?.orders||0)+1
    }
  });
  const list=Object.values(unique);

  return `<div class="section-head"><div><h3>Customers</h3><p>Customers from your orders</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th></tr></thead><tbody>
  ${list.length?list.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${c.orders}</td></tr>`).join(''):`<tr><td colspan="3" class="empty">No customers yet</td></tr>`}
  </tbody></table></div>`
}

/* =========================================================
   DELIVERY SETTINGS — EDIT + SAVE TO SUPABASE
========================================================= */

function delivery(){
  const d=deliverySettingsCache||{};

  const dhaka=d.dhaka_charge??60;
  const nearby=d.nearby_charge??100;
  const outside=d.outside_charge??130;
  const districts=d.nearby_districts??'Gazipur, Narayanganj, Narsingdi, Munshiganj, Manikganj';

  return `<div class="section-head">
    <div><h3>Delivery Settings</h3><p>Manage delivery charges used by customer checkout</p></div>
    <button class="btn muted" onclick="refreshDeliverySettings()">↻ Refresh</button>
  </div>

  <div class="card">
    <div class="form-grid">
      <label>
        Dhaka Charge
        <input id="deliveryDhaka" type="number" min="0" step="1" value="${Number(dhaka)}" placeholder="60">
        <small>Delivery charge for Dhaka city.</small>
      </label>

      <label>
        Nearby Charge
        <input id="deliveryNearby" type="number" min="0" step="1" value="${Number(nearby)}" placeholder="100">
        <small>Charge for nearby districts.</small>
      </label>

      <label>
        Outside Charge
        <input id="deliveryOutside" type="number" min="0" step="1" value="${Number(outside)}" placeholder="130">
        <small>Charge for other districts.</small>
      </label>

      <label class="full">
        Nearby Districts
        <textarea id="deliveryDistricts" rows="4" placeholder="Gazipur, Narayanganj, Narsingdi, Munshiganj, Manikganj">${esc(districts)}</textarea>
        <small>Write district names separated by commas.</small>
      </label>
    </div>

    <div class="btn-row">
      <button class="btn primary" id="saveDeliveryBtn" onclick="saveDeliverySettings()">Save Delivery Settings</button>
    </div>

    <hr>
    <p><b>Current settings:</b> Dhaka ৳${Number(dhaka).toLocaleString('en-BD')} · Nearby ৳${Number(nearby).toLocaleString('en-BD')} · Outside ৳${Number(outside).toLocaleString('en-BD')}</p>
    ${d.updated_at?`<p><small>Last updated: ${esc(new Date(d.updated_at).toLocaleString('en-BD'))}</small></p>`:''}
  </div>`
}

async function saveDeliverySettings(){
  const dhakaRaw=$('deliveryDhaka')?.value??'';
  const nearbyRaw=$('deliveryNearby')?.value??'';
  const outsideRaw=$('deliveryOutside')?.value??'';
  const districtsRaw=$('deliveryDistricts')?.value??'';

  const dhaka=Number(dhakaRaw);
  const nearby=Number(nearbyRaw);
  const outside=Number(outsideRaw);

  if(!Number.isFinite(dhaka)||!Number.isFinite(nearby)||!Number.isFinite(outside)||dhaka<0||nearby<0||outside<0){
    alert('Please enter valid non-negative delivery charges.');
    return;
  }

  if(dhaka>999999999||nearby>999999999||outside>999999999){
    alert('Delivery charge is too large.');
    return;
  }

  const nearbyDistricts=districtsRaw
    .split(',')
    .map(x=>x.trim())
    .filter(Boolean)
    .join(', ');

  const btn=$('saveDeliveryBtn');

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Saving...';
    }

    const row={
      id:deliverySettingsCache?.id??1,
      dhaka_charge:dhaka,
      nearby_charge:nearby,
      outside_charge:outside,
      nearby_districts:nearbyDistricts,
      updated_at:new Date().toISOString()
    };

    const {data,error}=await sb
      .from('delivery_settings')
      .upsert(row,{onConflict:'id'})
      .select()
      .single();

    if(error)throw error;

    deliverySettingsCache=data||row;
    alert('Delivery settings saved successfully.');
    render();
  }catch(e){
    showError(e);
    if(btn){
      btn.disabled=false;
      btn.textContent='Save Delivery Settings';
    }
  }
}

/* =========================================================
   PAYMENTS / STORE SETTINGS
========================================================= */

let paymentSettingsFull={
  cod_enabled:true,
  bkash_enabled:false,
  bkash_number:'',
  nagad_enabled:false,
  nagad_number:''
};

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

function payments(){
  const p=paymentSettingsFull;
  return `<div class="section-head">
    <div><h3>Payment Settings</h3><p>Manage COD, bKash and Nagad</p></div>
    <button class="btn muted" onclick="loadPaymentSettingsFull().then(render).catch(showError)">↻ Refresh</button>
  </div>
  <div class="card">
    <div class="form-grid">
      <label class="full"><input id="codEnabled" type="checkbox" ${p.cod_enabled?'checked':''}> <b>Enable Cash on Delivery (COD)</b></label>
      <label class="full"><input id="bkashEnabled" type="checkbox" ${p.bkash_enabled?'checked':''}> <b>Enable bKash</b></label>
      <label>bKash Number<input id="bkashNumber" type="tel" value="${esc(p.bkash_number)}" placeholder="01XXXXXXXXX"></label>
      <label class="full"><input id="nagadEnabled" type="checkbox" ${p.nagad_enabled?'checked':''}> <b>Enable Nagad</b></label>
      <label>Nagad Number<input id="nagadNumber" type="tel" value="${esc(p.nagad_number)}" placeholder="01XXXXXXXXX"></label>
    </div>
    <div class="btn-row">
      <button class="btn primary" id="savePaymentBtn" onclick="savePaymentSettingsFull()">Save Payment Settings</button>
    </div>
  </div>`;
}

async function savePaymentSettingsFull(){
  const cod=!!$('codEnabled')?.checked;
  const bkash=!!$('bkashEnabled')?.checked;
  const nagad=!!$('nagadEnabled')?.checked;
  const bn=($('bkashNumber')?.value||'').trim();
  const nn=($('nagadNumber')?.value||'').trim();

  if(bkash&&!bn){alert('Please enter bKash number.');return;}
  if(nagad&&!nn){alert('Please enter Nagad number.');return;}

  const btn=$('savePaymentBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...';}
    const {data:row,error:rerr}=await sb.from('payment_settings').select('id').limit(1).maybeSingle();
    if(rerr)throw rerr;

    const payload={
      cod_enabled:cod,
      bkash_enabled:bkash,
      bkash_number:bn,
      nagad_enabled:nagad,
      nagad_number:nn
    };

    const res=row?.id
      ? await sb.from('payment_settings').update(payload).eq('id',row.id)
      : await sb.from('payment_settings').insert(payload);

    if(res.error)throw res.error;

    paymentSettingsFull={...payload};
    alert('Payment settings saved successfully.');
    render();
  }catch(e){
    showError(e);
    if(btn){btn.disabled=false;btn.textContent='Save Payment Settings';}
  }
}

async function loadStoreSettings(){
  const {data,error}=await sb.from('store_settings').select('*').eq('id',1).maybeSingle();
  if(error)throw error;
  storeSettingsCache={
    store_name:data?.store_name||'Gadget Bazar BD',
    phone:data?.phone||'',
    email:data?.email||'',
    address:data?.address||'',
    support_hours:data?.support_hours||'',
    updated_at:data?.updated_at||null
  };
  return storeSettingsCache;
}

function settings(){
  const s=storeSettingsCache||{};
  return `<div class="section-head"><div><h3>Store Settings</h3><p>Manage your store contact information</p></div><button class="btn muted" onclick="loadStoreSettings().then(render).catch(showError)">↻ Refresh</button></div>
  <div class="card"><div class="form-grid">
    <label class="full">Store Name<input id="storeName" maxlength="120" value="${esc(s.store_name||'Gadget Bazar BD')}" placeholder="Gadget Bazar BD"></label>
    <label>Contact Phone<input id="storePhone" type="tel" maxlength="30" value="${esc(s.phone||'')}" placeholder="01XXXXXXXXX"></label>
    <label>Contact Email<input id="storeEmail" type="email" maxlength="160" value="${esc(s.email||'')}" placeholder="support@example.com"></label>
    <label class="full">Store Address<textarea id="storeAddress" rows="3" maxlength="500" placeholder="Store address">${esc(s.address||'')}</textarea></label>
    <label class="full">Support Hours<input id="storeHours" maxlength="160" value="${esc(s.support_hours||'')}" placeholder="Every day, 10 AM–8 PM"></label>
  </div><div class="btn-row"><button class="btn primary" id="saveStoreSettingsBtn" onclick="saveStoreSettings()">Save Store Settings</button></div>
  ${s.updated_at?`<p><small>Last updated: ${esc(new Date(s.updated_at).toLocaleString('en-BD'))}</small></p>`:''}</div>`
}

async function saveStoreSettings(){
  const store_name=($('storeName')?.value||'').trim();
  const phone=($('storePhone')?.value||'').trim();
  const email=($('storeEmail')?.value||'').trim();
  const address=($('storeAddress')?.value||'').trim();
  const support_hours=($('storeHours')?.value||'').trim();
  if(!store_name){alert('Store name is required.');return;}
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){alert('Please enter a valid email address.');return;}
  const btn=$('saveStoreSettingsBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...';}
    const payload={id:1,store_name,phone,email,address,support_hours,updated_at:new Date().toISOString()};
    const {data,error}=await sb.from('store_settings').upsert(payload,{onConflict:'id'}).select().single();
    if(error)throw error;
    storeSettingsCache={...payload,...(data||{})};
    alert('Store settings saved successfully.');
    render();
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save Store Settings';}}
}

/* =========================================================
   NAVIGATION
========================================================= */

function toggleCatalog(){
  catalogOpen=!catalogOpen;
  $('catalogMenu')?.classList.toggle('hidden',!catalogOpen);
  if($('catalogArrow'))$('catalogArrow').textContent=catalogOpen?'⌄':'›'
}
function setNavActive(section){
  document.querySelectorAll('.nav[data-page],.nav[data-section]').forEach(x=>{
    x.classList.toggle('active',(x.dataset.page||x.dataset.section)===section)
  });
  document.querySelectorAll('.subnav-item').forEach(x=>{
    x.classList.toggle('active-sub',(x.dataset.page||x.dataset.section)===section)
  });

  if(section==='products'||section==='categories'){
    catalogOpen=true;
    $('catalogMenu')?.classList.remove('hidden');
    if($('catalogArrow'))$('catalogArrow').textContent='⌄'
  }
}
function go(section){
  currentSection=section;
  setNavActive(section);

  const titles={
    dashboard:['Dashboard','Store overview'],
    products:['Products','Manage products'],
    orders:['Orders','Manage customer orders'],
    customers:['Customers','Customer list'],
    categories:['Categories','Manage categories'],
    offers:['Offers & Deals','Manage promotions and schedules'],
    delivery:['Delivery','Delivery settings'],
    payments:['Payments','Payment settings'],
    settings:['Settings','Store settings']
  };

  const t=titles[section]||titles.dashboard;
  if($('pageTitle'))$('pageTitle').textContent=t[0];
  if($('pageSub'))$('pageSub').textContent=t[1];

  render();

  if(window.innerWidth<=720)toggleSidebar(false);
}
function render(){
  const c=$('content');if(!c)return;
  const map={dashboard,products,orders,customers,categories,offers,delivery,payments,settings};
  c.innerHTML=(map[currentSection]||dashboard)();
  updateOrderBadge();
}
function toggleSidebar(force){
  const side=document.querySelector('.sidebar'),overlay=$('sidebarOverlay');
  if(!side)return;
  const open=typeof force==='boolean'?force:!side.classList.contains('open');
  side.classList.toggle('open',open);
  overlay?.classList.toggle('show',open);
}
async function refreshDashboard(){
  try{
    await loadCloud();
    render()
  }catch(e){showError(e)}
}

/* =========================================================
   AUTH
========================================================= */

async function login(){
  const email=($('loginEmail')?.value||$('loginUser')?.value||'').trim(),
        password=$('loginPassword')?.value??$('loginPass')?.value;
  if(!email||!password){alert('Please enter admin email and password.');return}

  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;

    if(data?.user?.id!==ADMIN_UID){
      await sb.auth.signOut();
      alert('You are not authorized as admin.');
      return
    }

    showApp();
    await loadCloud();
    await loadPaymentSettingsFull();
    await loadStoreSettings();
    render()
  }catch(e){
    alert('Login failed.\n\n'+(e?.message||'Invalid email or password.'))
  }
}
async function logout(){
  try{await sb.auth.signOut()}catch(e){console.error(e)}
  showLogin()
}

/* =========================================================
   EXPORT / IMPORT
========================================================= */

function exportData(){
  const data={
    exportedAt:new Date().toISOString(),
    products:productsCache,
    orders:ordersCache,
    categories:categoriesCache,
    offers:offersCache,
    delivery_settings:deliverySettingsCache,
    payment_settings:paymentSettingsFull,
    store_settings:storeSettingsCache
  };

  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='gadget-bazar-admin-export.json';
  a.click();
  URL.revokeObjectURL(a.href)
}

async function importData(e){
  let file=e?.target?.files?.[0];
  if(!file){
    const picker=document.createElement('input');
    picker.type='file';
    picker.accept='application/json,.json';
    picker.onchange=ev=>importData(ev);
    picker.click();
    return;
  }

  try{
    const data=JSON.parse(await file.text());

    if(Array.isArray(data.products)){
      for(const p of data.products){
        const {error}=await sb.from('products').upsert(p,{onConflict:'id'});
        if(error)throw error
      }
    }

    await loadCloud();
    render();
    alert('Import completed.')
  }catch(err){
    showError(err)
  }

  e.target.value=''
}

/* =========================================================
   OFFERS & DEALS
   Restored from the 14 Oct 2026 admin (commit acaca7c).
   Writes to the `offers` table that the customer website reads.
========================================================= */
function offerDateInput(v){
  if(!v)return '';
  const d=new Date(v);
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function offers(){
  const rows=offersCache.map((o,i)=>{
    const ids=Array.isArray(o.product_ids)?o.product_ids:[];
    const names=ids.map(id=>productsCache.find(p=>String(p.id)===String(id))?.name).filter(Boolean).map(esc).join(', ')||'—';
    const value=Number(o.discount_percent||0)>0?Number(o.discount_percent)+'% off':(o.combo_price?money(o.combo_price):'Special deal');
    return `<tr><td><b>${esc(o.title)}</b><br><small>${esc(o.description||'')}</small></td><td>${esc(o.offer_type)}</td><td>${value}</td><td>${names}</td><td>${o.starts_at?esc(new Date(o.starts_at).toLocaleString()):'Now'}<br>→ ${o.ends_at?esc(new Date(o.ends_at).toLocaleString()):'No end'}</td><td><span class="pill ${o.active?'green':'red'}">${o.active?'Active':'Inactive'}</span></td><td class="actions"><button class="btn muted" onclick="editOffer(${i})">Edit</button><button class="btn danger" onclick="deleteOffer(${i})">Delete</button></td></tr>`;
  }).join('');
  return `<div class="section-head"><div><h3>Offers & Deals</h3><p>Create and schedule the deals shown on your customer website.</p></div><button class="btn primary" onclick="addOffer()">＋ Create Offer</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Offer</th><th>Type</th><th>Discount / Combo</th><th>Products</th><th>Schedule</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="7" class="empty">No offers yet. Create your first offer.</td></tr>`}</tbody></table></div>
  <p class="orders-count" style="margin-top:12px"><small>A percentage offer changes the price at checkout only if the product's own discount is also set in Products. A Combo Deal is charged at its combo price.</small></p>`;
}
function offerForm(o={}){
  const chosen=(Array.isArray(o.product_ids)?o.product_ids:[]).map(String);
  const picker=productsCache.map(p=>`<label class="combo-product-choice"><input class="offer-product-check" type="checkbox" value="${esc(p.id)}" ${chosen.includes(String(p.id))?'checked':''}><img src="${esc(p.image||'')}" alt="" onerror="this.style.visibility='hidden'"><span><b>${esc(p.name)}</b><small>${money(p.price)} · Stock ${Number(p.stock||0)}</small></span></label>`).join('');
  const types=['Combo Deals','Flash Sale','Big Discount','Special Offers','Limited-Time Deals','Best Deals','Clearance Sale'];
  return `<div class="form-grid">
    <label>Offer title<input id="offerTitle" value="${esc(o.title||'')}" placeholder="Weekend Combo Deal" required></label>
    <label>Offer type<select id="offerType">${types.map(t=>`<option ${o.offer_type===t?'selected':''}>${t}</option>`).join('')}</select></label>
    <label>Discount percent<input id="offerDiscount" type="number" min="0" max="100" value="${Number(o.discount_percent||0)}"></label>
    <label>Combo price (৳)<input id="offerComboPrice" type="number" min="0" step="1" value="${o.combo_price??''}"></label>
    <div class="full"><label for="offerCoverImage">Offer cover image</label><input id="offerCoverImage" type="file" accept="image/*"><small>Choose a clear image for the offer card. ${o.cover_image?'An existing cover image is saved.':''}</small><div id="offerCoverPreview" class="offer-cover-preview">${o.cover_image?`<img src="${esc(o.cover_image)}" alt="Current offer cover">`:'No cover selected yet.'}</div></div>
    <div class="full"><label>Products included in this offer</label><input id="offerProductSearch" class="input" type="search" placeholder="Search products by name..." oninput="filterOfferProducts(this.value)"><div class="combo-product-picker" id="comboProductPicker">${picker||'<p>No products found. Add products first.</p>'}</div><small>For a Combo Deal, select at least two products.</small></div>
    <label>Starts at (optional)<input id="offerStarts" type="datetime-local" value="${offerDateInput(o.starts_at)}"></label>
    <label>Ends at (optional)<input id="offerEnds" type="datetime-local" value="${offerDateInput(o.ends_at)}"></label>
    <label class="full">Description<textarea id="offerDescription" rows="3">${esc(o.description||'')}</textarea></label>
    <label class="full admin-checkline"><input id="offerActive" type="checkbox" ${o.active!==false?'checked':''}> Offer is active (visible on the website)</label>
  </div><div class="btn-row"><button class="btn muted" onclick="closeModal()">Cancel</button><button class="btn primary" id="saveOfferBtn" onclick="saveOffer()">Save Offer</button></div>`;
}
function filterOfferProducts(query){
  const q=String(query||'').toLowerCase();
  document.querySelectorAll('.combo-product-choice').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q)?'flex':'none'});
}
function addOffer(){editingOfferId=null;openModal('Create Offer',offerForm())}
function editOffer(i){const o=offersCache[i];if(!o)return;editingOfferId=o.id;openModal('Edit Offer',offerForm(o))}
async function saveOffer(){
  const title=$('offerTitle')?.value.trim();
  if(!title){alert('Offer title is required.');return}
  const type=$('offerType').value;
  const starts=$('offerStarts')?.value,ends=$('offerEnds')?.value;
  if(starts&&ends&&new Date(ends)<=new Date(starts)){alert('End time must be after start time.');return}
  const pct=Number($('offerDiscount')?.value||0);
  if(!Number.isFinite(pct)||pct<0||pct>100){alert('Discount must be between 0 and 100.');return}
  const productIds=[...document.querySelectorAll('.offer-product-check:checked')].map(x=>x.value);
  if(type==='Combo Deals'&&productIds.length<2){alert('Select at least two products for a Combo Deal.');return}
  const comboPrice=$('offerComboPrice').value?Number($('offerComboPrice').value):null;
  if(comboPrice!==null&&(!Number.isFinite(comboPrice)||comboPrice<0)){alert('Enter a valid combo price.');return}
  if(type==='Combo Deals'&&(!comboPrice||comboPrice<=0)){alert('Enter a valid combo price.');return}
  const payload={title,offer_type:type,description:$('offerDescription').value.trim(),discount_percent:pct,combo_price:comboPrice,product_ids:productIds,starts_at:starts?new Date(starts).toISOString():null,ends_at:ends?new Date(ends).toISOString():null,active:$('offerActive').checked};
  const btn=$('saveOfferBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    let file=$('offerCoverImage')?.files?.[0];
    if(file){
      if(file.size>25*1048576)throw new Error('Image is too large (max 25 MB).');
      file=await prepareImage(file);
      const path=`offers/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const {error:upErr}=await sb.storage.from(BUCKET).upload(path,file,{upsert:true,contentType:file.type});
      if(upErr)throw upErr;
      payload.cover_image=sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
    if(editingOfferId){
      const existing=offersCache.find(x=>String(x.id)===String(editingOfferId));
      if(!payload.cover_image&&existing?.cover_image)payload.cover_image=existing.cover_image;
    }
    const q=editingOfferId?sb.from('offers').update(payload).eq('id',editingOfferId):sb.from('offers').insert(payload);
    const {error}=await q;
    if(error)throw error;
    const {data,error:e}=await sb.from('offers').select('*').order('created_at',{ascending:false});
    if(e)throw e;
    offersCache=data||[];
    closeModal();render();
    alert('Offer saved.');
  }catch(e){
    showError(e);
    if(btn){btn.disabled=false;btn.textContent='Save Offer'}
  }
}
async function deleteOffer(i){
  const o=offersCache[i];if(!o)return;
  if(!confirm(`Delete offer "${o.title}"?`))return;
  try{
    const {error}=await sb.from('offers').delete().eq('id',o.id);
    if(error)throw error;
    offersCache=offersCache.filter(x=>x.id!==o.id);
    render();
  }catch(e){showError(e)}
}

/* =========================================================
   START
========================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.nav[data-page],.nav[data-section],.subnav-item').forEach(btn=>{
    btn.addEventListener('click',()=>go(btn.dataset.page||btn.dataset.section))
  });

  $('importFile')?.addEventListener('change',importData);
  $('loginPassword')?.addEventListener('keydown',e=>{
    if(e.key==='Enter')login()
  });
  $('loginPass')?.addEventListener('keydown',e=>{
    if(e.key==='Enter')login()
  });
  $('modal')?.addEventListener('click',e=>{
    if(e.target.id==='modal')closeModal()
  });

  init()
});

async function init(){
  try{
    const ok=await checkAdmin();
    if(!ok)return;

    showApp();
    await loadCloud();
    await loadPaymentSettingsFull();
    await loadStoreSettings();
    render()
  }catch(e){
    showError(e)
  }
}

/* =========================================================
   GLOBAL FUNCTIONS FOR INLINE BUTTONS
========================================================= */

window.$=$;
window.login=login;
window.logout=logout;
window.go=go;
window.render=render;

window.closeModal=closeModal;
window.openModal=openModal;

window.addProduct=addProduct;
window.editProduct=editProduct;
window.saveProduct=saveProduct;
window.deleteProduct=deleteProduct;

window.viewOrder=viewOrder;
window.updateOrderStatus=updateOrderStatus;
window.filterOrders=filterOrders;
window.exportOrdersCSV=exportOrdersCSV;

window.addCategory=addCategory;
window.saveCategory=saveCategory;
window.deleteCategory=deleteCategory;

window.refreshProducts=refreshProducts;
window.refreshOrders=refreshOrders;
window.refreshDashboard=refreshDashboard;

window.whatsappOrder=whatsappOrder;
window.addOffer=addOffer;
window.editOffer=editOffer;
window.saveOffer=saveOffer;
window.deleteOffer=deleteOffer;
window.filterOfferProducts=filterOfferProducts;

window.refreshDeliverySettings=refreshDeliverySettings;
window.saveDeliverySettings=saveDeliverySettings;

window.toggleSidebar=toggleSidebar;
window.toggleSide=toggleSidebar;
window.toggleCatalog=toggleCatalog;
window.exportData=exportData;

window.payments=payments;
window.loadPaymentSettingsFull=loadPaymentSettingsFull;
window.savePaymentSettingsFull=savePaymentSettingsFull;
window.loadStoreSettings=loadStoreSettings;
window.saveStoreSettings=saveStoreSettings;
