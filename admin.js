/* Gadget Bazar BD Admin — Supabase V3 */
const SUPABASE_URL = 'https://vwwysrdqexjtlmpmevub.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = 'product-images';
let page = 'dashboard';
let productsCache = [];
let ordersCache = [];
let categoriesCache = [];
let deliveryCache = null;
let paymentsCache = null;
let settingsCache = null;
let currentEditImage = '';

function $(id){ return document.getElementById(id); }
function esc(s=''){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function money(v){ return '৳'+Number(v||0).toLocaleString('en-BD'); }
function setStatus(text, good=true){ const e=$('connectionStatus'); if(e){ e.textContent=(good?'● ':'● ')+text; e.style.color=good?'#4ade80':'#fb7185'; } }
function showError(e){ console.error(e); alert(e?.message || String(e) || 'Something went wrong'); }

async function login(){
  const email=$('loginUser').value.trim(), password=$('loginPass').value;
  if(!email || !password){ alert('Email and password are required'); return; }
  const btn=document.querySelector('#login button'); if(btn) btn.disabled=true;
  try{
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error) throw error;
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    setStatus('Supabase Connected',true); await loadCloud(); render();
  }catch(e){ alert('Login failed: '+(e.message||e)); }
  finally{ if(btn) btn.disabled=false; }
}
async function logout(){ await sb.auth.signOut(); location.reload(); }
function toggleSide(){ document.querySelector('.sidebar').classList.toggle('open'); }

async function loadCloud(){
  try{
    const [pr,or,ca,de,pa,st]=await Promise.all([
      sb.from('products').select('*').order('created_at',{ascending:false}),
      sb.from('orders').select('*').order('created_at',{ascending:false}),
      sb.from('categories').select('*').order('name'),
      sb.from('delivery_settings').select('*').limit(1),
      sb.from('payment_settings').select('*').limit(1),
      sb.from('store_settings').select('*').limit(1)
    ]);
    if(pr.error) throw pr.error; productsCache=pr.data||[];
    if(or.error) throw or.error; ordersCache=or.data||[];
    if(!ca.error) categoriesCache=(ca.data||[]).map(x=>x.name).filter(Boolean);
    if(!de.error) deliveryCache=(de.data||[])[0]||null;
    if(!pa.error) paymentsCache=(pa.data||[])[0]||null;
    if(!st.error) settingsCache=(st.data||[])[0]||null;
    setStatus('Supabase Connected',true);
  }catch(e){ setStatus('Connection error',false); throw e; }
}

function render(){
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('pageTitle').textContent=page[0].toUpperCase()+page.slice(1);
  $('pageSub').textContent=page==='dashboard'?'Live Supabase data':'Manage your store';
  let html='';
  if(page==='dashboard') html=dashboard();
  if(page==='products') html=products();
  if(page==='orders') html=orders();
  if(page==='customers') html=customers();
  if(page==='categories') html=categories();
  if(page==='delivery') html=delivery();
  if(page==='payments') html=payments();
  if(page==='settings') html=settings();
  $('content').innerHTML=html;
}
function setupNav(){ document.querySelectorAll('.nav').forEach(b=>b.onclick=async()=>{page=b.dataset.page; if(page==='orders'||page==='dashboard'||page==='customers') await refreshOrders(); render(); document.querySelector('.sidebar').classList.remove('open');}); }
async function refreshOrders(){ const {data,error}=await sb.from('orders').select('*').order('created_at',{ascending:false}); if(error) throw error; ordersCache=data||[]; }

