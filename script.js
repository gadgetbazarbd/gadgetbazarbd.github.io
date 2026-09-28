// Delivery settings — change these numbers later when you decide your final rates.
const DELIVERY_SETTINGS = {
  dhaka: 60,
  nearby: 100,
  outside: 130
};
const NEARBY_DISTRICTS = ["Gazipur","Narayanganj","Narsingdi","Munshiganj","Manikganj"];

let selectedDistrict = "";
let selectedUpazila = "";
let locationData = [];
let locationLoaded = false;
const BKASH_NUMBER = "YOUR_BKASH_NUMBER";
const NAGAD_NUMBER = "YOUR_NAGAD_NUMBER";
const APPS_SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

const products = [
  {id:1,name:"TWS AirBuds Pro",cat:"Audio",price:1290,emoji:"🎧"},
  {id:2,name:"Bluetooth Speaker Mini",cat:"Audio",price:990,emoji:"🔊"},
  {id:3,name:"Smart Watch S9",cat:"Wearables",price:1850,emoji:"⌚"},
  {id:4,name:"Fitness Smart Band",cat:"Wearables",price:850,emoji:"⌚"},
  {id:5,name:"Power Bank 10000mAh",cat:"Power & Charging",price:1190,emoji:"🔋"},
  {id:6,name:"20W Fast Charger",cat:"Power & Charging",price:690,emoji:"🔌"},
  {id:7,name:"Fast Charge Type-C Cable",cat:"Power & Charging",price:290,emoji:"🔗"},
  {id:8,name:"360° Phone Stand",cat:"Mobile Accessories",price:350,emoji:"📱"},
  {id:9,name:"Wireless Mouse",cat:"Mobile Accessories",price:590,emoji:"🖱️"},
  {id:10,name:"RGB Strip Light 5M",cat:"RGB & Lighting",price:890,emoji:"🌈"},
  {id:11,name:"RGB Desk Lamp",cat:"RGB & Lighting",price:1250,emoji:"💡"},
  {id:12,name:"Smart LED Night Light",cat:"Home Gadgets",price:650,emoji:"🏮"},
  {id:13,name:"Mini Rechargeable Fan",cat:"Home Gadgets",price:780,emoji:"🌀"},
  {id:14,name:"Gaming Earphones",cat:"Gaming",price:720,emoji:"🎮"},
  {id:15,name:"RGB Gaming Mouse Pad",cat:"Gaming",price:990,emoji:"🖱️"}
];

let cart = JSON.parse(localStorage.getItem("gbbd_cart") || "[]");
let currentCategory = "All Products";

const $ = id => document.getElementById(id);
const money = n => "৳" + Number(n).toLocaleString("en-BD");

function saveCart(){localStorage.setItem("gbbd_cart",JSON.stringify(cart));updateCart();}
function showToast(message){
  let t=document.getElementById("gbToast");
  if(!t){
    t=document.createElement("div");
    t.id="gbToast";
    t.className="gb-toast";
    document.body.appendChild(t);
  }
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(window.__gbToastTimer);
  window.__gbToastTimer=setTimeout(()=>t.classList.remove("show"),1600);
}

function showAllProducts(){currentCategory="All Products";renderProducts();$("products").scrollIntoView({behavior:"smooth"});}
function filterCategory(cat){currentCategory=cat;renderProducts();$("products").scrollIntoView({behavior:"smooth"});}

function filteredProducts(){
  const q = $("searchInput").value.trim().toLowerCase();
  let list = products.filter(p => currentCategory==="All Products" || p.cat===currentCategory);
  if(q) list=list.filter(p => (p.name+" "+p.cat).toLowerCase().includes(q));
  const sort=$("sortSelect").value;
  if(sort==="low") list.sort((a,b)=>a.price-b.price);
  if(sort==="high") list.sort((a,b)=>b.price-a.price);
  return list;
}

function renderProducts(){
  const list=filteredProducts();
  $("sectionTitle").textContent=currentCategory;
  $("productCount").textContent=`${list.length} products`;
  $("productsGrid").innerHTML=list.map(p=>`
    <article class="product-card">
      <div class="product-img">${p.emoji}</div>
      <div class="category">${p.cat}</div>
      <h3>${p.name}</h3>
      <div class="price">${money(p.price)}</div>
      <div class="product-actions">
        <button class="add-btn" onclick="addToCart(${p.id})">Add to Cart</button>
        <button class="buy-btn" onclick="buyNow(${p.id})">Buy Now</button>
      </div>
    </article>`).join("") || `<div class="empty" style="grid-column:1/-1">No products found.</div>`;
}

function addToCart(id){
  const item=cart.find(x=>x.id===id);
  if(item)item.qty++;
  else cart.push({id,qty:1});
  saveCart();
  // Add to Cart only adds the item; it does not open checkout or the cart drawer.
  showToast("Added to cart");
}

function buyNow(id){
  // Buy Now starts checkout directly with only this product.
  const existing=cart.find(x=>x.id===id);
  cart = [{id, qty:1}];
  saveCart();
  openCheckout();
}

