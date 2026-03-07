// app/routes/app.billing.tsx

import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, PLAN_NAME } from "../shopify.server";
import prisma from "../db.server";
import { Shield, CreditCard, Clock, Check } from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const shopRecord = await prisma.shop.findUnique({ where: { shop } });

  // Calculate trial info
  const installedAt = shopRecord
    ? new Date(shopRecord.installedAt)
    : new Date();
  const trialEndDate = new Date(installedAt);
  trialEndDate.setDate(trialEndDate.getDate() + 7);
  const now = new Date();
  const daysLeft = Math.max(
    0,
    Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  // Check Shopify subscription
  let billingInfo = null;
  try {
    const response = await admin.graphql(
      `#graphql
        query {
          currentAppInstallation {
            activeSubscriptions {
              name
              status
              trialDays
              test
              createdAt
              currentPeriodEnd
              lineItems {
                plan {
                  pricingDetails {
                    ... on AppRecurringPricing {
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
    );

    const data = await response.json();
    const subs =
      data.data?.currentAppInstallation?.activeSubscriptions || [];

    if (subs.length > 0) {
      const sub = subs[0];
      const pricing = sub.lineItems?.[0]?.plan?.pricingDetails;
      billingInfo = {
        name: sub.name,
        status: sub.status,
        amount: pricing?.price?.amount || "4.99",
        currencyCode: pricing?.price?.currencyCode || "USD",
        isTest: sub.test || false,
        currentPeriodEnd: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : null,
      };
    }
  } catch (e) {
    console.error("💳 Billing page error:", e);
  }

  return {
    billingInfo,
    planName: PLAN_NAME,
    daysLeft,
    trialEndDate: trialEndDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    installedAt: installedAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    plan: shopRecord?.plan || "trial",
  };
};

const S = {
  page: {
    maxWidth: "640px",
    margin: "0 auto",
    padding: "24px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 4px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  } as React.CSSProperties,
  sub: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0 0 24px",
  } as React.CSSProperties,
  card: {
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  } as React.CSSProperties,
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  } as React.CSSProperties,
  icon: (bg: string) =>
    ({
      width: "36px",
      height: "36px",
      borderRadius: "9px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: bg,
      flexShrink: 0,
    }) as React.CSSProperties,
  cardTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
  } as React.CSSProperties,
  cardDesc: {
    fontSize: "13px",
    color: "#64748b",
    margin: "2px 0 0",
  } as React.CSSProperties,
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
  } as React.CSSProperties,
  rowLast: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
  } as React.CSSProperties,
  rowLabel: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#64748b",
  } as React.CSSProperties,
  rowValue: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#0f172a",
  } as React.CSSProperties,
  badge: (color: string, bg: string) =>
    ({
      fontSize: "12px",
      fontWeight: 600,
      color,
      background: bg,
      padding: "4px 12px",
      borderRadius: "20px",
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
    }) as React.CSSProperties,
  backButton: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#6366f1",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    marginBottom: "20px",
    padding: 0,
  } as React.CSSProperties,
};

export default function BillingPage() {
  const { billingInfo, planName, daysLeft, trialEndDate, installedAt, plan } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isPro = plan === "pro" || !!billingInfo;

  return (
    <div style={S.page}>
      <button onClick={() => navigate("/app")} style={S.backButton}>
        ← Back to Dashboard
      </button>

      <h1 style={S.heading}>
        <CreditCard size={26} color="#6366f1" /> Billing & Subscription
      </h1>
      <p style={S.sub}>Manage your plan</p>

      {/* Current Plan */}
      <div style={S.card}>
        <div style={S.cardHead}>
          <div style={S.icon("#eef2ff")}>
            <Shield size={18} color="#6366f1" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={S.cardTitle}>{isPro ? planName : "Free Trial"}</p>
            <p style={S.cardDesc}>
              {isPro ? "Active subscription" : "Trial period"}
            </p>
          </div>
          <span
            style={S.badge(
              isPro ? "#16a34a" : daysLeft > 0 ? "#d97706" : "#dc2626",
              isPro ? "#dcfce7" : daysLeft > 0 ? "#fef3c7" : "#fef2f2",
            )}
          >
            <Check size={12} />
            {isPro ? "PRO" : daysLeft > 0 ? "TRIAL" : "EXPIRED"}
          </span>
        </div>

        <div style={S.row}>
          <span style={S.rowLabel}>Plan</span>
          <span style={S.rowValue}>
            {isPro ? `$${billingInfo?.amount || "4.99"}/month` : "Free Trial"}
          </span>
        </div>

        <div style={S.row}>
          <span style={S.rowLabel}>Installed On</span>
          <span style={S.rowValue}>{installedAt}</span>
        </div>

        {!isPro && (
          <div style={S.row}>
            <span style={S.rowLabel}>Trial Ends</span>
            <span
              style={{
                ...S.rowValue,
                color: daysLeft <= 2 ? "#dc2626" : "#d97706",
              }}
            >
              {trialEndDate} ({daysLeft} {daysLeft === 1 ? "day" : "days"} left)
            </span>
          </div>
        )}

        {billingInfo?.currentPeriodEnd && (
          <div style={S.row}>
            <span style={S.rowLabel}>Current Period Ends</span>
            <span style={S.rowValue}>{billingInfo.currentPeriodEnd}</span>
          </div>
        )}

        <div style={S.rowLast}>
          <span style={S.rowLabel}>Mode</span>
          <span style={S.rowValue}>
            {billingInfo?.isTest ? "🧪 Test" : isPro ? "💳 Live" : "🆓 Free"}
          </span>
        </div>
      </div>

      {/* How to manage */}
      <div style={{ ...S.card, background: "#f8fafc", borderColor: "#e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <Clock
            size={18}
            color="#64748b"
            style={{ marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              {isPro ? "How to cancel" : "How to upgrade"}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "13px",
                color: "#64748b",
                lineHeight: "1.5",
              }}
            >
              {isPro
                ? "Shopify Admin → Settings → Apps and sales channels → This app → Cancel subscription"
                : "When your trial ends, you'll be prompted to subscribe. $4.99/month, cancel anytime."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};