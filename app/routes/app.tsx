// app/routes/app.tsx

import type {
  HeadersFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import { Outlet, useLoaderData, useRouteError, useFetcher } from "react-router";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate, PLAN_NAME } from "../shopify.server";
import prisma from "../db.server";

// ============================================
// LOADER
// ============================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Track install date
  let shopRecord = await prisma.shop.findUnique({ where: { shop } });
  if (!shopRecord) {
    shopRecord = await prisma.shop.create({
      data: { shop, plan: "trial" },
    });
    console.log("💳 New shop registered:", shop);
  }

  // Calculate trial
  const now = new Date();
  const installedAt = new Date(shopRecord.installedAt);
  const trialEndDate = new Date(installedAt);
  trialEndDate.setDate(trialEndDate.getDate() + 7);
  const daysLeft = Math.max(
    0,
    Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const trialExpired = daysLeft <= 0;

  // Check Shopify subscription
  let hasSubscription = false;
  let billingAvailable = false;

  if (shopRecord.plan === "pro") {
    hasSubscription = true;
    billingAvailable = true;
  } else {
    try {
      const response = await admin.graphql(
        `#graphql
          query {
            currentAppInstallation {
              activeSubscriptions {
                name
                status
              }
            }
          }
        `,
      );
      const data = await response.json();
      const subs = data.data?.currentAppInstallation?.activeSubscriptions || [];

      billingAvailable = true;

      hasSubscription = subs.some(
        (s: any) => s.status === "ACTIVE" && s.name === PLAN_NAME,
      );

      if (hasSubscription && shopRecord.plan !== "pro") {
        await prisma.shop.update({
          where: { shop },
          data: { plan: "pro" },
        });
      }
    } catch (e) {
      console.error("💳 Subscription check failed:", (e as Error).message);
      billingAvailable = false;
    }
  }

  const isDev = process.env.NODE_ENV !== "production";

  console.log(
    `💳 ${shop} | Plan: ${shopRecord.plan} | Days left: ${daysLeft} | Subscribed: ${hasSubscription} | Billing available: ${billingAvailable} | Dev: ${isDev}`,
  );

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    trialExpired,
    daysLeft,
    hasSubscription,
    billingAvailable,
    isDev,
    shop,
  };
};

