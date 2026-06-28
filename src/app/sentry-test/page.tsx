"use client";

// TEMPORARY — Sentry verification page. Remove after confirming events arrive
// in Sentry → Issues. The button only throws inside the clicker's own browser
// (no server surface, no data access); it exists solely to prove the client
// SDK + capture pipeline are live on production.
import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SentryTestPage() {
  const [sent, setSent] = useState<string | null>(null);

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Sentry verification</h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: "8px 0 20px" }}>
          Click to send a test error. Then check Sentry → Issues. Remove this page afterwards.
        </p>
        <button
          onClick={() => {
            const err = new Error(`Sentry verify — client test ${new Date().toISOString()}`);
            // Explicit capture (guaranteed send when the SDK is active)...
            Sentry.captureException(err, { tags: { context: "sentry:verify" } });
            setSent(new Date().toLocaleTimeString());
            // ...plus an uncaught throw to exercise the global handler.
            throw err;
          }}
          style={{
            background: "#10b981", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Throw test error
        </button>
        {sent && (
          <p style={{ color: "#10b981", fontSize: 13, marginTop: 16 }}>
            Sent at {sent} — check Sentry Issues for &quot;Sentry verify — client test&quot;.
          </p>
        )}
      </div>
    </main>
  );
}
