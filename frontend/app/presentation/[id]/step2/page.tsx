"use client";

import { AgentThinking } from "@/components/steps/agent-thinking";
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
  plan_json: { sections: any[] };
  is_active: boolean;
  created_at: string;
}

interface VersionSummary {
  id: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

const THINKING_MESSAGES = [
  "Analyzing your data...",
  "Identifying key themes...",
  "Structuring sections...",
  "Building slide outline...",
  "Optimizing flow...",
];

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [regenText, setRegenText] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  const loadPlan = useCallback(async () => {
    // Wait for pipeline to tell us if a plan exists
    if (!pipelineLoaded) return;

    if (!hasPlan) {
      // No plan yet — show generate button, no API call
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

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data } = await api.post(`/presentations/${presId}/plan/generate`);
      setPlan(data);
      await reload();
      const { data: vers } = await api.get(`/presentations/${presId}/plan/versions`);
      setVersions(vers);
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
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
      throw err; // Re-throw so callers (quick action pills) can detect failure
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

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
    </div>
  );

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
          <button onClick={handleGenerate} className="btn-primary mt-8 h-12 px-8 text-base">Generate Plan</button>
        </div>
      </div>
    </div>
  );

  if (generating) return (
    <div className="flex flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Step 2</span>
          <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-500">Generating Plan...</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <AgentThinking agentName="Planner Agent" agentInitials="PA" messages={THINKING_MESSAGES} />
      </div>
    </div>
  );

  if (!plan) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">Step 2</span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-500">Presentation Outline</span>
          </div>
          <span className="badge bg-gray-100 text-gray-500">{plan.plan_json.sections?.length || 0} sections, {totalSlides} slides</span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400 animate-pulse">Saving...</span>}
          {saved && <span className="text-xs text-emerald-500 animate-fade-in flex items-center gap-1"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Saved</span>}
          {versions.length > 1 && (
            <select value={plan.version} onChange={(e) => handleVersionSwitch(Number(e.target.value))}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 outline-none">
              {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}{v.is_active ? " (current)" : ""}</option>)}
            </select>
          )}
          <button onClick={() => setShowRegen(!showRegen)} className="btn-ghost text-xs">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Regenerate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8 animate-fade-in">
          {/* Handoff chips */}
          {pres && (
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
          {planStale && pipeSteps.plan.staleReason && (
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

          {showRegen && (
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
          <div className="space-y-4">
            {plan.plan_json.sections?.map((section: any, i: number) => (
              <PlanSection key={section.section_id} section={section} sectionIndex={i} totalSections={plan.plan_json.sections.length}
                onUpdateSection={(s) => updateSection(i, s)} onDeleteSection={() => deleteSection(i)} onMoveSection={(dir) => moveSection(i, dir)}
                onRefineSlide={handleRefine} refiningSlideId={refiningId} />
            ))}
          </div>
          <button onClick={addSection}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-400 transition-all hover:border-gray-400 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Section
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-8 py-4 shadow-[0_-4px_12px_rgb(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <p className="text-xs text-gray-400">v{plan.version} &middot; {plan.plan_json.sections?.length || 0} sections, {totalSlides} slides</p>
          <button onClick={() => router.push(`/presentation/${presId}/step3`)} disabled={totalSlides === 0} className="btn-primary h-11 px-8">
            Approve Plan & Generate Content
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