// ============================================
// ACTION — create subscription
// ============================================
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const shopName = session.shop.replace(".myshopify.com", "");
  const returnUrl = `https://admin.shopify.com/store/${shopName}/apps/${process.env.SHOPIFY_API_KEY}`;
  const isTest = process.env.NODE_ENV !== "production";

  try {
    const response = await admin.graphql(
      `#graphql
        mutation CreateSubscription(
          $name: String!
          $returnUrl: URL!
          $test: Boolean!
        ) {
          appSubscriptionCreate(
            name: $name
            returnUrl: $returnUrl
            test: $test
            trialDays: 0
            lineItems: [
              {
                plan: {
                  appRecurringPricingDetails: {
                    price: { amount: 4.99, currencyCode: USD }
                    interval: EVERY_30_DAYS
                  }
                }
              }
            ]
          ) {
            appSubscription {
              id
            }
            confirmationUrl
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          name: PLAN_NAME,
          returnUrl,
          test: isTest,
        },
      },
    );

    const data = await response.json();
    const result = data.data?.appSubscriptionCreate;

    if (result?.userErrors?.length > 0) {
      const errorMsg = result.userErrors.map((e: any) => e.message).join(", ");

      if (errorMsg.includes("public distribution")) {
        return {
          error:
            "Billing not ready — go to partners.shopify.com → Apps → Distribution → Select Public or Custom → then run: shopify app deploy",
        };
      }
      return { error: errorMsg };
    }

    if (result?.confirmationUrl) {
      return { confirmationUrl: result.confirmationUrl };
    }

    return { error: "No confirmation URL returned" };
  } catch (e) {
    return { error: (e as Error).message };
  }
};

// ============================================
// COMPONENT
// ============================================
export default function App() {
  const { apiKey, trialExpired, daysLeft, hasSubscription, billingAvailable,isDev} =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  // Redirect to Shopify billing page
  useEffect(() => {
    if (
      fetcher.data &&
      "confirmationUrl" in fetcher.data &&
      fetcher.data.confirmationUrl
    ) {
      window.open(fetcher.data.confirmationUrl, "_top");
    }
  }, [fetcher.data]);

  // ───────────────────────────────────────────
  // TRIAL EXPIRED + NO SUBSCRIPTION + BILLING WORKS
  // → Block with paywall
  // ───────────────────────────────────────────
  if (trialExpired && !hasSubscription && billingAvailable) {
    const isLoading = fetcher.state !== "idle";
    const error =
      fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

    return (
      <AppProvider embedded apiKey={apiKey}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            background: "linear-gradient(135deg, #f8fafc 0%, #fef2f2 100%)",
          }}
        >
          <div
            style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "20px",
                background: "linear-gradient(135deg, #ef4444, #f97316)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                fontSize: "36px",
                boxShadow: "0 8px 32px rgba(239, 68, 68, 0.3)",
              }}
            >
              ⏰
            </div>

            <h1
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: "#0f172a",
                margin: "0 0 8px",
              }}
            >
              Your Free Trial Has Ended
            </h1>
            <p
              style={{
                fontSize: "16px",
                color: "#64748b",
                margin: "0 0 32px",
                lineHeight: "1.5",
              }}
            >
              Subscribe to continue using Cart Timer Discount Engine
            </p>

            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "28px",
                marginBottom: "20px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#6366f1",
                  background: "#eef2ff",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  display: "inline-block",
                  marginBottom: "16px",
                }}
              >
                Pro Plan
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: "4px",
                  marginBottom: "24px",
                }}
              >
                <span
                  style={{
                    fontSize: "48px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  $4.99
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    color: "#94a3b8",
                    fontWeight: 500,
                  }}
                >
                  /month
                </span>
              </div>

              <div style={{ textAlign: "left", marginBottom: "24px" }}>
                {[
                  "Customizable countdown timer",
                  "Automatic discount code creation",
                  "3 beautiful timer styles",
                  "Custom colors & text",
                  "Real price discount on cart",
                  "24h cooldown protection",
                ].map((feature) => (
                  <div
                    key={feature}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 0",
                      borderBottom: "1px solid #f8fafc",
                    }}
                  >
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "6px",
                        background: "#dcfce7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ fontSize: "14px", color: "#374151" }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {error && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "10px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    color: "#dc2626",
                    textAlign: "left",
                    lineHeight: "1.5",
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              <fetcher.Form method="POST">
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "16px",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#fff",
                    background: isLoading
                      ? "#a5b4fc"
                      : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    borderRadius: "12px",
                    cursor: isLoading ? "default" : "pointer",
                    boxShadow: isLoading
                      ? "none"
                      : "0 4px 16px rgba(99, 102, 241, 0.4)",
                  }}
                >
                  {isLoading
                    ? "⏳ Setting up..."
                    : "🚀 Subscribe Now — $4.99/mo"}
                </button>
              </fetcher.Form>
            </div>
          </div>
        </div>
      </AppProvider>
    );
  }

  // ───────────────────────────────────────────
  // TRIAL ACTIVE OR SUBSCRIBED → Normal app
  // (Also: if billing not available, let them use the app)
  // ───────────────────────────────────────────
  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Trial banner — only show when on trial */}
      {!hasSubscription && daysLeft > 0 && (
        <div
          style={{
            padding: "10px 20px",
            background:
              daysLeft <= 2
                ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                : "linear-gradient(135deg, #eef2ff, #e0e7ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: daysLeft <= 2 ? "#92400e" : "#4338ca",
            borderBottom: "1px solid",
            borderColor: daysLeft <= 2 ? "#fde68a" : "#c7d2fe",
          }}
        >
          {daysLeft <= 2 ? "⚠️" : "⏱️"} Free trial: {daysLeft}{" "}
          {daysLeft === 1 ? "day" : "days"} remaining
        </div>
      )}

      {/* Trial expired but billing not available — warning for developer */}
      {trialExpired && !hasSubscription && !billingAvailable && (
        <div
          style={{
            padding: "10px 20px",
            background: "#fef2f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 500,
            color: "#dc2626",
            borderBottom: "1px solid #fecaca",
          }}
        >
          ⚠️ Trial expired but billing not configured — Set distribution at
          partners.shopify.com to enable payments
        </div>
      )}

      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/billing">Billing</s-link>
        {isDev && <s-link href="/app/debug">Debug</s-link>}
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
