import { describe, expect, it } from "vitest";
import { parseOrderLines, parseVariantLines, readJsonl } from "./bulk";

const variant = (id: number, tracked = true) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  title: "Large",
  sku: `SKU-${id}`,
  product: { title: `Product ${id}`, vendor: "Acme" },
  inventoryItem: {
    id: `gid://shopify/InventoryItem/${id}`,
    tracked,
    unitCost: { amount: "2.50" },
  },
});

const level = (parentId: string, available: number, incoming: number) => ({
  __parentId: parentId,
  quantities: [
    { name: "available", quantity: available },
    { name: "incoming", quantity: incoming },
  ],
});

describe("parseVariantLines", () => {
  it("sums inventory across locations, whichever line comes first", () => {
    const [snapshot] = parseVariantLines([
      level("gid://shopify/ProductVariant/1", 3, 1),
      variant(1),
      level("gid://shopify/ProductVariant/1", 4, 0),
    ]);
    expect(snapshot).toEqual({
      variantId: "gid://shopify/ProductVariant/1",
      productTitle: "Product 1",
      variantTitle: "Large",
      sku: "SKU-1",
      vendor: "Acme",
      available: 7,
      incoming: 1,
      unitCost: 2.5,
    });
  });

  it("accepts inventory levels parented to the inventory item", () => {
    const [snapshot] = parseVariantLines([
      variant(2),
      level("gid://shopify/InventoryItem/2", 5, 2),
    ]);
    expect(snapshot.available).toBe(5);
    expect(snapshot.incoming).toBe(2);
  });

  it("skips variants that don't track inventory", () => {
    expect(parseVariantLines([variant(3, false)])).toEqual([]);
  });
});

describe("parseOrderLines", () => {
  const order = (id: number, extra = {}) => ({
    id: `gid://shopify/Order/${id}`,
    cancelledAt: null,
    test: false,
    ...extra,
  });
  const item = (orderId: number, variantId: number | null, qty: number) => ({
    __parentId: `gid://shopify/Order/${orderId}`,
    currentQuantity: qty,
    variant: variantId ? { id: `gid://shopify/ProductVariant/${variantId}` } : null,
  });

  it("totals units per variant and skips cancelled, test and refunded", () => {
    const sold = parseOrderLines([
      item(1, 10, 2),
      order(1),
      item(1, 11, 1),
      order(2, { cancelledAt: "2026-10-01T00:00:00Z" }),
      item(2, 10, 5),
      order(3, { test: true }),
      item(3, 10, 5),
      order(4),
      item(4, 10, 3),
      item(4, 10, 0),
      item(4, null, 9),
    ]);
    expect(Object.fromEntries(sold)).toEqual({
      "gid://shopify/ProductVariant/10": 5,
      "gid://shopify/ProductVariant/11": 1,
    });
  });
});

describe("readJsonl", () => {
  it("parses lines split across chunks", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":1}\n{"b"'));
        controller.enqueue(encoder.encode(':2}\n\n{"c":3}'));
        controller.close();
      },
    });
    expect(await readJsonl(body)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });
});