function changeQty(id,delta){
  const item=cart.find(x=>x.id===id); if(!item)return;
  item.qty+=delta;
  if(item.qty<=0)cart=cart.filter(x=>x.id!==id);
  saveCart();
}

function removeItem(id){cart=cart.filter(x=>x.id!==id);saveCart();}

function getDeliveryFee(){
  if(!cart.length || !selectedDistrict) return 0;
  if(selectedDistrict === "Dhaka") return DELIVERY_SETTINGS.dhaka;
  if(NEARBY_DISTRICTS.includes(selectedDistrict)) return DELIVERY_SETTINGS.nearby;
  return DELIVERY_SETTINGS.outside;
}

function totals(){
  const subtotal=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);return s+p.price*i.qty},0);
  const delivery=subtotal?getDeliveryFee():0;
  return {subtotal,delivery,total:subtotal+delivery};
}

function updateDeliveryInfo(){
  const box=$("deliveryInfo"); if(!box) return;
  if(!selectedDistrict){ box.textContent="Select your district to calculate delivery charge."; return; }
  const fee=getDeliveryFee();
  const zone=selectedDistrict==="Dhaka"?"Dhaka":(NEARBY_DISTRICTS.includes(selectedDistrict)?"Nearby Dhaka":"Outside Dhaka");
  box.textContent=`Delivery: ${money(fee)} • ${zone}`;
  updateCart();
}

