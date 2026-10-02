// Gadget Bazar BD — Supabase-connected customer site

const SUPABASE_URL = "https://vwwysrdqexjtlmpmevub.supabase.co";
const SUPABASE_KEY = "sb_publishable_vYHW5zcCIPipjPS-tuxnRA_dS125qax";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const DEFAULT_DELIVERY_SETTINGS = {
  dhaka: 60,
  nearby: 100,
  outside: 130
};

let DELIVERY_SETTINGS = {
  ...DEFAULT_DELIVERY_SETTINGS
};

let NEARBY_DISTRICTS = [
  "Gazipur",
  "Narayanganj",
  "Narsingdi",
  "Munshiganj",
  "Manikganj"
];

let selectedDistrict = "";
let selectedUpazila = "";

let locationData = [];
let locationLoaded = false;

let products = [];
let currentCategory = "All Products";

let cart = JSON.parse(
  localStorage.getItem("gbbd_cart") || "[]"
);

const $ = id =>
  document.getElementById(id);

const money = n =>
  "৳" + Number(n || 0).toLocaleString("en-BD");


/* =========================================================
   TOAST
========================================================= */

function showToast(message){

  let t = document.getElementById("gbToast");

  if(!t){

    t = document.createElement("div");

    t.id = "gbToast";
    t.className = "gb-toast";

    document.body.appendChild(t);
  }

  t.textContent = message;

  t.classList.add("show");

  clearTimeout(window.__gbToastTimer);

  window.__gbToastTimer = setTimeout(
    () => t.classList.remove("show"),
    1600
  );
}


/* =========================================================
   CART
========================================================= */

function saveCart(){

  localStorage.setItem(
    "gbbd_cart",
    JSON.stringify(cart)
  );

  updateCart();
}


/* =========================================================
   PRODUCTS
========================================================= */

function normalizeProduct(row){

  return {

    id: row.id,

    name:
      row.name ||
      row.product_name ||
      "Unnamed Product",

    cat:
      row.category ||
      row.cat ||
      "Other",

    price:
      Number(row.price || 0),

    discount:
      Number(row.discount || 0),

    stock:
      Number(
        row.stock ??
        row.stock_quantity ??
        0
      ),

    image:
      row.image ||
      row.image_url ||
      "",

    description:
      row.description || "",

    active:
      row.active !== false,

    featured:
      !!row.featured,

    emoji:
      row.emoji || "📦"
  };
}


async function loadProducts(){

  const { data, error } =
    await sb
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", {
        ascending: false
      });

  if(error)
    throw error;

  products =
    (data || [])
      .map(normalizeProduct);

  cart =
    cart.filter(item =>
      products.some(
        p =>
          String(p.id) ===
          String(item.id)
      )
    );

  localStorage.setItem(
    "gbbd_cart",
    JSON.stringify(cart)
  );
}


/* =========================================================
   STORE SETTINGS
========================================================= */

async function loadStoreData(){

  try{

    const [
      deliveryRes,
      paymentRes
    ] = await Promise.all([

      sb
        .from("delivery_settings")
        .select("*")
        .limit(1)
        .maybeSingle(),

      sb
        .from("payment_settings")
        .select("*")
        .limit(1)
        .maybeSingle()

    ]);


    if(deliveryRes.error)
      throw deliveryRes.error;

    if(paymentRes.error)
      throw paymentRes.error;


    /* DELIVERY */

    if(deliveryRes.data){

      const d =
        deliveryRes.data;

      DELIVERY_SETTINGS = {

        dhaka:
          Number(
            d.dhaka_charge ??
            DEFAULT_DELIVERY_SETTINGS.dhaka
          ),

        nearby:
          Number(
            d.nearby_charge ??
            DEFAULT_DELIVERY_SETTINGS.nearby
          ),

        outside:
          Number(
            d.outside_charge ??
            DEFAULT_DELIVERY_SETTINGS.outside
          )

      };

    }


    /* PAYMENT */

    if(paymentRes.data){

      const p =
        paymentRes.data;

      const codEnabled =
        p.cod_enabled !== false;

      const bkashEnabled =
        p.bkash_enabled === true;

      applyPaymentSettings(
        codEnabled,
        bkashEnabled
      );

    }

  }catch(err){

    console.error(
      "SETTINGS LOAD ERROR:",
      err
    );

  }
}


/* =========================================================
   REFRESH STORE
========================================================= */

