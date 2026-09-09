import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { CONTENT_STATUSES, PILLARS, PLATFORMS } from "@/lib/studio/constants";
import type { ContentStatus, Pillar, Platform } from "@/lib/studio/types";
import { ContentBoard, CreateContentButton } from "./board";
import { countContentByStatus, listContentMasters, type ContentListFilters } from "./queries";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : null;
}

export default async function ContentListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;

  const view = first(sp.view) === "table" ? "table" : "board";
  const pillar = first(sp.pillar);
  const platform = first(sp.platform);
  const status = first(sp.status);
  const filters: ContentListFilters = {
    pillar: pillar && (PILLARS as string[]).includes(pillar) ? (pillar as Pillar) : null,
    platform: platform && (PLATFORMS as string[]).includes(platform) ? (platform as Platform) : null,
    status: status && (CONTENT_STATUSES as string[]).includes(status) ? (status as ContentStatus) : null,
    q: first(sp.q),
  };

  const [rows, counts] = await Promise.all([listContentMasters(filters), countContentByStatus()]);

  return (
    <div className="space-y-5">
      <PageHeader title="คอนเทนต์" description="ร่าง → รอตรวจ → อนุมัติ → ตั้งเวลา → เผยแพร่ — ทุกชิ้นผ่าน Privacy Check ก่อนอนุมัติ">
        <CreateContentButton />
      </PageHeader>
      <ContentBoard rows={rows} counts={counts} view={view} filters={filters} />
    </div>
  );
}