function dashboard(){
  const sales=ordersCache.reduce((a,o)=>a+Number(o.total||0),0), pending=ordersCache.filter(o=>(o.status||'Pending')==='Pending').length;
  return `<div class="cards"><div class="card stat"><div><div class="label">Total Products</div><div class="value">${productsCache.length}</div></div><div class="ico">▣</div></div><div class="card stat"><div><div class="label">Total Orders</div><div class="value">${ordersCache.length}</div></div><div class="ico">▤</div></div><div class="card stat"><div><div class="label">Pending Orders</div><div class="value">${pending}</div></div><div class="ico">◷</div></div><div class="card stat"><div><div class="label">Total Sales</div><div class="value">${money(sales)}</div></div><div class="ico">৳</div></div></div><div class="grid2"><div class="card"><div class="section-head"><h3>Store Connection</h3></div><p class="label">Products, orders and product images are now connected to Supabase.</p><p class="label">Customer website sync will be connected next.</p></div><div class="card"><div class="section-head"><h3>Recent Orders</h3><button class="btn muted" onclick="page='orders';render()">View all</button></div><div class="mini-list">${ordersCache.slice(0,5).map(o=>`<div class="mini-item"><span>${esc(o.order_id||o.orderId||o.id||'Order')}</span><b>${money(o.total)}</b></div>`).join('')||'<div class="empty">No orders yet</div>'}</div></div></div>`;
}
function products(){ return `<div class="section-head"><h3>Products <small style="color:#8ea6c1;font-weight:500">(${productsCache.length})</small></h3><div class="toolbar"><input class="input" id="psearch" placeholder="Search products..." oninput="filterProducts()"><select class="select" id="stockfilter" onchange="filterProducts()"><option value="all">All stock</option><option value="low">Low stock</option><option value="off">Disabled</option></select><button class="btn primary" onclick="openProduct()">＋ Add Product</button></div></div><div id="productGrid" class="product-grid">${productCards(productsCache)}</div>`; }
function productCards(arr){ if(!arr.length)return '<div class="empty">No products found</div>'; return arr.map(p=>`<div class="product-card"><img src="${esc(p.image||'https://placehold.co/800x500?text=Product')}" onerror="this.src='https://placehold.co/800x500?text=Product'"><div class="product-info"><h4>${esc(p.name||'Unnamed')} ${p.active===false?'<span class="pill red">Disabled</span>':''}</h4><p>${esc(p.category||'')} · Stock: ${p.stock??0}</p><div class="price">${money(p.price)}</div><div class="actions" style="margin-top:10px"><button onclick="openProduct('${esc(p.id)}')">Edit</button><button onclick="toggleProduct('${esc(p.id)}',${p.active!==false})">${p.active===false?'Enable':'Disable'}</button><button onclick="deleteProduct('${esc(p.id)}')">Delete</button></div></div></div>`).join(''); }
function filterProducts(){ const q=($('psearch')?.value||'').toLowerCase(), f=$('stockfilter')?.value||'all'; const a=productsCache.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q)).filter(p=>f==='all'||(f==='low'&&Number(p.stock)<5)||(f==='off'&&p.active===false)); $('productGrid').innerHTML=productCards(a); }

function openProduct(id=''){
  const p=productsCache.find(x=>x.id===id)||{id:'',name:'',category:categoriesCache[0]||'Audio',price:'',discount:0,stock:0,image:'',description:'',active:true,featured:false};
  currentEditImage=p.image||'';
  $('modalTitle').textContent=id?'Edit Product':'Add Product';
  $('modalBody').innerHTML=`<div class="form-grid"><label class="full">Product Image<div style="padding:14px;border:1px dashed #315271;border-radius:12px;background:#08182b"><input id="f_image_file" type="file" accept="image/*" onchange="readProductImage(event)"><img id="image_preview" src="${esc(p.image||'')}" style="display:${p.image?'block':'none'};width:100%;height:180px;object-fit:contain;margin-top:10px;border-radius:10px;background:#071426"><small style="display:block;color:#8ea6c1;margin-top:8px">Choose a product photo. It will be uploaded to Supabase Storage.</small></div></label><label>Product Name<input id="f_name" value="${esc(p.name||'')}"></label><label>Category<select id="f_cat">${categoriesCache.map(c=>`<option ${c===p.category?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Price<input id="f_price" type="number" value="${p.price??0}"></label><label>Discount Price<input id="f_discount" type="number" value="${p.discount??0}"></label><label>Stock Quantity<input id="f_stock" type="number" value="${p.stock??0}"></label><label class="full">Description<textarea id="f_desc">${esc(p.description||'')}</textarea></label></div><div class="btn-row"><button class="btn muted" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveProduct('${esc(id)}')">Save Product</button></div>`;
  $('modal').classList.remove('hidden');
}
async function readProductImage(event){ const file=event.target.files[0]; if(!file)return; if(!file.type.startsWith('image/')){alert('Please choose an image');return;} if(file.size>5*1024*1024){alert('Please choose an image under 5 MB.');event.target.value='';return;} currentEditImage={file}; const reader=new FileReader(); reader.onload=()=>{const img=$('image_preview');img.src=reader.result;img.style.display='block';}; reader.readAsDataURL(file); }
async function uploadImage(file,id){ const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,''); const path=`products/${id}_${Date.now()}.${ext}`; const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:true,contentType:file.type}); if(error) throw error; const {data}=sb.storage.from(BUCKET).getPublicUrl(path); return data.publicUrl; }
async function saveProduct(id){
  const name=$('f_name').value.trim(); if(!name){alert('Product name is required');return;}
  const payload={name,category:$('f_cat').value,price:Number($('f_price').value||0),discount:Number($('f_discount').value||0),stock:Number($('f_stock').value||0),description:$('f_desc').value.trim(),active:true};
  if(id){ const old=productsCache.find(p=>p.id===id); payload.active=old?.active!==false; payload.featured=old?.featured===true; }
  try{
    const saveBtn=document.querySelector('#modalBody .btn.primary'); if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Saving...';}
    if(currentEditImage?.file) payload.image=await uploadImage(currentEditImage.file,id||'new'); else if(typeof currentEditImage==='string') payload.image=currentEditImage;
    let res;
    if(id) res=await sb.from('products').update(payload).eq('id',id).select().single();
    else res=await sb.from('products').insert(payload).select().single();
    if(res.error) throw res.error;
    await loadCloud(); closeModal(); render(); alert('Product saved successfully');
  }catch(e){showError(e);}
}
async function toggleProduct(id,current){ try{const {error}=await sb.from('products').update({active:!current}).eq('id',id);if(error)throw error;await loadCloud();render();}catch(e){showError(e);} }
async function deleteProduct(id){ if(!confirm('Delete this product?'))return; try{const {error}=await sb.from('products').delete().eq('id',id);if(error)throw error;await loadCloud();render();}catch(e){showError(e);} }

