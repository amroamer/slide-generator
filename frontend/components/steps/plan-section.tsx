"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { PlanSlideRow } from "./plan-slide-row";

interface Slide { slide_id: string; slide_title: string; slide_type: string; content_outline: string[]; data_references: string[]; speaker_notes_hint: string }
interface Section { section_id: string; section_title: string; section_purpose: string; slides: Slide[] }

interface Props {
  section: Section; sectionIndex: number; totalSections: number;
  onUpdateSection: (section: Section) => void; onDeleteSection: () => void;
  onMoveSection: (direction: "up" | "down") => void;
  onRefineSlide: (slideId: string, instruction: string) => Promise<void> | void; refiningSlideId: string | null;
}

const QUICK_ADD_SLIDES = [
  { label: "Executive Summary", type: "summary", outline: ["Key findings overview", "Critical metrics summary", "Recommended actions"], notes: "Brief overview for time-pressed executives" },
  { label: "Key Findings", type: "content", outline: ["Top 3-5 findings from the data", "Each finding supported by a specific metric"], notes: "" },
  { label: "Recommendations", type: "content", outline: ["Priority actions", "Owner assignments", "Timeline expectations"], notes: "" },
  { label: "Q&A", type: "section_divider", outline: ["Open floor for questions"], notes: "", position: "end" },
  { label: "Appendix", type: "table", outline: ["Detailed data tables", "Methodology notes", "Source references"], notes: "", position: "end" },
  { label: "Next Steps", type: "content", outline: ["Immediate actions (this week)", "Short-term (this month)", "Long-term (this quarter)"], notes: "" },
];

