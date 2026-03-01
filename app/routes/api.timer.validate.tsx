// app/routes/api.timer.validate.tsx

import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";

// This endpoint validates if a timer is still valid (prevents refresh abuse)
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
        JSON.stringify({ valid: false, error: "Missing data" }),
        { status: 400, headers }
      );
    }

    // Find timer session
    const timerSession = await prisma.timerSession.findUnique({
      where: {
        shop_cartToken: { shop, cartToken },
      },
    });

    if (!timerSession) {
      return new Response(
        JSON.stringify({ valid: false, reason: "no_session" }),
        { status: 200, headers }
      );
    }

    const now = new Date();

    // Check if expired
    if (timerSession.expiresAt <= now) {
      // Mark as expired in database
      await prisma.timerSession.update({
        where: { id: timerSession.id },
        data: { isExpired: true },
      });

      return new Response(
        JSON.stringify({ valid: false, reason: "expired" }),
        { status: 200, headers }
      );
    }

    // Timer is valid
    return new Response(
      JSON.stringify({
        valid: true,
        expiresAt: timerSession.expiresAt.toISOString(),
        discountCode: timerSession.discountCode,
        remainingMs: timerSession.expiresAt.getTime() - now.getTime(),
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Timer validate error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Server error" }),
      { status: 500, headers }
    );
  }
};