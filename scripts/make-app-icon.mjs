// Generates the iOS app icon (1024x1024, no alpha) — Federal Tactical brand:
// a gold federal-badge shield with a pulse/ECG line ("Detective Pulse") on a
// deep-navy radial background. Writes straight into the iOS asset catalog.
//
//   node scripts/make-app-icon.mjs
//
// Re-run after editing the design below; then rebuild the native app so the new
// icon ships in the binary.
import sharp from "sharp";

const GOLD = "#E6AC3E";
const NAVY0 = "#16213B";
const NAVY1 = "#090D16";
const OUT = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="${NAVY0}"/>
      <stop offset="100%" stop-color="${NAVY1}"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <path d="M512 150 L846 286 L846 532 C846 706 706 826 512 884 C318 826 178 706 178 532 L178 286 Z"
        fill="${GOLD}" fill-opacity="0.07" stroke="${GOLD}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M512 196 L808 316 L808 528 C808 676 690 782 512 836 C334 782 216 676 216 528 L216 316 Z"
        fill="none" stroke="${GOLD}" stroke-width="6" stroke-opacity="0.55" stroke-linejoin="round"/>
  <path d="M250 500 H430 l28 -64 l44 196 l54 -300 l40 168 H774"
        fill="none" stroke="${GOLD}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

await sharp(Buffer.from(svg), { density: 384 })
  .resize(1024, 1024)
  .flatten({ background: NAVY1 })
  .png()
  .toFile(OUT);
console.log("wrote", OUT);
