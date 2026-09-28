# Gadget Bazar BD Admin Website

This is a polished, mobile-responsive admin dashboard for Gadget Bazar BD.

## Included
- Admin login (demo: `admin` / `admin123`)
- Dashboard KPIs and sales overview
- Product CRUD, active/hidden state, featured state
- Orders table, search/filter, status updates, order details
- Customer directory
- Sales reports
- Delivery settings
- Category management
- COD / bKash / Nagad settings
- Store/general settings
- JSON export/import for backup and migration
- No Firestore, no Google Sheets, no paid dependency

## Current storage model
The app uses browser `localStorage` so it works immediately on GitHub Pages and can be tested without a backend.

## Future connection point
When you are ready to connect the customer website, add an API adapter around these data objects:
- `db.products`
- `db.orders`
- `db.customers`
- `db.delivery`
- `db.payments`
- `db.settings`

Replace `load()` / `save()` with `fetch()` calls to your chosen backend. The UI already separates data rendering from storage so this swap can be made later without redesigning the dashboard.
