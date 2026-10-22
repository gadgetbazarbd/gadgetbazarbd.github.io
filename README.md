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

## Things you edit in `script.js` (top of file)
- `STORE_INFO`: WhatsApp number (needed for the WhatsApp button), Facebook link, and fallback phone/email/address/hours
- `DELIVERY_TIME`: delivery estimates per zone
- `RETURN_WINDOW`: return period shown in Policies
- `COUPONS`: WELCOME5 = 5% off on orders of ৳500+, GADGET50 = ৳50 off on orders of ৳1000+

## Notes
- Coupon and price calculation currently run in the browser. For stronger protection, validate totals in a Supabase function.
- Deploy: upload all changed files to the repo root in one commit, then hard-refresh.
