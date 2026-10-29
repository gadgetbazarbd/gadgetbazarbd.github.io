// Paboo — customer site / Supabase
const SUPABASE_URL="https://vwwysrdqexjtlmpmevub.supabase.co";
const SUPABASE_KEY="sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=id=>document.getElementById(id);
const _nf=new Intl.NumberFormat("en-BD"),money=n=>"৳"+_nf.format(Number(n||0));

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
 facebook:"https://facebook.com/paboo.official",
 tiktok:"",     // TikTok page link or @name   // Full page link. Example: "https://facebook.com/yourpage"
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
let GB_VARS_ON=false,SIZE_GUIDE={text:"",image:""};const gbPicked={};
function gbParseVars(v){if(typeof v==="string"){try{v=JSON.parse(v)}catch(e){v=[]}}if(!Array.isArray(v))return[];return v.map(x=>({name:String((x&&x.name)||"").trim(),stock:Math.max(0,Math.floor(Number(x&&x.stock)||0)),price:Number(x&&x.price)>0?Number(x.price):0,c:String((x&&x.c)||"").trim(),s:String((x&&x.s)||"").trim()})).filter(x=>x.name);}
function pvars(p){return GB_VARS_ON&&p&&Array.isArray(p.variants)&&p.variants.length?p.variants:[];}
function vOf(p,n){return n?pvars(p).find(v=>v.name===n)||null:null;}
function stockOf(p,n){const v=vOf(p,n);return v?v.stock:(Number(p.stock)||0);}
function gbVar(id){const p=getProduct(id);const n=gbPicked[String(id)];return p&&vOf(p,n)?n:null;}
/* ===== Clothing: colours, sizes, measurements, size chart ===== */
const gbPickC={},gbPickS={};
function gbParseColors(v){if(typeof v==="string"){try{v=JSON.parse(v)}catch(e){v=[]}}if(!Array.isArray(v))return[];return v.map(x=>({n:String((x&&x.n)||"").trim(),h:/^#[0-9a-f]{3,8}$/i.test(String((x&&x.h)||""))?x.h:"#cccccc",i:/^https?:\/\//i.test(String((x&&x.i)||""))?x.i:""})).filter(x=>x.n);}
function gbParseChart(v){if(typeof v==="string"){try{v=JSON.parse(v)}catch(e){v=null}}if(!v||typeof v!=="object")return{unit:"",cols:[],rows:[]};const cols=(Array.isArray(v.cols)?v.cols:[]).map(x=>String(x||"").trim());const rows=(Array.isArray(v.rows)?v.rows:[]).filter(r=>r&&String(r.s||"").trim()&&r.on!==false).map(r=>({s:String(r.s).trim(),v:cols.map((_,i)=>String(((r.v||[])[i])??"").trim())}));return{unit:String(v.unit||"").trim(),cols,rows};}
function isCloth(p){return !!p&&p.dept==="clothing";}
function clothAxes(p){
 const vs=pvars(p),cs=[],ss=[];
 vs.forEach(v=>{if(v.c&&!cs.includes(v.c))cs.push(v.c);if(v.s&&!ss.includes(v.s))ss.push(v.s);});
 const co=(p.colors||[]).map(c=>c.n).filter(n=>cs.includes(n));cs.forEach(n=>{if(!co.includes(n))co.push(n);});
 const so=((p.sizeChart||{rows:[]}).rows).map(r=>r.s).filter(n=>ss.includes(n));ss.forEach(n=>{if(!so.includes(n))so.push(n);});
 return{colors:co,sizes:so,vs};
}
function clothHex(p,n){const c=(p.colors||[]).find(x=>x.n===n);return c?c.h:"#cccccc";}
function clothStockFor(vs,c,s){return vs.filter(v=>(!c||v.c===c)&&(!s||v.s===s)).reduce((a,v)=>a+v.stock,0);}
function gbClothMini(p){
 if(!isCloth(p))return"";const a=clothAxes(p);if(!a.colors.length&&!a.sizes.length)return"";
 const dots=a.colors.slice(0,6).map(n=>`<i class="cm-dot" title="${esc(n)}" style="background:${esc(clothHex(p,n))}"></i>`).join("")+(a.colors.length>6?`<em class="cm-more">+${a.colors.length-6}</em>`:"");
 const sz=a.sizes.slice(0,6).map(z=>`<span class="cm-sz${clothStockFor(a.vs,"",z)<=0?' off':''}" data-no-i18n>${esc(z)}</span>`).join("");
 const low=Number(p.stock)>0&&Number(p.stock)<=3?`<div class="cm-low">Only ${Number(p.stock)} left</div>`:"";
 return `<div class="cloth-mini">${dots?`<div class="cm-dots">${dots}</div>`:""}${sz?`<div class="cm-sizes">${sz}</div>`:""}${low}</div>`;
}
function clothChartBox(p,sel){
 const ch=p.sizeChart||{rows:[],cols:[]};if(!ch.rows.length||!ch.cols.some(Boolean))return"";
 const guide=(SIZE_GUIDE.text||SIZE_GUIDE.image)?`<details class="size-guide"><summary>How to measure</summary><div>${SIZE_GUIDE.image?`<img src="${esc(SIZE_GUIDE.image)}" alt="" loading="lazy">`:""}${SIZE_GUIDE.text?`<p data-no-i18n>${esc(SIZE_GUIDE.text).replace(/\n/g,"<br>")}</p>`:""}</div></details>`:"";
 return `<div class="size-chart"><div class="sc-title">Size chart${ch.unit?` <small data-no-i18n>(${esc(ch.unit)})</small>`:""}</div>${guide}<div class="sc-wrap"><table><thead><tr><th>Size</th>${ch.cols.map(n=>`<th data-no-i18n>${esc(n)}</th>`).join("")}</tr></thead><tbody>${ch.rows.map(r=>`<tr class="${r.s===sel?'sel':''}"><th data-no-i18n>${esc(r.s)}</th>${r.v.map(x=>`<td data-no-i18n>${esc(x||"—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}
function clothPicker(p){
 const a=clothAxes(p),id=String(p.id);let c=gbPickC[id]||"",s=gbPickS[id]||"";
 if(c&&!a.colors.includes(c))c="";if(s&&!a.sizes.includes(s))s="";
 const cur=gbVar(p.id);let h='<div class="variant-box cloth-box">';
 if(a.colors.length)h+=`<div class="variant-title">Colour: <b class="cl-val" data-no-i18n>${esc(c||"—")}</b></div><div class="cl-colors">${a.colors.map(n=>{const out=clothStockFor(a.vs,n,s)<=0;return `<button type="button" class="cl-dot ${c===n?'active':''}" ${out?'disabled':''} title="${esc(n)}" aria-label="${esc(n)}" onclick="gbPickCS(${esc(jsArg(p.id))},'c',${esc(jsArg(n))})"><i style="background:${esc(clothHex(p,n))}"></i></button>`;}).join("")}</div>`;
 if(a.sizes.length)h+=`<div class="variant-title vt-row"><span>Size: <b class="cl-val" data-no-i18n>${esc(s||"—")}</b></span>${(p.sizeChart&&p.sizeChart.rows&&p.sizeChart.rows.length&&p.sizeChart.cols.some(Boolean))?`<button type="button" class="pd-link" onclick="gbInfoSheet(${esc(jsArg(p.id))},'chart')"><span aria-hidden="true">📏</span> <span>Size chart</span></button>`:""}</div><div class="variant-chips">${a.sizes.map(z=>{const out=clothStockFor(a.vs,c,z)<=0;return `<button type="button" class="variant-chip ${s===z?'active':''}" ${out?'disabled':''} onclick="gbPickCS(${esc(jsArg(p.id))},'s',${esc(jsArg(z))})" data-no-i18n>${esc(z)}</button>`;}).join("")}</div>`;
 const ch=p.sizeChart;
 if(s&&ch&&ch.cols.length){const r=ch.rows.find(x=>x.s===s);if(r){const parts=ch.cols.map((n,i)=>r.v[i]?`<span><em data-no-i18n>${esc(n)}</em> <b data-no-i18n>${esc(r.v[i])}</b></span>`:"").filter(Boolean);if(parts.length)h+=`<div class="size-meas"><strong data-no-i18n>${esc(s)}</strong>${parts.join("")}${ch.unit?`<small data-no-i18n>(${esc(ch.unit)})</small>`:""}</div>`;}}
h+=cur?(stockOf(p,cur)<=3?`<small class="variant-note cm-low">Only ${stockOf(p,cur)} left</small>`:`<small class="variant-note">In stock: ${stockOf(p,cur)}</small>`):`<small class="variant-note">${a.colors.length&&a.sizes.length?"Choose colour and size first":(a.colors.length?"Choose a colour first":"Choose a size first")}</small>`;
 return h+"</div>";
}

function pdShort(p,specs){
 const d=String(p.description||'').trim(),sd=d.length>120?d.slice(0,117).replace(/\s+\S*$/,'')+'…':d;
 const ch=specs.slice(0,3).map(([k,v])=>`<span class="pd-fact"><em>${esc(k)}</em> <b>${esc(v)}</b></span>`).join('');
 if(!sd&&!ch)return'';
 return `<div class="pd-short">${sd?`<p>${esc(sd)}</p>`:''}${ch?`<div class="pd-facts">${ch}</div>`:''}<button type="button" class="pd-link pd-more" onclick="gbInfoSheet(${esc(jsArg(p.id))},'details')"><span aria-hidden="true">📄</span> <span data-no-i18n>বিস্তারিত দেখতে ক্লিক করুন</span></button></div>`;
}
function gbInfoSheet(id,kind){
 const p=getProduct(id);if(!p)return;let pop=$('gbInfoPop');
 if(!pop){pop=document.createElement('div');pop.id='gbInfoPop';pop.className='gb-info-pop';document.body.appendChild(pop);}
 let body="",title="";
 if(kind==='chart'){title="Size chart";body=clothChartBox(p,gbPickS[String(p.id)]||"");}
 else{title="বিস্তারিত";const sp=gbSpecs(p);body=(p.description?`<p class="gip-desc">${esc(p.description).replace(/\n/g,'<br>')}</p>`:'')+(sp.length?`<dl class="gip-specs">${sp.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`:'')||'<p class="gip-desc">—</p>';}
 pop.innerHTML=`<div class="gip-bd" onclick="gbInfoClose()"></div><section class="gip-card"><header><strong>${title}</strong><button type="button" onclick="gbInfoClose()" aria-label="Close">×</button></header><div class="gip-body">${body}</div></section>`;
 pop.classList.add('open');
}
function gbInfoClose(){$('gbInfoPop')?.classList.remove('open');}
window.gbInfoSheet=gbInfoSheet;window.gbInfoClose=gbInfoClose;
function gbPickCS(id,kind,val){
 id=String(id);const p=getProduct(id);if(!p)return;
 const m=kind==="c"?gbPickC:gbPickS;m[id]=m[id]===val?"":val;
 const a=clothAxes(p);let c=gbPickC[id]||"",s=gbPickS[id]||"";
 if(c&&s&&clothStockFor(a.vs,c,s)<=0){if(kind==="c")gbPickS[id]="";else gbPickC[id]="";c=gbPickC[id]||"";s=gbPickS[id]||"";}
 const need=(a.colors.length?!!c:true)&&(a.sizes.length?!!s:true);
 const v=need?a.vs.find(x=>(x.c||"")===(a.colors.length?c:"")&&(x.s||"")===(a.sizes.length?s:"")):null;
 if(v)gbPicked[id]=v.name;else delete gbPicked[id];
 const mm=$('productDetailsModal');if(mm&&mm.classList.contains('is-open'))viewProductDetails(id);else handleProductPageRoute();
}
window.gbPickCS=gbPickCS;
function variantChips(p){
 if(isCloth(p)&&clothAxes(p).vs.length)return clothPicker(p);
 const vs=pvars(p);if(!vs.length)return"";const cur=gbVar(p.id);
 return `<div class="variant-box"><div class="variant-title">Option</div><div class="variant-chips">${vs.map(v=>`<button type="button" class="variant-chip ${cur===v.name?'active':''}" ${v.stock<=0?'disabled':''} onclick="gbPickVariant(${esc(jsArg(p.id))},${esc(jsArg(v.name))})">${esc(v.name)}${v.stock<=0?'<span class="vc-sub">Sold out</span>':(v.price>0?'<span class="vc-sub">'+money(v.price)+'</span>':'')}</button>`).join('')}</div>${cur?`<small class="variant-note">In stock: ${stockOf(p,cur)}</small>`:'<small class="variant-note">Choose an option first</small>'}</div>`;
}
function gbPickVariant(id,name){gbPicked[String(id)]=name;const m=$('productDetailsModal');if(m&&m.classList.contains('is-open'))viewProductDetails(id);else handleProductPageRoute();}
window.gbPickVariant=gbPickVariant;
function normalizeProduct(r){const _w=saleWindow(r);return{
 rawDiscount:Number(r.discount||0),saleStartMs:_w.s,saleEndMs:_w.e,
 variants:gbParseVars(r.variants),
 dept:r.dept==="clothing"?"clothing":"gadget",colors:gbParseColors(r.colors),sizeChart:gbParseChart(r.size_chart),
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

/* ---- Facebook / TikTok / WhatsApp buttons (edited in Admin > Settings) ---- */
let SOCIAL=null;
const GB_SOC_ICONS={
 facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.4H7.7V13h2.7v8h3.1z"/></svg>',
 tiktok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v2.8c-1.4.1-2.7-.3-3.9-1.1v6.1c0 3.2-2.6 5.2-5.4 4.9-3-.3-4.9-3.2-4-6 .7-2.2 2.9-3.5 5.2-3.2v2.9c-1.1-.3-2.3.3-2.6 1.4-.4 1.4.7 2.7 2.1 2.6 1.1-.1 1.8-1 1.8-2.1V3h2.9z"/></svg>',
 whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M12 2.8a9.2 9.2 0 0 0-7.9 13.9L2.8 21.2l4.6-1.2A9.2 9.2 0 1 0 12 2.8z"/><path fill="currentColor" d="M8.9 7.7c-.3 0-.6.2-.8.6-.5 1-.2 2.3.8 3.7 1.2 1.7 2.7 2.8 4.2 3.2.6.1 1.5-.2 1.8-.8.1-.3.1-.6 0-.7l-1.5-.8c-.2-.1-.5 0-.6.2l-.4.5c-.9-.4-1.7-1.2-2.2-2.1l.4-.5c.1-.2.2-.4.1-.6l-.8-1.6c-.1-.2-.4-.3-.7-.3z"/></svg>'
};
function gbSocialUrl(kind,v){
 v=String(v||"").trim();if(!v)return"";
 if(/^https?:\/\//i.test(v))return v;
 if(kind==="facebook")return "https://facebook.com/"+v.replace(/^(www\.)?facebook\.com\//i,"").replace(/^@/,"");
 if(kind==="tiktok")return "https://www.tiktok.com/@"+v.replace(/^(www\.)?tiktok\.com\/@?/i,"").replace(/^@/,"");
 return"";
}
function gbSocialLinks(){
 const S=SOCIAL||{},out=[],digits=s=>String(s||"").replace(/\D/g,"");
 const on=k=>!(S[k]&&S[k].show===false);
 const num=digits((S.whatsapp&&S.whatsapp.number)||REMOTE_STORE.whatsapp||STORE_INFO.whatsapp);
 if(on("whatsapp")&&num){const msg=(S.whatsapp&&S.whatsapp.message)||"Hello Paboo, I need help with an order.";out.push({key:"whatsapp",label:"WhatsApp",text:"+"+num,url:`https://wa.me/${num}?text=${encodeURIComponent(msg)}`});}
 const fb=gbSocialUrl("facebook",(S.facebook&&S.facebook.url)!==undefined?S.facebook.url:STORE_INFO.facebook);
 if(on("facebook")&&fb)out.push({key:"facebook",label:"Facebook",text:fb.replace(/^https?:\/\/(www\.)?/i,""),url:fb});
 const tk=gbSocialUrl("tiktok",(S.tiktok&&S.tiktok.url)!==undefined?S.tiktok.url:STORE_INFO.tiktok);
 if(on("tiktok")&&tk)out.push({key:"tiktok",label:"TikTok",text:tk.replace(/^https?:\/\/(www\.)?/i,""),url:tk});
 return out;
}
function gbRenderSocial(links){
 links=links||gbSocialLinks();
 const order=["facebook","tiktok","whatsapp"],list=order.map(k=>links.find(x=>x.key===k)).filter(Boolean);
 const row=$("socialRow");
 if(row)row.innerHTML=list.map(x=>`<a class="social-btn soc-${x.key}" href="${esc(x.url)}" target="_blank" rel="noopener"><span class="soc-ic">${GB_SOC_ICONS[x.key]}</span><span class="soc-tx"><b>${x.label}</b><small>${x.key==="whatsapp"?"Chat now":"Visit our page"}</small></span></a>`).join("");
 $("socialSection")?.classList.toggle("hidden",!list.length);
 const fl=$("socialFloat"),pop=$("socialPop"),btn=$("waFloat");
 if(fl&&pop&&btn){
  pop.innerHTML=list.map(x=>`<a class="soc-circle soc-${x.key}" href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${x.label}" title="${x.label}"><span class="soc-ic">${GB_SOC_ICONS[x.key]}</span><em>${x.label}</em></a>`).join("");
  fl.classList.toggle("hidden",!list.length);
  fl.dataset.count=String(list.length);
  if(list.length===1){btn.dataset.direct=list[0].url;}else delete btn.dataset.direct;
  gbCloseSocial();
 }
}
function gbToggleSocial(){
 const fl=$("socialFloat"),btn=$("waFloat");if(!fl||!btn)return;
 if(btn.dataset.direct){window.open(btn.dataset.direct,"_blank","noopener");return;}
 const open=!fl.classList.contains("open");fl.classList.toggle("open",open);btn.setAttribute("aria-expanded",open?"true":"false");
}
function gbCloseSocial(){const fl=$("socialFloat"),btn=$("waFloat");if(fl)fl.classList.remove("open");if(btn)btn.setAttribute("aria-expanded","false");}
document.addEventListener("click",e=>{const fl=$("socialFloat");if(fl&&fl.classList.contains("open")&&!fl.contains(e.target))gbCloseSocial();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")gbCloseSocial();});
window.gbToggleSocial=gbToggleSocial;window.gbCloseSocial=gbCloseSocial;
async function loadStoreInfo(){
 try{
  const {data,error}=await sb.from("store_settings").select("*").limit(1).maybeSingle();
  if(error)throw error;
  try{if(data&&GB_THEMES[data.theme])localStorage.setItem("gbbd_store_theme",data.theme);}catch(_){}gbApplyTheme();
  try{window.gbColsEnabled(!!(data&&data.col_picker));}catch(_){}
  GB_VARS_ON=!!(data&&data.variants_on);
  POLICIES=gbParsePol(data&&data.policies);
  SOCIAL=gbParsePol(data&&data.social);
  {const g=gbParsePol(data&&data.size_guide);SIZE_GUIDE={text:String(g.text||"").trim(),image:/^https?:\/\//i.test(String(g.image||""))?g.image:""};}
  REMOTE_STORE=data?{phone:String(data.phone||"").trim(),email:String(data.email||"").trim(),address:String(data.address||"").trim(),hours:String(data.support_hours||"").trim()}:{};
 }catch(e){console.warn("store_settings not available, using STORE_INFO",e?.message||e);REMOTE_STORE={};}
 renderStoreInfo();
}
/* ===== silent refresh: data updates quietly, the page never jumps ===== */
let gbLoad="loading",gbLastRefresh=0,gbPending=false;
function isUserBusy(){
 const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.id!=="topSearch")return true;
 const c=$("checkoutModal");return !!c&&!c.classList.contains("hidden");
}
function gbSig(){try{return JSON.stringify([products,categories,storeOffers]);}catch(_){return String(Math.random());}}
function gbScrollGet(){return{y:window.scrollY,p:[...document.querySelectorAll(".dept-main,.dept-side")].map(e=>e.scrollTop)};}
function gbScrollSet(st){document.querySelectorAll(".dept-main,.dept-side").forEach((e,i)=>{if(st.p[i]!=null)e.scrollTop=st.p[i];});if(Math.abs(window.scrollY-st.y)>2)window.scrollTo(0,st.y);}
function gbDebounce(fn,ms){let t;return function(){clearTimeout(t);t=setTimeout(fn,ms);};}
const gbDebRender=gbDebounce(()=>renderProducts(),220);
function gbRenderAll(first){
 const st=first?null:gbScrollGet();
 renderProducts();renderHomepageShowcases();
 if(st)gbScrollSet(st);
}
async function refreshStore(manual){
 if(!manual&&gbLoad==="ok"&&document.hidden)return;
 const sigBefore=gbSig(),cartBefore=cart.length;
 const pid=new URLSearchParams(location.search).get("product"),pBefore=pid?JSON.stringify(getProduct(pid)||null):"";
 try{
  await Promise.all([loadProducts(),loadStoreData(),loadCategories(),loadOffers(),loadStoreInfo(),loadCoupons()]);
  const first=gbLoad!=="ok";gbLoad="ok";gbLastRefresh=Date.now();
  const n0=cart.length;
  cart=cart.filter(x=>x.type!=="combo"||(getOffer(x.offerId)&&offerProducts(getOffer(x.offerId)).length>0));
  cart=cart.filter(x=>{if(x.type==="combo")return true;const p=getProduct(x.id);if(!p)return false;if(pvars(p).length){if(!vOf(p,x.variant)||stockOf(p,x.variant)<=0)return false;if(x.qty>stockOf(p,x.variant))x.qty=stockOf(p,x.variant);}else{if(x.variant)delete x.variant;if(p.stock<=0)return false;if(x.qty>p.stock)x.qty=p.stock;}return true;});
  const removed=n0-cart.length;
  saveCart();
  if(removed>0)try{gbWarn(`⚠️ ${removed}টি পণ্য স্টকে নেই, কার্ট থেকে বাদ দেওয়া হলো`);}catch(_){}
  const changed=first||gbSig()!==sigBefore;
  if(changed)gbPending=true;
  /* cheap, state-free parts always */
  updateCart();renderOffers();renderPolicyInfo();renderFlashSale();
  if(gbPending&&(first||!isUserBusy())){gbPending=false;gbRenderAll(first);setTimeout(setupLocationPickers,0);}
  if(pid){const pAfter=JSON.stringify(getProduct(pid)||null);if(first||pAfter!==pBefore){const st=gbScrollGet();handleProductPageRoute();gbScrollSet(st);}}
  else handleProductPageRoute();
  gbSplashHide();
 }catch(e){
  console.error(e);
  if(gbLoad!=="ok"){gbLoad="fail";try{renderProducts();}catch(_){}gbSplashHide();}   /* keep showing the old data after a first success */
 }
}


/* Product pictures: square frame, lazy loading, tidy placeholder when a photo is missing or fails to load. */
function imgPlaceholder(){return '<span class="img-placeholder" aria-hidden="true"><svg class="ic ic-lg"><use href="#i-box"/></svg></span>';}
let gbCardColor="";
let gbEagerLeft=0;
function productImg(p){
 const _ci=gbCardColor&&isCloth(p)?gbColorImg(p,gbCardColor):"";const _src=_ci||p.image;
 if(!_src)return imgPlaceholder();
 const eager=gbEagerLeft>0;if(eager)gbEagerLeft--;
 return `<img class="pimg" src="${esc(_src)}" alt="${esc(p.name)}" width="1000" height="1000" loading="${eager?'eager':'lazy'}" decoding="async"${eager?' fetchpriority="high"':''} onerror="gbImgFail(this)">`;
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
 const specs=gbSpecs(p);
 const sold=Number(p.stock)<=0,discount=Number(p.discount)>0,images=productImagesFor(p);
 $('productDetailsBody').innerHTML=`<div class="product-details-layout"><div><div class="product-details-image" id="productModalMainImage">${images.length?`<img src="${esc(images[0])}" alt="${esc(p.name)}" width="1000" height="1000" decoding="async" onerror="this.style.display='none'">`:`<span>${imgPlaceholder()}</span>`}</div>${images.length>1?`<div class="product-gallery-thumbs">${images.map((src,i)=>`<button type="button" class="product-gallery-thumb ${i===0?'active':''}" onclick="setProductGalleryImage('productModalMainImage',this,this.dataset.src)" data-src="${esc(src)}" aria-label="View image ${i+1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}</div><div class="product-details-copy"><span class="product-details-kicker">${esc(p.cat||'Gadget')}</span><h2>${esc(p.name)}</h2><div class="product-details-price">${money(finalPrice(p,gbVar(p.id)))} ${discount?`<del>${money(p.price)}</del><span class="discount-badge">${Math.round(Number(p.discount))}% OFF</span>`:''}</div>${(isCloth(p)&&!sold&&pvars(p).length)?'':`<p class="product-details-stock ${sold?'sold':''}">${sold?'Currently out of stock':`In stock: ${Math.max(0,Number(p.stock)||0)}`}</p>`}${variantChips(p)}${pdShort(p,specs)}<div class="product-details-actions"><button type="button" class="add-btn" ${sold?'disabled':''} onclick="closeProductDetails();window.addToCart(${jsArg(p.id)})">Add to Cart</button><button type="button" class="buy-btn" ${sold?'disabled':''} onclick="closeProductDetails();window.buyNow(${jsArg(p.id)})">Buy Now</button><button type="button" class="full-details-btn" onclick="window.openProductPage(${jsArg(p.id)})">Full Product Page ↗</button></div></div></div>`;
 modal.classList.add('is-open');document.body.classList.add('product-details-open');
}
function closeProductDetails(){const modal=$('productDetailsModal');if(modal)modal.classList.remove('is-open');document.body.classList.remove('product-details-open');}
window.viewProductDetails=viewProductDetails;window.closeProductDetails=closeProductDetails;
function gbColorImg(p,name){const c=(p&&p.colors||[]).find(x=>x.n===name);return c&&c.i?c.i:"";}
function productImagesFor(p){const arr=productImages(p),ci=p&&isCloth(p)?gbColorImg(p,gbPickC[String(p.id)]):"";return ci?[ci,...arr.filter(x=>x!==ci)]:arr;}
function productImages(p){const arr=Array.isArray(p?.images)?p.images:[];return [...new Set([p?.image,...arr].filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))].slice(0,8);}
function setProductGalleryImage(containerId,button,url){const box=$(containerId);if(!box)return;const img=box.querySelector('img');if(img)img.src=url;box.querySelectorAll('.product-gallery-thumb').forEach(b=>b.classList.remove('active'));button?.classList.add('active');}
function openProductPage(id){const url=new URL(window.location.href);url.searchParams.set('product',String(id));url.hash='';window.location.href=url.toString();}
function returnToShop(){const url=new URL(window.location.href);url.searchParams.delete('product');url.hash='products';window.location.href=url.toString();}
function handleProductPageRoute(loadFailed=false){const id=new URLSearchParams(window.location.search).get('product');const page=$('fullProductPage');if(!page)return;if(!id){page.classList.add('hidden');document.body.classList.remove('full-product-page-open');return;}page.classList.remove('hidden');document.body.classList.add('full-product-page-open');if(loadFailed){page.innerHTML='<div class="full-product-message"><h2>Products could not be loaded</h2><p>Please check your connection and try again.</p><button class="view-btn" onclick="returnToShop()">Back to Shop</button></div>';return;}const p=getProduct(id);if(!p){page.innerHTML='<div class="full-product-message"><h2>Product not found</h2><p>This product may be unavailable or removed.</p><button class="view-btn" onclick="returnToShop()">Back to Shop</button></div>';return;}const specs=gbSpecs(p),images=productImagesFor(p),sold=Number(p.stock)<=0,discount=Number(p.discount)>0;const related=products.filter(x=>String(x.id)!==String(p.id)&&x.cat===p.cat).slice(0,4);page.innerHTML=`<div class="full-product-topbar"><button type="button" class="full-product-back" onclick="returnToShop()">← Back to Shop</button><span>PABOO <b>• PRODUCT DETAILS</b></span><button type="button" class="full-product-cart" onclick="returnToShop();setTimeout(()=>document.getElementById('cartDrawer')?.classList.add('open'),350)">🛒 Cart</button></div><div class="full-product-container"><div class="full-product-hero"><div><div class="full-product-gallery"><div class="full-product-main-image" id="fullProductMainImage">${images.length?`<img src="${esc(images[0])}" alt="${esc(p.name)}" width="1000" height="1000" decoding="async" onerror="this.style.display='none'">`:`<span>${imgPlaceholder()}</span>`}</div>${images.length>1?`<div class="product-gallery-thumbs">${images.map((src,i)=>`<button type="button" class="product-gallery-thumb ${i===0?'active':''}" onclick="setProductGalleryImage('fullProductMainImage',this,this.dataset.src)" data-src="${esc(src)}" aria-label="View image ${i+1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}</div></div><div class="full-product-info"><span class="product-details-kicker">${esc(p.cat||'Gadget')}</span><h1>${esc(p.name)}</h1><div class="product-details-price">${money(finalPrice(p,gbVar(p.id)))} ${discount?`<del>${money(p.price)}</del><span class="discount-badge">${Math.round(Number(p.discount))}% OFF</span>`:''}</div>${saleBox(p)}${(isCloth(p)&&!sold&&pvars(p).length)?'':`<p class="product-details-stock ${sold?'sold':''}">${sold?'Currently out of stock':`In stock: ${Math.max(0,Number(p.stock)||0)}`}</p>`}${p.description?`<p class="product-details-description">${esc(p.description)}</p>`:''}${variantChips(p)}<div class="full-product-actions"><button type="button" class="add-btn" ${sold?'disabled':''} onclick="window.addToCart(${jsArg(p.id)})">Add to Cart</button><button type="button" class="buy-btn" ${sold?'disabled':''} onclick="window.buyNow(${jsArg(p.id)})">Buy Now</button><button type="button" class="view-btn" onclick="window.viewProductDetails(${jsArg(p.id)})">Quick View Popup</button><button type="button" class="full-product-save" onclick="window.toggleWishlist(${jsArg(p.id)})">♡ Save to Wishlist</button></div><div class="full-product-highlights"><span>⚡ Secure checkout options</span><span>📦 Stock: ${Math.max(0,Number(p.stock)||0)}</span><span>↩ Return policy: see store policy</span></div></div></div>${specs.length?`<section class="full-product-spec-section"><h2>Specifications & Features</h2><dl>${specs.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`:''}${related.length?`<section class="full-product-related"><h2>You may also like</h2><div class="full-product-related-grid">${related.map(x=>`<article class="full-related-card"><div class="full-related-image">${x.image?`<img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy">`:esc(x.emoji||'📦')}</div><h3>${esc(x.name)}</h3><strong>${money(finalPrice(x))}</strong><button type="button" class="view-btn" onclick="window.openProductPage(${jsArg(x.id)})">View Details</button></article>`).join('')}</div></section>`:''}<div class="full-product-footer">Paboo · Prices and stock may change. Confirm product details before ordering.</div></div>`;}
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
function gbSpecs(p){const d=String(p.description||'').trim();return productSpecEntries(p).filter(([k,v])=>!(String(k).toLowerCase()==='description'&&(!d||String(v).trim()===d)));}
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
function gbSkeleton(n){return Array.from({length:n||8},()=>`<article class="product-card dept-card gb-skel" aria-hidden="true"><div class="product-img"></div><h3></h3><div class="price"></div><div class="product-actions"><span></span><span></span></div></article>`).join("");}
function gbLoadState(){
 if(gbLoad==="loading")return gbSkeleton(12);
 if(gbLoad==="fail")return `<div class="gb-fail" style="grid-column:1/-1"><strong>পণ্য লোড করা যায়নি</strong><p>ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p><button type="button" onclick="gbLoad='loading';renderProducts();refreshStore(true)">আবার চেষ্টা করুন</button></div>`;
 return "";
}
function renderProducts(){
 let g=$("productsGrid");if(!g)return;
 if(gbLoad!=="ok"){const st=gbLoadState();g.innerHTML=st;["deptGrid_clothing","deptGrid_gadget"].forEach(id=>{const x=$(id);if(x)x.innerHTML=st;});return;}let a=filteredProducts();
 if($("sectionTitle"))$("sectionTitle").textContent=activeQuery()?`Results for "${activeQuery()}"`:currentCategory;
 if($("productCount"))$("productCount").textContent=`${a.length} products`;
 const pgA=gbPage("all",JSON.stringify([currentCategory,activeQuery()]),a);
 g.innerHTML=(pgA.items.map(deptCard).join("")+(pgA.more?gbMoreBtn("all",pgA.left):""))||`<div class="empty" style="grid-column:1/-1">${activeQuery()?`No products found for "${esc(activeQuery())}". Try another word, or <button type="button" class="link-btn" onclick="clearSearch()">clear the search</button>.`:"No products found."}</div>`;
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
function homeProductCard(p){return deptCard(p);}
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
 gbDeptDirty.clothing=gbDeptDirty.gadget=true;gbEnsureDept();
}


/* ===== Departments: পোশাক (clothing) and গ্যাজেট (gadget) pages ===== */
function gbDFnew(){return{cat:"",sort:"new",sizes:[],colors:[],min:null,max:null,stock:false,disc:false};}
const gbDF={clothing:gbDFnew(),gadget:gbDFnew()};
function deptCats(d){
 const m=new Map();
 categories.filter(c=>(c.dept==="clothing"?"clothing":"gadget")===d).forEach(c=>{const n=String(c.name||"").trim();if(n)m.set(categoryKey(n),n);});
 products.filter(p=>p.dept===d).forEach(p=>{if(p.cat&&!m.has(categoryKey(p.cat)))m.set(categoryKey(p.cat),p.cat);});
 return[...m.values()];
}
function deptEmoji(n,d){
 const v=String(n||"").toLowerCase();
 if(d==="clothing"){
  const m=[[/t-?shirt|tee|টি|গেঞ্জি|গেন্জি|গেনজি|singlet|vest/,"👕"],[/polo|পোলো/,"🎽"],[/shirt|শার্ট|জামা/,"👔"],[/panjabi|punjabi|পাঞ্জাবি|পাঞ্জাবী|kurta|kurti|কুর্তি|কুর্তা/,"🥼"],
   [/under|আন্ডার|আন্ডারওয়্যার|brief|boxer|ইনার/,"🩲"],[/pant|jean|trouser|প্যান্ট|জিন্স|জিনস|ট্রাউজার/,"👖"],[/short|হাফ প্যান্ট|শর্টস/,"🩳"],
   [/jacket|hood|sweater|coat|জ্যাকেট|সোয়েটার|হুডি|কোট/,"🧥"],[/saree|sari|শাড়ি|শাড়ী/,"🥻"],[/ladies|women|girl|dress|লেডিজ|থ্রি|গাউন|ফ্রক|মেয়ে/,"👗"],
   [/burqa|hijab|বোরকা|হিজাব|ওড়না/,"🧕"],[/sock|মোজা/,"🧦"],[/shoe|sandal|sneaker|জুতা|স্যান্ডেল|সু/,"👟"],[/cap|hat|টুপি/,"🧢"],[/bag|ব্যাগ/,"👜"],
   [/watch|ঘড়ি/,"⌚"],[/belt|বেল্ট/,"🪢"],[/kid|child|baby|বাচ্চা|শিশু|ছেলে/,"🧒"],[/lungi|লুঙ্গি|লুঙ্গী/,"🧣"]];
  for(const [re,e] of m)if(re.test(v))return e;
  return"🏷️";
 }
 return null;
}
function deptProducts(d){return products.filter(p=>p.dept===d);}
function deptPriceRange(d){const l=deptProducts(d).map(p=>Math.round(finalPrice(p)));return l.length?[Math.min(...l),Math.max(...l)]:[0,0];}
function deptSizes(d){
 const set=[];deptProducts(d).forEach(p=>{if(isCloth(p))clothAxes(p).sizes.forEach(s=>{if(!set.includes(s))set.push(s);});});
 const std=["XS","S","M","L","XL","XXL","3XL"];
 return set.sort((a,b)=>{const x=std.indexOf(a),y=std.indexOf(b);if(x>=0&&y>=0)return x-y;if(x>=0)return-1;if(y>=0)return 1;return String(a).localeCompare(String(b),undefined,{numeric:true});});
}
function deptColors(d){
 const m=new Map();deptProducts(d).forEach(p=>{if(isCloth(p))clothAxes(p).colors.forEach(n=>{const k=n.toLowerCase();if(!m.has(k))m.set(k,{n,h:clothHex(p,n)});});});
 return[...m.values()];
}
function deptFiltered(d,ignoreCat){
 const f=gbDF[d];let list=deptProducts(d);
 if(f.cat&&!ignoreCat)list=list.filter(p=>categoryKey(p.cat)===categoryKey(f.cat));
 if(f.stock)list=list.filter(p=>Number(p.stock)>0);
 if(f.disc)list=list.filter(p=>Number(p.discount)>0);
 if(f.min!=null)list=list.filter(p=>finalPrice(p)>=f.min);
 if(f.max!=null)list=list.filter(p=>finalPrice(p)<=f.max);
 if(f.sizes.length||f.colors.length){
  const sl=f.sizes.map(x=>x.toLowerCase()),cl=f.colors.map(x=>x.toLowerCase());
  list=list.filter(p=>isCloth(p)&&clothAxes(p).vs.some(v=>v.stock>0&&(!sl.length||sl.includes((v.s||"").toLowerCase()))&&(!cl.length||cl.includes((v.c||"").toLowerCase()))));
 }
 list=list.slice();
 if(f.sort==="low")list.sort((a,b)=>finalPrice(a)-finalPrice(b));
 else if(f.sort==="high")list.sort((a,b)=>finalPrice(b)-finalPrice(a));
 else if(f.sort==="disc")list.sort((a,b)=>Number(b.discount)-Number(a.discount));
 return list;
}
function deptActiveCount(d){const f=gbDF[d];return f.sizes.length+f.colors.length+(f.min!=null?1:0)+(f.max!=null?1:0)+(f.stock?1:0)+(f.disc?1:0);}

const GB_PAGE=24,gbLim={};
function gbPage(key,sig,list){if(gbLim[key]&&gbLim[key].sig!==sig)gbLim[key]=null;const L=gbLim[key]||(gbLim[key]={sig,n:key==="all"?12:GB_PAGE});return{items:list.slice(0,L.n),more:list.length>L.n,left:list.length-L.n};}
function gbMore(key){const L=gbLim[key];if(!L)return;L.n+=(key==="all"?12:GB_PAGE);if(key==="all")renderProducts();else renderDeptPage(key);}
window.gbMore=gbMore;
function gbMoreBtn(key,left){return `<div class="gb-more"><button type="button" onclick="gbMore('${key}')">আরও দেখান <small>(আরও ${left}টি)</small></button></div>`;}
function gbCardAct(id,kind){
 const p=getProduct(id);if(!p)return;
 if(pvars(p).length){viewProductDetails(id);setTimeout(()=>gbWarn(gbNeedMsg(p)),120);return;}
 if(kind==="buy")window.buyNow(id);else window.addToCart(id);
}
window.gbCardAct=gbCardAct;
function deptCard(p){
 const id=jsArg(p.id),sold=Number(p.stock)<=0,disc=Number(p.discount)>0;
 const saved=wishlistIds.has(String(p.id)),cmp=compareIds.has(String(p.id));
 const btns=sold?`<div class="product-actions dc-one"><button class="add-btn" type="button" disabled>Out of Stock</button></div>`
  :`<div class="product-actions"><button class="add-btn" type="button" onclick="event.stopPropagation();gbCardAct(${id},'cart')">Add to Cart</button><button class="buy-btn" type="button" onclick="event.stopPropagation();gbCardAct(${id},'buy')">Buy Now</button></div>`;
 return `<article class="product-card home-product-card dept-card" onclick="viewProductDetails(${id})">${saleStrip(p)}<div class="product-img">${productImg(p)}${disc?`<span class="home-discount-badge">${Math.round(Number(p.discount))}% OFF</span>`:""}<div class="home-card-tools"><button type="button" class="home-save-btn ${saved?'is-saved':''}" aria-label="Wishlist" onclick="event.stopPropagation();toggleWishlist(${id})">${saved?'♥':'♡'}</button><button type="button" class="home-save-btn ${cmp?'is-compared':''}" aria-label="Compare" onclick="event.stopPropagation();toggleCompare(${id})">${cmp?'✓':'⇄'}</button></div></div><h3>${esc(p.name)}</h3><div class="price">${money(finalPrice(p))} ${disc?`<del>${money(p.price)}</del>`:""}</div>${btns}</article>`;
}
const gbDeptDirty={clothing:true,gadget:true};
function gbEnsureDept(){const v=document.body.dataset.view;if((v==="clothing"||v==="gadget")&&gbDeptDirty[v]&&gbLoad==="ok")renderDeptPage(v);}
function renderDeptPage(d){gbDeptDirty[d]=false;
 const side=$("deptSide_"+d),grid=$("deptGrid_"+d),cnt=$("deptCount_"+d);if(!grid)return;
 gbEagerLeft=2;const f=gbDF[d],names=deptCats(d);
 if(f.cat&&!names.some(n=>categoryKey(n)===categoryKey(f.cat)))f.cat="";
 if(side)side.innerHTML=`<button class="dept-cat ${!f.cat?'is-on':''}" type="button" onclick="gbDeptCat('${d}','')"><span>All</span></button>`+names.map(n=>`<button class="dept-cat ${categoryKey(n)===categoryKey(f.cat)?'is-on':''}" type="button" onclick="gbDeptCat('${d}',${esc(jsArg(n))})"><span data-no-i18n>${esc(n)}</span></button>`).join("");
 const chips=[];
 f.sizes.forEach(x=>chips.push([`${x}`,"sizes",x]));f.colors.forEach(x=>chips.push([x,"colors",x]));
 if(f.min!=null||f.max!=null){const r=deptPriceRange(d);chips.push([`৳${f.min!=null?f.min:r[0]} – ৳${f.max!=null?f.max:r[1]}`,"price",""]);}
 if(f.stock)chips.push(["In stock only","stock",""]);if(f.disc)chips.push(["On sale","disc",""]);
 const act=$("deptActive_"+d);
 if(act)act.innerHTML=chips.length?chips.map(c=>`<button type="button" class="dept-chip" onclick="gbDeptClear('${d}','${c[1]}',${esc(jsArg(c[2]))})"><span ${c[1]==="sizes"||c[1]==="colors"||c[1]==="price"?'data-no-i18n':''}>${esc(c[0])}</span> ✕</button>`).join("")+`<button type="button" class="dept-chip dept-chip-clear" onclick="gbDeptClear('${d}','all','')">Clear all</button>`:"";
 const fc=$("deptFcount_"+d),n=deptActiveCount(d);if(fc){fc.textContent=String(n);fc.classList.toggle("hidden",!n);}
 const ss=$("deptSort_"+d);if(ss)ss.value=f.sort;
 const list=deptFiltered(d);
 gbCardColor=f.colors.length===1?f.colors[0]:"";
 const pg=gbPage(d,JSON.stringify(f),list);grid.innerHTML=list.length?pg.items.map(deptCard).join("")+(pg.more?gbMoreBtn(d,pg.left):""):`<div class="showcase-empty">${n||f.cat?'No products match these filters.':'No products here yet.'}${n?` <button type="button" class="link-btn" onclick="gbDeptClear('${d}','all','')">Clear all</button>`:""}</div>`;
 gbCardColor="";
 if(cnt)cnt.textContent=`${list.length} products`;
}
function gbDeptCat(d,n){gbDF[d].cat=n;renderDeptPage(d);}
function gbDeptSort(d,v){gbDF[d].sort=v;renderDeptPage(d);}
function gbDeptClear(d,kind,val){
 const f=gbDF[d];
 if(kind==="all"){const k=f.cat,s=f.sort;gbDF[d]=gbDFnew();gbDF[d].cat=k;gbDF[d].sort=s;}
 else if(kind==="sizes")f.sizes=f.sizes.filter(x=>x!==val);
 else if(kind==="colors")f.colors=f.colors.filter(x=>x!==val);
 else if(kind==="price"){f.min=null;f.max=null;}
 else if(kind==="stock")f.stock=false;else if(kind==="disc")f.disc=false;
 renderDeptPage(d);if(!$("deptSheet").classList.contains("hidden"))gbRenderSheet(d);
}
function gbOpenFilter(d){const s=$("deptSheet");if(!s)return;s.dataset.d=d;gbRenderSheet(d);s.classList.remove("hidden");}
function gbCloseFilter(){$("deptSheet")?.classList.add("hidden");}
function gbRenderSheet(d){
 const p=$("deptSheetPanel");if(!p)return;const f=gbDF[d],r=deptPriceRange(d),lo=f.min!=null?f.min:r[0],hi=f.max!=null?f.max:r[1];
 const sizes=d==="clothing"?deptSizes(d):[],cols=d==="clothing"?deptColors(d):[];
 let h=`<div class="ds-head"><b>Filter</b><button type="button" class="ds-x" onclick="gbCloseFilter()" aria-label="Close">✕</button></div><div class="ds-body">`;
 if(sizes.length)h+=`<div class="ds-t">Size</div><div class="ds-row">${sizes.map(x=>`<button type="button" class="ds-pill ${f.sizes.includes(x)?'on':''}" onclick="gbFToggle('${d}','sizes',${esc(jsArg(x))})" data-no-i18n>${esc(x)}</button>`).join("")}</div>`;
 if(cols.length)h+=`<div class="ds-t">Colour</div><div class="ds-row">${cols.map(c=>`<button type="button" class="ds-sw ${f.colors.includes(c.n)?'on':''}" title="${esc(c.n)}" aria-label="${esc(c.n)}" onclick="gbFToggle('${d}','colors',${esc(jsArg(c.n))})"><i style="background:${esc(c.h)}"></i></button>`).join("")}</div>`;
 if(r[1]>r[0])h+=`<div class="ds-t">Price <b id="dsPrice" data-no-i18n>৳${lo} – ৳${hi}</b></div><div class="ds-range"><input type="range" id="dsMin" min="${r[0]}" max="${r[1]}" value="${lo}" oninput="gbFPrice('${d}')"><input type="range" id="dsMax" min="${r[0]}" max="${r[1]}" value="${hi}" oninput="gbFPrice('${d}')"></div>`;
 h+=`<div class="ds-row" style="margin-top:12px"><button type="button" class="ds-pill ${f.stock?'on':''}" onclick="gbFToggle('${d}','stock','')">In stock only</button><button type="button" class="ds-pill ${f.disc?'on':''}" onclick="gbFToggle('${d}','disc','')">On sale</button></div></div>`;
 h+=`<div class="ds-foot"><button type="button" class="ds-clear" onclick="gbDeptClear('${d}','all','')">Clear all</button><button type="button" class="ds-apply" id="dsApply" onclick="gbCloseFilter()">Show ${deptFiltered(d).length} products</button></div>`;
 p.innerHTML=h;
}
function gbFToggle(d,kind,val){const f=gbDF[d];if(kind==="sizes"||kind==="colors"){const a=f[kind],i=a.indexOf(val);if(i>=0)a.splice(i,1);else a.push(val);}else f[kind]=!f[kind];renderDeptPage(d);gbRenderSheet(d);}
function gbFPrice(d){
 const r=deptPriceRange(d),a=$("dsMin"),b=$("dsMax");if(!a||!b)return;let lo=Number(a.value),hi=Number(b.value);if(lo>hi){if(document.activeElement===a){lo=hi;a.value=lo;}else{hi=lo;b.value=hi;}}
 const f=gbDF[d];f.min=lo>r[0]?lo:null;f.max=hi<r[1]?hi:null;
 const t=$("dsPrice");if(t)t.textContent=`৳${lo} – ৳${hi}`;
 renderDeptPage(d);const ap=$("dsApply");if(ap)ap.textContent=`Show ${deptFiltered(d).length} products`;
}
Object.assign(window,{gbDeptCat,gbDeptSort,gbDeptClear,gbOpenFilter,gbCloseFilter,gbFToggle,gbFPrice});
function renderSmartRecommendations(){let old=$("smartRecommendations");if(old)old.remove();if(!products.length)return;let seed=products.find(p=>p.featured)||products[0];let picks=products.filter(p=>p.cat===seed.cat&&String(p.id)!==String(seed.id)&&p.stock>0).slice(0,3);if(!picks.length)picks=products.filter(p=>String(p.id)!==String(seed.id)&&p.stock>0).slice(0,3);if(!picks.length)return;let section=document.createElement("section");section.id="smartRecommendations";section.dataset.v="home";section.className="shop smart-recommendations";section.innerHTML=`<div class="section-head"><h2>Smart Picks For You</h2><span>Based on product category and availability</span></div><div class="products-grid">${picks.map(p=>`<article class="product-card"><div class="product-img">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:contain">`:imgPlaceholder()}</div><div class="category">${esc(p.cat)}</div><h3>${esc(p.name)}</h3><div class="price">${money(finalPrice(p))}</div><button class="add-btn" onclick="addToCart('${String(p.id).replace(/'/g,"\'")}')">Add to Cart</button></article>`).join("")}</div>`;$("products")?.insertAdjacentElement("afterend",section);}
function getProduct(id){return products.find(p=>String(p.id)===String(id));}
function finalPrice(p,vn){const v=vOf(p,vn),base=v&&v.price>0?v.price:p.price;return p.discount>0?Math.max(0,base-base*p.discount/100):base;}
function cartUnitPrice(item){if(item?.type==="combo"){const offer=getOffer(item.offerId);return offer?offerUnitPrice(offer):0;}const p=getProduct(item?.id);return p?finalPrice(p,item.variant):0;}

function gbNeedMsg(p){const a=isCloth(p)?clothAxes(p):null;if(a){if(a.colors.length&&a.sizes.length)return"দয়া করে সাইজ ও কালার সিলেক্ট করুন";if(a.colors.length)return"দয়া করে কালার সিলেক্ট করুন";if(a.sizes.length)return"দয়া করে সাইজ সিলেক্ট করুন";}return"দয়া করে একটি অপশন বেছে নিন";}
function gbWarn(msg){let w=$('gbWarn');if(!w){w=document.createElement('div');w.id='gbWarn';w.className='gb-warn';w.setAttribute('role','alert');document.body.appendChild(w);}
 w.textContent=msg;w.classList.remove('show');void w.offsetWidth;w.classList.add('show');clearTimeout(w._t);w._t=setTimeout(()=>w.classList.remove('show'),2800);}
window.gbWarn=gbWarn;
function gbNeedVariant(p,variant,id){const vs=pvars(p);if(!vs.length)return{ok:true,vn:null};const vn=variant||gbVar(id);if(!vOf(p,vn)){viewProductDetails(id);setTimeout(()=>gbWarn(gbNeedMsg(p)),120);return{ok:false};}return{ok:true,vn};}
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
 else{let k=selectedDistrict==="Dhaka"?"dhaka":NEARBY_DISTRICTS.includes(selectedDistrict)?"nearby":"outside";let z={dhaka:"Dhaka",nearby:"Nearby Dhaka",outside:"Outside Dhaka"}[k];b.textContent=`Delivery: ${money(getDeliveryFee())} • ${z}${(POLICIES&&POLICIES.cards&&POLICIES.cards.delivery&&POLICIES.cards.delivery.show_time===false)?"":` • Usually ${DELIVERY_TIME[k]}`}`;}
 updateCart();
}
function updateCart(){
 let c=$("cartCount");if(c)c.textContent=cart.reduce((sum,item)=>sum+item.qty,0);{const n=cart.reduce((sum,item)=>sum+item.qty,0),b=$("bottomCartCount");if(b){b.textContent=n;b.classList.toggle("is-empty",!n);if(b.parentElement)b.parentElement.classList.toggle("has-items",n>0);}}
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

function makeOrderId(){return"PB-"+Date.now().toString().slice(-8);}
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

function showCheckoutError(msg){const f=$("checkoutForm");if(!f)return;let b=$("checkoutError");if(!b){b=document.createElement("div");b.id="checkoutError";b.className="checkout-error";b.setAttribute("role","alert");f.insertBefore(b,f.firstChild);}
 b.textContent=msg;b.classList.add("show");try{b.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(_){}}
function hideCheckoutError(){$("checkoutError")?.classList.remove("show");}
window.showCheckoutError=showCheckoutError;
function initCustomerUI(){
 $("menuBtn")&&( $("menuBtn").onclick=openMenu);$("cartBtn")&&($("cartBtn").onclick=openCart);$("overlay")&&($("overlay").onclick=()=>{closeMenu();closeCart();});
 document.querySelectorAll('[data-close="menu"]').forEach(x=>x.onclick=closeMenu);document.querySelectorAll('[data-close="cart"]').forEach(x=>x.onclick=closeCart);document.querySelectorAll('[data-close="checkout"]').forEach(x=>x.onclick=closeCheckout);
 $("searchInput")?.addEventListener("input",()=>gbDebRender());$("sortSelect")?.addEventListener("change",renderProducts);
 document.querySelectorAll('input[name="payment"]').forEach(r=>r.addEventListener("change",updateTransactionBox));
 $("checkoutBtn")&&($("checkoutBtn").onclick=openCheckout);$("applyCouponBtn")?.addEventListener("click",applyCoupon);
 $("checkoutForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!cart.length)return;if(e.target.dataset.busy==="1")return;hideCheckoutError();let f=new FormData(e.target),payment=String(f.get("payment")||""),tid=String(f.get("transactionId")||"").trim(),type=ptype({value:payment});
  if(!isPaymentMethodEnabled(payment))return showCheckoutError("The selected payment method is currently unavailable.");
  if((type==="bkash"||type==="nagad")&&!tid)return showCheckoutError("Please enter the transaction ID for the selected payment method.");
  if(!selectedDistrict||!selectedUpazila)return showCheckoutError("Please select a district and upazila from the suggestions.");
  let t=totals(),o={orderId:makeOrderId(),createdAt:new Date().toISOString(),customer:{name:String(f.get("name")||"").trim(),phone:String(f.get("phone")||"").trim(),district:selectedDistrict,area:selectedUpazila,address:String(f.get("address")||"").trim()},paymentMethod:payment,transactionId:type==="cod"?"":tid,note:String(f.get("note")||"").trim(),couponCode:appliedCoupon||"",items:cart.map(item=>{
   if(item.type==="combo"){
    const offer=getOffer(item.offerId);if(!offer)return null;
    return{id:`combo:${offer.id}`,name:offer.title||"Combo Deal",price:offerUnitPrice(offer),qty:item.qty,is_combo:true,products:offerProducts(offer).map(p=>({id:p.id,name:p.name,price:finalPrice(p),qty:item.qty}))};
   }
   const p=getProduct(item.id);return p?{id:p.id,name:p.name+(item.variant?` (${item.variant})`:""),price:finalPrice(p,item.variant),qty:item.qty}:null;
  }).filter(Boolean),subtotal:t.subtotal,delivery:t.delivery,total:t.total};
  const sbtn=e.target.querySelector('button[type="submit"]'),sTxt=sbtn?sbtn.textContent:"";
  e.target.dataset.busy="1";if(sbtn){sbtn.disabled=true;sbtn.textContent="অর্ডার হচ্ছে...";}
  const unbusy=()=>{e.target.dataset.busy="";if(sbtn){sbtn.disabled=false;sbtn.textContent=sTxt;}};
  try{await submitOrderToSupabase(o);}catch(err){console.error(err);unbusy();if(err&&err.code==="P0001"){refreshStore(true);return showCheckoutError(err.message);}return showCheckoutError("ORDER ERROR — "+(err.message||"Unknown")+(err.code?" ("+err.code+")":""));}
  unbusy();
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

/* ---- Policies editable / hideable from Admin > Policies ---- */
let POLICIES=null;
function gbParsePol(v){if(typeof v==="string"){try{v=JSON.parse(v)}catch(e){v=null}}return v&&typeof v==="object"?v:null;}
function polBodyHtml(text){
 const out=[];let list=null;
 String(text||"").split(/\r?\n/).forEach(l=>{const t=l.trim();if(!t)return;
  if(/^[-•]\s+/.test(t)){if(!list){list=[];out.push(list)}list.push(t.replace(/^[-•]\s+/,""))}
  else{list=null;out.push(t)}});
 return out.map(x=>Array.isArray(x)?`<ul class="policy-list">${x.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`:`<p>${esc(x)}</p>`).join("");
}
function applyPolicies(){
 const P=POLICIES||{},cards=P.cards||{},map={warranty:"policyWarranty",returns:"policyReturns",delivery:"policyDelivery",payment:"policyPayment"};
 let visible=0;
 Object.keys(map).forEach(k=>{
  const el=$(map[k]);if(!el)return;const c=cards[k]||{};
  if(!el.dataset.def)el.dataset.def=el.innerHTML;
  el.innerHTML=el.dataset.def;
  const off=c.show===false;el.classList.toggle("hidden",off);if(off)return;visible++;
  if(c.title)el.querySelector("h3").textContent=c.title;
  if(k==="delivery"){
   const t=c.times||{};["dhaka","nearby","outside"].forEach(z=>{if(t[z]){DELIVERY_TIME[z]=t[z];DELIVERY_TIME_BN[z]=t[z];}});
   el.querySelectorAll(".info-list li b").forEach(b=>{
    const fee=b.querySelector("[data-fee]"),tm=b.querySelector("[data-time]");
    if(c.show_fee===false&&fee)fee.remove();if(c.show_time===false&&tm)tm.remove();
    if(c.show_fee===false||c.show_time===false)[...b.childNodes].forEach(n=>{if(n.nodeType===3)n.remove()});
    if(!b.children.length)b.remove();
   });
   const note=el.querySelector("#nearbyNote");if(note&&c.show_note===false)note.remove();
  }else if(c.body){
   [...el.children].forEach(ch=>{if(!ch.classList.contains("info-icon")&&ch.tagName!=="H3")ch.remove();});
   el.insertAdjacentHTML("beforeend",polBodyHtml(c.body));
  }
 });
 const grid=document.querySelector("#policies .info-grid");
 if(grid){grid.querySelectorAll("[data-extra]").forEach(x=>x.remove());
  (Array.isArray(P.extra)?P.extra:[]).forEach(x=>{if(!x||x.show===false||!(x.title||x.body))return;visible++;
   grid.insertAdjacentHTML("beforeend",`<article class="info-card" data-extra="1"><span class="info-icon"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg></span><h3>${esc(x.title||"")}</h3>${polBodyHtml(x.body)}</article>`);});}
 const hideAll=P.section===false||visible===0;
 $("policies")?.classList.toggle("hidden",hideAll);
 document.querySelectorAll('a[href="#policies"]').forEach(a=>a.classList.toggle("hidden",hideAll));
 const sum=$("deliverySummary");
 if(sum){const d=cards.delivery||{};
  if(d.show_time===false)sum.textContent="";
  else if(d.times&&(d.times.dhaka||d.times.outside))sum.textContent=`ঢাকা: ${d.times.dhaka||DELIVERY_TIME_BN.dhaka} · ঢাকার বাইরে: ${d.times.outside||DELIVERY_TIME_BN.outside}`;}
}
function renderPolicyInfo(){
 try{applyPolicies();}catch(e){console.warn("policies",e)}
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
 const soc=gbSocialLinks();
 const sw=soc.find(x=>x.key==="whatsapp");
 if(sw)cards.push(card("chat","WhatsApp",sw.text,sw.url));
 if(String(i.phone||"").trim())cards.push(card("call","Phone",i.phone.trim(),`tel:${digits(i.phone)}`));
 if(String(i.email||"").trim())cards.push(card("mail","Email",i.email.trim(),`mailto:${i.email.trim()}`));
 soc.filter(x=>x.key!=="whatsapp").forEach(x=>cards.push(card("link",x.label,x.text,x.url)));
 if(String(i.address||"").trim())cards.push(card("pin","Address",i.address.trim()));
 if(String(i.hours||"").trim())cards.push(card("clock","Open hours",i.hours.trim()));
 const grid=$("contactGrid"),sec=$("contact");
 if(grid)grid.innerHTML=cards.join("");
 sec?.classList.toggle("hidden",!cards.length);
 $("footContactLink")?.classList.toggle("hidden",!cards.length);
 gbRenderSocial(soc);
}

/* cart / wishlist / compare stay in step between browser tabs */
function setupStorageSync(){
 addEventListener("storage",e=>{
  try{
   if(e.key==="gbbd_cart"){cart=JSON.parse(e.newValue||"[]");updateCart();}
   else if(e.key==="gbbd_wishlist"){wishlistIds=loadSavedIds("gbbd_wishlist");updateSavedCounters();}
   else if(e.key==="gbbd_compare"){compareIds=loadSavedIds("gbbd_compare",3);updateSavedCounters();}
  }catch(_){}
 });
}
async function startCustomerSite(){setupStorageSync();gbLoad=gbLoad||"loading";initCustomerUI();updateSavedCounters();renderPolicyInfo();renderStoreInfo();renderProducts();updateCart();await refreshStore();setupLocationPickers();renderSmartRecommendations();}
window.addToCart=addToCart;window.buyNow=buyNow;window.toggleWishlist=toggleWishlist;window.toggleCompare=toggleCompare;window.showSavedProducts=showSavedProducts;window.closeSavedProducts=closeSavedProducts;window.renderSavedPanel=renderSavedPanel;window.removeSavedProduct=removeSavedProduct;window.applyCoupon=applyCoupon;
window.showDealType=showDealType;
window.viewOfferProducts=viewOfferProducts;
window.addOfferToCart=addOfferToCart;
window.buyOfferNow=buyOfferNow;
window.changeComboQty=changeComboQty;
window.removeComboFromCart=removeComboFromCart;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startCustomerSite);else startCustomerSite();
setInterval(()=>refreshStore(),60000);
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
  else if(v==="clothing")active="clothing";
  else if(v==="gadget")active="gadget";
  else if(v==="home"&&window.scrollY<300)active="home";
 }
 bar.querySelectorAll("[data-bar]").forEach(el=>{const on=el.dataset.bar===active;el.classList.toggle("is-active",on);if(on)el.setAttribute("aria-current","true");else el.removeAttribute("aria-current");});
}
document.addEventListener("DOMContentLoaded",()=>{
 updateBottomBar();
 {let _r=0;addEventListener("scroll",()=>{if(_r)return;_r=requestAnimationFrame(()=>{_r=0;updateBottomBar();});},{passive:true});}
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
 if(fromTop)gbDebRender();else renderProducts();
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
 top.addEventListener("input",()=>{setSearch(top.value,true);showSuggest();});
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
const VIEW_BY_ID={shopCategories:"categories",newArrivals:"new-arrivals",bestSellers:"best-sellers",featuredProducts:"featured",orderTracking:"track",about:"about",policies:"policies",contact:"contact",products:"home",dealZone:"home",flashSale:"flash",clothingPage:"clothing",gadgetPage:"gadget"};
const VIEW_TITLES={categories:"Categories","new-arrivals":"New Arrivals","best-sellers":"Best Sellers & Top Picks",featured:"Featured Products",track:"Track Your Order",about:"About Us",policies:"Our Policies",contact:"Contact Us",flash:"Flash Sale",clothing:"পোশাক",gadget:"গ্যাজেট"};
let gbNavCount=0;
function viewFromHash(){let id="";try{id=decodeURIComponent(location.hash.slice(1));}catch(e){}return VIEW_BY_ID[id]||"home";}
function setView(v,scrollTarget){
 document.body.dataset.view=v;
 try{$("deptSheet")?.classList.add("hidden");}catch(e){}
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
// Open the page instantly on tap (before the browser jumps), so the shop never flashes first.
document.addEventListener("click",e=>{
 const a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey)return;
 const id=decodeURIComponent((a.getAttribute("href")||"").slice(1));
 if(!id||!VIEW_BY_ID[id]||VIEW_BY_ID[id]==="home")return;
 e.preventDefault();
 if(location.hash.slice(1)!==id){gbNavCount++;history.pushState(null,"","#"+id);}
 setView(VIEW_BY_ID[id]);
},true);
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
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js?v=5").catch(()=>{}));
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

(function(){let t=0;
 function fix(){t=0;const r=e=>e?Math.round(e.getBoundingClientRect().bottom):0;
  const dept=/^(clothing|gadget)$/.test(document.body.dataset.view||'');
  if(dept&&scrollY)scrollTo(0,0);
  const ph=document.querySelector('.page-head'),hd=document.querySelector('.topbar');
  const top=(ph&&ph.offsetHeight?r(ph):r(hd));
  const bb=document.querySelector('.bottom-bar');
  document.documentElement.style.setProperty('--gb-top',top+'px');
  document.documentElement.style.setProperty('--gb-bot',(bb?bb.offsetHeight:70)+'px');}
 const q=()=>{if(!t)t=requestAnimationFrame(fix)};
 addEventListener('resize',q);addEventListener('hashchange',()=>{q();setTimeout(fix,200)});addEventListener('orientationchange',q);
 new MutationObserver(()=>{q();gbEnsureDept();}).observe(document.body,{attributes:true,attributeFilter:['data-view']});
 setTimeout(fix,200);setTimeout(fix,900);})();

document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-gbLastRefresh>60000)refreshStore();});
setInterval(()=>{if(gbPending&&!isUserBusy()){gbPending=false;gbRenderAll();}},4000);

let gbSplashT=0;
function gbSplashHide(){const sp=$("gbSplash");if(!sp||sp.dataset.done)return;sp.dataset.done="1";sp.classList.add("out");setTimeout(()=>sp.remove(),450);document.documentElement.classList.add("gb-enter");setTimeout(()=>document.documentElement.classList.remove("gb-enter"),1400);}
setTimeout(gbSplashHide,1800);
