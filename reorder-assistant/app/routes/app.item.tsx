import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getReorderReport } from "../models/report.server";
import { optionalInt, upsertVariantSetting } from "../models/settings.server";
import { variantGid } from "../lib/format";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const report = await getReorderReport(session.shop);
  const row = report.rows.find((r) => r.variantId === variantGid(id));
  if (!row) throw new Response("Product not found", { status: 404 });
  return { row, windowDays: report.job?.windowDays ?? 0 };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const form = await request.formData();
  await upsertVariantSetting(session.shop, variantGid(id), {
    minQty: optionalInt(form.get("minQty")),
    maxQty: optionalInt(form.get("maxQty")),
    casePack: optionalInt(form.get("casePack")),
    ignored: form.get("ignored") != null,
  });
  return { saved: true };
};

export default function ItemPage() {
  const { row, windowDays } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const saving = useNavigation().state === "submitting";
  const title =
    row.variantTitle === "Default Title"
      ? row.productTitle
      : `${row.productTitle} – ${row.variantTitle}`;

  useEffect(() => {
    if (result?.saved) shopify.toast.show("Saved");
  }, [result]);

  return (
    <s-page heading={title}>
      <s-link slot="breadcrumb-actions" href="/app">
        Reorder
      </s-link>
      <Form method="post">
        <s-section heading="Reorder rules">
          <s-stack direction="block" gap="base">
            <s-number-field
              label="Minimum stock (reorder point)"
              name="minQty"
              defaultValue={row.minQty == null ? "" : String(row.minQty)}
              placeholder={`Calculated: ${row.reorderPoint}`}
              min={0}
              details="Reorder when available + incoming falls to this. Leave blank to calculate it from sales."
            />
            <s-number-field
              label="Maximum stock (order up to)"
              name="maxQty"
              defaultValue={row.maxQty == null ? "" : String(row.maxQty)}
              placeholder={`Calculated: ${row.targetLevel}`}
              min={0}
            />
            <s-number-field
              label="Case pack"
              name="casePack"
              defaultValue={row.casePack == null ? "" : String(row.casePack)}
              placeholder="1"
              min={1}
              details="Suggested quantities are rounded up to a multiple of this."
            />
            <s-checkbox
              label="Don't suggest reorders for this product"
              name="ignored"
              defaultChecked={row.ignored}
            />
            <s-button type="submit" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </s-section>
      </Form>
      <s-section slot="aside" heading="Latest numbers">
        <s-stack direction="block" gap="small-200">
          <s-text>Supplier: {row.supplier}</s-text>
          {row.sku && <s-text>SKU: {row.sku}</s-text>}
          <s-text>Available: {row.available}</s-text>
          <s-text>Incoming: {row.incoming}</s-text>
          <s-text>
            Sold in the last {windowDays} days: {row.unitsSold}
          </s-text>
          <s-text>
            Days of stock left:{" "}
            {row.daysOfCover == null ? "–" : Math.floor(row.daysOfCover)}
          </s-text>
          <s-text>Suggested order: {row.suggestedQty}</s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
