import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy policy | Reorder Assistant" },
];

export const loader = async () => {
  return { supportEmail: process.env.SUPPORT_EMAIL || null };
};

const LAST_UPDATED = "November 2, 2026";

// Public page linked from the App Store listing. Keep it in line with what
// the app actually reads and stores (see prisma/schema.prisma).
export default function Privacy() {
  const { supportEmail } = useLoaderData<typeof loader>();

  return (
    <main
      style={{
        maxWidth: "42rem",
        margin: "0 auto",
        padding: "2rem 1rem",
        lineHeight: 1.6,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Privacy policy</h1>
      <p>Last updated: {LAST_UPDATED}</p>
      <p>
        Reorder Assistant (&quot;the app&quot;) helps Shopify merchants decide
        what stock to reorder. This policy explains what data the app reads,
        what it stores, and how long it keeps it.
      </p>

      <h2>Data the app reads from Shopify</h2>
      <ul>
        <li>
          <strong>Products and variants</strong>: product and variant titles,
          SKU, vendor and unit cost.
        </li>
        <li>
          <strong>Inventory</strong>: available and incoming quantities.
        </li>
        <li>
          <strong>Orders from the last 60 days</strong>: only the products and
          quantities on each order, and whether the order was cancelled or a
          test. The app does not read customer names, email addresses, phone
          numbers or addresses.
        </li>
      </ul>

      <h2>Data the app stores</h2>
      <ul>
        <li>
          Your store&apos;s domain and the access token Shopify issues when you
          install the app.
        </li>
        <li>
          A snapshot of each product variant: titles, SKU, vendor, stock levels,
          unit cost and the total units sold in the sales window. Individual
          orders are not stored.
        </li>
        <li>
          Settings you enter: calculation settings, supplier lead times and
          email addresses, and per-product minimum, maximum and case pack.
        </li>
      </ul>
      <p>
        The app stores no personal information about your customers. Data is
        used only to show you reorder suggestions and purchase order exports. It
        is not sold, shared with third parties or used for advertising.
      </p>

      <h2>Where data is kept</h2>
      <p>
        Data is stored in the app&apos;s database at its hosting provider and is
        sent over encrypted (HTTPS) connections.
      </p>

      <h2>How long data is kept</h2>
      <p>
        When you uninstall the app, its access token is deleted straight away.
        Your settings and product snapshots are kept until Shopify sends its
        shop data deletion request, 48 hours after uninstall, and are then
        permanently deleted. Shopify also lets you or your customers request
        data through the app&apos;s privacy webhooks. Because the app holds no
        customer data, there is nothing to return or delete for customer
        requests.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data:{" "}
        {supportEmail ? (
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        ) : (
          "use the support email on our Shopify App Store listing"
        )}
        .
      </p>
    </main>
  );
}
