// app/routes/app.billing.tsx

import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, PLAN_NAME } from "../shopify.server";
import prisma from "../db.server";
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
} from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const shopRecord = await prisma.shop.findUnique({ where: { shop } });

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
    const subs = data.data?.currentAppInstallation?.activeSubscriptions || [];

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

export default function BillingPage() {
  const { billingInfo, planName, daysLeft, trialEndDate, installedAt, plan } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isPro = plan === "pro" || !!billingInfo;

  return (
    <div
      style={{
        maxWidth: "560px",
        margin: "0 auto",
        padding: "32px 24px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <button
        onClick={() => navigate("/app")}
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "#6b7280",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "24px",
          padding: 0,
        }}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "#111827",
            margin: "0 0 6px",
          }}
        >
          Billing
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
          Manage your subscription
        </p>
      </div>

      {/* Current Plan Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: isPro ? "#f0fdf4" : "#fef3c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard size={20} color={isPro ? "#16a34a" : "#d97706"} />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {isPro ? planName : "Free Trial"}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                {isPro
                  ? `$${billingInfo?.amount || "4.99"}/month`
                  : `${daysLeft} days remaining`}
              </p>
            </div>
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: isPro ? "#16a34a" : daysLeft > 2 ? "#d97706" : "#dc2626",
              background: isPro
                ? "#f0fdf4"
                : daysLeft > 2
                  ? "#fef3c7"
                  : "#fef2f2",
              padding: "4px 10px",
              borderRadius: "6px",
            }}
          >
            {isPro ? "Active" : daysLeft > 0 ? "Trial" : "Expired"}
          </span>
        </div>

        <div style={{ padding: "16px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <span style={{ fontSize: "14px", color: "#6b7280" }}>
              Installed
            </span>
            <span
              style={{ fontSize: "14px", fontWeight: 500, color: "#111827" }}
            >
              {installedAt}
            </span>
          </div>

          {!isPro && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <span style={{ fontSize: "14px", color: "#6b7280" }}>
                Trial ends
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: daysLeft <= 2 ? "#dc2626" : "#111827",
                }}
              >
                {trialEndDate}
              </span>
            </div>
          )}

          {billingInfo?.currentPeriodEnd && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <span style={{ fontSize: "14px", color: "#6b7280" }}>
                Next billing
              </span>
              <span
                style={{ fontSize: "14px", fontWeight: 500, color: "#111827" }}
              >
                {billingInfo.currentPeriodEnd}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
            }}
          >
            <span style={{ fontSize: "14px", color: "#6b7280" }}>Mode</span>
            <span
              style={{ fontSize: "14px", fontWeight: 500, color: "#111827" }}
            >
              {billingInfo?.isTest ? "Test" : isPro ? "Live" : "Free"}
            </span>
          </div>
        </div>
      </div>

      {/* Help Card */}
      <div
        style={{
          background: "#f9fafb",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <HelpCircle
            size={18}
            color="#6b7280"
            style={{ marginTop: "1px", flexShrink: 0 }}
          />
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              {isPro ? "Need to cancel?" : "Ready to upgrade?"}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "13px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              {isPro
                ? "Go to Shopify Admin → Settings → Apps and sales channels → Cart Timer → Cancel subscription"
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
