import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getReorderReport } from "../models/report.server";
import { toCsv } from "../lib/csv";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const supplier = new URL(request.url).searchParams.get("supplier");
  const report = await getReorderReport(session.shop);

  const rows = report.rows
    .filter((r) => r.suggestedQty > 0 && (!supplier || r.supplier === supplier))
    .sort(
      (a, b) =>
        a.supplier.localeCompare(b.supplier) ||
        a.productTitle.localeCompare(b.productTitle),
    );

  const csv = toCsv(
    [
      "Supplier",
      "Product",
      "Variant",
      "SKU",
      "Quantity",
      "Unit cost",
      "Line total",
      "Available",
      "Incoming",
    ],
    rows.map((r) => [
      r.supplier,
      r.productTitle,
      r.variantTitle === "Default Title" ? "" : r.variantTitle,
      r.sku,
      r.suggestedQty,
      r.unitCost?.toFixed(2),
      r.unitCost == null ? null : (r.unitCost * r.suggestedQty).toFixed(2),
      r.available,
      r.incoming,
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="purchase-order.csv"',
    },
  });
};
