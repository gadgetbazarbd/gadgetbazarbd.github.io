// Paboo — customer site / Supabase
const SUPABASE_URL="https://vwwysrdqexjtlmpmevub.supabase.co";
const SUPABASE_KEY="sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=id=>document.getElementById(id);
const money=n=>"৳"+Number(n||0).toLocaleString("en-BD");

const DEFAULT_DELIVERY_SETTINGS={dhaka:60,nearby:100,outside:130};
let DELIVERY_SETTINGS={...DEFAULT_DELIVERY_SETTINGS};
let NEARBY_DISTRICTS=["Gazipur","Narayanganj","Narsingdi","Munshiganj","Manikganj"];
let PAYMENT_SETTINGS={cod_enabled:true,bkash_enabled:false,bkash_number:"",nagad_enabled:false,nagad_number:""};
let categories=[],products=[],cart=[],storeOffers=[],activeDealType="";
try {
 const savedCart=JSON.parse(localStorage.getItem("gbbd_cart")||"[]");
 cart=Array.isArray(savedCart)?savedCart.filter(x=>x&&Number(x.qty)>0&&(x.type==="combo"?x.offerId!=null:x.id!=null)).map(x=>x.type==="combo"?({type:"combo",offerId:String(x.offerId),qty:Math.max(1,Math.floor(Number(x.qty)||1))}):({id:x.id,qty:Math.max(1,Math.floor(Number(x.qty)||1))})):[];
} catch(e) { cart=[]; }
let currentCategory="All Products",selectedDistrict="",selectedUpazila="";
let locationData=[],locationLoaded=false;
function loadSavedIds(key,limit=Infinity){try{const v=JSON.parse(localStorage.getItem(key)||"[]");return new Set((Array.isArray(v)?v:[]).map(String).slice(0,limit));}catch(e){console.warn("Saved product list could not be read",key,e);return new Set();}}
let wishlistIds=loadSavedIds("gbbd_wishlist");
let compareIds=loadSavedIds("gbbd_compare",3);
let appliedCoupon="";
const COUPONS={WELCOME5:{type:"percent",value:5,min:500},GADGET50:{type:"flat",value:50,min:1000}};

/* =====================================================
   STORE DETAILS — edit this block, nothing else needed.
   Contact cards and the WhatsApp button appear on the
   site only for the fields you fill in.
===================================================== */
const STORE_INFO={
 whatsapp:"8801320992683",   // country code + number, digits only. Example: "8801XXXXXXXXX"
 phone:"",      // Example: "01XXXXXXXXX"
 email:"",      // Example: "hello@yourshop.com"
 facebook:"",   // Full page link. Example: "https://facebook.com/yourpage"
 address:"",    // Shop / pickup address, if you want to show one
 hours:""       // Example: "Every day, 10 AM to 10 PM"
};
// Estimated delivery time per zone (shown at checkout and in Policies). Change to match your couriers.
const DELIVERY_TIME={dhaka:"24 hours (max 36 hours)",nearby:"2–3 days",outside:"72 hours (max 5 days)"};
// Returns window shown in Policies.
const DELIVERY_TIME_BN={dhaka:"২৪ ঘণ্টা (সর্বোচ্চ ৩৬ ঘণ্টা)",nearby:"২–৩ দিন",outside:"৭২ ঘণ্টা (সর্বোচ্চ ৫ দিন)"};
const DISTRICT_BN={Gazipur:"গাজীপুর",Narayanganj:"নারায়ণগঞ্জ",Narsingdi:"নরসিংদী",Munshiganj:"মুন্সীগঞ্জ",Manikganj:"মানিকগঞ্জ"};
const RETURN_WINDOW="৭ দিনের";

function toast(msg){
 let t=$("gbToast"); if(!t){t=document.createElement("div");t.id="gbToast";t.className="gb-toast";document.body.appendChild(t);}
 t.textContent=msg;t.classList.add("show");clearTimeout(window.__gbToastTimer);
 window.__gbToastTimer=setTimeout(()=>t.classList.remove("show"),1600);
}
function saveCart(){try{localStorage.setItem("gbbd_cart",JSON.stringify(cart));}catch(e){console.warn("Cart could not be saved locally",e);}updateCart();}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function jsArg(v){return "'"+String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/</g,'\\x3c')+"'";}

