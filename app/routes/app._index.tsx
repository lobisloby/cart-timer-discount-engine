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
  HelpCircle,
} from "lucide-react";

// ============================================
// SHOPIFY DISCOUNT MANAGEMENT
// ============================================
async function deleteOldDiscount(admin: any, discountId: string) {
  try {
    await admin.graphql(
      `#graphql
      mutation discountCodeDelete($id: ID!) {
        discountCodeDelete(id: $id) {
          deletedCodeDiscountId
          userErrors { field message }
        }
      }`,
      { variables: { id: discountId } },
    );
    console.log("🗑️ Old discount deleted:", discountId);
  } catch (e) {
    console.log("⚠️ Could not delete old discount:", e);
  }
}

async function createShopifyDiscount(
  admin: any,
  discountPercent: number,
  shop: string,
): Promise<{ code: string; id: string } | null> {
  try {
    const code =
      "SAVE" +
      discountPercent +
      "-" +
      Math.random().toString(36).substr(2, 6).toUpperCase();
    const title = "Cart Timer " + discountPercent + "% Off";

    console.log(
      "🎟️ Creating discount code:",
      code,
      "for",
      discountPercent + "%",
    );

    const response = await admin.graphql(
      `#graphql
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
          }
          userErrors {
            field
            code
            message
          }
        }
      }`,
      {
        variables: {
          basicCodeDiscount: {
            title,
            code,
            startsAt: new Date().toISOString(),
            customerGets: {
              value: {
                percentage: discountPercent / 100,
              },
              items: {
                all: true,
              },
            },
            customerSelection: {
              all: true,
            },
            appliesOncePerCustomer: false,
          },
        },
      },
    );

    const result = await response.json();
    const errors = result.data?.discountCodeBasicCreate?.userErrors;

    if (errors && errors.length > 0) {
      console.error("❌ Discount creation errors:", JSON.stringify(errors));
      return null;
    }

    const discountId =
      result.data?.discountCodeBasicCreate?.codeDiscountNode?.id;
    console.log("✅ Discount created:", code, "ID:", discountId);

    return { code, id: discountId };
  } catch (error) {
    console.error("❌ Failed to create discount:", error);
    return null;
  }
}

