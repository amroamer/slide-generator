"use client";

import { AgentThinking } from "@/components/steps/agent-thinking";
import { HandoffChips } from "@/components/steps/handoff-chips";
import { SlideContentCard } from "@/components/steps/slide-content-card";
import { StaleWarning } from "@/components/steps/stale-warning";
import api from "@/lib/api";
import { useActiveSlide } from "@/lib/active-slide-context";
import { usePipeline } from "@/lib/pipeline-context";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePresentation } from "../context";

interface Slide {
  id: string;
  slide_id: string;
  section: string;
  order: number;
  title: string;
  content_json: any;
}

// THINKING_MESSAGES will be populated with translated strings inside the component
const THINKING_MESSAGES_KEYS = [
  "readingData",
  "craftingNarratives",
  "buildingVisualizations",
  "writingSpeakerNotes",
  "polishingTakeaways",
];

export default function Step3Page() {
  const { id } = useParams();
  const presId = id as string;
  const router = useRouter();
  const { reload } = usePresentation();
  const { t, isRTL } = useLanguage();
  const { steps: pipeSteps, refreshPipeline } = usePipeline();
  const THINKING_MESSAGES = THINKING_MESSAGES_KEYS.map((k) => t(k));
  const { setActiveSlideId } = useActiveSlide();
  const contentStale = pipeSteps.content.status === "stale";

  const [slides, setSlides] = useState<Slide[]>([]);
  const [planSummary, setPlanSummary] = useState({ sections: 0, slides: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenText, setRegenText] = useState("");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Progressive generation state
  const [genProgress, setGenProgress] = useState<{ total: number; completed: number; current: string; ready: string[]; failed: any[] } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const loadedIdsRef = useRef<Set<string>>(new Set());

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const { hasContent, hasPlan, loaded: pipelineLoaded, refreshPipeline: refreshPipe } = usePipeline();

  const loadSlides = useCallback(async () => {
    if (!pipelineLoaded) return;

    // Only fetch slides if content has been generated
    if (hasContent) {
      try {
        const { data } = await api.get(`/presentations/${presId}/slides`);
        setSlides(data);
      } catch { setSlides([]); }
    } else {
      setSlides([]);
    }

    // Only fetch plan summary if plan exists
    if (hasPlan) {
      try {
        const { data: plan } = await api.get(`/presentations/${presId}/plan`);
        const secs = plan?.plan_json?.sections || [];
        const total = secs.reduce((acc: number, s: any) => acc + (s.slides?.length || 0), 0);
        setPlanSummary({ sections: secs.length, slides: total });
      } catch { /* plan load failed */ }
    }

    setLoading(false);
  }, [presId, pipelineLoaded, hasContent, hasPlan]);

  useEffect(() => { refreshPipe(); }, [refreshPipe]);
  useEffect(() => { loadSlides(); }, [loadSlides]);

  async function handleGenerate() {
    setGenerating(true);
    loadedIdsRef.current = new Set();
    setGenProgress(null);

    try {
      // Start background generation — returns immediately with task_id
      const { data } = await api.post(`/presentations/${presId}/content/generate`);
      const taskId = data.task_id;
      setGenProgress({ total: data.total, completed: 0, current: "", ready: [], failed: [] });

      // Start polling for progress
      pollingRef.current = setInterval(async () => {
        try {
          const { data: progress } = await api.get(`/tasks/${taskId}/progress`);
          setGenProgress({
            total: progress.total,
            completed: progress.completed,
            current: progress.current_step_title || "",
            ready: progress.steps_ready || [],
            failed: progress.failed || [],
          });

          // Fetch newly completed slides
          const newIds = (progress.steps_ready || []).filter((sid: string) => !loadedIdsRef.current.has(sid));
          for (const sid of newIds) {
            try {
              const { data: slideData } = await api.get(`/presentations/${presId}/slides/${sid}`);
              setSlides((prev) => {
                // Replace or append
                const exists = prev.some((s) => s.slide_id === sid);
                if (exists) return prev.map((s) => s.slide_id === sid ? slideData : s);
                return [...prev, slideData].sort((a, b) => a.order - b.order);
              });
              loadedIdsRef.current.add(sid);
            } catch { /* slide fetch failed, will retry next poll */ }
          }

          // Stop polling when done or errored
          if (progress.status === "completed" || progress.status === "cancelled" || progress.status === "error") {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
            setGenerating(false);
            if (progress.status !== "error") {
              await reload();
              await refreshPipeline();
            }
          }
        } catch { /* polling error, continue */ }
      }, 2500);

    } catch (err) {
      console.error(err);
      setGenerating(false);
    }
  }

  function toggleExpand(slideId: string) {
    setActiveSlideId(slideId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(slideId) ? next.delete(slideId) : next.add(slideId);
      return next;
    });
  }

  function expandAll() { setExpandedIds(new Set(slides.map((s) => s.slide_id))); }
  function collapseAll() { setExpandedIds(new Set()); }

  function handleSlideUpdate(slideId: string, title: string, contentJson: any) {
    // Optimistic update
    setSlides((prev) => prev.map((s) =>
      s.slide_id === slideId ? { ...s, title, content_json: contentJson } : s
    ));

    // Debounced save
    setSavedIds((prev) => { const n = new Set(prev); n.delete(slideId); return n; });
    setSavingIds((prev) => new Set(prev).add(slideId));
    clearTimeout(saveTimers.current[slideId]);
    saveTimers.current[slideId] = setTimeout(async () => {
      try {
        await api.put(`/presentations/${presId}/slides/${slideId}`, { title, content_json: contentJson });
        setSavedIds((prev) => new Set(prev).add(slideId));
        setTimeout(() => setSavedIds((prev) => { const n = new Set(prev); n.delete(slideId); return n; }), 2000);
      } catch (err) { console.error(err); }
      finally { setSavingIds((prev) => { const n = new Set(prev); n.delete(slideId); return n; }); }
    }, 1000);
  }

  async function handleRefine(slideId: string, instruction: string) {
    setRefiningId(slideId);
    try {
      const { data } = await api.post(`/presentations/${presId}/slides/${slideId}/refine`, { instruction });
      setSlides((prev) => prev.map((s) => s.slide_id === slideId ? { ...s, title: data.title, content_json: data.content_json } : s));
    } catch (err) {
      console.error(err);
      throw err; // Re-throw so quick action pills can detect failure
    } finally { setRefiningId(null); }
  }

  async function handleRegenerate() {
    setShowRegenConfirm(false);
    setGenerating(true);
    try {
      const { data } = await api.post(`/presentations/${presId}/content/regenerate`, { instruction: regenText || null });
      setSlides(data);
      setRegenText("");
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  }

  // Group slides by section
  const sections: { title: string; slides: Slide[] }[] = [];
  let lastSection = "";
  for (const s of slides) {
    if (s.section !== lastSection) {
      sections.push({ title: s.section, slides: [] });
      lastSection = s.section;
    }
    sections[sections.length - 1]?.slides.push(s);
  }

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
    </div>
  );

  // No slides — generate
  if (slides.length === 0 && !generating) return (
    <div className="flex flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">{t("step")} 3</span>
          <svg className={`h-4 w-4 text-gray-300 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-500">{t("step3Title")}</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00338D] to-[#0055B8] text-2xl font-bold text-white shadow-lg">WA</div>
          <h3 className="text-xl font-semibold text-gray-900">{t("writerAgent")}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{t("writerAgentDesc")}</p>
          <button onClick={handleGenerate} className="btn-primary mt-8 h-12 px-8 text-base">{t("generateContent")}</button>
        </div>
      </div>
    </div>
  );

  // No longer block the entire page during generation — show progress inline
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">{t("step")} 3</span>
            <svg className={`h-4 w-4 text-gray-300 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-500">{t("slideContent")}</span>
          </div>
          <span className="badge bg-gray-100 text-gray-500">{slides.length} {t("slides")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandedIds.size > 0 ? collapseAll : expandAll} className="btn-ghost text-xs">
            {expandedIds.size > 0 ? t("collapseAll") : t("expandAll")}
          </button>
          <button onClick={() => setShowRegenConfirm(true)} className="btn-ghost text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {t("regenerateAll")}
          </button>
        </div>
      </div>

      {/* Regenerate confirmation */}
      {showRegenConfirm && (
        <div className="border-b border-amber-200 bg-amber-50 px-8 py-4 animate-fade-in">
          <p className="mb-2 text-sm font-medium text-amber-800">{t("regenerateAllConfirm")}</p>
          <div className="flex gap-2">
            <input value={regenText} onChange={(e) => setRegenText(e.target.value)} placeholder={t("additionalInstruction")}
              className="input-field flex-1 h-9 text-sm bg-white" />
            <button onClick={handleRegenerate} className="btn-primary h-9 px-4 text-xs bg-amber-600 from-amber-600 to-amber-700">{t("regenerate")}</button>
            <button onClick={() => setShowRegenConfirm(false)} className="btn-ghost h-9 text-xs">{t("cancel")}</button>
          </div>
        </div>
      )}

      {/* Slides */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8 animate-fade-in">
          {/* Progress bar during generation */}
          {generating && genProgress && (
            <div className="card mb-4 p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#00338D] to-[#0055B8] text-[8px] font-bold text-white">WA</div>
                  <span className="text-sm font-medium text-gray-700">
                    {genProgress.completed >= genProgress.total ? t("allSlidesGenerated") : `${t("writingSlide")} ${genProgress.completed + 1} ${t("of")} ${genProgress.total}...`}
                  </span>
                </div>
                {genProgress.completed < genProgress.total && (
                  <button onClick={() => { if (pollingRef.current) clearInterval(pollingRef.current); setGenerating(false); }}
                    className="text-xs text-gray-400 hover:text-rose-500">{t("cancel")}</button>
                )}
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${genProgress.completed >= genProgress.total ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${genProgress.total ? (genProgress.completed / genProgress.total) * 100 : 0}%` }} />
              </div>
              {genProgress.current && genProgress.completed < genProgress.total && (
                <p className="mt-1.5 text-xs text-gray-500">{t("writing")} &ldquo;{genProgress.current}&rdquo;...</p>
              )}
              {genProgress.failed.length > 0 && (
                <p className="mt-1 text-xs text-rose-500">{genProgress.failed.length} slide(s) failed</p>
              )}
            </div>
          )}

          {/* Handoff chips */}
          <div className="mb-4">
            <HandoffChips agentName={t("plannerAgent")} chips={[
              { label: `${planSummary.sections} ${t("sections")}` },
              { label: `${planSummary.slides} ${t("slides")}` },
            ]} />
          </div>

          {/* Stale warning */}
          {contentStale && pipeSteps.content.staleReason && (
            <StaleWarning
              reason={pipeSteps.content.staleReason}
              actionLabel={`${t("regenerateAll")} ${t("content")}`}
              loading={generating}
              onAction={async () => {
                await handleRegenerate();
                await refreshPipeline();
              }}
            />
          )}

          {sections.map((sec, si) => (
            <div key={si} className="mb-8">
              {/* Section header */}
              {sec.title && (
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{sec.title}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              )}
              {/* Slide cards */}
              <div className="space-y-3">
                {sec.slides.map((slide, i) => (
                  <SlideContentCard
                    key={slide.slide_id}
                    slide={slide}
                    index={slide.order}
                    expanded={expandedIds.has(slide.slide_id)}
                    onToggle={() => toggleExpand(slide.slide_id)}
                    onUpdate={(title, cj) => handleSlideUpdate(slide.slide_id, title, cj)}
                    onRefine={(instruction) => handleRefine(slide.slide_id, instruction)}
                    onRequestAlternatives={async () => {
                      const { data } = await api.post(`/presentations/${presId}/slides/${slide.slide_id}/alternatives`);
                      return data;
                    }}
                    saving={savingIds.has(slide.slide_id)}
                    saved={savedIds.has(slide.slide_id)}
                    refining={refiningId === slide.slide_id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-8 py-4 shadow-[0_-4px_12px_rgb(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <p className="text-xs text-gray-400">{slides.length} {t("slides")} ready</p>
          <button onClick={() => router.push(`/presentation/${presId}/step4`)} className="btn-primary h-11 px-8">
            {t("approveAndDesign")}
            <svg className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
