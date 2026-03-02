// app/routes/api.debug.tsx

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Get database settings
  const campaign = await prisma.campaign.findUnique({ where: { shop } });

  // 2. Get metafields from Shopify
  const response = await admin.graphql(`
    query {
      shop {
        id
        metafields(first: 20, namespace: "cart_timer") {
          edges {
            node {
              key
              value
              namespace
            }
          }
        }
      }
    }
  `);
  const data = await response.json();

  return new Response(
    JSON.stringify({
      database: campaign,
      metafields: data.data?.shop?.metafields?.edges?.map((e: any) => e.node) || [],
      shopId: data.data?.shop?.id,
    }, null, 2),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};