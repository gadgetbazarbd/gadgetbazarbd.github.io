const DELIVERY_FEE = 80;
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
      <button class="add-btn" onclick="addToCart(${p.id})">Add to Cart</button>
    </article>`).join("") || `<div class="empty" style="grid-column:1/-1">No products found.</div>`;
}

function addToCart(id){
  const item=cart.find(x=>x.id===id);
  if(item)item.qty++;
  else cart.push({id,qty:1});
  saveCart();
  openCart();
}

function changeQty(id,delta){
  const item=cart.find(x=>x.id===id); if(!item)return;
  item.qty+=delta;
  if(item.qty<=0)cart=cart.filter(x=>x.id!==id);
  saveCart();
}

function removeItem(id){cart=cart.filter(x=>x.id!==id);saveCart();}

function totals(){
  const subtotal=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);return s+p.price*i.qty},0);
  return {subtotal,delivery:subtotal?DELIVERY_FEE:0,total:subtotal+(subtotal?DELIVERY_FEE:0)};
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

  const t=totals();
  const order={
    orderId:makeOrderId(),
    createdAt:new Date().toISOString(),
    customer:{
      name:String(form.get("name")).trim(),
      phone:String(form.get("phone")).trim(),
      district:String(form.get("district")).trim(),
      area:String(form.get("area")).trim(),
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
  $("transactionBox").classList.add("hidden");
  closeCheckout();
  $("successOrderId").textContent=order.orderId;
  $("successModal").classList.remove("hidden");
});

renderProducts();
updateCart();
