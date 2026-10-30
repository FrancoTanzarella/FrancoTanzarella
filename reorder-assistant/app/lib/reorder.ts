export type ReorderStatus = "out_of_stock" | "reorder" | "ok" | "no_sales";

export interface ReorderInput {
  available: number;
  incoming: number;
  unitsSold: number;
  windowDays: number;
  leadTimeDays: number;
  safetyDays: number;
  coverDays: number;
  minQty?: number | null;
  maxQty?: number | null;
  casePack?: number | null;
}

export interface ReorderResult {
  dailyVelocity: number;
  daysOfCover: number | null;
  reorderPoint: number;
  targetLevel: number;
  stockPosition: number;
  suggestedQty: number;
  status: ReorderStatus;
}

/**
 * Reorder-point calculation.
 *
 * - Velocity is average units sold per day over the sales window.
 * - Reorder point = stock needed to survive the supplier lead time plus a
 *   safety buffer. A merchant-set min overrides it.
 * - Target level = reorder point plus the days of stock to buy at once.
 *   A merchant-set max overrides it.
 * - Stock position counts incoming units so open purchase orders are not
 *   reordered twice.
 */
export function calculateReorder(input: ReorderInput): ReorderResult {
  const windowDays = Math.max(1, input.windowDays);
  const dailyVelocity = Math.max(0, input.unitsSold) / windowDays;

  const reorderPoint =
    input.minQty ??
    Math.ceil(dailyVelocity * (input.leadTimeDays + input.safetyDays));
  const targetLevel = Math.max(
    reorderPoint,
    input.maxQty ??
      Math.ceil(
        dailyVelocity *
          (input.leadTimeDays + input.safetyDays + input.coverDays),
      ),
  );

  const stockPosition = input.available + input.incoming;
  const daysOfCover =
    dailyVelocity > 0 ? Math.max(0, input.available) / dailyVelocity : null;

  let suggestedQty = 0;
  if (stockPosition <= reorderPoint) {
    suggestedQty = roundUpToPack(targetLevel - stockPosition, input.casePack);
  }

  let status: ReorderStatus;
  if (suggestedQty > 0) {
    status = input.available <= 0 ? "out_of_stock" : "reorder";
  } else if (input.unitsSold <= 0 && input.minQty == null) {
    status = "no_sales";
  } else {
    status = "ok";
  }

  return {
    dailyVelocity,
    daysOfCover,
    reorderPoint,
    targetLevel,
    stockPosition,
    suggestedQty,
    status,
  };
}

function roundUpToPack(qty: number, casePack?: number | null): number {
  if (qty <= 0) return 0;
  if (!casePack || casePack <= 1) return qty;
  return Math.ceil(qty / casePack) * casePack;
}
