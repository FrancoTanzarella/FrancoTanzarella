import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getReorderReport, type ReportRow } from "../models/report.server";
import {
  advanceSync,
  getLastFailedJob,
  startSync,
} from "../models/sync.server";
import { downloadCsv, formatMoney, numericId } from "../lib/format";
import {
  DEFAULT_APP_HANDLE,
  PLANS,
  planNotice,
  pricingPlansUrl,
} from "../lib/plans";

const POLL_INTERVAL_MS = 3000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const activeJob = await advanceSync(admin, shop);
  const [report, failedJob] = await Promise.all([
    getReorderReport(shop),
    getLastFailedJob(shop),
  ]);
  const showAll = new URL(request.url).searchParams.get("view") === "all";

  const syncing =
    activeJob != null && ["variants", "orders"].includes(activeJob.stage);
  const lastError =
    failedJob && (!report.job || failedJob.id > report.job.id)
      ? failedJob.error
      : null;

  return {
    syncing,
    syncStage: syncing ? activeJob!.stage : null,
    lastError,
    lastSyncedAt: report.job?.finishedAt?.toISOString() ?? null,
    windowDays: report.job?.windowDays ?? report.settings.salesWindowDays,
    currencyCode: report.settings.currencyCode,
    showAll,
    suppliers: report.suppliers
      .map((group) => ({
        ...group,
        rows: showAll
          ? group.rows
          : group.rows.filter((r) => r.suggestedQty > 0),
      }))
      .filter((group) => group.rows.length > 0),
    reorderCount: report.rows.filter((r) => r.suggestedQty > 0).length,
    outOfStockCount: report.rows.filter((r) => r.status === "out_of_stock")
      .length,
    planNotice: planNotice(report.rows.length),
    plansUrl: pricingPlansUrl(
      shop,
      process.env.SHOPIFY_APP_HANDLE || DEFAULT_APP_HANDLE,
    ),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await startSync(admin, session.shop);
  return { started: true };
};

