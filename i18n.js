/* Gadget Bazar BD - Bangla / English switch.
   Default = Bangla. The English text stays in the page source; this file swaps it at display time
   (and swaps back when the customer picks English). Product / category names are never touched. */
(function(){
"use strict";
var KEY="gbbd_lang";
var D={
"Categories":"ক্যাটাগরি","Featured":"ফিচার্ড","Shop":"শপ","Deals":"অফার","Policies":"নীতিমালা","Track":"ট্র্যাক","Checkout":"চেকআউট",
"All Products":"সব পণ্য","Your shopping":"আপনার কেনাকাটা","My Wishlist":"আমার উইশলিস্ট","Compare Products":"পণ্য তুলনা","Deals & Offers":"ডিল ও অফার",
"Add to Home Screen":"হোম স্ক্রিনে যোগ করুন","Shop by category":"ক্যাটাগরি অনুযায়ী কিনুন","Shop by Category":"ক্যাটাগরি অনুযায়ী কিনুন",
"SMART • MODERN • AFFORDABLE":"স্মার্ট • আধুনিক • সাশ্রয়ী","Upgrade Your":"আপগ্রেড করুন আপনার","Everyday":"প্রতিদিন",
"Electronics, mobile accessories, RGB lighting & home gadgets.":"ইলেকট্রনিক্স, মোবাইল এক্সেসরিজ, RGB লাইটিং ও হোম গ্যাজেট।",
"Shop Now":"এখনই কিনুন","Wishlist":"উইশলিস্ট","Compare":"তুলনা","Flash Sale":"ফ্ল্যাশ সেল","New Arrivals":"নতুন পণ্য","Best Sellers":"সেরা বিক্রি",
"FIND YOUR NEXT FAVOURITE":"পছন্দের পণ্য খুঁজে নিন","Explore gadgets picked for your everyday life.":"প্রতিদিনের জীবনের জন্য বাছাই করা গ্যাজেট দেখুন।",
"View all products":"সব পণ্য দেখুন","Explore collection":"কালেকশন দেখুন","HANDPICKED FOR YOU":"আপনার জন্য বাছাই করা","Featured Products":"ফিচার্ড পণ্য",
"Discover standout gadgets from our collection.":"আমাদের কালেকশনের সেরা গ্যাজেটগুলো দেখুন।","Explore shop":"শপ দেখুন","Columns":"কলাম",
"View Details":"বিস্তারিত দেখুন","Add to Cart":"কার্টে যোগ করুন","Buy Now":"এখনই কিনুন","Out of Stock":"স্টক শেষ","Out of stock":"স্টক শেষ",
"JUST ADDED TO THE STORE":"স্টোরে নতুন যোগ হয়েছে","Recently added gadgets, ready to explore.":"নতুন যোগ হওয়া গ্যাজেট, দেখে নিন।","View all":"সব দেখুন",
"STORE FAVOURITES":"স্টোরের পছন্দের পণ্য","Best Sellers & Top Picks":"সেরা বিক্রি ও টপ পিক","Featured products and available favourites selected for easy discovery.":"সহজে খুঁজে পেতে বাছাই করা ফিচার্ড ও জনপ্রিয় পণ্য।",
"Browse collection":"কালেকশন দেখুন","Price: Low to High":"দাম: কম থেকে বেশি","Price: High to Low":"দাম: বেশি থেকে কম","Featured ":"ফিচার্ড",
"YOUR SAVED ITEMS":"আপনার সংরক্ষিত পণ্য","Keep products you like in one place.":"পছন্দের পণ্য এক জায়গায় রাখুন।","Show differences only":"শুধু পার্থক্য দেখান",
"Compare up to 3 products":"সর্বোচ্চ ৩টি পণ্য তুলনা করা যায়","View":"দেখুন","LIMITED-TIME SAVINGS":"সীমিত সময়ের সাশ্রয়",
"Pick an offer type, or browse everything below.":"অফারের ধরন বেছে নিন, অথবা নিচের সব দেখুন।","No offers right now. Please check back soon.":"এখন কোনো অফার নেই। একটু পরে আবার দেখুন।",
"Combos, flash sales and discounted gadgets, while stock lasts.":"কম্বো, ফ্ল্যাশ সেল ও ছাড়ের গ্যাজেট — স্টক থাকা পর্যন্ত।","View all deals":"সব অফার দেখুন",
"Discounted products":"ছাড়ের পণ্য","Nationwide Delivery":"সারাদেশে ডেলিভারি","Dhaka within 24 hours · Outside Dhaka about 3 days":"ঢাকায় ২৪ ঘণ্টার মধ্যে · ঢাকার বাইরে প্রায় ৩ দিন",
"Easy Checkout":"সহজ চেকআউট","Simple and secure order flow":"সহজ ও নিরাপদ অর্ডার প্রক্রিয়া","Order Tracking":"অর্ডার ট্র্যাকিং","Check updates with your phone":"ফোন নম্বর দিয়ে আপডেট দেখুন",
"Warranty & Returns":"ওয়ারেন্টি ও রিটার্ন","Read our policies":"আমাদের নীতিমালা পড়ুন","Track Your Orders":"আপনার অর্ডার ট্র্যাক করুন","Track Your Order":"আপনার অর্ডার ট্র্যাক করুন",
"Enter your phone number to see all your orders.":"আপনার সব অর্ডার দেখতে ফোন নম্বর দিন।","Track Orders":"অর্ডার ট্র্যাক করুন","ABOUT US":"আমাদের সম্পর্কে","About Us":"আমাদের সম্পর্কে",
"Gadget Bazar BD is an online gadget store for Bangladesh. We sell audio products, wearables, power and charging accessories, mobile accessories, RGB lighting, home gadgets and gaming gear, and deliver across the country.":"গ্যাজেট বাজার বিডি বাংলাদেশের একটি অনলাইন গ্যাজেট স্টোর। আমরা অডিও পণ্য, ওয়্যারেবল, পাওয়ার ও চার্জিং এক্সেসরিজ, মোবাইল এক্সেসরিজ, RGB লাইটিং, হোম গ্যাজেট ও গেমিং গিয়ার বিক্রি করি এবং সারাদেশে ডেলিভারি দিই।",
"SHOP WITH CONFIDENCE":"নিশ্চিন্তে কিনুন","Our Policies":"আমাদের নীতিমালা","GET IN TOUCH":"যোগাযোগ করুন","Contact Us":"যোগাযোগ","WhatsApp":"হোয়াটসঅ্যাপ",
"Your Cart":"আপনার কার্ট","Your cart is empty.":"আপনার কার্ট খালি।","Subtotal":"সাবটোটাল","Delivery":"ডেলিভারি","Total":"মোট",
"Customer & payment information":"গ্রাহকের তথ্য ও পেমেন্ট","Customer Information":"গ্রাহকের তথ্য","Full Name *":"পূর্ণ নাম *","Phone Number *":"ফোন নম্বর *",
"District *":"জেলা *","Area / Upazila *":"এলাকা / উপজেলা *","Select your district to calculate delivery charge.":"ডেলিভারি চার্জ জানতে আপনার জেলা বেছে নিন।",
"Full Address *":"পূর্ণ ঠিকানা *","Order Note (optional)":"অর্ডার নোট (ঐচ্ছিক)","Coupon code":"কুপন কোড","Apply":"প্রয়োগ করুন","Enter a code and tap Apply.":"কোড লিখে “প্রয়োগ করুন” চাপুন।",
"Coupon discount":"কুপন ছাড়","Payment Method":"পেমেন্ট পদ্ধতি","Cash on Delivery":"ক্যাশ অন ডেলিভারি","Pay when your order arrives.":"অর্ডার হাতে পেয়ে টাকা দিন।",
"bKash":"বিকাশ","Nagad":"নগদ","Send the amount to the number shown, then add the transaction ID below.":"দেখানো নম্বরে টাকা পাঠিয়ে নিচে ট্রানজেকশন আইডি দিন।",
"Transaction ID":"ট্রানজেকশন আইডি","Send the full payable amount to the number shown above, then enter the Transaction ID here. We never ask for your PIN, OTP or CVV.":"উপরে দেখানো নম্বরে সম্পূর্ণ টাকা পাঠিয়ে এখানে ট্রানজেকশন আইডি দিন। আমরা কখনোই আপনার PIN, OTP বা CVV চাই না।",
"Payable Total":"সর্বমোট প্রদেয়","Place Order":"অর্ডার করুন","Order Placed!":"অর্ডার সম্পন্ন!","Your order has been saved successfully.":"আপনার অর্ডার সফলভাবে সংরক্ষিত হয়েছে।",
"Order ID":"অর্ডার আইডি","Keep your Order ID for future reference. You can track it with your phone number.":"ভবিষ্যতের জন্য অর্ডার আইডি রেখে দিন। ফোন নম্বর দিয়েও ট্র্যাক করতে পারবেন।",
"Send order details on WhatsApp":"হোয়াটসঅ্যাপে অর্ডারের বিবরণ পাঠান","Your order is already saved. WhatsApp is optional and helps us confirm faster.":"আপনার অর্ডার আগেই সংরক্ষিত হয়েছে। হোয়াটসঅ্যাপ ঐচ্ছিক, তবে দ্রুত কনফার্ম করতে সাহায্য করে।",
"Continue Shopping":"কেনাকাটা চালিয়ে যান","OK":"ঠিক আছে","Home":"হোম","Cart":"কার্ট",
"Smart gadgets for everyday life. Browse the collection and choose the products that work for you.":"প্রতিদিনের জীবনের জন্য স্মার্ট গ্যাজেট। কালেকশন ঘুরে দেখুন এবং পছন্দের পণ্য বেছে নিন।",
"Made for gadget lovers in Bangladesh":"বাংলাদেশের গ্যাজেটপ্রেমীদের জন্য","Quick Links":"দ্রুত লিংক","Customer Service":"কাস্টমার সার্ভিস",
"Nationwide delivery":"সারাদেশে ডেলিভারি","Secure order form":"নিরাপদ অর্ডার ফর্ম","Order tracking":"অর্ডার ট্র্যাকিং","COD & mobile payment":"ক্যাশ অন ডেলিভারি ও মোবাইল পেমেন্ট",
"© 2026 Gadget Bazar BD. Prices and availability may change.":"© ২০২৬ গ্যাজেট বাজার বিডি। দাম ও স্টক পরিবর্তন হতে পারে।",
"Remove":"সরান","Added to cart":"কার্টে যোগ হয়েছে","Product details":"পণ্যের বিবরণ","Warranty":"ওয়ারেন্টি","Description":"বিবরণ","Full Product Page ↗":"পূর্ণ পণ্য পেজ ↗",
"Saved gadgets, ready when you are.":"সংরক্ষিত গ্যাজেট, যখন খুশি দেখুন।","Your Wishlist is empty":"আপনার উইশলিস্ট খালি","Tap the heart/Wishlist button on any gadget to save it here.":"যেকোনো পণ্যে হার্ট/উইশলিস্ট বাটন চাপলে এখানে জমা হবে।",
"Explore Products":"পণ্য দেখুন","MAKE THE RIGHT CHOICE":"সঠিক সিদ্ধান্ত নিন","Compare price, availability and the product details we have.":"দাম, স্টক ও পণ্যের তথ্য তুলনা করুন।",
"No products to compare yet":"তুলনার জন্য এখনো কোনো পণ্য নেই","Choose up to 3 products from the catalogue and tap Compare.":"ক্যাটালগ থেকে সর্বোচ্চ ৩টি পণ্য বেছে “তুলনা” চাপুন।",
"Tap the ⋮ menu at the top-right of Chrome.":"Chrome-এর উপরে ডানদিকের ⋮ মেনুতে চাপ দিন।","Tap “Add to Home screen” (or “Install app”).":"“Add to Home screen” (বা “Install app”) চাপ দিন।",
"Tap “Add”. The Gadget Bazar BD icon will appear on your phone.":"“Add” চাপ দিন। আপনার ফোনে গ্যাজেট বাজার বিডি-র আইকন চলে আসবে।",
"Tap the Share button at the bottom of Safari.":"Safari-র নিচের Share বাটনে চাপ দিন।","Scroll down and tap “Add to Home Screen”.":"নিচে স্ক্রল করে “Add to Home Screen” চাপ দিন।",
"Already installed":"আগেই ইনস্টল করা আছে","Installed!":"ইনস্টল হয়েছে!",
/* attributes */
"Main navigation":"প্রধান মেনু","Open menu":"মেনু খুলুন","Open cart":"কার্ট খুলুন","Go to checkout":"চেকআউটে যান","Back":"পেছনে","Search products":"পণ্য খুঁজুন",
"Search earbuds, charger, smartwatch...":"ইয়ারবাড, চার্জার, স্মার্টওয়াচ খুঁজুন...","Clear search":"সার্চ মুছুন","Flash sale":"ফ্ল্যাশ সেল","Quick shop":"দ্রুত কেনাকাটা","Products per row":"প্রতি সারিতে পণ্য",
"1 column":"১ কলাম","2 columns":"২ কলাম","3 columns":"৩ কলাম","4 columns":"৪ কলাম","5 columns":"৫ কলাম","Add to Wishlist":"উইশলিস্টে যোগ করুন","Add to Compare":"তুলনায় যোগ করুন",
"Remove from Wishlist":"উইশলিস্ট থেকে সরান","Remove from Compare":"তুলনা থেকে সরান","Search gadgets...":"গ্যাজেট খুঁজুন...","Sort products":"পণ্য সাজান","Close":"বন্ধ করুন","Close details":"বিস্তারিত বন্ধ করুন",
"Close deals":"অফার বন্ধ করুন","Enter phone number":"ফোন নম্বর লিখুন","Your full name":"আপনার পূর্ণ নাম","Type district name...":"জেলার নাম লিখুন...","Select district first...":"আগে জেলা বেছে নিন...",
"House, road, village / detailed address":"বাড়ি, রাস্তা, গ্রাম / বিস্তারিত ঠিকানা","Any delivery note":"ডেলিভারির কোনো নোট","Enter coupon code":"কুপন কোড লিখুন","Enter transaction ID":"ট্রানজেকশন আইডি লিখুন",
"Quick actions":"দ্রুত অ্যাকশন","Open categories menu":"ক্যাটাগরি মেনু খুলুন","Chat on WhatsApp":"হোয়াটসঅ্যাপে চ্যাট করুন","Close saved products":"সংরক্ষিত পণ্য বন্ধ করুন",
/* script.js messages */
"Added to Wishlist":"উইশলিস্টে যোগ হয়েছে","Removed from Wishlist":"উইশলিস্ট থেকে সরানো হয়েছে","Added to Compare":"তুলনায় যোগ হয়েছে","Removed from Compare":"তুলনা থেকে সরানো হয়েছে",
"Compare up to 3 products — remove one first":"সর্বোচ্চ ৩টি পণ্য তুলনা করা যায় — আগে একটি সরান","Stock limit reached":"স্টকের সীমা শেষ","Stock limit reached for this combo":"এই কম্বোর স্টকের সীমা শেষ",
"Combo added to cart":"কম্বো কার্টে যোগ হয়েছে","Add a product to continue to checkout":"চেকআউটে যেতে একটি পণ্য যোগ করুন","A product in this combo is out of stock":"এই কম্বোর একটি পণ্যের স্টক শেষ",
"Add Combo to Cart":"কম্বো কার্টে যোগ করুন","Buy Combo Now":"কম্বো এখনই কিনুন","Combo Deal":"কম্বো ডিল","Special Deal":"স্পেশাল ডিল","Special Offers":"স্পেশাল অফার","All Deals":"সব অফার",
"Invalid coupon code":"কুপন কোডটি সঠিক নয়","Please try again.":"আবার চেষ্টা করুন।","Something went wrong.":"কিছু একটা সমস্যা হয়েছে।","Products could not be loaded":"পণ্য লোড করা যায়নি",
"Please enter your phone number.":"আপনার ফোন নম্বর দিন।","Searching your orders...":"আপনার অর্ডার খোঁজা হচ্ছে...","No orders found":"কোনো অর্ডার পাওয়া যায়নি","No order was found for this phone number.":"এই ফোন নম্বরে কোনো অর্ডার পাওয়া যায়নি।",
"Please enter the transaction ID for the selected payment method.":"নির্বাচিত পেমেন্ট পদ্ধতির ট্রানজেকশন আইডি দিন।","Please select a district and upazila from the suggestions.":"সাজেশন থেকে জেলা ও উপজেলা বেছে নিন।",
"The selected payment method is currently unavailable.":"নির্বাচিত পেমেন্ট পদ্ধতিটি এখন চালু নেই।","Select your district to calculate delivery charge.":"ডেলিভারি চার্জ জানতে আপনার জেলা বেছে নিন।",
"In stock":"স্টকে আছে","Nearby Dhaka":"ঢাকার আশেপাশে","Outside Dhaka":"ঢাকার বাইরে","Dhaka":"ঢাকা","Unnamed Product":"নামহীন পণ্য","Offer Products":"অফারের পণ্য","Original price":"আসল দাম",
"No discount":"ছাড় নেই","No products found.":"কোনো পণ্য পাওয়া যায়নি।","Product":"পণ্য","Battery life":"ব্যাটারি লাইফ","Smart Picks For You":"আপনার জন্য স্মার্ট বাছাই","Based on product category and availability":"পণ্যের ক্যাটাগরি ও স্টকের ভিত্তিতে",
"New arrivals will appear here when products are added.":"পণ্য যোগ হলে নতুন পণ্য এখানে দেখা যাবে।","Store favourites will appear here when products are available.":"পণ্য থাকলে জনপ্রিয় পণ্য এখানে দেখা যাবে।",
"Products will appear here when the store catalogue is available.":"স্টোরের ক্যাটালগ চালু হলে পণ্য এখানে দেখা যাবে।","Detailed specifications have not been added for this product yet.":"এই পণ্যের বিস্তারিত স্পেসিফিকেশন এখনো যোগ করা হয়নি।",
"Product description has not been added yet.":"পণ্যের বিবরণ এখনো যোগ করা হয়নি।","Product details are not available":"পণ্যের তথ্য পাওয়া যাচ্ছে না","Offer products are unavailable":"অফারের পণ্য পাওয়া যাচ্ছে না",
"Product specifications are shown only when provided by the store. Please confirm important details before ordering.":"স্পেসিফিকেশন শুধু স্টোর দিলে দেখানো হয়। অর্ডারের আগে গুরুত্বপূর্ণ তথ্য নিশ্চিত করে নিন।",
"← Back to Shop":"← শপে ফিরুন","↩ Return policy: see store policy":"↩ রিটার্ন নীতি: নীতিমালা দেখুন","PRODUCT DETAILS":"পণ্যের বিবরণ","Quick View Popup":"দ্রুত দেখুন",
"Limited-time offer from Gadget Bazar BD.":"গ্যাজেট বাজার বিডি-র সীমিত সময়ের অফার।","Special gadget deal from Gadget Bazar BD.":"গ্যাজেট বাজার বিডি-র বিশেষ গ্যাজেট ডিল।",
"Saved":"সংরক্ষিত","Comparing":"তুলনায় আছে","Save to Wishlist":"উইশলিস্টে রাখুন","Secure checkout options":"নিরাপদ চেকআউট অপশন","Open hours":"খোলা থাকার সময়",
"Site colours":"সাইটের রঙ","Courier":"কুরিয়ার","Tracking no.":"ট্র্যাকিং নম্বর","Copy":"কপি","Copied":"কপি হয়েছে","If you do not finish the order, we may contact you on this number to help.":"অর্ডার শেষ না করলে সহায়তার জন্য আমরা এই নম্বরে যোগাযোগ করতে পারি।","Sorry, we cannot take an order from this number right now. Please contact us on WhatsApp.":"দুঃখিত, এই নম্বর থেকে এখন অর্ডার নেওয়া যাচ্ছে না। অনুগ্রহ করে হোয়াটসঅ্যাপে যোগাযোগ করুন।","Please enter a valid phone number.":"সঠিক ফোন নম্বর দিন।","Your cart is empty.":"আপনার কার্ট খালি।","Shop with Confidence":"নিশ্চিন্তে কিনুন","Quick saved shopping tools":"দ্রুত সংরক্ষিত টুলস","Saved shopping tools":"সংরক্ষিত টুলস","Deals and offers":"ডিল ও অফার","Shopping benefits":"কেনাকাটার সুবিধা"
,"Choose an option first":"আগে একটি অপশন বেছে নিন","Option":"অপশন","Sold out":"স্টক শেষ"
};
/* dynamic text: [regex, function] */
var R=[
[/^Please choose an option \(colour \/ size\) for "(.*)"\.$/,function(m){return "\""+m[1]+"\" এর জন্য অপশন (রং / সাইজ) বেছে নিন।"}],
[/^(\d+) products?$/,function(m){return m[1]+"টি পণ্য"}],
[/^(\d+)% OFF$/,function(m){return m[1]+"% ছাড়"}],
[/^Up to (\d+)% Off$/,function(m){return "সর্বোচ্চ "+m[1]+"% ছাড়"}],
[/^% off$/,function(){return "% ছাড়"}],
[/^Results for "(.*)"$/,function(m){return "“"+m[1]+"” এর ফলাফল"}],
[/^(\d+) orders? found$/,function(m){return m[1]+"টি অর্ডার পাওয়া গেছে"}],
[/^In stock: (\d+)$/,function(m){return "স্টকে আছে: "+m[1]+"টি"}],
[/^(.*) each$/,function(m){return m[1]+" প্রতিটি"}],
[/^(.*) applied$/,function(m){return m[1]+" প্রয়োগ হয়েছে"}],
[/^Coupon (\S+) applied$/,function(m){return "কুপন "+m[1]+" প্রয়োগ হয়েছে"}],
[/^Add (৳[\d,]+) more to use (\S+)$/,function(m){return m[2]+" ব্যবহার করতে আরও "+m[1]+" যোগ করুন"}],
[/^Coupon (\S+): minimum order (৳[\d,]+)$/,function(m){return "কুপন "+m[1]+": সর্বনিম্ন অর্ডার "+m[2]}],
[/^Coupon: (.*)$/,function(m){return "কুপন: "+m[1]}],
[/^Send payment to: (.*)$/,function(m){return "এই নম্বরে টাকা পাঠান: "+m[1]}],
[/^Delivery: (৳[\d,]+) • (.*?)( • Usually (.*))?$/,function(m){return "ডেলিভারি: "+m[1]+" • "+t(m[2])+(m[4]?" • সাধারণত "+t(m[4]):"")}],
[/^Ends: (.*)$/,function(m){return "শেষ: "+m[1]}],
[/^View image (\d+)$/,function(m){return "ছবি "+m[1]+" দেখুন"}],
[/^Feature (\d+)$/,function(m){return "ফিচার "+m[1]}],
[/^(\d+) hours?$/,function(m){return m[1]+" ঘণ্টা"}],
[/^24 hours \(max 36 hours\)$/,function(){return "২৪ ঘণ্টা (সর্বোচ্চ ৩৬ ঘণ্টা)"}],
[/^2–3 days$/,function(){return "২–৩ দিন"}],
[/^72 hours \(max 5 days\)$/,function(){return "৭২ ঘণ্টা (সর্বোচ্চ ৫ দিন)"}],
[/^Decrease combo quantity$/,function(){return "কম্বোর পরিমাণ কমান"}],
[/^Increase combo quantity$/,function(){return "কম্বোর পরিমাণ বাড়ান"}]
];
var BNDIG="০১২৩৪৫৬৭৮৯";
function t(s){var r=tr(s);return r==null?s:r}
function tr(s){
  var full=s.replace(/\s+/g," ").trim();
  if(Object.prototype.hasOwnProperty.call(D,full))return D[full];
  var m=/^([^A-Za-z৳0-9"“]*)([\s\S]*?)([^A-Za-z.!?)"”0-9]*)$/.exec(s);
  var pre="",core=s,post="";
  if(m&&m[2]){pre=m[1];core=m[2];post=m[3]}
  core=core.replace(/\s+/g," ").trim();
  if(!core||!/[A-Za-z]/.test(core))return null;
  var out=null;
  if(Object.prototype.hasOwnProperty.call(D,core))out=D[core];
  else for(var i=0;i<R.length;i++){var x=R[i][0].exec(core);if(x){out=R[i][1](x);break}}
  return out==null?null:pre+out+post;
}
var lang="bn";try{lang=localStorage.getItem(KEY)||"bn"}catch(e){}
var origText=new WeakMap(),origAttr=new WeakMap();
var ATTRS=["placeholder","aria-label","title","alt"];
function skip(n){var p=n.parentElement;if(!p)return true;var tg=p.tagName;return tg==="SCRIPT"||tg==="STYLE"||tg==="NOSCRIPT"||tg==="TEXTAREA"||p.closest("[data-no-i18n]")}
function doText(n){
  if(skip(n))return;
  var cur=n.nodeValue,o=origText.get(n);
  if(o&&cur!==o.val&&cur!==o.en){o=null;origText.delete(n)}   // page changed it: re-evaluate
  var en=o?o.en:cur;
  if(lang==="bn"){
    if(!o){
      var b=tr(en);
      if(b==null)return;
      var lead=/^\s*/.exec(en)[0],trail=en.slice(lead.length).replace(/\s+$/,"");trail=en.slice(lead.length+trail.length);
      o={en:en,val:lead+b+trail};origText.set(n,o);
    }
    if(n.nodeValue!==o.val)n.nodeValue=o.val;
  }else if(o){if(n.nodeValue!==o.en)n.nodeValue=o.en}
}
function doAttrs(el){
  if(!el.getAttribute)return;
  for(var i=0;i<ATTRS.length;i++){
    var a=ATTRS[i],v=el.getAttribute(a);if(v==null)continue;
    var rec=origAttr.get(el)||{};var o=rec[a];
    if(o&&v!==o.bn&&v!==o.en){o=null}
    var en=o?o.en:v;
    if(lang==="bn"){
      var b=o?o.bn:tr(en);
      if(b==null)continue;
      rec[a]={en:en,bn:b};origAttr.set(el,rec);if(v!==b)el.setAttribute(a,b);
    }else if(o){if(v!==o.en)el.setAttribute(a,o.en)}
  }
}
function walk(root){
  if(!root)return;
  if(root.nodeType===3){doText(root);return}
  if(root.nodeType!==1)return;
  doAttrs(root);
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,null),n;
  while(n=w.nextNode()){if(n.nodeType===3)doText(n);else doAttrs(n)}
}
var busy=false;
var mo=new MutationObserver(function(list){
  if(busy)return;busy=true;
  try{for(var i=0;i<list.length;i++){var m=list[i];
    if(m.type==="characterData")doText(m.target);
    else if(m.type==="attributes")doAttrs(m.target);
    else m.addedNodes.forEach(walk);}}
  finally{busy=false}
});
function start(){
  document.documentElement.lang=lang==="bn"?"bn":"en";
  busy=true;try{walk(document.body)}finally{busy=false}
  mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  syncButtons();
}
function syncButtons(){
  document.querySelectorAll(".gb-lang-label").forEach(function(e){e.textContent=lang==="bn"?"ভাষা":"Language"});
  document.querySelectorAll(".gb-install-label").forEach(function(e){e.textContent=lang==="bn"?"অ্যাপ":"App"});
  document.querySelectorAll("[data-lang-btn]").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-lang-btn")===lang)});
}
window.gbSetLang=function(l){
  lang=l==="en"?"en":"bn";try{localStorage.setItem(KEY,lang)}catch(e){}
  document.documentElement.lang=lang==="bn"?"bn":"en";
  busy=true;try{walk(document.body)}finally{busy=false}
  syncButtons();
};
window.gbToggleLang=function(){window.gbSetLang(lang==="bn"?"en":"bn");try{if(window.toast)toast(lang==="bn"?"ভাষা: বাংলা":"Language: English")}catch(e){}};
window.gbT=t;window.gbLang=function(){return lang};
/* alerts / confirms are translated too */
var _al=window.alert,_cf=window.confirm;
window.alert=function(m){return _al.call(window,lang==="bn"?trMsg(String(m)):m)};
window.confirm=function(m){return _cf.call(window,lang==="bn"?trMsg(String(m)):m)};
function trMsg(s){return s.split("\n").map(function(l){var r=tr(l);return r==null?l:r}).join("\n")}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
