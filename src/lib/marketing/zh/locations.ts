import type { ZhPage } from "./types";

/**
 * Location pages (/zh/<city>). Each carries genuinely different local context
 * (who the Chinese clients there are, what gets verified, practical notes) —
 * never a templated swap of the city name. Only cities where Detective Pulse
 * states it operates; Hua Hin is intentionally absent until confirmed.
 */
export const ZH_LOCATION_PAGES: ZhPage[] = [
  {
    slug: "bangkok",
    kind: "location",
    service: "general",
    title: "曼谷调查与核实服务",
    description: "曼谷地区感情调查、寻人、公司与地址核实。核心团队常驻曼谷，熟悉素坤逸、是隆、沙吞、拉差达等区域。",
    h1: "曼谷调查与核实服务",
    eyebrow: "Location · 曼谷",
    intro: "曼谷是泰国的商业与教育中心，也是中国客户委托最集中的城市。我们的核心团队常驻曼谷，可当天启动大部分核实工作。",
    sections: [
      {
        heading: "曼谷的中国客户通常委托什么",
        body: [],
        bullets: [
          "伴侣在曼谷外派、留学（朱拉、法政、曼谷大学、易三仓等）或长期居住期间的事实核实",
          "注册在素坤逸、是隆、沙吞、拉差达等商务区的公司是否实际办公",
          "网络认识、自称在曼谷工作的人是否真实",
          "曼谷公寓项目、商铺投资的实地核实",
          "失联亲友在曼谷的下落核实（唐人街、惠恭王、拉差达等华人聚居区）",
        ],
      },
      {
        heading: "本地实际情况",
        body: [
          "曼谷的地址体系（Soi 巷、Moo 村、Khwaeng 分区）与中文地址习惯差异大，同一条路可能跨多个区；高峰期交通使跨区观察需要预留更多时间。公寓楼普遍有门禁，观察在公共区域进行。",
          "商务区公司普遍使用共享办公或虚拟地址，“注册地址存在”不等于“实际在此经营”，实地核实时我们会区分这两者。",
        ],
      },
    ],
    faq: [
      { q: "曼谷案件可以多快开始？", a: "公开信息核实可当天开始；实地工作通常在确认后 1–2 个工作日内安排。" },
      { q: "曼谷周边（暖武里、巴吞他尼、北榄）也覆盖吗？", a: "覆盖，按曼谷标准报价，个别远郊地点可能增加交通费用。" },
    ],
    related: ["bangkok-investigation", "relationship-investigation", "on-site-verification", "contact"],
    primaryCta: "wechat",
  },
  {
    slug: "pattaya",
    kind: "location",
    service: "general",
    title: "芭提雅调查与核实服务",
    description: "芭提雅及春武里沿海地区感情调查、寻人与实地核实。熟悉芭提雅旅游区、中天海滩与周边度假物业。",
    h1: "芭提雅调查与核实服务",
    eyebrow: "Location · 芭提雅",
    intro: "芭提雅是中国客户感情调查与寻人委托的高频地点：伴侣以出差、度假为由频繁前往，或失联亲友最后出现在这里。",
    sections: [
      {
        heading: "芭提雅常见委托",
        body: [],
        bullets: [
          "伴侣频繁前往芭提雅、或在芭提雅长期居住的事实核实",
          "在芭提雅经营酒吧、餐厅、民宿的人员或公司是否真实",
          "度假公寓、海景房项目的实地核实（中天 Jomtien、Pratumnak、Wongamat）",
          "失联人员在芭提雅的下落核实",
        ],
      },
      {
        heading: "本地实际情况",
        body: [
          "芭提雅娱乐区人流密集、营业时间集中在夜间，观察类工作通常安排在晚间并需要多名调查员配合。旅游区流动人口多，寻人需要结合住宿区域与社交媒体线索。",
          "芭提雅距曼谷约两小时车程，我们从曼谷派员或由当地人员执行，差旅费用会在报价中列明。",
        ],
      },
    ],
    faq: [
      { q: "夜间观察是否安全、合法？", a: "调查员仅在公共场所工作，不进入私人场所或与目标人接触，所有工作在泰国法律允许的范围内进行。" },
    ],
    related: ["relationship-investigation", "find-person-thailand", "on-site-verification", "chonburi"],
    primaryCta: "wechat",
  },
  {
    slug: "phuket",
    kind: "location",
    service: "general",
    title: "普吉调查与核实服务",
    description: "普吉岛感情调查、寻人、度假房产与经营核实。覆盖普吉镇、芭东、卡塔、卡伦、邦涛等区域。",
    h1: "普吉调查与核实服务",
    eyebrow: "Location · 普吉",
    intro: "普吉岛既是度假目的地，也是中国投资者关注的房产与酒店市场。我们在普吉处理感情调查、寻人以及物业与经营项目的实地核实。",
    sections: [
      {
        heading: "普吉常见委托",
        body: [],
        bullets: [
          "伴侣在普吉工作（酒店、潜店、餐饮、地产）或长期旅居的事实核实",
          "普吉别墅、公寓、酒店式公寓项目是否存在、进度与宣传是否一致",
          "自称在普吉经营民宿、旅行社的人员或公司核实",
          "在普吉失联的游客或家庭成员的下落核实",
        ],
      },
      {
        heading: "本地实际情况",
        body: [
          "普吉岛各区分散，芭东、卡塔、拉威、邦涛之间车程 30–60 分钟，单日多点核实需要合理规划。旺季（11 月至 3 月）住宿紧张，差旅费用相应提高。",
          "普吉房产项目常以“包租回报”形式向中国买家推广，实地核实重点在于项目是否实际施工、运营与销售文件是否一致。",
        ],
      },
    ],
    faq: [
      { q: "普吉的房产核实能看什么？", a: "项目现场状况、施工进度、周边环境、销售处是否存在，以及公开登记中的开发商信息。土地与产权的正式查询需与律师配合。" },
    ],
    related: ["relationship-investigation", "asset-investigation", "on-site-verification", "samui"],
    primaryCta: "wechat",
  },
  {
    slug: "chiang-mai",
    kind: "location",
    service: "general",
    title: "清迈调查与核实服务",
    description: "清迈地区留学生、数字游民与旅居人群相关的感情调查、寻人与背景核实。",
    h1: "清迈调查与核实服务",
    eyebrow: "Location · 清迈",
    intro: "清迈聚集了大量中国留学生、陪读家庭与长期旅居者。我们在清迈处理与留学、旅居和本地交往相关的事实核实。",
    sections: [
      {
        heading: "清迈常见委托",
        body: [],
        bullets: [
          "在清迈大学、清迈国际学校就读期间的伴侣或子女生活状况核实",
          "长期旅居清迈的家庭成员失联后的下落核实",
          "在清迈结识、准备结婚或合作的泰国或外籍人士背景核实",
          "清迈民宿、咖啡馆、学校等小型投资项目的经营核实",
        ],
      },
      {
        heading: "本地实际情况",
        body: [
          "清迈城区范围不大但社区紧密，观察类工作更需要低调；尼曼路、古城、杭东等区域各有固定人群，线索往往来自社群与社交媒体。",
          "清迈距曼谷约一小时航程，我们根据任务安排当地人员或从曼谷派员，报价时列明差旅。",
        ],
      },
    ],
    faq: [
      { q: "可以核实子女在清迈学校的真实情况吗？", a: "可以在合法范围内核实学校是否存在、是否正常运作，以及您授权范围内的日常情况。涉及未成年人的委托我们会先确认您的监护身份。" },
    ],
    related: ["relationship-investigation", "find-person-thailand", "background-check", "contact"],
    primaryCta: "wechat",
  },
  {
    slug: "chonburi",
    kind: "location",
    service: "on_site",
    title: "春武里调查与核实服务",
    description: "春武里/东部经济走廊（EEC）工厂、供应商与公司实地核实，覆盖是拉差、安美德、品通、林查班等工业区。",
    h1: "春武里调查与核实服务",
    eyebrow: "Location · 春武里",
    intro: "春武里是泰国东部经济走廊的核心，中国制造企业、供应商与物流公司集中于此。我们在春武里主要处理企业客户的工厂、供应商与合作方实地核实。",
    sections: [
      {
        heading: "春武里常见委托（企业客户）",
        body: [],
        bullets: [
          "供应商工厂是否真实存在、是否在产、规模是否与自述一致（安美德、品通、WHA 等工业区）",
          "林查班港周边物流与仓储公司的经营核实",
          "合资伙伴或代理商在春武里的办公地址与人员核实",
          "设厂前的地块与园区周边实地考察代办",
          "是拉差日韩中企业聚集区的管理人员背景核实",
        ],
      },
      {
        heading: "本地实际情况",
        body: [
          "工业区普遍有门禁与保安，实地核实在园区公共道路与对方允许的区域进行；需要进入厂区时，我们会与您确认授权方式（例如以您公司代表身份预约参观）。",
          "多工厂批量核实是春武里项目的常态，我们按地点数量与距离统一报价，通常一周内完成。",
        ],
      },
    ],
    faq: [
      { q: "可以代替我们去参观工厂并出报告吗？", a: "可以。您以公司名义预约，我们的人员作为您的代表到场，按您的检查清单记录并拍照，当天或次日交付报告。" },
    ],
    related: ["on-site-verification", "business-due-diligence", "pattaya", "contact"],
    primaryCta: "intake",
  },
  {
    slug: "samui",
    kind: "location",
    service: "general",
    title: "苏梅岛调查与核实服务",
    description: "苏梅岛感情调查、寻人与度假物业核实。覆盖查汶、拉迈、波普、湄南及周边岛屿往返安排。",
    h1: "苏梅岛调查与核实服务",
    eyebrow: "Location · 苏梅岛",
    intro: "苏梅岛是中国客户度假与置业的热门目的地，也是伴侣“长期度假”与度假物业投资核实的常见地点。我们按任务从曼谷或素叻他尼派员。",
    sections: [
      {
        heading: "苏梅常见委托",
        body: [],
        bullets: [
          "伴侣在苏梅长期停留或经营度假生意的事实核实",
          "别墅、度假村项目是否存在、是否按承诺运营",
          "自称在苏梅经营酒店、潜店、婚礼策划的人员核实",
          "在苏梅或帕岸岛失联的家庭成员下落核实",
        ],
      },
      {
        heading: "本地实际情况",
        body: [
          "苏梅岛需乘飞机或轮渡抵达，任务通常需要至少两天并包含差旅；我们建议合并多个核实事项一次完成。",
          "岛上社区小、外籍人群固定，观察类工作必须格外低调；物业核实则相对直接，重点是实际状态与销售宣传的差异。",
        ],
      },
    ],
    faq: [
      { q: "苏梅岛的委托费用会比曼谷高吗？", a: "会包含交通与住宿，报价时一并列明；合并事项一次完成可以降低总成本。" },
    ],
    related: ["relationship-investigation", "asset-investigation", "phuket", "contact"],
    primaryCta: "wechat",
  },
];
