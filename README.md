# Gadget Bazar BD

Static online shop (GitHub Pages) + admin panel, both using Supabase.

## Files
| File | Purpose |
|---|---|
| `index.html`, `script.js`, `style.css` | Customer website |
| `admin.html`, `admin.js`, `admin.css` | Admin panel (`/admin.html`), Supabase Auth login |

## Supabase
Tables: `products`, `categories`, `offers`, `orders`, `delivery_settings`, `payment_settings`, `store_settings`.
RPC: `track_orders_by_phone`. Storage bucket: `product images`.

## What the admin controls
- Products, categories, orders, customers
- Offers & Deals (combo, flash sale, etc.) - shown on the site only when active offers exist
- Delivery charges, bKash / Nagad numbers and COD (Payments)
- Settings: phone, email, address, support hours - shown on the customer site's Contact section
  (the `store_settings` table must allow public read; otherwise edit `STORE_INFO` in `script.js`)

## Orders and WhatsApp
- Order status is changed only in Admin > Orders (single source of truth).
- The WhatsApp button in Admin > Orders opens a chat with the customer with a ready message for the current status.
- After ordering, customers can send their order details to your WhatsApp. The order is already saved, so it always appears in the admin panel.

## Things you edit in `script.js` (top of file)
- `STORE_INFO`: WhatsApp number (needed for the WhatsApp button), Facebook link, and fallback phone/email/address/hours
- `DELIVERY_TIME`: delivery estimates per zone
- `RETURN_WINDOW`: return period shown in Policies
- `COUPONS`: WELCOME5 = 5% off on orders of ৳500+, GADGET50 = ৳50 off on orders of ৳1000+

## Security (Supabase SQL, run once, in this order)
1. `1_place_order.sql` - server-side order function: real prices, stock check and deduction, coupon and delivery calculated on the server; stock is returned when an order is cancelled; order tracking function.
2. `2_security_rls.sql` - run only after the new site is live and a test order worked: locks the database so only the admin account can change data.
The SQL files are not part of the website; keep them out of the GitHub repo if you like.
If you change coupons in `script.js` (`COUPONS`), change the same values inside `place_order()` in `1_place_order.sql` and run it again.

## Notes
- Deploy: upload all changed files to the repo root in one commit, then hard-refresh.
