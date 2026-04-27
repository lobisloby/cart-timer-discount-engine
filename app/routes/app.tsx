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
import { authenticate, PLAN_NAME, shouldUseTestBilling } from "../shopify.server";
import prisma from "../db.server";
import { computeTrialState } from "../lib/trial";
import {
  APP_SUBTITLE,
  APP_TITLE,
  BILLING_FEATURES,
  DEFAULT_PRICE_AMOUNT,
  currencySymbol,
  primaryCtaStyle,
  shell,
  splitPrice,
} from "../lib/billing-shell";
import {
  AlertTriangle,
  Check,
  Clock,
  Crown,
  Shield,
  Timer,
  Zap,
} from "lucide-react";

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

  // Always verify billing against Shopify — DB `plan` alone can be stale after uninstall/reinstall.
  let hasSubscription = false;
  let billingAvailable = false;

  try {
    const response = await admin.graphql(
      `#graphql
        query SubscriptionCheck {
          currentAppInstallation {
            activeSubscriptions {
              name
              status
            }
          }
        }
      `,
    );
    const data = (await response.json()) as {
      data?: {
        currentAppInstallation?: {
          activeSubscriptions?: Array<{ name: string; status: string }>;
        };
      };
    };
    const subs =
      data.data?.currentAppInstallation?.activeSubscriptions ?? [];

    billingAvailable = true;

    hasSubscription = subs.some(
      (row) => row.status === "ACTIVE" && row.name === PLAN_NAME,
    );

    if (hasSubscription) {
      if (shopRecord.plan !== "pro") {
        shopRecord = await prisma.shop.update({
          where: { shop },
          data: { plan: "pro" },
        });
      }
    } else if (shopRecord.plan === "pro") {
      shopRecord = await prisma.shop.update({
        where: { shop },
        data: { plan: "trial" },
      });
    }
  } catch (e) {
    console.error("💳 Subscription check failed:", (e as Error).message);
    billingAvailable = false;
    // Avoid blocking real subscribers if Shopify is briefly unavailable
    hasSubscription = shopRecord.plan === "pro";
  }

  const trial = computeTrialState(new Date(shopRecord.installedAt));

  const isDev = process.env.NODE_ENV !== "production";

  console.log(
    `💳 ${shop} | Plan: ${shopRecord.plan} | Days left: ${trial.daysLeft} | Subscribed: ${hasSubscription} | Billing available: ${billingAvailable} | Dev: ${isDev}`,
  );

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    trialExpired: trial.trialExpired,
    daysLeft: trial.daysLeft,
    trialEndDateFormatted: trial.trialEndDateFormatted,
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
  const isTest = shouldUseTestBilling(session.shop);

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
      const errorMsg = result.userErrors
        .map((e: { message: string }) => e.message)
        .join(", ");

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
  const {
    apiKey,
    trialExpired,
    daysLeft,
    trialEndDateFormatted,
    hasSubscription,
    billingAvailable,
    isDev,
  } = useLoaderData<typeof loader>();
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
  // → Block with paywall (same shell theme as billing)
  // ───────────────────────────────────────────
  if (trialExpired && !hasSubscription && billingAvailable) {
    const isLoading = fetcher.state !== "idle";
    const error =
      fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
    const { whole, cents } = splitPrice(DEFAULT_PRICE_AMOUNT);
    const sym = currencySymbol("USD");

    return (
      <AppProvider embedded apiKey={apiKey}>
        <div style={shell.page}>
          <div style={shell.header}>
            <div style={shell.logoMark}>
              <Timer size={24} color="#fafafa" strokeWidth={2.25} />
            </div>
            <h1 style={shell.title}>{APP_TITLE}</h1>
            <p style={shell.subtitle}>{APP_SUBTITLE}</p>
          </div>

          <div style={shell.card}>
            <div style={shell.cardAccent} />
            <div style={shell.cardInner}>
              <div style={shell.statusAhead}>
                <div style={shell.statusAheadExpired}>
                  <Clock size={22} color="#f87171" strokeWidth={2.25} />
                  <span>Trial ended</span>
                </div>
              </div>

              <div style={shell.planRow}>
                <div style={shell.planBadge}>
                  <Crown size={11} />
                  PRO
                </div>
                <div style={shell.planLabel}>{PLAN_NAME}</div>
              </div>

              <div style={shell.priceSection}>
                <span style={shell.dollar}>{sym}</span>
                <span style={shell.priceAmount}>{whole}</span>
                <span style={shell.priceCents}>{cents}</span>
                <span style={shell.priceInterval}>/mo</span>
              </div>

              <div style={shell.divider} />

              <div style={shell.featuresGrid}>
                {BILLING_FEATURES.map((feature) => (
                  <div key={feature} style={shell.featureItem}>
                    <div style={shell.checkIcon}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </div>
                    <span style={shell.featureText}>{feature}</span>
                  </div>
                ))}
              </div>

              <div style={shell.divider} />

              <div style={shell.metaBlock}>
                <div style={shell.metaRow}>
                  <span style={shell.metaKey}>Trial ended</span>
                  <span style={shell.metaVal}>{trialEndDateFormatted}</span>
                </div>
                <div style={shell.metaRowLast}>
                  <span style={shell.metaKey}>Next step</span>
                  <span style={shell.metaVal}>Subscribe to restore access</span>
                </div>
              </div>

              {error && (
                <div style={shell.errorBox}>⚠️ {error}</div>
              )}

              <fetcher.Form method="POST">
                <button
                  type="submit"
                  disabled={isLoading}
                  style={primaryCtaStyle(isLoading)}
                >
                  {isLoading
                    ? "⏳ Opening billing…"
                    : `Subscribe — ${sym}${DEFAULT_PRICE_AMOUNT}/mo`}
                </button>
              </fetcher.Form>
            </div>
          </div>

          <div style={shell.trustRow}>
            <div style={shell.trustItem}>
              <Shield size={14} color="#71717a" />
              <span style={shell.trustText}>Secure billing</span>
            </div>
            <span style={shell.trustDot}>•</span>
            <div style={shell.trustItem}>
              <Zap size={14} color="#71717a" />
              <span style={shell.trustText}>Quick setup</span>
            </div>
            <span style={shell.trustDot}>•</span>
            <div style={shell.trustItem}>
              <Clock size={14} color="#71717a" />
              <span style={shell.trustText}>Cancel anytime</span>
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
            background: "#18181b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#fafafa",
          }}
        >
          <Clock size={14} color={daysLeft <= 2 ? "#fbbf24" : "#a1a1aa"} />
          <span>
            {daysLeft <= 2 ? "⚠️ " : ""}Free trial:{" "}
            <strong>
              {daysLeft} {daysLeft === 1 ? "day" : "days"}
            </strong>{" "}
            remaining
          </span>
        </div>
      )}

      {/* Trial expired but billing not available — warning for developer */}
      {trialExpired && !hasSubscription && !billingAvailable && (
        <div
          style={{
            padding: "10px 20px",
            background: "#18181b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 500,
            color: "#fbbf24",
          }}
        >
          <AlertTriangle size={14} />
          Trial expired — Set distribution at partners.shopify.com to enable
          billing
        </div>
      )}

      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
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
