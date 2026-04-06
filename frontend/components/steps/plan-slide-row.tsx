"use client";

import { useEffect, useState } from "react";
import { useQuickActions } from "@/lib/use-quick-actions";
import { QuickActionPills, QuickAction } from "./quick-action-pills";

interface Slide {
  slide_id: string;
  slide_title: string;
  slide_type: string;
  content_outline: string[];
  data_references: string[];
  speaker_notes_hint: string;
}

interface Props {
  slide: Slide;
  index: number;
  totalInSection: number;
  onUpdate: (slide: Slide) => void;
  onRefine: (slideId: string, instruction: string) => Promise<void> | void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  refining: boolean;
  isNew?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  title: "bg-purple-100 text-purple-700",
  content: "bg-blue-100 text-blue-700",
  chart: "bg-emerald-100 text-emerald-700",
  table: "bg-amber-100 text-amber-700",
  comparison: "bg-rose-100 text-rose-700",
  summary: "bg-gray-100 text-gray-600",
  section_divider: "bg-gray-100 text-gray-500",
};

const PLANNER_ACTIONS: QuickAction[] = [
  { name: "data-driven", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Data-driven", prompt: "Restructure this slide to be data-driven. Reference specific metrics, numbers, and KPIs from the uploaded data. Replace vague statements with concrete data points." },
  { name: "comparison", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", label: "Comparison", prompt: "Add a comparison element to this slide. Compare current vs previous period, target vs actual, or before vs after. Structure the content to highlight the delta." },
  { name: "trends", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", label: "Trends", prompt: "Refocus this slide on trends and patterns over time. Highlight what's improving, declining, or stable." },
  { name: "recommendations", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", label: "Recommendations", prompt: "Add 2-3 actionable recommendations based on the data. Each should be specific, measurable, and assigned to a stakeholder." },
  { name: "visual", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", label: "More visual", prompt: "Make this slide more visual. Convert bullets into chart suggestions, add data callout boxes. Minimize text, maximize visual impact." },
  { name: "shorter", icon: "M20 12H4", label: "Shorter", prompt: "Reduce content by 40-50%. Keep only critical points. Maximum 3-4 bullets. Remove supporting detail, keep conclusions." },
  { name: "longer", icon: "M12 4v16m8-8H4", label: "Longer", prompt: "Expand with more detail. Add supporting data points, context, and evidence. Aim for 5-7 bullets." },
];

export function PlanSlideRow({ slide, index, totalInSection, onUpdate, onRefine, onDelete, onMove, refining, isNew }: Props) {
  const dynamicActionsRaw = useQuickActions("quick_action.planner");
  const dynamicActions: QuickAction[] = dynamicActionsRaw.map((a) => ({ name: a.name, label: a.label, icon: a.icon, prompt: a.prompt }));
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [showRefine, setShowRefine] = useState(false);
  const [showNew, setShowNew] = useState(!!isNew);
  const [quickBusy, setQuickBusy] = useState(false);

  useEffect(() => {
    if (showNew) { const t = setTimeout(() => setShowNew(false), 3000); return () => clearTimeout(t); }
  }, [showNew]);

  function saveTitle(value: string) {
    setEditingTitle(false);
    if (value.trim() && value !== slide.slide_title) onUpdate({ ...slide, slide_title: value.trim() });
  }

  function handleRefineSubmit() {
    if (refineText.trim()) { onRefine(slide.slide_id, refineText.trim()); setRefineText(""); setShowRefine(false); }
  }

  async function handleQuickAction(_name: string, prompt: string) {
    setQuickBusy(true);
    try { await onRefine(slide.slide_id, prompt); }
    finally { setQuickBusy(false); }
  }

  const typeColor = TYPE_COLORS[slide.slide_type] || TYPE_COLORS.content;

  return (
    <div className="group rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex shrink-0 flex-col gap-0.5">
          <button onClick={() => onMove("up")} disabled={index === 0} className="rounded p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          </button>
          <button onClick={() => onMove("down")} disabled={index === totalInSection - 1} className="rounded p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
        <span className="shrink-0 text-xs font-medium text-gray-400">{index + 1}</span>
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input defaultValue={slide.slide_title} autoFocus onBlur={(e) => saveTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTitle((e.target as HTMLInputElement).value)}
              className="w-full rounded border border-[#0091DA] bg-white px-2 py-0.5 text-sm font-medium text-gray-900 outline-none" />
          ) : (
            <p onClick={() => setEditingTitle(true)} className="cursor-pointer truncate text-sm font-medium text-gray-900 hover:text-[#00338D]">{slide.slide_title}</p>
          )}
        </div>
        <span className={`badge shrink-0 text-[10px] uppercase tracking-wider ${typeColor}`}>{slide.slide_type.replace("_", " ")}</span>
        {showNew && <span className="badge bg-blue-100 text-blue-700 text-[9px] animate-fade-in">NEW</span>}
        <button onClick={onDelete} className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <button onClick={() => setExpanded(!expanded)} className="shrink-0 rounded p-1 text-gray-400 transition-all hover:bg-gray-100">
          <svg className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 animate-fade-in">
          {slide.content_outline?.length > 0 && (
            <ul className="mb-3 space-y-1">
              {slide.content_outline.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />{b}
                </li>
              ))}
            </ul>
          )}
          {slide.data_references?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {slide.data_references.map((ref, i) => (
                <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono text-gray-500">{ref}</span>
              ))}
            </div>
          )}
          {slide.speaker_notes_hint && <p className="mb-3 text-xs italic text-gray-400">Notes: {slide.speaker_notes_hint}</p>}

          {/* Quick action pills — shared component */}
          <div className="mb-3">
            <QuickActionPills actions={dynamicActions.length > 0 ? dynamicActions : PLANNER_ACTIONS} onAction={handleQuickAction} disabled={refining} />
          </div>

          {/* Manual refine */}
          {!showRefine ? (
            <button onClick={() => setShowRefine(true)} disabled={quickBusy}
              className="text-xs font-medium text-[#0091DA] transition-colors hover:text-[#00338D] disabled:opacity-40">Custom prompt...</button>
          ) : (
            <div className="flex gap-2">
              <input value={refineText} onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRefineSubmit()}
                placeholder="Describe changes..." className="input-field flex-1 h-9 text-sm" autoFocus disabled={quickBusy} />
              <button onClick={handleRefineSubmit} disabled={!refineText.trim() || refining || quickBusy} className="btn-primary h-9 px-3 text-xs">
                {refining ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "Refine"}
              </button>
              <button onClick={() => { setShowRefine(false); setRefineText(""); }} className="btn-ghost h-9 text-xs">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
