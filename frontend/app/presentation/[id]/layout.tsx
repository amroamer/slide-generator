"use client";

import { ContextPanel } from "@/components/context-panel/context-panel";
import { ProtectedRoute } from "@/components/ui/protected-route";
import api from "@/lib/api";
import { ActiveSlideProvider } from "@/lib/active-slide-context";
import { useLanguage } from "@/lib/language-context";
import { PipelineProvider, usePipeline } from "@/lib/pipeline-context";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PresentationContext } from "./context";

interface Presentation {
  id: string;
  title: string;
  status: string;
  current_step: number;
  llm_provider: string | null;
  llm_model: string | null;
  language: string;
  audience: string | null;
  tone: string | null;
  slide_count: number;
}

const STEPS = [
  { num: 1, nameKey: "input", agentKey: "intakeAgent", path: "step1" },
  { num: 2, nameKey: "plan", agentKey: "plannerAgent", path: "step2" },
  { num: 3, nameKey: "content", agentKey: "writerAgent", path: "step3" },
  { num: 4, nameKey: "design", agentKey: "designerAgent", path: "step4" },
  { num: 5, nameKey: "export", agentKey: "exportAgent", path: "step5" },
];

const LLM_BADGE: Record<string, { label: string; cls: string }> = {
  ollama: { label: "Local", cls: "bg-orange-100 text-orange-700 border-orange-200" },
};

