import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`🏪 ${topic} received for ${shop} — deleting all data`);

  await prisma.timerSession.deleteMany({ where: { shop } });
  await prisma.campaign.deleteMany({ where: { shop } });
  await prisma.shop.deleteMany({ where: { shop } });

  return new Response(null, { status: 200 });
};