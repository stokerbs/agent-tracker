import type { ComponentProps } from "react";

/** Tailwind-styled element renderers for react-markdown (no typography plugin). */
export const mdComponents = {
  h1: (p: ComponentProps<"h2">) => <h2 className="mt-8 text-xl font-bold" {...p} />,
  h2: (p: ComponentProps<"h2">) => <h2 className="mt-8 text-xl font-bold" {...p} />,
  h3: (p: ComponentProps<"h3">) => <h3 className="mt-6 text-lg font-semibold" {...p} />,
  h4: (p: ComponentProps<"h4">) => <h4 className="mt-4 font-semibold" {...p} />,
  p:  (p: ComponentProps<"p">) => <p className="mt-4 leading-relaxed text-foreground/90" {...p} />,
  ul: (p: ComponentProps<"ul">) => <ul className="mt-4 list-disc space-y-1.5 pl-6 text-foreground/90" {...p} />,
  ol: (p: ComponentProps<"ol">) => <ol className="mt-4 list-decimal space-y-1.5 pl-6 text-foreground/90" {...p} />,
  a:  (p: ComponentProps<"a">) => <a className="text-primary underline underline-offset-2 hover:opacity-80" {...p} />,
  strong: (p: ComponentProps<"strong">) => <strong className="font-semibold" {...p} />,
};