const SLIDE_TEMPLATES = [
  { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label: "Blank", title: "New Slide", type: "content", outline: [] },
  { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "KPI", title: "KPI Dashboard", type: "chart", outline: ["Key performance indicators with RAG status", "Target vs Actual comparison"] },
  { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", label: "Comparison", title: "Comparison Analysis", type: "comparison", outline: ["Side-by-side comparison", "Key differentiators", "Recommendation"] },
  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "Timeline", title: "Timeline & Milestones", type: "content", outline: ["Phase 1", "Phase 2", "Phase 3", "Key milestones"] },
  { icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", label: "SWOT", title: "SWOT Analysis", type: "comparison", outline: ["Strengths", "Weaknesses", "Opportunities", "Threats"] },
  { icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", label: "Risk Matrix", title: "Risk Assessment", type: "table", outline: ["Risk register", "Mitigation strategies", "Risk owners"] },
  { icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z", label: "Goals", title: "Goals & Key Results", type: "content", outline: ["Objective 1", "Objective 2", "Progress indicators"] },
  { icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", label: "Trends", title: "Trend Analysis", type: "chart", outline: ["Period-over-period trends", "Key inflection points", "Forecast"] },
  { icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", label: "Thank You", title: "Thank You", type: "section_divider", outline: ["Contact information", "Q&A invitation"] },
];

export function PlanSection({ section, sectionIndex, totalSections, onUpdateSection, onDeleteSection, onMoveSection, onRefineSlide, refiningSlideId }: Props) {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showSectionRefine, setShowSectionRefine] = useState(false);
  const [sectionRefineText, setSectionRefineText] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newSlideIds, setNewSlideIds] = useState<Set<string>>(new Set());

  function saveTitle(value: string) {
    setEditingTitle(false);
    if (value.trim() && value !== section.section_title) onUpdateSection({ ...section, section_title: value.trim() });
  }

  function updateSlide(idx: number, slide: Slide) { const s = [...section.slides]; s[idx] = slide; onUpdateSection({ ...section, slides: s }); }
  function deleteSlide(idx: number) { onUpdateSection({ ...section, slides: section.slides.filter((_, i) => i !== idx) }); }
  function moveSlide(idx: number, dir: "up" | "down") { const s = [...section.slides]; const t = dir === "up" ? idx - 1 : idx + 1; [s[idx], s[t]] = [s[t], s[idx]]; onUpdateSection({ ...section, slides: s }); }

  function addSlideFromTemplate(tmpl: { title: string; type: string; outline: string[]; notes?: string }, position?: "start" | "end") {
    const newId = `sl_${Date.now()}`;
    const newSlide: Slide = {
      slide_id: newId, slide_title: tmpl.title, slide_type: tmpl.type,
      content_outline: tmpl.outline, data_references: [], speaker_notes_hint: tmpl.notes || "",
    };
    const slides = position === "start" ? [newSlide, ...section.slides]
      : position === "end" ? [...section.slides, newSlide]
      : [...section.slides, newSlide];
    setNewSlideIds((prev) => new Set(prev).add(newId));
    setTimeout(() => setNewSlideIds((prev) => { const n = new Set(prev); n.delete(newId); return n; }), 3000);
    onUpdateSection({ ...section, slides });
    setShowQuickAdd(false);
    setShowTemplates(false);
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="flex shrink-0 flex-col gap-0.5">
          <button onClick={() => onMoveSection("up")} disabled={sectionIndex === 0} className="rounded p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          </button>
          <button onClick={() => onMoveSection("down")} disabled={sectionIndex === totalSections - 1} className="rounded p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
        <span className="badge bg-gray-200 text-gray-600 text-[10px]">S{sectionIndex + 1}</span>
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input defaultValue={section.section_title} autoFocus onBlur={(e) => saveTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTitle((e.target as HTMLInputElement).value)}
              className="w-full rounded border border-[#0091DA] bg-white px-2 py-0.5 text-base font-semibold text-gray-900 outline-none" />
          ) : (
            <div>
              <p onClick={() => setEditingTitle(true)} className="cursor-pointer text-base font-semibold text-gray-900 hover:text-[#00338D]">{section.section_title}</p>
              {section.section_purpose && <p className="mt-0.5 text-xs text-gray-500">{section.section_purpose}</p>}
            </div>
          )}
        </div>

        {/* Quick add dropdown */}
        <div className="relative">
          <button onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
            style={{ opacity: showQuickAdd ? 1 : undefined }}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            Quick add
          </button>
          {showQuickAdd && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowQuickAdd(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 animate-fade-in rounded-xl border border-gray-200 bg-white py-1 shadow-elevated">
                {QUICK_ADD_SLIDES.map((qa, i) => (
                  <button key={i} onClick={() => addSlideFromTemplate(
                    { title: qa.label, type: qa.type, outline: qa.outline, notes: qa.notes },
                    (qa as any).position === "end" ? "end" : "start"
                  )} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-gray-700 hover:bg-gray-50">
                    <span className="text-gray-400">+</span> {qa.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span className="shrink-0 text-xs text-gray-400">{section.slides.length} {t("slides")}</span>
        <button onClick={onDeleteSection} className="shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="shrink-0 rounded p-1 text-gray-400 transition-all hover:bg-gray-200">
          <svg className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>

      {/* Section refine */}
      {!collapsed && (
        <div className="px-4 pt-2">
          {!showSectionRefine ? (
            <button onClick={() => setShowSectionRefine(true)} className="text-xs font-medium text-[#0091DA] transition-colors hover:text-[#00338D]">{t("refineSection")}</button>
          ) : (
            <div className="flex gap-2 mb-2">
              <input value={sectionRefineText} onChange={(e) => setSectionRefineText(e.target.value)} placeholder={t("describeChangesSection")} className="input-field flex-1 h-9 text-sm" autoFocus />
              <button onClick={() => { onRefineSlide(`section:${section.section_id}`, sectionRefineText); setSectionRefineText(""); setShowSectionRefine(false); }}
                disabled={!sectionRefineText.trim()} className="btn-primary h-9 px-3 text-xs">{t("refine")}</button>
              <button onClick={() => { setShowSectionRefine(false); setSectionRefineText(""); }} className="btn-ghost h-9 text-xs">{t("cancel")}</button>
            </div>
          )}
        </div>
      )}

      {/* Slides */}
      {!collapsed && (
        <div className="space-y-2 p-4">
          {section.slides.map((slide, i) => (
            <PlanSlideRow key={slide.slide_id} slide={slide} index={i} totalInSection={section.slides.length}
              onUpdate={(s) => updateSlide(i, s)} onRefine={onRefineSlide} onDelete={() => deleteSlide(i)}
              onMove={(dir) => moveSlide(i, dir)} refining={refiningSlideId === slide.slide_id}
              isNew={newSlideIds.has(slide.slide_id)} />
          ))}

          {/* Add slide — template picker */}
          <div className="relative">
            <button onClick={() => setShowTemplates(!showTemplates)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-400 transition-all hover:border-gray-400 hover:text-gray-600">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t("addSlide")}
            </button>
            {showTemplates && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTemplates(false)} />
                <div className="absolute bottom-full left-1/2 z-20 mb-2 w-[420px] -translate-x-1/2 animate-fade-in rounded-xl border border-gray-200 bg-white p-4 shadow-modal">
                  <p className="mb-3 text-sm font-semibold text-gray-900">{t("addASlide")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {SLIDE_TEMPLATES.map((tmpl, i) => (
                      <button key={i} onClick={() => addSlideFromTemplate({ title: tmpl.title, type: tmpl.type, outline: tmpl.outline })}
                        className="flex flex-col items-center rounded-lg border border-gray-200 p-3 transition-all hover:border-[#0091DA] hover:bg-blue-50/30">
                        <svg className="mb-1.5 h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={tmpl.icon} /></svg>
                        <span className="text-[11px] font-medium text-gray-700">{tmpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
