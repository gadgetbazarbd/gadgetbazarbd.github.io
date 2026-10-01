// Gadget Bazar BD — Supabase-connected customer site

const SUPABASE_URL = "https://vwwysrdqexjtlmpmevub.supabase.co";
const SUPABASE_KEY = "sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_DELIVERY_SETTINGS = { dhaka: 60, nearby: 100, outside: 130 };
let DELIVERY_SETTINGS = {...DEFAULT_DELIVERY_SETTINGS};
let NEARBY_DISTRICTS = ["Gazipur","Narayanganj","Narsingdi","Munshiganj","Manikganj"];

let selectedDistrict = "";
let selectedUpazila = "";
let locationData = [];
let locationLoaded = false;
let products = [];
let currentCategory = "All Products";
let cart = JSON.parse(localStorage.getItem("gbbd_cart") || "[]");

const $ = id => document.getElementById(id);
const money = n => "৳" + Number(n || 0).toLocaleString("en-BD");

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
  window.__gbToastTimer=setTimeout(
    ()=>t.classList.remove("show"),1600
  );
}

function saveCart(){
  localStorage.setItem("gbbd_cart",JSON.stringify(cart));
  updateCart();
}

function normalizeProduct(row){
  return {
    id: row.id,
    name: row.name || row.product_name || "Unnamed Product",
    cat: row.category || row.cat || "Other",
    price: Number(row.price || 0),
    discount: Number(row.discount || 0),
    stock: Number(row.stock ?? row.stock_quantity ?? 0),
    image: row.image || row.image_url || "",
    description: row.description || "",
    active: row.active !== false,
    featured: !!row.featured,
    emoji: row.emoji || "📦"
  };
}

async function loadProducts(){
  const {data,error}=await sb
    .from("products")
    .select("*")
    .eq("active",true)
    .order("created_at",{ascending:false});

  if(error) throw error;

  products=(data||[]).map(normalizeProduct);

  cart=cart.filter(i =>
    products.some(p=>String(p.id)===String(i.id))
  );

  localStorage.setItem("gbbd_cart",JSON.stringify(cart));
}

async function loadStoreData(){
  const {data,error}=await sb
    .from("delivery_settings")
    .select("*")
    .limit(1);

  if(!error && data && data[0]){
    const d=data[0];

    DELIVERY_SETTINGS={
      dhaka:Number(
        d.dhaka ??
        d.dhaka_fee ??
        d.dhaka_city ??
        DEFAULT_DELIVERY_SETTINGS.dhaka
      ),
      nearby:Number(
        d.nearby ??
        d.nearby_fee ??
        d.nearby_dhaka ??
        DEFAULT_DELIVERY_SETTINGS.nearby
      ),
      outside:Number(
        d.outside ??
        d.outside_fee ??
        d.outside_dhaka ??
        DEFAULT_DELIVERY_SETTINGS.outside
      )
    };

    if(Array.isArray(d.nearby_districts)){
      NEARBY_DISTRICTS=d.nearby_districts;
    }
  }
}

async function refreshStore(){
  try{
    await Promise.all([
      loadProducts(),
      loadStoreData()
    ]);

    renderProducts();
    updateCart();

    setTimeout(setupLocationPickers,0);

  }catch(err){
    console.error("Supabase load error:",err);
    showToast("Products could not be loaded");
  }
}

function showAllProducts(){
  currentCategory="All Products";
  renderProducts();

  const section=$("products");
  if(section){
    section.scrollIntoView({behavior:"smooth"});
  }
}

function filterCategory(cat){
  currentCategory=cat;
  renderProducts();

  const section=$("products");
  if(section){
    section.scrollIntoView({behavior:"smooth"});
  }
}

function filteredProducts(){
  const search=$("searchInput");
  const sortBox=$("sortSelect");

  const q=search ? search.value.trim().toLowerCase() : "";

  let list=products.filter(
    p=>currentCategory==="All Products" || p.cat===currentCategory
  );

  if(q){
    list=list.filter(
      p=>(p.name+" "+p.cat).toLowerCase().includes(q)
    );
  }

  const sort=sortBox ? sortBox.value : "";

  if(sort==="low"){
    list.sort((a,b)=>a.price-b.price);
  }

  if(sort==="high"){
    list.sort((a,b)=>b.price-a.price);
  }

  if(sort==="featured"){
    list.sort(
      (a,b)=>Number(b.featured)-Number(a.featured)
    );
  }

  return list;
}