async function refreshStore(){

  try{

    await Promise.all([
      loadProducts(),
      loadStoreData()
    ]);

    renderProducts();

    updateCart();

    setTimeout(
      setupLocationPickers,
      0
    );

  }catch(err){

    console.error(
      "Supabase load error:",
      err
    );

    showToast(
      "Products could not be loaded"
    );
  }
}


/* =========================================================
   CATEGORY
========================================================= */

function showAllProducts(){

  currentCategory =
    "All Products";

  renderProducts();

  const section =
    $("products");

  if(section){

    section.scrollIntoView({
      behavior: "smooth"
    });

  }
}


function filterCategory(cat){

  currentCategory = cat;

  renderProducts();

  const section =
    $("products");

  if(section){

    section.scrollIntoView({
      behavior: "smooth"
    });

  }
}


/* =========================================================
   PRODUCT FILTER
========================================================= */

function filteredProducts(){

  const search =
    $("searchInput");

  const sortBox =
    $("sortSelect");

  const q =
    search
      ? search.value
          .trim()
          .toLowerCase()
      : "";


  let list =
    products.filter(
      p =>
        currentCategory ===
          "All Products" ||
        p.cat ===
          currentCategory
    );


  if(q){

    list =
      list.filter(
        p =>
          (
            p.name +
            " " +
            p.cat
          )
            .toLowerCase()
            .includes(q)
      );

  }


  const sort =
    sortBox
      ? sortBox.value
      : "";


  if(sort === "low"){

    list.sort(
      (a,b) =>
        a.price - b.price
    );

  }


  if(sort === "high"){

    list.sort(
      (a,b) =>
        b.price - a.price
    );

  }


  if(sort === "featured"){

    list.sort(
      (a,b) =>
        Number(b.featured) -
        Number(a.featured)
    );

  }


  return list;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(v){

  return String(v ?? "")
    .replace(
      /[&<>"']/g,
      m => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
      }[m])
    );
}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts(){

  const grid =
    $("productsGrid");

  const title =
    $("sectionTitle");

  const count =
    $("productCount");


  if(!grid)
    return;


  const list =
    filteredProducts();


  if(title)
    title.textContent =
      currentCategory;


  if(count)
    count.textContent =
      `${list.length} products`;


  grid.innerHTML =
    list.map(p => {

      const soldOut =
        p.stock <= 0;

      const hasDiscount =
        p.discount > 0;


      const finalPrice =
        hasDiscount
          ? Math.max(
              0,
              p.price -
              (
                p.price *
                p.discount /
                100
              )
            )
          : p.price;


      const id =
        String(p.id)
          .replace(
            /'/g,
            "\\'"
          );


      return `

        <article class="product-card">

          <div class="product-img">

            ${
              p.image

              ? `
                <img
                  src="${p.image}"
                  alt="${escapeHtml(p.name)}"
                  loading="lazy"
                  style="
                    width:100%;
                    height:100%;
                    object-fit:contain;
                    border-radius:14px
                  "
                >
              `

              : p.emoji
            }

          </div>


          <div class="category">
            ${escapeHtml(p.cat)}
          </div>


          <h3>
            ${escapeHtml(p.name)}
          </h3>


          <div class="price">

            ${money(finalPrice)}

            ${
              hasDiscount

              ? `
                <del
                  style="
                    font-size:12px;
                    color:#7895af
                  "
                >
                  ${money(p.price)}
                </del>
              `

              : ""
            }

          </div>


          <div class="product-actions">

            <button
              class="add-btn"
              ${soldOut ? "disabled" : ""}
              onclick="addToCart('${id}')"
            >
              ${
                soldOut
                  ? "Out of Stock"
                  : "Add to Cart"
              }
            </button>


            <button
              class="buy-btn"
              ${soldOut ? "disabled" : ""}
              onclick="buyNow('${id}')"
            >
              ${
                soldOut
                  ? "Out of Stock"
                  : "Buy Now"
              }
            </button>

          </div>

        </article>

      `;

    }).join("")

    ||

    `
      <div
        class="empty"
        style="grid-column:1/-1"
      >
        No products found.
      </div>
    `;
}


/* =========================================================
   GET PRODUCT
========================================================= */

function getProduct(id){

  return products.find(
    p =>
      String(p.id) ===
      String(id)
  );
}


/* =========================================================
   ADD TO CART
========================================================= */