function saleWindow(r){const s=Date.parse(r.sale_starts_at||""),e=Date.parse(r.sale_ends_at||"");return{s:Number.isFinite(s)?s:null,e:Number.isFinite(e)?e:null};}
function discountNow(raw,w){const n=Date.now();if(w.s===null&&w.e===null)return raw;return((w.s===null||w.s<=n)&&(w.e===null||w.e>n))?raw:0;}
/* ---- Product variants (colour / size) — only active when the admin switch is ON ---- */
let GB_VARS_ON=false;const gbPicked={};
function gbParseVars(v){if(typeof v==="string"){try{v=JSON.parse(v)}catch(e){v=[]}}if(!Array.isArray(v))return[];return v.map(x=>({name:String((x&&x.name)||"").trim(),stock:Math.max(0,Math.floor(Number(x&&x.stock)||0)),price:Number(x&&x.price)>0?Number(x.price):0})).filter(x=>x.name);}
function pvars(p){return GB_VARS_ON&&p&&Array.isArray(p.variants)&&p.variants.length?p.variants:[];}
function vOf(p,n){return n?pvars(p).find(v=>v.name===n)||null:null;}
function stockOf(p,n){const v=vOf(p,n);return v?v.stock:(Number(p.stock)||0);}
function gbVar(id){const p=getProduct(id);const n=gbPicked[String(id)];return p&&vOf(p,n)?n:null;}
function variantChips(p){
 const vs=pvars(p);if(!vs.length)return"";const cur=gbVar(p.id);
 return `<div class="variant-box"><div class="variant-title">Option</div><div class="variant-chips">${vs.map(v=>`<button type="button" class="variant-chip ${cur===v.name?'active':''}" ${v.stock<=0?'disabled':''} onclick="gbPickVariant(${esc(jsArg(p.id))},${esc(jsArg(v.name))})">${esc(v.name)}${v.stock<=0?'<span class="vc-sub">Sold out</span>':(v.price>0?'<span class="vc-sub">'+money(v.price)+'</span>':'')}</button>`).join('')}</div>${cur?`<small class="variant-note">In stock: ${stockOf(p,cur)}</small>`:'<small class="variant-note">Choose an option first</small>'}</div>`;
}
function gbPickVariant(id,name){gbPicked[String(id)]=name;const m=$('productDetailsModal');if(m&&m.classList.contains('is-open'))viewProductDetails(id);else handleProductPageRoute();}
window.gbPickVariant=gbPickVariant;
function normalizeProduct(r){const _w=saleWindow(r);return{
 rawDiscount:Number(r.discount||0),saleStartMs:_w.s,saleEndMs:_w.e,
 variants:gbParseVars(r.variants),
 id:r.id,name:r.name||r.product_name||"Unnamed Product",cat:String(r.category||r.cat||"Other").trim(),
 price:Number(r.price||0),discount:discountNow(Number(r.discount||0),_w),stock:Number(r.stock??r.stock_quantity??0),
 image:r.image||r.image_url||"",featured:!!r.featured,emoji:r.emoji||"📦",
 brand:r.brand||"",model:r.model||"",description:r.description||"",is_deal:!!r.is_deal,
 specifications:r.specifications??r.specs??r.features??r.attributes??null,
 warranty:r.warranty||r.warranty_period||"",color:r.color||"",connectivity:r.connectivity||"",
 battery_life:r.battery_life||"",compatibility:r.compatibility||"",
 images:(()=>{let v=r.images??r.gallery??r.image_urls??[];if(typeof v==="string"){try{v=JSON.parse(v)}catch(e){v=v.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean)}}if(!Array.isArray(v))v=[];return [...new Set([r.image||r.image_url,...v].filter(x=>typeof x==="string"&&/^https?:\/\//i.test(x)))];})()
};}




async function loadOffers(){
 const grid=$("offersGrid");
 try{
  const {data,error}=await sb.from("offers").select("*").eq("active",true).order("created_at",{ascending:false});
  if(error)throw error;
  const now=Date.now();
  storeOffers=(data||[]).filter(o=>(!o.starts_at||new Date(o.starts_at).getTime()<=now)&&(!o.ends_at||new Date(o.ends_at).getTime()>=now));
  renderOffers();
 }catch(e){
  // Keep the site working if the optional offers table has not been created yet.
  if(grid)grid.innerHTML='';
  updateDealsVisibility();
  console.info("Optional offers table is not available yet. Run offers_setup.sql to enable Deal Zone.",e.message||e);
 }
}
function openDealsPage(type=""){
 activeDealType=type||"";
 const page=$("dealsPage");
 if(page){page.classList.remove("hidden");document.body.classList.add("deals-open");renderOffers();page.scrollTop=0;}
}
function closeDealsPage(){
 $("dealsPage")?.classList.add("hidden");
 document.body.classList.remove("deals-open");
}
function showDealType(type){
 activeDealType=type||"";
 renderOffers();
 const page=$("dealsPage");
 if(page){page.classList.remove("hidden");document.body.classList.add("deals-open");}
}
function offerProductIds(offer){
 let ids=offer?.product_ids;
 if(typeof ids==="string"){
  try{ids=JSON.parse(ids)}catch(e){ids=ids.split(",").map(x=>x.trim()).filter(Boolean)}
 }
 return Array.isArray(ids)?[...new Set(ids.map(String))]:[];
}
function getOffer(offerId){return storeOffers.find(o=>String(o.id)===String(offerId));}
function offerProducts(offer){
 const ids=offerProductIds(offer);
 return products.filter(p=>ids.includes(String(p.id)));
}
function offerUnitPrice(offer){
 const matched=offerProducts(offer);
 const sum=matched.reduce((total,p)=>total+finalPrice(p),0);
 const comboPrice=Number(offer?.combo_price);
 if(Number.isFinite(comboPrice)&&comboPrice>0)return comboPrice;
 const pct=Math.min(100,Math.max(0,Number(offer?.discount_percent)||0));
 return Math.max(0,Math.round(sum*(1-pct/100)));
}
function offerStockLimit(offer){
 const matched=offerProducts(offer);
 if(!matched.length)return 0;
 return Math.min(...matched.map(p=>Math.max(0,Math.floor(Number(p.stock)||0))));
}
function renderDealProductCards(){
 const dealProducts=products.filter(p=>p.is_deal||Number(p.discount)>=70);
 return dealProducts.map(p=>{
  const id=jsArg(p.id),sold=Number(p.stock)<=0,disc=Number(p.discount)>0;
  return `<article class="offer-card deal-product-card">${p.image?`<div class="offer-cover"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'"></div>`:''}<span class="offer-type">${disc?`${Math.round(Number(p.discount))}% OFF`:'Featured Deal'}</span><h3>${esc(p.name)}</h3><p>${esc(p.description||'Special gadget deal from Paboo.')}</p><strong class="offer-combo-price">${money(finalPrice(p))} ${disc?`<del style="font-size:12px;opacity:.7">${money(p.price)}</del>`:''}</strong><small>${sold?'Out of stock':`In stock: ${Math.max(0,Number(p.stock)||0)}`}</small><div class="offer-card-actions"><button type="button" class="view-btn" onclick="viewProductDetails(${id})">View Details</button><button type="button" class="add-btn" ${sold?'disabled':''} onclick="window.addToCart(${id})">${sold?'Out of Stock':'Add to Cart'}</button><button type="button" class="buy-btn" ${sold?'disabled':''} onclick="window.buyNow(${id})">${sold?'Out of Stock':'Buy Now'}</button><button type="button" class="view-btn" onclick="toggleWishlist(${id})">${wishlistIds.has(String(p.id))?'♥ Wishlist':'♡ Wishlist'}</button><button type="button" class="view-btn" onclick="toggleCompare(${id})">${compareIds.has(String(p.id))?'✓ Compare':'⇄ Compare'}</button></div></article>`;
 }).join('');
}
function renderDealProducts(){
 const grid=$('dealProductsGrid');
 const cards=renderDealProductCards();
 if(grid)grid.innerHTML=cards;
 $('dealProductsHead')?.classList.toggle('hidden',!cards);
 updateDealsVisibility();
}
// Deals appear on the site only when there is something to show.
function updateDealsVisibility(){
 const has=storeOffers.length>0||products.some(p=>p.is_deal||Number(p.discount)>=70);
 $('dealZone')?.classList.toggle('hidden',!has);
 document.querySelectorAll('.needs-deals').forEach(el=>el.classList.toggle('hidden',!has));
 const best=Math.max(0,...products.map(p=>Number(p.discount)||0),...storeOffers.map(o=>Number(o.discount_percent)||0));
 const lab=$('dealsQuickLabel');if(lab)lab.textContent=best>=10?`Up to ${Math.floor(best)}% Off`:'Deals';
}
function dealTypes(){return [...new Set(storeOffers.map(o=>String(o.offer_type||'').trim()).filter(Boolean))];}
function renderDealChips(){
 const types=dealTypes();
 const html=types.length?types.map(t=>`<button type="button" class="${t===activeDealType?'is-active':''}" onclick="showDealType(${esc(jsArg(t))})">${esc(t)}</button>`).join('')+`<button type="button" class="${activeDealType?'':'is-active'}" onclick="showDealType('')">All Deals</button>`:'';
 const el=$('dealsPageChips');if(el){el.innerHTML=html;el.classList.toggle('hidden',!html);}
}
function renderOffers(){
 const offerGrid=$('offersGrid');
 const pageGrid=$('dealsPageGrid');
 const list=activeDealType?storeOffers.filter(o=>String(o.offer_type||'')===activeDealType):storeOffers;
 const offerCards=list.map(o=>{
  const pct=Number(o.discount_percent||0),type=esc(o.offer_type||'Special Offers');
  const img=o.cover_image||o.image_url||'';
  const matched=offerProducts(o),isCombo=String(o.offer_type||'').toLowerCase().includes('combo');
  const sold=!matched.length||offerStockLimit(o)<=0;
  const unitPrice=offerUnitPrice(o);
  const offerId=esc(o.id);
  const priceLabel=Number(o.combo_price)>0?(isCombo?'Combo Deal':'Special Deal'):pct>0?`${pct}% OFF`:'Special Deal';
  return `<article class="offer-card">${img?`<div class="offer-cover"><img src="${esc(img)}" alt="${esc(o.title||'Offer')}" loading="lazy"></div>`:''}<span class="offer-type">${type}</span><h3>${esc(o.title||'Special offer')}</h3><p>${esc(o.description||'Limited-time offer from Paboo.')}</p>${matched.length?`<div class="offer-products">${matched.map(p=>`<div class="offer-mini-product">${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy">`:''}<span>${esc(p.name)}</span></div>`).join('')}</div>`:''}<div class="offer-value">${esc(priceLabel)}</div>${unitPrice>0?`<strong class="offer-combo-price">${money(unitPrice)}${isCombo?' per combo':' total'}</strong>`:''}${o.ends_at?`<small>Ends: ${new Date(o.ends_at).toLocaleString('en-BD',{dateStyle:'medium',timeStyle:'short'})}</small>`:''}${matched.length?`<div class="offer-card-actions"><button type="button" class="add-btn" ${sold?'disabled':''} onclick="addOfferToCart('${offerId}')">${sold?'Out of Stock':isCombo?'Add Combo to Cart':'Add to Cart'}</button><button type="button" class="buy-btn" ${sold?'disabled':''} onclick="buyOfferNow('${offerId}')">${sold?'Out of Stock':isCombo?'Buy Combo Now':'Buy Now'}</button></div>`:`<small>Products for this offer are not available right now.</small>`}</article>`;
 }).join('');
 const placeholder=`<div class="offer-placeholder">${activeDealType?`No active ${esc(activeDealType)} right now.`:'No offers right now. Please check back soon.'}</div>`;
 if(offerGrid)offerGrid.innerHTML=offerCards;
 if(pageGrid){const dealProducts=activeDealType?'':renderDealProductCards();pageGrid.innerHTML=(offerCards||'')+dealProducts||placeholder;}
 renderDealChips();
 renderDealProducts();
}
function addOfferToCart(offerId){
 const offer=getOffer(offerId),matched=offerProducts(offer);
 if(!offer||!matched.length)return toast("Offer products are unavailable");
 if(matched.some(p=>p.stock<=0))return toast("A product in this combo is out of stock");
 const limit=offerStockLimit(offer),existing=cart.find(x=>x.type==="combo"&&String(x.offerId)===String(offer.id));
 if(existing){if(existing.qty>=limit)return toast("Stock limit reached for this combo");existing.qty++;}
 else cart.push({type:"combo",offerId:String(offer.id),qty:1});
 saveCart();toast("Combo added to cart");
}
function buyOfferNow(offerId){
 const offer=getOffer(offerId),matched=offerProducts(offer);
 if(!offer||!matched.length)return toast("Offer products are unavailable");
 if(matched.some(p=>p.stock<=0))return toast("A product in this combo is out of stock");
 cart=[{type:"combo",offerId:String(offer.id),qty:1}];saveCart();closeDealsPage();openCheckout();
}
function changeComboQty(offerId,delta){
 const item=cart.find(x=>x.type==="combo"&&String(x.offerId)===String(offerId)),offer=getOffer(offerId);
 if(!item||!offer)return;
 const next=item.qty+delta,limit=offerStockLimit(offer);
 if(next>limit)return toast("Stock limit reached for this combo");
 if(next<=0)cart=cart.filter(x=>!(x.type==="combo"&&String(x.offerId)===String(offerId)));
 else item.qty=next;
 saveCart();
}
function removeComboFromCart(offerId){cart=cart.filter(x=>!(x.type==="combo"&&String(x.offerId)===String(offerId)));saveCart();}

function viewOfferProducts(offerId){
 const offer=getOffer(offerId);
 if(!offer)return;
 closeDealsPage();
 const matched=offerProducts(offer);
 if(matched.length===1){document.getElementById('products')?.scrollIntoView({behavior:'smooth'});return;}
 const grid=$('productsGrid');
 if(grid&&matched.length){grid.innerHTML=matched.map(p=>{const sold=p.stock<=0,disc=p.discount>0,price=finalPrice(p);const id=String(p.id).replace(/'/g,"\\'");return `<article class="product-card"><div class="product-img">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:imgPlaceholder()}</div><div class="category">${esc(p.cat)}</div><h3>${esc(p.name)}</h3><div class="price">${money(price)} ${disc?`<del>${money(p.price)}</del>`:""}</div><div class="product-actions"><button class="add-btn" ${sold?"disabled":""} onclick="addToCart('${id}')">${sold?"Out of Stock":"Add to Cart"}</button><button class="buy-btn" ${sold?"disabled":""} onclick="buyNow('${id}')">${sold?"Out of Stock":"Buy Now"}</button></div></article>`}).join('');
 if($('sectionTitle'))$('sectionTitle').textContent=offer.title||'Offer Products';if($('productCount'))$('productCount').textContent=`${matched.length} products`;
 document.getElementById('products')?.scrollIntoView({behavior:'smooth'});
 }
}

async function loadCategories(){
  const {data,error}=await sb.from('categories').select('*').order('name',{ascending:true});
  if(error)throw error;
  categories=data||[]; // Show all saved categories, including rows where active is unset/false.
  renderCategoryMenu();
}
function renderCategoryMenu(){
  const names=[...new Set(categories.map(c=>String(c.name||'').trim()).filter(Boolean))];
  const menu=document.querySelector('#sideMenu');
  if(!menu)return;

  // Reuse the existing "Shop by category" label from index.html.
  // Do not create a second Categories heading/list.
  let label=menu.querySelector('.menu-label');
  if(!label){
    label=document.createElement('div');
    label.className='menu-label';
    label.textContent='Shop by category';
    const allButton=menu.querySelector('.menu-item');
    if(allButton)allButton.insertAdjacentElement('afterend',label);
    else menu.appendChild(label);
  }

  // Remove previously generated and legacy hard-coded category buttons.
  menu.querySelectorAll('[data-dynamic-category="1"]').forEach(x=>x.remove());
  [...menu.querySelectorAll('.menu-item')].slice(1).filter(x=>x.dataset.persistentMenu!=='1').forEach(x=>x.remove());

  // Append categories in the same order as Supabase returns them.
  names.forEach(name=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='menu-item';
    b.textContent=name;
    b.setAttribute('data-dynamic-category','1');
    b.onclick=()=>{filterCategory(name);closeMenu();};
    menu.appendChild(b);
  });
}

async function loadProducts(){
 const {data,error}=await sb.from("products").select("*").eq("active",true).order("created_at",{ascending:false});
 if(error)throw error; products=(data||[]).map(normalizeProduct);
 cart=cart.filter(x=>x.type==="combo"||products.some(p=>String(p.id)===String(x.id)));saveCart();
}

async function loadStoreData(){
 try{
  const [dres,pres]=await Promise.all([
   sb.from("delivery_settings").select("*").limit(1).maybeSingle(),
   sb.from("payment_settings").select("*").limit(1).maybeSingle()
  ]);
  if(dres.error)throw dres.error;if(pres.error)throw pres.error;
  if(dres.data){let d=dres.data;DELIVERY_SETTINGS={
   dhaka:Number(d.dhaka_charge??60),nearby:Number(d.nearby_charge??100),outside:Number(d.outside_charge??130)
  };}
  if(pres.data){let p=pres.data;PAYMENT_SETTINGS={
   cod_enabled:p.cod_enabled!==false,
   bkash_enabled:p.bkash_enabled===true,
   bkash_number:String(p.bkash_number||"").trim(),
   nagad_enabled:p.nagad_enabled===true,
   nagad_number:String(p.nagad_number||"").trim()
  };}
  applyPaymentSettings();
 }catch(e){console.error("SETTINGS LOAD ERROR",e);applyPaymentSettings();}
}

// Contact details saved in Admin > Settings (store_settings table). Optional: if it can't be read, STORE_INFO above is used.
let REMOTE_STORE={};
async function loadStoreInfo(){
 try{
  const {data,error}=await sb.from("store_settings").select("*").limit(1).maybeSingle();
  if(error)throw error;
  try{if(data&&GB_THEMES[data.theme])localStorage.setItem("gbbd_store_theme",data.theme);}catch(_){}gbApplyTheme();
  try{window.gbColsEnabled(!!(data&&data.col_picker));}catch(_){}
  GB_VARS_ON=!!(data&&data.variants_on);
  REMOTE_STORE=data?{phone:String(data.phone||"").trim(),email:String(data.email||"").trim(),address:String(data.address||"").trim(),hours:String(data.support_hours||"").trim()}:{};
 }catch(e){console.warn("store_settings not available, using STORE_INFO",e?.message||e);REMOTE_STORE={};}
 renderStoreInfo();
}
async function refreshStore(){
 try{await Promise.all([loadProducts(),loadStoreData(),loadCategories(),loadOffers(),loadStoreInfo(),loadCoupons()]);
  cart=cart.filter(x=>x.type!=="combo"||(getOffer(x.offerId)&&offerProducts(getOffer(x.offerId)).length>0));
  cart=cart.filter(x=>{if(x.type==="combo")return true;const p=getProduct(x.id);if(!p)return false;if(pvars(p).length){if(!vOf(p,x.variant)||stockOf(p,x.variant)<=0)return false;if(x.qty>stockOf(p,x.variant))x.qty=stockOf(p,x.variant);}else if(x.variant){delete x.variant;}return true;});
  saveCart();renderProducts();renderHomepageShowcases();updateCart();renderOffers();renderPolicyInfo();renderFlashSale();setTimeout(setupLocationPickers,0);handleProductPageRoute();}
 catch(e){console.error(e);toast("Products could not be loaded");handleProductPageRoute(true);}
}


/* Product pictures: square frame, lazy loading, tidy placeholder when a photo is missing or fails to load. */
function imgPlaceholder(){return '<span class="img-placeholder" aria-hidden="true"><svg class="ic ic-lg"><use href="#i-box"/></svg></span>';}
function productImg(p){
 return p.image?`<img class="pimg" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="gbImgFail(this)">`:imgPlaceholder();
}
window.gbImgFail=function(img){const s=document.createElement("span");s.innerHTML=imgPlaceholder();img.replaceWith(s.firstChild);};

function categoryKey(value){
 return String(value??"").trim().toLocaleLowerCase().replace(/\s+/g," ");
}
function productHaystack(p){return [p.name,p.cat,p.brand,p.model,p.color,p.connectivity,p.compatibility].join(" ").toLowerCase();}
function activeQuery(){return String($("searchInput")?.value||"").trim();}
function searchMatches(q){
 const t=String(q||"").toLowerCase().split(/\s+/).filter(Boolean);if(!t.length)return[];
 return products.filter(p=>{const h=productHaystack(p);return t.every(w=>h.includes(w));}).sort((a,b)=>{
  const an=a.name.toLowerCase().startsWith(t[0])?0:1,bn=b.name.toLowerCase().startsWith(t[0])?0:1;
  return an-bn||(Number(b.stock>0)-Number(a.stock>0));
 });
}
function filteredProducts(){
 const q=activeQuery();
 const selectedKey=categoryKey(currentCategory);
 // Searching looks through the whole shop; otherwise the chosen category is used.
 let a=q?searchMatches(q):products.filter(p=>selectedKey===categoryKey("All Products")||categoryKey(p.cat)===selectedKey);
 let s=$("sortSelect")?.value||"";
 if(s==="low")a.sort((x,y)=>x.price-y.price);
 if(s==="high")a.sort((x,y)=>y.price-x.price);
 if(s==="featured"&&!q)a.sort((x,y)=>Number(y.featured)-Number(x.featured));
 return a;
}
function persistSavedIds(){
 try{localStorage.setItem("gbbd_wishlist",JSON.stringify([...wishlistIds]));localStorage.setItem("gbbd_compare",JSON.stringify([...compareIds]));}
 catch(e){console.warn("Saved products could not be stored locally",e);toast("Browser storage is unavailable");}
 updateSavedCounters();
}
function updateSavedCounters(){
 const wc=wishlistIds.size,cc=compareIds.size;
 ["wishlistMenuCount","wishlistToolbarCount","wishlistHeroCount","wishlistQuickCount"].forEach(id=>{const el=$(id);if(el){el.textContent=String(wc);el.classList.toggle("is-empty",!wc);}});
 ["compareMenuCount","compareToolbarCount","compareHeroCount","compareQuickCount"].forEach(id=>{const el=$(id);if(el){el.textContent=String(cc);el.classList.toggle("is-empty",!cc);}});
}
function toggleWishlist(id){
 id=String(id);
 if(wishlistIds.has(id)){wishlistIds.delete(id);toast("Removed from Wishlist");}
 else{wishlistIds.add(id);toast("Added to Wishlist");}
 persistSavedIds();renderProducts();renderHomepageShowcases();
 if(!$('savedProductsPanel')?.classList.contains('hidden')&&$('savedPanelTitle')?.dataset.kind==='wishlist')renderSavedPanel();
}
function toggleCompare(id){
 id=String(id);
 if(compareIds.has(id)){compareIds.delete(id);toast("Removed from Compare");}
 else{if(compareIds.size>=3)return toast("Compare up to 3 products — remove one first");compareIds.add(id);toast("Added to Compare");}
 persistSavedIds();renderProducts();renderHomepageShowcases();
 if(!$('savedProductsPanel')?.classList.contains('hidden')&&$('savedPanelTitle')?.dataset.kind==='compare')renderSavedPanel();
}
function closeSavedProducts(){$('savedProductsPanel')?.classList.add('hidden');}
function viewProductDetails(id){
 const p=getProduct(id);if(!p)return toast("Product details are not available");
 let modal=$('productDetailsModal');
 if(!modal){modal=document.createElement('div');modal.id='productDetailsModal';modal.className='product-details-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML='<div class="product-details-backdrop" onclick="closeProductDetails()"></div><section class="product-details-dialog"><button type="button" class="product-details-close" onclick="closeProductDetails()" aria-label="Close details">×</button><div id="productDetailsBody"></div></section>';document.body.appendChild(modal);}
 const specs=productSpecEntries(p);
 const sold=Number(p.stock)<=0,discount=Number(p.discount)>0,images=productImages(p);
 $('productDetailsBody').innerHTML=`<div class="product-details-layout"><div><div class="product-details-image" id="productModalMainImage">${images.length?`<img src="${esc(images[0])}" alt="${esc(p.name)}" onerror="this.style.display='none'">`:`<span>${imgPlaceholder()}</span>`}</div>${images.length>1?`<div class="product-gallery-thumbs">${images.map((src,i)=>`<button type="button" class="product-gallery-thumb ${i===0?'active':''}" onclick="setProductGalleryImage('productModalMainImage',this,this.dataset.src)" data-src="${esc(src)}" aria-label="View image ${i+1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}</div><div class="product-details-copy"><span class="product-details-kicker">${esc(p.cat||'Gadget')}</span><h2>${esc(p.name)}</h2><div class="product-details-price">${money(finalPrice(p,gbVar(p.id)))} ${discount?`<del>${money(p.price)}</del><span class="discount-badge">${Math.round(Number(p.discount))}% OFF</span>`:''}</div><p class="product-details-stock ${sold?'sold':''}">${sold?'Currently out of stock':`In stock: ${Math.max(0,Number(p.stock)||0)}`}</p>${p.description?`<p class="product-details-description">${esc(p.description)}</p>`:''}${specs.length?`<div class="product-details-specs"><h3>Product details</h3><dl>${specs.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`:'<p class="product-details-description">Detailed specifications have not been added for this product yet.</p>'}${variantChips(p)}<div class="product-details-actions"><button type="button" class="add-btn" ${sold?'disabled':''} onclick="closeProductDetails();window.addToCart(${jsArg(p.id)})">Add to Cart</button><button type="button" class="buy-btn" ${sold?'disabled':''} onclick="closeProductDetails();window.buyNow(${jsArg(p.id)})">Buy Now</button><button type="button" class="full-details-btn" onclick="window.openProductPage(${jsArg(p.id)})">Full Product Page ↗</button></div></div></div>`;
 modal.classList.add('is-open');document.body.classList.add('product-details-open');
}
function closeProductDetails(){const modal=$('productDetailsModal');if(modal)modal.classList.remove('is-open');document.body.classList.remove('product-details-open');}
window.viewProductDetails=viewProductDetails;window.closeProductDetails=closeProductDetails;
function productImages(p){const arr=Array.isArray(p?.images)?p.images:[];return [...new Set([p?.image,...arr].filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))].slice(0,8);}
function setProductGalleryImage(containerId,button,url){const box=$(containerId);if(!box)return;const img=box.querySelector('img');if(img)img.src=url;box.querySelectorAll('.product-gallery-thumb').forEach(b=>b.classList.remove('active'));button?.classList.add('active');}
function openProductPage(id){const url=new URL(window.location.href);url.searchParams.set('product',String(id));url.hash='';window.location.href=url.toString();}
function returnToShop(){const url=new URL(window.location.href);url.searchParams.delete('product');url.hash='products';window.location.href=url.toString();}
function handleProductPageRoute(loadFailed=false){const id=new URLSearchParams(window.location.search).get('product');const page=$('fullProductPage');if(!page)return;if(!id){page.classList.add('hidden');document.body.classList.remove('full-product-page-open');return;}page.classList.remove('hidden');document.body.classList.add('full-product-page-open');if(loadFailed){page.innerHTML='<div class="full-product-message"><h2>Products could not be loaded</h2><p>Please check your connection and try again.</p><button class="view-btn" onclick="returnToShop()">Back to Shop</button></div>';return;}const p=getProduct(id);if(!p){page.innerHTML='<div class="full-product-message"><h2>Product not found</h2><p>This product may be unavailable or removed.</p><button class="view-btn" onclick="returnToShop()">Back to Shop</button></div>';return;}const specs=productSpecEntries(p),images=productImages(p),sold=Number(p.stock)<=0,discount=Number(p.discount)>0;const related=products.filter(x=>String(x.id)!==String(p.id)&&x.cat===p.cat).slice(0,4);page.innerHTML=`<div class="full-product-topbar"><button type="button" class="full-product-back" onclick="returnToShop()">← Back to Shop</button><span>PABOO <b>• PRODUCT DETAILS</b></span><button type="button" class="full-product-cart" onclick="returnToShop();setTimeout(()=>document.getElementById('cartDrawer')?.classList.add('open'),350)">🛒 Cart</button></div><div class="full-product-container"><div class="full-product-hero"><div><div class="full-product-gallery"><div class="full-product-main-image" id="fullProductMainImage">${images.length?`<img src="${esc(images[0])}" alt="${esc(p.name)}" onerror="this.style.display='none'">`:`<span>${imgPlaceholder()}</span>`}</div>${images.length>1?`<div class="product-gallery-thumbs">${images.map((src,i)=>`<button type="button" class="product-gallery-thumb ${i===0?'active':''}" onclick="setProductGalleryImage('fullProductMainImage',this,this.dataset.src)" data-src="${esc(src)}" aria-label="View image ${i+1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}</div></div><div class="full-product-info"><span class="product-details-kicker">${esc(p.cat||'Gadget')}</span><h1>${esc(p.name)}</h1><div class="product-details-price">${money(finalPrice(p,gbVar(p.id)))} ${discount?`<del>${money(p.price)}</del><span class="discount-badge">${Math.round(Number(p.discount))}% OFF</span>`:''}</div>${saleBox(p)}<p class="product-details-stock ${sold?'sold':''}">${sold?'Currently out of stock':`In stock: ${Math.max(0,Number(p.stock)||0)}`}</p>${p.description?`<p class="product-details-description">${esc(p.description)}</p>`:'<p class="product-details-description">Product description has not been added yet.</p>'}${variantChips(p)}<div class="full-product-actions"><button type="button" class="add-btn" ${sold?'disabled':''} onclick="window.addToCart(${jsArg(p.id)})">Add to Cart</button><button type="button" class="buy-btn" ${sold?'disabled':''} onclick="window.buyNow(${jsArg(p.id)})">Buy Now</button><button type="button" class="view-btn" onclick="window.viewProductDetails(${jsArg(p.id)})">Quick View Popup</button><button type="button" class="full-product-save" onclick="window.toggleWishlist(${jsArg(p.id)})">♡ Save to Wishlist</button></div><div class="full-product-highlights"><span>⚡ Secure checkout options</span><span>📦 Stock: ${Math.max(0,Number(p.stock)||0)}</span><span>↩ Return policy: see store policy</span></div></div></div>${specs.length?`<section class="full-product-spec-section"><h2>Specifications & Features</h2><dl>${specs.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`:`<section class="full-product-spec-section"><h2>Specifications & Features</h2><p>Specifications have not been provided for this product yet. Ask the store to confirm important details before ordering.</p></section>`}${related.length?`<section class="full-product-related"><h2>You may also like</h2><div class="full-product-related-grid">${related.map(x=>`<article class="full-related-card"><div class="full-related-image">${x.image?`<img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy">`:esc(x.emoji||'📦')}</div><h3>${esc(x.name)}</h3><strong>${money(finalPrice(x))}</strong><button type="button" class="view-btn" onclick="window.openProductPage(${jsArg(x.id)})">View Details</button></article>`).join('')}</div></section>`:''}<div class="full-product-footer">Paboo · Prices and stock may change. Confirm product details before ordering.</div></div>`;}
window.openProductPage=openProductPage;window.returnToShop=returnToShop;window.setProductGalleryImage=setProductGalleryImage;

function showSavedProducts(kind){
 const panel=$('savedProductsPanel');if(!panel)return;
 const title=$('savedPanelTitle');if(title)title.dataset.kind=kind==='wishlist'?'wishlist':'compare';
 panel.classList.remove('hidden');
 if($('savedPanelTools'))$('savedPanelTools').classList.toggle('hidden',kind!=='compare');
 if($('savedPanelEyebrow'))$('savedPanelEyebrow').textContent=kind==='wishlist'?'YOUR SAVED ITEMS':'MAKE THE RIGHT CHOICE';
 if($('savedPanelTitle'))$('savedPanelTitle').textContent=kind==='wishlist'?'My Wishlist':'Compare Products';
 if($('savedPanelSubtitle'))$('savedPanelSubtitle').textContent=kind==='wishlist'?'Saved gadgets, ready when you are.':'Compare price, availability and the product details we have.';
 renderSavedPanel();panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function productSpecEntries(p){
 const entries=[];const add=(label,value)=>{if(value===undefined||value===null||value===''||typeof value==='object')return;entries.push([label,String(value)]);};
 add('Brand',p.brand);add('Model',p.model);add('Warranty',p.warranty);add('Color',p.color);add('Connectivity',p.connectivity);add('Battery life',p.battery_life);add('Compatibility',p.compatibility);
 let raw=p.specifications;
 if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch(e){raw=null}}
 if(Array.isArray(raw)){raw.forEach((v,i)=>{if(v&&typeof v==='object')add(v.name||v.label||`Feature ${i+1}`,v.value||v.detail);else add(`Feature ${i+1}`,v)})}
 else if(raw&&typeof raw==='object')Object.entries(raw).forEach(([k,v])=>add(k.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),v));
 if(p.description)add('Description',p.description);
 return [...new Map(entries.map(([k,v])=>[k.toLowerCase(),[k,v]])).values()];
}
function savedProductCard(p,kind){
 const id=jsArg(p.id),price=finalPrice(p),disc=Number(p.discount)>0,sold=p.stock<=0;
 return `<article class="saved-product-card"><div class="saved-product-image">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">`: `<span>${imgPlaceholder()}</span>`}</div><div class="saved-product-info"><span class="saved-product-category">${esc(p.cat)}</span><h3>${esc(p.name)}</h3><div class="saved-product-price">${money(price)} ${disc?`<del>${money(p.price)}</del><span class="discount-badge">${Math.round(Number(p.discount))}% OFF</span>`:''}</div><div class="saved-stock ${sold?'sold':''}">${sold?'Out of stock':`In stock: ${Math.max(0,p.stock)}`}</div><div class="saved-product-actions"><button type="button" class="view-btn" onclick="viewProductDetails(${id})">View</button><button type="button" class="add-btn" ${sold?'disabled':''} onclick="window.addToCart(${id})">Add to Cart</button><button type="button" class="buy-btn" ${sold?'disabled':''} onclick="window.buyNow(${id})">Buy Now</button><button type="button" class="saved-remove-btn" onclick="removeSavedProduct('${kind}',${id})">Remove</button></div></div></article>`;
}
function removeSavedProduct(kind,id){if(kind==='wishlist')wishlistIds.delete(String(id));else compareIds.delete(String(id));persistSavedIds();renderProducts();renderHomepageShowcases();renderSavedPanel();toast(kind==='wishlist'?'Removed from Wishlist':'Removed from Compare');}
function renderCompareTable(list){
 const diffsOnly=!!$('compareDifferencesOnly')?.checked;
 const specs=list.map(productSpecEntries);
 const keys=['Price','Original price','Discount','Category','Availability','Stock'];
 specs.forEach(a=>a.forEach(([k])=>{if(!keys.some(x=>x.toLowerCase()===k.toLowerCase()))keys.push(k)}));
 const val=(p,entries,key)=>{const found=entries.find(([k])=>k.toLowerCase()===key.toLowerCase());if(found)return found[1];switch(key){case'Price':return finalPrice(p);case'Original price':return p.price;case'Discount':return Number(p.discount)>0?`${Math.round(p.discount)}% OFF`:'No discount';case'Category':return p.cat||'—';case'Availability':return p.stock>0?'In stock':'Out of stock';case'Stock':return Math.max(0,p.stock);default:return '—'}};
 const availablePrices=list.filter(p=>p.stock>0).map(finalPrice);const lowest=availablePrices.length?Math.min(...availablePrices):null;
 const rows=keys.filter(key=>{
  if(!diffsOnly)return true;const values=list.map((p,i)=>String(val(p,specs[i],key)));return new Set(values).size>1;
 }).map(key=>`<tr><th scope="row">${esc(key)}</th>${list.map((p,i)=>{const v=val(p,specs[i],key),isLow=key==='Price'&&lowest!==null&&p.stock>0&&Number(v)===lowest;return `<td class="${isLow?'compare-lowest':''}">${key==='Price'?money(v):key==='Original price'?money(v):esc(v)}${isLow?'<span class="lowest-label">Lowest price</span>':''}</td>`}).join('')}</tr>`).join('');
 return `<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th scope="col">Product</th>${list.map(p=>`<th scope="col"><div class="compare-product-head"><div class="compare-product-image">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">`:`<span>${imgPlaceholder()}</span>`}</div><strong>${esc(p.name)}</strong><button type="button" class="compare-remove-btn" onclick="removeSavedProduct('compare',${jsArg(p.id)})">Remove</button><div class="compare-buy-actions"><button type="button" class="view-btn" onclick="viewProductDetails(${jsArg(p.id)})">View</button><button type="button" class="add-btn" ${p.stock<=0?'disabled':''} onclick="window.addToCart(${jsArg(p.id)})">Add to Cart</button><button type="button" class="buy-btn" ${p.stock<=0?'disabled':''} onclick="window.buyNow(${jsArg(p.id)})">Buy Now</button></div></div></th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${list.length+1}">No differing details found. Turn off “Show differences only” to see all details.</td></tr>`}</tbody></table></div><p class="compare-data-note">Product specifications are shown only when provided by the store. Please confirm important details before ordering.</p>`;
}
function renderSavedPanel(){
 const kind=$('savedPanelTitle')?.dataset.kind||'wishlist',content=$('savedPanelContent');if(!content)return;
 const ids=kind==='wishlist'?[...wishlistIds]:[...compareIds];let list=ids.map(getProduct).filter(Boolean);
 if(kind==='compare'&&list.length>3){list=list.slice(0,3);compareIds=new Set(list.map(p=>String(p.id)));persistSavedIds();}
 if(!list.length){content.innerHTML=`<div class="saved-empty"><div class="saved-empty-icon">${kind==='wishlist'?'♡':'⇄'}</div><h3>${kind==='wishlist'?'Your Wishlist is empty':'No products to compare yet'}</h3><p>${kind==='wishlist'?'Tap the heart/Wishlist button on any gadget to save it here.':'Choose up to 3 products from the catalogue and tap Compare.'}</p><button type="button" class="add-btn" onclick="closeSavedProducts();document.getElementById('products').scrollIntoView({behavior:'smooth'})">Explore Products</button></div>`;return;}
 if(kind==='wishlist')content.innerHTML=`<div class="saved-products-grid">${list.map(p=>savedProductCard(p,'wishlist')).join('')}</div>`;
 else content.innerHTML=renderCompareTable(list);
 updateSavedCounters();
}
function renderProducts(){
 let g=$("productsGrid");if(!g)return;let a=filteredProducts();
 if($("sectionTitle"))$("sectionTitle").textContent=activeQuery()?`Results for "${activeQuery()}"`:currentCategory;
 if($("productCount"))$("productCount").textContent=`${a.length} products`;
 g.innerHTML=a.map(p=>{
  let sold=p.stock<=0,disc=p.discount>0,price=disc?Math.max(0,p.price-p.price*p.discount/100):p.price;
  let id=String(p.id).replace(/'/g,"\\'");
  return `<article class="product-card">${saleStrip(p)}<div class="product-img">${productImg(p)}</div><div class="category">${esc(p.cat)}</div><h3>${esc(p.name)}</h3><div class="price">${money(price)} ${disc?`<del style="font-size:12px;color:#7895af">${money(p.price)}</del>`:""}</div>${saleStock(p)}<div class="product-actions"><button class="view-btn" type="button" onclick="viewProductDetails('${id}')">View</button><button class="add-btn" ${sold?"disabled":""} onclick="window.addToCart('${id}')">${sold?"Out of Stock":"Add to Cart"}</button><button class="buy-btn" ${sold?"disabled":""} onclick="window.buyNow('${id}')">${sold?"Out of Stock":"Buy Now"}</button></div><div class="extra-product-actions"><button type="button" onclick="toggleWishlist('${id}')">${wishlistIds.has(String(p.id))?"♥ Saved":"♡ Wishlist"}</button><button type="button" onclick="toggleCompare('${id}')">${compareIds.has(String(p.id))?"✓ Comparing":"⇄ Compare"}</button></div></article>`;
 }).join("")||`<div class="empty" style="grid-column:1/-1">${activeQuery()?`No products found for "${esc(activeQuery())}". Try another word, or <button type="button" class="link-btn" onclick="clearSearch()">clear the search</button>.`:"No products found."}</div>`;
 updateSavedCounters();
 renderDealProducts();
}
function homeCategoryIcon(name){
 const v=String(name||"").toLowerCase();
 const svg=id=>`<svg class="ic ic-lg" aria-hidden="true"><use href="#i-${id}"/></svg>`;
 if(/audio|earbud|headphone|speaker|sound/.test(v))return svg("headphones");
 if(/gaming|game|keyboard|mouse|controller/.test(v))return svg("gamepad");
 if(/wearable|watch|fitness|band/.test(v))return svg("watch");
 if(/mobile|phone|case|screen|accessor/.test(v))return svg("mobile");
 if(/power|charg|battery|cable|adapter/.test(v))return svg("battery");
 if(/rgb|light|led|lamp/.test(v))return svg("bulb");
 if(/home|kitchen|house/.test(v))return svg("home");
 if(/camera|photo/.test(v))return svg("camera");
 if(/laptop|computer|pc|storage/.test(v))return svg("laptop");
 return svg("sparkle");
}
function homeProductCard(p){
 const id=jsArg(p.id),sold=Number(p.stock)<=0,disc=Number(p.discount)>0;
 const saved=wishlistIds.has(String(p.id)),compared=compareIds.has(String(p.id));
 return `<article class="product-card home-product-card">${saleStrip(p)}<div class="product-img">${productImg(p)}${disc?`<span class="home-discount-badge">${Math.round(Number(p.discount))}% OFF</span>`:""}<div class="home-card-tools"><button type="button" class="home-save-btn ${saved?'is-saved':''}" aria-label="${saved?'Remove from Wishlist':'Add to Wishlist'}" title="${saved?'Remove from Wishlist':'Add to Wishlist'}" onclick="toggleWishlist(${id})">${saved?'♥':'♡'}</button><button type="button" class="home-save-btn ${compared?'is-compared':''}" aria-label="${compared?'Remove from Compare':'Add to Compare'}" title="${compared?'Remove from Compare':'Add to Compare'}" onclick="toggleCompare(${id})">${compared?'✓':'⇄'}</button></div></div><div class="category">${esc(p.cat||"Gadget")}</div><h3>${esc(p.name)}</h3><div class="price">${money(finalPrice(p))} ${disc?`<del>${money(p.price)}</del>`:""}</div>${saleStock(p)}<div class="product-actions"><button class="view-btn" type="button" onclick="viewProductDetails(${id})">View Details</button><button class="add-btn" type="button" ${sold?"disabled":""} onclick="window.addToCart(${id})">${sold?"Out of Stock":"Add to Cart"}</button><button class="buy-btn" type="button" ${sold?"disabled":""} onclick="window.buyNow(${id})">${sold?"Out of Stock":"Buy Now"}</button></div></article>`;
}
function renderHomeProductGrid(id,list,emptyText,limit=4){
 const grid=$(id);if(!grid)return;
 const unique=[],seen=new Set();
 (list||[]).forEach(p=>{const key=String(p.id);if(!seen.has(key)){seen.add(key);unique.push(p);}});
 grid.innerHTML=unique.length?unique.slice(0,limit).map(homeProductCard).join(""):`<div class="showcase-empty">${esc(emptyText)}</div>`;
}
function renderHomepageShowcases(){
 const catGrid=$("homeCategoryGrid");
 if(catGrid){
  let names=[...new Set(categories.map(c=>String(c.name||"").trim()).filter(Boolean))];
  if(!names.length)names=[...new Set(products.map(p=>String(p.cat||"").trim()).filter(Boolean))];
  if(names.length){
   catGrid.innerHTML=names.slice(0,8).map(name=>`<button class="category-tile" type="button" onclick="filterCategory(${jsArg(name)})"><span class="category-tile-icon" aria-hidden="true">${homeCategoryIcon(name)}</span><strong>${esc(name)}</strong><small>Explore collection</small><span class="category-tile-arrow" aria-hidden="true">↗</span></button>`).join("");
  }else catGrid.innerHTML='<div class="showcase-empty">Categories will appear here when they are added in the store.</div>';
 }
 const available=products.filter(p=>Number(p.stock)>0);
 const featured=products.filter(p=>p.featured);
 renderHomeProductGrid("featuredProductsGrid",featured.length?featured:products,"Products will appear here when the store catalogue is available.",24);
 // The products query is ordered by created_at descending, so the first items are the latest additions.
 renderHomeProductGrid("newArrivalsGrid",products,"New arrivals will appear here when products are added.",24);
 // This store currently has no verified sales-count field; use admin-featured products first and label the section transparently.
 const topPicks=featured.length?featured:available.slice().sort((a,b)=>Number(b.stock)-Number(a.stock));
 renderHomeProductGrid("bestSellersGrid",topPicks,"Store favourites will appear here when products are available.",24);
}

function renderSmartRecommendations(){let old=$("smartRecommendations");if(old)old.remove();if(!products.length)return;let seed=products.find(p=>p.featured)||products[0];let picks=products.filter(p=>p.cat===seed.cat&&String(p.id)!==String(seed.id)&&p.stock>0).slice(0,3);if(!picks.length)picks=products.filter(p=>String(p.id)!==String(seed.id)&&p.stock>0).slice(0,3);if(!picks.length)return;let section=document.createElement("section");section.id="smartRecommendations";section.dataset.v="home";section.className="shop smart-recommendations";section.innerHTML=`<div class="section-head"><h2>Smart Picks For You</h2><span>Based on product category and availability</span></div><div class="products-grid">${picks.map(p=>`<article class="product-card"><div class="product-img">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:contain">`:imgPlaceholder()}</div><div class="category">${esc(p.cat)}</div><h3>${esc(p.name)}</h3><div class="price">${money(finalPrice(p))}</div><button class="add-btn" onclick="addToCart('${String(p.id).replace(/'/g,"\'")}')">Add to Cart</button></article>`).join("")}</div>`;$("products")?.insertAdjacentElement("afterend",section);}
function getProduct(id){return products.find(p=>String(p.id)===String(id));}
function finalPrice(p,vn){const v=vOf(p,vn),base=v&&v.price>0?v.price:p.price;return p.discount>0?Math.max(0,base-base*p.discount/100):base;}
function cartUnitPrice(item){if(item?.type==="combo"){const offer=getOffer(item.offerId);return offer?offerUnitPrice(offer):0;}const p=getProduct(item?.id);return p?finalPrice(p,item.variant):0;}
function gbNeedVariant(p,variant,id){const vs=pvars(p);if(!vs.length)return{ok:true,vn:null};const vn=variant||gbVar(id);if(!vOf(p,vn)){viewProductDetails(id);toast("Choose an option first");return{ok:false};}return{ok:true,vn};}
function addToCart(id,variant){let p=getProduct(id);if(!p||p.stock<=0)return toast("Out of stock");const r=gbNeedVariant(p,variant,id);if(!r.ok)return;const vn=r.vn,lim=stockOf(p,vn);if(lim<=0)return toast("Out of stock");let x=cart.find(i=>i.type!=="combo"&&String(i.id)===String(id)&&(i.variant||null)===vn);if(x){if(x.qty>=lim)return toast("Stock limit reached");x.qty++;}else cart.push(vn?{id:p.id,qty:1,variant:vn}:{id:p.id,qty:1});saveCart();toast("Added to cart");}
function buyNow(id,variant){let p=getProduct(id);if(!p||p.stock<=0)return toast("Out of stock");const r=gbNeedVariant(p,variant,id);if(!r.ok)return;const vn=r.vn;if(stockOf(p,vn)<=0)return toast("Out of stock");cart=[vn?{id:p.id,qty:1,variant:vn}:{id:p.id,qty:1}];saveCart();openCheckout();}
function changeQty(id,d,variant){const vn=variant||null,m=i=>i.type!=="combo"&&String(i.id)===String(id)&&(i.variant||null)===vn;let x=cart.find(m),p=getProduct(id);if(!x||!p)return;x.qty+=d;const lim=stockOf(p,vn);if(x.qty>lim)x.qty=lim;if(x.qty<=0)cart=cart.filter(i=>!m(i));saveCart();}
function removeItem(id,variant){const vn=variant||null;cart=cart.filter(i=>!(i.type!=="combo"&&String(i.id)===String(id)&&(i.variant||null)===vn));saveCart();}

function getDeliveryFee(){
 if(!cart.length||!selectedDistrict)return 0;
 if(selectedDistrict==="Dhaka")return DELIVERY_SETTINGS.dhaka;
 if(NEARBY_DISTRICTS.includes(selectedDistrict))return DELIVERY_SETTINGS.nearby;
 return DELIVERY_SETTINGS.outside;
}
function totals(){
 let subtotal=cart.reduce((sum,item)=>sum+cartUnitPrice(item)*item.qty,0);
 let delivery=subtotal?getDeliveryFee():0;let coupon=COUPONS[appliedCoupon];let discount=coupon&&subtotal>=coupon.min?(coupon.type==="percent"?Math.round(subtotal*coupon.value/100):coupon.value):0;if(coupon&&subtotal<coupon.min)discount=0;return{subtotal,delivery,discount,total:Math.max(0,subtotal+delivery-discount)};
}
function updateDeliveryInfo(){
 let b=$("deliveryInfo");if(!b)return;
 if(!selectedDistrict)b.textContent="Select your district to calculate delivery charge.";
 else{let k=selectedDistrict==="Dhaka"?"dhaka":NEARBY_DISTRICTS.includes(selectedDistrict)?"nearby":"outside";let z={dhaka:"Dhaka",nearby:"Nearby Dhaka",outside:"Outside Dhaka"}[k];b.textContent=`Delivery: ${money(getDeliveryFee())} • ${z} • Usually ${DELIVERY_TIME[k]}`;}
 updateCart();
}
function updateCart(){
 let c=$("cartCount");if(c)c.textContent=cart.reduce((sum,item)=>sum+item.qty,0);{const n=cart.reduce((sum,item)=>sum+item.qty,0),b=$("bottomCartCount");if(b){b.textContent=n;b.classList.toggle("is-empty",!n);}}
 let t=totals();["cartSubtotal","cartDelivery","cartTotal","checkoutTotal"].forEach((id,i)=>{let e=$(id);if(e)e.textContent=money([t.subtotal,t.delivery,t.total,t.total][i]);});let dc=$("couponDiscount");if(dc)dc.textContent=money(t.discount);let ca=$("couponStatus");if(ca)ca.textContent=appliedCoupon?(t.discount?`Coupon ${appliedCoupon} applied`:`Coupon ${appliedCoupon}: minimum order ${money(COUPONS[appliedCoupon]?.min||0)}`):"Enter a code and tap Apply.";
 let cb=$("checkoutBtn");if(cb)cb.disabled=!cart.length||!enabledPaymentTypes().length;
 let box=$("cartItems");if(!box)return;
 box.innerHTML=cart.length?cart.map(item=>{
  if(item.type==="combo"){
   const offer=getOffer(item.offerId);if(!offer)return"";
   const matched=offerProducts(offer),price=offerUnitPrice(offer),offerId=esc(offer.id);
   const names=matched.map(p=>p.name).join(" + ");
   return `<div class="cart-row combo-cart-row"><div class="mini-img">🎁</div><div><h4>${esc(offer.title||"Combo Deal")}</h4><small class="combo-cart-products">${esc(names)}</small><small>${money(price)} per combo</small><div class="qty"><button onclick="changeComboQty('${offerId}',-1)" aria-label="Decrease combo quantity">−</button><b>${item.qty}</b><button onclick="changeComboQty('${offerId}',1)" aria-label="Increase combo quantity">+</button><button class="remove" onclick="removeComboFromCart('${offerId}')">Remove</button></div></div><strong>${money(price*item.qty)}</strong></div>`;
  }
  const p=getProduct(item.id);if(!p)return"";const id=String(p.id).replace(/'/g,"\\'"),vq=item.variant?","+esc(jsArg(item.variant)):"",fp=finalPrice(p,item.variant);
  return `<div class="cart-row"><div class="mini-img">${p.image?`<img src="${esc(p.image)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:10px">`:imgPlaceholder()}</div><div><h4>${esc(p.name)}${item.variant?` <small class="cart-variant">(${esc(item.variant)})</small>`:''}</h4><small>${money(fp)} each</small><div class="qty"><button onclick="changeQty('${id}',-1${vq})">−</button><b>${item.qty}</b><button onclick="changeQty('${id}',1${vq})">+</button><button class="remove" onclick="removeItem('${id}'${vq})">Remove</button></div></div><strong>${money(fp*item.qty)}</strong></div>`;
 }).join(""):`<div class="empty">Your cart is empty.</div>`;
}

function ptype(r){
 let v=String(r?.value||"").trim().toLowerCase();
 if(v==="cash on delivery"||v==="cod")return"cod";
 if(v==="bkash"||v==="b-kash"||v==="bkash (manual)")return"bkash";
 if(v==="nagad"||v==="nagad (manual)")return"nagad";return"";
}
function enabledPaymentTypes(){
 let a=[];if(PAYMENT_SETTINGS.cod_enabled)a.push("cod");
 if(PAYMENT_SETTINGS.bkash_enabled&&PAYMENT_SETTINGS.bkash_number)a.push("bkash");
 if(PAYMENT_SETTINGS.nagad_enabled&&PAYMENT_SETTINGS.nagad_number)a.push("nagad");return a;
}
function paymentRadio(type){return[...document.querySelectorAll('input[name="payment"]')].find(r=>ptype(r)===type);}
function applyPaymentSettings(){
 let rs=document.querySelectorAll('input[name="payment"]');
 rs.forEach(r=>{
  let t=ptype(r),ok=enabledPaymentTypes().includes(t);r.disabled=!ok;
  let l=r.closest("label")||r.parentElement;if(l)l.style.display=ok?"":"none";
  if((t==="bkash"||t==="nagad")&&l){
   let n=t==="bkash"?PAYMENT_SETTINGS.bkash_number:PAYMENT_SETTINGS.nagad_number;
   let b=l.querySelector(".payment-number-display");if(!b){b=document.createElement("div");b.className="payment-number-display";b.style.cssText="margin-top:6px;font-size:13px;font-weight:600;color:#1d9bf0;";l.appendChild(b);}
   b.textContent=n?`Send payment to: ${n}`:"";b.style.display=n?"":"none";
  }
 });
 let ch=document.querySelector('input[name="payment"]:checked');
 if(!ch||ch.disabled){let f=[...rs].find(r=>!r.disabled);if(f){f.checked=true;f.dispatchEvent(new Event("change"));}}
 updateTransactionBox();updateCart();
}
function updateTransactionBox(){
 let r=document.querySelector('input[name="payment"]:checked'),b=$("transactionBox");if(!b)return;
 let manual=["bkash","nagad"].includes(ptype(r));b.classList.toggle("hidden",!manual);
 let i=b.querySelector('input[name="transactionId"]');if(i)i.required=manual;
}
function isPaymentMethodEnabled(v){return enabledPaymentTypes().includes(ptype({value:v}));}

function openMenu(){$("sideMenu")?.classList.add("open");$("overlay")?.classList.remove("hidden");}
function closeMenu(){$("sideMenu")?.classList.remove("open");let o=$("overlay"),c=$("cartDrawer");if(o&&(!c||!c.classList.contains("open")))o.classList.add("hidden");}
function openCart(){$("cartDrawer")?.classList.add("open");$("overlay")?.classList.remove("hidden");updateCart();}
function closeCart(){$("cartDrawer")?.classList.remove("open");let o=$("overlay"),m=$("sideMenu");if(o&&(!m||!m.classList.contains("open")))o.classList.add("hidden");}
function openCheckout(){if(!cart.length)return;closeCart();$("checkoutModal")?.classList.remove("hidden");applyPaymentSettings();updateCart();}
function openHeaderCheckout(){if(!cart.length){openCart();toast("Add a product to continue to checkout");return;}openCheckout();}
window.openHeaderCheckout=openHeaderCheckout;
function closeCheckout(){$("checkoutModal")?.classList.add("hidden");}
function closeSuccess(){$("successModal")?.classList.add("hidden");}
function showAllProducts(){currentCategory="All Products";renderProducts();$("products")?.scrollIntoView({behavior:"smooth"});}
function filterCategory(c){
 const key=categoryKey(c);
 currentCategory=key===categoryKey("All Products")?"All Products":(categories.find(x=>categoryKey(x.name)===key)?.name||String(c??"").trim());
 renderProducts();
 $("products")?.scrollIntoView({behavior:"smooth"});
}

/* District list kept inside this file, used only if the online location list cannot be loaded and nothing is cached.
   Format: English name|Bangla name. Customers then type their upazila/thana themselves. */
const FALLBACK_DISTRICTS=("Bagerhat|বাগেরহাট,Bandarban|বান্দরবান,Barguna|বরগুনা,Barishal|বরিশাল,Bhola|ভোলা,Bogura|বগুড়া,Brahmanbaria|ব্রাহ্মণবাড়িয়া,Chandpur|চাঁদপুর,Chapainawabganj|চাঁপাইনবাবগঞ্জ,Chattogram|চট্টগ্রাম,Chuadanga|চুয়াডাঙ্গা,Cumilla|কুমিল্লা,Cox's Bazar|কক্সবাজার,Dhaka|ঢাকা,Dinajpur|দিনাজপুর,Faridpur|ফরিদপুর,Feni|ফেনী,Gaibandha|গাইবান্ধা,Gazipur|গাজীপুর,Gopalganj|গোপালগঞ্জ,Habiganj|হবিগঞ্জ,Jamalpur|জামালপুর,Jashore|যশোর,Jhalokati|ঝালকাঠি,Jhenaidah|ঝিনাইদহ,Joypurhat|জয়পুরহাট,Khagrachhari|খাগড়াছড়ি,Khulna|খুলনা,Kishoreganj|কিশোরগঞ্জ,Kurigram|কুড়িগ্রাম,Kushtia|কুষ্টিয়া,Lakshmipur|লক্ষ্মীপুর,Lalmonirhat|লালমনিরহাট,Madaripur|মাদারীপুর,Magura|মাগুরা,Manikganj|মানিকগঞ্জ,Meherpur|মেহেরপুর,Moulvibazar|মৌলভীবাজার,Munshiganj|মুন্সিগঞ্জ,Mymensingh|ময়মনসিংহ,Naogaon|নওগাঁ,Narail|নড়াইল,Narayanganj|নারায়ণগঞ্জ,Narsingdi|নরসিংদী,Natore|নাটোর,Netrokona|নেত্রকোণা,Nilphamari|নীলফামারী,Noakhali|নোয়াখালী,Pabna|পাবনা,Panchagarh|পঞ্চগড়,Patuakhali|পটুয়াখালী,Pirojpur|পিরোজপুর,Rajbari|রাজবাড়ী,Rajshahi|রাজশাহী,Rangamati|রাঙ্গামাটি,Rangpur|রংপুর,Satkhira|সাতক্ষীরা,Shariatpur|শরীয়তপুর,Sherpur|শেরপুর,Sirajganj|সিরাজগঞ্জ,Sunamganj|সুনামগঞ্জ,Sylhet|সিলেট,Tangail|টাঙ্গাইল,Thakurgaon|ঠাকুরগাঁও").split(",").map(x=>{const[n,b]=x.split("|");return{name:n,bn_name:b,upazilas:[]};});
const GEO_URL="https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json",GEO_CACHE_KEY="gbbd_geo_v1";
async function loadLocations(){
 if(locationLoaded)return;
 try{
  const ctrl=typeof AbortController==="function"?new AbortController():null,timer=ctrl?setTimeout(()=>ctrl.abort(),8000):null;
  const r=await fetch(GEO_URL,{cache:"force-cache",signal:ctrl?ctrl.signal:undefined});if(timer)clearTimeout(timer);
  if(!r.ok)throw Error("HTTP "+r.status);
  const data=await r.json();if(!Array.isArray(data)||!data.length)throw Error("Bad location data");
  locationData=data;locationLoaded=true;
  try{localStorage.setItem(GEO_CACHE_KEY,JSON.stringify(data));}catch(e){}
  return;
 }catch(e){console.warn("Online location list unavailable, using saved copy",e);}
 try{const c=JSON.parse(localStorage.getItem(GEO_CACHE_KEY)||"null");if(Array.isArray(c)&&c.length){locationData=c;locationLoaded=true;return;}}catch(e){}
 // Last resort: built-in district list; upazila is typed by the customer.
 locationData=[{districts:FALLBACK_DISTRICTS}];locationLoaded=true;
}
function districts(){let a=[];for(let d of locationData)for(let x of(d.districts||[]))a.push({name:x.name,bn:x.bn_name,upazilas:x.upazilas||[]});return a;}
function districtMatches(q){q=q.trim().toLowerCase();return districts().filter(x=>!q||(`${x.name} ${x.bn}`).toLowerCase().includes(q)).slice(0,15);}
function upazilaMatches(q){let d=districts().find(x=>x.name===selectedDistrict||x.bn===selectedDistrict);if(!d)return[];q=q.trim().toLowerCase();return d.upazilas.filter(x=>(`${x.name} ${x.bn_name||""}`).toLowerCase().includes(q)).slice(0,20);}
function suggestions(el,a,type){
 if(!el)return;if(!a.length){el.innerHTML="";el.classList.add("hidden");return;}
 el.innerHTML=a.map(x=>`<button type="button" class="suggestion">${x.bn_name||x.bn||x.name}<small>${x.name}</small></button>`).join("");el.classList.remove("hidden");
 el.querySelectorAll(".suggestion").forEach((b,i)=>b.onclick=()=>{let x=a[i];if(type==="district"){selectedDistrict=x.name;selectedUpazila="";$("districtInput").value=x.bn_name||x.bn||x.name;$("upazilaInput").disabled=false;$("upazilaInput").value="";$("districtSuggestions")?.classList.add("hidden");updateDeliveryInfo();}else{selectedUpazila=x.name;$("upazilaInput").value=x.bn_name||x.bn||x.name;$("upazilaSuggestions")?.classList.add("hidden");}});
}
async function setupLocationPickers(){
 await loadLocations();let d=$("districtInput"),u=$("upazilaInput");if(!d||!u||d.dataset.ready==="1")return;d.dataset.ready="1";
 d.addEventListener("focus",()=>suggestions($("districtSuggestions"),districtMatches(d.value),"district"));
 d.addEventListener("input",()=>{selectedDistrict="";selectedUpazila="";u.value="";u.disabled=true;updateDeliveryInfo();suggestions($("districtSuggestions"),districtMatches(d.value),"district");});
 u.addEventListener("focus",()=>suggestions($("upazilaSuggestions"),upazilaMatches(u.value),"upazila"));
 u.addEventListener("input",()=>{const dd=districts().find(x=>x.name===selectedDistrict);if(dd&&!(dd.upazilas||[]).length){selectedUpazila=u.value.trim();$("upazilaSuggestions")?.classList.add("hidden");return;}suggestions($("upazilaSuggestions"),upazilaMatches(u.value),"upazila");});
 document.addEventListener("click",e=>{if(!e.target.closest(".search-select")){$("districtSuggestions")?.classList.add("hidden");$("upazilaSuggestions")?.classList.add("hidden");}});
}

function makeOrderId(){return"GBBD-"+Date.now().toString().slice(-8);}
function isMissingRpc(err){return !!err&&(err.code==="PGRST202"||err.code==="42883"||/could not find the function|schema cache/i.test(String(err.message||"")));}
async function legacyInsertOrder(o){
 // Used only until "1_place_order.sql" has been run in Supabase. Prices are NOT verified by the server in this mode.
 let row={order_number:o.orderId,customer_name:o.customer.name,phone:o.customer.phone,district:o.customer.district,upazila:o.customer.area,address:o.customer.address,note:[o.note,o.couponCode?`Coupon: ${o.couponCode}`:""].filter(Boolean).join(" | ")||null,items:o.items,subtotal:Number(o.subtotal)||0,delivery_charge:Number(o.delivery)||0,total:Number(o.total)||0,payment_method:o.paymentMethod||"Cash on Delivery",transaction_id:o.transactionId||null,status:"Pending"};
 let {data,error}=await sb.from("orders").insert(row).select();if(error)throw error;console.log("ORDER SAVED (legacy mode)",data);
}
async function submitOrderToSupabase(o){
 // The server looks up real prices, checks stock, applies the coupon and saves the order.
 const items=cart.map(item=>item.type==="combo"?{offer_id:String(item.offerId),qty:Number(item.qty)||1,is_combo:true}:{id:String(item.id),qty:Number(item.qty)||1,...(item.variant?{variant:String(item.variant)}:{})});
 let {data,error}=await sb.rpc("place_order",{
  p_name:o.customer.name,p_phone:o.customer.phone,p_district:o.customer.district,p_upazila:o.customer.area,p_address:o.customer.address,
  p_note:o.note||null,p_items:items,p_payment_method:o.paymentMethod||"Cash on Delivery",p_transaction_id:o.transactionId||null,p_coupon:o.couponCode||null,...(gbSource()?{p_source:gbSource()}:{})
 });
 if(error&&isMissingRpc(error)&&gbSource()){
  // step-3 SQL (source tracking) not installed yet: retry without the source field
  const r2=await sb.rpc("place_order",{p_name:o.customer.name,p_phone:o.customer.phone,p_district:o.customer.district,p_upazila:o.customer.area,p_address:o.customer.address,p_note:o.note||null,p_items:items,p_payment_method:o.paymentMethod||"Cash on Delivery",p_transaction_id:o.transactionId||null,p_coupon:o.couponCode||null});
  data=r2.data;error=r2.error;
 }
 if(error){if(isMissingRpc(error)){console.warn("place_order() not installed yet - using legacy insert");return legacyInsertOrder(o);}throw error;}
 if(data&&data.order_number){
  o.orderId=data.order_number;o.subtotal=Number(data.subtotal)||0;o.delivery=Number(data.delivery_charge)||0;o.total=Number(data.total)||0;o.discount=Number(data.discount)||0;
  if(Array.isArray(data.items))o.items=data.items;
 }
 console.log("ORDER SAVED",data);
}

function couponLines(){return Object.entries(COUPONS).map(([code,c])=>`<li><b>${esc(code)}</b> ${c.type==="percent"?c.value+"% off":money(c.value)+" off"} on orders of ${money(c.min)} or more</li>`).join("");}
let couponsFromServer=false;
async function loadCoupons(){
 try{
  const {data,error}=await sb.rpc("public_coupons");
  if(error||!Array.isArray(data))return; // SQL step 4 not installed yet: keep the built-in coupons
  const keep=appliedCoupon&&COUPONS[appliedCoupon]?{[appliedCoupon]:COUPONS[appliedCoupon]}:{};
  Object.keys(COUPONS).forEach(k=>delete COUPONS[k]);
  data.forEach(c=>{COUPONS[String(c.code).toUpperCase()]={type:c.type==="percent"?"percent":"flat",value:Number(c.value)||0,min:Number(c.min)||0}});
  Object.assign(COUPONS,keep);couponsFromServer=true;
 }catch(e){console.warn("coupon list unavailable",e)}
}
async function applyCoupon(){
 const input=$("couponCode");const code=String(input?.value||"").trim().toUpperCase();
 if(!code){appliedCoupon="";updateCart();return toast("Enter a coupon code")}
 let c=COUPONS[code];
 if(!c&&couponsFromServer){
  try{
   const {data,error}=await sb.rpc("check_coupon",{p_code:code});
   if(error)throw error;
   c={type:data.type==="percent"?"percent":"flat",value:Number(data.value)||0,min:Number(data.min)||0};COUPONS[code]=c;
  }catch(e){appliedCoupon="";updateCart();return toast(e&&e.code==="P0001"&&e.message?e.message:"Invalid coupon code")}
 }
 if(!c){appliedCoupon="";updateCart();return toast("Invalid coupon code")}
 appliedCoupon=code;updateCart();
 const sub=totals().subtotal;
 if(sub<c.min)toast(`Add ${money(c.min-sub)} more to use ${code}`);
 else toast(`${code} applied`);
}
function initCustomerUI(){
 $("menuBtn")&&( $("menuBtn").onclick=openMenu);$("cartBtn")&&($("cartBtn").onclick=openCart);$("overlay")&&($("overlay").onclick=()=>{closeMenu();closeCart();});
 document.querySelectorAll('[data-close="menu"]').forEach(x=>x.onclick=closeMenu);document.querySelectorAll('[data-close="cart"]').forEach(x=>x.onclick=closeCart);document.querySelectorAll('[data-close="checkout"]').forEach(x=>x.onclick=closeCheckout);
 $("searchInput")?.addEventListener("input",renderProducts);$("sortSelect")?.addEventListener("change",renderProducts);
 document.querySelectorAll('input[name="payment"]').forEach(r=>r.addEventListener("change",updateTransactionBox));
 $("checkoutBtn")&&($("checkoutBtn").onclick=openCheckout);$("applyCouponBtn")?.addEventListener("click",applyCoupon);
 $("checkoutForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!cart.length)return;let f=new FormData(e.target),payment=String(f.get("payment")||""),tid=String(f.get("transactionId")||"").trim(),type=ptype({value:payment});
  if(!isPaymentMethodEnabled(payment))return alert("The selected payment method is currently unavailable.");
  if((type==="bkash"||type==="nagad")&&!tid)return alert("Please enter the transaction ID for the selected payment method.");
  if(!selectedDistrict||!selectedUpazila)return alert("Please select a district and upazila from the suggestions.");
  let t=totals(),o={orderId:makeOrderId(),createdAt:new Date().toISOString(),customer:{name:String(f.get("name")||"").trim(),phone:String(f.get("phone")||"").trim(),district:selectedDistrict,area:selectedUpazila,address:String(f.get("address")||"").trim()},paymentMethod:payment,transactionId:type==="cod"?"":tid,note:String(f.get("note")||"").trim(),couponCode:appliedCoupon||"",items:cart.map(item=>{
   if(item.type==="combo"){
    const offer=getOffer(item.offerId);if(!offer)return null;
    return{id:`combo:${offer.id}`,name:offer.title||"Combo Deal",price:offerUnitPrice(offer),qty:item.qty,is_combo:true,products:offerProducts(offer).map(p=>({id:p.id,name:p.name,price:finalPrice(p),qty:item.qty}))};
   }
   const p=getProduct(item.id);return p?{id:p.id,name:p.name+(item.variant?` (${item.variant})`:""),price:finalPrice(p,item.variant),qty:item.qty}:null;
  }).filter(Boolean),subtotal:t.subtotal,delivery:t.delivery,total:t.total};
  try{await submitOrderToSupabase(o);}catch(err){console.error(err);if(err&&err.code==="P0001"){refreshStore();return alert(err.message);}return alert("ORDER ERROR\n\nMessage: "+(err.message||"Unknown")+"\nCode: "+(err.code||"N/A"));}
  localStorage.setItem("gbbd_last_order",JSON.stringify(o));try{gbTrack("Purchase",{value:Number(o.total)||0,ids:(o.items||[]).map(i=>String(i.id)),count:(o.items||[]).reduce((a,i)=>a+(Number(i.qty)||1),0),order:o.orderId})}catch(_){}let orders=JSON.parse(localStorage.getItem("gbbd_orders")||"[]");orders.unshift(o);localStorage.setItem("gbbd_orders",JSON.stringify(orders));
  cart=[];saveCart();appliedCoupon="";e.target.reset();selectedDistrict="";selectedUpazila="";if($("districtInput"))$("districtInput").value="";if($("upazilaInput")){$("upazilaInput").value="";$("upazilaInput").disabled=true;$("upazilaInput").placeholder="Select district first...";}$("transactionBox")?.classList.add("hidden");updateDeliveryInfo();closeCheckout();if($("successOrderId"))$("successOrderId").textContent=o.orderId;setupSuccessWhatsApp(o);$("successModal")?.classList.remove("hidden");
 });
}

async function trackOrdersByPhone(){
 let input=$("trackPhone"),box=$("trackingResult"),btn=$("trackOrderBtn");if(!input||!box)return;let phone=input.value.trim();if(!phone){box.classList.remove("hidden");box.innerHTML=`<div class="tracking-error">Please enter your phone number.</div>`;return;}
 if(btn){btn.disabled=true;btn.textContent="Searching...";}box.classList.remove("hidden");box.innerHTML=`<div class="tracking-loading">Searching your orders...</div>`;
 try{let {data,error}=await sb.rpc("track_orders_by_phone",{p_phone:phone});if(error)throw error;if(!data?.length){box.innerHTML=`<div class="tracking-empty"><strong>No orders found</strong><p>No order was found for this phone number.</p></div>`;return;}
 box.innerHTML=`<div class="tracking-count">${data.length} order${data.length>1?"s":""} found</div>`+data.map(o=>{let items=Array.isArray(o.items)?o.items:[];let list=items.map(i=>`<div class="tracking-product"><span>${esc(i.name||i.product_name||"Product")}</span><strong>×${Number(i.quantity??i.qty??1)}</strong></div>`).join("");let s=String(o.status||"Pending");return `<div class="tracking-order"><div class="tracking-order-head"><div><small>Order ID</small><strong>${esc(o.order_number||"")}</strong></div><span class="tracking-status ${s.toLowerCase().replace(/\s+/g,"-")}">${esc(s)}</span></div><div class="tracking-products">${list}</div>${o.tracking_no?`<div class="tracking-courier">🚚 <span>Courier</span>: <strong>${esc(o.courier||"—")}</strong> · <span>Tracking no.</span>: <strong>${esc(o.tracking_no)}</strong> <button type="button" class="link-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(o.tracking_no).replace(/'/g,"")}').then(()=>toast('Copied'))"><span>Copy</span></button></div>`:""}<div class="tracking-order-bottom"><span>📅 ${esc(o.created_at?new Date(o.created_at).toLocaleDateString():"")}</span><strong>${money(o.total)}</strong></div></div>`}).join("");
 }catch(e){console.error(e);box.innerHTML=`<div class="tracking-error"><strong>Something went wrong.</strong><p>Please try again.</p></div>`;}finally{if(btn){btn.disabled=false;btn.textContent="Track Orders";}}
}

/* Policies, delivery fees and contact details shown on the page */
function renderPolicyInfo(){
 document.querySelectorAll("[data-fee]").forEach(el=>{el.textContent=money(DELIVERY_SETTINGS[el.dataset.fee]);});
 document.querySelectorAll("[data-time]").forEach(el=>{el.textContent=DELIVERY_TIME_BN[el.dataset.time]||DELIVERY_TIME[el.dataset.time]||"";});
 document.querySelectorAll("[data-return-window]").forEach(el=>{el.textContent=RETURN_WINDOW;});
 const note=$("nearbyNote");if(note)note.textContent="ঢাকার আশেপাশে: "+NEARBY_DISTRICTS.map(d=>DISTRICT_BN[d]||d).join(", ")+"।";
 const sum=$("deliverySummary");if(sum)sum.textContent=`Dhaka within 24 hours · Outside Dhaka about 3 days`;
 const pay=$("paymentSummary");
 if(pay){const names=[];if(PAYMENT_SETTINGS.cod_enabled)names.push("ক্যাশ অন ডেলিভারি");if(PAYMENT_SETTINGS.bkash_enabled&&PAYMENT_SETTINGS.bkash_number)names.push("বিকাশ");if(PAYMENT_SETTINGS.nagad_enabled&&PAYMENT_SETTINGS.nagad_number)names.push("নগদ");pay.textContent=names.length?"গ্রহণযোগ্য পদ্ধতি: "+names.join(", ")+"।":"চেকআউটে দেখানো পদ্ধতিতে পেমেন্ট করুন।";}
 const help=$("couponHelp");if(help)help.innerHTML=couponLines();
}
function renderStoreInfo(){
 const i={...STORE_INFO};["phone","email","address","hours"].forEach(k=>{if(REMOTE_STORE[k])i[k]=REMOTE_STORE[k];});const digits=s=>String(s||"").replace(/\D/g,""),cards=[];
 const card=(icon,label,text,href)=>`<${href?`a href="${esc(href)}"${/^https?:/.test(href)?' target="_blank" rel="noopener"':''}`:"div"} class="contact-card"><span class="info-icon"><svg class="ic" aria-hidden="true"><use href="#i-${icon}"/></svg></span><span><small>${esc(label)}</small><strong>${esc(text)}</strong></span></${href?"a":"div"}>`;
 if(digits(i.whatsapp))cards.push(card("chat","WhatsApp","+"+digits(i.whatsapp),`https://wa.me/${digits(i.whatsapp)}`));
 if(String(i.phone||"").trim())cards.push(card("call","Phone",i.phone.trim(),`tel:${digits(i.phone)}`));
 if(String(i.email||"").trim())cards.push(card("mail","Email",i.email.trim(),`mailto:${i.email.trim()}`));
 if(/^https?:\/\//i.test(String(i.facebook||"").trim()))cards.push(card("link","Facebook",i.facebook.trim().replace(/^https?:\/\/(www\.)?/i,""),i.facebook.trim()));
 if(String(i.address||"").trim())cards.push(card("pin","Address",i.address.trim()));
 if(String(i.hours||"").trim())cards.push(card("clock","Open hours",i.hours.trim()));
 const grid=$("contactGrid"),sec=$("contact");
 if(grid)grid.innerHTML=cards.join("");
 sec?.classList.toggle("hidden",!cards.length);
 $("footContactLink")?.classList.toggle("hidden",!cards.length);
 const wa=$("waFloat");
 if(wa){if(digits(i.whatsapp)){wa.href=`https://wa.me/${digits(i.whatsapp)}?text=${encodeURIComponent("Hello Paboo, I need help with an order.")}`;wa.classList.remove("hidden");}else wa.classList.add("hidden");}
}
async function startCustomerSite(){initCustomerUI();updateSavedCounters();renderPolicyInfo();renderStoreInfo();renderProducts();updateCart();await refreshStore();setupLocationPickers();renderSmartRecommendations();}
window.addToCart=addToCart;window.buyNow=buyNow;window.toggleWishlist=toggleWishlist;window.toggleCompare=toggleCompare;window.showSavedProducts=showSavedProducts;window.closeSavedProducts=closeSavedProducts;window.renderSavedPanel=renderSavedPanel;window.removeSavedProduct=removeSavedProduct;window.applyCoupon=applyCoupon;
window.showDealType=showDealType;
window.viewOfferProducts=viewOfferProducts;
window.addOfferToCart=addOfferToCart;
window.buyOfferNow=buyOfferNow;
window.changeComboQty=changeComboQty;
window.removeComboFromCart=removeComboFromCart;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startCustomerSite);else startCustomerSite();
setInterval(refreshStore,60000);
document.addEventListener("DOMContentLoaded",()=>{$("trackOrderBtn")?.addEventListener("click",trackOrdersByPhone);});

/* Bottom bar: highlight the section that is open / in view */
function updateBottomBar(){
 const bar=document.querySelector(".bottom-bar");if(!bar)return;
 const open=id=>{const e=$(id);return !!e&&(e.classList.contains("open")||!e.classList.contains("hidden"));};
 let active="";
 if($("sideMenu")?.classList.contains("open"))active="categories";
 else if($("cartDrawer")?.classList.contains("open"))active="cart";
 else if($("checkoutModal")&&!$("checkoutModal").classList.contains("hidden"))active="checkout";
 else{
  const v=document.body.dataset.view||"home";
  if(v==="track")active="track";
  else if(v==="home"&&window.scrollY<300)active="home";
 }
 bar.querySelectorAll("[data-bar]").forEach(el=>{const on=el.dataset.bar===active;el.classList.toggle("is-active",on);if(on)el.setAttribute("aria-current","true");else el.removeAttribute("aria-current");});
}
document.addEventListener("DOMContentLoaded",()=>{
 updateBottomBar();
 addEventListener("scroll",updateBottomBar,{passive:true});
 addEventListener("click",()=>setTimeout(updateBottomBar,60));
 ["sideMenu","cartDrawer","checkoutModal"].forEach(id=>{const e=$(id);if(e)new MutationObserver(updateBottomBar).observe(e,{attributes:true,attributeFilter:["class"]});});
});
/* Side menu: mark the category that is currently selected */
function markCurrentCategory(){
 const cur=categoryKey(currentCategory);
 document.querySelectorAll("#sideMenu .menu-item:not(.persistent-menu)").forEach(b=>{
  const label=categoryKey(b.textContent.replace(/\d+\s*$/,""));
  b.classList.toggle("is-current",label===cur||(cur===categoryKey("All Products")&&/all products/i.test(b.textContent)));
 });
}
document.addEventListener("click",e=>{if(e.target.closest("#sideMenu"))setTimeout(markCurrentCategory,80);});
document.addEventListener("DOMContentLoaded",()=>{$("menuBtn")&&$("menuBtn").addEventListener("click",markCurrentCategory);$("sideMenu")&&null;});

/* After an order: optional WhatsApp message. The order is already saved in Supabase, so the admin panel always shows it. */
function setupSuccessWhatsApp(o){
 const btn=$("successWaBtn"),note=$("successWaNote");if(!btn)return;
 const num=String((typeof STORE_INFO!=="undefined"&&STORE_INFO.whatsapp)||"").replace(/\D/g,"");
 if(!num){btn.classList.add("hidden");note?.classList.add("hidden");return;}
 const lines=(o.items||[]).map(i=>`• ${i.name} x${i.qty}`).join("\n");
 const msg=`আসসালামু আলাইকুম, আমি Paboo-তে অর্ডার করেছি।\nOrder ID: ${o.orderId}\nনাম: ${o.customer?.name||""}\nফোন: ${o.customer?.phone||""}\n${lines}\nমোট: ৳${Number(o.total||0).toLocaleString("en-BD")}\nদয়া করে কনফার্ম করুন।`;
 btn.href=`https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
 btn.classList.remove("hidden");note?.classList.remove("hidden");
}

/* Search bar with live suggestions */
function setSearch(v,fromTop){
 const main=$("searchInput"),top=$("topSearch");
 if(main&&main.value!==v)main.value=v;
 if(top&&top.value!==v)top.value=v;
 $("topSearchClear")?.classList.toggle("hidden",!v);
 renderProducts();
}
function clearSearch(){setSearch("");hideSuggest();$("topSearch")?.focus();}
function hideSuggest(){$("searchSuggest")?.classList.add("hidden");}
function showSuggest(){
 const box=$("searchSuggest"),q=String($("topSearch")?.value||"").trim();if(!box)return;
 if(!q){box.classList.add("hidden");return;}
 const m=searchMatches(q);
 if(!m.length){box.innerHTML=`<div class="suggest-empty">No products found for "${esc(q)}"</div>`;box.classList.remove("hidden");return;}
 box.innerHTML=m.slice(0,6).map(p=>{const price=finalPrice(p);return `<button type="button" class="suggest-item" data-id="${esc(p.id)}"><span class="suggest-img">${productImg(p)}</span><span class="suggest-text"><strong>${esc(p.name)}</strong><small>${esc(p.cat)}${p.stock<=0?" • Out of stock":""}</small></span><b>${money(price)}</b></button>`;}).join("")+(m.length>6?`<button type="button" class="suggest-all" data-all="1">See all ${m.length} results</button>`:`<button type="button" class="suggest-all" data-all="1">Show ${m.length} result${m.length>1?"s":""} below</button>`);
 box.classList.remove("hidden");
}
function goToResults(){hideSuggest();$("products")?.scrollIntoView({behavior:"smooth"});}
function setupSearch(){
 const top=$("topSearch");if(!top||top.dataset.ready==="1")return;top.dataset.ready="1";
 top.addEventListener("input",()=>{setSearch(top.value);showSuggest();});
 top.addEventListener("focus",showSuggest);
 top.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();goToResults();top.blur();}if(e.key==="Escape"){hideSuggest();top.blur();}});
 $("topSearchClear")?.addEventListener("click",clearSearch);
 $("searchSuggest")?.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.all){goToResults();return;}
  if(b.dataset.id){hideSuggest();viewProductDetails(b.dataset.id);}
 });
 document.addEventListener("click",e=>{if(!e.target.closest(".search-box"))hideSuggest();});
 $("searchInput")?.addEventListener("input",()=>{const v=$("searchInput").value;if(top.value!==v){top.value=v;$("topSearchClear")?.classList.toggle("hidden",!v);}});
}
document.addEventListener("DOMContentLoaded",setupSearch);
window.clearSearch=clearSearch;

/* ===== Simple page router: each button opens its own page (no long scrolling) =====
   Pages are shown/hidden with CSS using body[data-view]; links are real #hashes, so the phone's Back button works. */
const VIEW_BY_ID={shopCategories:"categories",newArrivals:"new-arrivals",bestSellers:"best-sellers",featuredProducts:"featured",orderTracking:"track",about:"about",policies:"policies",contact:"contact",products:"home",dealZone:"home",flashSale:"flash"};
const VIEW_TITLES={categories:"Categories","new-arrivals":"New Arrivals","best-sellers":"Best Sellers & Top Picks",featured:"Featured Products",track:"Track Your Order",about:"About Us",policies:"Our Policies",contact:"Contact Us",flash:"Flash Sale"};
let gbNavCount=0;
function viewFromHash(){let id="";try{id=decodeURIComponent(location.hash.slice(1));}catch(e){}return VIEW_BY_ID[id]||"home";}
function setView(v,scrollTarget){
 document.body.dataset.view=v;
 const t=$("pageHeadTitle");if(t)t.textContent=VIEW_TITLES[v]||"";
 if(v==="home"&&scrollTarget){requestAnimationFrame(()=>scrollTarget.scrollIntoView({behavior:"smooth"}));}
 else window.scrollTo(0,0);
 updateBottomBar();
}
function applyView(){
 const id=location.hash.slice(1);
 setView(viewFromHash(),VIEW_BY_ID[id]==="home"?$(id):null);
}
function gbGo(view){
 const id=Object.keys(VIEW_BY_ID).find(k=>VIEW_BY_ID[k]===view&&k!=="products"&&k!=="dealZone");
 if(view==="home"){if(location.hash)history.pushState(null,"",location.pathname+location.search);setView("home");return;}
 if(id){location.hash=id;}
}
function gbBack(){
 if(gbNavCount>0)history.back();
 else{history.replaceState(null,"",location.pathname+location.search);setView("home");}
}
addEventListener("hashchange",()=>{gbNavCount++;applyView();});
addEventListener("popstate",()=>{if(!location.hash)setView("home");});
// Any existing "scroll to this section" call opens the page that contains the section.
(function(){
 const original=Element.prototype.scrollIntoView;
 Element.prototype.scrollIntoView=function(opts){
  try{
   const sec=this.closest&&this.closest("main > [data-v]");
   if(sec&&sec.offsetParent===null&&!sec.classList.contains("hidden")&&sec.id&&VIEW_BY_ID[sec.id]){
    const v=VIEW_BY_ID[sec.id];document.body.dataset.view=v;
    if(location.hash.slice(1)!==sec.id){gbNavCount++;history.pushState(null,"","#"+sec.id);}
    const t=$("pageHeadTitle");if(t)t.textContent=VIEW_TITLES[v]||"";
    updateBottomBar();
    if(v!=="home"){window.scrollTo(0,0);return;}
   }
  }catch(e){}
  return original.call(this,opts);
 };
})();
document.addEventListener("DOMContentLoaded",()=>{if(location.hash)applyView();else setView("home");});
window.gbGo=gbGo;window.gbBack=gbBack;

/* =========================================================
   MARKETING: traffic source (?src=) + Facebook / TikTok Pixel
   >>> Paste your Pixel IDs below (leave '' to keep a pixel off) <<<
========================================================= */
const PIXELS={facebook:"",tiktok:""};
function gbSource(){try{return localStorage.getItem("gbbd_src")||""}catch(e){return ""}}
(function(){try{const s=new URLSearchParams(location.search).get("src");if(s){const c=s.replace(/[^A-Za-z0-9_-]/g,"").slice(0,40);if(c)localStorage.setItem("gbbd_src",c)}}catch(e){}})();
(function initPixels(){
 try{
  if(PIXELS.facebook&&!window.fbq){
   !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
   fbq("init",PIXELS.facebook);fbq("track","PageView");
  }
  if(PIXELS.tiktok&&!window.ttq){
   !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._t=ttq._t||{};ttq._t[e]=+new Date;var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=n+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(PIXELS.tiktok);ttq.page()}(window,document,"ttq");
  }
 }catch(e){console.warn("pixel init failed",e)}
})();
function gbTrack(ev,d){
 d=d||{};
 try{
  if(window.fbq){
   const m={ViewContent:"ViewContent",AddToCart:"AddToCart",InitiateCheckout:"InitiateCheckout",Purchase:"Purchase"}[ev];
   if(m)fbq("track",m,{value:d.value||0,currency:"BDT",content_ids:d.ids||[],content_type:"product",num_items:d.count||undefined});
  }
  if(window.ttq){
   const m={ViewContent:"ViewContent",AddToCart:"AddToCart",InitiateCheckout:"InitiateCheckout",Purchase:"CompletePayment"}[ev];
   if(m)ttq.track(m,{value:d.value||0,currency:"BDT",content_id:(d.ids||[])[0]||"",content_type:"product"});
  }
 }catch(e){}
}
(function(){
 const price=id=>{try{const p=getProduct(id);return p?finalPrice(p):0}catch(e){return 0}};
 const _add=window.addToCart;window.addToCart=function(id){const r=_add.apply(this,arguments);gbTrack("AddToCart",{value:price(id),ids:[String(id)]});return r};
 const _buy=window.buyNow;window.buyNow=function(id){gbTrack("AddToCart",{value:price(id),ids:[String(id)]});return _buy.apply(this,arguments)};
 const _co=window.openCheckout;window.openCheckout=function(){try{const t=totals();gbTrack("InitiateCheckout",{value:t.total,ids:cart.map(i=>String(i.id)),count:cart.length})}catch(e){}return _co.apply(this,arguments)};
 let seen="";const _pg=window.handleProductPageRoute;
 window.handleProductPageRoute=function(){const r=_pg.apply(this,arguments);try{const id=new URLSearchParams(location.search).get("product");if(id&&id!==seen&&getProduct(id)){seen=id;gbTrack("ViewContent",{value:price(id),ids:[id]})}}catch(e){}return r};
})();

/* =========================================================
   FLASH SALE: timed discounts (set in Admin > Products; the server enforces the same window)
========================================================= */
function isSale(p){return !!(p&&p.saleEndMs&&p.saleEndMs>Date.now()&&Number(p.discount)>0);}
function saleParts(end){let t=Math.max(0,Math.floor((end-Date.now())/1000));const d=Math.floor(t/86400);t%=86400;return{d,h:Math.floor(t/3600),m:Math.floor(t%3600/60),s:t%60};}
const two=n=>String(n).padStart(2,"0");
function saleLeftText(end){const x=saleParts(end);return (x.d?x.d+" দিন ":"")+two(x.h)+":"+two(x.m)+":"+two(x.s);}
function saleBoxesHtml(end){const x=saleParts(end);const b=(n,l)=>`<div class="sbx"><b>${two(n)}</b><span>${l}</span></div>`;return (x.d?b(x.d,"দিন"):"")+b(x.h,"ঘণ্টা")+b(x.m,"মিনিট")+b(x.s,"সেকেন্ড");}
function saleStrip(p){return isSale(p)?`<div class="sale-strip"><span>⚡ ফ্ল্যাশ সেল</span><b data-sale-end="${p.saleEndMs}">${saleLeftText(p.saleEndMs)}</b></div>`:"";}
function saleStock(p){if(!isSale(p))return"";const n=Math.max(0,Math.floor(Number(p.stock)||0));if(n<=0||n>10)return"";return `<div class="sale-stock"><div class="sale-bar"><i style="width:${Math.max(8,Math.round(n/10*100))}%"></i></div><small>🔥 মাত্র ${n}টি বাকি</small></div>`;}
function saleBox(p){if(!isSale(p))return"";const n=Math.max(0,Math.floor(Number(p.stock)||0));const low=n>0&&n<=10;return `<div class="sale-box"><div class="sale-box-top"><span>⏱ ফ্ল্যাশ সেল শেষ হতে বাকি</span>${low?`<span class="sale-low">🔥 মাত্র ${n}টি বাকি</span>`:""}</div><div class="sale-boxes" data-sale-boxes="${p.saleEndMs}">${saleBoxesHtml(p.saleEndMs)}</div>${low?`<div class="sale-bar"><i style="width:${Math.max(8,Math.round(n/10*100))}%"></i></div>`:""}</div>`;}
function renderFlashSale(){
 const list=(typeof products!=="undefined"?products:[]).filter(p=>isSale(p)&&Number(p.stock)>0);
 const on=list.length>0;
 document.querySelectorAll(".needs-flash").forEach(el=>el.classList.toggle("hidden",!on));
 if(on){
  const end=Math.min(...list.map(p=>p.saleEndMs));
  const bt=$("flashBarTime");if(bt){bt.dataset.saleEnd=end;bt.textContent=saleLeftText(end);}
  const bx=$("flashBoxes");if(bx){bx.dataset.saleBoxes=end;bx.innerHTML=saleBoxesHtml(end);}
  renderHomeProductGrid("flashSaleGrid",list,"",48);
 }else if(document.body.dataset.view==="flash"){try{gbGo("home")}catch(e){}}
}
let _saleSig;
function saleTick(){
 document.querySelectorAll("[data-sale-end]").forEach(el=>{el.textContent=saleLeftText(Number(el.dataset.saleEnd));});
 document.querySelectorAll("[data-sale-boxes]").forEach(el=>{el.innerHTML=saleBoxesHtml(Number(el.dataset.saleBoxes));});
 if(typeof products==="undefined"||!products.length)return;
 const sig=products.map(p=>discountNow(p.rawDiscount,{s:p.saleStartMs,e:p.saleEndMs})>0?1:0).join("");
 if(_saleSig!==undefined&&_saleSig!==sig){
  products.forEach(p=>{p.discount=discountNow(p.rawDiscount,{s:p.saleStartMs,e:p.saleEndMs});});
  try{saveCart();renderProducts();renderHomepageShowcases();updateCart();renderOffers();renderFlashSale();if(new URLSearchParams(location.search).get("product"))handleProductPageRoute();}catch(e){console.warn(e);}
 }
 _saleSig=sig;
}
setInterval(saleTick,1000);

/* =========================================================
   THEMES: the store default is chosen in Admin > Settings; customers can change it for themselves
========================================================= */
const GB_THEMES={ocean:["সাগর নীল",1,"#06101f","#25b7ff"],violet:["বেগুনি",1,"#0d0a1f","#a78bfa"],emerald:["সবুজ",1,"#05140f","#34d399"],sunset:["কমলা",1,"#140a06","#fb923c"],gold:["সোনালি",1,"#0a0a0a","#e0b84a"],light:["সাদা-নীল",0,"#f3f7fc","#1877f2"],rose:["গোলাপি",0,"#fff5f7","#e11d74"],daraz:["লাল-সাদা",0,"#f4f4f4","#e8343a"],mint:["পুদিনা",0,"#effaf6","#0d9f7a"],slate:["ধূসর",1,"#0f1216","#38bdf8"]};
function gbStoreTheme(){try{const t=localStorage.getItem("gbbd_store_theme");return GB_THEMES[t]?t:"ocean"}catch(e){return "ocean"}}
function gbUserTheme(){try{const t=localStorage.getItem("gbbd_theme");return GB_THEMES[t]?t:""}catch(e){return ""}}
function gbEffectiveTheme(){return gbUserTheme()||gbStoreTheme();}
function gbApplyTheme(){const t=gbEffectiveTheme();document.documentElement.setAttribute("data-theme",t);const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",GB_THEMES[t][2]);}
function gbSaveUserTheme(t){try{if(t)localStorage.setItem("gbbd_theme",t);else localStorage.removeItem("gbbd_theme");}catch(e){}gbApplyTheme();renderThemePicker();}
function setThemeMode(mode){
 const st=gbStoreTheme();
 if(mode==="default")return gbSaveUserTheme("");
 if(mode==="dark")return gbSaveUserTheme(GB_THEMES[st][1]?st:"ocean");
 return gbSaveUserTheme(!GB_THEMES[st][1]?st:"light");
}
function renderThemePicker(){
 const box=$("themeCard");if(!box)return;
 const cur=gbEffectiveTheme(),user=gbUserTheme(),st=gbStoreTheme(),dark=GB_THEMES[cur][1];
 const sw=(k,label,extra)=>{const t=GB_THEMES[k];return `<button type="button" class="theme-opt ${extra}" onclick="${k===st&&label==="ডিফল্ট"?"gbSaveUserTheme('')":`gbSaveUserTheme('${k}')`}"><span class="theme-sw" style="background:${t[2]}"><i style="background:${t[3]}"></i></span><span>${label}</span></button>`;};
 box.innerHTML=`<div class="theme-head"><h3>🎨 সাইটের রঙ বেছে নিন</h3><button type="button" onclick="closeThemePicker()" aria-label="বন্ধ করুন">×</button></div>
 <div class="theme-modes"><button type="button" class="${!user?"on":""}" onclick="setThemeMode('default')">↺ ডিফল্ট</button><button type="button" class="${user&&!dark?"on":""}" onclick="setThemeMode('light')">☀️ হালকা</button><button type="button" class="${user&&dark?"on":""}" onclick="setThemeMode('dark')">🌙 গাঢ়</button></div>
 <div class="theme-grid">${sw(st,"ডিফল্ট",!user?"on":"")}${Object.keys(GB_THEMES).filter(k=>k!==st).map(k=>sw(k,GB_THEMES[k][0],user===k?"on":"")).join("")}</div>
 <p class="theme-note">আপনার পছন্দ এই ফোনেই মনে থাকবে। "ডিফল্ট" মানে দোকানের নিজস্ব রঙ।</p>`;
}
function openThemePicker(){renderThemePicker();$("themeSheet")?.classList.remove("hidden");}
function closeThemePicker(){$("themeSheet")?.classList.add("hidden");}
window.openThemePicker=openThemePicker;window.closeThemePicker=closeThemePicker;window.setThemeMode=setThemeMode;window.gbSaveUserTheme=gbSaveUserTheme;
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeThemePicker();});
gbApplyTheme();

/* ===== Product columns picker (shown only when the admin switches it on) ===== */
(function(){
 const KEY="gbbd_cols",ON="gbbd_cols_on";
 let enabled=false;try{enabled=localStorage.getItem(ON)==="1"}catch(e){}
 function saved(){try{const v=localStorage.getItem(KEY);return /^[1-5]$/.test(v||"")?v:""}catch(e){return""}}
 function apply(){
  const r=document.documentElement,n=enabled?saved():"";
  r.classList.toggle("cols-on",enabled);
  if(n)r.setAttribute("data-cols",n);else r.removeAttribute("data-cols");
  document.querySelectorAll(".col-picker button").forEach(b=>b.classList.toggle("on",b.dataset.cols===n));
 }
 window.gbSetCols=function(n){try{localStorage.setItem(KEY,String(n))}catch(e){}apply()};
 window.gbColsEnabled=function(on){enabled=!!on;try{localStorage.setItem(ON,on?"1":"0")}catch(e){}apply()};
 function init(){document.querySelectorAll(".col-picker button").forEach(b=>b.addEventListener("click",()=>window.gbSetCols(b.dataset.cols)));apply()}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
 apply();
})();

/* ===== Add to Home Screen (PWA) ===== */
let _gbInstallEvt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();_gbInstallEvt=e;});
window.addEventListener("appinstalled",()=>{_gbInstallEvt=null;try{toast("Installed!")}catch(_){}});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
function gbIsStandalone(){return window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;}
async function gbInstall(){
 if(gbIsStandalone()){toast("Already installed");return;}
 if(_gbInstallEvt){const ev=_gbInstallEvt;_gbInstallEvt=null;ev.prompt();try{await ev.userChoice}catch(_){}return;}
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 const steps=ios?["Tap the Share button at the bottom of Safari.","Scroll down and tap “Add to Home Screen”.","Tap “Add”. The Paboo icon will appear on your phone."]
  :["Tap the ⋮ menu at the top-right of Chrome.","Tap “Add to Home screen” (or “Install app”).","Tap “Add”. The Paboo icon will appear on your phone."];
 $("installSteps").innerHTML="<ol>"+steps.map(s=>"<li>"+esc(s)+"</li>").join("")+"</ol>";
 $("installSheet")?.classList.remove("hidden");
}
function closeInstallHelp(){$("installSheet")?.classList.add("hidden");}
window.gbInstall=gbInstall;window.closeInstallHelp=closeInstallHelp;


/* ===== Incomplete-order capture: when a valid phone is typed at checkout, remember name + cart so the shop can follow up ===== */
(function(){
 let timer=null,last="";
 function lines(){
  return cart.map(x=>{
   if(x.type==="combo"){const o=typeof getOffer==="function"?getOffer(x.offerId):null;return{name:(o&&o.title)||"Combo",qty:x.qty,price:0}}
   const p=getProduct(x.id);return p?{name:p.name+(x.variant?` (${x.variant})`:""),qty:x.qty,price:finalPrice(p,x.variant)}:null}).filter(Boolean);
 }
 function send(){
  const f=$("checkoutForm");if(!f||!cart.length)return;
  const phone=String(f.elements.phone?.value||"").trim(),digits=phone.replace(/\D/g,"");
  if(!/^(?:88)?01\d{9}$/.test(digits))return;
  const name=String(f.elements.name?.value||"").trim(),key=digits+"|"+name+"|"+cart.length+"|"+cart.reduce((a,x)=>a+x.qty,0);
  if(key===last)return;last=key;
  const t=typeof totals==="function"?totals():{total:0};
  sb.rpc("save_incomplete",{p_name:name,p_phone:phone,p_items:lines(),p_total:Number(t.total)||0}).then(()=>{},()=>{});
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(send,1200)}
 function init(){const f=$("checkoutForm");if(!f)return;["input","change","blur"].forEach(ev=>f.addEventListener(ev,e=>{if(e.target&&(e.target.name==="phone"||e.target.name==="name"))schedule()},true))}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
