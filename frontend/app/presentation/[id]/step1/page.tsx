"use client";

import { ConfigPanel } from "@/components/steps/config-panel";
import { FilePreviewModal } from "@/components/steps/file-preview-modal";
import { FileUploadZone } from "@/components/steps/file-upload-zone";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { useEffect, useRef, useState } from "react";
import { usePresentation } from "../context";

interface UploadedFile {
  filename: string;
  size: number;
  type: string;
  parse_status: string;
  preview?: any;
  error?: string;
}

export default function Step1Page() {
  const { id } = useParams();
  const presId = id as string;
  const router = useRouter();
  const { pres, reload } = usePresentation();
  const { t, isRTL } = useLanguage();

  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [config, setConfig] = useState({
    audience: "", tone: "", language: "english", slideCount: 10,
    templateId: "", brandProfileId: "", llmProvider: "", llmModel: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [enhancing, setEnhancing] = useState<string | null>(null);
  const [prevPrompt, setPrevPrompt] = useState<string | null>(null);
  const [usedActions, setUsedActions] = useState<Set<string>>(new Set());
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    async function load() {
      // Only fetch input/files if presentation has progressed past draft
      const hasSavedInput = pres && pres.status !== "draft";
      if (hasSavedInput) {
        try {
          const { data } = await api.get(`/presentations/${presId}/input`);
          setPrompt(data.prompt || "");
          setConfig((c) => ({ ...c, audience: data.audience || "", tone: data.tone || "", language: data.language || "english", slideCount: data.slide_count || 10, brandProfileId: data.brand_profile_id || "" }));
        } catch { /* no input saved yet */ }
      }
      if (hasSavedInput) {
        try {
          const { data: fl } = await api.get(`/presentations/${presId}/files`);
          setFiles(fl.map((f: any) => ({ ...f, type: "uploaded", parse_status: "success" })));
        } catch { /* no files */ }
      }
      if (pres) setConfig((c) => ({ ...c, llmProvider: pres.llm_provider || c.llmProvider, language: pres.language || c.language }));
      setLoaded(true);
    }
    load();
  }, [presId, pres]);

  const canProceed = prompt.trim().length > 100 || (prompt.trim().length > 0 && files.length > 0);

  async function handleProceed() {
    setSaving(true);
    try {
      await api.post(`/presentations/${presId}/input`, {
        prompt: prompt.trim(), audience: config.audience || null, tone: config.tone || null,
        language: config.language, slide_count: config.slideCount,
        template_id: config.templateId || null, brand_profile_id: config.brandProfileId || null,
        llm_provider: config.llmProvider || null, llm_model: config.llmModel || null,
      });
      await reload();
      router.push(`/presentation/${presId}/step2`);
    } catch (err) { console.error(err); setSaving(false); }
  }

  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  async function handleEnhance(action: string) {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(action);
    setEnhanceError(null);
    try {
      const { data } = await api.post("/presentations/enhance-prompt", { prompt: prompt.trim(), action });
      if (data.enhanced_prompt) {
        setPrevPrompt(prompt);
        setPrompt(data.enhanced_prompt);
        setUsedActions((prev) => new Set(prev).add(action));
        clearTimeout(undoTimer.current);
        undoTimer.current = setTimeout(() => setPrevPrompt(null), 8000);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Enhancement failed";
      setEnhanceError(msg);
      setTimeout(() => setEnhanceError(null), 6000);
    }
    setEnhancing(null);
  }

  function handleUndo() {
    if (prevPrompt !== null) {
      setPrompt(prevPrompt);
      setPrevPrompt(null);
      clearTimeout(undoTimer.current);
    }
  }

  const ENHANCE_ACTIONS = [
    { key: "specific", emoji: "\u2728", label: t("makeSpecific") },
    { key: "data", emoji: "\uD83D\uDCCA", label: t("addDataFocus") },
    { key: "executive", emoji: "\uD83C\uDFAF", label: t("addExecutiveFraming") },
    { key: "structure", emoji: "\uD83D\uDCCB", label: t("addStructureHints") },
    { key: "simplify", emoji: "\uD83D\uDD04", label: t("simplify") },
  ];

  if (!loaded) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">{t("step")} 1</span>
          <svg className={`h-4 w-4 text-gray-300 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-500">{t("step1Title")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#00338D] to-[#0055B8] text-[10px] font-bold text-white shadow-sm">SA</div>
          <div>
            <p className="text-xs font-semibold text-gray-700">{t("intakeAgent")}</p>
            <p className="text-[10px] italic text-gray-400">&ldquo;{t("intakeAgentDesc")}&rdquo;</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl gap-8 p-8 animate-fade-in">
          {/* Left: Prompt + Files */}
          <div className="flex-[3] space-y-8">
            {/* Prompt */}
            <section>
              <h3 className="mb-3 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-900 text-start">
                {t("describePresentation")}
              </h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="min-h-[200px] w-full resize-y rounded-xl border border-gray-300 bg-gray-50 px-5 py-4 text-sm leading-relaxed text-gray-900 transition-all duration-200 placeholder:italic placeholder:text-gray-400 focus:border-[#0091DA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0091DA]/20"
                placeholder={t("promptPlaceholder")}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-400">{prompt.length} {t("characters")}</span>
                {prompt.length > 0 && prompt.length < 100 && files.length === 0 && (
                  <span className="text-amber-500 animate-fade-in">{t("addMoreDetail")}</span>
                )}
              </div>

              {/* Enhance prompt actions */}
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{t("enhancePrompt")}</span>
                  {prevPrompt !== null && (
                    <button onClick={handleUndo} className="flex items-center gap-1 text-xs text-[#0091DA] transition-colors hover:text-[#00338D] animate-fade-in">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" /></svg>
                      Undo
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ENHANCE_ACTIONS.map((a) => {
                    const used = usedActions.has(a.key);
                    return (
                      <button
                        key={a.key}
                        onClick={() => handleEnhance(a.key)}
                        disabled={!prompt.trim() || enhancing !== null}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          enhancing === a.key
                            ? "border-[#0091DA] bg-[#0091DA]/10 text-[#0091DA]"
                            : used
                              ? "border-[#00338D]/30 bg-[#00338D]/5 text-[#00338D] ring-1 ring-[#00338D]/10"
                              : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        {enhancing === a.key ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-[#0091DA]" />
                        ) : used ? (
                          <svg className="h-3 w-3 text-[#00338D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <span>{a.emoji}</span>
                        )}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
                {enhanceError && (
                  <p className="mt-2 text-xs text-red-500 animate-fade-in">{enhanceError}</p>
                )}
              </div>
            </section>

            {/* Files */}
            <section>
              <h3 className="mb-3 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-900 text-start">
                {t("dataFiles")}
              </h3>
              <FileUploadZone presentationId={presId} files={files} onFilesChange={setFiles} onPreview={setPreviewFile} />
            </section>
          </div>

          {/* Right: Config */}
          <div className="flex-[2]">
            <div className="card sticky top-8 p-6">
              <h3 className="mb-5 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-900 text-start">
                {t("configuration")}
              </h3>
              <ConfigPanel config={config} onChange={setConfig} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-8 py-4 shadow-[0_-4px_12px_rgb(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-xs text-gray-400">
            {files.length} {files.length !== 1 ? t("files") : t("file")} uploaded
            {config.audience && <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-gray-500">{config.audience}</span>}
          </p>
          <button onClick={handleProceed} disabled={!canProceed || saving} className="btn-primary h-11 px-8">
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                {t("proceedToPlanning")}
                <svg className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </>
            )}
          </button>
        </div>
      </div>

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
