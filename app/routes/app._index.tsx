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
  ChevronRight,
  Check,
  Clock,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";

// ============================================
// LOADER - Get campaign settings
// ============================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get or create campaign settings
  let campaign = await prisma.campaign.findUnique({
    where: { shop },
  });

  return {
    campaign,
    shopName: shop.replace(".myshopify.com", ""),
  };
};

// ============================================
// ACTION - Save campaign settings
// ============================================
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "toggle") {
      // Toggle enabled/disabled
      const campaign = await prisma.campaign.findUnique({ where: { shop } });
      const newEnabled = !campaign?.enabled;

      await prisma.campaign.upsert({
        where: { shop },
        update: { enabled: newEnabled },
        create: { shop, enabled: newEnabled },
      });

      return { success: true, message: newEnabled ? "Campaign activated!" : "Campaign paused" };
    }

    if (intent === "save") {
      // Save all settings
      const discountPercent = Number(formData.get("discountPercent")) || 10;
      const timerMinutes = Number(formData.get("timerMinutes")) || 10;
      const displayStyle = (formData.get("displayStyle") as string) || "progress";
      const primaryColor = (formData.get("primaryColor") as string) || "#000000";

      await prisma.campaign.upsert({
        where: { shop },
        update: {
          discountPercent: Math.min(20, Math.max(5, discountPercent)),
          timerMinutes: Math.min(15, Math.max(5, timerMinutes)),
          displayStyle,
          primaryColor,
        },
        create: {
          shop,
          discountPercent: Math.min(20, Math.max(5, discountPercent)),
          timerMinutes: Math.min(15, Math.max(5, timerMinutes)),
          displayStyle,
          primaryColor,
        },
      });

      return { success: true, message: "Settings saved!" };
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
const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "32px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700" as const,
    color: "#1a1a2e",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "16px",
    color: "#6b7280",
    margin: 0,
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  cardIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "600" as const,
    color: "#1a1a2e",
    margin: 0,
  },
  cardDescription: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0 0",
  },
  toggleContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "12px",
  },
  toggle: {
    width: "56px",
    height: "32px",
    borderRadius: "16px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s ease",
    position: "relative" as const,
  },
  toggleKnob: {
    width: "24px",
    height: "24px",
    borderRadius: "12px",
    background: "#ffffff",
    position: "absolute" as const,
    top: "4px",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
  },
  sliderContainer: {
    marginBottom: "24px",
  },
  sliderLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  sliderLabelText: {
    fontSize: "14px",
    fontWeight: "500" as const,
    color: "#374151",
  },
  sliderValue: {
    fontSize: "14px",
    fontWeight: "600" as const,
    color: "#6366f1",
    background: "#eef2ff",
    padding: "4px 12px",
    borderRadius: "20px",
  },
  slider: {
    width: "100%",
    height: "8px",
    borderRadius: "4px",
    background: "#e5e7eb",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none" as const,
  },
  optionGroup: {
    display: "flex",
    gap: "12px",
    marginBottom: "24px",
  },
  optionButton: {
    flex: 1,
    padding: "16px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textAlign: "center" as const,
  },
  optionButtonActive: {
    borderColor: "#6366f1",
    background: "#eef2ff",
  },
  colorInput: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px",
    background: "#f9fafb",
    borderRadius: "12px",
  },
  colorSwatch: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
  },
  saveButton: {
    width: "100%",
    padding: "16px 24px",
    fontSize: "16px",
    fontWeight: "600" as const,
    color: "#ffffff",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.2s ease",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginTop: "24px",
  },
  statCard: {
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "12px",
    textAlign: "center" as const,
  },
  statValue: {
    fontSize: "24px",
    fontWeight: "700" as const,
    color: "#1a1a2e",
    margin: "0 0 4px 0",
  },
  statLabel: {
    fontSize: "12px",
    color: "#6b7280",
    margin: 0,
  },
  previewBox: {
    padding: "24px",
    background: "#f9fafb",
    borderRadius: "12px",
    textAlign: "center" as const,
  },
  previewTimer: {
    fontSize: "32px",
    fontWeight: "700" as const,
    marginBottom: "12px",
  },
  progressBar: {
    height: "8px",
    background: "#e5e7eb",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
} as const;

