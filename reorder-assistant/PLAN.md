# Reorder Assistant: product plan

## The opportunity

- Shopify shut down **Stocky**, its own inventory and purchase-order app, on **August 31, 2026**. Stocky was rated about 2.7★, with about 29% of reviews at 1★ (glitches, slow with large catalogs, no support).
- Merchants in Shopify Community threads say the native replacement is missing **min/max reorder points, reorder suggestions and a supplier list**.
- Most "Stocky alternative" apps are full inventory, warehouse or ERP systems. Small stores with 50–1,000 products who just want *"what do I buy this week?"* are underserved.
- Across low-star reviews in inventory, delivery and COD apps, the complaints are the same: **"it broke, it cost more than expected, nobody answered."** We win on reliability, simple flat pricing and fast support, not on feature count.

## Positioning

> **"Know what to reorder in 2 minutes a week."** Simple reorder suggestions and supplier POs for small Shopify stores. Built for former Stocky users.

## Pricing (Shopify App Pricing, formerly Managed Pricing)

| Plan | Price | Limits |
| --- | --- | --- |
| Starter | $9 / month | up to 500 variants |
| Growth | $19 / month | up to 5,000 variants |

- 14-day free trial on both plans.
- Plans are defined in the Partner Dashboard, and Shopify hosts the plan selection page, so the app needs no billing code. Shopify treats the Billing API as legacy for new apps.
- Target: **30 paying stores ≈ $300–400 / month.**
- Revenue share: 0% on the first $1M of lifetime app revenue (counted from January 1, 2025). There is a one-time $19 Partner fee.

## MVP (built)

- [x] Bulk sync of variants, stock (available + incoming) and 60 days of orders
- [x] Reorder point / target level calculation with incoming stock counted
- [x] Suppliers from Vendor, per-supplier lead time
- [x] Per-product min, max, case pack, ignore
- [x] Dashboard grouped by supplier with units and cost totals
- [x] CSV purchase-order export (per supplier / all)
- [x] Settings: sales window, default lead time, safety days, cover days
- [x] Uninstall cleanup and mandatory privacy webhooks
- [x] Unit tests for calculation, CSV and bulk parsing. GraphQL validated against the 2026-10 schema

## Before submitting to the App Store

- [ ] Create the app in the Partner Dashboard, run `shopify app config link`, and set `client_id`
- [ ] Test on a development store with real-looking data (multiple locations, variants, cancelled orders)
- [ ] **Verify the CSV download works inside the Shopify admin iframe.** It uses an authenticated `fetch` + Blob download. If the admin blocks downloads, fall back to opening the export in a new window with a short-lived signed URL
- [ ] Request **Level 1 protected customer data** access (orders) and fill in the data protection details
- [ ] Set up pricing plans in the Partner Dashboard (App Pricing)
- [ ] Gate variant-count limits by plan (read the active subscription)
- [ ] Production hosting (Fly.io / Render, about $5–20/month) with a persistent volume or Postgres
- [ ] App listing: screenshots, a 30-second demo video, a privacy policy page and a support email
- [ ] Check the current "Built for Shopify" requirements. Performance and design rules affect ranking

## Roadmap (after the first paying users)

1. **Weekly email digest**: "Reorder these 12 items." This needs a scheduler (cron on the host) and an email provider. Bulk syncs should then run from a background job instead of page polling.
2. **Email PO to supplier** using the saved supplier email, with a PDF purchase order.
3. **Draft purchase orders saved in the app** (status: draft → sent → received). Shopify's API does not expose its native purchase orders, so we keep our own.
4. **Per-location reorder** for multi-location stores (today stock is summed across locations).
5. **Stockout correction**: days at zero stock lower average sales. Track daily stock to adjust velocity.
6. **Stocky CSV import** of suppliers and min/max for migrating merchants.

## Known limitations of the MVP

- **Syncs only advance while the Reorder page is open.** It polls every 3s. If the merchant leaves mid-sync, the job resumes next time they open the page. A bulk result is kept for 7 days.
- Velocity uses a flat average over the window. Products that were out of stock for part of it look slower than they are.
- Suggestions ignore draft/archived products and variants that don't track inventory.
- Large result files are parsed in memory. Fine for the target store size; stream into the database if catalogs grow past ~50k variants.

## Distribution plan

1. Shopify App Store listing with keywords: "stocky alternative", "reorder", "low stock", "purchase order", "inventory forecast".
2. Reply helpfully in the Shopify Community "Stocky replacement" threads, disclosing that it's your app.
3. Post in r/shopify and small e-commerce Facebook groups. Offer the first 10 users a free month in exchange for feedback and a review.
4. Answer every support email within 24 hours. Good reviews early on drive App Store ranking.
