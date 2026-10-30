import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData } from "../models/shop-data.server";

// Mandatory privacy webhooks. The app stores no customer data, so customer
// requests need no action; shop/redact (sent 48 hours after uninstall)
// removes all of the shop's data.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await deleteShopData(shop);
  }

  return new Response();
};
