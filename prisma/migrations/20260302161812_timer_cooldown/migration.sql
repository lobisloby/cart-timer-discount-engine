/*
  Warnings:

  - You are about to drop the column `cartToken` on the `TimerSession` table. All the data in the column will be lost.
  - You are about to drop the column `discountCode` on the `TimerSession` table. All the data in the column will be lost.
  - Added the required column `visitorId` to the `TimerSession` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimerSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 10,
    "timerMinutes" INTEGER NOT NULL DEFAULT 10,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "cooldownUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TimerSession" ("createdAt", "expiresAt", "id", "isExpired", "shop") SELECT "createdAt", "expiresAt", "id", "isExpired", "shop" FROM "TimerSession";
DROP TABLE "TimerSession";
ALTER TABLE "new_TimerSession" RENAME TO "TimerSession";
CREATE INDEX "TimerSession_shop_idx" ON "TimerSession"("shop");
CREATE INDEX "TimerSession_expiresAt_idx" ON "TimerSession"("expiresAt");
CREATE UNIQUE INDEX "TimerSession_shop_visitorId_key" ON "TimerSession"("shop", "visitorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