function renderProducts(){
  const grid=$("productsGrid");
  const title=$("sectionTitle");
  const count=$("productCount");

  if(!grid)return;

  const list=filteredProducts();

  if(title)title.textContent=currentCategory;
  if(count)count.textContent=`${list.length} products`;

  grid.innerHTML=list.map(p=>{

    const soldOut=p.stock<=0;
    const hasDiscount=p.discount>0;

    const finalPrice=hasDiscount
      ?Math.max(0,p.price-(p.price*p.discount/100))
      :p.price;

    const id=String(p.id).replace(/'/g,"\\'");

    return `
    <article class="product-card">

      <div class="product-img">
        ${
          p.image
          ? `<img src="${p.image}"
              alt="${escapeHtml(p.name)}"
              loading="lazy"
              style="width:100%;height:100%;object-fit:contain;border-radius:14px">`
          : p.emoji
        }
      </div>

      <div class="category">
        ${escapeHtml(p.cat)}
      </div>

      <h3>${escapeHtml(p.name)}</h3>

      <div class="price">
        ${money(finalPrice)}
        ${
          hasDiscount
          ? ` <del style="font-size:12px;color:#7895af">
               ${money(p.price)}
             </del>`
          : ""
        }
      </div>

      <div class="product-actions">

        <button
          class="add-btn"
          ${soldOut?"disabled":""}
          onclick="addToCart('${id}')">
          ${soldOut?"Out of Stock":"Add to Cart"}
        </button>

        <button
          class="buy-btn"
          ${soldOut?"disabled":""}
          onclick="buyNow('${id}')">
          ${soldOut?"Out of Stock":"Buy Now"}
        </button>

      </div>

    </article>`;
  }).join("") ||
  `<div class="empty" style="grid-column:1/-1">
     No products found.
   </div>`;
}

function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

function getProduct(id){
  return products.find(
    p=>String(p.id)===String(id)
  );
}

function addToCart(id){
  const p=getProduct(id);

  if(!p || p.stock<=0){
    return showToast("Out of stock");
  }

  const item=cart.find(
    x=>String(x.id)===String(id)
  );

  if(item){
    if(item.qty>=p.stock){
      return showToast("Stock limit reached");
    }

    item.qty++;
  }else{
    cart.push({
      id:p.id,
      qty:1
    });
  }

  saveCart();
  showToast("Added to cart");
}

function buyNow(id){
  const p=getProduct(id);

  if(!p || p.stock<=0){
    return showToast("Out of stock");
  }

  cart=[{
    id:p.id,
    qty:1
  }];

  saveCart();
  openCheckout();
}

function changeQty(id,delta){
  const item=cart.find(
    x=>String(x.id)===String(id)
  );

  const p=getProduct(id);

  if(!item || !p)return;

  item.qty+=delta;

  if(item.qty>p.stock){
    item.qty=p.stock;
  }

  if(item.qty<=0){
    cart=cart.filter(
      x=>String(x.id)!==String(id)
    );
  }

  saveCart();
}

function removeItem(id){
  cart=cart.filter(
    x=>String(x.id)!==String(id)
  );

  saveCart();
}

function getDeliveryFee(){
  if(!cart.length || !selectedDistrict){
    return 0;
  }

  if(selectedDistrict==="Dhaka"){
    return DELIVERY_SETTINGS.dhaka;
  }

  if(NEARBY_DISTRICTS.includes(selectedDistrict)){
    return DELIVERY_SETTINGS.nearby;
  }

  return DELIVERY_SETTINGS.outside;
}

function totals(){
  const subtotal=cart.reduce((s,i)=>{
    const p=getProduct(i.id);

    if(!p)return s;

    const finalPrice=p.discount>0
      ?Math.max(0,p.price-(p.price*p.discount/100))
      :p.price;

    return s+finalPrice*i.qty;
  },0);

  const delivery=subtotal
    ?getDeliveryFee()
    :0;

  return {
    subtotal,
    delivery,
    total:subtotal+delivery
  };
}

function updateDeliveryInfo(){
  const box=$("deliveryInfo");

  if(!box)return;

  if(!selectedDistrict){
    box.textContent=
      "Select your district to calculate delivery charge.";

    updateCart();
    return;
  }

  const fee=getDeliveryFee();

  const zone=
    selectedDistrict==="Dhaka"
    ?"Dhaka"
    :(NEARBY_DISTRICTS.includes(selectedDistrict)
      ?"Nearby Dhaka"
      :"Outside Dhaka");

  box.textContent=
    `Delivery: ${money(fee)} • ${zone}`;

  updateCart();
}

function updateCart(){
  const count=$("cartCount");

  if(count){
    count.textContent=
      cart.reduce((s,i)=>s+i.qty,0);
  }

  const t=totals();

  if($("cartSubtotal"))
    $("cartSubtotal").textContent=money(t.subtotal);

  if($("cartDelivery"))
    $("cartDelivery").textContent=money(t.delivery);

  if($("cartTotal"))
    $("cartTotal").textContent=money(t.total);

  if($("checkoutTotal"))
    $("checkoutTotal").textContent=money(t.total);

  if($("checkoutBtn"))
    $("checkoutBtn").disabled=!cart.length;

  const cartItems=$("cartItems");

  if(!cartItems)return;

  cartItems.innerHTML=cart.length
    ?cart.map(i=>{

      const p=getProduct(i.id);

      if(!p)return "";

      const finalPrice=p.discount>0
        ?Math.max(0,p.price-(p.price*p.discount/100))
        :p.price;

      const id=String(p.id).replace(/'/g,"\\'");

      return `
      <div class="cart-row">

        <div class="mini-img">
          ${
            p.image
            ? `<img src="${p.image}" alt=""
                style="width:100%;height:100%;object-fit:contain;border-radius:10px">`
            : p.emoji
          }
        </div>

        <div>

          <h4>${escapeHtml(p.name)}</h4>

          <small>
            ${money(finalPrice)} each
          </small>

          <div class="qty">

            <button onclick="changeQty('${id}',-1)">
              −
            </button>

            <b>${i.qty}</b>

            <button onclick="changeQty('${id}',1)">
              +
            </button>

            <button
              class="remove"
              onclick="removeItem('${id}')">
              Remove
            </button>

          </div>

        </div>

        <strong>
          ${money(finalPrice*i.qty)}
        </strong>

      </div>`;
    }).join("")
    :`<div class="empty">
       Your cart is empty.
     </div>`;
}

async function loadLocations(){
  if(locationLoaded)return;

  const url=
    "https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json";

  try{

    const res=await fetch(
      url,
      {cache:"force-cache"}
    );

    if(!res.ok){
      throw new Error("Location data unavailable");
    }

    locationData=await res.json();
    locationLoaded=true;

  }catch(err){

    console.warn(
      "Location data could not be loaded:",
      err
    );

    locationData=[
      {bn_name:"ঢাকা",name:"Dhaka",districts:[]},
      {bn_name:"কুষ্টিয়া",name:"Kushtia",districts:[]},
      {bn_name:"চট্টগ্রাম",name:"Chattogram",districts:[]},
      {bn_name:"খুলনা",name:"Khulna",districts:[]},
      {bn_name:"বরিশাল",name:"Barishal",districts:[]},
      {bn_name:"রাজশাহী",name:"Rajshahi",districts:[]},
      {bn_name:"সিলেট",name:"Sylhet",districts:[]},
      {bn_name:"রংপুর",name:"Rangpur",districts:[]},
      {bn_name:"ময়মনসিংহ",name:"Mymensingh",districts:[]}
    ];
  }
}

function allDistricts(){
  const out=[];

  for(const div of locationData){

    for(const d of (div.districts||[])){

      out.push({
        name:d.name,
        bn:d.bn_name,
        upazilas:d.upazilas||[]
      });
    }
  }

  return out;
}

function districtMatches(q){
  const term=q.trim().toLowerCase();

  return allDistricts()
    .filter(
      d=>!term ||
      `${d.name} ${d.bn}`
        .toLowerCase()
        .includes(term)
    )
    .slice(0,15);
}

function upazilaMatches(q){
  const d=allDistricts().find(
    x=>x.name===selectedDistrict ||
       x.bn===selectedDistrict
  );

  if(!d)return [];

  const term=q.trim().toLowerCase();

  return (d.upazilas||[])
    .filter(
      u=>`${u.name} ${u.bn_name||u.bn||""}`
        .toLowerCase()
        .includes(term)
    )
    .slice(0,20);
}

function renderSuggestions(el,items,type){
  if(!el)return;

  if(!items.length){
    el.innerHTML="";
    el.classList.add("hidden");
    return;
  }

  el.innerHTML=items.map(
    x=>`
    <button type="button" class="suggestion">
      ${x.bn_name||x.bn||x.name}
      <small>${x.name}</small>
    </button>`
  ).join("");

  el.classList.remove("hidden");

  el.querySelectorAll(".suggestion")
    .forEach((b,i)=>{

      b.onclick=()=>{

        const x=items[i];

        if(type==="district"){

          selectedDistrict=x.name;
          selectedUpazila="";

          $("districtInput").value=
            x.bn_name||x.bn||x.name;

          $("districtSuggestions")
            .classList.add("hidden");

          const u=$("upazilaInput");

          u.disabled=false;
          u.value="";
          u.placeholder=
            "Type/select upazila...";

          updateDeliveryInfo();

        }else{

          selectedUpazila=x.name;

          $("upazilaInput").value=
            x.bn_name||x.bn||x.name;

          $("upazilaSuggestions")
            .classList.add("hidden");
        }
      };
    });
}

async function setupLocationPickers(){

  await loadLocations();

  const di=$("districtInput");
  const ui=$("upazilaInput");

  if(!di || !ui)return;

  di.addEventListener("focus",()=>{
    renderSuggestions(
      $("districtSuggestions"),
      districtMatches(di.value),
      "district"
    );
  });

  di.addEventListener("input",()=>{

    selectedDistrict="";
    selectedUpazila="";

    ui.value="";
    ui.disabled=true;

    updateDeliveryInfo();

    renderSuggestions(
      $("districtSuggestions"),
      districtMatches(di.value),
      "district"
    );
  });

  ui.addEventListener("focus",()=>{
    renderSuggestions(
      $("upazilaSuggestions"),
      upazilaMatches(ui.value),
      "upazila"
    );
  });

  ui.addEventListener("input",()=>{
    renderSuggestions(
      $("upazilaSuggestions"),
      upazilaMatches(ui.value),
      "upazila"
    );
  });

  document.addEventListener("click",e=>{

    if(!e.target.closest(".search-select")){

      $("districtSuggestions")
        ?.classList.add("hidden");

      $("upazilaSuggestions")
        ?.classList.add("hidden");
    }
  });
}

function openMenu(){
  const menu=$("sideMenu");
  const overlay=$("overlay");

  if(menu)menu.classList.add("open");
  if(overlay)overlay.classList.remove("hidden");
}

function closeMenu(){
  const menu=$("sideMenu");
  const overlay=$("overlay");
  const cartDrawer=$("cartDrawer");

  if(menu)menu.classList.remove("open");

  if(
    overlay &&
    (!cartDrawer ||
     !cartDrawer.classList.contains("open"))
  ){
    overlay.classList.add("hidden");
  }
}

function openCart(){
  const cartDrawer=$("cartDrawer");
  const overlay=$("overlay");

  if(cartDrawer)
    cartDrawer.classList.add("open");

  if(overlay)
    overlay.classList.remove("hidden");

  updateCart();
}

function closeCart(){
  const cartDrawer=$("cartDrawer");
  const overlay=$("overlay");
  const menu=$("sideMenu");

  if(cartDrawer)
    cartDrawer.classList.remove("open");

  if(
    overlay &&
    (!menu ||
     !menu.classList.contains("open"))
  ){
    overlay.classList.add("hidden");
  }
}

function openCheckout(){

  if(!cart.length)return;

  closeCart();

  const modal=$("checkoutModal");

  if(modal)
    modal.classList.remove("hidden");

  updateCart();
}

function closeCheckout(){
  const modal=$("checkoutModal");

  if(modal)
    modal.classList.add("hidden");
}

function closeSuccess(){
  const modal=$("successModal");

  if(modal)
    modal.classList.add("hidden");
}

/* =========================
   SUPABASE ORDER
   ========================= */

async function submitOrderToSupabase(order){

  const row={
    order_number:order.orderId,
    customer_name:order.customer.name,
    phone:order.customer.phone,
    items:order.items,
    subtotal:Number(order.subtotal)||0,
    delivery_charge:Number(order.delivery)||0
  };

  const {data,error}=await sb
    .from("orders")
    .insert(row)
    .select();

  if(error){

    console.error(
      "SUPABASE ORDER ERROR:",
      error
    );

    throw error;
  }

  console.log(
    "ORDER SAVED:",
    data
  );
}

function makeOrderId(){
  return "GBBD-"+Date.now()
    .toString()
    .slice(-8);
}

/* =========================
   CUSTOMER UI INITIALIZATION
   ========================= */

function initCustomerUI(){

  const menuBtn=$("menuBtn");
  const cartBtn=$("cartBtn");
  const overlay=$("overlay");
  const searchInput=$("searchInput");
  const sortSelect=$("sortSelect");
  const checkoutBtn=$("checkoutBtn");
  const checkoutForm=$("checkoutForm");

  if(menuBtn){
    menuBtn.onclick=openMenu;
  }

  if(cartBtn){
    cartBtn.onclick=openCart;
  }

  if(overlay){

    overlay.onclick=()=>{
      closeMenu();
      closeCart();
    };
  }

  document
    .querySelectorAll('[data-close="menu"]')
    .forEach(
      b=>b.onclick=closeMenu
    );

  document
    .querySelectorAll('[data-close="cart"]')
    .forEach(
      b=>b.onclick=closeCart
    );

  document
    .querySelectorAll('[data-close="checkout"]')
    .forEach(
      b=>b.onclick=closeCheckout
    );

  if(searchInput){
    searchInput.addEventListener(
      "input",
      renderProducts
    );
  }

  if(sortSelect){
    sortSelect.addEventListener(
      "change",
      renderProducts
    );
  }

  document
    .querySelectorAll('input[name="payment"]')
    .forEach(r=>{

      r.addEventListener("change",()=>{

        const manual=
          r.value!=="Cash on Delivery";

        const transactionBox=
          $("transactionBox");

        if(transactionBox){
          transactionBox.classList.toggle(
            "hidden",
            !manual
          );
        }
      });
    });

  if(checkoutBtn){
    checkoutBtn.onclick=openCheckout;
  }

  if(checkoutForm){

    checkoutForm.addEventListener(
      "submit",
      async e=>{

        e.preventDefault();

        if(!cart.length)return;

        const form=
          new FormData(e.target);

        const payment=
          form.get("payment");

        const transactionId=
          String(
            form.get("transactionId")||""
          ).trim();

        if(
          payment!=="Cash on Delivery" &&
          !transactionId
        ){

          alert(
            "Please enter the transaction ID for the selected payment method."
          );

          return;
        }

        if(
          !selectedDistrict ||
          !selectedUpazila
        ){

          alert(
            "Please select a district and upazila from the suggestions."
          );

          return;
        }

        const t=totals();

        const order={

          orderId:makeOrderId(),

          createdAt:
            new Date().toISOString(),

          customer:{

            name:String(
              form.get("name")||""
            ).trim(),

            phone:String(
              form.get("phone")||""
            ).trim(),

            district:
              selectedDistrict,

            area:
              selectedUpazila,

            address:String(
              form.get("address")||""
            ).trim()
          },

          paymentMethod:
            payment,

          transactionId,

          note:String(
            form.get("note")||""
          ).trim(),

          items:cart.map(i=>{

            const p=getProduct(i.id);

            const price=
              p.discount>0
              ?Math.max(
                0,
                p.price-
                (p.price*p.discount/100)
              )
              :p.price;

            return {
              id:p.id,
              name:p.name,
              price,
              qty:i.qty
            };
          }),

          subtotal:t.subtotal,
          delivery:t.delivery,
          total:t.total
        };

        try{

          await submitOrderToSupabase(order);

        }catch(err){

          console.error(
            "ORDER ERROR:",
            err
          );

          alert(
            "ORDER ERROR\n\n"+
            "Message: "+
            (err.message||"Unknown")+
            "\n"+
            "Code: "+
            (err.code||"N/A")+
            "\n"+
            "Details: "+
            (err.details||"N/A")+
            "\n"+
            "Hint: "+
            (err.hint||"N/A")
          );

          return;
        }

        localStorage.setItem(
          "gbbd_last_order",
          JSON.stringify(order)
        );

        const orders=
          JSON.parse(
            localStorage.getItem(
              "gbbd_orders"
            )||"[]"
          );

        orders.unshift(order);

        localStorage.setItem(
          "gbbd_orders",
          JSON.stringify(orders)
        );

        cart=[];

        saveCart();

        e.target.reset();

        selectedDistrict="";
        selectedUpazila="";

        const upazilaInput=
          $("upazilaInput");

        if(upazilaInput){

          upazilaInput.disabled=true;

          upazilaInput.placeholder=
            "Select district first...";
        }

        updateDeliveryInfo();

        const transactionBox=
          $("transactionBox");

        if(transactionBox){
          transactionBox.classList.add(
            "hidden"
          );
        }

        closeCheckout();

        if($("successOrderId")){
          $("successOrderId").textContent=
            order.orderId;
        }

        if($("successModal")){
          $("successModal")
            .classList.remove("hidden");
        }
      }
    );
  }
}

/* =========================
   START
   ========================= */

async function startCustomerSite(){

  // Buttons are initialized FIRST.
  // So Supabase loading error cannot break Menu/Cart.

  initCustomerUI();

  renderProducts();
  updateCart();

  await refreshStore();

  setupLocationPickers();
}

if(document.readyState==="loading"){

  document.addEventListener(
    "DOMContentLoaded",
    startCustomerSite
  );

}else{

  startCustomerSite();
}

/* Refresh products every 60 seconds */
setInterval(
  refreshStore,
  60000
);
