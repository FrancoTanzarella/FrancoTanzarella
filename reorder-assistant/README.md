# Reorder Assistant

A Shopify app for small stores that answers one question: **what do I reorder this week, and how much?**

It is aimed at merchants left without a replacement after Shopify shut down Stocky (August 31, 2026) who don't need a full inventory or ERP system. See [PLAN.md](./PLAN.md) for the product plan, pricing and launch checklist.

## What it does

1. **Sync**: reads tracked product variants, stock (available + incoming, summed across locations) and the last 60 days of orders using Shopify bulk operations.
2. **Calculate**: for each variant, works out average daily sales, a reorder point and a suggested order quantity (see below).
3. **Group by supplier**: suppliers come from the product **Vendor** field. Each supplier can have its own lead time.
4. **Export**: download a purchase order CSV per supplier, or for everything at once.

Merchants can override any product with a fixed min/max, a case pack (rounds quantities up to full cases), or exclude it entirely.

### The formula

```
daily sales    = units sold in window / window days
reorder point  = daily sales × (lead time + safety days)           (or merchant "min")
target level   = daily sales × (lead time + safety + cover days)   (or merchant "max")
stock position = available + incoming
if stock position <= reorder point:
    order = target level − stock position, rounded up to the case pack
```

Defaults: 60-day window, 14-day lead time, 7 safety days, 30 cover days. All of them can be changed in Settings. The logic lives in [`app/lib/reorder.ts`](./app/lib/reorder.ts) and is unit tested.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/lib/reorder.ts` | Reorder calculation (pure, tested) |
| `app/lib/bulk.ts` | Parses bulk operation JSONL results (pure, tested) |
| `app/lib/csv.ts` | CSV builder with spreadsheet-formula protection (tested) |
| `app/models/sync.server.ts` | Sync state machine: variants bulk query, then orders bulk query |
| `app/models/report.server.ts` | Joins the latest snapshot with settings into the reorder report |
| `app/routes/app._index.tsx` | Reorder dashboard |
| `app/routes/app.item.tsx` | Per-product overrides |
| `app/routes/app.suppliers.tsx` | Supplier lead times and emails |
| `app/routes/app.settings.tsx` | Calculation defaults |
| `app/routes/app.export.tsx` | CSV export |
| `app/routes/webhooks.compliance.tsx` | Mandatory privacy webhooks |

Built on Shopify's official [React Router app template](https://github.com/Shopify/shopify-app-template-react-router) (Admin API `2026-10`, Polaris web components, Prisma + SQLite).

## How sync works

Paging through orders with normal GraphQL queries hits Shopify's per-query cost limit on busy stores, so the app uses [bulk operations](https://shopify.dev/docs/api/usage/bulk-operations/queries):

1. **Sync now** starts a bulk query for variants and inventory.
2. While a job is active, the Reorder page polls every 3 seconds. Each poll checks the bulk operation and, once it has finished, downloads and stores the results, then starts the orders bulk query.
3. When orders finish, units sold are written to the snapshot and the job is marked `done`. Older snapshots are deleted.

A failed sync never replaces the last good snapshot. There is no background worker. A sync only moves forward while someone has the Reorder page open (see "Known limitations" in PLAN.md).

## Access scopes

`read_products`, `read_inventory`, `read_orders`

- `read_orders` only returns the **last 60 days** of orders. That is enough for sales velocity, so the app does not request `read_all_orders`, which needs separate approval from Shopify.
- Orders count as **protected customer data**. The app reads no customer fields (no names, emails or addresses), so it needs **Level 1** access. Request it in the Partner Dashboard before submitting the app. Development stores work without it.

## Local development

Requirements: Node `>=22.12`, the [Shopify CLI](https://shopify.dev/docs/apps/tools/cli), a Shopify Partner account and a development store.

```shell
npm ci
npx prisma generate
npx prisma migrate deploy
shopify app dev        # logs in, links an app, creates a tunnel
```

Checks:

```shell
npm test               # vitest unit tests
npm run typecheck
npm run lint
npm run build
```

### Supply-chain notes

- `package-lock.json` is committed. Use `npm ci` so installs match the audited lockfile exactly.
- `body-parser` is pinned to `1.20.9` via `overrides` to fix GHSA-27r3-jxmh-p828, a DoS in the version Express 4 pulls in.
- `npm audit` still reports `deepmerge-ts <8` through the Prisma 6 CLI (GHSA-ggr8-5vv4-36mx). It runs only while Prisma loads its own config, and no user input reaches it. Fixing it means moving to Prisma 7, which is a breaking upgrade.
- The Shopify Dev MCP in `.mcp.json` is pinned to a fixed version instead of `@latest`.

## Deployment

Any Node host works. The template's `Dockerfile` runs migrations on start. SQLite is fine for a single instance. Switch the Prisma datasource to Postgres if you run more than one instance. Set `NODE_ENV=production` and the `SHOPIFY_*` variables printed by `shopify app env show`. Shopify's [deployment guide](https://shopify.dev/docs/apps/launch/deployment) covers Fly.io, Render and Google Cloud Run.

Template license: [LICENSE.md](./LICENSE.md) (MIT, Shopify).
