// app/routes/api.timer.restart.tsx

import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";

// This endpoint allows restarting a timer (limited restarts could be added)
export const action = async ({ request }: ActionFunctionArgs) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    const body = await request.json();
    const { shop, cartToken } = body;

    if (!shop || !cartToken) {
      return new Response(
        JSON.stringify({ error: "Missing data" }),
        { status: 400, headers }
      );
    }

    // Get campaign settings
    const campaign = await prisma.campaign.findUnique({
      where: { shop },
    });

    if (!campaign || !campaign.enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: "Campaign not active" }),
        { status: 200, headers }
      );
    }

    // Delete old session and create new one
    await prisma.timerSession.deleteMany({
      where: { shop, cartToken },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + campaign.timerMinutes * 60 * 1000);
    const discountCode = `TIMER${campaign.discountPercent}-${Date.now().toString(36).toUpperCase()}`;

    const newSession = await prisma.timerSession.create({
      data: {
        shop,
        cartToken,
        expiresAt,
        discountCode,
        isExpired: false,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: newSession.expiresAt.toISOString(),
        discountCode: newSession.discountCode,
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Timer restart error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { status: 500, headers }
    );
  }
};