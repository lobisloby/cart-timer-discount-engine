import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import db from "../db.server";

/** Best-effort: cancel recurring app charges while the offline token is still in session storage. */
async function cancelActiveAppSubscriptions(shop: string) {
  try {
    const { admin } = await unauthenticated.admin(shop);
    const listRes = await admin.graphql(
      `#graphql
        query SubscriptionsForCancel {
          currentAppInstallation {
            activeSubscriptions {
              id
              status
            }
          }
        }
      `,
    );
    const listJson = (await listRes.json()) as {
      data?: {
        currentAppInstallation?: {
          activeSubscriptions?: Array<{ id: string; status: string }>;
        };
      };
      errors?: unknown[];
    };
    if (listJson.errors?.length) {
      console.error("💳 Uninstall list subscriptions:", listJson.errors);
      return;
    }
    const subs =
      listJson.data?.currentAppInstallation?.activeSubscriptions ?? [];
    for (const sub of subs) {
      if (sub.status !== "ACTIVE") continue;
      const cancelRes = await admin.graphql(
        `#graphql
          mutation CancelAppSubscription($id: ID!) {
            appSubscriptionCancel(subscriptionId: $id, prorate: false) {
              userErrors {
                field
                message
              }
            }
          }
        `,
        { variables: { id: sub.id } },
      );
      const cancelJson = (await cancelRes.json()) as {
        data?: {
          appSubscriptionCancel?: {
            userErrors?: Array<{ message: string }>;
          };
        };
      };
      const errs = cancelJson.data?.appSubscriptionCancel?.userErrors;
      if (errs?.length) {
        console.error("💳 appSubscriptionCancel userErrors:", errs);
      }
    }
  } catch (e) {
    console.error("💳 Uninstall cancel subscriptions:", e);
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Cancel while offline session still exists in DB (before deleteMany below).
  await cancelActiveAppSubscriptions(shop);

  // Remove shop row so the next install gets a fresh `installedAt` and full trial window.
  await db.timerSession.deleteMany({ where: { shop } });
  await db.campaign.deleteMany({ where: { shop } });
  await db.shop.deleteMany({ where: { shop } });

  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
