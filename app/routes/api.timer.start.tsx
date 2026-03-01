// app/routes/api.timer.start.tsx

import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";

// This endpoint is called by the storefront widget to start/get timer
export const action = async ({ request }: ActionFunctionArgs) => {
  // CORS headers for storefront requests
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    const body = await request.json();
    const { shop, cartToken } = body;

    if (!shop || !cartToken) {
      return new Response(
        JSON.stringify({ error: "Missing shop or cartToken" }),
        { status: 400, headers }
      );
    }

    // Get campaign settings for this shop
    const campaign = await prisma.campaign.findUnique({
      where: { shop },
    });

    // If no campaign or not enabled, return inactive
    if (!campaign || !campaign.enabled) {
      return new Response(
        JSON.stringify({ active: false }),
        { status: 200, headers }
      );
    }

    // Check for existing timer session
    let timerSession = await prisma.timerSession.findUnique({
      where: {
        shop_cartToken: { shop, cartToken },
      },
    });

    const now = new Date();

    // If existing session
    if (timerSession) {
      // Check if expired
      if (timerSession.expiresAt <= now || timerSession.isExpired) {
        return new Response(
          JSON.stringify({ 
            active: true,
            expired: true,
            message: "Timer has expired" 
          }),
          { status: 200, headers }
        );
      }

      // Return existing session
      return new Response(
        JSON.stringify({
          active: true,
          expired: false,
          expiresAt: timerSession.expiresAt.toISOString(),
          discountCode: timerSession.discountCode,
        }),
        { status: 200, headers }
      );
    }

    // Create new timer session
    const expiresAt = new Date(now.getTime() + campaign.timerMinutes * 60 * 1000);
    const discountCode = `TIMER${campaign.discountPercent}-${Date.now().toString(36).toUpperCase()}`;

    timerSession = await prisma.timerSession.create({
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
        active: true,
        expired: false,
        expiresAt: timerSession.expiresAt.toISOString(),
        discountCode: timerSession.discountCode,
        isNew: true,
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Timer start error:", error);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers }
    );
  }
};

// Handle GET requests (for testing)
export const loader = async () => {
  return new Response(
    JSON.stringify({ message: "Timer API - Use POST to start timer" }),
    { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    }
  );
};