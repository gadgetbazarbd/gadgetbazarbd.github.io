/* =========================================================
   PABOO — FINAL ADMIN PANEL
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
const selOrders=new Set();
let categoriesCache=[];
let offersCache=[];
let editingOfferId=null;
let deliverySettingsCache=null;
let storeSettingsCache={store_name:'Paboo',phone:'',email:'',address:'',support_hours:''};
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
/* ---- Image optimiser -------------------------------------------------
   Product photos : fitted into a 1000x1000 square (nothing is cut off, white padding),
                    saved as WebP and squeezed to roughly 100-150 KB.
   Other images   : only scaled down to maxSide and converted to WebP.
   IMG_SQUARE_MODE: 'fit'  = whole photo visible (recommended for clothes)
                    'crop' = centre-crop to fill the square                          */
const IMG_SQUARE=1000,IMG_MAX_KB=150,IMG_SQUARE_MODE='fit';
async function prepareImage(file,opts){
  opts=typeof opts==='number'?{maxSide:opts}:(opts||{});
  if(!file||!/^image\//.test(file.type)||/svg|gif/.test(file.type))return file;
  try{
    let bmp;
    try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){bmp=await createImageBitmap(file)}
    const c=document.createElement('canvas'),ctx=c.getContext('2d');
    ctx.imageSmoothingQuality='high';
    if(opts.square){
      const S=opts.square;c.width=S;c.height=S;
      ctx.fillStyle='#fff';ctx.fillRect(0,0,S,S);
      const fit=(opts.mode||IMG_SQUARE_MODE)==='crop'?Math.max(S/bmp.width,S/bmp.height):Math.min(S/bmp.width,S/bmp.height);
      const dw=bmp.width*fit,dh=bmp.height*fit;
      ctx.drawImage(bmp,(S-dw)/2,(S-dh)/2,dw,dh);
    }else{
      const maxSide=opts.maxSide||1200,scale=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
      c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));
      ctx.drawImage(bmp,0,0,c.width,c.height);
    }
    const toBlob=(type,q)=>new Promise(res=>c.toBlob(res,type,q));
    let q=opts.square?0.86:0.82,blob=await toBlob('image/webp',q),ext='webp';
    if(!blob||blob.type!=='image/webp'){            /* very old browsers: JPEG fallback */
      ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
      ext='jpg';q=0.85;blob=await toBlob('image/jpeg',q);
      while(opts.square&&blob&&blob.size>IMG_MAX_KB*1024&&q>0.5){q-=0.07;blob=await toBlob('image/jpeg',q)}
    }else if(opts.square){
      while(blob&&blob.size>IMG_MAX_KB*1024&&q>0.42){q-=0.06;blob=await toBlob('image/webp',q)}
    }
    if(!blob)return file;
    if(!opts.square&&blob.size>=file.size&&bmp.width<=(opts.maxSide||1200)&&bmp.height<=(opts.maxSide||1200))return file;
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.'+ext,{type:blob.type});
  }catch(e){console.warn('Image optimisation skipped',e);return file}
}
function previewProductImages(input){
  const box=$('productImagePreview');if(!box)return;
  const files=[...(input.files||[])];
  box.innerHTML=files.map(f=>`<div style="display:inline-block;margin:6px 8px 0 0;text-align:center;font-size:11px"><img src="${URL.createObjectURL(f)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:10px;display:block"><span>${(f.size/1048576).toFixed(1)} MB</span></div>`).join('')+(files.length?`<div style="font-size:12px;margin-top:6px;color:#64748b">Photos are automatically resized and compressed when you save.</div>`:'');
}
async function uploadImage(file,id,opts){
  if(!file)return '';
  if(file.size>25*1048576)throw new Error('Image is too large (max 25 MB): '+file.name);
  file=await prepareImage(file,opts);
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
  await loadCosts();
  await loadProtect();
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

  return `<div class="section-head"><div><h3>Dashboard</h3><p>Paboo overview</p></div><button class="btn muted" onclick="refreshDashboard()">↻ Refresh</button></div>
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
  curDept='';
  return `<div class="section-head"><div><h3>Products</h3><p>Manage your product catalog</p></div><div class="toolbar"><button class="btn primary" onclick="addProduct()">＋ Add Product</button><button class="btn muted" onclick="csvImportOpen()">⬆ CSV Import</button><button class="btn muted" onclick="csvExport()">⬇ CSV Export</button><button class="btn muted" onclick="refreshProducts().then(render).catch(showError)">↻ Refresh</button></div></div>
  <div class="filters"><div class="search-wrap"><input class="input" id="productSearch" placeholder="Search products..." oninput="filterProducts()"></div><select class="select" id="productCategoryFilter" onchange="filterProducts()"><option value="">All Categories</option>${categoriesCache.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select><select class="select" id="productStockFilter" onchange="filterProducts()"><option value="">All Stock</option><option value="in">In Stock</option><option value="out">Out of Stock</option></select></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Price</th><th>Buy → Profit</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody id="productRows">${productRows(productsCache)}</tbody></table></div>`
}
function productRows(list){
  if(!list.length)return `<tr><td colspan="8" class="empty">No products found</td></tr>`;
  return list.map(p=>`<tr><td>${p.image?`<img class="thumb" src="${esc(p.image)}" alt="">`:'—'}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.category||'—')} <small title="${deptOf(p)}">${deptOf(p)==='clothing'?'👕':'🎧'}</small></td><td>${money(p.price)}</td><td>${marginCell(p)}</td><td>${Number(p.stock||0)}</td><td><span class="pill ${p.active!==false?'green':'red'}">${p.active!==false?'Active':'Inactive'}</span></td><td class="actions"><button class="btn primary" onclick="openPostBuilder(${productsCache.indexOf(p)})">📣 Post</button><button class="btn muted" onclick="editProduct(${productsCache.indexOf(p)})">Edit</button><button class="btn muted" title="Copy product" onclick="copyProduct(${productsCache.indexOf(p)})">⧉ Copy</button><button class="btn danger" onclick="deleteProduct(${productsCache.indexOf(p)})">Delete</button></td></tr>`).join('')
}
function filterProducts(){
  const q=($('productSearch')?.value||'').toLowerCase().trim();
  const cat=$('productCategoryFilter')?.value||'';
  const stock=$('productStockFilter')?.value||'';
  const list=productsCache.filter(p=>{
    const text=`${p.name||''} ${p.category||''}`.toLowerCase();
    const stockOk=!stock||(stock==='in'?Number(p.stock||0)>0:Number(p.stock||0)<=0);
    return text.includes(q)&&(!cat||p.category===cat)&&stockOk&&(!curDept||deptOf(p)===curDept);
  });
  const rows=$('productRows');if(rows)rows.innerHTML=productRows(list)
}

function addProduct(d){copySrc=null;newDept=(typeof d==='string'&&d)?d:(curDept||'gadget');editingProductId=null;openModal('Add Product',productForm());deptChange()}
function editProduct(i){const p=productsCache[i];if(!p)return;editingProductId=p.id;copySrc=null;openModal('Edit Product',productForm(p));deptChange()}
function saleDt(v){if(!v)return '';const d=new Date(v);if(isNaN(d))return '';return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function productForm(p={}){
  const dept=p.id?deptOf(p):newDept;clothInit(p);
  const opts=categoriesCache.map(c=>`<option value="${esc(c.name)}" ${p.category===c.name?'selected':''}>${esc(c.name)}</option>`).join('');
  let gallery=p.images??p.gallery??p.image_urls??[];
  if(typeof gallery==='string'){try{gallery=JSON.parse(gallery)}catch(e){gallery=[]}}
  if(!Array.isArray(gallery))gallery=[];
  const currentImages=[...new Set([p.image,...gallery].filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))];
  const specs=p.specifications??p.specs??'';
  const specsText=typeof specs==='string'?specs:(Array.isArray(specs)?specs.map(x=>typeof x==='object'&&x?`${x.name||x.label||'Feature'}: ${x.value||x.detail||''}`:String(x)).join('\n'):JSON.stringify(specs,null,2));
  return `<div class="form-grid">
    <label>Product Name<input id="productName" value="${esc(p.name||'')}" placeholder="e.g. TWS AirBuds Pro" required></label>
    <label>Department (বিভাগ)<select id="productDept" onchange="deptChange()"><option value="gadget" ${dept==='gadget'?'selected':''}>🎧 গ্যাজেট</option><option value="clothing" ${dept==='clothing'?'selected':''}>👕 পোশাক</option></select></label>
    <label>Category<span class="cat-wrap"><input id="productCategory" autocomplete="off" value="${esc(p.category||'')}" placeholder="Select or type a new category" onfocus="showCatSuggest()" oninput="showCatSuggest()" onblur="setTimeout(hideCatSuggest,180)"><div id="catSuggest" class="cat-suggest hidden"></div></span></label>
    <label>Price (৳)<input id="productPrice" type="number" min="0" value="${Number(p.price||0)}"></label>
    <label>Discount (%)<input id="productDiscount" type="number" min="0" max="100" value="${Number(p.discount||0)}"></label>
    <label>Flash sale starts (optional)<input id="productSaleStart" type="datetime-local" value="${saleDt(p.sale_starts_at)}"></label>
    <label>Flash sale ends (optional)<input id="productSaleEnd" type="datetime-local" value="${saleDt(p.sale_ends_at)}"></label>
    <p class="hint" style="grid-column:1/-1;margin:-4px 0 4px;font-size:12px;color:#64748b">⚡ Set both times to run a timed Flash Sale. The Discount (%) above applies only inside this window; before and after it the full price is charged. Leave both blank for a normal always-on discount. (Run 5_flash_sale.sql once first.)</p>
    <label>Buying price ৳ (private)<input id="productCost" type="number" min="0" step="any" value="${costOf(p.id)||''}" placeholder="what you paid"><small>Only you can see this. Used for profit reports.</small></label>
    <label id="stockLbl">Stock<input id="productStock" type="number" min="0" value="${Number(p.stock||0)}"></label>
    <div class="full" id="clothBox" style="display:none">${clothHtml()}</div>
    <label id="gadgetVarLbl" style="grid-column:1/-1">Variants — colour / size (optional)<textarea id="productVariants" rows="4" placeholder="One per line:  Name | Stock | Price (optional)&#10;Black | 5&#10;White | 3 | 1200&#10;Size L | 10">${esc(variantsToText(p.variants))}</textarea><small>If you add variants, the total Stock is calculated automatically from them. Customers see these only when <b>Settings &gt; Product variants</b> is ON. Leave empty for a normal product.</small></label>
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
function variantsToText(v){if(typeof v==='string'){try{v=JSON.parse(v)}catch(e){v=[]}}if(!Array.isArray(v))return'';return v.map(x=>[x.name,Number(x.stock)||0,Number(x.price)>0?Number(x.price):''].join(' | ').replace(/ \| $/,'')).join('\n');}
function parseVariants(t){const out=[];const seen=new Set();for(const line of String(t||'').split(/\r?\n/)){const l=line.trim();if(!l)continue;const [n,st,pr]=l.split('|').map(x=>x.trim());if(!n)continue;const stock=Math.max(0,Math.floor(Number(st||0)));const price=Number(pr||0);if(!Number.isFinite(stock)||(pr&&!(price>=0)))throw new Error('Variant line is not valid: "'+l+'". Use: Name | Stock | Price(optional)');if(seen.has(n.toLowerCase()))throw new Error('Variant name repeated: '+n);seen.add(n.toLowerCase());const v={name:n,stock};if(price>0)v.price=price;out.push(v);}return out;}
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
    const imgSrc=old||copySrc;
    let images=imgSrc?.images??imgSrc?.gallery??imgSrc?.image_urls??[];
    if(typeof images==='string'){try{images=JSON.parse(images)}catch(e){images=[]}}
    if(!Array.isArray(images))images=[];
    images=[...new Set([imgSrc?.image,...images].filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))];
    const remove=new Set([...document.querySelectorAll('.remove-product-image:checked')].map(x=>x.value));
    images=images.filter(x=>!remove.has(x));
    for(const file of files){const url=await uploadImage(file,id,{square:IMG_SQUARE});if(url)images.push(url)}
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
    const dept=$('productDept')?.value==='clothing'?'clothing':'gadget';
    if(dept==='clothing'&&!hasDeptCol())throw new Error('Run 14_clothing.sql in Supabase > SQL Editor first (Update 14), then try again.');
    if(hasDeptCol())product.dept=dept;
    if(dept==='clothing'){
      const cc=clothCollect();
      if(!cc.variants.length)throw new Error('Add at least one colour or one size (turn a size ON) for a clothing product.');
      product.colors=cc.colors;product.size_chart=cc.size_chart;product.variants=cc.variants;
      product.stock=cc.variants.reduce((a,v)=>a+v.stock,0);
    }else if(hasDeptCol()&&old&&deptOf(old)==='clothing'){product.colors=null;product.size_chart=null;}
    if(dept!=='clothing'){
      const vars=parseVariants($('productVariants')?.value);
      if(vars.length||(old&&('variants' in old))){
        product.variants=vars;
        if(vars.length)product.stock=vars.reduce((a,v)=>a+v.stock,0);
      }
    }
    {
      const sv=$('productSaleStart')?.value,ev=$('productSaleEnd')?.value;
      if(sv&&ev&&new Date(ev)<=new Date(sv))throw new Error('Flash sale end time must be after the start time.');
      if(sv||ev||old&&('sale_ends_at' in old)){
        product.sale_starts_at=sv?new Date(sv).toISOString():null;
        product.sale_ends_at=ev?new Date(ev).toISOString():null;
      }
    }
    if(category){
      const hit=categoriesCache.find(c=>String(c.name).trim().toLowerCase()===category.toLowerCase());
      if(hit){product.category=hit.name}
      else{
        const slug=category.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||('cat-'+Date.now());
        const {error:ce}=await sb.from('categories').insert(hasDeptCol()?{name:category,slug,dept}:{name:category,slug});
        if(ce&&!/duplicate|23505/i.test((ce.code||'')+(ce.message||'')))throw ce;
        const cr=await sb.from('categories').select('*').order('name');
        if(!cr.error&&cr.data)categoriesCache=cr.data;
      }
    }
    const {error}=await sb.from('products').upsert(product,{onConflict:'id'});
    if(!error)await saveCost(id,$('productCost')?.value);
    if(error)throw error;
    await refreshProducts();closeModal();render();
    alert(isEdit?'Product updated successfully.':'Product added successfully.');
  }catch(e){
    showError(e);
    const btn=$('saveProductBtn');if(btn){btn.disabled=false;btn.textContent='Save Product'}
  }
}

