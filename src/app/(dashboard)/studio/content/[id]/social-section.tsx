"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Send, Share2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/studio/badges";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import { PLATFORM_LABEL } from "@/lib/studio/publish/captions";
import type { ContentStatus, CreativeAsset, SocialConnections, SocialPlatform, SocialPost } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { formatDateTimeBkk } from "../format";
import { removeSocialPost } from "./publish-actions";
import { nonSelectableReadyAssets, normaliseSocialStatus, publishBlockedReason, selectableAssets, SOCIAL_STATUS_META, sortPostsNewest } from "./social-format";
import { PlatformIcon } from "./social-platform-icon";
import { SocialPublishDialog } from "./social-publish-dialog";

/**
 * Social publishing (phase 2): list of posts sent through Ayrshare for this
 * master + the "โพสต์ไปโซเชียล" entry point. Availability/connections come
 * from the server as booleans + Thai reasons — no key material here.
 */

export interface SocialAvailabilityProps {
  available: boolean;
  reason?: string;
}

export interface SocialSectionProps {
  masterId: string;
  status: ContentStatus | string;
  scheduledAt: string | null;
  assets: CreativeAsset[];
  assetUrls: Record<string, string | null>;
  socialPosts: SocialPost[];
  connections: SocialConnections;
  availability: SocialAvailabilityProps;
  editable: boolean;
}

const SETTINGS_SOCIAL_HREF = "/studio/settings#social";
const LOCK_HINT = "คอนเทนต์ที่เผยแพร่แล้วล็อกการโพสต์ซ้ำ — เก็บถาวรแล้วนำกลับมาเป็นร่างหากต้องการโพสต์ใหม่";

