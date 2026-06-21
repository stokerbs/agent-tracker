"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxImage {
  url: string;
  alt?: string;
}

interface Props {
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
}

function pinchDist(t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

export function ImageLightbox({ images, initialIndex = 0, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0); // translate X in scaled space
  const [ty, setTy] = useState(0); // translate Y in scaled space
  const [dragY, setDragY] = useState(0); // dismiss drag
  const [isAnimating, setIsAnimating] = useState(false);

  // Touch tracking (refs avoid re-renders mid-gesture)
  const startX = useRef(0);
  const startY = useRef(0);
  const startTx = useRef(0);
  const startTy = useRef(0);
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const lastTapMs = useRef(0);
  const lastTapX = useRef(0);
  const lastTapY = useRef(0);
  const gesture = useRef<"h" | "v" | "pan" | "pinch" | null>(null);

  useEffect(() => setMounted(true), []);

  const count = images.length;
  const current = images[index];

  function resetZoom() {
    setScale(1);
    setTx(0);
    setTy(0);
  }

  function goTo(i: number) {
    setIndex(i);
    resetZoom();
    setDragY(0);
  }

  function goPrev() { if (index > 0) goTo(index - 1); }
  function goNext() { if (index < count - 1) goTo(index + 1); }

  // Lock body scroll + keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, scale]);

  function onTouchStart(e: React.TouchEvent) {
    setIsAnimating(false);
    if (e.touches.length === 2) {
      gesture.current = "pinch";
      pinchStartDist.current = pinchDist(e.touches[0], e.touches[1]);
      pinchStartScale.current = scale;
    } else if (e.touches.length === 1) {
      gesture.current = null;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startTx.current = tx;
      startTy.current = ty;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (gesture.current === "pinch" && e.touches.length === 2) {
      const d = pinchDist(e.touches[0], e.touches[1]);
      const newScale = Math.max(1, Math.min(5, pinchStartScale.current * (d / pinchStartDist.current)));
      setScale(newScale);
      if (newScale <= 1) { setTx(0); setTy(0); }
      return;
    }
    if (e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Classify gesture on first motion
    if (!gesture.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      if (scale > 1.05) {
        gesture.current = "pan";
      } else if (Math.abs(dy) > Math.abs(dx) * 1.2) {
        gesture.current = "v";
      } else {
        gesture.current = "h";
      }
    }

    if (gesture.current === "pan") {
      setTx(startTx.current + dx / scale);
      setTy(startTy.current + dy / scale);
    } else if (gesture.current === "v" && scale <= 1.05) {
      // Only allow downward drag for dismiss
      setDragY(Math.max(0, dy));
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    setIsAnimating(true);

    if (gesture.current === "pinch") {
      if (scale < 1.1) { setScale(1); setTx(0); setTy(0); }
      gesture.current = null;
      return;
    }

    const t = e.changedTouches[0];
    const dx = startX.current - t.clientX;
    const dy = t.clientY - startY.current;

    if (gesture.current === "v") {
      setDragY(0);
      if (dy > 100) { onClose(); return; }
    } else if (gesture.current === "h" && scale <= 1.05) {
      if (dx > 60) goNext();
      else if (dx < -60) goPrev();
    } else if (!gesture.current) {
      // Tap — check for double-tap
      const now = Date.now();
      if (
        now - lastTapMs.current < 300 &&
        Math.abs(t.clientX - lastTapX.current) < 30 &&
        Math.abs(t.clientY - lastTapY.current) < 30
      ) {
        if (scale > 1) {
          setScale(1); setTx(0); setTy(0);
        } else {
          setScale(2.5);
        }
        lastTapMs.current = 0; // prevent triple-tap triggering again
      } else {
        lastTapMs.current = now;
        lastTapX.current = t.clientX;
        lastTapY.current = t.clientY;
      }
    }

    gesture.current = null;
  }

  if (!mounted || !current) return null;

  const dismissOpacity = Math.max(0.2, 1 - dragY / 300);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{ opacity: dismissOpacity, transition: isAnimating ? "opacity 0.2s" : "none" }}
      >
        {count > 1 ? (
          <span className="font-mono text-xs text-white/50">{index + 1} / {count}</span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image area — touch-none lets us handle all gestures in JS */}
      <div
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClose}
        style={{
          opacity: dismissOpacity,
          transform: `translateY(${dragY * 0.4}px)`,
          transition: isAnimating ? "transform 0.25s ease, opacity 0.25s ease" : "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={index}
          src={current.url}
          alt={current.alt ?? ""}
          className="max-h-full max-w-full select-none object-contain"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            transition: isAnimating && gesture.current === null ? "transform 0.25s ease" : "none",
          }}
        />

        {/* Desktop prev/next (hidden when zoomed) */}
        {scale <= 1.05 && index > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 md:flex"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {scale <= 1.05 && index < count - 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 md:flex"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Thumbnail strip — only when multiple images */}
      {count > 1 && (
        <div
          className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-4 py-3"
          style={{
            opacity: dismissOpacity,
            transition: isAnimating ? "opacity 0.2s" : "none",
            scrollbarWidth: "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded"
              style={{
                outline: i === index ? "2px solid white" : "2px solid transparent",
                opacity: i === index ? 1 : 0.4,
                transition: "opacity 0.15s, outline-color 0.15s",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
