// app/routes/api.settings.tsx

import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

// This endpoint returns campaign settings for the storefront widget
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    // Get shop from query parameter
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return new Response(
        JSON.stringify({ error: "Missing shop parameter" }),
        { status: 400, headers }
      );
    }

    // Get campaign settings
    const campaign = await prisma.campaign.findUnique({
      where: { shop },
    });

    // If no campaign or not enabled
    if (!campaign || !campaign.enabled) {
      return new Response(
        JSON.stringify({ 
          enabled: false,
          message: "Campaign not active" 
        }),
        { status: 200, headers }
      );
    }

    // Return settings
    return new Response(
      JSON.stringify({
        enabled: true,
        discountPercent: campaign.discountPercent,
        timerMinutes: campaign.timerMinutes,
        displayStyle: campaign.displayStyle,
        primaryColor: campaign.primaryColor,
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Settings API error:", error);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers }
    );
  }
};