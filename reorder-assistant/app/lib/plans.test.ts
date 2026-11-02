import { describe, expect, it } from "vitest";
import { planNotice, pricingPlansUrl } from "./plans";

describe("planNotice", () => {
  it("shows nothing within the Starter limit", () => {
    expect(planNotice(0)).toEqual({ kind: "none" });
    expect(planNotice(500)).toEqual({ kind: "none" });
  });

  it("asks for Growth above 500 variants", () => {
    expect(planNotice(501)).toEqual({
      kind: "needs_growth",
      variantCount: 501,
    });
    expect(planNotice(5000)).toEqual({
      kind: "needs_growth",
      variantCount: 5000,
    });
  });

  it("flags stores above every plan", () => {
    expect(planNotice(5001)).toEqual({
      kind: "over_all_plans",
      variantCount: 5001,
    });
  });
});

describe("pricingPlansUrl", () => {
  it("builds the admin plan selection URL from the shop domain", () => {
    expect(pricingPlansUrl("my-store.myshopify.com", "reorder-assistant")).toBe(
      "https://admin.shopify.com/store/my-store/charges/reorder-assistant/pricing_plans",
    );
  });
});
