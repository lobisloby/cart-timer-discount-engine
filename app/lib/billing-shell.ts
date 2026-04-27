import type { CSSProperties } from "react";

export const APP_TITLE = "Cart Timer";
export const APP_SUBTITLE = "Countdown urgency and automatic cart discounts";

export const BILLING_FEATURES = [
  "Configurable cart countdown timer",
  "Automatic discount at checkout",
  "Custom colors & messaging",
  "FlashDrop theme extension",
  "Mobile responsive",
  "Works with Shopify Discounts API",
  "Live preview in admin",
  "No coding required",
];

export const DEFAULT_PRICE_AMOUNT = "4.99";

export function splitPrice(amount: string) {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) {
    return { whole: "4", cents: ".99" };
  }
  const [w, f = "00"] = n.toFixed(2).split(".");
  return { whole: w, cents: `.${f}` };
}

export function currencySymbol(code: string) {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code === "GBP") return "£";
  return `${code} `;
}

/** Shared layout/theme with the former billing page (dark card + gradient accent). */
export const shell: { [key: string]: CSSProperties } = {
  page: {
    maxWidth: "420px",
    margin: "0 auto",
    padding: "24px 16px 48px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    minHeight: "100vh",
    boxSizing: "border-box",
    background: "#fafafa",
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

  statusAhead: {
    marginBottom: "20px",
    textAlign: "center" as const,
  },
  statusAheadExpired: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontSize: "22px",
    fontWeight: "800",
    color: "#f87171",
    letterSpacing: "-0.02em",
  },

  planRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap" as const,
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
  planLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#a1a1aa",
    marginBottom: 0,
    flex: "1",
    minWidth: 0,
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
    marginBottom: "16px",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "10px 0",
    borderBottom: "1px solid #27272a",
    gap: "12px",
  },
  metaRowLast: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "10px 0 0",
    gap: "12px",
    borderBottom: "none",
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

  errorBox: {
    padding: "12px 16px",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.35)",
    borderRadius: "10px",
    marginBottom: "16px",
    fontSize: "13px",
    color: "#fca5a5",
    textAlign: "left",
    lineHeight: 1.5,
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

export function primaryCtaStyle(isLoading: boolean): CSSProperties {
  return {
    width: "100%",
    padding: "14px 20px",
    fontSize: "15px",
    fontWeight: 700,
    color: "#fff",
    background: isLoading
      ? "#4b5563"
      : "linear-gradient(135deg, #2563eb, #7c3aed)",
    border: "none",
    borderRadius: "12px",
    cursor: isLoading ? "default" : "pointer",
    boxShadow: isLoading ? "none" : "0 4px 16px rgba(37, 99, 235, 0.35)",
  };
}