function addToCart(id){

  const p =
    getProduct(id);


  if(!p || p.stock <= 0){

    return showToast(
      "Out of stock"
    );

  }


  const item =
    cart.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if(item){

    if(item.qty >= p.stock){

      return showToast(
        "Stock limit reached"
      );

    }

    item.qty++;

  }else{

    cart.push({

      id: p.id,
      qty: 1

    });

  }


  saveCart();

  showToast(
    "Added to cart"
  );
}


/* =========================================================
   BUY NOW
========================================================= */

function buyNow(id){

  const p =
    getProduct(id);


  if(!p || p.stock <= 0){

    return showToast(
      "Out of stock"
    );

  }


  cart = [{

    id: p.id,
    qty: 1

  }];


  saveCart();

  openCheckout();
}


/* =========================================================
   QUANTITY
========================================================= */

function changeQty(id, delta){

  const item =
    cart.find(
      x =>
        String(x.id) ===
        String(id)
    );

  const p =
    getProduct(id);


  if(!item || !p)
    return;


  item.qty += delta;


  if(item.qty > p.stock)
    item.qty = p.stock;


  if(item.qty <= 0){

    cart =
      cart.filter(
        x =>
          String(x.id) !==
          String(id)
      );

  }


  saveCart();
}


/* =========================================================
   REMOVE
========================================================= */

function removeItem(id){

  cart =
    cart.filter(
      x =>
        String(x.id) !==
        String(id)
    );

  saveCart();
}


/* =========================================================
   DELIVERY
========================================================= */

function getDeliveryFee(){

  if(
    !cart.length ||
    !selectedDistrict
  ){

    return 0;

  }


  if(
    selectedDistrict ===
    "Dhaka"
  ){

    return DELIVERY_SETTINGS.dhaka;

  }


  if(
    NEARBY_DISTRICTS.includes(
      selectedDistrict
    )
  ){

    return DELIVERY_SETTINGS.nearby;

  }


  return DELIVERY_SETTINGS.outside;
}


/* =========================================================
   TOTALS
========================================================= */

function totals(){

  const subtotal =
    cart.reduce(
      (sum, item) => {

        const p =
          getProduct(item.id);

        if(!p)
          return sum;


        const finalPrice =
          p.discount > 0

            ? Math.max(
                0,
                p.price -
                (
                  p.price *
                  p.discount /
                  100
                )
              )

            : p.price;


        return (
          sum +
          finalPrice *
          item.qty
        );

      },
      0
    );


  const delivery =
    subtotal
      ? getDeliveryFee()
      : 0;


  return {

    subtotal,

    delivery,

    total:
      subtotal +
      delivery

  };
}


/* =========================================================
   DELIVERY INFO
========================================================= */

function updateDeliveryInfo(){

  const box =
    $("deliveryInfo");


  if(!box)
    return;


  if(!selectedDistrict){

    box.textContent =
      "Select your district to calculate delivery charge.";

    updateCart();

    return;

  }


  const fee =
    getDeliveryFee();


  const zone =
    selectedDistrict ===
      "Dhaka"

      ? "Dhaka"

      : (
          NEARBY_DISTRICTS.includes(
            selectedDistrict
          )

          ? "Nearby Dhaka"

          : "Outside Dhaka"
        );


  box.textContent =
    `Delivery: ${money(fee)} • ${zone}`;


  updateCart();
}


/* =========================================================
   UPDATE CART
========================================================= */

