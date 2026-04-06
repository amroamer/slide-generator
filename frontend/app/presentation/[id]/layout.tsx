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
  { num: 1, name: "Input", agent: "Intake Agent", path: "step1" },
  { num: 2, name: "Plan", agent: "Planner Agent", path: "step2" },
  { num: 3, name: "Content", agent: "Writer Agent", path: "step3" },
  { num: 4, name: "Design", agent: "Designer Agent", path: "step4" },
  { num: 5, name: "Export", agent: "Export Agent", path: "step5" },
];

const LLM_BADGE: Record<string, { label: string; cls: string }> = {
  claude: { label: "Claude", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  openai: { label: "GPT", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ollama: { label: "Local", cls: "bg-orange-100 text-orange-700 border-orange-200" },
};

export default function PresentationLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
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
    const t = titleRef.current.value.trim();
    if (t && t !== pres.title) {
      await api.put(`/presentations/${id}`, { title: t });
      setPres({ ...pres, title: t });
    }
    setEditingTitle(false);
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
        <p className="text-lg font-medium text-gray-600">Presentation not found</p>
        <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
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
                  title="Click to edit title"
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
                Guide
              </Link>
              <LanguageToggle />
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm text-gray-400 transition-colors duration-200 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
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
        </ActiveSlideProvider>
        </PipelineProvider>
      </PresentationContext.Provider>
    </ProtectedRoute>
  );
}

const STEP_PIPELINE_KEYS: Record<number, string> = { 1: "input", 2: "plan", 3: "content", 4: "design", 5: "export" };

function SidebarSteps({ presId, activeStep, presCurrentStep }: { presId: string; activeStep: number; presCurrentStep: number }) {
  const router = useRouter();
  const { steps, loaded, refreshPipeline } = usePipeline();

  useEffect(() => { refreshPipeline(); }, [refreshPipeline]);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {STEPS.map((step, i) => {
        const isActive = step.num === activeStep;
        const pipelineKey = STEP_PIPELINE_KEYS[step.num] as keyof typeof steps;
        const stepState = loaded ? steps[pipelineKey] : null;
        const isStale = stepState?.status === "stale";
        // Use pipeline status for completion: "completed" or "stale" both mean the step has been done
        const pipelineDone = stepState?.status === "completed" || stepState?.status === "stale";
        // Fallback to presCurrentStep if pipeline not loaded yet
        const isComplete = loaded ? pipelineDone : step.num < presCurrentStep;
        // Clickable if this step or any previous step is done, or it's the next step to do
        const isClickable = loaded
          ? (pipelineDone || (step.num === 1) || steps[STEP_PIPELINE_KEYS[step.num - 1] as keyof typeof steps]?.status !== "not_started")
          : step.num <= presCurrentStep;

        return (
          <div key={step.num}>
            <button
              disabled={!isClickable}
              onClick={() => router.push(`/presentation/${presId}/${step.path}`)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-200 ${
                isActive ? "bg-white/10" : isClickable ? "hover:bg-white/5" : "cursor-default opacity-40"
              }`}
            >
              {isActive && <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#0091DA]" />}

              {/* Circle — 3 states: complete (green/blue), stale (amber), default */}
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
                }`}>{step.name}</p>
                {isStale && stepState?.staleReason ? (
                  <p className="mt-0.5 truncate text-[9px] text-amber-500/70">{stepState.staleReason}</p>
                ) : (
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">{step.agent}</p>
                )}
              </div>
            </button>

            {i < STEPS.length - 1 && <div className="ml-[22px] h-3 w-px bg-gray-700" />}
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
