/**
 * Parsers for Shopify bulk operation results (JSONL).
 *
 * With `groupObjects: false`, nested connection items are written as their
 * own lines with a `__parentId`, and the line order is not guaranteed, so
 * both parsers collect everything first and join at the end.
 */

export interface VariantSnapshot {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  vendor: string;
  available: number;
  incoming: number;
  unitCost: number | null;
}

type JsonObject = Record<string, unknown>;

interface VariantLine {
  id: string;
  title: string;
  sku?: string | null;
  product: { title: string; vendor: string };
  inventoryItem: {
    id: string;
    tracked: boolean;
    unitCost?: { amount: string } | null;
  };
}

interface QuantitiesLine {
  __parentId: string;
  quantities: { name: string; quantity: number }[];
}

interface OrderLine {
  id: string;
  cancelledAt: string | null;
  test: boolean;
}

interface LineItemLine {
  __parentId: string;
  currentQuantity: number;
  variant: { id: string } | null;
}

export function parseVariantLines(lines: Iterable<JsonObject>) {
  const variants: VariantLine[] = [];
  const totalsByParent = new Map<string, { available: number; incoming: number }>();

  for (const line of lines) {
    if ("inventoryItem" in line) {
      variants.push(line as unknown as VariantLine);
    } else if ("quantities" in line) {
      const level = line as unknown as QuantitiesLine;
      const totals = totalsByParent.get(level.__parentId) ?? {
        available: 0,
        incoming: 0,
      };
      for (const q of level.quantities) {
        if (q.name === "available") totals.available += q.quantity;
        if (q.name === "incoming") totals.incoming += q.quantity;
      }
      totalsByParent.set(level.__parentId, totals);
    }
  }

  const snapshots: VariantSnapshot[] = [];
  for (const v of variants) {
    if (!v.inventoryItem.tracked) continue;
    // The parent of an inventory level can be reported as either the variant
    // or its inventory item, so accept both.
    const totals = totalsByParent.get(v.id) ??
      totalsByParent.get(v.inventoryItem.id) ?? { available: 0, incoming: 0 };
    const cost = v.inventoryItem.unitCost?.amount;
    snapshots.push({
      variantId: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku || null,
      vendor: v.product.vendor || "",
      available: totals.available,
      incoming: totals.incoming,
      unitCost: cost != null ? Number(cost) : null,
    });
  }
  return snapshots;
}

/** Units sold per variant, excluding cancelled and test orders. */
export function parseOrderLines(lines: Iterable<JsonObject>) {
  const excludedOrders = new Set<string>();
  const lineItems: LineItemLine[] = [];

  for (const line of lines) {
    if ("currentQuantity" in line) {
      lineItems.push(line as unknown as LineItemLine);
    } else if ("cancelledAt" in line) {
      const order = line as unknown as OrderLine;
      if (order.cancelledAt || order.test) excludedOrders.add(order.id);
    }
  }

  const unitsSold = new Map<string, number>();
  for (const item of lineItems) {
    if (!item.variant || excludedOrders.has(item.__parentId)) continue;
    if (item.currentQuantity <= 0) continue;
    unitsSold.set(
      item.variant.id,
      (unitsSold.get(item.variant.id) ?? 0) + item.currentQuantity,
    );
  }
  return unitsSold;
}

/** Splits a streamed response body into parsed JSONL objects. */
export async function readJsonl(
  body: ReadableStream<Uint8Array>,
): Promise<JsonObject[]> {
  const out: JsonObject[] = [];
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      if (line) out.push(JSON.parse(line));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  if (buffer.trim()) out.push(JSON.parse(buffer));
  return out;
}
