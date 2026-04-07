"use client";

import api from "@/lib/api";
import { useActiveSlide } from "@/lib/active-slide-context";
import { useLanguage } from "@/lib/language-context";
import { useCallback, useEffect, useState } from "react";

interface Props {
  currentStep: number;
  presentationId: string;
  isOpen: boolean;
  onToggle: () => void;
}

interface InputData { prompt: string; audience: string | null; tone: string | null; language: string | null; slide_count: number; file_paths: string[] | null; raw_data_json: any }
interface PlanData { version: number; plan_json: { sections: any[] }; created_at: string }
interface SlideData { slide_id: string; title: string; content_json: any; layout: string | null; order: number; section: string }
interface SourceData { slide_id: string; data_references: string[]; files: any[] }
interface SummaryData { title: string; language: string; tone: string | null; audience: string | null; llm_provider: string | null; llm_model: string | null; slide_count: number; total_words: number; estimated_minutes: number; slides: any[]; data_sources: string[]; plan_version: number; timeline: any }

function MicroLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-4 text-[10px] font-medium uppercase tracking-wider text-gray-400 first:mt-0">{children}</p>;
}

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${active ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
      {children}
    </span>
  );
}

function MiniTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg">
      <table className="w-full text-[10px]">
        <thead><tr className="bg-gray-100">{columns.map((c, i) => <th key={i} className="px-1.5 py-1 text-left font-medium text-gray-600">{c}</th>)}</tr></thead>
        <tbody>{(rows || []).slice(0, 8).map((row, ri) => (
          <tr key={ri} className={ri % 2 ? "bg-gray-50/50" : ""}>
            {row.map((cell: any, ci: number) => <td key={ci} className="px-1.5 py-0.5 text-gray-600">{String(cell ?? "")}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function ContextPanel({ currentStep, presentationId, isOpen, onToggle }: Props) {
  const { t } = useLanguage();
  const { activeSlideId } = useActiveSlide();
  const [tab, setTab] = useState(0);
  const [input, setInput] = useState<InputData | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inpRes, planRes, slidesRes] = await Promise.allSettled([
        api.get(`/presentations/${presentationId}/input`),
        api.get(`/presentations/${presentationId}/plan`),
        api.get(`/presentations/${presentationId}/slides`),
      ]);
      if (inpRes.status === "fulfilled") setInput(inpRes.value.data);
      if (planRes.status === "fulfilled") setPlan(planRes.value.data);
      if (slidesRes.status === "fulfilled") setSlides(slidesRes.value.data);
      if (currentStep === 5) {
        try { const { data } = await api.get(`/presentations/${presentationId}/context-summary`); setSummary(data); } catch {}
      }
    } catch {}
    setLoaded(true);
  }, [presentationId, currentStep]);

  useEffect(() => { if (isOpen && !loaded) load(); }, [isOpen, loaded, load]);

  // Fetch source data for active slide
  useEffect(() => {
    if (!isOpen || !activeSlideId || currentStep < 3) return;
    api.get(`/presentations/${presentationId}/slides/${activeSlideId}/source-data`).then(({ data }) => setSourceData(data)).catch(() => {});
  }, [isOpen, activeSlideId, presentationId, currentStep]);

  // Tab definitions per step
  const tabs = getTabs(currentStep, t);

  // Collapsed state
  if (!isOpen) {
    return (
      <button onClick={onToggle} className="flex w-8 shrink-0 flex-col items-center justify-center border-s border-gray-200 bg-gray-100 transition-colors hover:bg-gray-200">
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        <span className="mt-2 text-[10px] font-medium tracking-wider text-gray-400" style={{ writingMode: "vertical-rl" }}>{t("agentContext")}</span>
      </button>
    );
  }

  const activeSlide = slides.find((s) => s.slide_id === activeSlideId);

  return (
    <div className="flex w-[380px] shrink-0 flex-col border-s border-gray-200 bg-gray-50/80 backdrop-blur-sm animate-slide-in">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{t("agentContext")}</span>
        <button onClick={onToggle} className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="sticky top-0 z-10 flex shrink-0 border-b border-gray-200 bg-gray-50">
          {tabs.map((tb, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${i === tab ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
              {tb.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!loaded ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
          </div>
        ) : (
          <>
            {/* Step 1 — Tips */}
            {currentStep === 1 && (
              <div>
                <MicroLabel>{t("tipsTitle")}</MicroLabel>
                <ul className="space-y-2">
                  {[t("tipGoal"), t("tipData"), t("tipMetrics"), t("tipPeriod"), t("tipComparisons")].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-400" />{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Intake Brief tab */}
            {tabs[tab]?.id === "intake" && input && (
              <div>
                <MicroLabel>{t("userPrompt")}</MicroLabel>
                <div className="max-h-[200px] overflow-y-auto rounded-lg border bg-white p-3 text-sm text-gray-700">{input.prompt || t("noPrompt")}</div>

                <MicroLabel>{t("uploadedData")}</MicroLabel>
                {input.raw_data_json?.files?.map((f: any, i: number) => (
                  <div key={i} className="mb-2 rounded-lg border bg-white p-2.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-800">{f.filename}</div>
                    {f.type === "tabular" && (
                      <div className="mt-1.5">
                        <div className="mb-1 flex flex-wrap gap-1">
                          {(f.columns || (f.sheets?.[0]?.columns) || []).map((c: string, ci: number) => <Chip key={ci} active>{c}</Chip>)}
                        </div>
                        <p className="text-[10px] text-gray-400">{f.row_count || f.sheets?.[0]?.row_count || 0} rows</p>
                        {(f.sample_rows || f.sheets?.[0]?.sample_rows || []).length > 0 && (
                          <div className="mt-1.5">
                            <MiniTable columns={f.columns || f.sheets?.[0]?.columns || []} rows={(f.sample_rows || f.sheets?.[0]?.sample_rows || []).slice(0, 5).map((r: any) => Object.values(r))} />
                          </div>
                        )}
                      </div>
                    )}
                    {f.type === "text" && <p className="mt-1 text-[10px] text-gray-500">{f.char_count || 0} characters</p>}
                  </div>
                ))}

                <MicroLabel>{t("configuration")}</MicroLabel>
                <div className="flex flex-wrap gap-1.5">
                  <Chip>{t(input.audience || "") || input.audience || t("general")}</Chip>
                  <Chip>{t(input.tone || "") || input.tone || t("professional")}</Chip>
                  <Chip>{t(input.language || "") || input.language || t("english")}</Chip>
                  <Chip>{input.slide_count} {t("slides")}</Chip>
                </div>
              </div>
            )}

            {/* Plan Structure tab */}
            {tabs[tab]?.id === "plan" && plan && (
              <div>
                <MicroLabel>{t("planOutline")}</MicroLabel>
                {plan.plan_json.sections?.map((sec: any, si: number) => (
                  <div key={si} className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-semibold text-gray-900">{sec.section_title}</span>
                      <Chip>{sec.slides?.length || 0}</Chip>
                    </div>
                    {sec.section_purpose && <p className="text-[10px] italic text-gray-400 mb-1">{sec.section_purpose}</p>}
                    {sec.slides?.map((sl: any, sli: number) => (
                      <div key={sli}
                        className={`flex items-center gap-2 rounded px-2 py-1 transition-colors duration-200 ${
                          sl.slide_id === activeSlideId ? "border-l-2 border-blue-500 bg-blue-50" : "hover:bg-gray-100"
                        }`}>
                        <span className="text-[10px] text-gray-400 w-4 shrink-0">{sli + 1}</span>
                        <span className="text-xs text-gray-700 truncate flex-1">{sl.slide_title}</span>
                        <span className="text-[9px] rounded bg-gray-100 px-1 py-0.5 text-gray-500">{sl.slide_type}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <p className="mt-3 text-[10px] text-gray-400">{t("planVersion")}{plan.version}</p>
              </div>
            )}

            {/* Source Data tab */}
            {tabs[tab]?.id === "source" && (
              <div>
                <MicroLabel>{t("sourceData")} {activeSlideId ? t("forActiveSlide") : ""}</MicroLabel>
                {sourceData?.files?.length ? (
                  sourceData.files.filter((f: any) => f.referenced).map((f: any, i: number) => (
                    <div key={i} className="mb-3 rounded-lg border bg-white p-2.5">
                      <p className="text-xs font-medium text-gray-800 mb-1">{f.filename}</p>
                      {f.type === "tabular" && f.columns && (
                        <>
                          <div className="mb-1 flex flex-wrap gap-1">
                            {f.columns.map((c: string, ci: number) => <Chip key={ci} active>{c}</Chip>)}
                          </div>
                          {f.sample_rows?.length > 0 && (
                            <MiniTable columns={f.columns} rows={f.sample_rows.map((r: any) => Object.values(r))} />
                          )}
                        </>
                      )}
                      {f.type === "text" && <p className="text-[10px] text-gray-500">{f.text_preview?.slice(0, 200)}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">{t("noDataReferenced")}</p>
                )}
              </div>
            )}

            {/* Slide Content tab (Step 4) */}
            {tabs[tab]?.id === "content" && activeSlide && (
              <div>
                <MicroLabel>{t("slideContent")}</MicroLabel>
                <p className="text-sm font-semibold text-gray-900 mb-2">{activeSlide.title}</p>
                {(activeSlide.content_json?.body?.content || []).map((b: any, i: number) => (
                  <p key={i} className="flex items-start gap-1.5 text-xs text-gray-700 mb-1">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300" />{typeof b === "string" ? b : String(b)}
                  </p>
                ))}
                {activeSlide.content_json?.key_takeaway && (
                  <div className="mt-2 rounded border-l-2 border-blue-400 bg-blue-50/30 p-2 text-xs font-medium text-gray-800">
                    {activeSlide.content_json.key_takeaway}
                  </div>
                )}
                {activeSlide.content_json?.speaker_notes && (
                  <p className="mt-2 text-[10px] italic text-gray-400">{activeSlide.content_json.speaker_notes}</p>
                )}
                <p className="mt-2 text-[10px] text-gray-400">
                  {(activeSlide.content_json?.body?.content || []).join(" ").split(/\s+/).length} {t("words")}
                </p>
              </div>
            )}

            {/* Summary tab (Step 5) */}
            {tabs[tab]?.id === "summary" && summary && (
              <div>
                <MicroLabel>{t("presentation")}</MicroLabel>
                <p className="text-sm font-semibold text-gray-900">{summary.title}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip>{t(summary.language || "") || summary.language}</Chip>
                  <Chip>{t(summary.tone || "") || summary.tone || t("professional")}</Chip>
                  <Chip>{t(summary.audience || "") || summary.audience || t("general")}</Chip>
                  {summary.llm_provider && <Chip>{summary.llm_provider}</Chip>}
                </div>
                <MicroLabel>{t("stats")}</MicroLabel>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white border p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{summary.slide_count}</p>
                    <p className="text-[10px] text-gray-400">{t("slides")}</p>
                  </div>
                  <div className="rounded-lg bg-white border p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{summary.total_words}</p>
                    <p className="text-[10px] text-gray-400">{t("words")}</p>
                  </div>
                  <div className="rounded-lg bg-white border p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">~{summary.estimated_minutes}m</p>
                    <p className="text-[10px] text-gray-400">{t("duration")}</p>
                  </div>
                </div>
                <MicroLabel>{t("slides")}</MicroLabel>
                <div className="space-y-1">
                  {summary.slides?.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-[10px] text-gray-400">{i + 1}</span>
                      <span className="flex-1 truncate text-gray-700">{s.title}</span>
                      <span className="text-[10px] text-gray-400">{s.word_count}w</span>
                    </div>
                  ))}
                </div>
                <MicroLabel>{t("sourceData")}</MicroLabel>
                <div className="flex flex-wrap gap-1.5">
                  {summary.data_sources?.map((f: string, i: number) => <Chip key={i}>{f}</Chip>)}
                  {(!summary.data_sources || summary.data_sources.length === 0) && <p className="text-[10px] text-gray-400">None</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getTabs(step: number, t: (k: string) => string): { id: string; label: string }[] {
  switch (step) {
    case 1: return [{ id: "tips", label: t("gettingStarted") }];
    case 2: return [{ id: "intake", label: t("setupBrief") }];
    case 3: return [{ id: "intake", label: t("setup") }, { id: "plan", label: t("plan") }, { id: "source", label: t("sourceData") }];
    case 4: return [{ id: "intake", label: t("setup") }, { id: "plan", label: t("plan") }, { id: "content", label: t("content") }];
    case 5: return [{ id: "summary", label: t("summaryTab") }];
    default: return [{ id: "intake", label: t("setup") }];
  }
}
