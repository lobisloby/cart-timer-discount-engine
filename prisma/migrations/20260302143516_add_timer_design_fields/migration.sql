-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "discountPercent" INTEGER NOT NULL DEFAULT 10,
    "timerMinutes" INTEGER NOT NULL DEFAULT 10,
    "displayStyle" TEXT NOT NULL DEFAULT 'progress',
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "timerStyle" TEXT NOT NULL DEFAULT 'dark',
    "urgencyText" TEXT NOT NULL DEFAULT 'Hurry! This deal ends soon',
    "footerText" TEXT NOT NULL DEFAULT 'Your discount is reserved for you',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Campaign" ("createdAt", "discountPercent", "displayStyle", "enabled", "id", "primaryColor", "shop", "timerMinutes", "updatedAt") SELECT "createdAt", "discountPercent", "displayStyle", "enabled", "id", "primaryColor", "shop", "timerMinutes", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE UNIQUE INDEX "Campaign_shop_key" ON "Campaign"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
