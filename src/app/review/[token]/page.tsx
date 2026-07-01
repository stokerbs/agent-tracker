import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { getArticleByToken } from "@/lib/marketing/articles-db";
import { mdComponents } from "@/components/marketing/markdown";
import { approveArticle, rejectArticle } from "./actions";

// Private approval surface — never index it.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const a = await getArticleByToken(token);

  return (
    <div className="theme-detective min-h-screen bg-background px-4 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-3xl">
        {!a ? (
          <Notice title="ไม่พบบทความ" body="ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" />
        ) : a.status === "published" ? (
          <Notice
            title="อนุมัติแล้ว ✅"
            body="บทความนี้เผยแพร่บนเว็บแล้ว"
            link={{ href: `/articles/${a.th_slug}`, label: "เปิดดูบทความ" }}
          />
        ) : a.status === "rejected" ? (
          <Notice title="ไม่อนุมัติแล้ว" body="บทความนี้ถูกปฏิเสธและจะไม่เผยแพร่" />
        ) : (
          <>
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/80">
                Draft · รออนุมัติ · ร่างโดย AI
              </p>
              <h1 className="mt-2 font-serif text-2xl font-bold leading-snug sm:text-3xl">{a.th_title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{a.th_description}</p>
            </div>

            {/* Approve / reject */}
            <div className="sticky top-0 z-10 -mx-4 mb-6 flex gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
              <form action={approveArticle.bind(null, token)}>
                <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                  <CheckCircle2 className="h-4 w-4" /> อนุมัติ & เผยแพร่
                </button>
              </form>
              <form action={rejectArticle.bind(null, token)}>
                <button className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted">
                  <XCircle className="h-4 w-4" /> ไม่อนุมัติ
                </button>
              </form>
            </div>

            {/* TH preview */}
            <article className="rounded-xl border border-border bg-card/40 p-5 sm:p-7">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {a.th_body}
              </ReactMarkdown>
            </article>

            {/* EN preview */}
            <details className="mt-6 rounded-xl border border-border bg-card/40 p-5 sm:p-7">
              <summary className="cursor-pointer font-serif text-lg font-bold">🇬🇧 English version — {a.en_title}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{a.en_description}</p>
              <div className="mt-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {a.en_body}
                </ReactMarkdown>
              </div>
            </details>

            <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              slug: /articles/{a.th_slug} · /en/articles/{a.en_slug}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Notice({ title, body, link }: { title: string; body: string; link?: { href: string; label: string } }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-border bg-card/50 p-8 text-center">
      <h1 className="font-serif text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {link && (
        <a
          href={link.href}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" /> {link.label}
        </a>
      )}
    </div>
  );
}
