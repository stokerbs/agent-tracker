"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `to` once the element scrolls into view. SSR/no-JS and the
 * initial client render show the final value (so crawlers and reduced-motion
 * users see the real number and there's no hydration mismatch); when it first
 * enters the viewport it snaps to 0 and animates up. The band sits below the
 * fold, so the pre-animation final value is never actually seen.
 */
export function CountUp({
  to,
  decimals = 0,
  duration = 1400,
  prefix = "",
  suffix = "",
}: {
  to: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState<number>(() => to);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            io.disconnect();
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
              setVal(to * eased);
              if (p < 1) requestAnimationFrame(tick);
              else setVal(to);
            };
            setVal(0);
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
