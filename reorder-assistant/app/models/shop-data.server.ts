import db from "../db.server";

/** Removes everything the app stores for a shop. */
export async function deleteShopData(shop: string) {
  await db.$transaction([
    db.syncJob.deleteMany({ where: { shop } }),
    db.variantSetting.deleteMany({ where: { shop } }),
    db.supplier.deleteMany({ where: { shop } }),
    db.shopSettings.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);
}
