// app/routes/app.debug.tsx

import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const campaign = await prisma.campaign.findUnique({ where: { shop } });

  return { shop, campaign };
};

export default function DebugPage() {
  const { shop, campaign } = useLoaderData<typeof loader>();

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>
        🔍 Debug — Database Settings
      </h1>

      <div style={{
        background: campaign ? "#ecfdf5" : "#fef2f2",
        border: `1px solid ${campaign ? "#86efac" : "#fecaca"}`,
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
      }}>
        <p style={{ margin: 0, fontWeight: 600, color: campaign ? "#166534" : "#991b1b" }}>
          {campaign ? "✅ Campaign found in database" : "❌ No campaign found — save settings first"}
        </p>
      </div>

      {campaign && (
        <div style={{
          background: "#0f172a",
          color: "#e2e8f0",
          padding: "16px",
          borderRadius: "10px",
          fontSize: "13px",
          whiteSpace: "pre-wrap" as const,
          overflow: "auto",
        }}>
          {JSON.stringify(campaign, null, 2)}
        </div>
      )}

      <div style={{
        marginTop: "16px",
        padding: "16px",
        background: "#eff6ff",
        borderRadius: "10px",
        border: "1px solid #bfdbfe",
      }}>
        <p style={{ margin: 0, fontSize: "14px", color: "#1e40af" }}>
          <strong>Shop:</strong> {shop}<br />
          <strong>Proxy URL:</strong> /apps/timer?shop={shop}<br />
          <strong>How it works:</strong> Widget fetches settings from /apps/timer → App Proxy → Database
        </p>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};