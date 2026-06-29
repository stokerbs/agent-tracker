"use client";

import { useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Msg { role: "user" | "assistant"; content: string }

// http(s) URLs → clickable links (Google Maps etc.).
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-500 underline underline-offset-2 break-all">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

const SUGGESTIONS = [
  "สรุปคดีนี้ให้หน่อย",
  "ช่วงไหนเป้าหมายอยู่สถานที่เดิมนานสุด?",
  "มีเหตุการณ์สำคัญอะไรบ้าง?",
];

export function CaseChat({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/cases/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, messages: next.slice(-20) }),
      });
      if (res.status === 429) { toast.error("ถามถี่เกินไป ลองใหม่อีกครั้งภายหลัง"); setLoading(false); return; }
      if (!res.ok) throw new Error(`(${res.status})`);
      const { reply } = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }));
    } catch (e) {
      toast.error(e instanceof Error ? `ผิดพลาด ${e.message}` : "ผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" /> ถาม AI
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-w-lg flex-col p-0 sm:max-h-[80vh]">
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> ถาม AI เกี่ยวกับคดีนี้
          </DialogTitle>
          <DialogDescription className="text-xs">ตอบจากข้อมูลในคดี (ไทม์ไลน์ + เมตา) เท่านั้น</DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">ลองถาม:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-md border border-border/60 px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border/60 bg-muted/40"
                }`}
              >
                {m.role === "assistant" ? linkify(m.content) : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังคิด…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 border-t border-border/60 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถามเกี่ยวกับคดี…"
            className="h-9 flex-1 rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()} className="gap-1">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