export function SocialSection({ masterId, status, scheduledAt, assets, assetUrls, socialPosts, connections, availability, editable }: SocialSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Bumped on every open so the dialog remounts with fresh state; a router.refresh() while it is open must not reset the user's picks.
  const [session, setSession] = useState(0);
  function openDialog() {
    setSession((s) => s + 1);
    setOpen(true);
  }

  const active = connections.ayrshare.active;
  const gateReason = publishBlockedReason({ available: availability.available, availabilityReason: availability.reason, status, activeCount: active.length });
  const blocked = gateReason ?? (!editable ? LOCK_HINT : null);
  const posts = useMemo(() => sortPostsNewest(socialPosts), [socialPosts]);
  const selectable = useMemo(() => selectableAssets(assets), [assets]);
  const nonSelectable = useMemo(() => nonSelectableReadyAssets(assets), [assets]);

  return (
    <section className="rounded-lg border border-border/70 bg-card" aria-labelledby="social-title">
      <header className="space-y-1.5 border-b border-border/60 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="social-title" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Share2 className="h-3.5 w-3.5" /> โพสต์โซเชียล
          </h2>
          <Button size="sm" onClick={openDialog} disabled={!!blocked} title={blocked ?? "เลือกแพลตฟอร์มและสื่อ แล้วส่งผ่าน Ayrshare"}>
            <Send className="h-4 w-4" /> โพสต์ไปโซเชียล
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ส่งไป <span className="font-medium text-foreground/80">Facebook · Instagram · TikTok · YouTube</span> ผ่าน Ayrshare — โพสต์ทันทีหรือตามเวลาที่ตั้งไว้ · ระบบซิงก์สถานะทุก 30 นาที
        </p>
      </header>

      <div className="space-y-3 p-3">
        {blocked && <GateNotice reason={blocked} showSettingsLink={!availability.available || active.length === 0} />}
        {!blocked && active.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            บัญชีที่เชื่อมไว้: {active.map((p) => PLATFORM_LABEL[p]).join(" · ")} ·{" "}
            <Link href={SETTINGS_SOCIAL_HREF} className="underline-offset-2 hover:underline">
              จัดการใน Settings
            </Link>
          </p>
        )}

        {posts.length === 0 ? (
          <EmptyPosts />
        ) : (
          <ul className="divide-y divide-border/60 rounded-md border border-border/70" aria-label="โพสต์ที่ส่งแล้ว">
            {posts.map((p) => (
              <li key={p.id}>
                <PostRow post={p} onChanged={() => router.refresh()} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <SocialPublishDialog
        key={session}
        open={open}
        onOpenChange={setOpen}
        masterId={masterId}
        scheduledAt={scheduledAt}
        selectable={selectable}
        nonSelectable={nonSelectable}
        assetUrls={assetUrls}
        activePlatforms={active}
        defaultYoutubeVisibility={connections.defaults.youtube_visibility}
        onPublished={() => router.refresh()}
      />
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function GateNotice({ reason, showSettingsLink }: { reason: string; showSettingsLink: boolean }) {
  return (
    <p className="inline-flex w-full items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">
        {reason}
        {showSettingsLink && (
          <>
            {" · "}
            <Link href={SETTINGS_SOCIAL_HREF} className="underline-offset-2 hover:underline">
              ไปที่ Settings → การเชื่อมต่อโซเชียล
            </Link>
          </>
        )}
      </span>
    </p>
  );
}

function EmptyPosts() {
  return (
    <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
      <p className="text-sm text-muted-foreground">ยังไม่มีโพสต์</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground/70">เมื่อคอนเทนต์อนุมัติแล้วกดโพสต์ได้จากที่นี่ — เลือกแพลตฟอร์ม แนบรูป/วิดีโอ และดูแคปชันก่อนส่ง</p>
    </div>
  );
}

function PostRow({ post, onChanged }: { post: SocialPost; onChanged: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useSafeTransition();
  const status = normaliseSocialStatus(post.status);
  const meta = SOCIAL_STATUS_META[status];
  const platform = post.platform as SocialPlatform;
  const label = PLATFORM_LABEL[platform] ?? post.platform;
  const isDeleted = status === "deleted";

  function remove() {
    start(async () => {
      const res = await removeSocialPost({ postId: post.id });
      if (!res.ok) {
        toast.error(res.error);
        setConfirm(false);
        return;
      }
      toast.success("ลบโพสต์แล้ว");
      setConfirm(false);
      onChanged();
    });
  }

  return (
    <article className={cn("flex flex-wrap items-start gap-2 px-3 py-2.5 text-xs", (pending || isDeleted) && "opacity-60")} aria-label={`${label} — ${meta.label}`}>
      <span className="mt-0.5 inline-flex items-center gap-1.5 font-medium">
        <PlatformIcon platform={platform} className="h-3.5 w-3.5" /> {label}
      </span>
      <Pill className={cn("mt-px", meta.className)} dot={meta.dot}>
        {meta.label}
      </Pill>

      <div className="min-w-0 flex-1 space-y-0.5">
        {status === "scheduled" && <p className="text-muted-foreground tabular-nums">จะโพสต์ {formatDateTimeBkk(post.scheduled_at)}</p>}
        {status === "published" && (
          <p className="inline-flex flex-wrap items-center gap-2 text-muted-foreground tabular-nums">
            {post.published_at ? <span>โพสต์เมื่อ {formatDateTimeBkk(post.published_at)}</span> : null}
            {post.post_url ? (
              <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ExternalLink className="h-3 w-3" /> เปิดโพสต์
              </a>
            ) : (
              <span>ยังไม่ได้ลิงก์โพสต์ — รอซิงก์รอบถัดไป</span>
            )}
          </p>
        )}
        {status === "failed" && (
          <p className="text-destructive" role="alert">
            {post.error?.trim() || "ส่งไม่สำเร็จ — ไม่มีรายละเอียดจาก provider"}
          </p>
        )}
        {status === "queued" && <p className="text-muted-foreground">ส่งแล้ว รอ provider ยืนยัน — ซิงก์อัตโนมัติทุก 30 นาที</p>}
        <p className="text-[11px] text-muted-foreground/80 tabular-nums">
          สร้าง {formatDateTimeBkk(post.created_at)}
          {post.caption_chars != null ? ` · แคปชัน ${post.caption_chars.toLocaleString("en-GB")} ตัวอักษร` : ""}
          {post.media_asset_ids.length > 0 ? ` · สื่อ ${post.media_asset_ids.length.toLocaleString("en-GB")} ชิ้น` : ""}
        </p>
      </div>

      {confirm ? (
        <span className="inline-flex items-center gap-1">
          <span className="text-[11px] text-amber-600 dark:text-amber-400">ลบที่ Ayrshare ด้วย — ทุกแพลตฟอร์มที่ส่งพร้อมกันในรอบนี้จะถูกลบ?</span>
          <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px]" onClick={remove} disabled={pending}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "ยืนยัน"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setConfirm(false)} disabled={pending}>
            ยกเลิก
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirm(true)} disabled={isDeleted || pending} aria-label={`ลบโพสต์ ${label}`} title={isDeleted ? "ลบแล้ว" : "ลบโพสต์"}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </article>
  );
}
