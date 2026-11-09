# Public website document language

On `detectivepulse.com` and `www.detectivepulse.com`, the HTML document language follows the URL: `/en` and `/en/*` use `en`, `/zh` and `/zh/*` use `zh-CN`, English campaign pages under `/lp/en/*` use `en`, and Thai pages use `th`. The app's `locale` cookie does not select the public website's language.

Next.js 15 discovers middleware beside the application directory. This project uses `src/app`, so the registered entry point is `src/middleware.ts`. The previous repository-root file was not loaded. The replacement forwards a freshly derived `x-marketing-lang` **request** header for .com page requests only; it does not redirect requests, refresh sessions, or call Supabase. API routes, assets, and other hosts are excluded. Existing authorization remains in its existing application layers.

The root layout uses that header for the server-rendered `<html lang>`. `MarketingDocumentLanguage` also synchronizes the attribute on .com client navigation, because Next.js preserves the root layout between pages. It is mounted inside the public website chrome and has no visible UI.

Verification must include raw HTML with JavaScript disabled, conflicting app cookies and incoming language headers, `www`, and client navigation between all three languages. Check normal links and browser back/forward without requiring a full reload. Unit tests exercise Next.js's actual matcher, header forwarding, URL segment boundaries and preservation of app-host locale behavior.
