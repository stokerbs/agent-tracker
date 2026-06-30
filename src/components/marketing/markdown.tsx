import type { ComponentProps } from "react";

/** Tailwind-styled element renderers for react-markdown (dossier article look). */
export const mdComponents = {
  h1: (p: ComponentProps<"h2">) => <h2 className="mt-10 font-serif text-2xl font-bold tracking-tight" {...p} />,
  h2: (p: ComponentProps<"h2">) => <h2 className="mt-10 font-serif text-2xl font-bold tracking-tight" {...p} />,
  h3: (p: ComponentProps<"h3">) => <h3 className="mt-7 font-serif text-xl font-semibold" {...p} />,
  h4: (p: ComponentProps<"h4">) => <h4 className="mt-5 font-semibold" {...p} />,
  p:  (p: ComponentProps<"p">) => <p className="mt-4 leading-relaxed text-foreground/90" {...p} />,
  ul: (p: ComponentProps<"ul">) => <ul className="mt-4 list-none space-y-2 pl-0 text-foreground/90 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:text-primary [&>li]:before:content-['▸']" {...p} />,
  ol: (p: ComponentProps<"ol">) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-foreground/90 marker:font-mono marker:text-primary/80" {...p} />,
  a:  (p: ComponentProps<"a">) => <a className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary" {...p} />,
  strong: (p: ComponentProps<"strong">) => <strong className="font-semibold text-foreground" {...p} />,
  blockquote: (p: ComponentProps<"blockquote">) => <blockquote className="mt-5 border-l-2 border-primary/50 bg-card/50 py-2 pl-4 italic text-muted-foreground" {...p} />,
};
