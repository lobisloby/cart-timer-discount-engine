// app/routes/app.billing.tsx

import type { CSSProperties } from "react";
import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, PLAN_NAME } from "../shopify.server";
import prisma from "../db.server";
import {
  ArrowLeft,
  Check,
  Shield,
  Zap,
  Clock,
  Crown,
  ExternalLink,
  Timer,
} from "lucide-react";

const DEFAULT_AMOUNT = "4.99";
const APP_TITLE = "Cart Timer";
const APP_SUBTITLE = "Countdown urgency and automatic cart discounts";

const FEATURES = [
  "Configurable cart countdown timer",
  "Automatic discount at checkout",
  "Custom colors & messaging",
  "FlashDrop theme extension",
  "Mobile responsive",
  "Works with Shopify Discounts API",
  "Live preview in admin",
  "No coding required",
];

function splitPrice(amount: string) {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) {
    return { whole: "4", cents: ".99" };
  }
  const [w, f = "00"] = n.toFixed(2).split(".");
  return { whole: w, cents: `.${f}` };
}

function currencySymbol(code: string) {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code === "GBP") return "£";
  return `${code} `;
}

// ============================================
// LOADER
// ============================================
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

    type GqlPayload = {
      errors?: unknown[];
      data?: {
        currentAppInstallation?: {
          activeSubscriptions?: Array<{
            name: string;
            status: string;
            trialDays?: number;
            test?: boolean;
            createdAt?: string;
            currentPeriodEnd?: string;
            lineItems?: Array<{
              plan?: {
                pricingDetails?: {
                  price?: { amount: number | string; currencyCode: string };
                };
              };
            }>;
          }>;
        };
      };
    };
    const payload = (await response.json()) as GqlPayload;
    if (payload.errors?.length) {
      console.error("💳 Billing GraphQL:", payload.errors);
    }

    const subs =
      payload.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const sub =
      subs.find(
        (s) => s.status === "ACTIVE" && s.name === PLAN_NAME,
      ) ??
      subs.find((s) => s.status === "ACTIVE") ??
      null;

    if (sub) {
      const pricing = sub.lineItems?.[0]?.plan?.pricingDetails;
      billingInfo = {
        name: sub.name,
        status: sub.status,
        amount: pricing?.price?.amount?.toString?.() ?? DEFAULT_AMOUNT,
        currencyCode: pricing?.price?.currencyCode ?? "USD",
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
    shop,
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

// ============================================
// COMPONENT
// ============================================
export default function BillingPage() {
  const {
    shop,
    billingInfo,
    planName,
    daysLeft,
    trialEndDate,
    installedAt,
    plan,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isPro = plan === "pro" || !!billingInfo;
  const displayAmount = billingInfo?.amount ?? DEFAULT_AMOUNT;
  const displayCurrency = billingInfo?.currencyCode ?? "USD";
  const { whole, cents } = splitPrice(displayAmount);
  const sym = currencySymbol(displayCurrency);

  return (
    <div style={styles.page}>
      <button
        type="button"
        onClick={() => navigate("/app")}
        style={styles.backButton}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoMark}>
          <Timer size={24} color="#fafafa" strokeWidth={2.25} />
        </div>
        <h1 style={styles.title}>{APP_TITLE}</h1>
        <p style={styles.subtitle}>{APP_SUBTITLE}</p>
      </div>

      {/* Card */}
      <div style={styles.card}>
        <div style={styles.cardAccent} />
        <div style={styles.cardInner}>
          <div style={styles.topRow}>
            <div style={styles.planBadge}>
              <Crown size={11} />
              PRO
            </div>
            {isPro ? (
              <div style={styles.activeBadge}>
                <Check size={12} strokeWidth={3} />
                Active
              </div>
            ) : daysLeft > 0 ? (
              <div style={styles.trialBadge}>
                <Clock size={12} />
                {daysLeft} day{daysLeft === 1 ? "" : "s"} left in trial
              </div>
            ) : (
              <div style={styles.expiredBadge}>
                <Clock size={12} />
                Trial ended
              </div>
            )}
          </div>

          <div style={styles.planLabel}>{planName}</div>

          <div style={styles.priceSection}>
            <span style={styles.dollar}>{sym}</span>
            <span style={styles.priceAmount}>{whole}</span>
            <span style={styles.priceCents}>{cents}</span>
            <span style={styles.priceInterval}>/mo</span>
          </div>

          <div style={styles.divider} />

          <div style={styles.featuresGrid}>
            {FEATURES.map((feature, i) => (
              <div key={i} style={styles.featureItem}>
                <div style={styles.checkIcon}>
                  <Check size={10} color="#fff" strokeWidth={3} />
                </div>
                <span style={styles.featureText}>{feature}</span>
              </div>
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.metaBlock}>
            <div style={styles.metaRow}>
              <span style={styles.metaKey}>Installed</span>
              <span style={styles.metaVal}>{installedAt}</span>
            </div>
            {!isPro && (
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Trial ends</span>
                <span
                  style={{
                    ...styles.metaVal,
                    color: daysLeft <= 2 ? "#f87171" : "#a1a1aa",
                  }}
                >
                  {trialEndDate}
                </span>
              </div>
            )}
            {billingInfo?.currentPeriodEnd && (
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Next billing</span>
                <span style={styles.metaVal}>
                  {billingInfo.currentPeriodEnd}
                </span>
              </div>
            )}
            <div style={{ ...styles.metaRow, borderBottom: "none" }}>
              <span style={styles.metaKey}>Mode</span>
              <span style={styles.metaVal}>
                {billingInfo?.isTest ? "Test" : isPro ? "Live" : "Trial"}
              </span>
            </div>
          </div>

          <a
            href={`https://${shop}/admin/settings/billing`}
            target="_top"
            rel="noreferrer"
            style={styles.manageButton}
          >
            Manage Subscription
            <ExternalLink size={14} />
          </a>
          <p style={styles.ctaNote}>Billed securely through Shopify</p>
        </div>
      </div>

      <div style={styles.trustRow}>
        <div style={styles.trustItem}>
          <Shield size={14} color="#71717a" />
          <span style={styles.trustText}>Secure billing</span>
        </div>
        <span style={styles.trustDot}>•</span>
        <div style={styles.trustItem}>
          <Zap size={14} color="#71717a" />
          <span style={styles.trustText}>Quick setup</span>
        </div>
        <span style={styles.trustDot}>•</span>
        <div style={styles.trustItem}>
          <Clock size={14} color="#71717a" />
          <span style={styles.trustText}>Cancel anytime</span>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

// ============================================
// STYLES
// ============================================
const styles: { [key: string]: CSSProperties } = {
  page: {
    maxWidth: "420px",
    margin: "0 auto",
    padding: "24px 16px 48px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  backButton: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#71717a",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "20px",
    padding: 0,
  },

  header: {
    textAlign: "center",
    marginBottom: "24px",
  },
  logoMark: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    margin: "0 auto 12px",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#18181b",
    margin: "0 0 4px 0",
  },
  subtitle: {
    fontSize: "13px",
    color: "#71717a",
    margin: 0,
    lineHeight: 1.35,
  },

  card: {
    borderRadius: "16px",
    overflow: "hidden",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
  },
  cardAccent: {
    height: "3px",
    background: "linear-gradient(90deg, #2563eb, #7c3aed, #2563eb)",
  },
  cardInner: {
    backgroundColor: "#18181b",
    padding: "28px 24px",
  },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "8px",
    flexWrap: "wrap",
  },
  planBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    border: "1px solid rgba(37, 99, 235, 0.3)",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "700",
    color: "#60a5fa",
    letterSpacing: "1.5px",
  },
  trialBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#34d399",
  },
  activeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#34d399",
  },
  expiredBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#f87171",
  },

  planLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#a1a1aa",
    marginBottom: "16px",
  },

  priceSection: {
    display: "flex",
    alignItems: "flex-start",
    gap: "1px",
    marginBottom: "20px",
  },
  dollar: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#71717a",
    marginTop: "6px",
  },
  priceAmount: {
    fontSize: "48px",
    fontWeight: "800",
    color: "#fafafa",
    lineHeight: "1",
  },
  priceCents: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#fafafa",
    marginTop: "6px",
  },
  priceInterval: {
    fontSize: "14px",
    color: "#52525b",
    marginTop: "14px",
    marginLeft: "4px",
  },

  divider: {
    height: "1px",
    backgroundColor: "#27272a",
    marginBottom: "20px",
  },

  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "20px",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  checkIcon: {
    width: "18px",
    height: "18px",
    borderRadius: "5px",
    backgroundColor: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    fontSize: "12px",
    color: "#a1a1aa",
    lineHeight: "1.2",
  },

  metaBlock: {
    marginBottom: "20px",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "10px 0",
    borderBottom: "1px solid #27272a",
    gap: "12px",
  },
  metaKey: {
    fontSize: "12px",
    color: "#71717a",
    flexShrink: 0,
  },
  metaVal: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#d4d4d8",
    textAlign: "right",
  },

  manageButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "700",
    textDecoration: "none",
    boxSizing: "border-box" as const,
  },
  ctaNote: {
    textAlign: "center" as const,
    fontSize: "11px",
    color: "#3f3f46",
    marginTop: "10px",
    marginBottom: 0,
  },

  trustRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  trustItem: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  trustText: {
    fontSize: "12px",
    color: "#71717a",
  },
  trustDot: {
    color: "#3f3f46",
    fontSize: "10px",
  },
};
