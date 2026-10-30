import db from "../db.server";
import { MAX_SALES_WINDOW_DAYS } from "../lib/constants";

export async function getSettings(shop: string) {
  return db.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

export interface SettingsInput {
  salesWindowDays: number;
  defaultLeadTimeDays: number;
  safetyDays: number;
  coverDays: number;
}

export async function updateSettings(shop: string, input: SettingsInput) {
  const data = {
    salesWindowDays: clamp(input.salesWindowDays, 7, MAX_SALES_WINDOW_DAYS),
    defaultLeadTimeDays: clamp(input.defaultLeadTimeDays, 0, 365),
    safetyDays: clamp(input.safetyDays, 0, 365),
    coverDays: clamp(input.coverDays, 1, 365),
  };
  return db.shopSettings.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

export async function upsertSupplier(
  shop: string,
  name: string,
  input: { email: string | null; leadTimeDays: number | null },
) {
  const data = {
    email: input.email || null,
    leadTimeDays:
      input.leadTimeDays == null ? null : clamp(input.leadTimeDays, 0, 365),
  };
  return db.supplier.upsert({
    where: { shop_name: { shop, name } },
    create: { shop, name, ...data },
    update: data,
  });
}

export async function upsertVariantSetting(
  shop: string,
  variantId: string,
  input: {
    minQty: number | null;
    maxQty: number | null;
    casePack: number | null;
    ignored: boolean;
  },
) {
  const data = {
    minQty: nonNegative(input.minQty),
    maxQty: nonNegative(input.maxQty),
    casePack: nonNegative(input.casePack),
    ignored: input.ignored,
  };
  return db.variantSetting.upsert({
    where: { shop_variantId: { shop, variantId } },
    create: { shop, variantId, ...data },
    update: data,
  });
}

/** Reads an optional integer from form data; blank means "not set". */
export function optionalInt(value: FormDataEntryValue | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function nonNegative(n: number | null) {
  return n == null ? null : Math.max(0, Math.round(n));
}