function orders(){ const rows=ordersCache.map((o,i)=>`<tr><td>${esc(o.order_id||o.orderId||o.id||'#'+(i+1))}</td><td>${esc(o.customer_name||o.customer?.name||o.name||'—')}</td><td>${esc(o.phone||o.customer_phone||o.customer?.phone||'—')}</td><td>${money(o.total)}</td><td>${esc(o.payment_method||o.paymentMethod||'COD')}</td><td><span class="pill ${o.status==='Delivered'?'green':o.status==='Cancelled'?'red':o.status==='Pending'?'yellow':'blue'}">${esc(o.status||'Pending')}</span></td><td class="actions"><button onclick="viewOrder(${i})">View</button><button onclick="statusOrder(${i})">Status</button></td></tr>`).join(''); return `<div class="section-head"><h3>Orders</h3><div class="toolbar"><button class="btn muted" onclick="refreshOrders().then(render).catch(showError)">↻ Refresh</button></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty">No orders yet</td></tr>'}</tbody></table></div>`; }
function viewOrder(i){const o=ordersCache[i];$('modalTitle').textContent='Order '+(o.order_id||o.orderId||o.id||'');$('modalBody').innerHTML=`<div class="card"><b>Customer</b><p>${esc(o.customer_name||o.customer?.name||o.name||'')} · ${esc(o.phone||o.customer_phone||o.customer?.phone||'')}</p><p>${esc(o.district||o.customer?.district||'')}, ${esc(o.upazila||o.customer?.upazila||'')}</p><p>${esc(o.address||o.customer?.address||'')}</p><hr><b>Payment:</b> ${esc(o.payment_method||o.paymentMethod||'COD')} ${o.transaction_id?' · TXN: '+esc(o.transaction_id):''}<p><b>Total:</b> ${money(o.total)}</p><p><b>Note:</b> ${esc(o.note||'—')}</p></div><div class="btn-row"><button class="btn primary" onclick="statusOrder(${i})">Change Status</button></div>`;$('modal').classList.remove('hidden');}
async function statusOrder(i){const allowed=['Pending','Confirmed','Processing','Shipped','Delivered','Cancelled'];const current=ordersCache[i].status||'Pending';const s=prompt('Status: '+allowed.join(', '),current);if(!allowed.includes(s)||s===current)return;try{const id=ordersCache[i].id;const {error}=await sb.from('orders').update({status:s}).eq('id',id);if(error)throw error;await refreshOrders();closeModal();render();}catch(e){showError(e);}}
function customers(){let map={};ordersCache.forEach(o=>{let n=o.customer_name||o.customer?.name||o.name||'Unknown';map[n]??={name:n,phone:o.phone||o.customer_phone||o.customer?.phone||'',orders:0,spent:0};map[n].orders++;map[n].spent+=Number(o.total||0)});return `<div class="section-head"><h3>Customers</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th><th>Total Spent</th></tr></thead><tbody>${Object.values(map).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${c.orders}</td><td>${money(c.spent)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No customers yet</td></tr>'}</tbody></table></div>`;}
function categories(){return `<div class="grid2"><div class="card"><div class="section-head"><h3>Categories</h3><button class="btn primary" onclick="addCategory()">＋ Add</button></div><div class="mini-list">${categoriesCache.map(c=>`<div class="mini-item"><span>${esc(c)}</span></div>`).join('')||'<div class="empty">No categories</div>'}</div></div><div class="card"><h3>Categories are stored in Supabase</h3><p class="label">Category editing will be added after the live product sync is confirmed.</p></div></div>`;}
async function addCategory(){const name=prompt('Category name');if(!name?.trim())return;try{const {error}=await sb.from('categories').insert({name:name.trim()});if(error)throw error;await loadCloud();render();}catch(e){showError(e);}}
function delivery(){const d=deliveryCache||{};return `<div class="card"><div class="section-head"><h3>Delivery Settings</h3></div><p class="label">Live settings are loaded from Supabase.</p><div class="form-grid"><label>Dhaka City Fee<input id="d_dhaka" type="number" value="${d.dhaka??60}"></label><label>Nearby Dhaka Fee<input id="d_nearby" type="number" value="${d.nearby??100}"></label><label>Outside Dhaka Fee<input id="d_outside" type="number" value="${d.outside??130}"></label></div><div class="btn-row"><button class="btn primary" onclick="saveDelivery()">Save Delivery Settings</button></div></div>`;}
async function saveDelivery(){if(!deliveryCache){alert('Delivery settings row not found.');return;}const patch={dhaka:Number($('d_dhaka').value),nearby:Number($('d_nearby').value),outside:Number($('d_outside').value)};try{const {error}=await sb.from('delivery_settings').update(patch).eq('id',deliveryCache.id);if(error)throw error;await loadCloud();alert('Saved');render();}catch(e){showError(e);}}
function payments(){const p=paymentsCache||{};return `<div class="card"><div class="form-grid"><label>Cash on Delivery<select id="pay_cod"><option value="true" ${p.cod!==false?'selected':''}>Enabled</option><option value="false" ${p.cod===false?'selected':''}>Disabled</option></select></label><label>bKash<select id="pay_bk"><option value="true" ${p.bkash!==false?'selected':''}>Enabled</option><option value="false" ${p.bkash===false?'selected':''}>Disabled</option></select></label><label>Nagad<select id="pay_ng"><option value="true" ${p.nagad!==false?'selected':''}>Enabled</option><option value="false" ${p.nagad===false?'selected':''}>Disabled</option></select></label><label>bKash Number<input id="pay_bn" value="${esc(p.bkash_number||p.bkashNumber||'')}"></label><label>Nagad Number<input id="pay_nn" value="${esc(p.nagad_number||p.nagadNumber||'')}"></label></div><div class="btn-row"><button class="btn primary" onclick="savePayments()">Save Payment Settings</button></div></div>`;}
async function savePayments(){if(!paymentsCache){alert('Payment settings row not found.');return;}const patch={cod:$('pay_cod').value==='true',bkash:$('pay_bk').value==='true',nagad:$('pay_ng').value==='true'};if('bkash_number' in paymentsCache)patch.bkash_number=$('pay_bn').value;if('nagad_number' in paymentsCache)patch.nagad_number=$('pay_nn').value;try{const {error}=await sb.from('payment_settings').update(patch).eq('id',paymentsCache.id);if(error)throw error;await loadCloud();alert('Saved');render();}catch(e){showError(e);}}
function settings(){const s=settingsCache||{};return `<div class="card"><div class="form-grid"><label>Store Name<input id="s_store" value="${esc(s.store_name||s.store||'Gadget Bazar BD')}"></label><label>Phone<input id="s_phone" value="${esc(s.phone||'')}"></label><label>Email<input id="s_email" value="${esc(s.email||'')}"></label><label class="full">Description<textarea id="s_desc">${esc(s.description||'')}</textarea></label></div><div class="btn-row"><button class="btn primary" onclick="saveSettings()">Save Settings</button></div></div>`;}
async function saveSettings(){if(!settingsCache){alert('Store settings row not found.');return;}const patch={};if('store_name' in settingsCache)patch.store_name=$('s_store').value;else if('store' in settingsCache)patch.store=$('s_store').value;if('phone' in settingsCache)patch.phone=$('s_phone').value;if('email' in settingsCache)patch.email=$('s_email').value;if('description' in settingsCache)patch.description=$('s_desc').value;try{const {error}=await sb.from('store_settings').update(patch).eq('id',settingsCache.id);if(error)throw error;await loadCloud();alert('Saved');render();}catch(e){showError(e);}}
function closeModal(){$('modal').classList.add('hidden');}
function exportData(){const data={products:productsCache,orders:ordersCache,categories:categoriesCache};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='gadget-bazar-supabase-export.json';a.click();}

$('importFile').onchange=()=>alert('Import is disabled in cloud mode. Use Supabase data directly.');
setupNav();

(async()=>{
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(session){$('login').classList.add('hidden');$('app').classList.remove('hidden');setStatus('Supabase Connected',true);await loadCloud();render();}
    else setStatus('Login required',false);
  }catch(e){console.error(e);setStatus('Connection error',false);}
})();