// ============================================
// COMPONENT
// ============================================
export default function Dashboard() {
  const { campaign, shopName } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // Local state for form
  const [settings, setSettings] = useState({
    enabled: campaign?.enabled ?? false,
    discountPercent: campaign?.discountPercent ?? 10,
    timerMinutes: campaign?.timerMinutes ?? 10,
    displayStyle: campaign?.displayStyle ?? "progress",
    primaryColor: campaign?.primaryColor ?? "#6366f1",
  });

  // Show toast on success
  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  // Update local state when campaign data changes
  useEffect(() => {
    if (campaign) {
      setSettings({
        enabled: campaign.enabled,
        discountPercent: campaign.discountPercent,
        timerMinutes: campaign.timerMinutes,
        displayStyle: campaign.displayStyle as "progress" | "countdown",
        primaryColor: campaign.primaryColor,
      });
    }
  }, [campaign]);

  const handleToggle = useCallback(() => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
    fetcher.submit({ intent: "toggle" }, { method: "POST" });
  }, [fetcher]);

  const handleSave = useCallback(() => {
    fetcher.submit(
      {
        intent: "save",
        discountPercent: settings.discountPercent.toString(),
        timerMinutes: settings.timerMinutes.toString(),
        displayStyle: settings.displayStyle,
        primaryColor: settings.primaryColor,
      },
      { method: "POST" }
    );
  }, [fetcher, settings]);

  const isLoading = fetcher.state !== "idle";

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>
          <Timer
            size={32}
            style={{ verticalAlign: "middle", marginRight: "8px" }}
          />
          Cart Timer Discount
        </h1>
        <p style={styles.subtitle}>
          Boost conversions with a subtle, trust-building countdown timer
        </p>
      </header>

      {/* Status Card */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div
            style={{
              ...styles.cardIcon,
              background: settings.enabled ? "#dcfce7" : "#fee2e2",
            }}
          >
            <Power
              size={20}
              color={settings.enabled ? "#16a34a" : "#dc2626"}
            />
          </div>
          <div>
            <h2 style={styles.cardTitle}>Campaign Status</h2>
            <p style={styles.cardDescription}>
              {settings.enabled
                ? "Your timer is active on your store"
                : "Enable to start showing timer to customers"}
            </p>
          </div>
        </div>

        <div style={styles.toggleContainer}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "#1a1a2e" }}>
              {settings.enabled ? "Campaign Active" : "Campaign Paused"}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6b7280" }}>
              {shopName}.myshopify.com
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={isLoading}
            style={{
              ...styles.toggle,
              background: settings.enabled ? "#6366f1" : "#d1d5db",
            }}
          >
            <div
              style={{
                ...styles.toggleKnob,
                left: settings.enabled ? "28px" : "4px",
              }}
            />
          </button>
        </div>
      </div>

      {/* Step 1: Discount Amount */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={{ ...styles.cardIcon, background: "#fef3c7" }}>
            <Percent size={20} color="#d97706" />
          </div>
          <div>
            <h2 style={styles.cardTitle}>Step 1: Discount Amount</h2>
            <p style={styles.cardDescription}>
              Choose how much discount to offer
            </p>
          </div>
        </div>

        <div style={styles.sliderContainer}>
          <div style={styles.sliderLabel}>
            <span style={styles.sliderLabelText}>Discount Percentage</span>
            <span style={styles.sliderValue}>{settings.discountPercent}% OFF</span>
          </div>
          <input
            type="range"
            min="5"
            max="20"
            value={settings.discountPercent}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                discountPercent: Number(e.target.value),
              }))
            }
            style={styles.slider}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#9ca3af",
              marginTop: "8px",
            }}
          >
            <span>5%</span>
            <span>20%</span>
          </div>
        </div>
      </div>

      {/* Step 2: Timer Duration */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={{ ...styles.cardIcon, background: "#dbeafe" }}>
            <Clock size={20} color="#2563eb" />
          </div>
          <div>
            <h2 style={styles.cardTitle}>Step 2: Timer Duration</h2>
            <p style={styles.cardDescription}>
              How long customers have to checkout
            </p>
          </div>
        </div>

        <div style={styles.sliderContainer}>
          <div style={styles.sliderLabel}>
            <span style={styles.sliderLabelText}>Timer Duration</span>
            <span style={styles.sliderValue}>{settings.timerMinutes} minutes</span>
          </div>
          <input
            type="range"
            min="5"
            max="15"
            value={settings.timerMinutes}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                timerMinutes: Number(e.target.value),
              }))
            }
            style={styles.slider}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#9ca3af",
              marginTop: "8px",
            }}
          >
            <span>5 min</span>
            <span>15 min</span>
          </div>
        </div>
      </div>

      {/* Step 3: Display Style */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={{ ...styles.cardIcon, background: "#f3e8ff" }}>
            <Palette size={20} color="#9333ea" />
          </div>
          <div>
            <h2 style={styles.cardTitle}>Step 3: Display Style</h2>
            <p style={styles.cardDescription}>
              Choose how the timer appears to customers
            </p>
          </div>
        </div>

        <div style={styles.optionGroup}>
          <button
            type="button"
            onClick={() =>
              setSettings((prev) => ({ ...prev, displayStyle: "progress" }))
            }
            style={{
              ...styles.optionButton,
              ...(settings.displayStyle === "progress"
                ? styles.optionButtonActive
                : {}),
            }}
          >
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "#e5e7eb",
                borderRadius: "4px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "65%",
                  height: "100%",
                  background: settings.primaryColor,
                  borderRadius: "4px",
                }}
              />
            </div>
            <p style={{ margin: 0, fontWeight: 600, color: "#1a1a2e" }}>
              Progress Bar
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              Calm & modern
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSettings((prev) => ({ ...prev, displayStyle: "countdown" }))
            }
            style={{
              ...styles.optionButton,
              ...(settings.displayStyle === "countdown"
                ? styles.optionButtonActive
                : {}),
            }}
          >
            <p
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: settings.primaryColor,
                margin: "0 0 12px 0",
              }}
            >
              09:45
            </p>
            <p style={{ margin: 0, fontWeight: 600, color: "#1a1a2e" }}>
              Countdown
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              Classic timer
            </p>
          </button>
        </div>

        <div style={styles.colorInput}>
          <input
            type="color"
            value={settings.primaryColor}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, primaryColor: e.target.value }))
            }
            style={styles.colorSwatch}
          />
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "#1a1a2e" }}>
              Timer Color
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6b7280" }}>
              {settings.primaryColor}
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isLoading}
        style={{
          ...styles.saveButton,
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? (
          "Saving..."
        ) : (
          <>
            <Check size={20} />
            Save Settings
          </>
        )}
      </button>

      {/* Preview Card */}
      <div style={{ ...styles.card, marginTop: "24px" }}>
        <div style={styles.cardHeader}>
          <div style={{ ...styles.cardIcon, background: "#ecfdf5" }}>
            <Zap size={20} color="#10b981" />
          </div>
          <div>
            <h2 style={styles.cardTitle}>Live Preview</h2>
            <p style={styles.cardDescription}>
              This is how your timer will appear
            </p>
          </div>
        </div>

        <div style={styles.previewBox}>
          <p style={{ margin: "0 0 8px 0", color: "#6b7280", fontSize: "14px" }}>
            🎁 Complete your order for {settings.discountPercent}% off!
          </p>

          {settings.displayStyle === "countdown" ? (
            <p style={{ ...styles.previewTimer, color: settings.primaryColor }}>
              {String(settings.timerMinutes).padStart(2, "0")}:00
            </p>
          ) : (
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: "75%",
                  background: settings.primaryColor,
                }}
              />
            </div>
          )}

          <p
            style={{
              margin: "12px 0 0 0",
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            Time remaining: {settings.timerMinutes}:00
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Shield size={24} color="#6366f1" style={{ marginBottom: "8px" }} />
          <p style={styles.statLabel}>Server-Side</p>
          <p style={{ ...styles.statLabel, color: "#1a1a2e", fontWeight: 500 }}>
            Refresh-proof timers
          </p>
        </div>
        <div style={styles.statCard}>
          <TrendingUp size={24} color="#10b981" style={{ marginBottom: "8px" }} />
          <p style={styles.statLabel}>Conversion</p>
          <p style={{ ...styles.statLabel, color: "#1a1a2e", fontWeight: 500 }}>
            Boost checkout rates
          </p>
        </div>
        <div style={styles.statCard}>
          <Zap size={24} color="#f59e0b" style={{ marginBottom: "8px" }} />
          <p style={styles.statLabel}>Performance</p>
          <p style={{ ...styles.statLabel, color: "#1a1a2e", fontWeight: 500 }}>
            Lightweight code
          </p>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};