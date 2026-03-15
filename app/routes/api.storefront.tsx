// app/routes/api.storefront.tsx

import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache, no-store",
  "Access-Control-Allow-Origin": "*",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

// ── DISCOUNT HELPERS ──

async function activateShopifyDiscount(shop: string, discountId: string) {
  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(
      `#graphql
      mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: discountId,
          basicCodeDiscount: {
            endsAt: null,
          },
        },
      },
    );
    const result = await response.json();
    const errors = result.data?.discountCodeBasicUpdate?.userErrors;
    if (errors?.length > 0) {
      console.error("⚠️ Activate discount errors:", errors);
    } else {
      console.log("✅ Discount activated:", discountId);
    }
  } catch (e) {
    console.error("⚠️ Failed to activate discount:", e);
  }
}

async function deactivateShopifyDiscount(shop: string, discountId: string) {
  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(
      `#graphql
      mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: discountId,
          basicCodeDiscount: {
            endsAt: new Date().toISOString(),
          },
        },
      },
    );
    const result = await response.json();
    const errors = result.data?.discountCodeBasicUpdate?.userErrors;
    if (errors?.length > 0) {
      console.error("⚠️ Deactivate discount errors:", errors);
    } else {
      console.log("🔒 Discount deactivated:", discountId);
    }
  } catch (e) {
    console.error("⚠️ Failed to deactivate discount:", e);
  }
}

async function countActiveTimers(shop: string): Promise<number> {
  return prisma.timerSession.count({
    where: {
      shop,
      isExpired: false,
      expiresAt: { gt: new Date() },
    },
  });
}

