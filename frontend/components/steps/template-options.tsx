"use client";

import api from "@/lib/api";
import { useEffect, useState } from "react";

interface Variation {
  id: string;
  name: string;
  thumbnail_path: string | null;
  is_primary: boolean;
  is_enabled: boolean;
  quality_score: number;
}

interface MatchedCollection {
  id: string;
  name: string;
  slide_type_category: string;
  variation_count: number;
  variations: Variation[];
}

interface Props {
  slideType: string;
  selectedVariationId: string | null;
  onSelectVariation: (variationId: string | null, collectionId?: string | null) => void;
}

export function TemplateOptions({ slideType, selectedVariationId, onSelectVariation }: Props) {
  const [collections, setCollections] = useState<MatchedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!slideType) { setLoading(false); return; }
    setLoading(true);
    api.get(`/template-collections/match`, { params: { slide_type: slideType } })
      .then(({ data }) => {
        const cols: MatchedCollection[] = data.collections || [];
        setCollections(cols);
        if (cols.length > 0) setActiveCollectionId(cols[0].id);
      })
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, [slideType]);

  const activeCollection = collections.find((c) => c.id === activeCollectionId) || null;
  const variations = activeCollection?.variations || [];

  if (loading) {
    return (
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Template Options</label>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-28 shrink-0 animate-shimmer rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
          ))}
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Template Options</label>
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center">
          <p className="text-xs text-gray-400">No templates for this slide type.</p>
          <a href="/settings/templates" className="mt-1 inline-block text-[10px] font-medium text-[#0091DA] hover:underline">
            Go to Slide Templates &rarr;
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Template Options</label>
        <div className="flex items-center gap-2">
          {selectedVariationId && (
            <button
              onClick={() => onSelectVariation(null, null)}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
            >
              ✕ Clear
            </button>
          )}
          {collections.length > 1 && (
            <select
              value={activeCollectionId || ""}
              onChange={(e) => setActiveCollectionId(e.target.value)}
              className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 outline-none focus:border-[#0091DA]"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.variation_count})</option>
              ))}
            </select>
          )}
          {collections.length === 1 && (
            <span className="text-[10px] text-gray-400">{activeCollection?.name}</span>
          )}
        </div>
      </div>

      {/* Thumbnail scroll row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {variations.map((v) => {
          const isSelected = selectedVariationId === String(v.id);
          return (
            <button
              key={v.id}
              onClick={() => onSelectVariation(
                isSelected ? null : String(v.id),
                isSelected ? null : activeCollectionId,
              )}
              className={`group relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-[#00338D] ring-1 ring-[#00338D]/30"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* Thumbnail */}
              <div className="h-[72px] w-[128px] bg-gray-50">
                {v.thumbnail_path ? (
                  <img
                    src={`/slide-generator${v.thumbnail_path}`}
                    alt={v.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[8px] text-gray-300">No preview</div>
                )}
              </div>

              {/* Primary star */}
              {v.is_primary && (
                <div className="absolute top-1 start-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] text-white shadow-sm">★</div>
              )}

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-1 end-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#00338D] shadow-sm">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
              )}

              {/* Name */}
              <div className="border-t border-gray-100 px-1.5 py-1">
                <p className="truncate text-[9px] font-medium text-gray-600">{v.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
