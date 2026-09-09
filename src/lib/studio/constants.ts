// ============================================================================
// Creative Studio — display metadata for enums (Thai-first labels + badge
// classes). Import from here; never hardcode labels in components.
// ============================================================================

import type {
  ContentFormat,
  ContentStatus,
  IdeaOrigin,
  IdeaStatus,
  KnowledgeCategory,
  Pillar,
  Platform,
  PrivacyStatus,
  Sensitivity,
  SourceKind,
  SupportStatus,
} from "./types";

export interface Meta {
  label: string;
  labelEn: string;
  badge: string;
  dot?: string;
  hint?: string;
}

export const PILLAR_META: Record<Pillar, Meta & { description: string }> = {
  detective_knowledge: {
    label: "ความรู้นักสืบ",
    labelEn: "Detective Knowledge",
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    dot: "bg-sky-500",
    description: "ความรู้เชิงการสืบสวน: การเฝ้าติดตาม สิ่งที่นักสืบมองหา ข้อจำกัดของ GPS หลักฐานที่มีน้ำหนัก",
  },
  case_story: {
    label: "เรื่องจากเคส",
    labelEn: "Case Story",
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
    dot: "bg-violet-500",
    description: "บทเรียนจากเคสจริงแบบไม่ระบุตัวตน: สถานการณ์ → ปัญหา → วิธีสืบ → จุดพลิก → บทเรียน",
  },
  detective_pov: {
    label: "มุมมองนักสืบ",
    labelEn: "Detective POV",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
    description: "มุมมองมืออาชีพ: นักสืบสังเกตอะไร ทำไมตัดสินใจแบบนั้น ความเข้าใจผิดเรื่องการเฝ้าติดตาม",
  },
  red_flags: {
    label: "สัญญาณเตือน",
    labelEn: "Red Flags / Education",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
    description: "ความรู้สาธารณะที่มีประโยชน์: พฤติกรรมน่าสงสัย การป้องกันการหลอกลวง การเก็บหลักฐาน",
  },
  behind_investigation: {
    label: "เบื้องหลังงานสืบ",
    labelEn: "Behind the Investigation",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
    dot: "bg-slate-500",
    description: "เครื่องมือ การวางแผน โลจิสติกส์ และขั้นตอนทำงาน เท่าที่เผยแพร่ได้อย่างปลอดภัย",
  },
  service: {
    label: "บริการ",
    labelEn: "Service / Conversion",
    badge: "bg-primary/15 text-primary border-primary/30",
    dot: "bg-primary",
    description: "อธิบายบริการอย่างเป็นธรรมชาติ ให้ความรู้ก่อน แปลงเป็นลูกค้าทีหลัง",
  },
};
export const PILLARS = Object.keys(PILLAR_META) as Pillar[];

