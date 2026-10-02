// Gadget Bazar BD — customer site / Supabase
const SUPABASE_URL="https://vwwysrdqexjtlmpmevub.supabase.co";
const SUPABASE_KEY="sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=id=>document.getElementById(id);
const money=n=>"৳"+Number(n||0).toLocaleString("en-BD");

const DEFAULT_DELIVERY_SETTINGS={dhaka:60,nearby:100,outside:130};
let DELIVERY_SETTINGS={...DEFAULT_DELIVERY_SETTINGS};
let NEARBY_DISTRICTS=["Gazipur","Narayanganj","Narsingdi","Munshiganj","Manikganj"];
let PAYMENT_SETTINGS={cod_enabled:true,bkash_enabled:false,bkash_number:"",nagad_enabled:false,nagad_number:""};
let products=[],categories=[],cart=JSON.parse(localStorage.getItem("gbbd_cart")||"[]");
let currentCategory="All Products",selectedDistrict="",selectedUpazila="";
let locationData=[],locationLoaded=false;

function toast(msg){
 let t=$("gbToast"); if(!t){t=document.createElement("div");t.id="gbToast";t.className="gb-toast";document.body.appendChild(t);}
 t.textContent=msg;t.classList.add("show");clearTimeout(window.__gbToastTimer);
 window.__gbToastTimer=setTimeout(()=>t.classList.remove("show"),1600);
}
function saveCart(){localStorage.setItem("gbbd_cart",JSON.stringify(cart));updateCart();}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

function normalizeProduct(r){return{
 id:r.id,name:r.name||r.product_name||"Unnamed Product",cat:r.category||r.cat||"Other",
 price:Number(r.price||0),discount:Number(r.discount||0),stock:Number(r.stock??r.stock_quantity??0),
 image:r.image||r.image_url||"",featured:!!r.featured,emoji:r.emoji||"📦"
};}


async function loadCategories(){
 const {data,error}=await sb.from("categories").select("*").order("name",{ascending:true});
 if(error)throw error;
 categories=(data||[]).filter(c=>c.active!==false && String(c.name||'').trim());
 renderCategoryMenu();
}
function renderCategoryMenu(){
 const menu=$("sideMenu");
 if(!menu)return;
 menu.querySelectorAll('[onclick*="filterCategory"]').forEach(el=>el.remove());
 let box=$("dynamicCategories");
 if(!box){
   box=document.createElement("div");
   box.id="dynamicCategories";
   box.style.cssText="padding:8px 0 16px;";
   menu.appendChild(box);
 }
 const names=[...new Set(categories.map(c=>String(c.name).trim()))];
 box.innerHTML=`<div style="padding:8px 16px;color:#7895af;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Categories</div>`
   + `<button type="button" class="menu-item" onclick="filterCategory('All Products');closeMenu()">All Products</button>`
   + names.map(n=>`<button type="button" class="menu-item" onclick="filterCategory(${JSON.stringify(n)});closeMenu()">${esc(n)}</button>`).join("");
}

