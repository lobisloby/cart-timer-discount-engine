// app/routes/app.debug.tsx

import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import type { TimerSession } from "@prisma/client";
import { RotateCcw, Trash2, Database, Users, Clock } from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const campaign = await prisma.campaign.findUnique({ where: { shop } });

  const timerSessions = await prisma.timerSession.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const activeSessions = timerSessions.filter(s => !s.isExpired && s.expiresAt > new Date()).length;
  const expiredSessions = timerSessions.filter(s => s.isExpired).length;
  const cooldownSessions = timerSessions.filter(s => s.cooldownUntil && s.cooldownUntil > new Date()).length;

  return {
    shop,
    campaign,
    timerSessions,
    stats: {
      total: timerSessions.length,
      active: activeSessions,
      expired: expiredSessions,
      cooldown: cooldownSessions,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "reset_all") {
    const deleted = await prisma.timerSession.deleteMany({
      where: { shop },
    });
    return { success: true, message: `🗑️ Deleted ${deleted.count} timer sessions` };
  }

  if (intent === "reset_one") {
    const id = formData.get("id") as string;
    await prisma.timerSession.delete({ where: { id } });
    return { success: true, message: "✅ Session deleted" };
  }

  if (intent === "reset_expired") {
    const deleted = await prisma.timerSession.deleteMany({
      where: {
        shop,
        OR: [
          { isExpired: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });
    return { success: true, message: `🗑️ Cleared ${deleted.count} expired sessions` };
  }

  return { success: false, message: "Unknown action" };
};

export default function DebugPage() {
  const { campaign, timerSessions, stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const isLoading = fetcher.state !== "idle";

  const card = {
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  const btn = (color: string, bg: string) => ({
    padding: "10px 18px",
    fontSize: "13px",
    fontWeight: 600 as const,
    color,
    background: bg,
    border: "none",
    borderRadius: "8px",
    cursor: isLoading ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    opacity: isLoading ? 0.6 : 1,
  });

  const statBox = {
    padding: "14px",
    borderRadius: "10px",
    textAlign: "center" as const,
    background: "#f8fafc",
    border: "1px solid #f1f5f9",
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString();
  };

  const getStatus = (s: TimerSession) => {
    const now = new Date();
    if (!s.isExpired && new Date(s.expiresAt) > now) return { label: "⏳ Active", color: "#10b981" };
    if (s.cooldownUntil && new Date(s.cooldownUntil) > now) return { label: "🚫 Cooldown", color: "#f59e0b" };
    if (s.isExpired) return { label: "⏰ Expired", color: "#ef4444" };
    return { label: "✅ Ready", color: "#6366f1" };
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
        <Database size={22} color="#6366f1" />
        Debug & Testing
      </h1>
      <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
        Monitor timer sessions and reset for testing
      </p>

      {/* Toast */}
      {fetcher.data?.success && (
        <div style={{ padding: "12px 16px", background: "#ecfdf5", border: "1px solid #86efac", borderRadius: "10px", marginBottom: "16px", fontSize: "14px", color: "#166534", fontWeight: 500 }}>
          {fetcher.data.message}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        <div style={statBox}>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>{stats.total}</p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>Total Sessions</p>
        </div>
        <div style={statBox}>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#10b981" }}>{stats.active}</p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>Active</p>
        </div>
        <div style={statBox}>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#ef4444" }}>{stats.expired}</p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>Expired</p>
        </div>
        <div style={statBox}>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#f59e0b" }}>{stats.cooldown}</p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>In Cooldown</p>
        </div>
      </div>

      {/* Reset Buttons */}
      <div style={card}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <RotateCcw size={18} color="#6366f1" />
          Reset Controls
        </h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          <fetcher.Form method="POST">
            <input type="hidden" name="intent" value="reset_all" />
            <button type="submit" disabled={isLoading} style={btn("#fff", "#ef4444")}>
              <Trash2 size={14} /> Delete ALL Sessions
            </button>
          </fetcher.Form>

          <fetcher.Form method="POST">
            <input type="hidden" name="intent" value="reset_expired" />
            <button type="submit" disabled={isLoading} style={btn("#fff", "#f59e0b")}>
              <Clock size={14} /> Clear Expired Only
            </button>
          </fetcher.Form>
        </div>

        <div style={{ padding: "12px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#1e40af" }}>
            <strong>After resetting server data</strong>, also clear browser data:<br />
            Open product page → F12 → Console → paste:
          </p>
          <code style={{ display: "block", marginTop: "8px", padding: "10px", background: "#0f172a", color: "#e2e8f0", borderRadius: "6px", fontSize: "12px", wordBreak: "break-all" }}>
            {`Object.keys(localStorage).forEach(k=>{if(k.startsWith('ct_')||k.startsWith('pdt_'))localStorage.removeItem(k)});sessionStorage.clear();location.reload();`}
          </code>
        </div>
      </div>

      {/* Campaign Settings */}
      <div style={card}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
          Campaign Settings
        </h2>
        {campaign ? (
          <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: "14px", borderRadius: "8px", fontSize: "12px", overflow: "auto", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(campaign, null, 2)}
          </pre>
        ) : (
          <p style={{ color: "#ef4444", fontSize: "14px" }}>No campaign — save settings first</p>
        )}
      </div>

      {/* Timer Sessions */}
      <div style={card}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Users size={18} color="#6366f1" />
          Timer Sessions ({timerSessions.length})
        </h2>

        {timerSessions.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "14px" }}>No sessions yet — visit a product page to create one</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {timerSessions.map((s) => {
              const status = getStatus(s);
              return (
                <div key={s.id} style={{
                  padding: "12px 14px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: status.color,
                        background: status.color + "18",
                        padding: "2px 8px",
                        borderRadius: "10px",
                      }}>
                        {status.label}
                      </span>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {s.discountPct}% off • {s.timerMinutes}min
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>
                      {s.visitorId}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                      Expires: {formatDate(s.expiresAt)}
                      {s.cooldownUntil && ` • Cooldown: ${formatDate(s.cooldownUntil)}`}
                    </p>
                  </div>
                  <fetcher.Form method="POST">
                    <input type="hidden" name="intent" value="reset_one" />
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" disabled={isLoading} style={{
                      width: "30px", height: "30px", border: "none",
                      background: "#fee2e2", color: "#ef4444", borderRadius: "6px",
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "14px",
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </fetcher.Form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};