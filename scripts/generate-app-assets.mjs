// Generates placeholder source images for @capacitor/assets into ./assets.
// Replace these with real artwork later, then re-run `npm run assets:generate`
// (after `npx cap add`) to produce all platform icon/splash sizes.
//
//   node scripts/generate-app-assets.mjs
//
// Brand: cyan crosshair on the app's dark background (#0b0f14).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BG = "#0b0f14";
const CYAN = "#22d3ee";

await mkdir("assets", { recursive: true });

function crosshair(size, r, strokeW, withBg) {
  const c = size / 2;
  const tick = r * 0.28;
  const line = (x1, y1, x2, y2) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${CYAN}" stroke-width="${strokeW}" stroke-linecap="round"/>`;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${withBg ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : ""}
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${CYAN}" stroke-width="${strokeW}"/>
  <circle cx="${c}" cy="${c}" r="${r * 0.07}" fill="${CYAN}"/>
  ${line(c, c - r - tick, c, c - r + tick)}
  ${line(c, c + r - tick, c, c + r + tick)}
  ${line(c - r - tick, c, c - r + tick, c)}
  ${line(c + r - tick, c, c + r + tick, c)}
</svg>`);
}

async function write(svg, size, file) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`assets/${file}`);
}

// Full app icon (background + mark).
await write(crosshair(1024, 300, 34, true), 1024, "icon-only.png");
// Adaptive (Android) foreground: mark only, inside the safe zone, transparent bg.
await write(crosshair(1024, 220, 30, false), 1024, "icon-foreground.png");
// Adaptive background: solid brand colour.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
  .png()
  .toFile("assets/icon-background.png");
// Splash (light + dark identical for a dark-themed app).
await write(crosshair(2732, 420, 40, true), 2732, "splash.png");
await write(crosshair(2732, 420, 40, true), 2732, "splash-dark.png");

console.log("Generated placeholder assets in ./assets");
