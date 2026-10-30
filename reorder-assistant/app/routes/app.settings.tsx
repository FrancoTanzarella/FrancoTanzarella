import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, updateSettings } from "../models/settings.server";
import { MAX_SALES_WINDOW_DAYS } from "../lib/constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return getSettings(session.shop);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  await updateSettings(session.shop, {
    salesWindowDays: Number(form.get("salesWindowDays")),
    defaultLeadTimeDays: Number(form.get("defaultLeadTimeDays")),
    safetyDays: Number(form.get("safetyDays")),
    coverDays: Number(form.get("coverDays")),
  });
  return { saved: true };
};

export default function SettingsPage() {
  const settings = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const saving = useNavigation().state === "submitting";

  useEffect(() => {
    if (result?.saved) shopify.toast.show("Settings saved");
  }, [result]);

  return (
    <s-page heading="Settings">
      <Form method="post">
        <s-section heading="How suggestions are calculated">
          <s-stack direction="block" gap="base">
            <s-number-field
              label="Sales window (days)"
              name="salesWindowDays"
              defaultValue={String(settings.salesWindowDays)}
              min={7}
              max={MAX_SALES_WINDOW_DAYS}
              details={`Average daily sales are based on this many days (up to ${MAX_SALES_WINDOW_DAYS}).`}
            />
            <s-number-field
              label="Default lead time (days)"
              name="defaultLeadTimeDays"
              defaultValue={String(settings.defaultLeadTimeDays)}
              min={0}
              details="How long a supplier takes to deliver. Override it per supplier on the Suppliers page."
            />
            <s-number-field
              label="Safety stock (days)"
              name="safetyDays"
              defaultValue={String(settings.safetyDays)}
              min={0}
              details="Extra days of stock to keep in case sales spike or deliveries run late."
            />
            <s-number-field
              label="Order enough for (days)"
              name="coverDays"
              defaultValue={String(settings.coverDays)}
              min={1}
              details="How many days of sales each reorder should cover."
            />
            <s-button type="submit" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </s-section>
      </Form>
      <s-section slot="aside" heading="The formula">
        <s-paragraph>
          Reorder when available + incoming stock falls to (lead time + safety
          stock) × average daily sales.
        </s-paragraph>
        <s-paragraph>
          The suggested quantity tops stock back up to cover lead time, safety
          stock and the &quot;order enough for&quot; days.
        </s-paragraph>
        <s-paragraph>
          Changes apply immediately. A new sales window applies from the next
          sync.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
