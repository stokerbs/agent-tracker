import { useCallback, useEffect, useState } from "react";

/**
 * CSS-overlay full-screen state for the map surfaces — NOT the browser
 * Fullscreen API, so there is no "swipe down to exit" banner or swipe gesture
 * (exit is via the in-app toggle button only). While active, page scroll behind
 * the overlay is locked. Shared by the live map and the GPS monitor (TD-1).
 */
export function useMapFullscreen(): { isFullscreen: boolean; toggle: () => void } {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggle = useCallback(() => setIsFullscreen((v) => !v), []);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  return { isFullscreen, toggle };
}
