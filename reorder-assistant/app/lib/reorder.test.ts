import { describe, expect, it } from "vitest";
import { calculateReorder, type ReorderInput } from "./reorder";

const base: ReorderInput = {
  available: 100,
  incoming: 0,
  unitsSold: 60, // 1 per day over 60 days
  windowDays: 60,
  leadTimeDays: 14,
  safetyDays: 7,
  coverDays: 30,
};

describe("calculateReorder", () => {
  it("does nothing while stock is above the reorder point", () => {
    const result = calculateReorder(base);
    expect(result.dailyVelocity).toBe(1);
    expect(result.reorderPoint).toBe(21);
    expect(result.targetLevel).toBe(51);
    expect(result.suggestedQty).toBe(0);
    expect(result.status).toBe("ok");
    expect(result.daysOfCover).toBe(100);
  });

  it("tops stock up to the target level at the reorder point", () => {
    const result = calculateReorder({ ...base, available: 21 });
    expect(result.suggestedQty).toBe(30);
    expect(result.status).toBe("reorder");
  });

  it("counts incoming stock so open orders are not reordered", () => {
    const result = calculateReorder({ ...base, available: 10, incoming: 40 });
    expect(result.stockPosition).toBe(50);
    expect(result.suggestedQty).toBe(0);
  });

  it("flags out of stock and covers oversold units", () => {
    const result = calculateReorder({ ...base, available: -3 });
    expect(result.status).toBe("out_of_stock");
    expect(result.suggestedQty).toBe(54);
    expect(result.daysOfCover).toBe(0);
  });

  it("uses merchant min and max over the calculated values", () => {
    const result = calculateReorder({
      ...base,
      available: 40,
      minQty: 40,
      maxQty: 100,
    });
    expect(result.reorderPoint).toBe(40);
    expect(result.suggestedQty).toBe(60);
  });

  it("never sets a target below the reorder point", () => {
    const result = calculateReorder({
      ...base,
      available: 5,
      minQty: 50,
      maxQty: 10,
    });
    expect(result.targetLevel).toBe(50);
    expect(result.suggestedQty).toBe(45);
  });

  it("rounds up to the case pack", () => {
    const result = calculateReorder({ ...base, available: 21, casePack: 12 });
    expect(result.suggestedQty).toBe(36);
  });

  it("reports no sales instead of reordering unsold products", () => {
    const result = calculateReorder({ ...base, available: 0, unitsSold: 0 });
    expect(result.suggestedQty).toBe(0);
    expect(result.status).toBe("no_sales");
    expect(result.daysOfCover).toBeNull();
  });

  it("still reorders unsold products that have a minimum", () => {
    const result = calculateReorder({
      ...base,
      available: 0,
      unitsSold: 0,
      minQty: 2,
    });
    expect(result.suggestedQty).toBe(2);
    expect(result.status).toBe("out_of_stock");
  });
});