function updateCart(){

  const count =
    $("cartCount");


  if(count){

    count.textContent =
      cart.reduce(
        (sum,item) =>
          sum + item.qty,
        0
      );

  }


  const t =
    totals();


  if($("cartSubtotal"))
    $("cartSubtotal").textContent =
      money(t.subtotal);


  if($("cartDelivery"))
    $("cartDelivery").textContent =
      money(t.delivery);


  if($("cartTotal"))
    $("cartTotal").textContent =
      money(t.total);


  if($("checkoutTotal"))
    $("checkoutTotal").textContent =
      money(t.total);


  if($("checkoutBtn"))
    $("checkoutBtn").disabled =
      !cart.length;


  const cartItems =
    $("cartItems");


  if(!cartItems)
    return;


  cartItems.innerHTML =
    cart.length

      ? cart.map(item => {

          const p =
            getProduct(item.id);

          if(!p)
            return "";


          const finalPrice =
            p.discount > 0

              ? Math.max(
                  0,
                  p.price -
                  (
                    p.price *
                    p.discount /
                    100
                  )
                )

              : p.price;


          const id =
            String(p.id)
              .replace(
                /'/g,
                "\\'"
              );


          return `

            <div class="cart-row">

              <div class="mini-img">

                ${
                  p.image

                    ? `
                      <img
                        src="${p.image}"
                        alt=""
                        style="
                          width:100%;
                          height:100%;
                          object-fit:contain;
                          border-radius:10px
                        "
                      >
                    `

                    : p.emoji
                }

              </div>


              <div>

                <h4>
                  ${escapeHtml(p.name)}
                </h4>


                <small>
                  ${money(finalPrice)} each
                </small>


                <div class="qty">

                  <button
                    onclick="changeQty('${id}',-1)"
                  >
                    −
                  </button>


                  <b>
                    ${item.qty}
                  </b>


                  <button
                    onclick="changeQty('${id}',1)"
                  >
                    +
                  </button>


                  <button
                    class="remove"
                    onclick="removeItem('${id}')"
                  >
                    Remove
                  </button>

                </div>

              </div>


              <strong>
                ${money(
                  finalPrice *
                  item.qty
                )}
              </strong>

            </div>

          `;

        }).join("")

      : `

          <div class="empty">
            Your cart is empty.
          </div>

        `;
}


/* =========================================================
   LOCATIONS
========================================================= */

async function loadLocations(){

  if(locationLoaded)
    return;


  const url =
    "https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json";


  try{

    const res =
      await fetch(
        url,
        {
          cache:
            "force-cache"
        }
      );


    if(!res.ok)
      throw new Error(
        "Location data unavailable"
      );


    locationData =
      await res.json();


    locationLoaded =
      true;


  }catch(err){

    console.warn(
      "Location data could not be loaded:",
      err
    );


    locationData = [

      {
        bn_name: "ঢাকা",
        name: "Dhaka",
        districts: []
      },

      {
        bn_name: "কুষ্টিয়া",
        name: "Kushtia",
        districts: []
      },

      {
        bn_name: "চট্টগ্রাম",
        name: "Chattogram",
        districts: []
      },

      {
        bn_name: "খুলনা",
        name: "Khulna",
        districts: []
      },

      {
        bn_name: "বরিশাল",
        name: "Barishal",
        districts: []
      },

      {
        bn_name: "রাজশাহী",
        name: "Rajshahi",
        districts: []
      },

      {
        bn_name: "সিলেট",
        name: "Sylhet",
        districts: []
      },

      {
        bn_name: "রংপুর",
        name: "Rangpur",
        districts: []
      },

      {
        bn_name: "ময়মনসিংহ",
        name: "Mymensingh",
        districts: []
      }

    ];

  }
}


function allDistricts(){

  const out = [];


  for(
    const div
    of locationData
  ){

    for(
      const d
      of (
        div.districts || []
      )
    ){

      out.push({

        name: d.name,

        bn: d.bn_name,

        upazilas:
          d.upazilas || []

      });

    }

  }


  return out;
}


function districtMatches(q){

  const term =
    q
      .trim()
      .toLowerCase();


  return allDistricts()
    .filter(
      d =>
        !term ||
        `${d.name} ${d.bn}`
          .toLowerCase()
          .includes(term)
    )
    .slice(0,15);
}


function upazilaMatches(q){

  const d =
    allDistricts().find(
      x =>
        x.name ===
          selectedDistrict ||
        x.bn ===
          selectedDistrict
    );


  if(!d)
    return [];


  const term =
    q
      .trim()
      .toLowerCase();


  return (
    d.upazilas || []
  )
    .filter(
      u =>
        `${u.name} ${
          u.bn_name ||
          u.bn ||
          ""
        }`
          .toLowerCase()
          .includes(term)
    )
    .slice(0,20);
}


