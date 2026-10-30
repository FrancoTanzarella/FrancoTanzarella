import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getReorderReport } from "../models/report.server";
import { optionalInt, upsertSupplier } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const report = await getReorderReport(session.shop);
  return {
    defaultLeadTimeDays: report.settings.defaultLeadTimeDays,
    hasSynced: report.job != null,
    suppliers: report.suppliers.map((group) => ({
      name: group.name,
      email: group.email,
      leadTimeDays: group.leadTimeDays,
      productCount: group.rows.length,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const name = String(form.get("name") ?? "");
  if (!name) return { saved: false };
  await upsertSupplier(session.shop, name, {
    email: String(form.get("email") ?? "").trim() || null,
    leadTimeDays: optionalInt(form.get("leadTimeDays")),
  });
  return { saved: true };
};

export default function SuppliersPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Suppliers">
      {!data.hasSynced ? (
        <s-section>
          <s-paragraph>
            Suppliers come from the Vendor field on your products. Run a sync
            on the Reorder page first.
          </s-paragraph>
        </s-section>
      ) : (
        data.suppliers.map((supplier) => (
          <SupplierForm
            key={supplier.name}
            supplier={supplier}
            defaultLeadTimeDays={data.defaultLeadTimeDays}
          />
        ))
      )}
      <s-section slot="aside" heading="About suppliers">
        <s-paragraph>
          Each product&apos;s Vendor is treated as its supplier. To group
          products differently, change the Vendor in Shopify and sync again.
        </s-paragraph>
        <s-paragraph>
          Leave the lead time blank to use the default ({data.defaultLeadTimeDays}{" "}
          days) from Settings.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

function SupplierForm({
  supplier,
  defaultLeadTimeDays,
}: {
  supplier: {
    name: string;
    email: string | null;
    leadTimeDays: number;
    productCount: number;
  };
  defaultLeadTimeDays: number;
}) {
  const fetcher = useFetcher<typeof action>();
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.saved) shopify.toast.show(`${supplier.name} saved`);
  }, [fetcher.data, supplier.name]);

  return (
    <s-section heading={supplier.name}>
      <fetcher.Form method="post">
        <input type="hidden" name="name" value={supplier.name} />
        <s-stack direction="block" gap="base">
          <s-text color="subdued">{supplier.productCount} products</s-text>
          <s-number-field
            label="Lead time (days)"
            name="leadTimeDays"
            placeholder={String(defaultLeadTimeDays)}
            defaultValue={
              supplier.leadTimeDays === defaultLeadTimeDays
                ? ""
                : String(supplier.leadTimeDays)
            }
            min={0}
          />
          <s-email-field
            label="Order email"
            name="email"
            defaultValue={supplier.email ?? ""}
            details="Used for purchase orders in a future update."
          />
          <s-button type="submit" {...(saving ? { loading: true } : {})}>
            Save
          </s-button>
        </s-stack>
      </fetcher.Form>
    </s-section>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