// ── MAIN LOADER ──

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "settings";
  const shop = url.searchParams.get("shop") || "";
  const vid = url.searchParams.get("vid") || "";

  console.log(`📡 Proxy: action=${action} shop=${shop} vid=${vid}`);

  if (!shop) return json({ error: "Missing shop" }, 400);

  try {
    // ── GET CAMPAIGN SETTINGS ──
    if (action === "settings") {
      const campaign = await prisma.campaign.findUnique({ where: { shop } });

      if (!campaign || !campaign.enabled) {
        return json({ enabled: false });
      }

      return json({
        enabled: true,
        discountPercent: campaign.discountPercent,
        timerMinutes: campaign.timerMinutes,
        primaryColor: campaign.primaryColor,
        timerStyle: campaign.timerStyle,
        urgencyText: campaign.urgencyText,
        footerText: campaign.footerText,
        discountCode: campaign.discountCode || null,
      });
    }

    // ── START OR RESUME TIMER ──
    if (action === "start") {
      if (!vid) return json({ error: "Missing vid" }, 400);

      const campaign = await prisma.campaign.findUnique({ where: { shop } });
      if (!campaign || !campaign.enabled) {
        return json({ enabled: false });
      }

      const existing = await prisma.timerSession.findUnique({
        where: { shop_visitorId: { shop, visitorId: vid } },
      });

      const now = new Date();

      if (existing) {
        if (!existing.isExpired && existing.expiresAt > now) {
          // Timer still active — ensure discount is active too
          if (campaign.shopifyDiscountId) {
            await activateShopifyDiscount(shop, campaign.shopifyDiscountId);
          }

          return json({
            status: "active",
            expiresAt: existing.expiresAt.toISOString(),
            discountPct: existing.discountPct,
            timerMinutes: existing.timerMinutes,
            remainingMs: existing.expiresAt.getTime() - now.getTime(),
            discountCode: campaign.discountCode || null,
          });
        }

        if (existing.cooldownUntil && existing.cooldownUntil > now) {
          return json({
            status: "cooldown",
            cooldownUntil: existing.cooldownUntil.toISOString(),
            remainingMs: existing.cooldownUntil.getTime() - now.getTime(),
          });
        }

        // Restart timer
        const newExpiry = new Date(
          now.getTime() + campaign.timerMinutes * 60 * 1000,
        );
        const updated = await prisma.timerSession.update({
          where: { id: existing.id },
          data: {
            expiresAt: newExpiry,
            discountPct: campaign.discountPercent,
            timerMinutes: campaign.timerMinutes,
            isExpired: false,
            cooldownUntil: null,
          },
        });

        // Reactivate discount
        if (campaign.shopifyDiscountId) {
          await activateShopifyDiscount(shop, campaign.shopifyDiscountId);
        }

        return json({
          status: "active",
          expiresAt: updated.expiresAt.toISOString(),
          discountPct: updated.discountPct,
          timerMinutes: updated.timerMinutes,
          remainingMs: updated.expiresAt.getTime() - now.getTime(),
          discountCode: campaign.discountCode || null,
          isNew: true,
        });
      }

      // Brand new timer
      const expiresAt = new Date(
        now.getTime() + campaign.timerMinutes * 60 * 1000,
      );
      const session = await prisma.timerSession.create({
        data: {
          shop,
          visitorId: vid,
          expiresAt,
          discountPct: campaign.discountPercent,
          timerMinutes: campaign.timerMinutes,
          isExpired: false,
        },
      });

      // Ensure discount is active
      if (campaign.shopifyDiscountId) {
        await activateShopifyDiscount(shop, campaign.shopifyDiscountId);
      }

      return json({
        status: "active",
        expiresAt: session.expiresAt.toISOString(),
        discountPct: session.discountPct,
        timerMinutes: session.timerMinutes,
        remainingMs: session.expiresAt.getTime() - now.getTime(),
        discountCode: campaign.discountCode || null,
        isNew: true,
      });
    }

    // ── EXPIRE TIMER ──
    if (action === "expire") {
      if (!vid) return json({ error: "Missing vid" }, 400);

      const existing = await prisma.timerSession.findUnique({
        where: { shop_visitorId: { shop, visitorId: vid } },
      });

      if (!existing) return json({ status: "not_found" });

      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await prisma.timerSession.update({
        where: { id: existing.id },
        data: {
          isExpired: true,
          cooldownUntil,
        },
      });

      console.log(
        "⏰ Timer expired for:",
        vid,
        "Cooldown until:",
        cooldownUntil,
      );

      // Check if ANY other active timers remain for this shop
      const activeCount = await countActiveTimers(shop);
      console.log("📊 Active timers remaining for shop:", activeCount);

      if (activeCount === 0) {
        // No one else is using the discount — deactivate it
        const campaign = await prisma.campaign.findUnique({ where: { shop } });
        if (campaign?.shopifyDiscountId) {
          await deactivateShopifyDiscount(shop, campaign.shopifyDiscountId);
          console.log(
            "🔒 No active timers — discount deactivated for shop:",
            shop,
          );
        }
      }

      return json({
        status: "expired",
        cooldownUntil: cooldownUntil.toISOString(),
        cooldownMs: 24 * 60 * 60 * 1000,
      });
    }

    // ── CHECK STATUS ──
    if (action === "status") {
      if (!vid) return json({ error: "Missing vid" }, 400);

      const existing = await prisma.timerSession.findUnique({
        where: { shop_visitorId: { shop, visitorId: vid } },
      });

      if (!existing) return json({ status: "none" });

      const now = new Date();

      if (!existing.isExpired && existing.expiresAt > now) {
        return json({
          status: "active",
          expiresAt: existing.expiresAt.toISOString(),
          discountPct: existing.discountPct,
          remainingMs: existing.expiresAt.getTime() - now.getTime(),
        });
      }

      if (existing.cooldownUntil && existing.cooldownUntil > now) {
        return json({
          status: "cooldown",
          cooldownUntil: existing.cooldownUntil.toISOString(),
          remainingMs: existing.cooldownUntil.getTime() - now.getTime(),
        });
      }

      return json({ status: "ready" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Proxy error:", error);
    return json({ error: "Server error" }, 500);
  }
};