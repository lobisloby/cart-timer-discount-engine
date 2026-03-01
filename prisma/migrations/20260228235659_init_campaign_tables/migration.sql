-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "discountPercent" INTEGER NOT NULL DEFAULT 10,
    "timerMinutes" INTEGER NOT NULL DEFAULT 10,
    "displayStyle" TEXT NOT NULL DEFAULT 'progress',
    "primaryColor" TEXT NOT NULL DEFAULT '#000000',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TimerSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "discountCode" TEXT,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_shop_key" ON "Campaign"("shop");

-- CreateIndex
CREATE INDEX "TimerSession_shop_idx" ON "TimerSession"("shop");

-- CreateIndex
CREATE INDEX "TimerSession_expiresAt_idx" ON "TimerSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimerSession_shop_cartToken_key" ON "TimerSession"("shop", "cartToken");
