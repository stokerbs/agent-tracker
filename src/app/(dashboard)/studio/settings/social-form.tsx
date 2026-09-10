"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import { PLATFORM_LABEL } from "@/lib/studio/publish/captions";
import type { SocialConnections, SocialPlatform, TiktokPrivacy, YoutubeVisibility } from "@/lib/studio/types";
import { TIKTOK_PRIVACIES, TIKTOK_PRIVACY_LABEL, YOUTUBE_VISIBILITIES, YOUTUBE_VISIBILITY_LABEL } from "../content/[id]/social-format";
import { refreshSocialConnections, updateSocialDefaults } from "./actions";

/**
 * Social publishing settings: re-check which accounts are linked in Ayrshare
 * and store per-platform posting defaults. Account linking itself happens in
 * the Ayrshare dashboard — we never hold platform tokens, and the API key is
 * ENV-only (status tile above this form).
 */

export interface SocialFormProps {
  initial: SocialConnections["defaults"];
  /** false when AYRSHARE_API_KEY is missing — refresh is disabled with a reason. */
  configured: boolean;
}

const AYRSHARE_DASHBOARD = "https://app.ayrshare.com";
const NOT_CONFIGURED_HINT = "ตั้ง AYRSHARE_API_KEY ก่อน จึงจะตรวจการเชื่อมต่อได้";

export function SocialForm({ initial, configured }: SocialFormProps) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<SocialConnections["defaults"]>(initial);
  const [savePending, startSave] = useSafeTransition();
  const [refreshPending, startRefresh] = useSafeTransition();
  const dirty = defaults.youtube_visibility !== initial.youtube_visibility || defaults.tiktok_privacy !== initial.tiktok_privacy;

  function refresh() {
    startRefresh(async () => {
      const res = await refreshSocialConnections();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const names = res.data.active.map((p) => PLATFORM_LABEL[p as SocialPlatform] ?? p);
      if (names.length === 0) toast.warning("ไม่พบบัญชีที่เชื่อมต่อ — ลิงก์บัญชีใน Ayrshare dashboard แล้วรีเฟรชอีกครั้ง");
      else toast.success(`เชื่อมต่อแล้ว ${names.length.toLocaleString("en-GB")} บัญชี: ${names.join(", ")}`);
      router.refresh();
    });
  }

  function save() {
    startSave(async () => {
      const res = await updateSocialDefaults(defaults);
      if (res.ok) toast.success("บันทึกค่าเริ่มต้นการโพสต์แล้ว");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={refresh} disabled={!configured || refreshPending} title={configured ? "ถาม Ayrshare ว่าบัญชีใดเชื่อมอยู่" : NOT_CONFIGURED_HINT}>
          {refreshPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} รีเฟรชการเชื่อมต่อ
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={AYRSHARE_DASHBOARD} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> เปิด Ayrshare dashboard
          </a>
        </Button>
        {!configured && <span className="text-xs text-amber-600 dark:text-amber-400">{NOT_CONFIGURED_HINT}</span>}
      </div>
      <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">ระบบไม่เก็บ token ของแพลตฟอร์ม — การเชื่อมบัญชีทำใน Ayrshare (Social Accounts → Link) แล้วกด “รีเฟรชการเชื่อมต่อ” ที่นี่</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="social-yt-visibility">การมองเห็นเริ่มต้นบน YouTube</Label>
          <Select value={defaults.youtube_visibility} onValueChange={(v) => setDefaults((d) => ({ ...d, youtube_visibility: v as YoutubeVisibility }))} disabled={savePending}>
            <SelectTrigger id="social-yt-visibility" className="h-9" aria-label="การมองเห็นเริ่มต้นบน YouTube">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YOUTUBE_VISIBILITIES.map((v) => (
                <SelectItem key={v} value={v}>
                  {YOUTUBE_VISIBILITY_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">ค่าที่เลือกไว้ล่วงหน้าในกล่อง “โพสต์ไปโซเชียล” — เปลี่ยนต่อโพสต์ได้</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="social-tiktok-privacy">ความเป็นส่วนตัวเริ่มต้นบน TikTok</Label>
          <Select value={defaults.tiktok_privacy} onValueChange={(v) => setDefaults((d) => ({ ...d, tiktok_privacy: v as TiktokPrivacy }))} disabled={savePending}>
            <SelectTrigger id="social-tiktok-privacy" className="h-9" aria-label="ความเป็นส่วนตัวเริ่มต้นบน TikTok">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIKTOK_PRIVACIES.map((v) => (
                <SelectItem key={v} value={v}>
                  {TIKTOK_PRIVACY_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">ใช้กับทุกโพสต์ TikTok ที่ส่งผ่านระบบ (TikTok ต้องมีวิดีโอ — มาในเฟส 3)</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="text-xs text-muted-foreground">มีการแก้ไขที่ยังไม่บันทึก</span>}
        <Button onClick={save} disabled={savePending || !dirty} size="sm">
          {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
