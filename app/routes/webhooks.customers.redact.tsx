import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`🗑️ ${topic} received for ${shop}`);
  // FlashDrop does not store customer data — nothing to delete
  return new Response(null, { status: 200 });
};