/* =========================================================
   UPDATE 14: DEPARTMENTS (পোশাক / গ্যাজেট) + CLOTHING EDITOR
========================================================= */
let curDept='',newDept='gadget',clothState=null,ceUid=0;
const CE_SIZES=['S','M','L','XL','XXL'];
function hasDeptCol(){return productsCache.some(x=>'dept' in x)||categoriesCache.some(x=>'dept' in x)}
function deptOf(x){return x&&x.dept==='clothing'?'clothing':'gadget'}
function deptLabel(d){return d==='clothing'?'👕 পোশাক':'🎧 গ্যাজেট'}
function deptPage(d){
  curDept=d;
  const cats=categoriesCache.map((c,i)=>({c,i})).filter(x=>deptOf(x.c)===d);
  const list=productsCache.filter(p=>deptOf(p)===d);
  const note=hasDeptCol()?'':'<p class="hint" style="color:#b45309">⚠ Run <b>14_clothing.sql</b> in Supabase first, so the department can be saved.</p>';
  return `<div class="section-head"><div><h3>${deptLabel(d)}</h3><p>${d==='clothing'?'Clothing categories and products (colours, sizes, measurements)':'Gadget categories and products'}</p></div><div class="toolbar"><button class="btn primary" onclick="addProduct('${d}')">＋ Add Product</button><button class="btn muted" onclick="addCategory('${d}')">＋ Add Category</button></div></div>${note}
  <div class="dept-cats"><b>Categories</b><div class="dept-chips">${cats.length?cats.map(x=>`<span class="dept-chip">${esc(x.c.name)}<button type="button" title="Delete category" onclick="deleteCategory(${x.i})">×</button></span>`).join(''):'<span class="empty">No categories yet. Add one above.</span>'}</div></div>
  <div class="filters"><div class="search-wrap"><input class="input" id="productSearch" placeholder="Search products..." oninput="filterProducts()"></div><select class="select" id="productCategoryFilter" onchange="filterProducts()"><option value="">All Categories</option>${cats.map(x=>`<option value="${esc(x.c.name)}">${esc(x.c.name)}</option>`).join('')}</select><select class="select" id="productStockFilter" onchange="filterProducts()"><option value="">All Stock</option><option value="in">In Stock</option><option value="out">Out of Stock</option></select></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Price</th><th>Buy → Profit</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody id="productRows">${productRows(list)}</tbody></table></div>`;
}
function ceJson(v,d){if(typeof v!=='string')return v??d;try{return JSON.parse(v)}catch(e){return d}}
function clothInit(p){
  let colors=ceJson(p.colors,[]);if(!Array.isArray(colors))colors=[];
  let ch=ceJson(p.size_chart,null);if(!ch||typeof ch!=='object')ch=null;
  const cols=ch&&Array.isArray(ch.cols)&&ch.cols.length?ch.cols.map(String):['বুক','দৈর্ঘ্য','কাঁধ','হাতা'];
  const byS={};((ch&&ch.rows)||[]).forEach(r=>{if(r&&r.s)byS[r.s]={s:String(r.s),on:r.on!==false,v:cols.map((_,i)=>String(((r.v||[])[i])??''))}});
  const sizes=CE_SIZES.map((s,i)=>byS[s]||{s,on:!ch&&i<4,v:cols.map(()=>'')});
  Object.keys(byS).forEach(k=>{if(!CE_SIZES.includes(k))sizes.push(byS[k])});
  const cl=colors.filter(c=>c&&c.n).map(c=>({id:'c'+(++ceUid),n:String(c.n),h:/^#[0-9a-f]{6}$/i.test(c.h||'')?c.h:'#999999',i:/^https?:\/\//i.test(c.i||'')?c.i:''}));
  const stock={};
  (Array.isArray(ceJson(p.variants,[]))?ceJson(p.variants,[]):[]).forEach(v=>{if(!v||(!v.c&&!v.s))return;const c=cl.find(x=>x.n===v.c);stock[(c?c.id:'')+'|'+(v.s||'')]=Math.max(0,Math.floor(Number(v.stock)||0))});
  clothState={unit:ch&&ch.unit!=null?String(ch.unit):'ইঞ্চি',cols,sizes,colors:cl,stock};
}
function deptChange(){
  const d=$('productDept')?.value;const cl=d==='clothing';
  const box=$('clothBox');if(box)box.style.display=cl?'':'none';
  ['stockLbl','gadgetVarLbl'].forEach(id=>{const e=$(id);if(e)e.style.display=cl?'none':''});
}
function clothHtml(){
  return `<div class="cloth-ed"><h4>👕 পোশাকের রং, সাইজ ও মাপ</h4>
  <div class="ce-block"><b>১) রং (Colours)</b><small>নিচের রঙে চাপলেই যোগ হবে। প্রতি রঙের ছবি দিলে ওয়েবসাইটে রং বাছলে সেই ছবি দেখাবে (📷)।</small><div class="ce-pal">${CE_PAL.map((x,i)=>`<button type="button" class="ce-pbtn" title="${x[0]}" style="background:${x[1]}" onclick="ceAddPreset(${i})"></button>`).join('')}</div><div id="ceColors">${ceColorsHtml()}</div><button type="button" class="btn muted" onclick="ceAddColor()">＋ অন্য রং যোগ করুন</button></div>
  <div class="ce-block"><b>২) সাইজ ও মাপ</b><small>বাঁ দিকের টিক দিলে সাইজটি ওয়েবসাইটে দেখাবে। টিক তুললে লুকানো থাকবে।</small>
  <div class="ce-unit">টেমপ্লেট: <select id="ceTpl" onchange="ceApplyTpl(this.value)"><option value="">— একটি বেছে নিন —</option>${Object.keys(CE_TPL).map(k=>`<option value="${k}">${CE_TPL[k].label}</option>`).join('')}</select> <small>(নমুনা মাপ, ইঞ্চিতে। নিজের কাপড় মেপে বদলে নিন)</small></div>
  <div class="ce-unit">মাপের একক: <input id="ceUnit" value="${esc(clothState.unit)}" oninput="clothState.unit=this.value" placeholder="ইঞ্চি"></div>
  <div id="ceSizes" class="ce-scroll">${ceSizesHtml()}</div>
  <div class="ce-add"><input id="ceNewSize" placeholder="নতুন সাইজ (যেমন 30, 3XL)"><button type="button" class="btn muted" onclick="ceAddSize()">＋ সাইজ</button><button type="button" class="btn muted" onclick="ceAddCol()">＋ মাপের কলাম (যেমন গলা)</button></div></div>
  <div class="ce-block"><b>৩) স্টক (প্রতিটি রং ও সাইজের)</b> <button type="button" class="btn muted" style="padding:2px 10px" onclick="ceFillStock()">সব ঘরে একই সংখ্যা</button><div id="ceStock" class="ce-scroll">${ceStockHtml()}</div></div></div>`;
}
function ceColorsHtml(){
  const c=clothState.colors;if(!c.length)return '<div class="empty">কোনো রং নেই। রং না থাকলে শুধু সাইজ দিয়ে চলবে।</div>';
  return c.map((x,i)=>`<div class="ce-row"><input type="color" value="${esc(x.h)}" oninput="clothState.colors[${i}].h=this.value"><input value="${esc(x.n)}" placeholder="রঙের নাম (যেমন নীল)" oninput="clothState.colors[${i}].n=this.value" onchange="ceRefreshStock()"><label class="ce-img" title="এই রঙের ছবি">${x.i?`<img src="${esc(x.i)}" alt="">`:'📷'}<input type="file" accept="image/*" onchange="ceColorImg(${i},this)"></label>${x.i?`<button type="button" class="ce-x" title="ছবি সরান" onclick="clothState.colors[${i}].i='';ceRefreshAll()">🗑</button>`:''}<button type="button" class="btn danger" onclick="ceDelColor(${i})">✕</button></div>`).join('');
}
function ceSizesHtml(){
  const st=clothState;
  return `<table class="ce-table"><thead><tr><th>চালু</th><th>সাইজ</th>${st.cols.map((n,i)=>`<th><input class="ce-colname" value="${esc(n)}" oninput="clothState.cols[${i}]=this.value"><button type="button" class="ce-x" title="কলাম মুছুন" onclick="ceDelCol(${i})">×</button></th>`).join('')}<th></th></tr></thead><tbody>${st.sizes.map((z,i)=>`<tr class="${z.on?'':'off'}"><td><input type="checkbox" ${z.on?'checked':''} onchange="ceToggleSize(${i},this.checked)"></td><th>${esc(z.s)}</th>${st.cols.map((_,ci)=>`<td><input value="${esc(z.v[ci]||'')}" oninput="clothState.sizes[${i}].v[${ci}]=this.value" placeholder="—"></td>`).join('')}<td>${CE_SIZES.includes(z.s)?'':`<button type="button" class="ce-x" title="সাইজ মুছুন" onclick="ceDelSize(${i})">×</button>`}</td></tr>`).join('')}</tbody></table>`;
}
function ceStockHtml(){
  const st=clothState,sizes=st.sizes.filter(z=>z.on).map(z=>z.s);
  const rows=st.colors.length?st.colors:[{id:'',n:'(সব রং)'}];
  if(!st.colors.length&&!sizes.length)return '<div class="empty">কমপক্ষে একটি রং যোগ করুন বা একটি সাইজ চালু করুন।</div>';
  const cs=sizes.length?sizes:[''];
  return `<table class="ce-table"><thead><tr><th>রং \\ সাইজ</th>${cs.map(z=>`<th>${esc(z||'স্টক')}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th>${r.id?`<span class="ce-sw" style="background:${esc(r.h)}"></span>`:''}${esc(r.n||'(নাম নেই)')}</th>${cs.map(z=>`<td><input type="number" min="0" value="${Number(st.stock[r.id+'|'+z]||0)}" data-c="${esc(r.id)}" data-s="${esc(z)}" oninput="ceStk(this)"></td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function ceStk(el){clothState.stock[el.dataset.c+'|'+el.dataset.s]=Math.max(0,Math.floor(Number(el.value)||0))}
function ceRefreshStock(){const e=$('ceStock');if(e)e.innerHTML=ceStockHtml()}
function ceRefreshAll(){const a=$('ceColors'),b=$('ceSizes');if(a)a.innerHTML=ceColorsHtml();if(b)b.innerHTML=ceSizesHtml();ceRefreshStock()}
function ceAddColor(){clothState.colors.push({id:'c'+(++ceUid),n:'',h:'#1d4ed8'});ceRefreshAll();const ins=document.querySelectorAll('#ceColors .ce-row input:not([type=color]):not([type=file])');ins[ins.length-1]?.focus()}
function ceDelColor(i){clothState.colors.splice(i,1);ceRefreshAll()}
function ceToggleSize(i,on){clothState.sizes[i].on=on;ceRefreshAll()}
function ceAddSize(){const inp=$('ceNewSize');const n=(inp?.value||'').trim();if(!n)return;if(clothState.sizes.some(z=>z.s.toLowerCase()===n.toLowerCase())){alert('এই সাইজ আগে থেকেই আছে।');return}clothState.sizes.push({s:n,on:true,v:clothState.cols.map(()=>'')});inp.value='';ceRefreshAll()}
function ceDelSize(i){clothState.sizes.splice(i,1);ceRefreshAll()}
function ceAddCol(){const n=prompt('মাপের নাম লিখুন (যেমন গলা, কোমর, উচ্চতা):');if(!n||!n.trim())return;clothState.cols.push(n.trim());clothState.sizes.forEach(z=>z.v.push(''));ceRefreshAll()}
function ceDelCol(i){if(!confirm('এই কলাম মুছবেন?'))return;clothState.cols.splice(i,1);clothState.sizes.forEach(z=>z.v.splice(i,1));ceRefreshAll()}
function clothCollect(){
  const st=clothState;
  const colors=st.colors.map(c=>({id:c.id,n:String(c.n||'').trim(),h:c.h,i:c.i||''})).filter(c=>c.n);
  const seen=new Set();colors.forEach(c=>{const k=c.n.toLowerCase();if(seen.has(k))throw new Error('একই রঙের নাম দুইবার আছে: '+c.n);seen.add(k)});
  const keep=st.cols.map((n,i)=>({n:String(n||'').trim(),i})).filter(x=>x.n);
  const cols=keep.map(x=>x.n);
  const rows=st.sizes.map(z=>({s:z.s,on:!!z.on,v:keep.map(x=>String(z.v[x.i]||'').trim())}));
  const onSizes=rows.filter(r=>r.on).map(r=>r.s);
  const variants=[];
  const cs=colors.length?colors:[{id:'',n:''}],ss=onSizes.length?onSizes:[''];
  if(colors.length||onSizes.length)cs.forEach(c=>ss.forEach(z=>{
    const name=[c.n,z].filter(Boolean).join(' / ');
    const v={name,stock:Math.max(0,Math.floor(Number(st.stock[c.id+'|'+z])||0))};
    if(c.n)v.c=c.n;if(z)v.s=z;variants.push(v);
  }));
  return{colors:colors.map(c=>c.i?{n:c.n,h:c.h,i:c.i}:{n:c.n,h:c.h}),size_chart:{unit:String(st.unit||'').trim(),cols,rows},variants};
}

const CE_PAL=[['কালো','#111111'],['সাদা','#ffffff'],['নেভি','#1e3a8a'],['নীল','#2563eb'],['আকাশি','#7dd3fc'],['লাল','#dc2626'],['মেরুন','#7f1d1d'],['সবুজ','#16a34a'],['অলিভ','#6b7a2e'],['হলুদ','#facc15'],['কমলা','#f97316'],['গোলাপি','#ec4899'],['বেগুনি','#7c3aed'],['ধূসর','#6b7280'],['বাদামি','#78350f'],['বেইজ','#d6c5a0']];
const CE_TPL={
  shirt:{label:'শার্ট (ফরমাল/ক্যাজুয়াল)',cols:['বুক','দৈর্ঘ্য','কাঁধ','হাতা'],rows:{S:[38,27,17,24],M:[40,28,17.5,25],L:[42,29,18,25.5],XL:[44,30,18.5,26],XXL:[46,31,19,26.5]}},
  tee:{label:'টি-শার্ট / পোলো',cols:['বুক','দৈর্ঘ্য','কাঁধ'],rows:{S:[36,26,16],M:[38,27,17],L:[40,28,18],XL:[42,29,19],XXL:[44,30,20]}},
  pant:{label:'প্যান্ট / জিন্স',cols:['কোমর','দৈর্ঘ্য','হিপ','ঊরু'],rows:{'28':[28,39,36,22],'30':[30,40,38,23],'32':[32,41,40,24],'34':[34,42,42,25],'36':[36,42,44,26]}},
  jacket:{label:'জ্যাকেট / হুডি',cols:['বুক','দৈর্ঘ্য','কাঁধ','হাতা'],rows:{S:[40,25,17,24],M:[42,26,18,25],L:[44,27,19,25.5],XL:[46,28,20,26],XXL:[48,29,21,26.5]}},
  ladies:{label:'লেডিজ টপ / কুর্তি',cols:['বুক','কোমর','দৈর্ঘ্য','কাঁধ'],rows:{S:[34,30,38,14],M:[36,32,39,14.5],L:[38,34,40,15],XL:[40,36,41,15.5],XXL:[42,38,42,16]}}
};
function ceAddPreset(i){const c=CE_PAL[i];if(clothState.colors.some(x=>String(x.n).trim().toLowerCase()===c[0].toLowerCase()))return;clothState.colors.push({id:'c'+(++ceUid),n:c[0],h:c[1],i:''});ceRefreshAll()}
async function ceColorImg(i,inp){const f=inp.files&&inp.files[0];if(!f)return;try{const url=await uploadImage(f,'col'+(editingProductId||'new'),{square:IMG_SQUARE});clothState.colors[i].i=url;ceRefreshAll()}catch(e){showError(e)}}
function ceApplyTpl(k){
  const t=CE_TPL[k];if(!t)return;
  const has=clothState.sizes.some(z=>z.v.some(x=>String(x||'').trim()));
  if(has&&!confirm('এই টেমপ্লেট বসালে এখনকার মাপগুলো বদলে যাবে। বসাবেন?')){const e=$('ceTpl');if(e)e.value='';return}
  clothState.cols=t.cols.slice();clothState.unit='ইঞ্চি';
  const sizes=Object.keys(t.rows).map(sz=>({s:sz,on:true,v:t.rows[sz].map(String)}));
  CE_SIZES.forEach(sz=>{if(!t.rows[sz])sizes.push({s:sz,on:false,v:t.cols.map(()=> '')})});
  clothState.sizes=sizes;
  const u=$('ceUnit');if(u)u.value='ইঞ্চি';
  ceRefreshAll();const e=$('ceTpl');if(e)e.value='';
}
function ceFillStock(){
  const n=prompt('প্রতিটি রং ও সাইজে কত পিস দেবেন?','10');if(n===null)return;const q=Math.max(0,Math.floor(Number(n)));if(!Number.isFinite(q))return;
  const st=clothState,sizes=st.sizes.filter(z=>z.on).map(z=>z.s),rows=st.colors.length?st.colors.map(c=>c.id):[''],cs=sizes.length?sizes:[''];
  rows.forEach(r=>cs.forEach(z=>{st.stock[r+'|'+z]=q}));ceRefreshStock();
}
let copySrc=null;
function copyProduct(i){
  const p=productsCache[i];if(!p)return;
  newDept=deptOf(p);editingProductId=null;copySrc=p;
  const c={...p};delete c.id;c.name=(p.name||'')+' (copy)';
  openModal('Copy Product',productForm(c));deptChange();
}
/* ----- Size guide (Settings) ----- */
function sizeGuideCard(s){
  const g=s.size_guide||{},dis=s.has_size_guide?'':'disabled';
  return `<div class="card" style="margin-top:16px"><h3>📏 সাইজ গাইড (কীভাবে মাপবেন)</h3>
  <p>পোশাকের মাপের টেবিলের নিচে "কীভাবে মাপবেন" নামে খোলা-বন্ধ করা অংশে এটা দেখাবে। একবার লিখলে সব পোশাকে দেখাবে। ফাঁকা রাখলে কিছু দেখাবে না।</p>
  ${s.has_size_guide?'':'<p style="color:#b45309"><b>One-time setup needed:</b> run <code>15_clothing_extras.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>'}
  <label>লেখা<textarea id="sgText" rows="4" placeholder="যেমন: বুক মাপতে বগলের নিচ দিয়ে ফিতা ঘুরিয়ে নিন..." ${dis}>${esc(g.text||'')}</textarea></label>
  <label>ছবি (ঐচ্ছিক)<input type="file" id="sgFile" accept="image/*" ${dis}></label>
  ${g.image?`<div style="margin:8px 0"><img src="${esc(g.image)}" alt="" style="max-width:220px;border-radius:10px"><br><label><input type="checkbox" id="sgRemove"> ছবিটি সরিয়ে ফেলুন</label></div>`:''}
  <button class="btn primary" id="saveSgBtn" onclick="saveSizeGuide()" ${dis}>Save</button></div>`;
}
async function saveSizeGuide(){
  const s=storeSettingsCache||{},btn=$('saveSgBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    let image=(s.size_guide&&s.size_guide.image)||'';
    if($('sgRemove')?.checked)image='';
    const f=$('sgFile')?.files?.[0];if(f)image=await uploadImage(f,'size-guide');
    const size_guide={text:($('sgText')?.value||'').trim(),image};
    const {error}=await sb.from('store_settings').upsert({id:1,store_name:s.store_name||'Paboo',size_guide,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,size_guide};
    alert('Saved. Refresh your website to see the change.');render();
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save'}}
}
/* ----- Cart & checkout colours (Settings) ----- */
const CART_PRESETS=[['Ocean Blue','#27c4ff','#1676e8'],['Gold','#f3d77a','#c79a2c'],['Neon Glass','#4df3ff','#a24dff'],['Orange','#ff9a4d','#e0702b'],['Pink Pro','#ff5fa2','#7a5cff'],['Emerald','#34e0a1','#0f9d6e']];
function cartThemeCard(s){
  const t=s.cart_theme||{},a=/^#[0-9a-f]{6}$/i.test(t.a||'')?t.a:'#27c4ff',b=/^#[0-9a-f]{6}$/i.test(t.b||'')?t.b:'#1676e8',dis=s.has_cart_theme?'':'disabled';
  return `<div class="card" style="margin-top:16px"><h3>🛒 কার্ট ও চেকআউটের রং</h3>
  <p>কার্ট, চেকআউট ও Place Order বাটনের রং এখান থেকে বদলান। বেছে নিন বা নিজের রং দিন, তারপর Save।</p>
  ${s.has_cart_theme?'':'<p style="color:#b45309"><b>One-time setup needed:</b> run <code>16_cart_theme.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>'}
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">${CART_PRESETS.map(p=>`<button type="button" class="btn" ${dis} onclick="ctPick('${p[1]}','${p[2]}')" style="background:linear-gradient(135deg,${p[1]},${p[2]});color:#fff;border:0">${p[0]}</button>`).join('')}</div>
  <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><label>রং ১<input type="color" id="ctA" value="${a}" ${dis} oninput="ctPrev()"></label><label>রং ২<input type="color" id="ctB" value="${b}" ${dis} oninput="ctPrev()"></label>
  <div id="ctPrev" style="flex:1;min-width:140px;height:42px;border-radius:12px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;background:linear-gradient(135deg,${a},${b})">Place Order</div></div>
  <div style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" id="saveCtBtn" onclick="saveCartTheme()" ${dis}>Save</button><button class="btn" onclick="saveCartTheme(true)" ${dis}>ডিফল্টে ফিরুন</button></div></div>`;
}
function ctPick(a,b){$('ctA').value=a;$('ctB').value=b;ctPrev()}
function ctPrev(){const p=$('ctPrev');if(p)p.style.background=`linear-gradient(135deg,${$('ctA').value},${$('ctB').value})`}
async function saveCartTheme(reset){
  const s=storeSettingsCache||{},btn=$('saveCtBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const cart_theme=reset?null:{a:$('ctA').value,b:$('ctB').value};
    const {error}=await sb.from('store_settings').upsert({id:1,store_name:s.store_name||'Paboo',cart_theme,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,cart_theme:cart_theme||{}};
    alert('Saved. Refresh your website to see the change.');render();
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save'}}
}
Object.assign(window,{ceAddPreset,ceColorImg,ceApplyTpl,ceFillStock,copyProduct,saveSizeGuide,ctPick,ctPrev,saveCartTheme});
Object.assign(window,{deptPage,deptChange,ceAddColor,ceDelColor,ceToggleSize,ceAddSize,ceDelSize,ceAddCol,ceDelCol,ceStk,ceRefreshStock});
/* ---- CSV import / export ---- */
const CSV_COLS=['name','category','price','discount','stock','buying_price','brand','description'];
function csvParse(text){
  text=String(text||'').replace(/^﻿/,'');const rows=[];let row=[],cur='',q=false;
  const first=text.split(/\r?\n/,1)[0]||'';const sep=(first.split(';').length>first.split(',').length)?';':',';
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;else if(c===sep){row.push(cur);cur=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);cur='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[]}
    else cur+=c}
  row.push(cur);if(row.some(x=>x.trim()!==''))rows.push(row);return rows;
}
function csvCell(v){v=String(v??'');return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function csvExport(){
  const lines=[CSV_COLS.join(',')];
  productsCache.forEach(p=>lines.push([p.name,p.category,p.price,p.discount||0,p.stock,costOf(p.id),p.brand||'',p.description||''].map(csvCell).join(',')));
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='products-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function csvTemplate(){
  const t='name,category,price,discount,stock,buying_price,brand,description\r\nTWS Earbuds,Audio,1200,10,10,800,Xiaomi,Good sound\r\nSmart Watch,Watch,2500,0,5,1900,,\r\n';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+t],{type:'text/csv;charset=utf-8'}));a.download='products-template.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
let csvPlan=[];
function csvImportOpen(){
  csvPlan=[];
  openModal('CSV Import',`<div style="display:grid;gap:12px">
  <p>Excel / Google Sheets-এ এই কলামগুলো রাখুন: <code>${CSV_COLS.join(', ')}</code>। শুধু <b>name</b> বাধ্যতামূলক।</p>
  <ul style="margin:0 0 0 18px;font-size:13px;color:#475569"><li>একই নামের পণ্য আগে থেকে থাকলে শুধু যে ঘরগুলো ভরা আছে সেগুলো আপডেট হবে (ছবি, ভ্যারিয়েন্ট অক্ষত থাকবে)।</li><li>নতুন নামের পণ্য নতুন করে যোগ হবে, ছবি পরে Edit-এ দিন।</li><li>ক্যাটাগরি না থাকলে নিজে তৈরি হবে।</li></ul>
  <div class="btn-row"><button class="btn muted" onclick="csvTemplate()">⬇ Sample file</button></div>
  <input type="file" id="csvFile" accept=".csv,text/csv" onchange="csvPreview(this.files[0])">
  <div id="csvPreview"></div></div>`);
}
async function csvPreview(file){
  const box=$('csvPreview');if(!file||!box)return;
  const rows=csvParse(await file.text());
  if(rows.length<2){box.innerHTML='<p style="color:#b91c1c">ফাইলে কোনো সারি পাওয়া যায়নি।</p>';return}
  const head=rows[0].map(h=>h.trim().toLowerCase().replace(/[\s-]+/g,'_'));
  const alias={product:'name',product_name:'name',title:'name',cat:'category',buy_price:'buying_price',cost:'buying_price',buying:'buying_price',quantity:'stock',qty:'stock',discount_percent:'discount',desc:'description'};
  const idx={};head.forEach((h,i)=>{const k=alias[h]||h;if(CSV_COLS.includes(k)&&!(k in idx))idx[k]=i});
  if(!('name' in idx)){box.innerHTML='<p style="color:#b91c1c">"name" কলাম পাওয়া যায়নি।</p>';return}
  const byName=new Map(productsCache.map(p=>[String(p.name).trim().toLowerCase(),p]));
  csvPlan=[];const bad=[];
  rows.slice(1).forEach((r,n)=>{
    const g=k=>k in idx?String(r[idx[k]]??'').trim():'';
    const name=g('name');if(!name)return;
    const rec={name};let err='';
    ['price','discount','stock','buying_price'].forEach(k=>{const v=g(k);if(v==='')return;const x=Number(v.replace(/,/g,''));if(!Number.isFinite(x)||x<0||(k==='discount'&&x>100))err=k+' ঠিক নয় ("'+v+'")';else rec[k]=x});
    ['category','brand','description'].forEach(k=>{const v=g(k);if(v!=='')rec[k]=v});
    if(err){bad.push(`লাইন ${n+2} (${name}): ${err}`);return}
    const old=byName.get(name.toLowerCase());rec.old=old||null;
    if(!old&&rec.price==null){bad.push(`লাইন ${n+2} (${name}): নতুন পণ্যে price দিতে হবে`);return}
    csvPlan.push(rec)});
  const nu=csvPlan.filter(x=>!x.old).length,up=csvPlan.length-nu;
  box.innerHTML=`<p><b>${nu}</b>টি নতুন, <b>${up}</b>টি আপডেট${bad.length?`, <span style="color:#b91c1c">${bad.length}টি ভুল (বাদ যাবে)</span>`:''}</p>
  ${bad.length?`<div style="font-size:12px;color:#b91c1c;max-height:90px;overflow:auto">${bad.map(esc).join('<br>')}</div>`:''}
  <div style="max-height:180px;overflow:auto;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;padding:6px">${csvPlan.slice(0,60).map(x=>`${x.old?'✏️':'🆕'} ${esc(x.name)}${x.price!=null?' · ৳'+x.price:''}${x.stock!=null?' · স্টক '+x.stock:''}`).join('<br>')}${csvPlan.length>60?'<br>...':''}</div>
  <div class="btn-row"><button class="btn primary" id="csvGoBtn" onclick="csvImportRun()" ${csvPlan.length?'':'disabled'}>Import ${csvPlan.length}টি পণ্য</button></div>`;
}
async function csvImportRun(){
  const btn=$('csvGoBtn');if(btn){btn.disabled=true;btn.textContent='Importing...'}
  let done=0;const fails=[];
  try{
    const have=new Set(categoriesCache.map(c=>String(c.name).trim().toLowerCase()));
    for(const c of [...new Set(csvPlan.map(x=>x.category).filter(Boolean))]){
      const hit=categoriesCache.find(k=>String(k.name).trim().toLowerCase()===c.toLowerCase());
      if(hit){csvPlan.forEach(x=>{if(x.category&&x.category.toLowerCase()===c.toLowerCase())x.category=hit.name});continue}
      const slug=c.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||('cat-'+Date.now());
      const {error}=await sb.from('categories').insert({name:c,slug});
      if(error&&!/duplicate|23505/i.test((error.code||'')+(error.message||'')))throw error;
    }
    for(const x of csvPlan){
      try{
        const id=x.old?x.old.id:crypto.randomUUID();
        const row={id,name:x.old?x.old.name:x.name};
        ['category','price','discount','stock','brand','description'].forEach(k=>{if(x[k]!=null)row[k]=x[k]});
        if(!x.old){row.active=true;row.image='';row.images=[];row.stock=row.stock??0;row.discount=row.discount??0;row.category=row.category||'Other'}
        const {error}=await sb.from('products').upsert(row,{onConflict:'id'});
        if(error)throw error;
        if(x.buying_price!=null)await saveCost(id,String(x.buying_price));
        done++;
      }catch(e){fails.push(x.name+': '+(e.message||e))}
    }
    await refreshProducts();closeModal();render();
    alert(done+'টি পণ্য import হয়েছে.'+(fails.length?'\nব্যর্থ ('+fails.length+'):\n'+fails.slice(0,8).join('\n'):''));
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Import'}}
}
window.csvImportOpen=csvImportOpen;window.csvExport=csvExport;window.csvTemplate=csvTemplate;window.csvPreview=csvPreview;window.csvImportRun=csvImportRun;
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
    const sel=selOrders.has(String(o.id))?'checked':'';
    return `<tr><td class="sel-cell"><input type="checkbox" class="order-sel" ${sel} onchange="toggleOrderSel(${i},this.checked)" aria-label="Select order"></td><td><b>${esc(id)}</b><br><small>${esc(created)}</small>${o.source?`<br><small class="src-tag">📣 ${esc(o.source)}</small>`:''}</td><td>${esc(name)}${riskBadge(o)}</td><td>${esc(phone)}</td><td>${money(total)}</td><td>${esc(o.payment_method||o.paymentMethod||'COD')}${o.transaction_id?`<br><small>TXN: ${esc(o.transaction_id)}</small>`:''}</td><td><span class="pill ${statusClass(s)}">${esc(s)}</span></td><td class="actions"><button class="btn muted" onclick="viewOrder(${i})">View</button><button class="btn" style="background:#1fa855;color:#fff" onclick="whatsappOrder(${i})" title="Message customer on WhatsApp">WhatsApp</button>${next}${cancel}<button class="btn danger" style="opacity:.8" onclick="deleteOrder(${i})" title="Delete this order permanently">🗑</button></td></tr>`
  }).join('');
}
function orders(){
  const filtered=getFilteredOrders();
  return `<div class="section-head"><div><h3>Orders</h3><p>Manage, search and update customer orders</p></div><div class="toolbar"><button class="btn muted" onclick="refreshOrders().then(()=>render()).catch(showError)">↻ Refresh</button><button class="btn primary" onclick="exportOrdersCSV()">Export CSV</button></div></div>
  <div class="filters"><div class="search-wrap"><input class="input" id="orderSearch" value="${esc($('orderSearch')?.value||'')}" placeholder="Search order ID, customer, phone, address..." oninput="filterOrders()"></div><select class="select" id="orderStatusFilter" onchange="filterOrders()"><option value="">All Statuses</option>${['Pending','Confirmed','Processing','Shipped','Delivered','Cancelled'].map(s=>`<option value="${s}" ${$('orderStatusFilter')?.value===s?'selected':''}>${s}</option>`).join('')}</select><select class="select" id="orderPaymentFilter" onchange="filterOrders()"><option value="">All Payments</option>${['COD','bKash','Nagad'].map(s=>`<option value="${s}" ${$('orderPaymentFilter')?.value===s?'selected':''}>${s}</option>`).join('')}</select></div>
  <p class="orders-count"><small>Showing ${filtered.length} of ${ordersCache.length} orders.</small></p>
  <div id="bulkBar" class="bulk-bar hidden"></div>
  <style>.sel-cell{width:34px;text-align:center}.bulk-bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#0f172a;color:#fff;border-radius:12px;padding:10px 12px;margin:8px 0;box-shadow:0 4px 14px rgba(0,0,0,.25)}.bulk-bar.hidden{display:none}.bulk-bar b{margin-right:6px}.bulk-bar .btn{padding:6px 10px;font-size:12px}</style>
  <div class="table-wrap"><table class="table"><thead><tr><th class="sel-cell"><input type="checkbox" id="orderSelAll" onchange="selectAllOrders(this.checked)" aria-label="Select all shown"></th><th>Order ID / Date</th><th>Customer</th><th>Phone</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody id="orderRows">${orderRows(filtered)}</tbody></table></div>`
}
function filterOrders(){
  const rows=$('orderRows');
  if(rows)rows.innerHTML=orderRows(getFilteredOrders());
  const count=document.querySelector('#content .orders-count');
  if(count)count.textContent=`Showing ${getFilteredOrders().length} of ${ordersCache.length} orders.`;
  bulkBarRender();
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
  return items.map(x=>`${x.name||x.title||'Product'}${x.variant?' ['+x.variant+']':''} x${x.qty||x.quantity||1}`).join('; ');
}
function viewOrder(i){
  const o=ordersCache[i];if(!o)return;
  const id=o.order_number||o.order_id||o.id||'',name=o.customer_name||o.customer?.name||o.name||'',phone=o.phone||o.customer_phone||o.customer?.phone||'';
  const district=o.district||o.customer?.district||'',upazila=o.upazila||o.customer?.upazila||'',address=o.address||o.customer?.address||'';
  const payment=o.payment_method||o.paymentMethod||'COD',s=o.status||'Pending',delivery=Number(o.delivery_charge??o.delivery_fee??0),total=o.total??(Number(o.subtotal||0)+delivery);
  let items=o.items;let itemHtml='';
  if(typeof items==='string'){try{items=JSON.parse(items)}catch{items=[]}}
  if(Array.isArray(items))itemHtml=items.map(x=>{const qty=Number(x.qty||x.quantity||1);const price=Number(x.price||x.unit_price||0);return `<div class="order-item"><span>${esc(x.name||x.title||'Product')}${x.variant?` <b class="ord-var">${esc(x.variant)}</b>`:''} × ${qty}</span><b>${money(price*qty)}</b></div>`}).join('');
  const created=o.created_at?new Date(o.created_at).toLocaleString('en-BD'):'—';
  openModal('Order '+id,`<div class="card"><b>Order Information</b><p><b>Order ID:</b> ${esc(id)}</p><p><b>Placed:</b> ${esc(created)}</p><p><b>Status:</b> <span class="pill ${statusClass(s)}">${esc(s)}</span></p><hr><b>Customer</b><p>${esc(name)} · ${esc(phone)}</p><p>${esc([district,upazila].filter(Boolean).join(', '))}</p><p>${esc(address||'—')}</p><hr><p><b>Payment:</b> ${esc(payment)}</p><p><b>Transaction ID:</b> ${esc(o.transaction_id||'—')}</p><p><b>Source:</b> ${esc(o.source||'—')}</p><p><b>Subtotal:</b> ${money(o.subtotal)}</p><p><b>Delivery:</b> ${money(delivery)}</p><p><b>Total:</b> <b>${money(total)}</b></p><p><b>Customer note:</b> ${esc(o.note||'—')}</p>${itemHtml?`<hr><b>Items</b><div class="order-items">${itemHtml}</div>`:'<hr><p>No item details saved with this order.</p>'}${courierBox(i,o)}</div><div class="btn-row">${blockBtn(o)}<button class="btn" style="background:#1fa855;color:#fff" onclick="whatsappOrder(${i})">WhatsApp Customer</button>${s==='Pending'?actionBtn(i,'Confirmed','Confirm Order','primary'):''}${s==='Confirmed'?actionBtn(i,'Processing','Start Processing','primary'):''}${s==='Processing'?actionBtn(i,'Shipped','Mark Shipped','primary'):''}${s==='Shipped'?actionBtn(i,'Delivered','Mark Delivered','primary'):''}${s!=='Delivered'&&s!=='Cancelled'?actionBtn(i,'Cancelled','Cancel Order','danger'):''}</div>`);
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
  const head=`আসসালামু আলাইকুম${name?' '+name:''}, Paboo থেকে বলছি।\nঅর্ডার নং: ${id}\nমোট: ${money(total)}\n`;
  const tail={
    Pending:'আপনার অর্ডারটি আমরা পেয়েছি। কনফার্ম করার জন্য যোগাযোগ করছি, দয়া করে ঠিকানা ও নম্বর ঠিক আছে কিনা জানাবেন।',
    Confirmed:'আপনার অর্ডারটি কনফার্ম করা হয়েছে। শীঘ্রই প্রস্তুত করে পাঠানো হবে। ধন্যবাদ!',
    Processing:'আপনার অর্ডারটি প্রস্তুত করা হচ্ছে।',
    Shipped:'আপনার অর্ডারটি কুরিয়ারে পাঠানো হয়েছে। শীঘ্রই পৌঁছে যাবে।',
    Delivered:'আপনার অর্ডারটি ডেলিভারি হয়েছে। আমাদের থেকে কেনার জন্য ধন্যবাদ!',
    Cancelled:'দুঃখিত, আপনার অর্ডারটি বাতিল করা হয়েছে। কোনো প্রশ্ন থাকলে জানাবেন।'
  }[s]||'';
  const trk=(o.tracking_no&&(s==='Shipped'||s==='Processing'))?`\nকুরিয়ার: ${o.courier||'—'}\nট্র্যাকিং নম্বর: ${o.tracking_no}`:'';
  return head+tail+trk;
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

/* ---- bulk select / bulk status / delete orders ---- */
function bulkBarRender(){
  const bar=$('bulkBar');if(!bar)return;
  const n=selOrders.size;bar.classList.toggle('hidden',!n);
  if(!n){bar.innerHTML='';return}
  bar.innerHTML=`<b>${n} selected</b>${[['Confirmed','Confirm'],['Processing','Processing'],['Shipped','Shipped'],['Delivered','Delivered']].map(([v,l])=>`<button class="btn primary" onclick="bulkStatus('${v}')">${l}</button>`).join('')}<button class="btn danger" onclick="bulkStatus('Cancelled')">Cancel</button><button class="btn danger" onclick="bulkDelete()">🗑 Delete</button><button class="btn muted" onclick="clearOrderSel()">Clear</button>`;
  const all=$('orderSelAll');if(all){const shown=getFilteredOrders();all.checked=shown.length>0&&shown.every(x=>selOrders.has(String(x.o.id)))}
}
function toggleOrderSel(i,on){const o=ordersCache[i];if(!o)return;on?selOrders.add(String(o.id)):selOrders.delete(String(o.id));bulkBarRender()}
function selectAllOrders(on){getFilteredOrders().forEach(({o})=>{on?selOrders.add(String(o.id)):selOrders.delete(String(o.id))});filterOrders();bulkBarRender()}
function clearOrderSel(){selOrders.clear();filterOrders();bulkBarRender()}
function selectedOrders(){return ordersCache.filter(o=>selOrders.has(String(o.id)))}
async function bulkStatus(newStatus){
  const list=selectedOrders();if(!list.length)return;
  const skip=[],ok=[];
  list.forEach(o=>{const old=o.status||'Pending';if(old===newStatus||(newStatus==='Cancelled'&&old==='Delivered')||(old==='Cancelled'&&newStatus!=='Cancelled'))skip.push(o);else ok.push(o)});
  if(!ok.length){alert('Nothing to change: the selected orders already have that status, or cannot be moved to it (delivered orders cannot be cancelled, cancelled orders cannot be re-opened).');return}
  if(!confirm(`Change ${ok.length} order(s) to "${newStatus}"?${skip.length?`\n\n${skip.length} selected order(s) will be skipped.`:''}${newStatus==='Cancelled'?'\n\nStock of cancelled orders is returned automatically.':''}`))return;
  try{
    const {error}=await sb.from('orders').update({status:newStatus,updated_at:new Date().toISOString()}).in('id',ok.map(o=>o.id));
    if(error)throw error;
    selOrders.clear();
    await refreshOrders();
    if(newStatus==='Cancelled'){try{await refreshProducts()}catch(e){console.warn(e)}}
    render();
    alert(`${ok.length} order(s) updated to ${newStatus}.`);
  }catch(e){showError(e)}
}
async function deleteOrdersByIds(ids){
  const {error}=await sb.from('orders').delete().in('id',ids);
  if(error)throw error;
  const {data,error:e2}=await sb.from('orders').select('id').in('id',ids);
  if(!e2&&data&&data.length)throw new Error('The server did not delete the orders. Run 12_policies.sql in Supabase SQL Editor once (it allows the admin to delete orders), then try again.');
}
async function deleteOrder(i){
  const o=ordersCache[i];if(!o)return;
  const id=o.order_number||o.id,s=o.status||'Pending';
  const warn=(s!=='Cancelled'&&s!=='Delivered')?'\n\nThis order is still open. Stock will NOT be returned when you delete it. If you want the stock back, press Cancel first and delete afterwards.':'';
  if(!confirm(`Delete order ${id} permanently?${warn}\n\nIt will also disappear from reports and profit totals. This cannot be undone.`))return;
  try{await deleteOrdersByIds([o.id]);selOrders.delete(String(o.id));await refreshOrders();render()}catch(e){showError(e)}
}
async function bulkDelete(){
  const list=selectedOrders();if(!list.length)return;
  const open=list.filter(o=>!['Cancelled','Delivered'].includes(o.status||'Pending')).length;
  if(!confirm(`Delete ${list.length} order(s) permanently?${open?`\n\n${open} of them are still open: their stock will NOT be returned (Cancel first if you want the stock back).`:''}\n\nThey will also disappear from reports and profit totals. This cannot be undone.`))return;
  if(list.length>=5&&!confirm('Are you sure? Final confirmation.'))return;
  try{await deleteOrdersByIds(list.map(o=>o.id));selOrders.clear();await refreshOrders();render();alert(list.length+' order(s) deleted.')}catch(e){showError(e)}
}
Object.assign(window,{toggleOrderSel,selectAllOrders,clearOrderSel,bulkStatus,bulkDelete,deleteOrder});
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
  curDept='';
  const rows=categoriesCache.map((c,i)=>`<tr><td>${esc(c.name)}</td><td>${deptLabel(deptOf(c))}</td><td>${esc(c.slug||'—')}</td><td><button class="btn danger" onclick="deleteCategory(${i})">Delete</button></td></tr>`).join('');
  return `<div class="section-head"><div><h3>Categories</h3><p>Manage product categories</p></div><button class="btn primary" onclick="addCategory()">＋ Add Category</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Department</th><th>Slug</th><th>Action</th></tr></thead><tbody>${rows||`<tr><td colspan="4" class="empty">No categories</td></tr>`}</tbody></table></div>`
}
function addCategory(d){
  const dd=(typeof d==='string'&&d)?d:(curDept||'gadget');
  openModal('Add Category',`<label class="form-grid"><span class="full">Department (বিভাগ)<select id="categoryDept"><option value="gadget" ${dd==='gadget'?'selected':''}>🎧 গ্যাজেট</option><option value="clothing" ${dd==='clothing'?'selected':''}>👕 পোশাক</option></select></span><span class="full">Category Name<input id="categoryName" placeholder="Audio / Shirt"></span></label><div class="btn-row"><button class="btn muted" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveCategory()">Save</button></div>`)
}
async function saveCategory(){
  const name=$('categoryName')?.value.trim();
  if(!name){alert('Category name is required.');return}
  try{
    const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const cd=$('categoryDept')?.value==='clothing'?'clothing':'gadget';
    if(cd==='clothing'&&!hasDeptCol())throw new Error('Run 14_clothing.sql in Supabase > SQL Editor first (Update 14).');
    const {error}=await sb.from('categories').insert(hasDeptCol()?{name,slug,dept:cd}:{name,slug});
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
    store_name:data?.store_name||'Paboo',
    phone:data?.phone||'',
    email:data?.email||'',
    address:data?.address||'',
    support_hours:data?.support_hours||'',
    updated_at:data?.updated_at||null,
    theme:(data&&data.theme)||'ocean',
    has_theme:!!data&&('theme' in data),
    col_picker:!!(data&&data.col_picker),
    show_tracking:!!(data&&data.show_tracking),
    has_tracking:!!data&&('show_tracking' in data),
    has_cols:!!data&&('col_picker' in data),
    variants_on:!!(data&&data.variants_on),
    policies:(()=>{let v=data&&data.policies;if(typeof v==='string'){try{v=JSON.parse(v)}catch(e){v=null}}return v&&typeof v==='object'?v:{}})(),
    has_policies:!!data&&('policies' in data),
    social:(()=>{let v=data&&data.social;if(typeof v==='string'){try{v=JSON.parse(v)}catch(e){v=null}}return v&&typeof v==='object'?v:{}})(),
    has_social:!!data&&('social' in data),
    size_guide:(()=>{let v=data&&data.size_guide;if(typeof v==='string'){try{v=JSON.parse(v)}catch(e){v=null}}return v&&typeof v==='object'?v:{}})(),
    has_size_guide:!!data&&('size_guide' in data),
    cart_theme:(()=>{let v=data&&data.cart_theme;if(typeof v==='string'){try{v=JSON.parse(v)}catch(e){v=null}}return v&&typeof v==='object'?v:{}})(),
    has_cart_theme:!!data&&('cart_theme' in data),
    has_variants:!!data&&('variants_on' in data)
  };
  return storeSettingsCache;
}

function setGroups(s){
  const G=[['sgAppear','🎨 সাইটের চেহারা','থিম · কার্ট ও চেকআউট রং',themeCard(s)+cartThemeCard(s),!s.has_cart_theme],
   ['sgSocial','📣 সোশ্যাল ও যোগাযোগ','Facebook · WhatsApp · লিংক',socialCard(s),!s.has_social],
   ['sgCloth','👕 পোশাক ও পণ্যের অপশন','কালার পিকার · ভ্যারিয়েন্ট · সাইজ গাইড',colsCard(s)+variantsCard(s)+sizeGuideCard(s),!(s.has_cols&&s.has_variants&&s.has_size_guide)],
   ['sgTrack','🔎 অর্ডার ট্র্যাকিং','কুরিয়ার ট্র্যাকিং দেখানো',trackingCard(s),!s.has_tracking]];
  const bar=`<div class="set-jump">${G.map(g=>`<a href="#${g[0]}" onclick="event.preventDefault();document.getElementById('${g[0]}').open=true;document.getElementById('${g[0]}').scrollIntoView({behavior:'smooth',block:'start'})">${g[1]}${g[4]?' <i>SQL বাকি</i>':''}</a>`).join('')}</div>`;
  return bar+G.map(g=>`<details class="set-group" id="${g[0]}" open><summary><span><b>${g[1]}</b><small>${g[2]}</small></span>${g[4]?'<em class="warn">SQL বাকি</em>':'<em class="ok">ঠিক আছে</em>'}</summary>${g[3]}</details>`).join('');
}
function settings(){
  const s=storeSettingsCache||{};
  return `<div class="section-head"><div><h3>Store Settings</h3><p>Manage your store contact information</p></div><button class="btn muted" onclick="loadStoreSettings().then(render).catch(showError)">↻ Refresh</button></div>
  <div class="card"><div class="form-grid">
    <label class="full">Store Name<input id="storeName" maxlength="120" value="${esc(s.store_name||'Paboo')}" placeholder="Paboo"></label>
    <label>Contact Phone<input id="storePhone" type="tel" maxlength="30" value="${esc(s.phone||'')}" placeholder="01XXXXXXXXX"></label>
    <label>Contact Email<input id="storeEmail" type="email" maxlength="160" value="${esc(s.email||'')}" placeholder="support@example.com"></label>
    <label class="full">Store Address<textarea id="storeAddress" rows="3" maxlength="500" placeholder="Store address">${esc(s.address||'')}</textarea></label>
    <label class="full">Support Hours<input id="storeHours" maxlength="160" value="${esc(s.support_hours||'')}" placeholder="Every day, 10 AM–8 PM"></label>
  </div><div class="btn-row"><button class="btn primary" id="saveStoreSettingsBtn" onclick="saveStoreSettings()">Save Store Settings</button></div>
  ${s.updated_at?`<p><small>Last updated: ${esc(new Date(s.updated_at).toLocaleString('en-BD'))}</small></p>`:''}</div>${setGroups(s)}`
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

  if(section==='products'||section==='categories'||section==='clothing'||section==='gadget'){
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
    clothing:['পোশাক (Clothing)','Clothing categories and products'],
    gadget:['গ্যাজেট (Gadgets)','Gadget categories and products'],
    orders:['Orders','Manage customer orders'],
    customers:['Customers','Customer list'],
    categories:['Categories','Manage categories'],
    offers:['Offers & Deals','Manage promotions and schedules'],
    coupons:['Coupons','Create and manage discount codes'],
    reports:['Reports','Profit, sales and trending products'],
    policies:['Policies','Edit or hide the policy cards shown on your website'],
    leads:['Incomplete orders','People who started checkout but did not order'],
    blocked:['Blocked numbers','Numbers that cannot place orders'],
    delivery:['Delivery','Delivery settings'],
    payments:['Payments','Payment settings'],
    settings:['Settings','Store settings']
  };

  const t=titles[section]||titles.dashboard;
  if($('pageTitle'))$('pageTitle').textContent=t[0];
  if($('pageSub'))$('pageSub').textContent=t[1];

  if(section==='coupons'){render();refreshCoupons().then(()=>{if(currentSection==='coupons')render()}).catch(()=>{});}
  else render();

  if(window.innerWidth<=720)toggleSidebar(false);
}
function render(){
  const c=$('content');if(!c)return;
  const map={dashboard,clothing:()=>deptPage('clothing'),gadget:()=>deptPage('gadget'),products,orders,customers,categories,offers,coupons,reports,policies:policiesPage,leads:leadsPage,blocked:blockedPage,delivery,payments,settings};
  c.innerHTML=(map[currentSection]||dashboard)();
  updateOrderBadge();
  if(currentSection==='orders')bulkBarRender();
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
  if(!document.querySelector('.nav[data-section="leads"]')){
    const ob=document.querySelector('.nav[data-section="orders"]');
    if(ob){const a=document.createElement('button');a.className='nav';a.dataset.section='leads';a.innerHTML='🛒 <span>Incomplete orders</span>';ob.after(a);const b=document.createElement('button');b.className='nav';b.dataset.section='blocked';b.innerHTML='🚫 <span>Blocked numbers</span>';a.after(b)}
  }
  if(!document.querySelector('.nav[data-section="reports"]')){
    const db=document.querySelector('.nav[data-section="dashboard"]');
    if(db){const nb=document.createElement('button');nb.className='nav';nb.dataset.section='reports';nb.innerHTML='📈 <span>Reports</span>';db.after(nb)}
  }
  if(!document.querySelector('.nav[data-section="coupons"]')){
    const ob=document.querySelector('.nav[data-section="offers"]');
    if(ob){const nb=document.createElement('button');nb.className='nav';nb.dataset.section='coupons';nb.innerHTML='🎟 <span>Coupons</span>';ob.after(nb)}
  }
  if(!document.querySelector('.nav[data-section="policies"]')){
    const ob=document.querySelector('.nav[data-section="coupons"]')||document.querySelector('.nav[data-section="offers"]');
    if(ob){const nb=document.createElement('button');nb.className='nav';nb.dataset.section='policies';nb.innerHTML='📜 <span>Policies</span>';ob.after(nb)}
  }
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

/* =========================================================
   CATEGORY PICKER + POST BUILDER
========================================================= */
(function(){
  const st=document.createElement('style');
  st.textContent=`.cat-wrap{position:relative;display:block}.cat-suggest{position:absolute;left:0;right:0;top:100%;z-index:50;background:#fff;color:#111;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);max-height:220px;overflow:auto;margin-top:4px}.cat-suggest.hidden{display:none}.cat-suggest div{padding:10px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid #f1f5f9}.cat-suggest div:hover{background:#eef2ff}.cat-suggest .cat-new{color:#0a7d33;font-weight:700}.post-box textarea{width:100%;min-height:230px;font:14px/1.5 inherit;padding:10px;border:1px solid #cbd5e1;border-radius:10px;box-sizing:border-box}.post-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.post-row .btn{flex:1;min-width:140px}.post-src{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.post-src button{padding:7px 12px;border-radius:99px;border:1px solid #cbd5e1;background:#fff;cursor:pointer}.post-src button.on{background:#0f172a;color:#fff;border-color:#0f172a}`;
  document.head.appendChild(st);
})();
function hideCatSuggest(){$('catSuggest')?.classList.add('hidden')}
function showCatSuggest(){
  const box=$('catSuggest'),inp=$('productCategory');if(!box||!inp)return;
  const q=inp.value.trim().toLowerCase();
  const sd=$('productDept')?.value||'gadget';
  const list=categoriesCache.filter(c=>deptOf(c)===sd&&(!q||String(c.name).toLowerCase().includes(q)));
  let h=list.map(c=>`<div onmousedown="pickCat(this.dataset.n)" data-n="${esc(c.name)}">${esc(c.name)}</div>`).join('');
  const exact=categoriesCache.some(c=>String(c.name).trim().toLowerCase()===q);
  if(q&&!exact)h+=`<div class="cat-new" onmousedown="pickCat(this.dataset.n)" data-n="${esc(inp.value.trim())}">＋ Add new: ${esc(inp.value.trim())}</div>`;
  if(!h){box.classList.add('hidden');return}
  box.innerHTML=h;box.classList.remove('hidden')
}
function pickCat(n){const i=$('productCategory');if(i)i.value=n;hideCatSuggest()}

const SITE_URL='https://paboobd.github.io/';
const POST_WA='8801320992683';
let postIdx=-1,postSrc='fbgroup';
const POST_SRCS={fbgroup:'Facebook Group',fbpage:'Facebook Page/Boost',story:'Story',tiktok:'TikTok'};
function postFinal(p){return Math.round(Number(p.price||0)*(1-Number(p.discount||0)/100))}
function postText(p,src){
  const fin=postFinal(p),d=Number(p.discount||0);
  let specs=p.specifications;if(typeof specs==='string'){try{specs=JSON.parse(specs)}catch(e){specs=[]}}
  const feats=(Array.isArray(specs)?specs:[]).slice(0,5).map(x=>x&&typeof x==='object'?`✅ ${x.name}${x.value?': '+x.value:''}`:`✅ ${x}`);
  const L=[`🔥 ${p.name}`];
  if(p.brand)L.push(`Brand: ${p.brand}`);
  L.push('',d>0?`💰 দাম: ৳${fin.toLocaleString('en-BD')} (৳${Number(p.price).toLocaleString('en-BD')} থেকে ${d}% ছাড়)`:`💰 দাম: ৳${fin.toLocaleString('en-BD')}`);
  if(feats.length)L.push('',...feats);
  if(p.warranty)L.push('',`🛡️ ওয়ারেন্টি: ${p.warranty}`);
  if(Number(p.stock||0)>0&&Number(p.stock)<=5)L.push(`⚡ মাত্র ${p.stock}টি স্টক আছে`);
  L.push('','🚚 সারা বাংলাদেশে ডেলিভারি | ক্যাশ অন ডেলিভারি',`🛒 অর্ডার করুন: ${SITE_URL}?product=${encodeURIComponent(p.id)}&src=${src}`,`📲 WhatsApp: https://wa.me/${POST_WA}`);
  return L.join('\n')
}
function openPostBuilder(i){
  const p=productsCache[i];if(!p)return;postIdx=i;postSrc='fbgroup';
  openModal('Post: '+p.name,`<div class="post-box">
    <b>কোথায় পোস্ট করবেন?</b>
    <div class="post-src" id="postSrcBtns">${Object.entries(POST_SRCS).map(([k,v])=>`<button type="button" data-k="${k}" class="${k===postSrc?'on':''}" onclick="setPostSrc('${k}')">${v}</button>`).join('')}</div>
    <textarea id="postText">${esc(postText(p,postSrc))}</textarea>
    <div class="post-row"><button class="btn primary" type="button" onclick="copyPostText()">📋 Copy Text</button></div>
    <div class="post-row"><button class="btn muted" type="button" onclick="downloadPostImage('story')">⬇ Story (1080×1920)</button><button class="btn muted" type="button" onclick="downloadPostImage('square')">⬇ Post (1080×1080)</button></div>
    <p id="postMsg" style="font-size:13px;color:#475569"></p></div>`)
}
function setPostSrc(k){
  const p=productsCache[postIdx];if(!p)return;
  const old=postSrc;postSrc=k;
  const ta=$('postText');if(ta)ta.value=ta.value.split('&src='+old).join('&src='+k);
  document.querySelectorAll('#postSrcBtns button').forEach(b=>b.classList.toggle('on',b.dataset.k===k))
}
async function copyPostText(){
  const ta=$('postText');if(!ta)return;
  try{await navigator.clipboard.writeText(ta.value)}catch(e){ta.select();document.execCommand('copy')}
  if($('postMsg'))$('postMsg').textContent='✅ Copy হয়েছে — এখন Facebook/TikTok এ paste করুন।'
}
function wrapCanvasText(ctx,text,x,y,maxW,lh,maxLines){
  const words=String(text).split(/\s+/);let line='',n=0;
  for(const w of words){
    const t=line?line+' '+w:w;
    if(ctx.measureText(t).width>maxW&&line){ctx.fillText(line,x,y);y+=lh;line=w;if(++n>=maxLines-1)break}else line=t
  }
  ctx.fillText(line,x,y);return y+lh
}
function loadPostImg(url){
  return new Promise(res=>{if(!url)return res(null);const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res(im);im.onerror=()=>res(null);im.src=url})
}
async function downloadPostImage(kind){
  const p=productsCache[postIdx];if(!p)return;
  const W=1080,H=kind==='story'?1920:1080;
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0f172a');g.addColorStop(1,'#1e3a8a');x.fillStyle=g;x.fillRect(0,0,W,H);
  const img=await loadPostImg(p.image);
  const box=kind==='story'?820:560,bx=(W-box)/2,by=kind==='story'?250:70;
  x.fillStyle='#fff';x.beginPath();x.roundRect(bx,by,box,box,36);x.fill();
  if(img){const r=Math.min((box-40)/img.width,(box-40)/img.height),w=img.width*r,h=img.height*r;x.drawImage(img,bx+(box-w)/2,by+(box-h)/2,w,h)}
  x.textAlign='center';x.fillStyle='#fbbf24';x.font='bold 40px sans-serif';x.fillText('PABOO',W/2,kind==='story'?150:56);
  let y=by+box+(kind==='story'?90:60);
  x.fillStyle='#fff';x.font='bold 52px sans-serif';y=wrapCanvasText(x,p.name,W/2,y,W-140,62,2);
  const fin=postFinal(p),d=Number(p.discount||0);
  x.fillStyle='#22c55e';x.font='bold 88px sans-serif';x.fillText('৳'+fin.toLocaleString('en-BD'),W/2,y+60);y+=100;
  if(d>0){x.fillStyle='#cbd5e1';x.font='36px sans-serif';x.fillText('৳'+Number(p.price).toLocaleString('en-BD')+'  •  '+d+'% OFF',W/2,y+10);y+=60}
  x.fillStyle='#fbbf24';x.font='bold 38px sans-serif';
  x.fillText('Order: paboobd.github.io',W/2,H-(kind==='story'?150:80));
  x.fillStyle='#fff';x.font='34px sans-serif';x.fillText('WhatsApp: +'+POST_WA,W/2,H-(kind==='story'?90:30));
  let blob;
  try{blob=await new Promise((r,j)=>c.toBlob(b=>b?r(b):j(new Error('x')),'image/jpeg',.92))}
  catch(e){if($('postMsg'))$('postMsg').textContent='❌ ছবি তৈরি হয়নি (image CORS)। Screenshot নিন।';return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(p.name||'product').replace(/[^\w]+/g,'-')}-${kind}.jpg`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  if($('postMsg'))$('postMsg').textContent=img?'✅ ছবি ডাউনলোড হয়েছে।':'⚠️ পণ্যের ছবি লোড হয়নি, শুধু লেখা সহ ছবি হয়েছে।'
}
window.openPostBuilder=openPostBuilder;window.setPostSrc=setPostSrc;window.copyPostText=copyPostText;window.downloadPostImage=downloadPostImage;
window.showCatSuggest=showCatSuggest;window.hideCatSuggest=hideCatSuggest;window.pickCat=pickCat;

/* =========================================================
   COUPONS
========================================================= */
let couponsCache=[],couponsError='';
async function refreshCoupons(){
  const {data,error}=await sb.from('coupons').select('*').order('created_at',{ascending:false});
  if(error){couponsError=error.message||'Coupons table not found. Run 4_coupons.sql in Supabase.';couponsCache=[];return}
  couponsError='';couponsCache=data||[]
}
function couponStatus(c){
  const now=Date.now();
  if(c.active===false)return ['Off','red'];
  if(c.starts_at&&new Date(c.starts_at)>now)return ['Scheduled','yellow'];
  if(c.expires_at&&new Date(c.expires_at)<=now)return ['Expired','red'];
  if(c.max_uses!=null&&Number(c.used_count)>=Number(c.max_uses))return ['Used up','red'];
  return ['Active','green']
}
function coupons(){
  if(couponsError)return `<div class="section-head"><div><h3>Coupons</h3></div></div><div class="card"><b>Coupons are not set up yet.</b><p>Open Supabase &gt; SQL Editor, run the file <code>4_coupons.sql</code> once, then press Refresh.</p><p><small>${esc(couponsError)}</small></p><button class="btn muted" onclick="refreshCoupons().then(render)">↻ Refresh</button></div>`;
  const rows=couponsCache.map((c,i)=>{
    const [st,cls]=couponStatus(c);
    const val=c.type==='percent'?Number(c.value)+'% off':money(c.value)+' off';
    return `<tr><td><b>${esc(String(c.code).toUpperCase())}</b>${c.note?`<br><small>${esc(c.note)}</small>`:''}</td><td>${val}</td><td>${money(c.min_order)}</td><td>${Number(c.used_count||0)}${c.max_uses!=null?' / '+Number(c.max_uses):''}</td><td>${c.expires_at?esc(new Date(c.expires_at).toLocaleDateString('en-BD')):'No end'}</td><td>${c.show_public?'Shown':'Hidden'}</td><td><span class="pill ${cls}">${st}</span></td><td class="actions"><button class="btn muted" onclick="toggleCoupon(${i})">${c.active!==false?'Turn off':'Turn on'}</button><button class="btn muted" onclick="editCoupon(${i})">Edit</button><button class="btn danger" onclick="deleteCoupon(${i})">Delete</button></td></tr>`
  }).join('')||`<tr><td colspan="8" class="empty">No coupons yet</td></tr>`;
  return `<div class="section-head"><div><h3>Coupons</h3><p>Discount codes customers type at checkout. The server checks every code, so prices cannot be changed from the browser.</p></div><div class="toolbar"><button class="btn primary" onclick="addCoupon()">＋ New Coupon</button><button class="btn muted" onclick="refreshCoupons().then(render)">↻ Refresh</button></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Ends</th><th>On website</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="orders-count" style="margin-top:12px"><small>"Shown" coupons are listed to every visitor in the Offers/Policies box. "Hidden" ones work only for people who know the code (good for group-specific codes).</small></p>`
}
let editingCouponId=null;
function couponForm(c={}){
  const d=v=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  return `<div class="form-grid">
    <label>Code<input id="couponCodeIn" value="${esc(c.code||'')}" placeholder="FBGROUP10" style="text-transform:uppercase" maxlength="24"></label>
    <label>Type<select id="couponType"><option value="percent" ${c.type!=='flat'?'selected':''}>Percent (%)</option><option value="flat" ${c.type==='flat'?'selected':''}>Fixed amount (৳)</option></select></label>
    <label>Value<input id="couponValue" type="number" min="1" value="${Number(c.value||10)}"></label>
    <label>Minimum order (৳)<input id="couponMin" type="number" min="0" value="${Number(c.min_order||0)}"></label>
    <label>Max uses (blank = unlimited)<input id="couponMax" type="number" min="1" value="${c.max_uses??''}"></label>
    <label>Starts (optional)<input id="couponStart" type="datetime-local" value="${d(c.starts_at)}"></label>
    <label>Ends (optional)<input id="couponEnd" type="datetime-local" value="${d(c.expires_at)}"></label>
    <label>Show on website<select id="couponPublic"><option value="true" ${c.show_public!==false?'selected':''}>Shown to everyone</option><option value="false" ${c.show_public===false?'selected':''}>Hidden (code only)</option></select></label>
    <label>Note (only you see it)<input id="couponNote" value="${esc(c.note||'')}" placeholder="Facebook group offer"></label>
  </div><div class="modal-actions"><button class="btn primary" id="saveCouponBtn" onclick="saveCoupon()">Save Coupon</button></div>`
}
function addCoupon(){editingCouponId=null;openModal('New Coupon',couponForm())}
function editCoupon(i){const c=couponsCache[i];if(!c)return;editingCouponId=c.id;openModal('Edit Coupon',couponForm(c))}
async function saveCoupon(){
  const code=($('couponCodeIn')?.value||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');
  const type=$('couponType')?.value==='flat'?'flat':'percent',value=Number($('couponValue')?.value);
  const min=Number($('couponMin')?.value||0),mx=$('couponMax')?.value;
  if(!code){alert('Enter a coupon code (letters and numbers).');return}
  if(!Number.isFinite(value)||value<=0||(type==='percent'&&value>100)){alert(type==='percent'?'Percent must be between 1 and 100.':'Enter an amount greater than 0.');return}
  if(!Number.isFinite(min)||min<0){alert('Minimum order must be 0 or more.');return}
  const tv=id=>{const v=$(id)?.value;return v?new Date(v).toISOString():null};
  const row={code,type,value,min_order:min,max_uses:mx?Math.max(1,parseInt(mx,10)):null,starts_at:tv('couponStart'),expires_at:tv('couponEnd'),show_public:$('couponPublic')?.value!=='false',note:$('couponNote')?.value.trim()||null};
  try{
    const btn=$('saveCouponBtn');if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const q=editingCouponId?sb.from('coupons').update(row).eq('id',editingCouponId):sb.from('coupons').insert(row);
    const {error}=await q;
    if(error){if(/duplicate|23505/i.test((error.code||'')+(error.message||'')))throw new Error('This coupon code already exists.');throw error}
    await refreshCoupons();closeModal();render()
  }catch(e){showError(e);const btn=$('saveCouponBtn');if(btn){btn.disabled=false;btn.textContent='Save Coupon'}}
}
async function toggleCoupon(i){
  const c=couponsCache[i];if(!c)return;
  try{const {error}=await sb.from('coupons').update({active:c.active===false}).eq('id',c.id);if(error)throw error;await refreshCoupons();render()}catch(e){showError(e)}
}
async function deleteCoupon(i){
  const c=couponsCache[i];if(!c||!confirm(`Delete coupon ${c.code}?`))return;
  try{const {error}=await sb.from('coupons').delete().eq('id',c.id);if(error)throw error;await refreshCoupons();render()}catch(e){showError(e)}
}
window.coupons=coupons;window.refreshCoupons=refreshCoupons;window.addCoupon=addCoupon;window.editCoupon=editCoupon;window.saveCoupon=saveCoupon;window.toggleCoupon=toggleCoupon;window.deleteCoupon=deleteCoupon;

/* =========================================================
   WEBSITE THEME (default colours shown to customers)
========================================================= */
const SITE_THEMES=[
 ['ocean','Ocean Night (current)',1,'#06101f','#25b7ff'],['violet','Neon Violet',1,'#0d0a1f','#a78bfa'],['emerald','Emerald Trust',1,'#05140f','#34d399'],
 ['sunset','Sunset Orange',1,'#140a06','#fb923c'],['gold','Black & Gold',1,'#0a0a0a','#e0b84a'],['slate','Pro Slate',1,'#0f1216','#38bdf8'],
 ['light','Clean White & Blue',0,'#f3f7fc','#1877f2'],['rose','Soft Rose',0,'#fff5f7','#e11d74'],['daraz','Bold Red & White',0,'#f4f4f4','#e8343a'],['mint','Fresh Mint',0,'#effaf6','#0d9f7a']
];
let pendingTheme=null;
function themeCard(s){
  const cur=pendingTheme||s.theme||'ocean';
  const tiles=SITE_THEMES.map(([k,n,d,bg,ac])=>`<button type="button" class="theme-tile ${k===cur?'on':''}" onclick="pickSiteTheme('${k}')"><span class="sw" style="background:${bg}"><i style="background:${ac}"></i></span><b>${esc(n)}</b><small>${d?'Dark':'Light'}</small></button>`).join('');
  return `<style>.theme-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:12px 0}.theme-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border:2px solid #e2e8f0;border-radius:14px;background:#fff;cursor:pointer;font:inherit;color:inherit}.theme-tile.on{border-color:#2563eb;background:#eff6ff}.theme-tile .sw{width:52px;height:52px;border-radius:50%;border:2px solid #cbd5e1;position:relative;overflow:hidden;display:block}.theme-tile .sw i{position:absolute;right:0;bottom:0;width:60%;height:60%;border-top-left-radius:100%}.theme-tile b{font-size:12.5px;text-align:center}.theme-tile small{color:#64748b}</style>
  <div class="card" style="margin-top:16px"><h3>🎨 Website Theme</h3><p>The colour set customers see by default. Customers can still change it for themselves with the 🎨 button on the website; their "Default" option always shows the theme you pick here.</p>
  ${s.has_theme?'':`<p style="color:#b45309"><b>One-time setup needed:</b> run <code>6_theme.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>`}
  <div class="theme-tiles">${tiles}</div>
  <div class="btn-row"><button class="btn primary" id="saveThemeBtn" onclick="saveSiteTheme()" ${s.has_theme?'':'disabled'}>Save Theme</button></div></div>`
}
function pickSiteTheme(k){pendingTheme=k;render()}
async function saveSiteTheme(){
  const s=storeSettingsCache||{};const theme=pendingTheme||s.theme||'ocean';
  if(!SITE_THEMES.some(t=>t[0]===theme)){alert('Choose a theme first.');return}
  const btn=$('saveThemeBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const payload={id:1,store_name:s.store_name||'Paboo',phone:s.phone||'',email:s.email||'',address:s.address||'',support_hours:s.support_hours||'',theme,updated_at:new Date().toISOString()};
    const {error}=await sb.from('store_settings').upsert(payload,{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,theme,updated_at:payload.updated_at};pendingTheme=null;
    alert('Theme saved. Customers will see it the next time they open the website.');
    render()
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save Theme'}}
}
window.themeCard=themeCard;window.pickSiteTheme=pickSiteTheme;window.saveSiteTheme=saveSiteTheme;


/* =========================================================
   PRIVATE BUYING PRICE + PROFIT REPORTS
========================================================= */
let costsCache={},costsReady=true;
async function loadCosts(){
  try{
    const {data,error}=await sb.from('product_costs').select('*');
    if(error)throw error;
    costsCache={};(data||[]).forEach(r=>costsCache[String(r.product_id)]=Number(r.cost||0));costsReady=true;
  }catch(e){costsReady=false;console.warn('product_costs not ready (run 7_reports.sql):',e?.message||e)}
}
function costOf(id){const v=costsCache[String(id)];return v==null?'':v}
async function saveCost(id,raw){
  const txt=String(raw??'').trim();
  if(!costsReady)return;
  if(txt===''){await sb.from('product_costs').delete().eq('product_id',String(id));delete costsCache[String(id)];return}
  const cost=Number(txt);if(!Number.isFinite(cost)||cost<0)return;
  const {error}=await sb.from('product_costs').upsert({product_id:String(id),cost,updated_at:new Date().toISOString()},{onConflict:'product_id'});
  if(error)throw error;costsCache[String(id)]=cost;
}
function sellPrice(p){const d=Number(p.discount||0);return d>0?Math.max(0,Number(p.price||0)-Number(p.price||0)*d/100):Number(p.price||0)}
function marginCell(p){
  const c=costsCache[String(p.id)];
  if(c==null)return '<small style="color:#94a3b8">— set buying price</small>';
  const profit=sellPrice(p)-c,pct=sellPrice(p)>0?Math.round(profit/sellPrice(p)*100):0;
  return `<small>Buy ${money(c)}</small><br><b style="color:${profit>=0?'#15803d':'#b91c1c'}">${profit>=0?'+':''}${money(profit)} (${pct}%)</b>`;
}
function orderItemsArr(o){let it=o.items;if(typeof it==='string'){try{it=JSON.parse(it)}catch(e){it=[]}}return Array.isArray(it)?it:[]}
function unitCost(o,id){const v=o.item_costs&&o.item_costs[String(id)];if(v!=null)return Number(v);const c=costsCache[String(id)];return c==null?0:Number(c)}
function itemCost(o,it){
  const q=Number(it.qty||it.quantity||1);
  if(it.is_combo&&Array.isArray(it.products))return it.products.reduce((s,p)=>s+unitCost(o,p.id),0)*q;
  return unitCost(o,it.id)*q;
}
function orderMetrics(o){
  const items=orderItemsArr(o);
  const sales=Number(o.total??0)-Number(o.delivery_charge??o.delivery_fee??0);
  const cost=o.cost_total!=null?Number(o.cost_total):items.reduce((s,it)=>s+itemCost(o,it),0);
  return {sales,cost,profit:sales-cost,items};
}
function dhakaDay(d){return new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})}
let reportRange='month',reportDelivered=false;
function setReport(r,d){if(r)reportRange=r;if(typeof d==='boolean')reportDelivered=d;render()}
function reports(){
  const now=new Date(),today=dhakaDay(now);
  const ranges={today:'Today',week:'Last 7 days',month:'This month',all:'All time'};
  const ymNow=today.slice(0,7);
  const inRange=o=>{
    if(!o.created_at)return false;const day=dhakaDay(o.created_at);
    if(reportRange==='today')return day===today;
    if(reportRange==='week')return (new Date(today)-new Date(day))/864e5<7&&day<=today;
    if(reportRange==='month')return day.slice(0,7)===ymNow;
    return true;
  };
  const valid=o=>{const s=o.status||'Pending';return reportDelivered?s==='Delivered':s!=='Cancelled'};
  const list=ordersCache.filter(o=>valid(o)&&inRange(o));
  let sales=0,cost=0,profit=0,qty=0;const prod={};
  list.forEach(o=>{const m=orderMetrics(o);sales+=m.sales;cost+=m.cost;profit+=m.profit;
    m.items.forEach(it=>{const q=Number(it.qty||it.quantity||1),nm=it.name||'Product';qty+=q;
      const k=String(it.id||nm),r=prod[k]||(prod[k]={name:nm,qty:0,sales:0,cost:0});
      r.qty+=q;r.sales+=Number(it.price||0)*q;r.cost+=itemCost(o,it)})});
  const margin=sales>0?Math.round(profit/sales*100):0,avg=list.length?Math.round(sales/list.length):0;
  const trend=Object.values(prod).sort((a,b)=>b.qty-a.qty||b.sales-a.sales).slice(0,10);
  // last 14 days
  const days=[];for(let i=13;i>=0;i--){const d=new Date(now.getTime()-i*864e5);days.push(dhakaDay(d))}
  const dm={};days.forEach(d=>dm[d]={n:0,sales:0,profit:0});
  ordersCache.filter(valid).forEach(o=>{if(!o.created_at)return;const d=dhakaDay(o.created_at);if(dm[d]){const m=orderMetrics(o);dm[d].n++;dm[d].sales+=m.sales;dm[d].profit+=m.profit}});
  const maxS=Math.max(1,...days.map(d=>dm[d].sales));
  const missing=productsCache.filter(p=>p.active!==false&&costsCache[String(p.id)]==null).length;
  const exps=expensesCache.filter(e=>expInRange(e.day,today,ymNow));
  const expTotal=exps.reduce((a,e)=>a+Number(e.amount||0),0);
  const stk=productsCache.reduce((s,p)=>s+(costsCache[String(p.id)]||0)*Number(p.stock||0),0);
  return `<div class="section-head"><div><h3>Reports</h3><p>Profit, sales and trending products</p></div><button class="btn muted" onclick="refreshDashboard()">↻ Refresh</button></div>
  ${costsReady?'':'<div class="card" style="border-color:#f59e0b;margin-bottom:12px"><b>One-time setup:</b> run <code>7_reports.sql</code> in Supabase &gt; SQL Editor, then press Refresh. Until then, profit uses 0 as buying price.</div>'}
  <div class="filters" style="align-items:center">${Object.entries(ranges).map(([k,n])=>`<button class="btn ${reportRange===k?'primary':'muted'}" onclick="setReport('${k}')">${n}</button>`).join('')}
   <label style="font-size:12px;display:flex;gap:6px;align-items:center;margin-left:6px"><input type="checkbox" ${reportDelivered?'checked':''} onchange="setReport(null,this.checked)"> Delivered orders only</label></div>
  <div class="stats-grid">${stat('▤','Orders',list.length)}${stat('৳','Sales (excl. delivery)',money(sales))}${stat('⬇','Buying cost',money(cost))}${stat('✓','Profit',`<span style="color:${profit>=0?'#15803d':'#b91c1c'}">${money(profit)}</span>`)}
   ${stat('📣','Ad / courier / other costs',money(expTotal))}${stat('★','Net profit (after costs)',`<span style="color:${profit-expTotal>=0?'#15803d':'#b91c1c'}">${money(profit-expTotal)}</span>`)}${stat('%','Profit margin',margin+'%')}${stat('◉','Items sold',qty)}${stat('∅','Avg order',money(avg))}${stat('▣','Stock value (at buy price)',money(stk))}</div>
  ${missing?`<p style="font-size:12px;color:#b45309">⚠ ${missing} active product(s) have no buying price yet — profit for them counts as 100%. Add it in Products &gt; Edit.</p>`:''}
  <div class="section-head" style="margin-top:18px"><div><h3>🔥 Trending products</h3><p>Most sold in the selected period</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Product</th><th>Sold</th><th>Sales</th><th>Profit</th></tr></thead><tbody>
  ${trend.length?trend.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.name)}</b></td><td>${r.qty}</td><td>${money(r.sales)}</td><td style="color:${r.sales-r.cost>=0?'#15803d':'#b91c1c'}"><b>${money(r.sales-r.cost)}</b></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No sales in this period</td></tr>'}</tbody></table></div>
  <div class="section-head" style="margin-top:18px"><div><h3>Last 14 days</h3><p>Orders, sales and profit per day</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Orders</th><th>Sales</th><th></th><th>Profit</th></tr></thead><tbody>
  ${days.slice().reverse().map(d=>`<tr><td>${d}</td><td>${dm[d].n}</td><td>${money(dm[d].sales)}</td><td style="min-width:120px"><div style="height:8px;border-radius:4px;background:#2563eb;width:${Math.round(dm[d].sales/maxS*100)}%"></div></td><td style="color:${dm[d].profit>=0?'#15803d':'#b91c1c'}">${money(dm[d].profit)}</td></tr>`).join('')}</tbody></table></div>
  ${expenseCard(exps)}
  <p style="font-size:12px;color:#7c8799;margin-top:10px">Profit = sales (after coupon, without delivery charge) − buying price. Cancelled orders are never counted. Buying prices are private: only you can read them.</p>`;
}

/* =========================================================
   PRODUCT COLUMN PICKER (customer site) ON/OFF
========================================================= */
function colsCard(s){
  return `<div class="card" style="margin-top:16px"><h3>▦ Product columns picker</h3>
  <p>When ON, customers see a 1 / 2 / 3 / 4 / 5 buttons row above the products and can choose how many products to see per row (their choice is remembered). When OFF, the website looks exactly as before.</p>
  ${s.has_cols?'':'<p style="color:#b45309"><b>One-time setup needed:</b> run <code>7_reports.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>'}
  <label style="display:flex;gap:8px;align-items:center;font-weight:700"><input id="colsToggle" type="checkbox" ${s.col_picker?'checked':''} ${s.has_cols?'':'disabled'}> Show columns picker to customers</label>
  <div class="btn-row"><button class="btn primary" id="saveColsBtn" onclick="saveColsSetting()" ${s.has_cols?'':'disabled'}>Save</button></div></div>`
}
/* ---- Policies editor (Admin > Policies) ---- */
const POL_CARDS=[['warranty','🛡 Warranty'],['returns','↩ Return & replacement'],['delivery','🚚 Delivery'],['payment','💵 Payment']];
function polChk(id,on,label){return `<label class="pol-chk"><input type="checkbox" id="${id}" ${on?'checked':''}> ${label}</label>`}
function policiesPage(){
  const s=storeSettingsCache||{},P=s.policies||{},C=P.cards||{},dis=s.has_policies?'':'disabled';
  const card=(k,label)=>{
    const c=C[k]||{},t=c.times||{};
    const on=c.show!==false;
    let more='';
    if(k==='delivery'){
      more=`<div class="pol-row">${polChk('pol_delivery_fee',c.show_fee!==false,'Show delivery charge (৳)')}${polChk('pol_delivery_time',c.show_time!==false,'Show delivery time')}${polChk('pol_delivery_note',c.show_note!==false,'Show "nearby districts" note')}</div>
      <div class="form-grid"><label>Dhaka time<input id="pol_t_dhaka" value="${esc(t.dhaka||'')}" placeholder="e.g. 24 hours"></label><label>Nearby Dhaka time<input id="pol_t_nearby" value="${esc(t.nearby||'')}" placeholder="e.g. 2-3 days"></label><label>Outside Dhaka time<input id="pol_t_outside" value="${esc(t.outside||'')}" placeholder="e.g. 3-5 days"></label></div>
      <small>Delivery charges themselves are changed in Admin &gt; Delivery. Leave a time box empty to keep the default.</small>`;
    }else{
      more=`<label>Text (optional)<textarea id="pol_body_${k}" rows="5" placeholder="Leave empty to keep the default text. Start a line with - to make a bullet point.">${esc(c.body||'')}</textarea></label>`;
    }
    return `<div class="card pol-card"><h3>${label}</h3>${polChk('pol_show_'+k,on,'Show this card on the website')}
    <label>Title (optional)<input id="pol_title_${k}" value="${esc(c.title||'')}" placeholder="Leave empty to keep the default title"></label>${more}</div>`;
  };
  const ex=Array.isArray(P.extra)?P.extra:[];
  const extra=[0,1,2].map(n=>{const x=ex[n]||{};return `<div class="card pol-card"><h3>➕ Extra card ${n+1}</h3>${polChk('pol_x_show_'+n,x.show!==false,'Show this card')}
    <label>Title<input id="pol_x_title_${n}" value="${esc(x.title||'')}" placeholder="e.g. Cash on delivery rules"></label>
    <label>Text<textarea id="pol_x_body_${n}" rows="4" placeholder="Write your own policy. Start a line with - for bullet points.">${esc(x.body||'')}</textarea></label></div>`}).join('');
  return `<div class="section-head"><div><h3>Policies</h3><p>Edit or hide what customers read in the "Our Policies" section</p></div><div class="toolbar"><button class="btn muted" onclick="loadStoreSettings().then(render).catch(showError)">↻ Refresh</button><button class="btn primary" id="savePolBtn" onclick="savePolicies()" ${dis}>Save</button></div></div>
  ${s.has_policies?'':'<p style="color:#b45309"><b>One-time setup needed:</b> run <code>12_policies.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>'}
  <div class="card pol-card"><h3>📜 Whole section</h3>${polChk('pol_section',P.section!==false,'Show the "Our Policies" section on the website')}<small>Turn this off to hide every policy card and the menu link at once.</small></div>
  <div class="pol-grid">${POL_CARDS.map(([k,l])=>card(k,l)).join('')}${extra}</div>
  <div class="btn-row"><button class="btn primary" onclick="savePolicies()" ${dis}>Save</button></div>
  <style>.pol-card{margin-bottom:14px;display:grid;gap:10px}.pol-card textarea,.pol-card input:not([type=checkbox]){width:100%}.pol-chk{display:flex;gap:8px;align-items:center;font-weight:700}.pol-row{display:flex;gap:16px;flex-wrap:wrap}.pol-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.pol-grid .pol-card{margin-bottom:0}</style>`;
}
async function savePolicies(){
  const g=id=>$(id)?.value.trim()||'',ck=id=>!!$(id)?.checked;
  const cards={};
  POL_CARDS.forEach(([k])=>{
    const c={show:ck('pol_show_'+k)};
    if(g('pol_title_'+k))c.title=g('pol_title_'+k);
    if(k==='delivery'){
      c.show_fee=ck('pol_delivery_fee');c.show_time=ck('pol_delivery_time');c.show_note=ck('pol_delivery_note');
      const t={};['dhaka','nearby','outside'].forEach(z=>{if(g('pol_t_'+z))t[z]=g('pol_t_'+z)});if(Object.keys(t).length)c.times=t;
    }else if(g('pol_body_'+k))c.body=$('pol_body_'+k).value.trim();
    cards[k]=c;
  });
  const extra=[];
  [0,1,2].forEach(n=>{const title=g('pol_x_title_'+n),body=$('pol_x_body_'+n)?.value.trim()||'';if(title||body)extra.push({title,body,show:ck('pol_x_show_'+n)})});
  const policies={section:ck('pol_section'),cards,extra};
  const s=storeSettingsCache||{},btn=$('savePolBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const {error}=await sb.from('store_settings').upsert({id:1,store_name:s.store_name||'Paboo',policies,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,policies};
    alert('Policies saved. Refresh your website to see the change.');
    render();
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save'}}
}
window.policiesPage=policiesPage;window.savePolicies=savePolicies;
/* ---- Social & contact buttons (Facebook / TikTok / WhatsApp) ---- */
function socialCard(s){
  const S=s.social||{},dis=s.has_social?'':'disabled';
  const row=(k,label,icon,val,ph,extra='')=>{
    const cfg=S[k]||{};
    return `<div class="soc-edit"><label class="pol-chk"><input type="checkbox" id="soc_show_${k}" ${cfg.show!==false?'checked':''} ${dis}> ${icon} ${label} — show on website</label>
    <label>${k==='whatsapp'?'WhatsApp number (with 880...)':'Page link or username'}<input id="soc_${k}" value="${esc(val)}" placeholder="${esc(ph)}" ${dis}></label>${extra}</div>`};
  const wa=(S.whatsapp&&S.whatsapp.number)||'8801320992683';
  const fb=(S.facebook&&S.facebook.url)!==undefined?S.facebook.url:'https://facebook.com/paboo.official';
  const tk=(S.tiktok&&S.tiktok.url)||'';
  return `<div class="card" style="margin-top:16px"><h3>💬 Contact buttons: Facebook, TikTok, WhatsApp</h3>
  <p>These buttons appear under "Our Policies" at the bottom of your website, on the Contact Us page, and inside the round WhatsApp button (which opens all three). Turn one off to hide it everywhere. Leave a link empty to hide that button.</p>
  ${s.has_social?'':'<p style="color:#b45309"><b>One-time setup needed:</b> run <code>13_social.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>'}
  <div class="soc-grid">
  ${row('facebook','Facebook','🔵',fb,'https://facebook.com/paboo.official')}
  ${row('tiktok','TikTok','🎵',tk,'https://www.tiktok.com/@paboobd  or  @paboobd')}
  ${row('whatsapp','WhatsApp','🟢',wa,'8801XXXXXXXXX',`<label>First message customers see (optional)<input id="soc_wa_msg" value="${esc((S.whatsapp&&S.whatsapp.message)||'')}" placeholder="Hello Paboo, I need help with an order." ${dis}></label>`)}
  </div>
  <div class="btn-row"><button class="btn primary" id="saveSocBtn" onclick="saveSocial()" ${dis}>Save</button></div>
  <style>.soc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin:12px 0}.soc-edit{display:grid;gap:8px;padding:12px;border:1px solid #e2e8f0;border-radius:12px}.soc-edit input:not([type=checkbox]){width:100%}</style></div>`;
}
async function saveSocial(){
  const g=id=>($(id)?.value||'').trim(),ck=id=>!!$(id)?.checked;
  let wa=g('soc_whatsapp').replace(/\D/g,'');
  if(wa&&!/^8801\d{9}$/.test(wa)){
    if(/^01\d{9}$/.test(wa))wa='88'+wa;
    else{alert('WhatsApp number should look like 8801XXXXXXXXX (country code 880 + 01XXXXXXXXX).');return}
  }
  const chkUrl=(v,name)=>{if(!v)return true;if(/^https?:\/\//i.test(v))return true;if(/^[\w.@\/-]+$/.test(v))return true;alert(name+' link/username looks wrong.');return false};
  const fb=g('soc_facebook'),tk=g('soc_tiktok');
  if(!chkUrl(fb,'Facebook')||!chkUrl(tk,'TikTok'))return;
  const social={
    facebook:{show:ck('soc_show_facebook'),url:fb},
    tiktok:{show:ck('soc_show_tiktok'),url:tk},
    whatsapp:{show:ck('soc_show_whatsapp'),number:wa,message:g('soc_wa_msg')}
  };
  const s=storeSettingsCache||{},btn=$('saveSocBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const {error}=await sb.from('store_settings').upsert({id:1,store_name:s.store_name||'Paboo',social,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,social};
    alert('Saved. Refresh your website to see the change.');
    render();
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save'}}
}
window.saveSocial=saveSocial;
function variantsCard(s){
  return `<div class="card" style="margin-top:16px"><h3>🎨 Product variants (colour / size)</h3>
  <p>When ON, products that have variants (added in the product form) show option buttons; the customer must pick one before adding to cart, and stock is tracked per option. When OFF, the website works exactly as before and variants are ignored.</p>
  ${s.has_variants?'':'<p style="color:#b45309"><b>One-time setup needed:</b> run <code>10_variants.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>'}
  <label style="display:flex;gap:8px;align-items:center;font-weight:700"><input id="variantsToggle" type="checkbox" ${s.variants_on?'checked':''} ${s.has_variants?'':'disabled'}> Enable product variants for customers</label>
  <div class="btn-row"><button class="btn primary" id="saveVariantsBtn" onclick="saveVariantsSetting()" ${s.has_variants?'':'disabled'}>Save</button></div></div>`
}
async function saveVariantsSetting(){
  const s=storeSettingsCache||{};const on=!!$('variantsToggle')?.checked;const btn=$('saveVariantsBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const {error}=await sb.from('store_settings').upsert({id:1,store_name:s.store_name||'Paboo',variants_on:on,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,variants_on:on};
    alert(on?'Product variants are now ON for customers.':'Product variants are OFF. The website works as before.');
    render()
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save'}}
}
window.saveVariantsSetting=saveVariantsSetting;
async function saveColsSetting(){
  const s=storeSettingsCache||{};const on=!!$('colsToggle')?.checked;const btn=$('saveColsBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const {error}=await sb.from('store_settings').upsert({id:1,store_name:s.store_name||'Paboo',col_picker:on,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,col_picker:on};
    alert(on?'Columns picker is now ON for customers.':'Columns picker is OFF. The website looks as before.');
    render()
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save'}}
}
window.reports=reports;window.setReport=setReport;window.saveColsSetting=saveColsSetting;window.colsCard=colsCard;


/* =========================================================
   FAKE-ORDER PROTECTION, EXPENSES, INCOMPLETE ORDERS
========================================================= */
let blockedCache=[],expensesCache=[],leadsCache=[],protectReady=true;
function phoneKey(v){return String(v||'').replace(/\D/g,'').slice(-10)}
async function loadProtect(){
  try{
    const [b,e,l]=await Promise.all([
      sb.from('blocked_phones').select('*').order('created_at',{ascending:false}),
      sb.from('expenses').select('*').order('day',{ascending:false}).limit(500),
      sb.from('incomplete_orders').select('*').order('updated_at',{ascending:false}).limit(300)]);
    if(b.error)throw b.error;if(e.error)throw e.error;if(l.error)throw l.error;
    blockedCache=b.data||[];expensesCache=e.data||[];leadsCache=l.data||[];protectReady=true;
  }catch(err){protectReady=false;console.warn('8_protect.sql not run yet:',err?.message||err)}
}
function setupNote(){return protectReady?'':'<div class="card" style="border-color:#f59e0b;margin-bottom:12px"><b>One-time setup:</b> run <code>8_protect.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</div>'}
function isBlocked(v){const k=phoneKey(v);return !!k&&blockedCache.some(b=>b.phone_key===k)}
function riskBadge(o){
  const ph=o.phone||o.customer_phone||'';const k=phoneKey(ph);if(!k)return '';
  let out='';
  if(isBlocked(ph))out+=' <span class="pill red">🚫 Blocked</span>';
  const mine=ordersCache.filter(x=>x!==o&&phoneKey(x.phone||x.customer_phone)===k);
  const canc=mine.filter(x=>(x.status||'')==='Cancelled').length,del=mine.filter(x=>(x.status||'')==='Delivered').length;
  if(canc>0)out+=` <span class="pill yellow" title="Earlier orders from this number">⚠ ${canc} cancelled before</span>`;
  else if(del>0)out+=` <span class="pill green" title="Earlier orders from this number">✓ ${del} delivered before</span>`;
  return out?'<br>'+out:'';
}
function blockBtn(o){
  const ph=o.phone||o.customer_phone||'';if(!phoneKey(ph))return '';
  return isBlocked(ph)?`<button class="btn muted" onclick="unblockNumber('${phoneKey(ph)}')">Unblock number</button>`:`<button class="btn danger" onclick="blockNumber('${esc(ph)}')">🚫 Block number</button>`;
}
async function blockNumber(ph,reason){
  const k=phoneKey(ph);if(k.length<10){alert('Enter a valid phone number.');return}
  if(reason===undefined){reason=prompt('Why block '+ph+'? (optional, only you see this)','Fake / repeated cancelled orders');if(reason===null)return}
  try{
    const {error}=await sb.from('blocked_phones').upsert({phone_key:k,phone:String(ph).trim(),reason:reason||''},{onConflict:'phone_key'});
    if(error)throw error;await loadProtect();closeModal();render();
    alert('Blocked. This number can no longer place orders.');
  }catch(e){showError(e)}
}
async function unblockNumber(k){
  if(!confirm('Allow this number to order again?'))return;
  try{const {error}=await sb.from('blocked_phones').delete().eq('phone_key',k);if(error)throw error;await loadProtect();closeModal();render()}catch(e){showError(e)}
}
function blockedPage(){
  return `<div class="section-head"><div><h3>Blocked numbers</h3><p>Orders from these numbers are refused by the server</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn muted" onclick="loadProtect().then(render)">↻ Refresh</button><button class="btn" onclick="checkLeadSetup()">🔧 সেটআপ পরীক্ষা</button></div></div>${setupNote()}
  <div class="card"><div class="filters"><input class="input" id="blkPhone" placeholder="01XXXXXXXXX" inputmode="tel"><input class="input" id="blkReason" placeholder="Reason (optional)"><button class="btn danger" onclick="blockNumber($('blkPhone').value,$('blkReason').value)">🚫 Block</button></div></div>
  <div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Number</th><th>Reason</th><th>Date</th><th></th></tr></thead><tbody>
  ${blockedCache.length?blockedCache.map(b=>`<tr><td><b>${esc(b.phone||b.phone_key)}</b></td><td>${esc(b.reason||'—')}</td><td>${esc(new Date(b.created_at).toLocaleDateString('en-BD'))}</td><td><button class="btn muted" onclick="unblockNumber('${esc(b.phone_key)}')">Unblock</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">No blocked numbers</td></tr>'}</tbody></table></div>`;
}
/* incomplete orders */
function leadMsg(l){
  const items=(Array.isArray(l.items)?l.items:[]).map(i=>`${i.name||'পণ্য'} x${i.qty||1}`).join(', ');
  return `আসসালামু আলাইকুম ${l.name||''}, Paboo থেকে বলছি। আপনি ${items||'কিছু পণ্য'} অর্ডার করতে চেয়েছিলেন। কোনো সাহায্য লাগলে বলুন, আমরা এখনই অর্ডারটা কনফার্ম করে দিই। 😊`;
}
async function checkLeadSetup(){
  const out=[];
  try{
    const t=await sb.from('incomplete_orders').select('phone_key').limit(1);
    if(t.error){alert('❌ টেবিল পড়া যাচ্ছে না।\nকারণ: '+(t.error.message||t.error)+'\n\nসমাধান: Supabase > SQL Editor এ 8_protect.sql চালান, তারপর আবার পরীক্ষা করুন।');return}
    out.push('✅ টেবিল ঠিক আছে');
    const r=await sb.rpc('save_incomplete',{p_name:'TEST',p_phone:'01000000001',p_items:[{name:'test',qty:1}],p_total:1});
    if(r.error){alert(out.join('\n')+'\n❌ সাইট থেকে সেভ করার ফাংশন কাজ করছে না।\nকারণ: '+(r.error.message||r.error)+'\n\nসমাধান: 8_protect.sql আবার পুরোটা চালান।');return}
    const c=await sb.from('incomplete_orders').select('phone_key').eq('phone_key','1000000001');
    if(c.data&&c.data.length){out.push('✅ সাইট থেকে সেভ হচ্ছে');await sb.from('incomplete_orders').delete().eq('phone_key','1000000001')}
    else out.push('⚠ ফাংশন চলেছে কিন্তু কিছু সেভ হয়নি');
    out.push('\nসবকিছু চালু আছে। এখন সাইটে কার্টে পণ্য রেখে চেকআউটে নাম ও ১১ সংখ্যার ফোন নম্বর দিন, ২ সেকেন্ড পর Refresh চাপুন।');
    alert(out.join('\n'));await loadProtect();render();
  }catch(e){showError(e)}
}
window.checkLeadSetup=checkLeadSetup;
function leadsPage(){
  const rows=leadsCache.map((l,i)=>{
    const items=(Array.isArray(l.items)?l.items:[]).map(x=>`${esc(x.name||'')} ×${Number(x.qty||1)}`).join('<br>');
    const ph=waPhone(l.phone);
    return `<tr><td><b>${esc(l.name||'—')}</b><br><small>${esc(l.phone||'')}</small></td><td>${items||'—'}</td><td>${money(l.total)}</td><td><small>${esc(new Date(l.updated_at).toLocaleString('en-BD'))}</small></td><td>${l.contacted?'<span class="pill green">Contacted</span>':'<span class="pill yellow">New</span>'}</td>
    <td class="actions">${ph?`<a class="btn" style="background:#1fa855;color:#fff;text-decoration:none;display:inline-block" target="_blank" rel="noopener" href="https://wa.me/${ph}?text=${encodeURIComponent(leadMsg(l))}" onclick="markLead(${i},true)">WhatsApp</a>`:''}<button class="btn muted" onclick="markLead(${i},${!l.contacted})">${l.contacted?'Mark new':'Mark contacted'}</button><button class="btn danger" onclick="deleteLead(${i})">Delete</button></td></tr>`}).join('');
  return `<div class="section-head"><div><h3>Incomplete orders</h3><p>Customers who typed their phone at checkout but did not place the order. A lead disappears automatically once they order.</p></div><button class="btn muted" onclick="loadProtect().then(render)">↻ Refresh</button></div>${setupNote()}
  <div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Cart</th><th>Total</th><th>Last seen</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No incomplete orders right now</td></tr>'}</tbody></table></div>`;
}
async function markLead(i,v){const l=leadsCache[i];if(!l)return;try{const {error}=await sb.from('incomplete_orders').update({contacted:!!v}).eq('phone_key',l.phone_key);if(error)throw error;l.contacted=!!v;setTimeout(render,200)}catch(e){showError(e)}}
async function deleteLead(i){const l=leadsCache[i];if(!l||!confirm('Delete this lead?'))return;try{const {error}=await sb.from('incomplete_orders').delete().eq('phone_key',l.phone_key);if(error)throw error;leadsCache.splice(i,1);render()}catch(e){showError(e)}}
/* expenses (inside Reports) */
function expInRange(day,today,ymNow){
  if(!day)return false;
  if(reportRange==='today')return day===today;
  if(reportRange==='week')return (new Date(today)-new Date(day))/864e5<7&&day<=today;
  if(reportRange==='month')return String(day).slice(0,7)===ymNow;
  return true;
}
const EXP_KINDS={ads:'📣 Ads (Facebook/TikTok)',courier:'🚚 Courier',other:'Other'};
function expenseCard(list){
  return `<div class="section-head" style="margin-top:18px"><div><h3>Costs (ads, courier, other)</h3><p>Add your daily spending. It is subtracted from profit above.</p></div></div>${setupNote()}
  <div class="card"><div class="filters"><input class="input" id="expDay" type="date" value="${dhakaDay(new Date())}"><select class="select" id="expKind">${Object.entries(EXP_KINDS).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select><input class="input" id="expAmt" type="number" min="0" placeholder="Amount ৳"><input class="input" id="expNote" placeholder="Note (optional)"><button class="btn primary" onclick="addExpense()">＋ Add cost</button></div></div>
  <div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>
  ${list.length?list.map(e=>`<tr><td>${esc(e.day)}</td><td>${esc(EXP_KINDS[e.kind]||e.kind)}</td><td><b>${money(e.amount)}</b></td><td>${esc(e.note||'')}</td><td><button class="btn danger" onclick="deleteExpense(${e.id})">Delete</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No costs added in this period</td></tr>'}</tbody></table></div>`;
}
async function addExpense(){
  const amount=Number($('expAmt')?.value);if(!Number.isFinite(amount)||amount<=0){alert('Enter the amount.');return}
  try{
    const {error}=await sb.from('expenses').insert({day:$('expDay').value||dhakaDay(new Date()),kind:$('expKind').value,amount,note:($('expNote').value||'').trim()});
    if(error)throw error;await loadProtect();render();
  }catch(e){showError(e)}
}
async function deleteExpense(id){if(!confirm('Delete this cost?'))return;try{const {error}=await sb.from('expenses').delete().eq('id',id);if(error)throw error;await loadProtect();render()}catch(e){showError(e)}}
window.blocked=blockedPage;window.leads=leadsPage;
window.blockNumber=blockNumber;window.unblockNumber=unblockNumber;window.markLead=markLead;window.deleteLead=deleteLead;window.addExpense=addExpense;window.deleteExpense=deleteExpense;window.loadProtect=loadProtect;


/* =========================================================
   COURIER & TRACKING NUMBER (shown to customers only when the admin switch is ON)
========================================================= */
const COURIERS=['Steadfast','Pathao','RedX','Paperfly','eCourier','SA Paribahan','Sundarban','Other'];
function courierBox(i,o){
  const cur=o.courier||'';
  return `<hr><b>🚚 Courier &amp; tracking</b><div class="form-grid" style="margin-top:8px"><label>Courier<select id="courierSel"><option value="">— none —</option>${COURIERS.map(c=>`<option ${cur===c?'selected':''}>${c}</option>`).join('')}${cur&&!COURIERS.includes(cur)?`<option selected>${esc(cur)}</option>`:''}</select></label><label>Tracking / consignment no.<input id="trackNo" value="${esc(o.tracking_no||'')}" placeholder="e.g. 12345678"></label></div><div class="btn-row"><button class="btn primary" onclick="saveCourier(${i})">Save courier info</button></div>`;
}
async function saveCourier(i){
  const o=ordersCache[i];if(!o)return;
  const courier=($('courierSel')?.value||'').trim(),tracking_no=($('trackNo')?.value||'').trim().slice(0,60);
  try{
    const {error}=await sb.from('orders').update({courier:courier||null,tracking_no:tracking_no||null,updated_at:new Date().toISOString()}).eq('id',o.id);
    if(error)throw error;
    o.courier=courier||null;o.tracking_no=tracking_no||null;
    alert('Courier info saved.');
  }catch(e){
    if(/courier|tracking_no|column/i.test(e?.message||''))alert('One-time setup needed: run 9_tracking.sql in Supabase > SQL Editor, then try again.');
    else showError(e)
  }
}
function trackingCard(s){
  return `<div class="card" style="margin-top:16px"><h3>🚚 Parcel tracking for customers</h3>
  <p>When ON, customers who track their order with their phone number also see the courier name and tracking number you saved on the order. When OFF, they see nothing (the website never even receives it). You can switch it any time.</p>
  ${s.has_tracking?'':'<p style="color:#b45309"><b>One-time setup needed:</b> run <code>9_tracking.sql</code> in Supabase &gt; SQL Editor, then press Refresh.</p>'}
  <label style="display:flex;gap:8px;align-items:center;font-weight:700"><input id="trackToggle" type="checkbox" ${s.show_tracking?'checked':''} ${s.has_tracking?'':'disabled'}> Show courier &amp; tracking number to customers</label>
  <div class="btn-row"><button class="btn primary" id="saveTrackBtn" onclick="saveTrackingSetting()" ${s.has_tracking?'':'disabled'}>Save</button></div></div>`
}
async function saveTrackingSetting(){
  const s=storeSettingsCache||{};const on=!!$('trackToggle')?.checked;const btn=$('saveTrackBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const {error}=await sb.from('store_settings').upsert({id:1,store_name:s.store_name||'Paboo',show_tracking:on,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    storeSettingsCache={...s,show_tracking:on};
    alert(on?'Customers can now see courier & tracking number.':'Tracking info is now hidden from customers.');
    render()
  }catch(e){showError(e);if(btn){btn.disabled=false;btn.textContent='Save'}}
}
window.courierBox=courierBox;window.saveCourier=saveCourier;window.trackingCard=trackingCard;window.saveTrackingSetting=saveTrackingSetting;
