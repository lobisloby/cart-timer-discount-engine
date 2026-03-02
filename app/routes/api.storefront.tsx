// app/routes/api.storefront.tsx

import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import crypto from "crypto";

// Verify the request comes from Shopify (security)
function verifyProxy(query: URLSearchParams): boolean {
  const signature = query.get("signature");
  if (!signature) return false;

  const secret = process.env.SHOPIFY_API_SECRET || "";

  // Build the query string without signature
  const params: string[] = [];
  query.forEach((value, key) => {
    if (key !== "signature") {
      params.push(`${key}=${value}`);
    }
  });
  params.sort();

  const computed = crypto
    .createHmac("sha256", secret)
    .update(params.join(""))
    .digest("hex");

  return computed === signature;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const path = url.searchParams.get("path_prefix");

    console.log("📡 Proxy request from shop:", shop);

    if (!shop) {
      return new Response(
        JSON.stringify({ error: "Missing shop" }),
        { status: 400, headers }
      );
    }

    // Get campaign from database
    const campaign = await prisma.campaign.findUnique({
      where: { shop },
    });

    if (!campaign || !campaign.enabled) {
      console.log("⏸️ Campaign not active for:", shop);
      return new Response(
        JSON.stringify({ enabled: false }),
        { status: 200, headers }
      );
    }

    console.log("✅ Returning settings for:", shop, campaign);

    return new Response(
      JSON.stringify({
        enabled: true,
        discountPercent: campaign.discountPercent,
        timerMinutes: campaign.timerMinutes,
        displayStyle: campaign.displayStyle,
        primaryColor: campaign.primaryColor,
        timerStyle: campaign.timerStyle,
        urgencyText: campaign.urgencyText,
        footerText: campaign.footerText,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers }
    );
  }
};