function updateCart(){
  $("cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0);
  const t=totals();
  $("cartSubtotal").textContent=money(t.subtotal);
  $("cartDelivery").textContent=money(t.delivery);
  $("cartTotal").textContent=money(t.total);
  $("checkoutTotal").textContent=money(t.total);
  $("checkoutBtn").disabled=!cart.length;
  $("cartItems").innerHTML=cart.length?cart.map(i=>{
    const p=products.find(x=>x.id===i.id);
    return `<div class="cart-row">
      <div class="mini-img">${p.emoji}</div>
      <div><h4>${p.name}</h4><small>${money(p.price)} each</small>
        <div class="qty"><button onclick="changeQty(${p.id},-1)">−</button><b>${i.qty}</b><button onclick="changeQty(${p.id},1)">+</button>
        <button class="remove" onclick="removeItem(${p.id})">Remove</button></div>
      </div>
      <strong>${money(p.price*i.qty)}</strong>
    </div>`;
  }).join(""):`<div class="empty">Your cart is empty.</div>`;
}

async function loadLocations(){
  if(locationLoaded) return;
  const url="https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json";
  try{
    const res=await fetch(url,{cache:"force-cache"});
    if(!res.ok) throw new Error("Location data unavailable");
    locationData=await res.json();
    locationLoaded=true;
  }catch(err){
    console.warn("Location data could not be loaded:",err);
    // Fallback district list keeps the checkout usable if the external dataset is unavailable.
    locationData=[
      {bn_name:"ঢাকা",name:"Dhaka",districts:[]},{bn_name:"কুষ্টিয়া",name:"Kushtia",districts:[]},{bn_name:"চট্টগ্রাম",name:"Chattogram",districts:[]},{bn_name:"খুলনা",name:"Khulna",districts:[]},{bn_name:"বরিশাল",name:"Barishal",districts:[]},{bn_name:"রাজশাহী",name:"Rajshahi",districts:[]},{bn_name:"সিলেট",name:"Sylhet",districts:[]},{bn_name:"রংপুর",name:"Rangpur",districts:[]},{bn_name:"ময়মনসিংহ",name:"Mymensingh",districts:[]}
    ];
  }
}

function allDistricts(){
  const out=[];
  for(const div of locationData){ for(const d of (div.districts||[])){ out.push({name:d.name,bn:d.bn_name,upazilas:d.upazilas||[]}); } }
  return out;
}

function districtMatches(q){
  const term=q.trim().toLowerCase();
  return allDistricts().filter(d=>!term || `${d.name} ${d.bn}`.toLowerCase().includes(term)).slice(0,15);
}

function upazilaMatches(q){
  const d=allDistricts().find(x=>x.name===selectedDistrict || x.bn===selectedDistrict);
  if(!d) return [];
  const term=q.trim().toLowerCase();
  return (d.upazilas||[]).filter(u=>`${u.name} ${u.bn_name||u.bn||""}`.toLowerCase().includes(term)).slice(0,20);
}

function renderSuggestions(el,items,type){
  if(!items.length){el.innerHTML="";el.classList.add("hidden");return;}
  el.innerHTML=items.map((x,i)=>`<button type="button" class="suggestion" data-index="${i}">${x.bn_name||x.bn||x.name} <small>${x.name}</small></button>`).join("");
  el.classList.remove("hidden");
  el.querySelectorAll(".suggestion").forEach((b,i)=>b.onclick=()=>{
    if(type==="district"){
      const x=items[i]; selectedDistrict=x.name; selectedUpazila="";
      $("districtInput").value=x.bn_name||x.bn||x.name;
      $("districtSuggestions").classList.add("hidden");
      const u=$("upazilaInput"); u.disabled=false; u.value=""; u.placeholder="Type/select upazila...";
      updateDeliveryInfo();
    }else{
      const x=items[i]; selectedUpazila=x.name;
      $("upazilaInput").value=x.bn_name||x.bn||x.name;
      $("upazilaSuggestions").classList.add("hidden");
    }
  });
}

async function setupLocationPickers(){
  await loadLocations();
  const di=$("districtInput"), ui=$("upazilaInput");
  if(!di || !ui) return;
  di.addEventListener("focus",()=>renderSuggestions($("districtSuggestions"),districtMatches(di.value),"district"));
  di.addEventListener("input",()=>{selectedDistrict="";selectedUpazila="";ui.value="";ui.disabled=true;updateDeliveryInfo();renderSuggestions($("districtSuggestions"),districtMatches(di.value),"district")});
  ui.addEventListener("focus",()=>renderSuggestions($("upazilaSuggestions"),upazilaMatches(ui.value),"upazila"));
  ui.addEventListener("input",()=>renderSuggestions($("upazilaSuggestions"),upazilaMatches(ui.value),"upazila"));
  document.addEventListener("click",e=>{if(!e.target.closest(".search-select")){$("districtSuggestions").classList.add("hidden");$("upazilaSuggestions").classList.add("hidden")}});
}

function openMenu(){ $("sideMenu").classList.add("open"); $("overlay").classList.remove("hidden"); }
function closeMenu(){ $("sideMenu").classList.remove("open"); if(!$("cartDrawer").classList.contains("open"))$("overlay").classList.add("hidden");}
function openCart(){ $("cartDrawer").classList.add("open"); $("overlay").classList.remove("hidden"); updateCart(); }
function closeCart(){ $("cartDrawer").classList.remove("open"); if(!$("sideMenu").classList.contains("open"))$("overlay").classList.add("hidden");}
function closeCheckout(){ $("checkoutModal").classList.add("hidden"); }
function closeSuccess(){ $("successModal").classList.add("hidden"); }

$("menuBtn").onclick=openMenu;
$("cartBtn").onclick=openCart;
$("overlay").onclick=()=>{closeMenu();closeCart();};
document.querySelectorAll('[data-close="menu"]').forEach(b=>b.onclick=closeMenu);
document.querySelectorAll('[data-close="cart"]').forEach(b=>b.onclick=closeCart);
document.querySelectorAll('[data-close="checkout"]').forEach(b=>b.onclick=closeCheckout);

$("searchInput").addEventListener("input",renderProducts);
$("sortSelect").addEventListener("change",renderProducts);

document.querySelectorAll('input[name="payment"]').forEach(r=>{
  r.addEventListener("change",()=>{
    const manual=r.value!=="Cash on Delivery";
    $("transactionBox").classList.toggle("hidden",!manual);
  });
});

$("checkoutBtn").onclick=()=>{
  if(!cart.length)return;
  closeCart();
  $("checkoutModal").classList.remove("hidden");
  updateCart();
};

function makeOrderId(){
  return "GBBD-" + Date.now().toString().slice(-8);
}

$("checkoutForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!cart.length)return;
  const form=new FormData(e.target);
  const payment=form.get("payment");
  const transactionId=String(form.get("transactionId")||"").trim();
  if(payment!=="Cash on Delivery" && !transactionId){
    alert("Please enter the transaction ID for the selected payment method.");
    return;
  }

  if(!selectedDistrict || !selectedUpazila){
    alert("Please select a district and upazila from the suggestions.");
    return;
  }
  const t=totals();
  const order={
    orderId:makeOrderId(),
    createdAt:new Date().toISOString(),
    customer:{
      name:String(form.get("name")).trim(),
      phone:String(form.get("phone")).trim(),
      district:selectedDistrict,
      area:selectedUpazila,
      address:String(form.get("address")).trim()
    },
    paymentMethod:payment,
    transactionId,
    note:String(form.get("note")||"").trim(),
    items:cart.map(i=>{const p=products.find(x=>x.id===i.id);return {id:p.id,name:p.name,price:p.price,qty:i.qty};}),
    subtotal:t.subtotal,delivery:t.delivery,total:t.total
  };

  localStorage.setItem("gbbd_last_order",JSON.stringify(order));
  const orders=JSON.parse(localStorage.getItem("gbbd_orders")||"[]");
  orders.unshift(order);
  localStorage.setItem("gbbd_orders",JSON.stringify(orders));

  if(APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes("PASTE_YOUR")){
    try{
      await fetch(APPS_SCRIPT_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(order)});
    }catch(err){console.warn("Order sync failed:",err);}
  }

  cart=[];
  saveCart();
  e.target.reset();
  selectedDistrict=""; selectedUpazila="";
  $("upazilaInput").disabled=true;
  $("upazilaInput").placeholder="Select district first...";
  updateDeliveryInfo();
  $("transactionBox").classList.add("hidden");
  closeCheckout();
  $("successOrderId").textContent=order.orderId;
  $("successModal").classList.remove("hidden");
});

renderProducts();
updateCart();

setupLocationPickers();
