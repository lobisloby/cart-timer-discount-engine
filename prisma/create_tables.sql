CREATE TABLE IF NOT EXISTS "ct_sessions" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT,
  "expires" TIMESTAMP(3),
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN NOT NULL DEFAULT false,
  "locale" TEXT,
  "collaborator" BOOLEAN DEFAULT false,
  "emailVerified" BOOLEAN DEFAULT false,
  "refreshToken" TEXT,
  "refreshTokenExpires" TIMESTAMP(3),
  CONSTRAINT "ct_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ct_campaigns" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "discountPercent" INTEGER NOT NULL DEFAULT 10,
  "timerMinutes" INTEGER NOT NULL DEFAULT 10,
  "displayStyle" TEXT NOT NULL DEFAULT 'progress',
  "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
  "timerStyle" TEXT NOT NULL DEFAULT 'dark',
  "urgencyText" TEXT NOT NULL DEFAULT 'Hurry! This deal ends soon',
  "footerText" TEXT NOT NULL DEFAULT 'Your discount is reserved for you',
  "discountCode" TEXT,
  "shopifyDiscountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ct_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ct_campaigns_shop_key" ON "ct_campaigns"("shop");

CREATE TABLE IF NOT EXISTS "ct_timer_sessions" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "discountPct" INTEGER NOT NULL DEFAULT 10,
  "timerMinutes" INTEGER NOT NULL DEFAULT 10,
  "isExpired" BOOLEAN NOT NULL DEFAULT false,
  "cooldownUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ct_timer_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ct_timer_sessions_shop_visitorId_key" ON "ct_timer_sessions"("shop", "visitorId");
CREATE INDEX IF NOT EXISTS "ct_timer_sessions_shop_idx" ON "ct_timer_sessions"("shop");
CREATE INDEX IF NOT EXISTS "ct_timer_sessions_expiresAt_idx" ON "ct_timer_sessions"("expiresAt");

CREATE TABLE IF NOT EXISTS "ct_shops" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "plan" TEXT NOT NULL DEFAULT 'trial',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ct_shops_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ct_shops_shop_key" ON "ct_shops"("shop");
