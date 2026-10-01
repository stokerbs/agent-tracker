# 05 · Page-by-Page SEO Specification (`/zh`)

Global rules (implemented in code):
- `<html lang="zh-CN">` on every `/zh/*` page (middleware header → root layout).
- `alternates.canonical` = self; `alternates.languages` = `zh-CN`, `th`, `en`, `x-default` (x-default → `/en` counterpart or `/en`).
- One H1 per page, H2 per section, H3 for FAQ questions.
- JSON-LD: `ProfessionalService` (zh), `BreadcrumbList`, `FAQPage` where FAQ ≥ 3, `Service` on service pages.
- OG: title/description/`/api/og` image, `siteName`.
- All pages SSG (`generateStaticParams`), no client JS except CTA/form islands.
- Titles ≤ 30 Chinese characters incl. brand; descriptions 70–110 characters.

| URL | Title tag | Meta description | H1 | Primary keyword | Secondary | Internal links out |
|---|---|---|---|---|---|---|
| /zh | 泰国专业调查与核实服务 \| Detective Pulse | 为中国客户提供泰国本地调查、背景核实、寻人及商业尽职调查服务。泰国本地团队，全国覆盖，微信沟通，证据化报告。 | 泰国专业调查与核实服务 | 泰国调查 | 泰国私人调查, 泰国背景调查 | all services, how-it-works, pricing, locations, contact |
| /zh/private-investigator-thailand | 泰国私家侦探服务 — 本地团队、合法取证 \| Detective Pulse | 泰国本地专业私家侦探团队：感情调查、寻人、背景核实、商业尽调与实地核实。流程透明，报告可用于决策。 | 泰国私家侦探服务 | 泰国私家侦探 | 泰国侦探公司, 泰国私人调查 | 6 services, pricing, how-it-works |
| /zh/bangkok-investigation | 曼谷调查服务 — 感情、寻人、商业核实 \| Detective Pulse | 曼谷本地调查团队，承接感情调查、寻人、公司与地址核实。 | 曼谷调查服务 | 曼谷调查 | 曼谷私家侦探 | /zh/bangkok, services |
| /zh/relationship-investigation | 泰国婚姻与感情调查 — 远程委托 \| Detective Pulse | 伴侣在泰国工作、留学或旅居？泰国本地团队以合法方式核实事实，提供照片、时间线与书面报告。 | 泰国婚姻与感情调查 | 泰国婚外情调查 | 泰国出轨调查, 泰国伴侣调查 | how-it-works, pricing, bangkok/pattaya/phuket, contact |
| /zh/background-check | 泰国背景核实服务 \| Detective Pulse | 核实泰国个人或企业的身份一致性、公开记录、职业与经营情况。仅使用合法渠道，不承诺获取受限数据。 | 泰国背景核实 | 泰国背景调查 | 泰国背景核查, 泰国人背景调查 | business-due-diligence, on-site, contact |
| /zh/find-person-thailand | 泰国寻人服务 — 合法、保密 \| Detective Pulse | 寻找在泰国的失联亲友、合作方或债务人。基于公开信息与实地走访，结果以书面报告交付。 | 泰国寻人服务 | 泰国寻人 | 泰国找人, 在泰国找人 | how-it-works, pricing, contact |
| /zh/business-due-diligence | 泰国商业尽职调查 — 公司、团队、经营核实 \| Detective Pulse | 面向中国企业与投资者：核实泰国公司注册、经营地址、管理层、供应商与合作方。实地取证，书面报告。 | 泰国商业尽职调查 | 泰国尽职调查 | 泰国公司调查, 泰国商业调查 | on-site-verification, background-check, chonburi, contact |
| /zh/on-site-verification | 泰国实地核实 — 地址、公司、工厂、店铺 \| Detective Pulse | 泰国本地团队到现场核实地址是否存在、公司是否经营、工厂/店铺是否运作，并提供照片与报告。 | 泰国实地核实 | 泰国实地调查 | 泰国地址核实, 泰国工厂核实 | business-due-diligence, locations, contact |
| /zh/asset-investigation | 泰国资产调查 \| Detective Pulse | 通过合法公开渠道核实泰国境内房产、土地、车辆及公司持股情况，用于诉讼准备或商业决策。 | 泰国资产调查 | 泰国资产调查 | 泰国财产调查 | business-due-diligence, pricing |
| /zh/how-it-works | 调查流程 — 从咨询到报告 \| Detective Pulse | 了解 Detective Pulse 的六步流程：咨询、评估、报价、付款、调查、交付。 | 调查流程 | 泰国私家侦探 流程 | 泰国调查 需要多久 | pricing, contact |
| /zh/pricing | 收费说明 — 泰国调查费用 \| Detective Pulse | 泰国调查服务如何计费：按天/按项目、首付 50%、尾款交付前支付。透明报价，无隐藏费用。 | 收费说明 | 泰国私家侦探 费用 | 泰国调查 价格 | how-it-works, contact |
| /zh/case-studies | 案例分享（匿名） \| Detective Pulse | 匿名化的泰国调查案例：客户情况、目标、方法、时间线、交付物与结果。 | 案例分享 | 泰国侦探 案例 | — | services. **noindex while empty** |
| /zh/about | 关于 Detective Pulse — 泰国本地调查团队 \| Detective Pulse | 2016 年起在泰国运营的专业调查团队。了解我们的团队、覆盖范围、保密政策与沟通方式。 | 关于 Detective Pulse | 泰国侦探公司 | 泰国侦探 靠谱 | how-it-works, contact, privacy |
| /zh/contact | 联系我们 — 微信咨询 / 提交案件资料 \| Detective Pulse | 通过微信、邮件或在线表单联系泰国本地调查团队，24 小时内回复。 | 联系我们 | 泰国侦探 联系 | — | — |
| /zh/bangkok | 曼谷调查与核实服务 \| Detective Pulse | 曼谷地区感情调查、寻人、公司与地址核实。 | 曼谷调查与核实服务 | 曼谷调查 | 曼谷私家侦探 | 3 services, contact |
| /zh/pattaya | 芭提雅调查与核实服务 \| Detective Pulse | 芭提雅/春武里沿海地区感情调查、寻人与实地核实。 | 芭提雅调查与核实服务 | 芭提雅调查 | 芭提雅侦探 | relationship, find-person, contact |
| /zh/phuket | 普吉调查与核实服务 \| Detective Pulse | 普吉岛感情调查、寻人、房产与经营核实。 | 普吉调查与核实服务 | 普吉调查 | 普吉岛侦探 | relationship, asset, on-site |
| /zh/chiang-mai | 清迈调查与核实服务 \| Detective Pulse | 清迈地区留学生/旅居人群相关调查、寻人与背景核实。 | 清迈调查与核实服务 | 清迈调查 | 清迈侦探 | relationship, find-person, background |
| /zh/chonburi | 春武里调查与核实服务 \| Detective Pulse | 春武里/东部经济走廊工厂、供应商与公司实地核实。 | 春武里调查与核实服务 | 春武里调查 | 春武里 工厂 核实 | on-site, business-dd |
| /zh/samui | 苏梅岛调查与核实服务 \| Detective Pulse | 苏梅岛感情调查、寻人与度假物业核实。 | 苏梅岛调查与核实服务 | 苏梅岛调查 | 苏梅岛侦探 | relationship, asset |

Image policy: hero uses existing `/api/og`; service pages use category stock covers already in `public/marketing/articles` (no new binaries), `alt` in Chinese, `next/image` with `sizes`.
