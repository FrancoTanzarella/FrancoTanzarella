export function formatMoney(amount: number, currencyCode: string | null) {
  if (!currencyCode) return amount.toFixed(2);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

/** "gid://shopify/ProductVariant/123" -> "123" */
export function numericId(gid: string) {
  return gid.split("/").pop() ?? gid;
}

export function variantGid(id: string) {
  return `gid://shopify/ProductVariant/${id}`;
}

/**
 * Downloads the purchase order CSV. App Bridge adds the session token to
 * fetch requests made to the app's own origin, which a plain link would not.
 */
export async function downloadCsv(supplier?: string) {
  const params = new URLSearchParams();
  if (supplier) params.set("supplier", supplier);
  const response = await fetch(`/app/export?${params}`);
  if (!response.ok) {
    shopify.toast.show("Export failed", { isError: true });
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `purchase-order-${slug(supplier ?? "all")}-${today()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