function renderSuggestions(
  el,
  items,
  type
){

  if(!el)
    return;


  if(!items.length){

    el.innerHTML = "";

    el.classList.add(
      "hidden"
    );

    return;

  }


  el.innerHTML =
    items.map(
      x => `

        <button
          type="button"
          class="suggestion"
        >

          ${x.bn_name ||
            x.bn ||
            x.name}

          <small>
            ${x.name}
          </small>

        </button>

      `
    ).join("");


  el.classList.remove(
    "hidden"
  );


  el
    .querySelectorAll(
      ".suggestion"
    )
    .forEach(
      (button,index) => {

        button.onclick = () => {

          const x =
            items[index];


          if(
            type ===
            "district"
          ){

            selectedDistrict =
              x.name;

            selectedUpazila =
              "";


            $("districtInput")
              .value =
                x.bn_name ||
                x.bn ||
                x.name;


            $("districtSuggestions")
              .classList.add(
                "hidden"
              );


            const u =
              $("upazilaInput");


            u.disabled = false;

            u.value = "";

            u.placeholder =
              "Type/select upazila...";


            updateDeliveryInfo();


          }else{

            selectedUpazila =
              x.name;


            $("upazilaInput")
              .value =
                x.bn_name ||
                x.bn ||
                x.name;


            $("upazilaSuggestions")
              .classList.add(
                "hidden"
              );

          }

        };

      }
    );
}


async function setupLocationPickers(){

  await loadLocations();


  const di =
    $("districtInput");

  const ui =
    $("upazilaInput");


  if(!di || !ui)
    return;


  if(di.dataset.ready === "1")
    return;


  di.dataset.ready = "1";


  di.addEventListener(
    "focus",
    () => {

      renderSuggestions(
        $("districtSuggestions"),
        districtMatches(
          di.value
        ),
        "district"
      );

    }
  );


  di.addEventListener(
    "input",
    () => {

      selectedDistrict = "";

      selectedUpazila = "";


      ui.value = "";

      ui.disabled = true;


      updateDeliveryInfo();


      renderSuggestions(
        $("districtSuggestions"),
        districtMatches(
          di.value
        ),
        "district"
      );

    }
  );


  ui.addEventListener(
    "focus",
    () => {

      renderSuggestions(
        $("upazilaSuggestions"),
        upazilaMatches(
          ui.value
        ),
        "upazila"
      );

    }
  );


  ui.addEventListener(
    "input",
    () => {

      renderSuggestions(
        $("upazilaSuggestions"),
        upazilaMatches(
          ui.value
        ),
        "upazila"
      );

    }
  );


  document.addEventListener(
    "click",
    e => {

      if(
        !e.target.closest(
          ".search-select"
        )
      ){

        $("districtSuggestions")
          ?.classList.add(
            "hidden"
          );

        $("upazilaSuggestions")
          ?.classList.add(
            "hidden"
          );

      }

    }
  );
}


/* =========================================================
   MENU / CART / CHECKOUT
========================================================= */

function openMenu(){

  const menu =
    $("sideMenu");

  const overlay =
    $("overlay");


  if(menu)
    menu.classList.add(
      "open"
    );


  if(overlay)
    overlay.classList.remove(
      "hidden"
    );
}


function closeMenu(){

  const menu =
    $("sideMenu");

  const overlay =
    $("overlay");

  const cartDrawer =
    $("cartDrawer");


  if(menu)
    menu.classList.remove(
      "open"
    );


  if(
    overlay &&
    (
      !cartDrawer ||
      !cartDrawer.classList.contains(
        "open"
      )
    )
  ){

    overlay.classList.add(
      "hidden"
    );

  }
}


function openCart(){

  const cartDrawer =
    $("cartDrawer");

  const overlay =
    $("overlay");


  if(cartDrawer)
    cartDrawer.classList.add(
      "open"
    );


  if(overlay)
    overlay.classList.remove(
      "hidden"
    );


  updateCart();
}


function closeCart(){

  const cartDrawer =
    $("cartDrawer");

  const overlay =
    $("overlay");

  const menu =
    $("sideMenu");


  if(cartDrawer)
    cartDrawer.classList.remove(
      "open"
    );


  if(
    overlay &&
    (
      !menu ||
      !menu.classList.contains(
        "open"
      )
    )
  ){

    overlay.classList.add(
      "hidden"
    );

  }
}


function openCheckout(){

  if(!cart.length)
    return;


  closeCart();


  const modal =
    $("checkoutModal");


  if(modal)
    modal.classList.remove(
      "hidden"
    );


  updateCart();
}


function closeCheckout(){

  const modal =
    $("checkoutModal");


  if(modal)
    modal.classList.add(
      "hidden"
    );
}


function closeSuccess(){

  const modal =
    $("successModal");


  if(modal)
    modal.classList.add(
      "hidden"
    );
}


/* =========================================================
   SUPABASE ORDER SAVE
   IMPORTANT:
   Saves total + customer address data.
========================================================= */

