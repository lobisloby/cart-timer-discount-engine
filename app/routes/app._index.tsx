// app/routes/app._index.tsx

import { useState, useEffect, useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  Timer,
  Percent,
  Palette,
  Power,
  Check,
  Clock,
  Type,
  Eye,
  Moon,
  Sun,
  Sparkles,
  Lock,
  Shield,
  TrendingUp,
  Zap,
  RotateCcw,
} from "lucide-react";

// ============================================
// METAFIELD SYNC
// ============================================
async function syncSettingsToMetafields(
  admin: any,
  settings: {
    enabled: boolean;
    discountPercent: number;
    timerMinutes: number;
    displayStyle: string;
    primaryColor: string;
    timerStyle: string;
    urgencyText: string;
    footerText: string;
  },
) {
  try {
    // Get shop GID
    const shopRes = await admin.graphql(`query { shop { id } }`);
    const shopData = await shopRes.json();
    const shopId = shopData.data.shop.id;

    console.log("🔄 Syncing metafields for shop:", shopId);

    const metafields = [
      {
        key: "enabled",
        value: settings.enabled.toString(),
        type: "single_line_text_field",
      },
      {
        key: "discount_percent",
        value: settings.discountPercent.toString(),
        type: "single_line_text_field",
      },
      {
        key: "timer_minutes",
        value: settings.timerMinutes.toString(),
        type: "single_line_text_field",
      },
      {
        key: "display_style",
        value: settings.displayStyle,
        type: "single_line_text_field",
      },
      {
        key: "primary_color",
        value: settings.primaryColor,
        type: "single_line_text_field",
      },
      {
        key: "timer_style",
        value: settings.timerStyle,
        type: "single_line_text_field",
      },
      {
        key: "urgency_text",
        value: settings.urgencyText,
        type: "single_line_text_field",
      },
      {
        key: "footer_text",
        value: settings.footerText,
        type: "single_line_text_field",
      },
    ];

    const metafieldsInput = metafields.map((mf) => ({
      ownerId: shopId,
      namespace: "cart_timer",
      key: mf.key,
      value: mf.value,
      type: mf.type,
    }));

    const response = await admin.graphql(
      `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            namespace
            value
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { metafields: metafieldsInput } },
    );

    const result = await response.json();

    if (result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error(
        "❌ Metafield errors:",
        JSON.stringify(result.data.metafieldsSet.userErrors),
      );
    } else {
      console.log(
        "✅ Metafields synced:",
        result.data?.metafieldsSet?.metafields?.length,
        "fields",
      );
    }

    return result;
  } catch (error) {
    console.error("❌ Failed to sync metafields:", error);
  }
}

// ============================================
// LOADER
// ============================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let campaign = await prisma.campaign.findUnique({ where: { shop } });

  return {
    campaign,
    shopName: shop.replace(".myshopify.com", ""),
  };
};

// ============================================
// ACTION
// ============================================
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "toggle") {
      const campaign = await prisma.campaign.findUnique({ where: { shop } });
      const newEnabled = !campaign?.enabled;

      const updated = await prisma.campaign.upsert({
        where: { shop },
        update: { enabled: newEnabled },
        create: { shop, enabled: newEnabled },
      });

      await syncSettingsToMetafields(admin, {
        enabled: updated.enabled,
        discountPercent: updated.discountPercent,
        timerMinutes: updated.timerMinutes,
        displayStyle: updated.displayStyle,
        primaryColor: updated.primaryColor,
        timerStyle: updated.timerStyle,
        urgencyText: updated.urgencyText,
        footerText: updated.footerText,
      });

      return {
        success: true,
        message: newEnabled ? "Campaign activated!" : "Campaign paused",
      };
    }

    if (intent === "save") {
      const data = {
        discountPercent: Math.min(
          50,
          Math.max(5, Number(formData.get("discountPercent")) || 10),
        ),
        timerMinutes: Math.min(
          30,
          Math.max(1, Number(formData.get("timerMinutes")) || 10),
        ),
        displayStyle: (formData.get("displayStyle") as string) || "progress",
        primaryColor: (formData.get("primaryColor") as string) || "#6366f1",
        timerStyle: (formData.get("timerStyle") as string) || "dark",
        urgencyText:
          (formData.get("urgencyText") as string) ||
          "Hurry! This deal ends soon",
        footerText:
          (formData.get("footerText") as string) ||
          "Your discount is reserved for you",
      };

      const updated = await prisma.campaign.upsert({
        where: { shop },
        update: data,
        create: { shop, ...data },
      });

      await syncSettingsToMetafields(admin, {
        enabled: updated.enabled,
        ...data,
      });

      return { success: true, message: "Settings saved & synced!" };
    }

    return { success: false, message: "Unknown action" };
  } catch (error) {
    console.error("Action error:", error);
    return { success: false, message: "Something went wrong" };
  }
};

// ============================================
// STYLES
// ============================================
const S = {
  page: {
    display: "flex",
    gap: "28px",
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,
  left: {
    flex: "1 1 420px",
    minWidth: 0,
  } as React.CSSProperties,
  right: {
    flex: "0 0 380px",
    position: "sticky" as const,
    top: "24px",
    alignSelf: "flex-start",
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
  label: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  } as React.CSSProperties,
  labelText: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
  } as React.CSSProperties,
  badge: (color: string) =>
    ({
      fontSize: "12px",
      fontWeight: 600,
      color,
      background: color + "18",
      padding: "3px 10px",
      borderRadius: "20px",
    }) as React.CSSProperties,
  slider: {
    width: "100%",
    height: "6px",
    borderRadius: "3px",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none" as const,
    background: "#e2e8f0",
  } as React.CSSProperties,
  range: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "#94a3b8",
    marginTop: "6px",
  } as React.CSSProperties,
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: "#f8fafc",
    borderRadius: "10px",
  } as React.CSSProperties,
  toggle: (on: boolean) =>
    ({
      width: "50px",
      height: "28px",
      borderRadius: "14px",
      border: "none",
      cursor: "pointer",
      position: "relative" as const,
      background: on ? "#6366f1" : "#cbd5e1",
      transition: "background 0.2s",
      flexShrink: 0,
    }) as React.CSSProperties,
  knob: (on: boolean) =>
    ({
      width: "22px",
      height: "22px",
      borderRadius: "11px",
      background: "#fff",
      position: "absolute" as const,
      top: "3px",
      left: on ? "25px" : "3px",
      transition: "left 0.2s",
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    }) as React.CSSProperties,
  styleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginBottom: "16px",
  } as React.CSSProperties,
  styleBtn: (active: boolean) =>
    ({
      padding: "14px 8px 12px",
      borderRadius: "10px",
      border: active ? "2px solid #6366f1" : "2px solid #e2e8f0",
      background: active ? "#eef2ff" : "#fff",
      cursor: "pointer",
      textAlign: "center" as const,
      transition: "all 0.15s",
    }) as React.CSSProperties,
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: "14px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    outline: "none",
    color: "#0f172a",
    background: "#f8fafc",
    transition: "border-color 0.15s",
  } as React.CSSProperties,
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  } as React.CSSProperties,
  colorSwatch: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    border: "2px solid #e2e8f0",
    cursor: "pointer",
    padding: 0,
  } as React.CSSProperties,
  saveBtn: (loading: boolean) =>
    ({
      width: "100%",
      padding: "14px",
      fontSize: "15px",
      fontWeight: 600,
      color: "#fff",
      background: loading
        ? "#a5b4fc"
        : "linear-gradient(135deg, #6366f1, #8b5cf6)",
      border: "none",
      borderRadius: "12px",
      cursor: loading ? "default" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      transition: "opacity 0.15s",
    }) as React.CSSProperties,
  previewWrap: {
    background: "#f8fafc",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  } as React.CSSProperties,
  previewHead: {
    padding: "14px 18px",
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,
  previewBody: {
    padding: "20px 18px",
  } as React.CSSProperties,
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginTop: "20px",
  } as React.CSSProperties,
  infoCard: {
    padding: "14px 10px",
    background: "#f8fafc",
    borderRadius: "10px",
    textAlign: "center" as const,
    border: "1px solid #f1f5f9",
  } as React.CSSProperties,
};

// ============================================
// LIVE PREVIEW COMPONENT
// ============================================
function LivePreview({
  settings,
}: {
  settings: {
    timerStyle: string;
    urgencyText: string;
    footerText: string;
    primaryColor: string;
    discountPercent: number;
    timerMinutes: number;
  };
}) {
  const {
    timerStyle,
    urgencyText,
    footerText,
    primaryColor,
    discountPercent,
    timerMinutes,
  } = settings;

  const themes: Record<
    string,
    {
      bg: string;
      text: string;
      sub: string;
      numBg: string;
      numBorder: string;
      num: string;
      trackBg: string;
      fillBg: string;
      foot: string;
      lockColor: string;
    }
  > = {
    dark: {
      bg: "linear-gradient(145deg, #0f172a, #1e293b)",
      text: "#f1f5f9",
      sub: "rgba(255,255,255,0.5)",
      numBg: "rgba(255,255,255,0.06)",
      numBorder: "rgba(255,255,255,0.08)",
      num: "#ffffff",
      trackBg: "rgba(255,255,255,0.1)",
      fillBg: primaryColor,
      foot: "rgba(255,255,255,0.5)",
      lockColor: primaryColor,
    },
    gradient: {
      bg: `linear-gradient(135deg, ${primaryColor}, #0f172a)`,
      text: "#ffffff",
      sub: "rgba(255,255,255,0.6)",
      numBg: "rgba(255,255,255,0.12)",
      numBorder: "rgba(255,255,255,0.15)",
      num: "#ffffff",
      trackBg: "rgba(255,255,255,0.15)",
      fillBg: "#ffffff",
      foot: "rgba(255,255,255,0.6)",
      lockColor: "rgba(255,255,255,0.8)",
    },
    light: {
      bg: "#ffffff",
      text: "#1e293b",
      sub: "#94a3b8",
      numBg: "#f8fafc",
      numBorder: "#e2e8f0",
      num: "#0f172a",
      trackBg: "#e2e8f0",
      fillBg: primaryColor,
      foot: "#64748b",
      lockColor: primaryColor,
    },
  };

  const t = themes[timerStyle] || themes.dark;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      style={{
        background: t.bg,
        borderRadius: "14px",
        padding: "20px 22px 18px",
        border: timerStyle === "light" ? "1px solid #e5e7eb" : "none",
        boxShadow:
          timerStyle === "light"
            ? "0 4px 20px rgba(0,0,0,0.06)"
            : "0 8px 30px rgba(0,0,0,0.25)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontSize: "18px" }}>🔥</span>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: t.text,
            letterSpacing: "-0.2px",
          }}
        >
          {urgencyText}
        </span>
      </div>

      {/* Numbers */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        {[
          { val: "00", label: "Hours" },
          { val: pad(timerMinutes), label: "Mins" },
          { val: "00", label: "Secs" },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            {i > 0 && (
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: t.sub,
                  paddingBottom: "16px",
                }}
              >
                :
              </span>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: t.numBg,
                border: `1px solid ${t.numBorder}`,
                borderRadius: "10px",
                padding: "12px 14px 8px",
                minWidth: "58px",
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: t.num,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-1px",
                  lineHeight: 1,
                }}
              >
                {item.val}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  color: t.sub,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginTop: "5px",
                }}
              >
                {item.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            height: "5px",
            borderRadius: "3px",
            background: t.trackBg,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "72%",
              borderRadius: "3px",
              background: t.fillBg,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        <Lock size={13} color={t.lockColor} />
        <span style={{ fontSize: "11px", fontWeight: 500, color: t.foot }}>
          {discountPercent}% off — {footerText}
        </span>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function Dashboard() {
  const { campaign, shopName } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [s, setS] = useState({
    enabled: campaign?.enabled ?? false,
    discountPercent: campaign?.discountPercent ?? 10,
    timerMinutes: campaign?.timerMinutes ?? 10,
    displayStyle: campaign?.displayStyle ?? "progress",
    primaryColor: campaign?.primaryColor ?? "#6366f1",
    timerStyle: campaign?.timerStyle ?? "dark",
    urgencyText: campaign?.urgencyText ?? "Hurry! This deal ends soon",
    footerText: campaign?.footerText ?? "Your discount is reserved for you",
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  useEffect(() => {
    if (campaign) {
      setS({
        enabled: campaign.enabled,
        discountPercent: campaign.discountPercent,
        timerMinutes: campaign.timerMinutes,
        displayStyle: campaign.displayStyle,
        primaryColor: campaign.primaryColor,
        timerStyle: campaign.timerStyle ?? "dark",
        urgencyText: campaign.urgencyText ?? "Hurry! This deal ends soon",
        footerText: campaign.footerText ?? "Your discount is reserved for you",
      });
    }
  }, [campaign]);

  const handleToggle = useCallback(() => {
    setS((p) => ({ ...p, enabled: !p.enabled }));
    fetcher.submit({ intent: "toggle" }, { method: "POST" });
  }, [fetcher]);

  const handleSave = useCallback(() => {
    fetcher.submit(
      {
        intent: "save",
        discountPercent: s.discountPercent.toString(),
        timerMinutes: s.timerMinutes.toString(),
        displayStyle: s.displayStyle,
        primaryColor: s.primaryColor,
        timerStyle: s.timerStyle,
        urgencyText: s.urgencyText,
        footerText: s.footerText,
      },
      { method: "POST" },
    );
  }, [fetcher, s]);

  const handleReset = useCallback(() => {
    setS((p) => ({
      ...p,
      timerStyle: "dark",
      urgencyText: "Hurry! This deal ends soon",
      footerText: "Your discount is reserved for you",
      primaryColor: "#6366f1",
      discountPercent: 10,
      timerMinutes: 10,
    }));
  }, []);

  const isLoading = fetcher.state !== "idle";
  const update = (key: string, val: any) => setS((p) => ({ ...p, [key]: val }));

  return (
    <div style={S.page}>
      {/* ===================== LEFT COLUMN ===================== */}
      <div style={S.left}>
        <h1 style={S.heading}>
          <Timer size={26} color="#6366f1" />
          Cart Timer Discount
        </h1>
        <p style={S.sub}>
          Control how your countdown timer looks and behaves on the storefront
        </p>

        {/* ── CAMPAIGN STATUS ── */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.icon(s.enabled ? "#dcfce7" : "#fee2e2")}>
              <Power size={18} color={s.enabled ? "#16a34a" : "#dc2626"} />
            </div>
            <div>
              <p style={S.cardTitle}>Campaign Status</p>
              <p style={S.cardDesc}>{shopName}.myshopify.com</p>
            </div>
          </div>
          <div style={S.toggleRow}>
            <div>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#0f172a",
                }}
              >
                {s.enabled ? "✅ Campaign Active" : "⏸️ Campaign Paused"}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                {s.enabled
                  ? "Timer is visible on your store"
                  : "Toggle to start showing timer"}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={isLoading}
              style={S.toggle(s.enabled)}
            >
              <div style={S.knob(s.enabled)} />
            </button>
          </div>
        </div>

        {/* ── TIMER STYLE ── */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.icon("#f3e8ff")}>
              <Palette size={18} color="#9333ea" />
            </div>
            <div>
              <p style={S.cardTitle}>Timer Style</p>
              <p style={S.cardDesc}>Choose the look and feel</p>
            </div>
          </div>
          <div style={S.styleGrid}>
            {(
              [
                {
                  val: "dark",
                  icon: <Moon size={20} />,
                  label: "Dark Premium",
                  desc: "Bold & modern",
                },
                {
                  val: "gradient",
                  icon: <Sparkles size={20} />,
                  label: "Gradient",
                  desc: "Eye-catching",
                },
                {
                  val: "light",
                  icon: <Sun size={20} />,
                  label: "Light",
                  desc: "Clean & minimal",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => update("timerStyle", opt.val)}
                style={S.styleBtn(s.timerStyle === opt.val)}
              >
                <div
                  style={{
                    marginBottom: "6px",
                    color: s.timerStyle === opt.val ? "#6366f1" : "#94a3b8",
                  }}
                >
                  {opt.icon}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  {opt.label}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "11px",
                    color: "#94a3b8",
                  }}
                >
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>

          {/* Accent Color */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ ...S.labelText, marginBottom: "8px" }}>Accent Color</p>
            <div style={S.colorRow}>
              <input
                type="color"
                value={s.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                style={S.colorSwatch}
              />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[
                  "#6366f1",
                  "#ef4444",
                  "#f59e0b",
                  "#10b981",
                  "#ec4899",
                  "#0ea5e9",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update("primaryColor", c)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: c,
                      border:
                        s.primaryColor === c
                          ? "2px solid #0f172a"
                          : "2px solid transparent",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── DISCOUNT & TIMER ── */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.icon("#fef3c7")}>
              <Percent size={18} color="#d97706" />
            </div>
            <div>
              <p style={S.cardTitle}>Discount & Duration</p>
              <p style={S.cardDesc}>Set the offer and time limit</p>
            </div>
          </div>

          {/* Discount Slider */}
          <div style={{ marginBottom: "20px" }}>
            <div style={S.label}>
              <span style={S.labelText}>Discount</span>
              <span style={S.badge("#6366f1")}>{s.discountPercent}% OFF</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={s.discountPercent}
              onChange={(e) =>
                update("discountPercent", Number(e.target.value))
              }
              style={S.slider}
            />
            <div style={S.range}>
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Duration Slider */}
          <div>
            <div style={S.label}>
              <span style={S.labelText}>Timer Duration</span>
              <span style={S.badge("#10b981")}>{s.timerMinutes} min</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              value={s.timerMinutes}
              onChange={(e) => update("timerMinutes", Number(e.target.value))}
              style={S.slider}
            />
            <div style={S.range}>
              <span>1 min</span>
              <span>30 min</span>
            </div>
          </div>
        </div>

        {/* ── TEXT CONTENT ── */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.icon("#dbeafe")}>
              <Type size={18} color="#2563eb" />
            </div>
            <div>
              <p style={S.cardTitle}>Text Content</p>
              <p style={S.cardDesc}>Customize messages</p>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <p style={{ ...S.labelText, marginBottom: "6px" }}>
              Urgency Headline
            </p>
            <input
              type="text"
              value={s.urgencyText}
              onChange={(e) => update("urgencyText", e.target.value)}
              placeholder="Hurry! This deal ends soon"
              style={S.input}
              maxLength={60}
            />
            <p
              style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}
            >
              {s.urgencyText.length}/60 characters
            </p>
          </div>

          <div>
            <p style={{ ...S.labelText, marginBottom: "6px" }}>
              Footer Message
            </p>
            <input
              type="text"
              value={s.footerText}
              onChange={(e) => update("footerText", e.target.value)}
              placeholder="Your discount is reserved for you"
              style={S.input}
              maxLength={50}
            />
            <p
              style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}
            >
              {s.footerText.length}/50 characters
            </p>
          </div>
        </div>

        {/* ── ACTIONS ── */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            onClick={handleSave}
            disabled={isLoading}
            style={S.saveBtn(isLoading)}
          >
            {isLoading ? (
              "Saving..."
            ) : (
              <>
                <Check size={18} /> Save & Sync
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "14px 18px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#64748b",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "background 0.15s",
            }}
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        {/* ── INFO ── */}
        <div style={S.infoGrid}>
          <div style={S.infoCard}>
            <Shield size={20} color="#6366f1" style={{ marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              Server-Side
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                fontWeight: 500,
                color: "#0f172a",
              }}
            >
              Refresh-proof
            </p>
          </div>
          <div style={S.infoCard}>
            <TrendingUp
              size={20}
              color="#10b981"
              style={{ marginBottom: "6px" }}
            />
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              Conversion
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                fontWeight: 500,
                color: "#0f172a",
              }}
            >
              Boost rates
            </p>
          </div>
          <div style={S.infoCard}>
            <Zap size={20} color="#f59e0b" style={{ marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              Performance
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                fontWeight: 500,
                color: "#0f172a",
              }}
            >
              Lightweight
            </p>
          </div>
        </div>
      </div>

      {/* ===================== RIGHT COLUMN — PREVIEW ===================== */}
      <div style={S.right}>
        <div style={S.previewWrap}>
          <div style={S.previewHead}>
            <Eye size={16} color="#6366f1" />
            <span
              style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}
            >
              Live Preview
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "11px",
                fontWeight: 500,
                color: "#10b981",
                background: "#ecfdf5",
                padding: "2px 8px",
                borderRadius: "10px",
              }}
            >
              Updates in real time
            </span>
          </div>
          <div style={S.previewBody}>
            <LivePreview settings={s} />

            {/* Simulated product page context */}
            <div
              style={{
                marginTop: "16px",
                padding: "14px 16px",
                background: "#fff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "#f1f5f9",
                    borderRadius: "8px",
                  }}
                />
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Sample Product
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "13px",
                      color: "#64748b",
                    }}
                  >
                    $49.99
                  </p>
                </div>
              </div>
              <div
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                Add to cart
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
