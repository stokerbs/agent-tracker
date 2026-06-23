# App icons & splash screens

Source images for **@capacitor/assets**, which generates every iOS/Android icon
and splash size from these. The committed files are **placeholders** (a cyan
crosshair on `#0b0f14`) — replace them with real artwork, same names/sizes.

| File | Size | Purpose |
|------|------|---------|
| `icon-only.png` | 1024×1024 | App icon (iOS + Android legacy) — include background |
| `icon-foreground.png` | 1024×1024 | Android adaptive **foreground** — transparent bg, mark inside center safe zone |
| `icon-background.png` | 1024×1024 | Android adaptive **background** — solid colour |
| `splash.png` | 2732×2732 | Launch splash (light) — keep the logo centered |
| `splash-dark.png` | 2732×2732 | Launch splash (dark) |

## Regenerate the placeholders
```bash
node scripts/generate-app-assets.mjs
```

## Generate platform assets (after `npx cap add ios|android`)
```bash
npm run assets:generate     # capacitor-assets generate
```
This writes the resized icons/splashes into `ios/` and `android/`. Re-run it
whenever you change these source files. Requires the native projects to exist.

Notes:
- Splash background colour is configured in `capacitor.config.ts` (`SplashScreen`).
- For best icons, keep the logo mark within the central ~66% (the adaptive-icon
  safe zone) so Android masks don't crop it.
