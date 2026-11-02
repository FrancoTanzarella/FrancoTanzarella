import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "Reorder Assistant: know what to reorder" },
  {
    name: "description",
    content:
      "Simple reorder suggestions and supplier purchase orders for small Shopify stores.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Requests from the Shopify admin carry ?shop=; send them into the app.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

// Public page. Merchants install from the Shopify App Store, so there is no
// shop-domain login form here.
export default function Landing() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Reorder Assistant</h1>
        <p className={styles.text}>
          Know what to reorder in 2 minutes a week. Simple reorder suggestions
          and supplier purchase orders for small Shopify stores.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Reorder suggestions</strong>. See which products will run
            out, based on your recent sales, stock on hand and stock on the way.
          </li>
          <li>
            <strong>Grouped by supplier</strong>. Set a lead time per supplier
            and get one list per supplier with units and cost totals.
          </li>
          <li>
            <strong>Purchase orders in one click</strong>. Download a CSV
            purchase order per supplier, ready to send.
          </li>
        </ul>
        <p>
          <a href="/privacy">Privacy policy</a>
        </p>
      </div>
    </div>
  );
}
