import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { parseOrderLines, parseVariantLines, readJsonl } from "../lib/bulk";
import { getSettings } from "./settings.server";

/**
 * A sync runs two Shopify bulk queries one after the other: tracked variants
 * with inventory, then orders in the sales window. Bulk queries avoid the
 * per-request cost limit that paging through orders would hit on busy stores.
 *
 * There is no background worker: the reorder page polls `advanceSync` while
 * a job is active, and each call moves the job forward when its bulk
 * operation has finished.
 */

const ACTIVE_STAGES = ["variants", "orders"];
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

const VARIANTS_BULK_QUERY = `{
  productVariants(query: "product_status:active AND gift_card:false") {
    edges {
      node {
        id
        title
        sku
        product { title vendor }
        inventoryItem {
          id
          tracked
          unitCost { amount }
          inventoryLevels {
            edges {
              node {
                quantities(names: ["available", "incoming"]) { name quantity }
              }
            }
          }
        }
      }
    }
  }
}`;

function ordersBulkQuery(since: Date) {
  return `{
  orders(query: "created_at:>='${since.toISOString()}'") {
    edges {
      node {
        id
        cancelledAt
        test
        lineItems {
          edges {
            node {
              currentQuantity
              variant { id }
            }
          }
        }
      }
    }
  }
}`;
}

interface BulkOperation {
  id: string;
  status: string;
  errorCode: string | null;
  url: string | null;
}

export async function getActiveJob(shop: string) {
  return db.syncJob.findFirst({
    where: { shop, stage: { in: ACTIVE_STAGES } },
    orderBy: { id: "desc" },
  });
}

export async function getLastCompletedJob(shop: string) {
  return db.syncJob.findFirst({
    where: { shop, stage: "done" },
    orderBy: { id: "desc" },
  });
}

export async function getLastFailedJob(shop: string) {
  return db.syncJob.findFirst({
    where: { shop, stage: "failed" },
    orderBy: { id: "desc" },
  });
}

export async function startSync(admin: AdminApiContext, shop: string) {
  const active = await getActiveJob(shop);
  if (active) return active;

  const settings = await getSettings(shop);
  await saveShopCurrency(admin, shop);

  const windowStart = new Date(
    Date.now() - settings.salesWindowDays * 24 * 60 * 60 * 1000,
  );
  const job = await db.syncJob.create({
    data: {
      shop,
      stage: "variants",
      windowDays: settings.salesWindowDays,
      windowStart,
    },
  });

  try {
    const operation = await runBulkQuery(admin, VARIANTS_BULK_QUERY);
    return db.syncJob.update({
      where: { id: job.id },
      data: { bulkOperationId: operation.id },
    });
  } catch (error) {
    return failJob(job.id, error);
  }
}

export async function advanceSync(admin: AdminApiContext, shop: string) {
  const job = await getActiveJob(shop);
  if (!job || !job.bulkOperationId) return job;

  // Polling requests can overlap; only one of them may process a result.
  const staleLock = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const { count } = await db.syncJob.updateMany({
    where: {
      id: job.id,
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }],
    },
    data: { lockedAt: new Date() },
  });
  if (count === 0) return job;

  try {
    const operation = await getBulkOperation(admin, job.bulkOperationId);

    if (operation.status !== "COMPLETED") {
      if (["CREATED", "RUNNING", "CANCELING"].includes(operation.status)) {
        return job;
      }
      return failJob(
        job.id,
        `Shopify bulk operation ${operation.status.toLowerCase()}` +
          (operation.errorCode ? ` (${operation.errorCode})` : ""),
      );
    }

    // A completed operation with no results has no file.
    const lines = operation.url ? await downloadJsonl(operation.url) : [];

    if (job.stage === "variants") {
      const snapshots = parseVariantLines(lines);
      await db.variantStat.createMany({
        data: snapshots.map((s) => ({ ...s, jobId: job.id, shop })),
      });
      const next = await runBulkQuery(admin, ordersBulkQuery(job.windowStart));
      return db.syncJob.update({
        where: { id: job.id },
        data: { stage: "orders", bulkOperationId: next.id },
      });
    }

    const unitsSold = parseOrderLines(lines);
    await db.$transaction(
      [...unitsSold].map(([variantId, units]) =>
        db.variantStat.updateMany({
          where: { jobId: job.id, variantId },
          data: { unitsSold: units },
        }),
      ),
    );
    const done = await db.syncJob.update({
      where: { id: job.id },
      data: { stage: "done", finishedAt: new Date() },
    });
    // Older snapshots are no longer needed; their stats cascade.
    await db.syncJob.deleteMany({ where: { shop, id: { lt: job.id } } });
    return done;
  } catch (error) {
    return failJob(job.id, error);
  } finally {
    await db.syncJob.updateMany({
      where: { id: job.id },
      data: { lockedAt: null },
    });
  }
}

async function runBulkQuery(admin: AdminApiContext, query: string) {
  const response = await admin.graphql(
    `#graphql
    mutation RunBulkQuery($query: String!) {
      bulkOperationRunQuery(query: $query, groupObjects: false) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }`,
    { variables: { query } },
  );
  const json = await response.json();
  const payload = json.data?.bulkOperationRunQuery;
  if (payload?.userErrors?.length) {
    throw new Error(
      payload.userErrors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  if (!payload?.bulkOperation) {
    throw new Error("Shopify did not start the bulk operation");
  }
  return payload.bulkOperation as Pick<BulkOperation, "id" | "status">;
}

async function getBulkOperation(admin: AdminApiContext, id: string) {
  const response = await admin.graphql(
    `#graphql
    query BulkOperationStatus($id: ID!) {
      bulkOperation(id: $id) { id status errorCode url }
    }`,
    { variables: { id } },
  );
  const json = await response.json();
  const operation = json.data?.bulkOperation as BulkOperation | null;
  if (!operation) throw new Error("Bulk operation not found");
  return operation;
}

async function downloadJsonl(url: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Downloading bulk results failed (${response.status})`);
  }
  return readJsonl(response.body);
}

async function saveShopCurrency(admin: AdminApiContext, shop: string) {
  const response = await admin.graphql(
    `#graphql
    query ShopCurrency { shop { currencyCode } }`,
  );
  const json = await response.json();
  const currencyCode = json.data?.shop?.currencyCode as string | undefined;
  if (currencyCode) {
    await db.shopSettings.update({ where: { shop }, data: { currencyCode } });
  }
}

async function failJob(id: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Sync job ${id} failed: ${message}`);
  return db.syncJob.update({
    where: { id },
    data: { stage: "failed", error: message, finishedAt: new Date() },
  });
}
