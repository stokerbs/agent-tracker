# 03 · Chinese Sitemap (`/zh`)

All URLs below are emitted by `src/app/sitemap.ts`. `/cn/*` 301s to the same path under `/zh`.

| URL | Type | Title (H1) | Priority | Status |
|---|---|---|---|---|
| `/zh` | Home | 泰国专业调查与核实服务 | 0.9 | Repositioned |
| `/zh/private-investigator-thailand` | Pillar | 泰国私家侦探服务 | 0.8 | New |
| `/zh/bangkok-investigation` | Service × city | 曼谷调查服务 | 0.8 | New |
| `/zh/relationship-investigation` | Service (A) | 泰国婚姻与感情调查 | 0.8 | New |
| `/zh/background-check` | Service (C) | 泰国背景核实 | 0.8 | New |
| `/zh/find-person-thailand` | Service (B) | 泰国寻人服务 | 0.8 | New |
| `/zh/business-due-diligence` | Service (D, B2B) | 泰国商业尽职调查 | 0.8 | New |
| `/zh/on-site-verification` | Service (E) | 泰国实地核实 | 0.8 | New |
| `/zh/asset-investigation` | Service | 泰国资产调查 | 0.7 | New |
| `/zh/how-it-works` | Trust | 调查流程 | 0.7 | New |
| `/zh/pricing` | Trust / transactional | 收费说明 | 0.7 | New (figures require confirmation) |
| `/zh/case-studies` | Trust | 案例分享 | 0.6 | New — noindex until first case published |
| `/zh/about` | Trust | 关于 Detective Pulse | 0.6 | New |
| `/zh/contact` | Conversion | 联系我们 / 提交案件资料 | 0.8 | New |
| `/zh/bangkok` | Location | 曼谷调查服务 | 0.7 | New |
| `/zh/pattaya` | Location | 芭提雅调查服务 | 0.7 | New |
| `/zh/phuket` | Location | 普吉调查服务 | 0.7 | New |
| `/zh/chiang-mai` | Location | 清迈调查服务 | 0.7 | New |
| `/zh/chonburi` | Location | 春武里调查服务 | 0.7 | New |
| `/zh/samui` | Location | 苏梅岛调查服务 | 0.7 | New |
| `/zh/articles` | Hub | 文章与指南 | 0.5 | Existing |
| `/zh/articles/[slug]` | Article | — | 0.6 | Existing pipeline |

Hua Hin is listed in the brief as a target location but not built as a page: there is no evidence in the repo of a distinct Hua Hin operation. Add `/zh/hua-hin` only after DP confirms genuine coverage (one registry entry).

## Internal-link architecture

- Header (zh): 服务 ▾ (6 services) · 流程 · 收费 · 案例 · 关于 · 联系 · 语言
- Every service page → how-it-works, pricing, contact, 2 related services, relevant location pages.
- Every location page → the 3 most relevant services + contact.
- Homepage → all 6 services, process, coverage (6 locations), case studies, FAQ, contact.
- Footer (zh) → services, locations, about, privacy.
- Articles → related service page via the `RelatedArticles` slot (next iteration: tag articles with a service).
