"use client";

import { SlideRenderer } from "@/components/slides/slide-renderer";
import { useCallback, useEffect, useState } from "react";

interface Slide { slide_id: string; title: string; content_json: any; layout: string | null; design_json: any }
interface Props { slides: Slide[]; initialIndex: number; onClose: () => void; language?: string; primary?: string; accent?: string }

export function FullscreenPreview({ slides, initialIndex, onClose, language, primary, accent }: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => { const t = setTimeout(() => setShowHint(false), 2500); return () => clearTimeout(t); }, []);

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx((i) => Math.min(slides.length - 1, i + 1)), [slides.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  const slide = slides[idx];
  if (!slide) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 animate-fade-in">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-6 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white/80">{idx + 1} / {slides.length}</span>
          <span className="text-sm text-white/50 truncate max-w-[400px]">{slide.title}</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 items-center justify-center px-16 min-h-0">
        {/* Prev arrow */}
        <button onClick={prev} disabled={idx === 0}
          className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white disabled:opacity-20">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>

        {/* Slide */}
        <div className="max-w-[85vw] max-h-[80vh] w-full" style={{ aspectRatio: "16/9", maxWidth: "min(85vw, 142.22vh)" }}>
          <div className="h-full w-full overflow-hidden rounded-xl shadow-2xl">
            <SlideRenderer content={slide.content_json} layout={slide.layout || "title_bullets"} designJson={slide.design_json} slideNumber={idx + 1} language={language} primary={primary} accent={accent} />
          </div>
        </div>

        {/* Next arrow */}
        <button onClick={next} disabled={idx === slides.length - 1}
          className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white disabled:opacity-20">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Filmstrip */}
      <div className="shrink-0 px-6 py-3 flex items-center justify-center gap-2 overflow-x-auto">
        {slides.map((sl, i) => (
          <button key={sl.slide_id} onClick={() => setIdx(i)}
            className={`shrink-0 w-[72px] overflow-hidden rounded border-2 transition-all ${i === idx ? "border-white shadow-lg" : "border-transparent opacity-50 hover:opacity-80"}`}>
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <div className="absolute left-0 top-0 w-[720px] origin-top-left" style={{ transform: "scale(0.1)" }}>
                <SlideRenderer content={sl.content_json} layout={sl.layout || "title_bullets"} language={language} primary={primary} accent={accent} className="pointer-events-none" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Keyboard hint */}
      {showHint && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-fade-in rounded-full bg-black/60 px-4 py-2 text-xs text-white/60">
          Use &larr; &rarr; to navigate, ESC to close
        </div>
      )}
    </div>
  );
}
