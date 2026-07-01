import { ImageResponse } from "next/og";

/**
 * Default social-share image (Open Graph / Twitter) for the whole site. Uses the
 * marketing "case-file / dossier" palette so links to detectivepulse.com render
 * a branded card instead of a blank preview. Latin-only text (no Thai) so it
 * renders reliably with the built-in font — no font file to embed.
 *
 * Placed at the app root so every marketing page (home, articles, EN) inherits
 * it unless it declares its own image. Private app pages are noindex, so a
 * branded fallback card there is harmless.
 */
export const alt = "Detective Pulse — Private Investigator in Thailand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#070d17";
const GOLD = "#e0a83c";
const CREAM = "#e9e3d5";
const MUTED = "#9a927f";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `radial-gradient(1200px 600px at 50% -10%, rgba(224,168,60,0.12), ${NAVY})`,
          padding: 64,
          border: `2px solid ${GOLD}`,
          borderRadius: 0,
          fontFamily: "sans-serif",
          color: CREAM,
        }}
      >
        {/* Top strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: GOLD,
          }}
        >
          <span>Confidential // Detective Pulse</span>
          <span style={{ color: MUTED }}>Est. 2016</span>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, letterSpacing: 10, color: GOLD, textTransform: "uppercase" }}>
            Case File · Private Investigator
          </div>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, lineHeight: 1.05, marginTop: 12 }}>
            <span>Detective</span>
            <span style={{ color: GOLD }}>Pulse</span>
          </div>
          <div style={{ fontSize: 38, color: MUTED, marginTop: 16 }}>
            Professional private investigators · Thailand · Nationwide
          </div>
        </div>

        {/* Bottom credentials */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <span style={{ color: GOLD }}>Rated 4.8 / 5 · 63 reviews</span>
          <span>Confidential · Nationwide · detectivepulse.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
