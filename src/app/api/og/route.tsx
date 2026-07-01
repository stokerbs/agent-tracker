import { ImageResponse } from "next/og";

export const runtime = "edge";

const NAVY = "#0a0e16";
const GOLD = "#d6a23f";
const TEXT = "#e8e2d2";
const MUTED = "#9a937f";

const Star = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill={GOLD}>
    <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21l1.4-6.8L2.2 9.5l6.9-.8z" />
  </svg>
);

/**
 * Branded dossier Open Graph image (1200×630) for the marketing site — shown
 * when a page is shared on social or previewed by Google Ads. Latin text only
 * (next/og default font), on-theme FBI × Sherlock look.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: NAVY,
          backgroundImage: `radial-gradient(900px 500px at 80% -10%, ${GOLD}22, transparent), linear-gradient(0deg, ${NAVY}, #0c1220)`,
          color: TEXT,
          fontFamily: "sans-serif",
          border: `2px solid ${GOLD}55`,
        }}
      >
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              color: GOLD,
              letterSpacing: "6px",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              <circle cx="12" cy="12" r="1.5" fill={GOLD} />
            </svg>
            CASE FILE
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              border: `2px solid ${GOLD}88`,
              borderRadius: "6px",
              color: GOLD,
              letterSpacing: "5px",
              fontSize: "20px",
              fontWeight: 700,
              transform: "rotate(-6deg)",
            }}
          >
            CONFIDENTIAL
          </div>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "76px", fontWeight: 800, letterSpacing: "-1px" }}>
            <span>Detective</span>
            <span style={{ color: GOLD }}>Pulse</span>
          </div>
          <div style={{ display: "flex", marginTop: "18px", fontSize: "34px", color: TEXT }}>
            Professional Private Investigators · Thailand
          </div>
          <div style={{ display: "flex", marginTop: "10px", fontSize: "24px", color: MUTED }}>
            Infidelity · Asset search · Background checks · Find a person · Cyber
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <Star /><Star /><Star /><Star /><Star />
            </div>
            <div style={{ display: "flex", fontSize: "26px", color: TEXT, marginLeft: "8px" }}>
              4.8 · 63 reviews
            </div>
          </div>
          <div style={{ display: "flex", fontSize: "24px", letterSpacing: "2px", color: GOLD }}>
            detectivepulse.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "cache-control": "public, max-age=86400, s-maxage=604800, immutable" },
    },
  );
}
