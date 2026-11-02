/**
 * Plan limits for Shopify App Pricing. The plans themselves (price, trial)
 * are set up in the Partner Dashboard; these numbers must match what the
 * listing promises.
 *
 * Limits are shown as a notice, not enforced: for apps on Shopify App
 * Pricing the active plan comes from the Partner API, not the Admin API.
 */
export const PLANS = [
  { name: "Starter", maxVariants: 500 },
  { name: "Growth", maxVariants: 5000 },
] as const;

export type PlanNotice =
  | { kind: "none" }
  | { kind: "needs_growth"; variantCount: number }
  | { kind: "over_all_plans"; variantCount: number };

export function planNotice(variantCount: number): PlanNotice {
  const [starter, growth] = PLANS;
  if (variantCount > growth.maxVariants) {
    return { kind: "over_all_plans", variantCount };
  }
  if (variantCount > starter.maxVariants) {
    return { kind: "needs_growth", variantCount };
  }
  return { kind: "none" };
}

/**
 * Shopify-hosted plan selection page. The store handle is the
 * `*.myshopify.com` subdomain; the app handle is `handle` in
 * shopify.app.toml (set SHOPIFY_APP_HANDLE if it differs from the default).
 */
export function pricingPlansUrl(shop: string, appHandle: string) {
  const storeHandle = shop.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`;
}

export const DEFAULT_APP_HANDLE = "reorder-assistant";
