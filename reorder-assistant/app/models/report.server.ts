import db from "../db.server";
import { calculateReorder, type ReorderStatus } from "../lib/reorder";
import { getSettings } from "./settings.server";
import { getLastCompletedJob } from "./sync.server";

export const NO_SUPPLIER = "No supplier";

export interface ReportRow {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  supplier: string;
  available: number;
  incoming: number;
  unitsSold: number;
  unitCost: number | null;
  daysOfCover: number | null;
  reorderPoint: number;
  targetLevel: number;
  suggestedQty: number;
  status: ReorderStatus;
  minQty: number | null;
  maxQty: number | null;
  casePack: number | null;
  ignored: boolean;
}

export interface SupplierGroup {
  name: string;
  email: string | null;
  leadTimeDays: number;
  rows: ReportRow[];
  totalUnits: number;
  totalCost: number | null;
}

export async function getReorderReport(shop: string) {
  const [settings, job] = await Promise.all([
    getSettings(shop),
    getLastCompletedJob(shop),
  ]);
  if (!job) return { settings, job: null, rows: [], suppliers: [] };

  const [stats, suppliers, variantSettings] = await Promise.all([
    db.variantStat.findMany({ where: { jobId: job.id } }),
    db.supplier.findMany({ where: { shop } }),
    db.variantSetting.findMany({ where: { shop } }),
  ]);
  const supplierByName = new Map(suppliers.map((s) => [s.name, s]));
  const overrides = new Map(variantSettings.map((v) => [v.variantId, v]));

  const rows: ReportRow[] = stats.map((stat) => {
    const supplierName = stat.vendor || NO_SUPPLIER;
    const supplier = supplierByName.get(supplierName);
    const override = overrides.get(stat.variantId);
    const result = calculateReorder({
      available: stat.available,
      incoming: stat.incoming,
      unitsSold: stat.unitsSold,
      windowDays: job.windowDays,
      leadTimeDays: supplier?.leadTimeDays ?? settings.defaultLeadTimeDays,
      safetyDays: settings.safetyDays,
      coverDays: settings.coverDays,
      minQty: override?.minQty,
      maxQty: override?.maxQty,
      casePack: override?.casePack,
    });
    return {
      variantId: stat.variantId,
      productTitle: stat.productTitle,
      variantTitle: stat.variantTitle,
      sku: stat.sku,
      supplier: supplierName,
      available: stat.available,
      incoming: stat.incoming,
      unitsSold: stat.unitsSold,
      unitCost: stat.unitCost,
      daysOfCover: result.daysOfCover,
      reorderPoint: result.reorderPoint,
      targetLevel: result.targetLevel,
      suggestedQty: override?.ignored ? 0 : result.suggestedQty,
      status: override?.ignored ? "ok" : result.status,
      minQty: override?.minQty ?? null,
      maxQty: override?.maxQty ?? null,
      casePack: override?.casePack ?? null,
      ignored: override?.ignored ?? false,
    };
  });

  const groups = new Map<string, SupplierGroup>();
  for (const row of rows) {
    let group = groups.get(row.supplier);
    if (!group) {
      const supplier = supplierByName.get(row.supplier);
      group = {
        name: row.supplier,
        email: supplier?.email ?? null,
        leadTimeDays: supplier?.leadTimeDays ?? settings.defaultLeadTimeDays,
        rows: [],
        totalUnits: 0,
        totalCost: 0,
      };
      groups.set(row.supplier, group);
    }
    group.rows.push(row);
    if (row.suggestedQty > 0) {
      group.totalUnits += row.suggestedQty;
      group.totalCost =
        group.totalCost == null || row.unitCost == null
          ? null
          : group.totalCost + row.unitCost * row.suggestedQty;
    }
  }

  return {
    settings,
    job,
    rows,
    suppliers: [...groups.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}