export default function PresentationLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/presentations/${id}`);
      setPres(data);
    } catch { setPres(null); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveTitle() {
    if (!pres || !titleRef.current) return;
    const val = titleRef.current.value.trim();
    if (val && val !== pres.title) {
      await api.put(`/presentations/${id}`, { title: val });
      setPres({ ...pres, title: val });
    }
    setEditingTitle(false);
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      await api.delete(`/presentations/${id}`);
      router.push("/dashboard");
    } catch {
      setDiscarding(false);
      setShowDiscard(false);
    }
  }

  const activeStep = STEPS.find((s) => pathname?.includes(s.path))?.num ?? pres?.current_step ?? 1;

  if (loading) return (
    <ProtectedRoute>
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
      </div>
    </ProtectedRoute>
  );

  if (!pres) return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 animate-fade-in">
        <p className="text-lg font-medium text-gray-600">{t("presentationNotFound")}</p>
        <Link href="/dashboard" className="btn-secondary">{t("backToDashboard")}</Link>
      </div>
    </ProtectedRoute>
  );

  const llm = pres.llm_provider ? LLM_BADGE[pres.llm_provider] : null;

  return (
    <ProtectedRoute>
      <PresentationContext.Provider value={{ pres, reload: load }}>
        <PipelineProvider presentationId={id as string}>
        <ActiveSlideProvider>
        <div className="flex h-screen overflow-hidden">
          {/* Dark sidebar */}
          <aside className="flex w-[260px] shrink-0 flex-col bg-[#0F172A]">
            {/* Sidebar header */}
            <div className="border-b border-white/10 px-5 py-4">
              {editingTitle ? (
                <input
                  ref={titleRef}
                  defaultValue={pres.title}
                  autoFocus
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white outline-none focus:border-[#0091DA]"
                />
              ) : (
                <p
                  onClick={() => setEditingTitle(true)}
                  className="cursor-pointer truncate text-sm font-semibold text-white transition-colors hover:text-[#0091DA]"
                  title={t("clickToEditTitle")}
                >
                  {pres.title}
                </p>
              )}
              {llm && (
                <span className={`mt-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${llm.cls}`}>
                  {llm.label}
                </span>
              )}
            </div>

            {/* Steps — uses pipeline context for stale indicators */}
            <SidebarSteps presId={id as string} activeStep={activeStep} presCurrentStep={pres.current_step} />

            {/* Bottom links */}
            <div className="border-t border-white/10 px-5 py-3 space-y-2">
              <Link href="/guide"
                className="flex items-center gap-2 text-[11px] text-gray-500 transition-colors hover:text-gray-300">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                {t("guide")}
              </Link>
              <LanguageToggle />
              <button
                onClick={() => setShowDiscard(true)}
                className="flex items-center gap-2 text-[11px] text-gray-600 transition-colors hover:text-red-400"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                {t("discardPresentation")}
              </button>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm text-gray-400 transition-colors duration-200 hover:text-white"
              >
                <svg className="h-4 w-4 rtl:flip" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t("backToDashboard")}
              </Link>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex flex-1 flex-col overflow-hidden bg-white">
            {children}
          </main>

          {/* Context panel */}
          <ContextPanel
            currentStep={activeStep}
            presentationId={id as string}
            isOpen={contextOpen}
            onToggle={() => setContextOpen(!contextOpen)}
          />
        </div>

        {/* Discard confirmation dialog */}
        {showDiscard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => !discarding && setShowDiscard(false)}>
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="mb-2 text-center text-lg font-semibold text-gray-900">{t("discardTitle")}</h3>
              <p className="mb-6 text-center text-sm text-gray-500">{t("discardMessage")}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDiscard(false)} disabled={discarding} className="btn-secondary flex-1">
                  {t("keepWorking")}
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={discarding}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {discarding ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>{t("discard")}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        </ActiveSlideProvider>
        </PipelineProvider>
      </PresentationContext.Provider>
    </ProtectedRoute>
  );
}

const STEP_PIPELINE_KEYS: Record<number, string> = { 1: "input", 2: "plan", 3: "content", 4: "design", 5: "export" };

function SidebarSteps({ presId, activeStep, presCurrentStep }: { presId: string; activeStep: number; presCurrentStep: number }) {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { steps, loaded, refreshPipeline } = usePipeline();

  useEffect(() => { refreshPipeline(); }, [refreshPipeline]);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {STEPS.map((step, i) => {
        const isActive = step.num === activeStep;
        const pipelineKey = STEP_PIPELINE_KEYS[step.num] as keyof typeof steps;
        const stepState = loaded ? steps[pipelineKey] : null;
        const isStale = stepState?.status === "stale";
        const pipelineDone = stepState?.status === "completed" || stepState?.status === "stale";
        const isComplete = loaded ? pipelineDone : step.num < presCurrentStep;
        const isClickable = loaded
          ? (pipelineDone || (step.num === 1) || steps[STEP_PIPELINE_KEYS[step.num - 1] as keyof typeof steps]?.status !== "not_started")
          : step.num <= presCurrentStep;

        return (
          <div key={step.num}>
            <button
              disabled={!isClickable}
              onClick={() => router.push(`/presentation/${presId}/${step.path}`)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start transition-all duration-200 ${
                isActive ? "bg-white/10" : isClickable ? "hover:bg-white/5" : "cursor-default opacity-40"
              }`}
            >
              {isActive && <div className="absolute inset-inline-start-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-ee-full rounded-se-full bg-[#0091DA]" />}

              {/* Circle */}
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                isStale
                  ? "border-2 border-amber-400 text-amber-400 animate-pulse"
                  : isComplete
                    ? "bg-[#00338D] text-white"
                    : isActive
                      ? "border-2 border-[#0091DA] bg-[#0091DA] text-white"
                      : "border-2 border-gray-600 text-gray-500"
              }`}>
                {isStale ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : isComplete ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.num}
              </div>

              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${
                  isStale ? "text-amber-400" : isActive ? "text-white" : isComplete ? "text-gray-300" : "text-gray-500"
                }`}>{t(step.nameKey)}</p>
                {isStale && stepState?.staleReason ? (
                  <p className="mt-0.5 truncate text-[9px] text-amber-500/70">{stepState.staleReason}</p>
                ) : (
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">{t(step.agentKey)}</p>
                )}
              </div>
            </button>

            {i < STEPS.length - 1 && <div className="ms-[22px] h-3 w-px bg-gray-700" />}
          </div>
        );
      })}
    </nav>
  );
}

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <button onClick={() => setLanguage(language === "en" ? "ar" : "en")}
      className="flex items-center gap-2 text-[11px] text-gray-500 transition-colors hover:text-gray-300">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
      {language === "en" ? "عربي" : "English"}
    </button>
  );
}
