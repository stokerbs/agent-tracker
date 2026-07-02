"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Loader2, Phone } from "lucide-react";
import { LineIcon } from "@/components/marketing/brand-icons";

type Msg = { role: "user" | "assistant"; content: string };
type Lang = "th" | "en" | "zh";

const LINE_URL = "https://lin.ee/SSqk98x";
const TEL_URL = "tel:+66968461406";

const COPY: Record<Lang, {
  header: string; greeting: string; suggestions: string[]; placeholder: string;
  inputAria: string; sendAria: string; closeAria: string; launcherAria: string;
  human: string; call: string; note: string; rate: string; err: string; conn: string;
}> = {
  th: {
    header: "เจ้าหน้าที่รับเคส (AI)",
    greeting: "สวัสดีครับ 🕵️ เจ้าหน้าที่รับเคส Detective Pulse ครับ แจ้งประเภทงานที่ต้องการได้เลย เดี๋ยวผมช่วยเก็บรายละเอียดเบื้องต้นให้ ข้อมูลทุกอย่างเป็นความลับครับ",
    suggestions: ["อยากสืบชู้สาว", "อยากตามหาคน", "ค่าบริการเท่าไหร่"],
    placeholder: "พิมพ์คำถาม...",
    inputAria: "พิมพ์คำถามถึงผู้ช่วย AI", sendAria: "ส่ง", closeAria: "ปิด", launcherAria: "เจ้าหน้าที่รับเคส (AI)",
    human: "คุยกับคนจริง", call: "โทร", note: "AI · ข้อมูลเป็นความลับ",
    rate: "คุยกันเยอะเลยครับ 🙏 รบกวนพักสักครู่ หรือทักไลน์ @detectivepluse เพื่อคุยกับทีมงานจริงได้เลยครับ",
    err: "ขออภัยครับ ลองใหม่อีกครั้ง หรือทักไลน์เราได้เลย",
    conn: "การเชื่อมต่อมีปัญหา ลองใหม่อีกครั้ง หรือทักไลน์ @detectivepluse ได้เลยครับ",
  },
  en: {
    header: "Case Intake Assistant (AI)",
    greeting: "Hi 🕵️ I'm the Detective Pulse intake assistant. Tell me what you need investigated and I'll gather the details — everything is kept strictly confidential.",
    suggestions: ["Cheating spouse", "Find a person", "How much does it cost?"],
    placeholder: "Type your question...",
    inputAria: "Type a question to the AI assistant", sendAria: "Send", closeAria: "Close", launcherAria: "AI intake assistant",
    human: "Talk to a human", call: "Call", note: "AI · Confidential",
    rate: "That's a lot of questions 🙏 Please wait a moment, or message us on LINE @detectivepluse to talk to the team.",
    err: "Sorry, please try again, or message us on LINE.",
    conn: "Connection problem — please try again, or message us on LINE @detectivepluse.",
  },
  zh: {
    header: "接案助理 (AI)",
    greeting: "您好 🕵️ 我是 Detective Pulse 的接案助理。请告诉我您需要调查的类型，我会帮您先收集基本信息 —— 所有信息严格保密。",
    suggestions: ["婚外情调查", "寻人", "费用是多少？"],
    placeholder: "输入您的问题...",
    inputAria: "向 AI 助理提问", sendAria: "发送", closeAria: "关闭", launcherAria: "AI 接案助理",
    human: "联系真人", call: "致电", note: "AI · 严格保密",
    rate: "聊得有点多啦 🙏 请稍候，或在 LINE @detectivepluse 上联系我们的团队。",
    err: "抱歉，请重试，或在 LINE 上联系我们。",
    conn: "连接出现问题，请重试，或在 LINE @detectivepluse 上联系我们。",
  },
};

function detectLang(pathname: string): Lang {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh";
  return "th";
}

/**
 * Floating AI assistant for the marketing site. UI + prompt locale follow the
 * page language (TH / EN / ZH). Answers via /api/marketing/assistant (Claude);
 * the raw chat isn't stored. Sits bottom-left (contact FAB is bottom-right).
 */
export function AssistantWidget() {
  const lang = detectLang(usePathname() || "/");
  const t = COPY[lang];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: t.greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading || rateLimited) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const firstUser = next.findIndex((m) => m.role === "user");
      const apiMessages = next.slice(firstUser).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/marketing/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, locale: lang }),
      });
      if (res.status === 429) {
        setRateLimited(true);
        setMessages((m) => [...m, { role: "assistant", content: t.rate }]);
        return;
      }
      const data = (await res.json()) as { reply?: string };
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? t.err }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t.conn }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 left-5 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {open && (
        <div className="absolute bottom-[4.25rem] left-0 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/60 bg-primary px-4 py-3 text-primary-foreground">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4" /> {t.header}
            </span>
            <button onClick={() => setOpen(false)} aria-label={t.closeAria}><X className="h-4 w-4" /></button>
          </div>

          <div ref={scrollRef} className="flex max-h-[22rem] min-h-[12rem] flex-col gap-2.5 overflow-y-auto p-3.5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                    : "mr-auto max-w-[88%] whitespace-pre-line rounded-2xl rounded-bl-sm border border-border bg-background/60 px-3.5 py-2 text-sm leading-relaxed"
                }
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-background/60 px-3.5 py-2.5">
                <span className="dp-blink h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="dp-blink h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: ".2s" }} />
                <span className="dp-blink h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: ".4s" }} />
              </div>
            )}

            {messages.length === 1 && !loading && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {t.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-border/60 p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              placeholder={t.placeholder}
              aria-label={t.inputAria}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label={t.sendAria}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>

          <div className="flex items-center gap-2 border-t border-border/60 bg-background/40 px-2.5 py-2">
            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-[#048739] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90">
              <LineIcon className="h-3.5 w-3.5" /> {t.human}
            </a>
            <a href={TEL_URL} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">
              <Phone className="h-3.5 w-3.5 text-primary" /> {t.call}
            </a>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t.note}</span>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t.launcherAria}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-card text-primary shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
      </button>
    </div>
  );
}