export const PLATFORM_META: Record<Platform, Meta & { short: string; maxCaption?: number }> = {
  tiktok: { label: "TikTok", labelEn: "TikTok", short: "TT", badge: "bg-foreground/10 text-foreground border-foreground/20", maxCaption: 2200 },
  instagram_reel: { label: "IG Reels", labelEn: "Instagram Reels", short: "Reel", badge: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30", maxCaption: 2200 },
  instagram_post: { label: "IG โพสต์", labelEn: "Instagram Post", short: "IG", badge: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30", maxCaption: 2200 },
  instagram_carousel: { label: "IG Carousel", labelEn: "Instagram Carousel", short: "Carousel", badge: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30", maxCaption: 2200 },
  facebook: { label: "Facebook", labelEn: "Facebook", short: "FB", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", maxCaption: 63206 },
  youtube_short: { label: "YouTube Shorts", labelEn: "YouTube Shorts", short: "YT", badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", maxCaption: 5000 },
  article: { label: "บทความ", labelEn: "Article", short: "Article", badge: "bg-muted text-muted-foreground border-border" },
  line_oa: { label: "LINE OA", labelEn: "LINE OA", short: "LINE", badge: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30", maxCaption: 5000 },
};
export const PLATFORMS = Object.keys(PLATFORM_META) as Platform[];
/** Platforms that carry a spoken short-form script. */
export const VIDEO_PLATFORMS: Platform[] = ["tiktok", "instagram_reel", "youtube_short"];

export const FORMAT_META: Record<ContentFormat, Meta> = {
  short_video: { label: "วิดีโอสั้น", labelEn: "Short video", badge: "bg-muted text-foreground border-border" },
  carousel: { label: "Carousel", labelEn: "Carousel", badge: "bg-muted text-foreground border-border" },
  post: { label: "โพสต์", labelEn: "Post", badge: "bg-muted text-foreground border-border" },
  article: { label: "บทความ", labelEn: "Article", badge: "bg-muted text-foreground border-border" },
  story: { label: "สตอรี่", labelEn: "Story", badge: "bg-muted text-foreground border-border" },
  caption_short: { label: "แคปชันสั้น", labelEn: "Short caption", badge: "bg-muted text-foreground border-border" },
  caption_long: { label: "แคปชันยาว", labelEn: "Long caption", badge: "bg-muted text-foreground border-border" },
  outline: { label: "โครงบทความ", labelEn: "Outline", badge: "bg-muted text-foreground border-border" },
};

export const CONTENT_STATUS_META: Record<ContentStatus, Meta> = {
  idea: { label: "ไอเดีย", labelEn: "Idea", badge: "bg-muted text-muted-foreground border-border", dot: "bg-slate-400" },
  draft: { label: "ร่าง", labelEn: "Draft", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30", dot: "bg-sky-500" },
  review: { label: "รอตรวจ", labelEn: "Review", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  approved: { label: "อนุมัติแล้ว", labelEn: "Approved", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  scheduled: { label: "ตั้งเวลาแล้ว", labelEn: "Scheduled", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30", dot: "bg-violet-500" },
  published: { label: "เผยแพร่แล้ว", labelEn: "Published", badge: "bg-primary/10 text-primary border-primary/30", dot: "bg-primary" },
  archived: { label: "เก็บถาวร", labelEn: "Archived", badge: "bg-muted text-muted-foreground border-border", dot: "bg-slate-500" },
  rejected: { label: "ไม่ผ่าน", labelEn: "Rejected", badge: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" },
};
export const CONTENT_STATUSES = Object.keys(CONTENT_STATUS_META) as ContentStatus[];
/** Statuses shown in the pipeline board, in workflow order. */
export const PIPELINE_STATUSES: ContentStatus[] = ["draft", "review", "approved", "scheduled", "published"];

export const IDEA_STATUS_META: Record<IdeaStatus, Meta> = {
  new: { label: "ใหม่", labelEn: "New", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  saved: { label: "บันทึกไว้", labelEn: "Saved", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  generated: { label: "สร้างคอนเทนต์แล้ว", labelEn: "Generated", badge: "bg-primary/10 text-primary border-primary/30" },
  rejected: { label: "ปัดตก", labelEn: "Rejected", badge: "bg-muted text-muted-foreground border-border" },
  archived: { label: "เก็บถาวร", labelEn: "Archived", badge: "bg-muted text-muted-foreground border-border" },
};

export const IDEA_ORIGIN_META: Record<IdeaOrigin, Meta> = {
  ai: { label: "AI แนะนำ", labelEn: "AI", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  owner: { label: "เจ้าของสร้าง", labelEn: "Owner", badge: "bg-muted text-foreground border-border" },
  knowledge: { label: "จากคลังความรู้", labelEn: "Knowledge", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  case: { label: "จากเคส", labelEn: "Case", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  question: { label: "คำถามลูกค้า", labelEn: "Customer question", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  repurpose: { label: "นำกลับมาใช้", labelEn: "Repurpose", badge: "bg-muted text-foreground border-border" },
  trend: { label: "เทรนด์", labelEn: "Trend", badge: "bg-muted text-foreground border-border" },
};

export const SENSITIVITY_META: Record<Sensitivity, Meta> = {
  public: { label: "สาธารณะ", labelEn: "Public", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  internal: { label: "ภายใน", labelEn: "Internal", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  confidential: { label: "ลับ", labelEn: "Confidential", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  restricted: { label: "ลับมาก", labelEn: "Restricted", badge: "bg-destructive/10 text-destructive border-destructive/30" },
};

export const PRIVACY_STATUS_META: Record<PrivacyStatus, Meta> = {
  safe: { label: "ปลอดภัย", labelEn: "Safe", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  review_required: { label: "ต้องตรวจสอบ", labelEn: "Review required", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  blocked: { label: "บล็อก", labelEn: "Blocked", badge: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" },
};

export const SUPPORT_STATUS_META: Record<SupportStatus, Meta> = {
  supported: { label: "มีแหล่งอ้างอิง", labelEn: "Supported", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  partially_supported: { label: "อ้างอิงบางส่วน", labelEn: "Partially supported", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  ai_suggestion: { label: "AI แนะนำ", labelEn: "AI suggestion", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  needs_review: { label: "ต้องตรวจ", labelEn: "Needs review", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  unsupported: { label: "ไม่มีแหล่งอ้างอิง", labelEn: "Unsupported", badge: "bg-destructive/10 text-destructive border-destructive/30" },
};

export const SOURCE_KIND_META: Record<SourceKind, Meta & { warn?: boolean }> = {
  knowledge: { label: "คลังความรู้ Detective Pulse", labelEn: "Knowledge Base", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  case_insight: { label: "บทเรียนจากเคส (ไม่ระบุตัวตน)", labelEn: "Case insight", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  customer_question: { label: "คำถามลูกค้า", labelEn: "Customer FAQ", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  external: { label: "แหล่งภายนอกที่อนุมัติ", labelEn: "External source", badge: "bg-muted text-foreground border-border" },
  ai_general: { label: "ความรู้ทั่วไปของ AI", labelEn: "General AI knowledge", badge: "bg-destructive/10 text-destructive border-destructive/30", warn: true },
};

export const KNOWLEDGE_CATEGORY_META: Record<KnowledgeCategory, Meta> = {
  cases: { label: "เคส", labelEn: "Cases", badge: "" },
  customer_questions: { label: "คำถามลูกค้า", labelEn: "Customer Questions", badge: "" },
  investigator_knowledge: { label: "ความรู้นักสืบ", labelEn: "Investigator Knowledge", badge: "" },
  owner_experience: { label: "ประสบการณ์เจ้าของ", labelEn: "Owner Experience", badge: "" },
  services: { label: "บริการ", labelEn: "Services", badge: "" },
  articles: { label: "บทความ", labelEn: "Articles", badge: "" },
  technology: { label: "เทคโนโลยี", labelEn: "Technology", badge: "" },
  osint: { label: "OSINT", labelEn: "OSINT", badge: "" },
  surveillance: { label: "การเฝ้าติดตาม", labelEn: "Surveillance", badge: "" },
  gps: { label: "GPS", labelEn: "GPS", badge: "" },
  other: { label: "อื่น ๆ", labelEn: "Other", badge: "" },
};
export const KNOWLEDGE_CATEGORIES = Object.keys(KNOWLEDGE_CATEGORY_META) as KnowledgeCategory[];

export const STUDIO_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

/** Models the owner may pick in Studio Settings (Anthropic provider). */
export const STUDIO_MODELS: { id: string; label: string; hint: string }[] = [
  { id: "claude-opus-5", label: "Claude Opus 5", hint: "คุณภาพสูงสุด — แนะนำสำหรับสคริปต์และแคมเปญ" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "สมดุลคุณภาพ/ต้นทุน" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "เร็วและประหยัด — เหมาะกับ rewrite สั้น ๆ" },
];
export const DEFAULT_STUDIO_MODEL = "claude-opus-5";
