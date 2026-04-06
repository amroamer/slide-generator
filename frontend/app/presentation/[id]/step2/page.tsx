"use client";

import { HandoffChips } from "@/components/steps/handoff-chips";
import { PlanSection } from "@/components/steps/plan-section";
import { StaleWarning } from "@/components/steps/stale-warning";
import api from "@/lib/api";
import { usePipeline } from "@/lib/pipeline-context";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePresentation } from "../context";

interface Plan {
  id: string;
  version: number;
  plan_json: { title?: string; sections: any[] };
  is_active: boolean;
  created_at: string;
}

interface VersionSummary {
  id: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

interface GenProgress {
  total: number;
  completed: number;
  currentSection: string;
  failed: { slide_id: string; error: string }[];
  status: string;
}

export default function Step2Page() {
  const { id } = useParams();
  const presId = id as string;
  const router = useRouter();
  const { pres, reload } = usePresentation();
  const { steps: pipeSteps, refreshPipeline, hasPlan, loaded: pipelineLoaded } = usePipeline();
  const planStale = pipeSteps.plan.status === "stale";
  const [regenLoading, setRegenLoading] = useState(false);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [regenText, setRegenText] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const [retryingSection, setRetryingSection] = useState<string | null>(null);
  const [genStartTime, setGenStartTime] = useState<number | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const taskIdRef = useRef<string | null>(null);
  const prevCompletedRef = useRef(0);

  const loadPlan = useCallback(async () => {
    if (!pipelineLoaded) return;

    if (!hasPlan) {
      setPlan(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get(`/presentations/${presId}/plan`);
      setPlan(data);
      try {
        const { data: vers } = await api.get(`/presentations/${presId}/plan/versions`);
        setVersions(vers);
      } catch { /* versions not critical */ }
    } catch (err: any) {
      console.error("Failed to load plan:", err);
      setPlan(null);
    }
    finally { setLoading(false); }
  }, [presId, pipelineLoaded, hasPlan]);

  useEffect(() => { refreshPipeline(); }, [refreshPipeline]);
  useEffect(() => { loadPlan(); }, [loadPlan]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Auto-scroll when a new section completes
  useEffect(() => {
    if (!genProgress) return;
    const completed = genProgress.completed;
    if (completed > prevCompletedRef.current && completed > 0) {
      const el = document.getElementById(`plan-section-${completed}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCompletedRef.current = completed;
  }, [genProgress?.completed]);

  async function handleGenerateWithCancel() {
    setGenerating(true);
    setGenProgress(null);
    setGenStartTime(Date.now());
    prevCompletedRef.current = 0;

    try {
      const { data } = await api.post(`/presentations/${presId}/plan/generate-progressive`);
      const taskId = data.task_id;
      taskIdRef.current = taskId;
      setGenProgress({ total: 0, completed: 0, currentSection: "", failed: [], status: "running" });

      pollingRef.current = setInterval(async () => {
        try {
          const { data: progress } = await api.get(`/tasks/${taskId}/progress`);

          setGenProgress({
            total: progress.total || 0,
            completed: progress.completed || 0,
            currentSection: progress.current_step_title || "",
            failed: progress.failed || [],
            status: progress.status,
          });

          // Fetch the latest plan from DB — this is what drives real-time section rendering
          try {
            const { data: planData } = await api.get(`/presentations/${presId}/plan`);
            setPlan(planData);
          } catch { /* plan not saved yet */ }

          if (progress.status === "completed" || progress.status === "cancelled" || progress.status === "error") {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
            setGenerating(false);
            if (progress.status !== "error") {
              await reload();
              await refreshPipeline();
              try {
                const { data: planData } = await api.get(`/presentations/${presId}/plan`);
                setPlan(planData);
                const { data: vers } = await api.get(`/presentations/${presId}/plan/versions`);
                setVersions(vers);
              } catch { /* final load */ }
            }
          }
        } catch { /* polling error, continue */ }
      }, 2000);

    } catch (err) {
      console.error(err);
      setGenerating(false);
    }
  }

  async function handleCancelGeneration() {
    if (taskIdRef.current) {
      try { await api.post(`/tasks/${taskIdRef.current}/cancel`); } catch {}
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }
    setGenerating(false);
    setGenProgress((prev) => prev ? { ...prev, status: "cancelled" } : null);
    try {
      const { data: planData } = await api.get(`/presentations/${presId}/plan`);
      setPlan(planData);
    } catch {}
  }

  async function handleRetrySection(sectionId: string) {
    setRetryingSection(sectionId);
    try {
      const { data } = await api.post(`/presentations/${presId}/plan/retry-section`, { section_id: sectionId });
      setPlan(data);
    } catch (err) {
      console.error("Failed to retry section:", err);
    } finally {
      setRetryingSection(null);
    }
  }

  function debounceSave(planJson: any) {
    setSaved(false);
    setSaving(true);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.put(`/presentations/${presId}/plan`, { plan_json: planJson });
        setPlan(data);
        const { data: vers } = await api.get(`/presentations/${presId}/plan/versions`);
        setVersions(vers);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) { console.error(err); }
      finally { setSaving(false); }
    }, 1000);
  }

  function updateSection(sIdx: number, section: any) {
    if (!plan) return;
    const newSections = [...plan.plan_json.sections];
    newSections[sIdx] = section;
    const newPlan = { ...plan, plan_json: { ...plan.plan_json, sections: newSections } };
    setPlan(newPlan);
    debounceSave(newPlan.plan_json);
  }

  function deleteSection(sIdx: number) {
    if (!plan) return;
    const newSections = plan.plan_json.sections.filter((_: any, i: number) => i !== sIdx);
    const newPlan = { ...plan, plan_json: { ...plan.plan_json, sections: newSections } };
    setPlan(newPlan);
    debounceSave(newPlan.plan_json);
  }

  function moveSection(sIdx: number, dir: "up" | "down") {
    if (!plan) return;
    const newSections = [...plan.plan_json.sections];
    const target = dir === "up" ? sIdx - 1 : sIdx + 1;
    [newSections[sIdx], newSections[target]] = [newSections[target], newSections[sIdx]];
    const newPlan = { ...plan, plan_json: { ...plan.plan_json, sections: newSections } };
    setPlan(newPlan);
    debounceSave(newPlan.plan_json);
  }

  function addSection() {
    if (!plan) return;
    const newSection = {
      section_id: `s_${Date.now()}`, section_title: "New Section", section_purpose: "",
      slides: [{ slide_id: `sl_${Date.now()}`, slide_title: "New Slide", slide_type: "content", content_outline: [], data_references: [], speaker_notes_hint: "" }],
    };
    const newPlan = { ...plan, plan_json: { ...plan.plan_json, sections: [...plan.plan_json.sections, newSection] } };
    setPlan(newPlan);
    debounceSave(newPlan.plan_json);
  }

  async function handleRefine(target: string, instruction: string) {
    setRefiningId(target);
    try {
      if (target.startsWith("section:")) {
        const { data } = await api.post(`/presentations/${presId}/plan/refine`, { section_id: target.replace("section:", ""), instruction });
        setPlan(data);
      } else {
        const { data } = await api.post(`/presentations/${presId}/plan/refine`, { slide_id: target, instruction });
        setPlan(data);
      }
      const { data: vers } = await api.get(`/presentations/${presId}/plan/versions`);
      setVersions(vers);
    } catch (err) {
      console.error(err);
      throw err;
    } finally { setRefiningId(null); }
  }

  async function handleRegenerate() {
    if (!regenText.trim()) return;
    setGenerating(true);
    try {
      const { data } = await api.post(`/presentations/${presId}/plan/regenerate`, { instruction: regenText.trim() });
      setPlan(data);
      setRegenText("");
      setShowRegen(false);
      const { data: vers } = await api.get(`/presentations/${presId}/plan/versions`);
      setVersions(vers);
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  }

  async function handleVersionSwitch(version: number) {
    try { const { data } = await api.get(`/presentations/${presId}/plan/versions/${version}`); setPlan(data); } catch {}
  }

  const totalSlides = plan?.plan_json?.sections?.reduce((sum: number, s: any) => sum + (s.slides?.length || 0), 0) || 0;

  // Determine section status from the plan_json data saved by the backend
  function getSectionStatus(section: any): "pending" | "generating" | "complete" | "failed" {
    if (section._status === "failed") return "failed";
    if (section._status === "generating") return "generating";
    if (section._status === "pending" || section._status === "cancelled") return "pending";
    // No _status field = finalized section, check slides
    if (section.slides && section.slides.length > 0) return "complete";
    return "pending";
  }

  const isProgressiveGenerating = generating && genProgress;
  const genDuration = genStartTime ? Math.round((Date.now() - genStartTime) / 1000) : 0;

  // Loading spinner
  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
    </div>
  );

  // No plan, not generating — show Generate button
  if (!plan && !generating) return (
    <div className="flex flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Step 2</span>
          <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-500">Presentation Planning</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00338D] to-[#0055B8] text-2xl font-bold text-white shadow-lg">PA</div>
          <h3 className="text-xl font-semibold text-gray-900">Planner Agent</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">I&apos;ll analyze your data and create a structured presentation outline tailored to your audience and goals.</p>
          <button onClick={handleGenerateWithCancel} className="btn-primary mt-8 h-12 px-8 text-base">Generate Plan</button>
        </div>
      </div>
    </div>
  );

  // Generating without plan yet — show initial thinking state
  if (generating && !plan) return (
    <div className="flex flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Step 2</span>
          <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-500">Generating Plan...</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-6 py-16 animate-fade-in">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00338D] to-[#0055B8] text-2xl font-bold text-white shadow-lg">PA</div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-white bg-[#0091DA] animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900">Planner Agent</p>
            <p className="mt-1 text-sm text-gray-400">Analyzing your data and generating outline...</p>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-2 w-2 rounded-full bg-[#0091DA]"
                style={{ animation: "pulse-dot 1.4s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-sm text-gray-500 animate-fade-in">Planning presentation structure...</p>
        </div>
      </div>
    </div>
  );

  if (!plan) return null;

  const sections = plan.plan_json.sections || [];
  const hasFailedSections = sections.some((s: any) => s._status === "failed");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">Step 2</span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-500">Presentation Outline</span>
          </div>
          <span className="badge bg-gray-100 text-gray-500">{sections.length} sections, {totalSlides} slides</span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400 animate-pulse">Saving...</span>}
          {saved && <span className="text-xs text-emerald-500 animate-fade-in flex items-center gap-1"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Saved</span>}
          {!generating && versions.length > 1 && (
            <select value={plan.version} onChange={(e) => handleVersionSwitch(Number(e.target.value))}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 outline-none">
              {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}{v.is_active ? " (current)" : ""}</option>)}
            </select>
          )}
          {!generating && (
            <button onClick={() => setShowRegen(!showRegen)} className="btn-ghost text-xs">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Regenerate
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8 animate-fade-in">
          {/* Progress panel during progressive generation */}
          {isProgressiveGenerating && genProgress && (
            <div className="rounded-xl bg-white border border-gray-200 p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00338D] to-[#0055B8] flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">PA</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {genProgress.status === "completed"
                      ? "Plan complete"
                      : genProgress.total > 0
                        ? `Planning section ${Math.min(genProgress.completed + 1, genProgress.total)} of ${genProgress.total}...`
                        : "Planning presentation structure..."}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {genProgress.status === "completed"
                      ? `${genProgress.total} sections, ${totalSlides} slides generated in ${genDuration}s`
                      : genProgress.total > 0
                        ? genProgress.currentSection || "Generating section details..."
                        : "Analyzing uploaded data and generating outline"}
                  </p>
                </div>
                {genProgress.total > 0 && (
                  <span className="text-sm text-gray-400 shrink-0">{genProgress.completed}/{genProgress.total}</span>
                )}
                {genProgress.status !== "completed" && (
                  <button onClick={handleCancelGeneration} className="text-sm text-gray-400 hover:text-rose-500 shrink-0">Cancel</button>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${genProgress.status === "completed" ? "bg-emerald-500" : "bg-[#00338D]"}`}
                  style={{ width: `${genProgress.total > 0 ? (genProgress.completed / genProgress.total) * 100 : 5}%` }}
                />
              </div>

              {genProgress.failed.length > 0 && (
                <p className="mt-2 text-xs text-rose-500">{genProgress.failed.length} section(s) failed to generate</p>
              )}
            </div>
          )}

          {/* Cancelled banner */}
          {!generating && genProgress?.status === "cancelled" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 animate-fade-in">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <span className="text-sm font-medium text-amber-800">
                  Plan generation cancelled. {genProgress.completed} of {genProgress.total} sections completed.
                </span>
              </div>
              <button onClick={() => { setGenProgress(null); handleGenerateWithCancel(); }} className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-900 underline">
                Continue generating
              </button>
            </div>
          )}

          {/* Handoff chips */}
          {pres && !generating && (
            <div className="mb-4">
              <HandoffChips agentName="Intake Agent" chips={[
                { label: `${pres.audience || "General"} audience` },
                { label: pres.tone || "Professional" },
                { label: pres.language || "English" },
                { label: `${pres.slide_count} slides target` },
              ]} />
            </div>
          )}

          {/* Stale warning */}
          {!generating && planStale && pipeSteps.plan.staleReason && (
            <StaleWarning
              reason={pipeSteps.plan.staleReason}
              actionLabel="Regenerate Plan"
              loading={regenLoading}
              onAction={async () => {
                setRegenLoading(true);
                try {
                  await handleRegenerate();
                  await refreshPipeline();
                } finally { setRegenLoading(false); }
              }}
            />
          )}

          {!generating && showRegen && (
            <div className="card mb-6 p-4 animate-fade-in">
              <p className="mb-2 text-sm font-medium text-gray-700">Regenerate entire plan</p>
              <div className="flex gap-2">
                <input value={regenText} onChange={(e) => setRegenText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegenerate()}
                  placeholder="Describe changes to the overall structure..." className="input-field flex-1 text-sm" autoFocus />
                <button onClick={handleRegenerate} disabled={!regenText.trim()} className="btn-primary px-4 text-sm">Regenerate</button>
              </div>
            </div>
          )}

          {/* Sections — progressive real-time rendering */}
          <div className="space-y-4">
            {sections.map((section: any, i: number) => {
              const status = getSectionStatus(section);

              // Pending skeleton
              if (status === "pending" && generating) {
                return (
                  <div key={section.section_id || i} id={`plan-section-${i + 1}`} className="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2.5 py-0.5 font-medium">S{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-900">{section.section_title}</span>
                      <span className="text-xs text-gray-400">{section._slide_count || 0} slides</span>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: section._slide_count || 2 }).map((_, j) => (
                        <div key={j} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  </div>
                );
              }

              // Generating skeleton (indigo tint + spinner)
              if (status === "generating") {
                return (
                  <div key={section.section_id || i} id={`plan-section-${i + 1}`} className="rounded-xl border border-[#00338D]/20 bg-white p-4 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs bg-[#00338D]/10 text-[#00338D] rounded-full px-2.5 py-0.5 font-medium">S{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-900">{section.section_title}</span>
                      <span className="text-xs text-gray-400">{section._slide_count || 0} slides</span>
                      <svg className="h-4 w-4 text-[#00338D] animate-spin ml-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: section._slide_count || 2 }).map((_, j) => (
                        <div key={j} className="h-10 bg-[#00338D]/5 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  </div>
                );
              }

              // Failed section
              if (status === "failed") {
                return (
                  <div key={section.section_id || i} id={`plan-section-${i + 1}`} className="rounded-xl border-2 border-rose-200 bg-rose-50/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-0.5 font-medium">S{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-900">{section.section_title}</span>
                      <svg className="h-4 w-4 text-rose-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-rose-600 mb-2">Failed to generate — {section._error || "unknown error"}</p>
                    <button
                      onClick={() => handleRetrySection(section.section_id)}
                      disabled={retryingSection === section.section_id}
                      className="text-xs font-medium text-rose-700 hover:text-rose-900 underline disabled:opacity-50"
                    >
                      {retryingSection === section.section_id ? "Retrying..." : "Retry"}
                    </button>
                  </div>
                );
              }

              // Complete section — use existing PlanSection component
              return (
                <div key={section.section_id} id={`plan-section-${i + 1}`} className="animate-fade-in">
                  <PlanSection section={section} sectionIndex={i} totalSections={sections.length}
                    onUpdateSection={(s) => updateSection(i, s)} onDeleteSection={() => deleteSection(i)} onMoveSection={(dir) => moveSection(i, dir)}
                    onRefineSlide={handleRefine} refiningSlideId={refiningId} />
                </div>
              );
            })}
          </div>

          {!generating && (
            <button onClick={addSection}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-400 transition-all hover:border-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Section
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-8 py-4 shadow-[0_-4px_12px_rgb(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <p className="text-xs text-gray-400">
            {generating
              ? `Generating... ${genProgress?.completed || 0}/${genProgress?.total || "?"} sections`
              : `v${plan.version} \u00b7 ${sections.length} sections, ${totalSlides} slides`}
          </p>
          <button
            onClick={() => router.push(`/presentation/${presId}/step3`)}
            disabled={totalSlides === 0 || generating || hasFailedSections}
            className="btn-primary h-11 px-8"
          >
            Approve Plan & Generate Content
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
