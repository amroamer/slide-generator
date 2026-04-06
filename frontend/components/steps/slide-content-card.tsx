"use client";

import { useRef, useState } from "react";
import { useQuickActions } from "@/lib/use-quick-actions";
import { BulletListEditor } from "./bullet-list-editor";
import { EditableText } from "./editable-text";
import { QuickActionPills, QuickAction } from "./quick-action-pills";

interface SlideData {
  id: string;
  slide_id: string;
  section: string;
  order: number;
  title: string;
  content_json: any;
}

interface Alternative { version: string; label: string; title?: string; body?: any; key_takeaway?: string; speaker_notes?: string }

interface Props {
  slide: SlideData;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (title: string, content_json: any) => void;
  onRefine: (instruction: string) => Promise<void> | void;
  onRequestAlternatives?: () => Promise<Alternative[]>;
  saving: boolean;
  saved: boolean;
  refining: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  title: "bg-purple-100 text-purple-700",
  content: "bg-blue-100 text-blue-700",
  chart: "bg-emerald-100 text-emerald-700",
  table: "bg-amber-100 text-amber-700",
  comparison: "bg-rose-100 text-rose-700",
  summary: "bg-gray-100 text-gray-600",
};

const WRITER_ACTIONS: QuickAction[] = [
  { name: "data-driven", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Data-driven", prompt: "Rewrite this slide content to be more data-driven. Replace vague statements with specific numbers, percentages, and metrics from the source data. Every bullet should contain at least one concrete data point." },
  { name: "comparison", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", label: "Comparison", prompt: "Add comparison elements to this slide content. Compare current vs previous period, target vs actual, or before vs after. Use delta values (e.g., +15%, -2.3 points) to highlight changes." },
  { name: "trends", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", label: "Trends", prompt: "Refocus this slide content on trends and patterns. Highlight what is improving, declining, or stable. Use directional language (increased, decreased, remained flat)." },
  { name: "recommendations", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", label: "Recommendations", prompt: "Add 2-3 specific, actionable recommendations to this slide. Each recommendation should include: what to do, who is responsible, and expected impact." },
  { name: "executive", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z", label: "Executive tone", prompt: "Rewrite this slide content in a more executive tone. Lead with conclusions, not details. Use authoritative language. Remove operational jargon. Every point should connect to a business outcome or decision." },
  { name: "shorter", icon: "M20 12H4", label: "Shorter", prompt: "Cut this slide content by 40-50%. Keep only the most impactful points. Maximum 3-4 bullets. Remove supporting details and keep conclusions." },
  { name: "longer", icon: "M12 4v16m8-8H4", label: "Longer", prompt: "Expand this slide with more depth. Add supporting evidence, context, and specific examples from the data. Aim for 5-7 bullets." },
  { name: "simplify", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z", label: "Simplify", prompt: "Simplify this slide content. Use shorter sentences, simpler words, and clearer structure. Remove acronyms or spell them out. A non-expert should understand every point." },
];

const CHART_ICONS: Record<string, string> = {
  bar: "Bar Chart",
  line: "Line Chart",
  pie: "Pie Chart",
  donut: "Donut Chart",
};

function wordCount(content: any): number {
  if (!content) return 0;
  const body = content.body;
  if (!body) return 0;
  const items = body.content || [];
  return items.join(" ").split(/\s+/).filter(Boolean).length;
}

export function SlideContentCard({ slide, index, expanded, onToggle, onUpdate, onRefine, onRequestAlternatives, saving, saved, refining }: Props) {
  const dynamicActionsRaw = useQuickActions("quick_action.writer");
  const dynamicActions: QuickAction[] = dynamicActionsRaw.map((a) => ({ name: a.name, label: a.label, icon: a.icon, prompt: a.prompt }));
  const cj = slide.content_json || {};
  const body = cj.body || {};
  const bodyContent: string[] = body.content || [];
  const bodyType: string = body.type || "bullets";
  const [refineText, setRefineText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const refineRef = useRef<HTMLInputElement>(null);

  async function handleQuickAction(_name: string, prompt: string) {
    // Quick action pills call onAction which must return a Promise
    // that resolves on success and rejects on failure
    await onRefine(prompt);
  }

  async function handleAlternatives() {
    if (!onRequestAlternatives) return;
    setLoadingAlts(true);
    try {
      const alts = await onRequestAlternatives();
      setAlternatives(alts || []);
    } catch { setAlternatives([]); }
    finally { setLoadingAlts(false); }
  }

  function selectAlternative(alt: Alternative) {
    const newCj = { ...cj };
    if (alt.title) newCj.title = alt.title;
    if (alt.body) newCj.body = alt.body;
    if (alt.key_takeaway !== undefined) newCj.key_takeaway = alt.key_takeaway;
    if (alt.speaker_notes !== undefined) newCj.speaker_notes = alt.speaker_notes;
    onUpdate(alt.title || slide.title, newCj);
    setAlternatives([]);
  }

  function updateBody(newContent: string[]) {
    const newCj = { ...cj, body: { ...body, content: newContent } };
    onUpdate(slide.title, newCj);
  }

  function updateField(field: string, value: any) {
    const newCj = { ...cj, [field]: value };
    onUpdate(slide.title, newCj);
  }

  function handleRefineSubmit() {
    if (refineText.trim()) {
      onRefine(refineText.trim());
      setRefineText("");
    }
  }

  const slideType = cj.slide_type || "content";
  const typeColor = TYPE_COLORS[slideType] || TYPE_COLORS.content;
  const preview = bodyContent.slice(0, 2).join(" ").slice(0, 120);

  return (
    <div className={`card overflow-hidden transition-all duration-200 ${refining ? "opacity-70" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={onToggle}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500">
          {index + 1}
        </span>
        <EditableText
          value={slide.title}
          onChange={(v) => onUpdate(v, cj)}
          className="flex-1 min-w-0 text-base font-semibold text-gray-900"
        />
        <span className={`badge shrink-0 text-[10px] uppercase tracking-wider ${typeColor}`}>
          {slideType.replace("_", " ")}
        </span>
        <span className="shrink-0 text-xs text-gray-400">{wordCount(cj)}w</span>
        {onRequestAlternatives && expanded && (
          <button onClick={(e) => { e.stopPropagation(); handleAlternatives(); }} disabled={loadingAlts}
            className="btn-ghost shrink-0 text-[11px] text-gray-500 hover:text-gray-700">
            {loadingAlts ? <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-gray-600" /> :
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
            Alternatives
          </button>
        )}
        {saving && <span className="shrink-0 text-xs text-gray-400 animate-pulse">Saving...</span>}
        {saved && <span className="shrink-0 text-xs text-emerald-500 flex items-center gap-0.5 animate-fade-in"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>}
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </div>

      {/* Collapsed preview */}
      {!expanded && preview && (
        <div className="border-t border-gray-100 px-5 py-2">
          <p className="text-sm text-gray-500 line-clamp-2">{preview}</p>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
          {/* Body content */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Content</label>
            {bodyType === "bullets" ? (
              <BulletListEditor items={bodyContent} onChange={updateBody} />
            ) : (
              bodyContent.map((p, i) => (
                <EditableText
                  key={i}
                  value={p}
                  onChange={(v) => {
                    const next = [...bodyContent];
                    next[i] = v;
                    updateBody(next);
                  }}
                  as="textarea"
                  className="mb-2 block text-sm text-gray-600"
                />
              ))
            )}
          </div>

          {/* Key Takeaway */}
          {cj.key_takeaway !== undefined && (
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Key Takeaway</label>
              <div className="rounded-lg border-l-2 border-[#0091DA] bg-blue-50/30 p-3">
                <EditableText
                  value={cj.key_takeaway || ""}
                  onChange={(v) => updateField("key_takeaway", v)}
                  className="text-sm font-medium text-gray-800"
                  placeholder="Key message for this slide..."
                />
              </div>
            </div>
          )}

          {/* Data Table */}
          {cj.data_table && cj.data_table.headers && (
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Data Table</label>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {cj.data_table.headers.map((h: string, i: number) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(cj.data_table.rows || []).map((row: any[], ri: number) => (
                      <tr key={ri} className="hover:bg-gray-50">
                        {row.map((cell: any, ci: number) => (
                          <td key={ci} className="px-3 py-1.5 text-gray-700">{String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Chart Data */}
          {cj.chart_data && (
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Chart Suggestion</label>
              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="font-medium text-gray-700">
                  {CHART_ICONS[cj.chart_data.chart_type] || cj.chart_data.chart_type}
                </span>
                <span className="text-gray-400">&middot;</span>
                <span className="text-gray-500">
                  {cj.chart_data.datasets?.length || 0} data series
                </span>
              </div>
            </div>
          )}

          {/* Speaker Notes */}
          <div>
            <button onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600">
              <svg className={`h-3 w-3 transition-transform ${showNotes ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              Speaker Notes
            </button>
            {showNotes && (
              <div className="mt-2 animate-fade-in">
                <EditableText
                  value={cj.speaker_notes || ""}
                  onChange={(v) => updateField("speaker_notes", v)}
                  as="textarea"
                  className="block text-sm italic text-gray-500"
                  editClassName="bg-gray-50 rounded-lg p-3"
                  placeholder="Notes visible only to the presenter..."
                />
              </div>
            )}
          </div>

          {/* Quick action pills */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <QuickActionPills
              actions={dynamicActions.length > 0 ? dynamicActions : WRITER_ACTIONS}
              onAction={handleQuickAction}
              disabled={refining || alternatives.length > 0}
            />
          </div>

          {/* Refine prompt */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              ref={refineRef}
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRefineSubmit()}
              placeholder="Ask Writer Agent to refine this slide..."
              className="h-9 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition-all focus:border-[#0091DA] focus:bg-white focus:ring-2 focus:ring-[#0091DA]/20"
            />
            <button onClick={handleRefineSubmit} disabled={!refineText.trim() || refining}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00338D] text-white transition-all hover:bg-[#002266] disabled:opacity-40">
              {refining ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Alternatives picker */}
      {alternatives.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Choose an alternative</p>
            <button onClick={() => setAlternatives([])} className="btn-ghost text-xs">Cancel</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {alternatives.map((alt, i) => {
              const bullets = (alt.body?.content || []).slice(0, 3);
              return (
                <button key={i} onClick={() => selectAlternative(alt)}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-[#0091DA] hover:shadow-sm">
                  <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 mb-2">
                    {alt.version} &middot; {alt.label}
                  </span>
                  <p className="text-xs font-semibold text-gray-900 line-clamp-1 mb-1">{alt.title || slide.title}</p>
                  {bullets.map((b: string, bi: number) => (
                    <p key={bi} className="text-[11px] text-gray-500 line-clamp-1">&bull; {b}</p>
                  ))}
                  <p className="mt-2 text-[11px] font-medium text-[#0091DA]">Select this version</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
