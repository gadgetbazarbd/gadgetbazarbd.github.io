Gadget Bazar BD — Customer Site (Supabase Connected)

Design/UI:
- Original V6 design and CSS retained.
- Cart, Buy Now, Checkout, district/upazila picker and delivery UI retained.

Supabase:
- Customer site reads active products from public.products.
- Customer orders are inserted into public.orders.
- Delivery settings are read from public.delivery_settings when available.
- Uses the Supabase publishable key only; never put a service_role key in this site.

Deploy:
- Replace the current customer-site files on GitHub Pages with:
  index.html
  script.js
  style.css

After deployment:
1. Add/edit a product in Admin Panel.
2. Refresh customer site and verify it appears.
3. Place a test COD order.
4. Check Admin Panel > Orders.

Note:
- The orders insert mapping expects the Admin V3 orders table fields:
  order_id, customer_name, phone, district, upazila, address, note,
  items, subtotal, delivery_fee, total, payment_method, transaction_id, status.