async function submitOrderToSupabase(order){

  const row = {

    order_number:
      order.orderId,

    customer_name:
      order.customer.name,

    phone:
      order.customer.phone,

    district:
      order.customer.district,

    upazila:
      order.customer.area,

    address:
      order.customer.address,

    note:
      order.note || null,

    items:
      order.items,

    subtotal:
      Number(
        order.subtotal
      ) || 0,

    delivery_charge:
      Number(
        order.delivery
      ) || 0,

    total:
      Number(
        order.total
      ) || 0,

    payment_method:
      order.paymentMethod ||
      "Cash on Delivery",

    transaction_id:
      order.transactionId ||
      null,

    status:
      "Pending"

  };


  const {
    data,
    error
  } =
    await sb
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


/* =========================================================
   ORDER ID
========================================================= */

function makeOrderId(){

  return (
    "GBBD-" +
    Date.now()
      .toString()
      .slice(-8)
  );
}


/* =========================================================
   PAYMENT SETTINGS
========================================================= */

function applyPaymentSettings(
  codEnabled,
  bkashEnabled
){

  const radios =
    document.querySelectorAll(
      'input[name="payment"]'
    );


  radios.forEach(
    radio => {

      const value =
        String(
          radio.value || ""
        )
          .trim()
          .toLowerCase();


      let enabled = false;


      if(
        value ===
          "cash on delivery" ||
        value === "cod"
      ){

        enabled =
          codEnabled;

      }

      /*
        bKash enabled from Admin.
        Nagad remains available because
        Admin panel currently has no
        Nagad ON/OFF setting.
      */

      else if(
        value === "bkash" ||
        value === "b-kash" ||
        value === "bkash (manual)"
      ){

        enabled =
          bkashEnabled;

      }

      else if(
        value === "nagad" ||
        value === "nagad (manual)"
      ){

        enabled = true;

      }


      radio.disabled =
        !enabled;


      const label =
        radio.closest("label") ||
        radio.parentElement;


      if(label){

        label.style.display =
          enabled
            ? ""
            : "none";

      }

    }
  );


  const checked =
    document.querySelector(
      'input[name="payment"]:checked'
    );


  if(
    !checked ||
    checked.disabled
  ){

    const firstEnabled =
      [...radios].find(
        r =>
          !r.disabled
      );


    if(firstEnabled){

      firstEnabled.checked =
        true;


      firstEnabled.dispatchEvent(
        new Event("change")
      );

    }

  }


  const enabledCount =
    [...radios]
      .filter(
        r =>
          !r.disabled
      )
      .length;


  const checkoutBtn =
    $("checkoutBtn");


  if(checkoutBtn){

    checkoutBtn.disabled =
      !cart.length ||
      enabledCount === 0;

  }
}


/* =========================================================
   PAYMENT CHECK
========================================================= */

function isPaymentMethodEnabled(
  method
){

  const radios =
    document.querySelectorAll(
      'input[name="payment"]'
    );


  const target =
    String(
      method || ""
    )
      .trim()
      .toLowerCase();


  const radio =
    [...radios].find(
      r =>
        String(
          r.value || ""
        )
          .trim()
          .toLowerCase() ===
        target
    );


  return !!radio &&
    !radio.disabled;
}


/* =========================================================
   CUSTOMER UI INITIALIZATION
========================================================= */

function initCustomerUI(){

  const menuBtn =
    $("menuBtn");

  const cartBtn =
    $("cartBtn");

  const overlay =
    $("overlay");

  const searchInput =
    $("searchInput");

  const sortSelect =
    $("sortSelect");

  const checkoutBtn =
    $("checkoutBtn");

  const checkoutForm =
    $("checkoutForm");


  if(menuBtn){

    menuBtn.onclick =
      openMenu;

  }


  if(cartBtn){

    cartBtn.onclick =
      openCart;

  }


  if(overlay){

    overlay.onclick = () => {

      closeMenu();
      closeCart();

    };

  }


  document
    .querySelectorAll(
      '[data-close="menu"]'
    )
    .forEach(
      button =>
        button.onclick =
          closeMenu
    );


  document
    .querySelectorAll(
      '[data-close="cart"]'
    )
    .forEach(
      button =>
        button.onclick =
          closeCart
    );


  document
    .querySelectorAll(
      '[data-close="checkout"]'
    )
    .forEach(
      button =>
        button.onclick =
          closeCheckout
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
    .querySelectorAll(
      'input[name="payment"]'
    )
    .forEach(
      radio => {

        radio.addEventListener(
          "change",
          () => {

            const manual =
              radio.value !==
              "Cash on Delivery";


            const transactionBox =
              $("transactionBox");


            if(transactionBox){

              transactionBox.classList.toggle(
                "hidden",
                !manual
              );

            }

          }
        );

      }
    );


  if(checkoutBtn){

    checkoutBtn.onclick =
      openCheckout;

  }


  if(checkoutForm){

    checkoutForm.addEventListener(
      "submit",
      async e => {

        e.preventDefault();


        if(!cart.length)
          return;


        const form =
          new FormData(
            e.target
          );


        const payment =
          String(
            form.get("payment") || ""
          );


        const transactionId =
          String(
            form.get(
              "transactionId"
            ) || ""
          ).trim();


        /* PAYMENT VALIDATION */

        if(
          payment !==
            "Cash on Delivery" &&
          !transactionId
        ){

          alert(
            "Please enter the transaction ID for the selected payment method."
          );

          return;

        }


        /* LOCATION VALIDATION */

        if(
          !selectedDistrict ||
          !selectedUpazila
        ){

          alert(
            "Please select a district and upazila from the suggestions."
          );

          return;

        }


        const t =
          totals();


        /* CREATE ORDER */

        const order = {

          orderId:
            makeOrderId(),


          createdAt:
            new Date()
              .toISOString(),


          customer: {

            name:
              String(
                form.get("name") ||
                ""
              ).trim(),

            phone:
              String(
                form.get("phone") ||
                ""
              ).trim(),

            district:
              selectedDistrict,

            area:
              selectedUpazila,

            address:
              String(
                form.get("address") ||
                ""
              ).trim()

          },


          paymentMethod:
            payment,


          transactionId:


            transactionId,


          note:
            String(
              form.get("note") ||
              ""
            ).trim(),


          items:
            cart.map(
              item => {

                const p =
                  getProduct(
                    item.id
                  );


                const price =
                  p.discount > 0

                    ? Math.max(
                        0,
                        p.price -
                        (
                          p.price *
                          p.discount /
                          100
                        )
                      )

                    : p.price;


                return {

                  id:
                    p.id,

                  name:
                    p.name,

                  price:
                    price,

                  qty:
                    item.qty

                };

              }
            ),


          subtotal:
            t.subtotal,


          delivery:
            t.delivery,


          total:
            t.total

        };


        /* SAVE TO SUPABASE */

        try{

          await submitOrderToSupabase(
            order
          );

        }catch(err){

          console.error(
            "ORDER ERROR:",
            err
          );


          alert(
            "ORDER ERROR\n\n" +
            "Message: " +
            (
              err.message ||
              "Unknown"
            ) +
            "\n" +
            "Code: " +
            (
              err.code ||
              "N/A"
            ) +
            "\n" +
            "Details: " +
            (
              err.details ||
              "N/A"
            ) +
            "\n" +
            "Hint: " +
            (
              err.hint ||
              "N/A"
            )
          );


          return;

        }


        /* LOCAL BACKUP */

        localStorage.setItem(
          "gbbd_last_order",
          JSON.stringify(order)
        );


        const orders =
          JSON.parse(
            localStorage.getItem(
              "gbbd_orders"
            ) || "[]"
          );


        orders.unshift(
          order
        );


        localStorage.setItem(
          "gbbd_orders",
          JSON.stringify(
            orders
          )
        );


        /* CLEAR CART */

        cart = [];


        saveCart();


        /* RESET FORM */

        e.target.reset();


        selectedDistrict = "";

        selectedUpazila = "";


        const upazilaInput =
          $("upazilaInput");


        if(upazilaInput){

          upazilaInput.disabled =
            true;

          upazilaInput.placeholder =
            "Select district first...";

        }


        updateDeliveryInfo();


        const transactionBox =
          $("transactionBox");


        if(transactionBox){

          transactionBox.classList.add(
            "hidden"
          );

        }


        closeCheckout();


        /* SUCCESS */

        if(
          $("successOrderId")
        ){

          $("successOrderId")
            .textContent =
              order.orderId;

        }


        if(
          $("successModal")
        ){

          $("successModal")
            .classList.remove(
              "hidden"
            );

        }

      }
    );

  }
}


/* =========================================================
   START
========================================================= */

async function startCustomerSite(){

  initCustomerUI();

  renderProducts();

  updateCart();

  await refreshStore();

  setupLocationPickers();
}


if(
  document.readyState ===
  "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    startCustomerSite
  );

}else{

  startCustomerSite();

}


/* =========================================================
   AUTO REFRESH PRODUCTS
========================================================= */

setInterval(
  refreshStore,
  60000
);


/* =========================================================
   PHONE ORDER TRACKING
========================================================= */

async function trackOrdersByPhone(){

  const phoneInput =
    document.getElementById(
      "trackPhone"
    );


  const resultBox =
    document.getElementById(
      "trackingResult"
    );


  const trackBtn =
    document.getElementById(
      "trackOrderBtn"
    );


  if(
    !phoneInput ||
    !resultBox
  ){

    return;

  }


  const phone =
    phoneInput.value.trim();


  if(!phone){

    resultBox.classList.remove(
      "hidden"
    );


    resultBox.innerHTML = `

      <div class="tracking-error">

        Please enter your phone number.

      </div>

    `;


    return;

  }


  if(trackBtn){

    trackBtn.disabled =
      true;

    trackBtn.textContent =
      "Searching...";

  }


  resultBox.classList.remove(
    "hidden"
  );


  resultBox.innerHTML = `

    <div class="tracking-loading">

      Searching your orders...

    </div>

  `;


  try{

    const {
      data,
      error
    } =
      await sb.rpc(
        "track_orders_by_phone",
        {
          p_phone: phone
        }
      );


    if(error){

      console.error(
        "TRACKING ERROR:",
        error
      );

      throw error;

    }


    if(
      !data ||
      data.length === 0
    ){

      resultBox.innerHTML = `

        <div class="tracking-empty">

          <strong>
            No orders found
          </strong>

          <p>
            No order was found for this phone number.
          </p>

        </div>

      `;

      return;

    }


    resultBox.innerHTML = `

      <div class="tracking-count">

        ${data.length}

        order${
          data.length > 1
            ? "s"
            : ""
        }

        found

      </div>


      ${
        data.map(
          order => {

            const items =
              Array.isArray(
                order.items
              )
                ? order.items
                : [];


            const productList =
              items.length

                ? items
                    .map(
                      item => {

                        const name =
                          item.name ||
                          item.product_name ||
                          item.title ||
                          "Product";


                        const qty =
                          Number(
                            item.quantity ??
                            item.qty ??
                            1
                          );


                        return `

                          <div
                            class="tracking-product"
                          >

                            <span>
                              ${escapeHtml(
                                name
                              )}
                            </span>


                            <strong>
                              ×${qty}
                            </strong>

                          </div>

                        `;

                      }
                    )
                    .join("")

                : `

                    <div
                      class="tracking-product"
                    >
                      Product details unavailable
                    </div>

                  `;


            const status =
              String(
                order.status ||
                "Pending"
              );


            const statusClass =
              status
                .toLowerCase()
                .replace(
                  /\s+/g,
                  "-"
                );


            const date =
              order.created_at

                ? new Date(
                    order.created_at
                  ).toLocaleDateString()

                : "";


            const total =
              Number(
                order.total || 0
              );


            return `

              <div
                class="tracking-order"
              >

                <div
                  class="tracking-order-head"
                >

                  <div>

                    <small>
                      Order ID
                    </small>


                    <strong>
                      ${escapeHtml(
                        order.order_number ||
                        ""
                      )}
                    </strong>

                  </div>


                  <span
                    class="tracking-status ${statusClass}"
                  >
                    ${escapeHtml(
                      status
                    )}
                  </span>

                </div>


                <div
                  class="tracking-products"
                >

                  ${productList}

                </div>


                <div
                  class="tracking-order-bottom"
                >

                  <span>
                    📅
                    ${escapeHtml(
                      date
                    )}
                  </span>


                  <strong>
                    ${money(total)}
                  </strong>

                </div>

              </div>

            `;

          }
        ).join("")
      }

    `;


  }catch(error){

    console.error(
      error
    );


    resultBox.innerHTML = `

      <div class="tracking-error">

        <strong>
          Something went wrong.
        </strong>

        <p>
          Please try again.
        </p>

      </div>

    `;

  }finally{

    if(trackBtn){

      trackBtn.disabled =
        false;

      trackBtn.textContent =
        "Track Orders";

    }

  }
}


/* =========================================================
   TRACKING BUTTON
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const btn =
      document.getElementById(
        "trackOrderBtn"
      );


    if(btn){

      btn.addEventListener(
        "click",
        trackOrdersByPhone
      );

    }

  }
);
