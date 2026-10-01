"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { WeChatIcon } from "@/components/marketing/brand-icons";
import { ZH_COMPANY } from "@/lib/marketing/zh/company";
import { track, currentPage, type WeChatPlacement } from "@/lib/marketing/analytics";

/**
 * Primary Chinese CTA — "微信咨询". Opens a dialog with the WeChat QR + ID and a
 * copy button (WeChat has no web deep link that reliably opens a contact, so
 * scan-or-copy is the conversion path). Every open/copy is tracked with its
 * placement so the funnel report can attribute WeChat contacts to a page.
 */
export function WeChatCta({
  placement,
  service = "general",
  label = "微信咨询",
  variant = "primary",
  className = "",
}: {
  placement: WeChatPlacement;
  service?: string;
  label?: string;
  variant?: "primary" | "secondary" | "compact";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const copied = copy === "copied";

  const base =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 rounded-lg bg-[#07C160] px-5 py-3 font-semibold text-white hover:opacity-90"
      : variant === "secondary"
        ? "inline-flex items-center justify-center gap-2 rounded-lg border border-[#07C160]/60 px-5 py-3 font-medium text-[#07C160] hover:bg-[#07C160]/10"
        : "inline-flex items-center gap-1.5 rounded-md border border-[#07C160]/50 px-2.5 py-1.5 text-xs font-medium text-[#07C160] hover:bg-[#07C160]/10";

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) track({ event: "wechat_cta_click", placement, page: currentPage(), service });
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(ZH_COMPANY.wechatId);
      setCopy("copied");
      track({ event: "wechat_id_copied", page: currentPage() });
      setTimeout(() => setCopy("idle"), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context / permissions); tell the
      // user so they copy the visible ID by hand.
      setCopy("failed");
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger className={`${base} ${className}`}>
        <WeChatIcon className={variant === "compact" ? "h-4 w-4" : "h-5 w-5"} />
        {label}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl theme-detective"
          aria-describedby="wechat-cta-desc"
        >
          <DialogPrimitive.Title className="font-serif text-lg font-bold">微信咨询</DialogPrimitive.Title>
          <DialogPrimitive.Description id="wechat-cta-desc" className="mt-1 text-sm text-muted-foreground">
            扫码添加，或复制微信号搜索添加。首次咨询免费，严格保密。
          </DialogPrimitive.Description>
          {/* eslint-disable-next-line @next/next/no-img-element -- static QR, no optimisation needed */}
          <img
            src={ZH_COMPANY.wechatQr}
            alt={`Detective Pulse 微信二维码（${ZH_COMPANY.wechatId}）`}
            width={220}
            height={220}
            className="mx-auto mt-4 h-[220px] w-[220px] rounded-lg border border-border bg-white"
          />
          <div className="mt-4 flex items-center justify-center gap-2">
            <code className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm">{ZH_COMPANY.wechatId}</code>
            <button
              type="button"
              onClick={copyId}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "已复制" : "复制微信号"}
            </button>
          </div>
          <span role="status" aria-live="polite" className={copy === "failed" ? "mt-2 block text-xs text-destructive" : "sr-only"}>
            {copy === "copied" ? "微信号已复制" : copy === "failed" ? "复制失败，请手动复制上方微信号" : ""}
          </span>
          <p className="mt-4 text-xs text-muted-foreground">
            也可以 <a href={`mailto:${ZH_COMPANY.email}`} className="text-primary underline-offset-2 hover:underline">发送邮件</a> 或{" "}
            <Link href="/zh/contact#intake" className="text-primary underline-offset-2 hover:underline" onClick={() => setOpen(false)}>提交案件资料</Link>
          </p>
          <DialogPrimitive.Close className="mt-5 inline-flex rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted">关闭</DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
