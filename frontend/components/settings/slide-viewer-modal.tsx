"use client";

import { useCallback, useEffect, useState } from "react";

interface Variation {
  id: string;
  variation_index: number;
  variation_name: string;
  tags: string[] | null;
  thumbnail_path: string | null;
  is_favorite: boolean;
  usage_count: number;
  design_summary: any;
}

interface Props {
  collectionName: string;
  collectionId: string;
  variations: Variation[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (variationId: string) => void;
}

export function SlideViewerModal({ collectionName, collectionId, variations, initialIndex, onClose, onDelete }: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const [zoom, setZoom] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const variation = variations[idx];

  const prev = useCallback(() => { setIdx((i) => Math.max(0, i - 1)); setZoom(false); setPan({ x: 0, y: 0 }); }, []);
  const next = useCallback(() => { setIdx((i) => Math.min(variations.length - 1, i + 1)); setZoom(false); setPan({ x: 0, y: 0 }); }, [variations.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  // Preload adjacent slides
  useEffect(() => {
    const preload = (i: number) => {
      if (i >= 0 && i < variations.length && variations[i].thumbnail_path) {
        const img = new Image();
        img.src = variations[i].thumbnail_path!;
      }
    };
    preload(idx - 1);
    preload(idx + 1);
  }, [idx, variations]);

  if (!variation) return null;

  const ds = variation.design_summary || {};
  const colors: string[] = ds.color_palette || [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm animate-fade-in">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-5 py-3 bg-black/40">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <span>{collectionName}</span>
          <svg className="h-3 w-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-white/90">{variation.variation_name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-white/50">{idx + 1} / {variations.length}</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 items-center justify-center min-h-0 px-16">
        {/* Prev */}
        {idx > 0 && (
          <button onClick={prev} className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}

        {/* Slide image */}
        <div
          className={`max-w-[85vw] max-h-[65vh] overflow-hidden rounded-lg bg-white shadow-2xl ${zoom ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}`}
          style={{ aspectRatio: "16/9", maxWidth: "min(85vw, 115.5vh)" }}
          onDoubleClick={() => { setZoom(!zoom); setPan({ x: 0, y: 0 }); }}
          onMouseDown={(e) => { if (zoom) { setDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); } }}
          onMouseMove={(e) => { if (dragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
        >
          {variation.thumbnail_path ? (
            <img
              key={variation.id}
              src={variation.thumbnail_path}
              alt={variation.variation_name}
              className="h-full w-full object-contain transition-transform duration-300"
              style={{ transform: zoom ? `scale(2) translate(${pan.x / 2}px, ${pan.y / 2}px)` : "scale(1)" }}
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
              <p className="text-sm">Preview not available</p>
            </div>
          )}
        </div>

        {/* Next */}
        {idx < variations.length - 1 && (
          <button onClick={next} className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        {/* Zoom hint */}
        <div className="absolute top-3 right-20 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-white/50">
          {zoom ? "100% — drag to pan" : "Double-click to zoom"}
        </div>
      </div>

      {/* Bottom info panel */}
      <div className="shrink-0 bg-gradient-to-t from-black/60 to-transparent px-6 pb-3 pt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-base font-semibold text-white">{variation.variation_name}</p>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {(variation.tags || []).map((t, i) => (
                <span key={i} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/80">{t}</span>
              ))}
              {ds.layout_style && (
                <span className="rounded-full bg-blue-500/30 px-2 py-0.5 text-[10px] text-blue-200">{ds.layout_style?.replace("_", " ")}</span>
              )}
              {ds.shape_count != null && (
                <span className="text-[10px] text-white/40">{ds.shape_count} elements</span>
              )}
            </div>
            {/* Color palette */}
            {colors.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <span className="text-[10px] text-white/40 mr-1">Colors:</span>
                {colors.slice(0, 8).map((c, i) => (
                  <div key={i} className="h-4 w-4 rounded-full border border-white/30" style={{ background: `#${c}` }} />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">Used {variation.usage_count}x</span>
            {onDelete && (
              <button onClick={() => onDelete(variation.id)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-rose-300 transition-all hover:bg-rose-500/20">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filmstrip */}
      <div className="shrink-0 bg-black/50 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {variations.map((v, i) => (
          <button key={v.id} onClick={() => { setIdx(i); setZoom(false); setPan({ x: 0, y: 0 }); }}
            className={`shrink-0 w-16 overflow-hidden rounded border-2 transition-all ${i === idx ? "border-white shadow-lg scale-110" : "border-transparent opacity-50 hover:opacity-80 hover:border-white/40"}`}>
            <div className="aspect-[16/9] bg-gray-800">
              {v.thumbnail_path ? (
                <img src={v.thumbnail_path} alt={v.variation_name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-500">{i + 1}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
