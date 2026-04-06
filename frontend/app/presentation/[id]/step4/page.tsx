"use client";

import { FullscreenPreview } from "@/components/steps/fullscreen-preview";
import { LayoutSelector } from "@/components/steps/layout-selector";
import { SlideRenderer } from "@/components/slides/slide-renderer";
import api from "@/lib/api";
import { useActiveSlide } from "@/lib/active-slide-context";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePresentation } from "../context";

interface Slide {
  id: string; slide_id: string; title: string; content_json: any;
  layout: string | null; design_json: any; order: number;
}

export default function Step4Page() {
  const { id } = useParams();
  const presId = id as string;
  const router = useRouter();
  const { pres, reload } = usePresentation();
  const { setActiveSlideId } = useActiveSlide();

  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [generatingChartId, setGeneratingChartId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState("");
  const autoAssigned = useRef(false);
  const [brandColors, setBrandColors] = useState<{ primary: string; accent: string }>({ primary: "#00338D", accent: "#0091DA" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/presentations/${presId}/slides`);
      setSlides(data);

      // Auto-assign layouts if none exist (instant with rule engine)
      const needsDesign = !data.some((s: Slide) => s.layout);
      if (needsDesign && data.length > 0 && !autoAssigned.current) {
        autoAssigned.current = true;
        const { data: designed } = await api.post(`/presentations/${presId}/design/generate`);
        setSlides(designed);
        await reload();
        setToast("Layouts auto-assigned based on content");
        setTimeout(() => setToast(""), 3000);
      }
      // Load brand profile colors
      try {
        const { data: input } = await api.get(`/presentations/${presId}/input`);
        if (input.brand_profile_id) {
          const { data: bp } = await api.get(`/brand-profiles/${input.brand_profile_id}`);
          setBrandColors({ primary: bp.primary_color, accent: bp.secondary_color });
        }
      } catch {}
    } catch { setSlides([]); }
    finally { setLoading(false); }
  }, [presId, reload]);

  useEffect(() => { load(); }, [load]);

  async function handleLayoutChange(slideId: string, layout: string) {
    setSlides((prev) => prev.map((s) => s.slide_id === slideId ? { ...s, layout } : s));
    try { await api.put(`/presentations/${presId}/slides/${slideId}/design`, { layout }); } catch {}
  }

  async function handleRefine() {
    if (!refineText.trim() || !selected) return;
    setRefining(true);
    try {
      const { data } = await api.post(`/presentations/${presId}/slides/${selected.slide_id}/design/refine`, { instruction: refineText.trim() });
      setSlides((prev) => prev.map((s) => s.slide_id === selected.slide_id ? { ...s, layout: data.layout, design_json: data.design_json } : s));
      setRefineText("");
    } catch {} finally { setRefining(false); }
  }

  async function handleGenerateChart(slideId: string) {
    setGeneratingChartId(slideId);
    try {
      const { data } = await api.post(`/presentations/${presId}/slides/${slideId}/refine`, {
        instruction: "Generate chart_data for this slide with chart_type, labels, and datasets with real numeric values.",
      });
      setSlides((prev) => prev.map((s) => s.slide_id === slideId ? { ...s, content_json: data.content_json } : s));
    } catch {} finally { setGeneratingChartId(null); }
  }

  function moveSlide(idx: number, dir: "up" | "down") {
    const t = dir === "up" ? idx - 1 : idx + 1;
    const n = [...slides]; [n[idx], n[t]] = [n[t], n[idx]]; setSlides(n); setSelectedIdx(t);
  }

  const selected = slides[selectedIdx];

  // Sync active slide for context panel
  useEffect(() => {
    if (selected) setActiveSlideId(selected.slide_id);
  }, [selected, setActiveSlideId]);

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
    </div>
  );

  if (slides.length === 0) return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-gray-500">No slides to design. Complete Step 3 first.</p>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-fade-in rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg flex items-center gap-2">
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">Step 4</span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-500">Visual Design</span>
          </div>
          <span className="badge bg-gray-100 text-gray-500">{slides.length} slides</span>
        </div>
      </div>

      {/* Two-panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filmstrip */}
        <div className="w-[220px] shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-3 space-y-2">
          {slides.map((sl, i) => (
            <div key={sl.slide_id}>
              <button onClick={() => setSelectedIdx(i)}
                className={`group relative w-full overflow-hidden rounded-lg border-2 bg-white transition-all ${i === selectedIdx ? "border-[#00338D] shadow-md" : "border-transparent hover:border-gray-300"}`}>
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <div className="absolute left-0 top-0 w-[800px] origin-top-left" style={{ transform: "scale(0.25)" }}>
                    <SlideRenderer content={sl.content_json} layout={sl.layout || "title_bullets"} slideNumber={i + 1} language={pres?.language} primary={brandColors.primary} accent={brandColors.accent} className="pointer-events-none" />
                  </div>
                </div>
                <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); moveSlide(i, "up"); }} disabled={i === 0} className="rounded bg-white/90 p-0.5 shadow-sm hover:bg-gray-100 disabled:opacity-30">
                    <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveSlide(i, "down"); }} disabled={i === slides.length - 1} className="rounded bg-white/90 p-0.5 shadow-sm hover:bg-gray-100 disabled:opacity-30">
                    <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </button>
              <p className="mt-1 truncate px-1 text-[10px] text-gray-500">
                <span className="font-medium text-gray-400">{i + 1}.</span> {sl.title}
              </p>
            </div>
          ))}
        </div>

        {/* Main preview */}
        {selected && (
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-3xl animate-fade-in">
              {/* Slide preview — double-click for fullscreen */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-200 shadow-lg cursor-pointer"
                onDoubleClick={() => setFullscreen(true)}>
                <SlideRenderer content={selected.content_json} layout={selected.layout || "title_bullets"} designJson={selected.design_json} slideNumber={selectedIdx + 1} language={pres?.language} primary={brandColors.primary} accent={brandColors.accent}
                  onGenerateChart={() => handleGenerateChart(selected.slide_id)} onSwitchLayout={(l) => handleLayoutChange(selected.slide_id, l)} generatingChart={generatingChartId === selected.slide_id} />
                {/* Expand button */}
                <button onClick={() => setFullscreen(true)}
                  className="absolute top-3 right-3 rounded-lg bg-black/40 p-1.5 text-white opacity-0 transition-all hover:bg-black/60 group-hover:opacity-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </button>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Layout</label>
                <LayoutSelector selected={selected.layout || "title_bullets"} onChange={(l) => handleLayoutChange(selected.slide_id, l)} />
              </div>

              <div className="mt-4 flex gap-2">
                <input value={refineText} onChange={(e) => setRefineText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRefine()}
                  placeholder="Ask Designer Agent to adjust this slide..." className="input-field flex-1 h-10 text-sm" />
                <button onClick={handleRefine} disabled={!refineText.trim() || refining} className="btn-primary h-10 px-4 text-sm">
                  {refining ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "Refine"}
                </button>
              </div>

              <p className="mt-3 text-xs text-gray-400">
                Slide {selectedIdx + 1} of {slides.length} &middot; {selected.layout || "title_bullets"} &middot; Double-click to preview fullscreen
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-8 py-4 shadow-[0_-4px_12px_rgb(0,0,0,0.04)]">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{slides.length} slides designed</p>
          <button onClick={() => router.push(`/presentation/${presId}/step5`)} className="btn-primary h-11 px-8">
            Export Presentation
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Fullscreen preview */}
      {fullscreen && (
        <FullscreenPreview slides={slides} initialIndex={selectedIdx} onClose={() => setFullscreen(false)} language={pres?.language} />
      )}
    </div>
  );
}
