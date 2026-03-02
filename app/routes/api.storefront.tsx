// app/routes/api.storefront.tsx

import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache, no-store",
  "Access-Control-Allow-Origin": "*",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

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
        // In the "start" action, after returning active status, add discountCode:
    // Find the campaign to get the discount code
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

        const newExpiry = new Date(now.getTime() + campaign.timerMinutes * 60 * 1000);
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

      const expiresAt = new Date(now.getTime() + campaign.timerMinutes * 60 * 1000);
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

    // ── EXPIRE TIMER (called when countdown hits 0) ──
    if (action === "expire") {
      if (!vid) return json({ error: "Missing vid" }, 400);

      const existing = await prisma.timerSession.findUnique({
        where: { shop_visitorId: { shop, visitorId: vid } },
      });

      if (!existing) return json({ status: "not_found" });

      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.timerSession.update({
        where: { id: existing.id },
        data: {
          isExpired: true,
          cooldownUntil,
        },
      });

      console.log("⏰ Timer expired for:", vid, "Cooldown until:", cooldownUntil);

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

      return json({ status: "ready" }); // Can start new timer
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Proxy error:", error);
    return json({ error: "Server error" }, 500);
  }
};