// ============================================
// LOADER
// ============================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const campaign = await prisma.campaign.findUnique({ where: { shop } });

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

      if (newEnabled && campaign && !campaign.discountCode) {
        const discount = await createShopifyDiscount(
          admin,
          campaign.discountPercent,
          shop,
        );
        if (discount) {
          await prisma.campaign.update({
            where: { shop },
            data: {
              enabled: newEnabled,
              discountCode: discount.code,
              shopifyDiscountId: discount.id,
            },
          });
        } else {
          await prisma.campaign.update({
            where: { shop },
            data: { enabled: newEnabled },
          });
        }
      } else {
        await prisma.campaign.upsert({
          where: { shop },
          update: { enabled: newEnabled },
          create: { shop, enabled: newEnabled },
        });
      }

      return {
        success: true,
        message: newEnabled ? "✅ Campaign activated!" : "⏸️ Campaign paused",
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
        cooldownHours: Math.min(
          72,
          Math.max(1, Number(formData.get("cooldownHours")) || 24),
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

      const existing = await prisma.campaign.findUnique({ where: { shop } });
      let discountCode = existing?.discountCode || null;
      let shopifyDiscountId = existing?.shopifyDiscountId || null;

      if (
        !existing ||
        existing.discountPercent !== data.discountPercent ||
        !discountCode
      ) {
        if (shopifyDiscountId) {
          await deleteOldDiscount(admin, shopifyDiscountId);
        }

        const newDiscount = await createShopifyDiscount(
          admin,
          data.discountPercent,
          shop,
        );
        if (newDiscount) {
          discountCode = newDiscount.code;
          shopifyDiscountId = newDiscount.id;
        }
      }

      await prisma.campaign.upsert({
        where: { shop },
        update: {
          ...data,
          discountCode,
          shopifyDiscountId,
        },
        create: {
          shop,
          ...data,
          discountCode,
          shopifyDiscountId,
        },
      });

      return {
        success: true,
        message: discountCode
          ? `✅ Saved! Discount code: ${discountCode}`
          : "✅ Settings saved (discount code pending)",
      };
    }

    return { success: false, message: "Unknown action" };
  } catch (error) {
    console.error("Action error:", error);
    return {
      success: false,
      message: "Something went wrong: " + String(error),
    };
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
  left: { flex: "1 1 420px", minWidth: 0 } as React.CSSProperties,
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
    overflow: "hidden",
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
  previewBody: { padding: "20px 18px" } as React.CSSProperties,
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
// LIVE PREVIEW
// ============================================
function LivePreview({ settings }: { settings: any }) {
  const {
    timerStyle,
    urgencyText,
    footerText,
    primaryColor,
    discountPercent,
    timerMinutes,
  } = settings;

  const themes: Record<string, any> = {
    dark: {
      bg: "linear-gradient(145deg, #0f172a, #1e293b)",
      text: "#f1f5f9",
      num: "#ffffff",
      sub: "rgba(255,255,255,0.5)",
      numBg: "rgba(255,255,255,0.06)",
      numBdr: "rgba(255,255,255,0.08)",
      track: "rgba(255,255,255,0.1)",
      fill: primaryColor,
      foot: "rgba(255,255,255,0.5)",
    },
    gradient: {
      bg: `linear-gradient(135deg, ${primaryColor}, #0f172a)`,
      text: "#ffffff",
      num: "#ffffff",
      sub: "rgba(255,255,255,0.6)",
      numBg: "rgba(255,255,255,0.12)",
      numBdr: "rgba(255,255,255,0.15)",
      track: "rgba(255,255,255,0.15)",
      fill: "#ffffff",
      foot: "rgba(255,255,255,0.6)",
    },
    light: {
      bg: "#ffffff",
      text: "#1e293b",
      num: "#0f172a",
      sub: "#94a3b8",
      numBg: "#f8fafc",
      numBdr: "#e2e8f0",
      track: "#e2e8f0",
      fill: primaryColor,
      foot: "#64748b",
    },
  };

  const t = themes[timerStyle] || themes.dark;
  const pad = (n: number) => String(n).padStart(2, "0");
  const originalPrice = "$49.99";
  const discountedPrice =
    "$" + (49.99 * (1 - discountPercent / 100)).toFixed(2);

  return (
    <div>
      {/* Price Preview */}
      <div
        style={{
          marginBottom: "14px",
          padding: "12px 16px",
          background: "#fff",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#64748b" }}>
          Product price will show:
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              color: "#94a3b8",
              textDecoration: "line-through",
            }}
          >
            {originalPrice}
          </span>
          <span
            style={{ fontSize: "22px", fontWeight: 800, color: primaryColor }}
          >
            {discountedPrice}
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: primaryColor,
              background: primaryColor + "18",
              padding: "3px 8px",
              borderRadius: "20px",
            }}
          >
            -{discountPercent}%
          </span>
        </div>
      </div>

      {/* Timer Preview */}
      <div
        style={{
          background: t.bg,
          borderRadius: "14px",
          padding: "18px 20px 16px",
          border: timerStyle === "light" ? "1px solid #e5e7eb" : "none",
          boxShadow:
            timerStyle === "light"
              ? "0 4px 16px rgba(0,0,0,0.05)"
              : "0 6px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "14px",
          }}
        >
          <span style={{ fontSize: "17px" }}>🔥</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: t.text }}>
            {urgencyText}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: "6px",
            marginBottom: "14px",
          }}
        >
          {[
            { v: "00", l: "Hours" },
            { v: pad(timerMinutes), l: "Mins" },
            { v: "00", l: "Secs" },
          ].map((item, i) => (
            <div
              key={item.l}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {i > 0 && (
                <span
                  style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    color: t.sub,
                    paddingBottom: "14px",
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
                  border: `1px solid ${t.numBdr}`,
                  borderRadius: "10px",
                  padding: "10px 14px 7px",
                  minWidth: "55px",
                }}
              >
                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: 800,
                    color: t.num,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.v}
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    color: t.sub,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    marginTop: "4px",
                  }}
                >
                  {item.l}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: t.track,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "70%",
                borderRadius: "2px",
                background: t.fill,
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
          }}
        >
          <Lock size={12} color={t.foot} />
          <span style={{ fontSize: "11px", fontWeight: 500, color: t.foot }}>
            {footerText}
          </span>
        </div>
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
    cooldownHours: campaign?.cooldownHours ?? 24,
    displayStyle: campaign?.displayStyle ?? "progress",
    primaryColor: campaign?.primaryColor ?? "#6366f1",
    timerStyle: campaign?.timerStyle ?? "dark",
    urgencyText: campaign?.urgencyText ?? "Hurry! This deal ends soon",
    footerText: campaign?.footerText ?? "Your discount is reserved for you",
  });

  useEffect(() => {
    if (fetcher.data?.success) shopify.toast.show(fetcher.data.message);
  }, [fetcher.data, shopify]);

  useEffect(() => {
    if (campaign)
      setS({
        enabled: campaign.enabled,
        discountPercent: campaign.discountPercent,
        timerMinutes: campaign.timerMinutes,
        cooldownHours: campaign.cooldownHours ?? 24,
        displayStyle: campaign.displayStyle,
        primaryColor: campaign.primaryColor,
        timerStyle: campaign.timerStyle ?? "dark",
        urgencyText: campaign.urgencyText ?? "Hurry! This deal ends soon",
        footerText: campaign.footerText ?? "Your discount is reserved for you",
      });
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
        cooldownHours: s.cooldownHours.toString(),
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
      cooldownHours: 24,
    }));
  }, []);

  const isLoading = fetcher.state !== "idle";
  const update = (key: string, val: any) => setS((p) => ({ ...p, [key]: val }));

  return (
    <div style={S.page}>
      {/* Input styles reset — overrides Shopify embedded app defaults */}
      <style>{`
        .ct-dash-input {
          width: 100% !important;
          padding: 12px 16px !important;
          font-size: 14px !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          line-height: 1.5 !important;
          color: #0f172a !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          outline: none !important;
          box-sizing: border-box !important;
          display: block !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          margin: 0 !important;
          min-width: 0 !important;
          max-width: 100% !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }
        .ct-dash-input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
        }
        .ct-dash-input::placeholder {
          color: #94a3b8 !important;
          opacity: 1 !important;
        }
      `}</style>

      {/* LEFT COLUMN */}
      <div style={S.left}>
        <h1 style={S.heading}>
          <Timer size={26} color="#6366f1" /> Cart Timer Discount
        </h1>
        <p style={S.sub}>Timer + real price discount applied to cart</p>

        {/* DISCOUNT CODE STATUS */}
        {campaign?.discountCode && (
          <div
            style={{
              ...S.card,
              background: "#ecfdf5",
              borderColor: "#86efac",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={S.icon("#dcfce7")}>
                <Check size={18} color="#16a34a" />
              </div>
              <div>
                <p style={{ ...S.cardTitle, color: "#166534" }}>
                  Discount Code Active
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#166534",
                    fontFamily: "monospace",
                  }}
                >
                  {campaign.discountCode}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CAMPAIGN STATUS */}
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
                  ? "Timer + discount active on your store"
                  : "Toggle to start"}
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

        {/* TIMER STYLE */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.icon("#f3e8ff")}>
              <Palette size={18} color="#9333ea" />
            </div>
            <div>
              <p style={S.cardTitle}>Timer Style</p>
              <p style={S.cardDesc}>Choose the look</p>
            </div>
          </div>
          <div style={S.styleGrid}>
            {(
              [
                {
                  val: "dark",
                  icon: <Moon size={20} />,
                  label: "Dark",
                  desc: "Bold",
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
                  desc: "Clean",
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
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* DISCOUNT & TIMER */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.icon("#fef3c7")}>
              <Percent size={18} color="#d97706" />
            </div>
            <div>
              <p style={S.cardTitle}>Discount & Duration</p>
              <p style={S.cardDesc}>Set the real discount applied to cart</p>
            </div>
          </div>
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
          <div style={{ marginBottom: "20px" }}>
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
          <div>
            <div style={S.label}>
              <span style={S.labelText}>Cooldown Period</span>
              <span style={S.badge("#f59e0b")}>{s.cooldownHours}h</span>
            </div>
            <p
              style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 10px" }}
            >
              Time before a visitor can get a new discount after expiry
            </p>
            <select
              className="ct-dash-input"
              value={s.cooldownHours}
              onChange={(e) => update("cooldownHours", Number(e.target.value))}
            >
              <option value={1}>1 hour — Flash sales</option>
              <option value={3}>3 hours</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours — Default</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours — Premium brands</option>
            </select>
          </div>
        </div>

        {/* TEXT CONTENT */}
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

          {/* Urgency Headline */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#374151",
                  display: "block",
                }}
              >
                Urgency Headline
              </label>
              <span
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.urgencyText.length}/60
              </span>
            </div>
            <input
              type="text"
              className="ct-dash-input"
              value={s.urgencyText}
              onChange={(e) => update("urgencyText", e.target.value)}
              placeholder="Hurry! This deal ends soon"
              maxLength={60}
            />
          </div>

          {/* Footer Message */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#374151",
                  display: "block",
                }}
              >
                Footer Message
              </label>
              <span
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.footerText.length}/50
              </span>
            </div>
            <input
              type="text"
              className="ct-dash-input"
              value={s.footerText}
              onChange={(e) => update("footerText", e.target.value)}
              placeholder="Your discount is reserved for you"
              maxLength={50}
            />
          </div>
        </div>

        {/* ACTIONS */}
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
                <Check size={18} /> Save & Create Discount
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
            }}
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        {/* INFO */}
        <div style={S.infoGrid}>
          <div style={S.infoCard}>
            <Shield size={20} color="#6366f1" style={{ marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              Real Discount
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                fontWeight: 500,
                color: "#0f172a",
              }}
            >
              Applied to cart
            </p>
          </div>
          <div style={S.infoCard}>
            <TrendingUp
              size={20}
              color="#10b981"
              style={{ marginBottom: "6px" }}
            />
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              Smart Cooldown
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                fontWeight: 500,
                color: "#0f172a",
              }}
            >
              No abuse
            </p>
          </div>
          <div style={S.infoCard}>
            <Zap size={20} color="#f59e0b" style={{ marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              Price Update
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                fontWeight: 500,
                color: "#0f172a",
              }}
            >
              Shows on page
            </p>
          </div>
        </div>

        {/* SETUP GUIDE */}
        <details
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            marginTop: "20px",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              padding: "16px 20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#374151",
              listStyle: "none",
            }}
          >
            <HelpCircle size={18} color="#6b7280" />
            Timer not showing on your store?
          </summary>
          <div
            style={{
              padding: "0 20px 20px",
              fontSize: "13px",
              color: "#4b5563",
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: "0 0 12px", color: "#6b7280" }}>
              Some themes need manual placement. Here's how to fix it in 2
              minutes:
            </p>
            <ol style={{ margin: 0, paddingLeft: "18px" }}>
              <li style={{ marginBottom: "6px" }}>
                Go to <strong>Online Store → Themes</strong>
              </li>
              <li style={{ marginBottom: "6px" }}>
                Click <strong>Customize</strong> on your active theme
              </li>
              <li style={{ marginBottom: "6px" }}>
                Navigate to any <strong>Product Page</strong>
              </li>
              <li style={{ marginBottom: "6px" }}>
                Click <strong>Add Block</strong> → find{" "}
                <strong>Cart Timer</strong>
              </li>
              <li style={{ marginBottom: "6px" }}>
                Drag it above your Add to Cart button
              </li>
              <li>
                Click <strong>Save</strong>
              </li>
            </ol>
            <p
              style={{
                margin: "14px 0 0",
                padding: "10px 12px",
                background: "#f3f4f6",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#6b7280",
              }}
            >
              Still not working? Email us at{" "}
              <strong>support@yourapp.com</strong> — we'll fix it for you within
              24 hours, free.
            </p>
          </div>
        </details>
      </div>

      {/* RIGHT — PREVIEW */}
      <div style={S.right}>
        <div style={S.previewWrap}>
          <div style={S.previewHead}>
            <Eye size={16} color="#6366f1" />
            <span
              style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}
            >
              Live Preview
            </span>
          </div>
          <div style={S.previewBody}>
            <LivePreview settings={s} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
