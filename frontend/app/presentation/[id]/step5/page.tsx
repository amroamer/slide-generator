"use client";

import { SlideRenderer } from "@/components/slides/slide-renderer";
import api from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePresentation } from "../context";

interface Slide {
  slide_id: string;
  title: string;
  content_json: any;
  layout: string | null;
  design_json: any;
}

type ExportFormat = "pptx" | "pdf";

export default function Step5Page() {
  const { id } = useParams();
  const presId = id as string;
  const { pres, reload } = usePresentation();

  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("pptx");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [brandColors, setBrandColors] = useState<{ primary: string; accent: string }>({ primary: "#00338D", accent: "#0091DA" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/presentations/${presId}/slides`);
      setSlides(data);
      setSelected(new Set(data.map((s: Slide) => s.slide_id)));
      // Load brand profile
      try {
        const { data: input } = await api.get(`/presentations/${presId}/input`);
        if (input.brand_profile_id) {
          const { data: bp } = await api.get(`/brand-profiles/${input.brand_profile_id}`);
          setBrandColors({ primary: bp.primary_color, accent: bp.secondary_color });
        }
      } catch {}
    } catch {}
    finally { setLoading(false); }
  }, [presId]);

  useEffect(() => { load(); }, [load]);

  function toggleSlide(sid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(slides.map((s) => s.slide_id))); }
  function deselectAll() { setSelected(new Set()); }

  async function handleExport() {
    setExporting(true);
    setExported(false);
    try {
      const slideIds = selected.size < slides.length ? Array.from(selected) : null;
      const endpoint = format === "pdf"
        ? `/presentations/${presId}/export/pdf`
        : `/presentations/${presId}/export/pptx`;
      const body = format === "pdf"
        ? { slide_ids: slideIds, include_notes: includeNotes }
        : { slide_ids: slideIds };

      const response = await api.post(endpoint, body, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers["content-disposition"];
      const ext = format === "pdf" ? ".pdf" : ".pptx";
      const filename = disposition?.match(/filename="?(.+?)"?$/)?.[1] || `presentation${ext}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setExported(true);
      await reload();
    } catch (err) { console.error(err); }
    finally { setExporting(false); }
  }

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Step 5</span>
          <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-500">Export</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-8 animate-fade-in">
          {/* Agent header */}
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00338D] to-[#0055B8] text-lg font-bold text-white shadow-lg">EA</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Export Agent</h3>
              <p className="text-sm text-gray-500">I&apos;ll package your presentation for download.</p>
            </div>
          </div>

          {/* Slide selection */}
          <div className="card p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Select Slides</h4>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{selected.size} of {slides.length} selected</span>
                <button onClick={selectAll} className="text-xs font-medium text-[#0091DA] hover:text-[#00338D]">Select All</button>
                <button onClick={deselectAll} className="text-xs font-medium text-gray-500 hover:text-gray-700">Deselect All</button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {slides.map((sl, i) => {
                const isSelected = selected.has(sl.slide_id);
                return (
                  <button key={sl.slide_id} onClick={() => toggleSlide(sl.slide_id)}
                    className={`group relative overflow-hidden rounded-lg border-2 bg-white transition-all ${isSelected ? "border-[#00338D] shadow-sm" : "border-gray-200 opacity-50 hover:opacity-80"}`}>
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <div className="absolute left-0 top-0 w-[800px] origin-top-left" style={{ transform: `scale(${180 / 800})` }}>
                        <SlideRenderer content={sl.content_json} layout={sl.layout || "title_bullets"} slideNumber={i + 1} language={pres?.language} primary={brandColors.primary} accent={brandColors.accent} className="pointer-events-none" />
                      </div>
                    </div>
                    <div className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${isSelected ? "border-[#00338D] bg-[#00338D]" : "border-gray-300 bg-white"}`}>
                      {isSelected && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <p className="mt-1 truncate px-0.5 text-[10px] text-gray-500"><span className="font-medium">{i + 1}.</span> {sl.title}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export format */}
          <div className="card p-6 mb-6">
            <h4 className="mb-4 text-sm font-semibold text-gray-900">Export Format</h4>
            <div className="grid grid-cols-2 gap-3">
              {/* PPTX option */}
              <button onClick={() => setFormat("pptx")}
                className={`rounded-xl border-2 p-4 text-left transition-all ${format === "pptx" ? "border-[#00338D] bg-[#00338D]/5" : "border-gray-200 hover:border-gray-300"}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${format === "pptx" ? "bg-[#00338D] text-white" : "bg-gray-100 text-gray-400"}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${format === "pptx" ? "text-gray-900" : "text-gray-600"}`}>PowerPoint (.pptx)</p>
                    <p className="text-xs text-gray-500">Compatible with PowerPoint &amp; Google Slides</p>
                  </div>
                </div>
              </button>
              {/* PDF option */}
              <button onClick={() => setFormat("pdf")}
                className={`rounded-xl border-2 p-4 text-left transition-all ${format === "pdf" ? "border-[#00338D] bg-[#00338D]/5" : "border-gray-200 hover:border-gray-300"}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${format === "pdf" ? "bg-[#00338D] text-white" : "bg-gray-100 text-gray-400"}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${format === "pdf" ? "text-gray-900" : "text-gray-600"}`}>PDF Document</p>
                    <p className="text-xs text-gray-500">Read-only sharing format</p>
                  </div>
                </div>
              </button>
            </div>

            {/* PDF-specific options */}
            {format === "pdf" && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button onClick={() => setIncludeNotes(!includeNotes)}
                    className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${includeNotes ? "border-[#00338D] bg-[#00338D]" : "border-gray-300 bg-white"}`}>
                    {includeNotes && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Include speaker notes</p>
                    <p className="text-xs text-gray-500">Adds a notes page after each slide with speaker notes content</p>
                  </div>
                </label>
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
              {selected.size} slides &middot; {format.toUpperCase()} &middot; {pres?.language || "English"} &middot; {pres?.llm_provider ? `${pres.llm_provider} model` : "Default model"}
              {format === "pdf" && includeNotes && " · With speaker notes"}
            </div>
          </div>

          {/* Export button */}
          <div className="text-center">
            {exported ? (
              <div className="animate-fade-in">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-lg font-semibold text-gray-900">Downloaded successfully!</p>
                <p className="mt-1 text-sm text-gray-500">Your presentation has been saved to your downloads folder.</p>
                <div className="mt-6 flex items-center justify-center gap-4">
                  <button onClick={() => setExported(false)} className="btn-primary h-11 px-6">Export Again</button>
                  <Link href="/dashboard" className="btn-secondary h-11 px-6">Back to Dashboard</Link>
                </div>
              </div>
            ) : (
              <button onClick={handleExport} disabled={exporting || selected.size === 0}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-gray-900 px-8 text-base font-semibold text-white shadow-lg transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                {exporting ? (
                  <><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Generating...</>
                ) : (
                  <><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download Presentation</>
                )}
              </button>
            )}
          </div>

          {/* Links */}
          {!exported && (
            <div className="mt-8 flex justify-center gap-6 text-sm">
              <Link href={`/presentation/${presId}/step4`} className="text-gray-500 hover:text-gray-700">Back to Design</Link>
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
