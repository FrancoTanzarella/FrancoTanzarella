-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "salesWindowDays" INTEGER NOT NULL DEFAULT 60,
    "defaultLeadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "safetyDays" INTEGER NOT NULL DEFAULT 7,
    "coverDays" INTEGER NOT NULL DEFAULT 30,
    "currencyCode" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "leadTimeDays" INTEGER
);

-- CreateTable
CREATE TABLE "VariantSetting" (
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "minQty" INTEGER,
    "maxQty" INTEGER,
    "casePack" INTEGER,
    "ignored" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("shop", "variantId")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "bulkOperationId" TEXT,
    "windowDays" INTEGER NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "error" TEXT,
    "lockedAt" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "VariantStat" (
    "jobId" INTEGER NOT NULL,
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "sku" TEXT,
    "vendor" TEXT NOT NULL,
    "available" INTEGER NOT NULL,
    "incoming" INTEGER NOT NULL,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "unitCost" REAL,

    PRIMARY KEY ("jobId", "variantId"),
    CONSTRAINT "VariantStat_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SyncJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_shop_name_key" ON "Supplier"("shop", "name");

-- CreateIndex
CREATE INDEX "SyncJob_shop_stage_idx" ON "SyncJob"("shop", "stage");

-- CreateIndex
CREATE INDEX "VariantStat_shop_idx" ON "VariantStat"("shop");
