import Image from "next/image";
import { FileTag, CornerTicks } from "@/components/marketing/ui";
import { classifyArticle, getArticleCover } from "@/lib/marketing/article-category";

/**
 * Article cover — stock photo per topic category with dossier overlay.
 * Optional per-page override via coverImage / coverAlt (frontmatter).
 */
export function ArticleCover({
  slug,
  title = "",
  index = 0,
  lang = "th",
  className = "",
  coverImage,
  coverAlt,
}: {
  slug: string;
  title?: string;
  index?: number;
  lang?: "th" | "en";
  className?: string;
  coverImage?: string;
  coverAlt?: string;
}) {
  const { category, src, alt } = getArticleCover(slug, title, lang, { coverImage, coverAlt });
  const c = classifyArticle(`${slug} ${title}`);
  const label = lang === "en" ? c.en : c.th;
  const Icon = category.Icon;

  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-[#0a0e16] ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
        className="object-cover"
        priority={index <= 1}
      />
      {/* Dossier overlay — keeps FBI × Sherlock theme on top of stock photos */}
      <div className="dp-grid absolute inset-0 opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e16]/90 via-[#0a0e16]/35 to-[#0a0e16]/20" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-primary/20 blur-2xl" />
      <Icon aria-hidden className="pointer-events-none absolute -bottom-8 -right-5 h-48 w-48 text-primary/[0.08]" strokeWidth={1.25} />
      <CornerTicks />
      <div className="absolute left-3 top-3">
        <FileTag>{`CASE ${String(index + 1).padStart(2, "0")}`}</FileTag>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary/90 drop-shadow-sm">
          {label}
        </span>
      </div>
    </div>
  );
}
