import type { ReactNode } from "react";

/**
 * Shared "case-file / dossier" presentation primitives for the public marketing
 * site (FBI × Sherlock Holmes look). Server components — pure presentation, no
 * state. Used by both the Thai and English homepages and the article pages so
 * the two languages stay visually identical.
 */

/** Mono uppercase section label flanked by gold ticks (centered by default). */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.28em] text-primary/85 ${className}`}
    >
      <span className="h-px w-6 bg-primary/45" />
      {children}
      <span className="h-px w-6 bg-primary/45" />
    </span>
  );
}

/** Section header: gold eyebrow + serif display title + optional subline. */
export function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="dp-reveal text-center">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-4 font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {sub ? (
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Small mono "tag" — case numbers, exhibit labels, status chips. */
export function FileTag({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-primary/30 bg-primary/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary/90 ${className}`}
    >
      {children}
    </span>
  );
}

/** Rotated rubber-stamp ("CONFIDENTIAL", "VERIFIED"). */
export function Stamp({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`dp-stamp inline-block px-3 py-1 font-mono text-[11px] font-bold uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/** Targeting/file corner brackets — drop inside a `relative` container. */
export function CornerTicks() {
  const base = "pointer-events-none absolute h-2.5 w-2.5 border-primary/40";
  return (
    <>
      <span className={`${base} left-1.5 top-1.5 border-l border-t`} />
      <span className={`${base} right-1.5 top-1.5 border-r border-t`} />
      <span className={`${base} bottom-1.5 left-1.5 border-b border-l`} />
      <span className={`${base} bottom-1.5 right-1.5 border-b border-r`} />
    </>
  );
}