async function loadProducts(){
 const {data,error}=await sb.from("products").select("*").eq("active",true).order("created_at",{ascending:false});
 if(error)throw error; products=(data||[]).map(normalizeProduct);
 cart=cart.filter(x=>products.some(p=>String(p.id)===String(x.id)));saveCart();
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

async function refreshStore(){
 try{await Promise.all([loadProducts(),loadCategories(),loadStoreData()]);renderProducts();updateCart();setTimeout(setupLocationPickers,0);}
 catch(e){console.error(e);toast("Products could not be loaded");}
}

function filteredProducts(){
 let q=($("searchInput")?.value||"").trim().toLowerCase();
 let a=products.filter(p=>currentCategory==="All Products"||p.cat===currentCategory);
 if(q)a=a.filter(p=>(p.name+" "+p.cat).toLowerCase().includes(q));
 let s=$("sortSelect")?.value||"";
 if(s==="low")a.sort((x,y)=>x.price-y.price);
 if(s==="high")a.sort((x,y)=>y.price-x.price);
 if(s==="featured")a.sort((x,y)=>Number(y.featured)-Number(x.featured));
 return a;
}
function renderProducts(){
 let g=$("productsGrid");if(!g)return;let a=filteredProducts();
 if($("sectionTitle"))$("sectionTitle").textContent=currentCategory;
 if($("productCount"))$("productCount").textContent=`${a.length} products`;
 g.innerHTML=a.map(p=>{
  let sold=p.stock<=0,disc=p.discount>0,price=disc?Math.max(0,p.price-p.price*p.discount/100):p.price;
  let id=String(p.id).replace(/'/g,"\\'");
  return `<article class="product-card"><div class="product-img">${p.image?`<img src="${p.image}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:14px">`:p.emoji}</div><div class="category">${esc(p.cat)}</div><h3>${esc(p.name)}</h3><div class="price">${money(price)} ${disc?`<del style="font-size:12px;color:#7895af">${money(p.price)}</del>`:""}</div><div class="product-actions"><button class="add-btn" ${sold?"disabled":""} onclick="addToCart('${id}')">${sold?"Out of Stock":"Add to Cart"}</button><button class="buy-btn" ${sold?"disabled":""} onclick="buyNow('${id}')">${sold?"Out of Stock":"Buy Now"}</button></div></article>`;
 }).join("")||`<div class="empty" style="grid-column:1/-1">No products found.</div>`;
}
function getProduct(id){return products.find(p=>String(p.id)===String(id));}
function finalPrice(p){return p.discount>0?Math.max(0,p.price-p.price*p.discount/100):p.price;}
function addToCart(id){let p=getProduct(id);if(!p||p.stock<=0)return toast("Out of stock");let x=cart.find(i=>String(i.id)===String(id));if(x){if(x.qty>=p.stock)return toast("Stock limit reached");x.qty++;}else cart.push({id:p.id,qty:1});saveCart();toast("Added to cart");}
function buyNow(id){let p=getProduct(id);if(!p||p.stock<=0)return toast("Out of stock");cart=[{id:p.id,qty:1}];saveCart();openCheckout();}
function changeQty(id,d){let x=cart.find(i=>String(i.id)===String(id)),p=getProduct(id);if(!x||!p)return;x.qty+=d;if(x.qty>p.stock)x.qty=p.stock;if(x.qty<=0)cart=cart.filter(i=>String(i.id)!==String(id));saveCart();}
function removeItem(id){cart=cart.filter(i=>String(i.id)!==String(id));saveCart();}

function getDeliveryFee(){
 if(!cart.length||!selectedDistrict)return 0;
 if(selectedDistrict==="Dhaka")return DELIVERY_SETTINGS.dhaka;
 if(NEARBY_DISTRICTS.includes(selectedDistrict))return DELIVERY_SETTINGS.nearby;
 return DELIVERY_SETTINGS.outside;
}
function totals(){
 let subtotal=cart.reduce((s,x)=>{let p=getProduct(x.id);return s+(p?finalPrice(p)*x.qty:0)},0);
 let delivery=subtotal?getDeliveryFee():0;return{subtotal,delivery,total:subtotal+delivery};
}
function updateDeliveryInfo(){
 let b=$("deliveryInfo");if(!b)return;
 if(!selectedDistrict)b.textContent="Select your district to calculate delivery charge.";
 else{let z=selectedDistrict==="Dhaka"?"Dhaka":NEARBY_DISTRICTS.includes(selectedDistrict)?"Nearby Dhaka":"Outside Dhaka";b.textContent=`Delivery: ${money(getDeliveryFee())} • ${z}`;}
 updateCart();
}
function updateCart(){
 let c=$("cartCount");if(c)c.textContent=cart.reduce((s,x)=>s+x.qty,0);
 let t=totals();["cartSubtotal","cartDelivery","cartTotal","checkoutTotal"].forEach((id,i)=>{let e=$(id);if(e)e.textContent=money([t.subtotal,t.delivery,t.total,t.total][i]);});
 let cb=$("checkoutBtn");if(cb)cb.disabled=!cart.length||!enabledPaymentTypes().length;
 let box=$("cartItems");if(!box)return;
 box.innerHTML=cart.length?cart.map(x=>{let p=getProduct(x.id);if(!p)return"";let id=String(p.id).replace(/'/g,"\\'");return `<div class="cart-row"><div class="mini-img">${p.image?`<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:10px">`:p.emoji}</div><div><h4>${esc(p.name)}</h4><small>${money(finalPrice(p))} each</small><div class="qty"><button onclick="changeQty('${id}',-1)">−</button><b>${x.qty}</b><button onclick="changeQty('${id}',1)">+</button><button class="remove" onclick="removeItem('${id}')">Remove</button></div></div><strong>${money(finalPrice(p)*x.qty)}</strong></div>`}).join(""):`<div class="empty">Your cart is empty.</div>`;
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
function closeCheckout(){$("checkoutModal")?.classList.add("hidden");}
function closeSuccess(){$("successModal")?.classList.add("hidden");}
function showAllProducts(){currentCategory="All Products";renderProducts();$("products")?.scrollIntoView({behavior:"smooth"});}
function filterCategory(c){currentCategory=c;renderProducts();$("products")?.scrollIntoView({behavior:"smooth"});}

async function loadLocations(){
 if(locationLoaded)return;
 try{let r=await fetch("https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json",{cache:"force-cache"});if(!r.ok)throw Error();locationData=await r.json();locationLoaded=true;}
 catch(e){console.warn("Location data unavailable",e);locationData=[];}
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
 u.addEventListener("input",()=>suggestions($("upazilaSuggestions"),upazilaMatches(u.value),"upazila"));
 document.addEventListener("click",e=>{if(!e.target.closest(".search-select")){$("districtSuggestions")?.classList.add("hidden");$("upazilaSuggestions")?.classList.add("hidden");}});
}

function makeOrderId(){return"GBBD-"+Date.now().toString().slice(-8);}
async function submitOrderToSupabase(o){
 let row={order_number:o.orderId,customer_name:o.customer.name,phone:o.customer.phone,district:o.customer.district,upazila:o.customer.area,address:o.customer.address,note:o.note||null,items:o.items,subtotal:Number(o.subtotal)||0,delivery_charge:Number(o.delivery)||0,total:Number(o.total)||0,payment_method:o.paymentMethod||"Cash on Delivery",transaction_id:o.transactionId||null,status:"Pending"};
 let {data,error}=await sb.from("orders").insert(row).select();if(error)throw error;console.log("ORDER SAVED",data);
}

function initCustomerUI(){
 $("menuBtn")&&( $("menuBtn").onclick=openMenu);$("cartBtn")&&($("cartBtn").onclick=openCart);$("overlay")&&($("overlay").onclick=()=>{closeMenu();closeCart();});
 document.querySelectorAll('[data-close="menu"]').forEach(x=>x.onclick=closeMenu);document.querySelectorAll('[data-close="cart"]').forEach(x=>x.onclick=closeCart);document.querySelectorAll('[data-close="checkout"]').forEach(x=>x.onclick=closeCheckout);
 $("searchInput")?.addEventListener("input",renderProducts);$("sortSelect")?.addEventListener("change",renderProducts);
 document.querySelectorAll('input[name="payment"]').forEach(r=>r.addEventListener("change",updateTransactionBox));
 $("checkoutBtn")&&($("checkoutBtn").onclick=openCheckout);
 $("checkoutForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!cart.length)return;let f=new FormData(e.target),payment=String(f.get("payment")||""),tid=String(f.get("transactionId")||"").trim(),type=ptype({value:payment});
  if(!isPaymentMethodEnabled(payment))return alert("The selected payment method is currently unavailable.");
  if((type==="bkash"||type==="nagad")&&!tid)return alert("Please enter the transaction ID for the selected payment method.");
  if(!selectedDistrict||!selectedUpazila)return alert("Please select a district and upazila from the suggestions.");
  let t=totals(),o={orderId:makeOrderId(),createdAt:new Date().toISOString(),customer:{name:String(f.get("name")||"").trim(),phone:String(f.get("phone")||"").trim(),district:selectedDistrict,area:selectedUpazila,address:String(f.get("address")||"").trim()},paymentMethod:payment,transactionId:type==="cod"?"":tid,note:String(f.get("note")||"").trim(),items:cart.map(x=>{let p=getProduct(x.id);return{id:p.id,name:p.name,price:finalPrice(p),qty:x.qty}}),subtotal:t.subtotal,delivery:t.delivery,total:t.total};
  try{await submitOrderToSupabase(o);}catch(err){console.error(err);return alert("ORDER ERROR\n\nMessage: "+(err.message||"Unknown")+"\nCode: "+(err.code||"N/A"));}
  localStorage.setItem("gbbd_last_order",JSON.stringify(o));let orders=JSON.parse(localStorage.getItem("gbbd_orders")||"[]");orders.unshift(o);localStorage.setItem("gbbd_orders",JSON.stringify(orders));
  cart=[];saveCart();e.target.reset();selectedDistrict="";selectedUpazila="";if($("districtInput"))$("districtInput").value="";if($("upazilaInput")){$("upazilaInput").value="";$("upazilaInput").disabled=true;$("upazilaInput").placeholder="Select district first...";}$("transactionBox")?.classList.add("hidden");updateDeliveryInfo();closeCheckout();if($("successOrderId"))$("successOrderId").textContent=o.orderId;$("successModal")?.classList.remove("hidden");
 });
}

async function trackOrdersByPhone(){
 let input=$("trackPhone"),box=$("trackingResult"),btn=$("trackOrderBtn");if(!input||!box)return;let phone=input.value.trim();if(!phone){box.classList.remove("hidden");box.innerHTML=`<div class="tracking-error">Please enter your phone number.</div>`;return;}
 if(btn){btn.disabled=true;btn.textContent="Searching...";}box.classList.remove("hidden");box.innerHTML=`<div class="tracking-loading">Searching your orders...</div>`;
 try{let {data,error}=await sb.rpc("track_orders_by_phone",{p_phone:phone});if(error)throw error;if(!data?.length){box.innerHTML=`<div class="tracking-empty"><strong>No orders found</strong><p>No order was found for this phone number.</p></div>`;return;}
 box.innerHTML=`<div class="tracking-count">${data.length} order${data.length>1?"s":""} found</div>`+data.map(o=>{let items=Array.isArray(o.items)?o.items:[];let list=items.map(i=>`<div class="tracking-product"><span>${esc(i.name||i.product_name||"Product")}</span><strong>×${Number(i.quantity??i.qty??1)}</strong></div>`).join("");let s=String(o.status||"Pending");return `<div class="tracking-order"><div class="tracking-order-head"><div><small>Order ID</small><strong>${esc(o.order_number||"")}</strong></div><span class="tracking-status ${s.toLowerCase().replace(/\s+/g,"-")}">${esc(s)}</span></div><div class="tracking-products">${list}</div><div class="tracking-order-bottom"><span>📅 ${esc(o.created_at?new Date(o.created_at).toLocaleDateString():"")}</span><strong>${money(o.total)}</strong></div></div>`}).join("");
 }catch(e){console.error(e);box.innerHTML=`<div class="tracking-error"><strong>Something went wrong.</strong><p>Please try again.</p></div>`;}finally{if(btn){btn.disabled=false;btn.textContent="Track Orders";}}
}

async function startCustomerSite(){initCustomerUI();renderProducts();updateCart();await refreshStore();setupLocationPickers();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startCustomerSite);else startCustomerSite();
setInterval(refreshStore,60000);
document.addEventListener("DOMContentLoaded",()=>{$("trackOrderBtn")?.addEventListener("click",trackOrdersByPhone);});