export default function ReorderPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const syncing = data.syncing || fetcher.state !== "idle";

  useEffect(() => {
    if (!data.syncing) return;
    const timer = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [data.syncing, revalidator]);

  const startSync = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Reorder">
      <s-button
        slot="primary-action"
        onClick={startSync}
        {...(syncing ? { loading: true, disabled: true } : {})}
      >
        Sync now
      </s-button>
      {data.reorderCount > 0 && (
        <s-button slot="secondary-actions" onClick={() => downloadCsv()}>
          Export all (CSV)
        </s-button>
      )}

      {data.syncing && (
        <s-banner tone="info" heading="Syncing with Shopify">
          {data.syncStage === "variants"
            ? "Reading products and inventory…"
            : `Reading orders from the last ${data.windowDays} days…`}{" "}
          This page updates automatically.
        </s-banner>
      )}
      {data.lastError && !data.syncing && (
        <s-banner tone="critical" heading="The last sync failed">
          {data.lastError}
        </s-banner>
      )}

      {data.planNotice.kind === "needs_growth" && (
        <s-banner tone="warning" heading="Your catalog is larger than Starter">
          You have {data.planNotice.variantCount} tracked variants. Starter
          covers up to {PLANS[0].maxVariants} and Growth up to{" "}
          {PLANS[1].maxVariants}. If you are on Starter, please{" "}
          <a href={data.plansUrl} target="_top">
            switch to Growth
          </a>
          .
        </s-banner>
      )}
      {data.planNotice.kind === "over_all_plans" && (
        <s-banner
          tone="warning"
          heading="Your catalog is larger than our plans"
        >
          You have {data.planNotice.variantCount} tracked variants. Growth
          covers up to {PLANS[1].maxVariants}. Please contact support so we can
          make sure the app works well for a store your size.
        </s-banner>
      )}

      {!data.lastSyncedAt ? (
        <s-section heading="Welcome">
          <s-paragraph>
            Reorder Assistant looks at your stock and the last {data.windowDays}{" "}
            days of sales, then tells you what to reorder from each supplier and
            how much.
          </s-paragraph>
          <s-paragraph>
            Run your first sync to get suggestions. Set supplier lead times on
            the Suppliers page for better results.
          </s-paragraph>
          <s-button
            onClick={startSync}
            {...(syncing ? { loading: true, disabled: true } : {})}
          >
            Run first sync
          </s-button>
        </s-section>
      ) : (
        <>
          <s-section>
            <s-stack direction="inline" gap="large">
              <s-text>
                <s-text type="strong">{data.reorderCount}</s-text> to reorder
              </s-text>
              <s-text>
                <s-text type="strong">{data.outOfStockCount}</s-text> out of
                stock
              </s-text>
              <s-text color="subdued">
                Last synced {new Date(data.lastSyncedAt).toLocaleString()}
              </s-text>
              <s-link href={data.showAll ? "/app" : "/app?view=all"}>
                {data.showAll ? "Show items to reorder" : "Show all products"}
              </s-link>
            </s-stack>
          </s-section>

          {data.suppliers.length === 0 && (
            <s-section>
              <s-paragraph>Nothing needs reordering right now. 🎉</s-paragraph>
            </s-section>
          )}

          {data.suppliers.map((group) => (
            <s-section key={group.name} heading={group.name}>
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                  <s-text color="subdued">
                    Lead time {group.leadTimeDays} days
                  </s-text>
                  {group.totalUnits > 0 && (
                    <s-text color="subdued">
                      {group.totalUnits} units
                      {group.totalCost != null &&
                        ` · ${formatMoney(group.totalCost, data.currencyCode)}`}
                    </s-text>
                  )}
                  {group.totalUnits > 0 && (
                    <s-button
                      variant="secondary"
                      onClick={() => downloadCsv(group.name)}
                    >
                      Download PO (CSV)
                    </s-button>
                  )}
                </s-stack>
                <ReorderTable rows={group.rows} windowDays={data.windowDays} />
              </s-stack>
            </s-section>
          ))}
        </>
      )}
    </s-page>
  );
}

function ReorderTable({
  rows,
  windowDays,
}: {
  rows: ReportRow[];
  windowDays: number;
}) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Product</s-table-header>
        <s-table-header>Status</s-table-header>
        <s-table-header format="numeric">Available</s-table-header>
        <s-table-header format="numeric">Incoming</s-table-header>
        <s-table-header format="numeric">Sold ({windowDays}d)</s-table-header>
        <s-table-header format="numeric">Days left</s-table-header>
        <s-table-header format="numeric">Order</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rows.map((row) => (
          <s-table-row key={row.variantId}>
            <s-table-cell>
              <s-link href={`/app/item?id=${numericId(row.variantId)}`}>
                {row.productTitle}
                {row.variantTitle !== "Default Title" &&
                  ` – ${row.variantTitle}`}
              </s-link>
              {row.sku && <s-text color="subdued"> {row.sku}</s-text>}
            </s-table-cell>
            <s-table-cell>
              <StatusBadge row={row} />
            </s-table-cell>
            <s-table-cell>{row.available}</s-table-cell>
            <s-table-cell>{row.incoming}</s-table-cell>
            <s-table-cell>{row.unitsSold}</s-table-cell>
            <s-table-cell>
              {row.daysOfCover == null ? "–" : Math.floor(row.daysOfCover)}
            </s-table-cell>
            <s-table-cell>
              {row.suggestedQty > 0 ? row.suggestedQty : "–"}
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

function StatusBadge({ row }: { row: ReportRow }) {
  const [label, tone] = row.ignored
    ? ["Ignored", "neutral"]
    : {
        out_of_stock: ["Out of stock", "critical"],
        reorder: ["Reorder", "warning"],
        ok: ["OK", "success"],
        no_sales: ["No sales", "neutral"],
      }[row.status];
  return <s-badge tone={tone as "neutral"}>{label}</s-badge>;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
