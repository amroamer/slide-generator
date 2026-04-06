"use client";

import api from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PromptConfig {
  id: string;
  prompt_key: string;
  prompt_text: string;
  category: string;
  pipeline_stage: string;
  variables: Record<string, string> | null;
  is_active: boolean;
  is_system: boolean;
  is_overridden: boolean;
  seed_version: number | null;
  display_name: string;
  description: string | null;
  icon_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DraftEdits {
  display_name?: string;
  description?: string;
  prompt_text?: string;
  is_active?: boolean;
  icon_name?: string;
}

interface NewPromptForm {
  display_name: string;
  prompt_key: string;
  category: string;
  pipeline_stage: string;
  description: string;
  prompt_text: string;
  icon_name: string;
  variables: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PIPELINE_SECTIONS: { key: string; label: string; stages: string[] }[] = [
  { key: "step2", label: "Step 2 \u2014 Planner Agent", stages: ["step2_plan"] },
  { key: "step3", label: "Step 3 \u2014 Writer Agent", stages: ["step3_content"] },
  { key: "step4", label: "Step 4 \u2014 Designer Agent", stages: ["step4_design"] },
  { key: "step5", label: "Step 5 \u2014 Export Agent", stages: ["step5_export"] },
  { key: "global", label: "Global / Shared", stages: ["global", "step1_input"] },
];

const KNOWN_STAGES = new Set(["step2_plan", "step3_content", "step4_design", "step5_export", "global", "step1_input"]);

const CATEGORY_COLORS: Record<string, string> = {
  planner: "bg-purple-100 text-purple-700",
  writer: "bg-blue-100 text-blue-700",
  designer: "bg-emerald-100 text-emerald-700",
  system: "bg-gray-100 text-gray-600",
  "quick_action.planner": "bg-amber-100 text-amber-700",
  "quick_action.writer": "bg-amber-100 text-amber-700",
};

const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  audience: "Target audience",
  tone: "Presentation tone",
  language: "Output language",
  slide_count: "Number of slides",
  slide_title: "Current slide title",
  data_context: "Parsed data from uploaded files",
};

const STAGE_OPTIONS = [
  { value: "step1_input", label: "Step 1 \u2014 Input" },
  { value: "step2_plan", label: "Step 2 \u2014 Plan" },
  { value: "step3_content", label: "Step 3 \u2014 Content" },
  { value: "step4_design", label: "Step 4 \u2014 Design" },
  { value: "step5_export", label: "Step 5 \u2014 Export" },
  { value: "global", label: "Global" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractVariables(text: string): string[] {
  const matches = text.match(/\{(\w+)\}/g);
  return matches ? Array.from(new Set(matches.map((m) => m.slice(1, -1)))) : [];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/* ------------------------------------------------------------------ */
/*  Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SpinnerSmall() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PromptsPage() {
  /* --- State --- */
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["step2", "step3", "step4", "step5", "global"]));
  const [draft, setDraft] = useState<DraftEdits>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "importing">("upload");
  const [importParsing, setImportParsing] = useState(false);
  const [importPreview, setImportPreview] = useState<{ summary: any; rows: any[] } | null>(null);
  const [importChecked, setImportChecked] = useState<Set<number>>(new Set());
  const [importApplying, setImportApplying] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  /* --- Fetch prompts --- */
  const fetchPrompts = useCallback(async () => {
    try {
      const { data } = await api.get("/prompts");
      setPrompts(data);
    } catch (err) {
      console.error("Failed to fetch prompts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  /* --- Derived --- */
  const selected = useMemo(
    () => prompts.find((p) => p.prompt_key === selectedKey) ?? null,
    [prompts, selectedKey],
  );

  const sectionPrompts = useMemo(() => {
    const map: Record<string, PromptConfig[]> = {};
    for (const sec of PIPELINE_SECTIONS) {
      map[sec.key] = [];
    }
    for (const p of prompts) {
      let placed = false;
      for (const sec of PIPELINE_SECTIONS) {
        if (sec.stages.includes(p.pipeline_stage)) {
          map[sec.key].push(p);
          placed = true;
          break;
        }
      }
      if (!placed && !KNOWN_STAGES.has(p.pipeline_stage)) {
        map["global"].push(p);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [prompts]);

  /* --- Select prompt --- */
  function selectPrompt(key: string) {
    if (key === selectedKey) return;
    setSelectedKey(key);
    setDraft({});
    setEditingName(false);
    setSavedFlash(false);
  }

  /* --- Toggle section --- */
  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /* --- Draft helpers --- */
  function hasDraftChanges(): boolean {
    if (!selected) return false;
    if (draft.display_name !== undefined && draft.display_name !== selected.display_name) return true;
    if (draft.description !== undefined && draft.description !== (selected.description ?? "")) return true;
    if (draft.prompt_text !== undefined && draft.prompt_text !== selected.prompt_text) return true;
    if (draft.is_active !== undefined && draft.is_active !== selected.is_active) return true;
    return false;
  }

  const currentText = draft.prompt_text ?? selected?.prompt_text ?? "";
  const currentName = draft.display_name ?? selected?.display_name ?? "";
  const currentDesc = draft.description ?? selected?.description ?? "";
  const currentActive = draft.is_active ?? selected?.is_active ?? true;
  const variables = extractVariables(currentText);
  const hasChanges = hasDraftChanges();

  /* --- Save --- */
  async function handleSave() {
    if (!selected || !hasChanges) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (draft.prompt_text !== undefined) body.prompt_text = draft.prompt_text;
      if (draft.display_name !== undefined) body.display_name = draft.display_name;
      if (draft.description !== undefined) body.description = draft.description;
      if (draft.is_active !== undefined) body.is_active = draft.is_active;
      const { data } = await api.put(`/prompts/${selected.prompt_key}`, body);
      setPrompts((prev) => prev.map((p) => (p.prompt_key === selected.prompt_key ? { ...p, ...data } : p)));
      setDraft({});
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  /* --- Revert --- */
  async function handleRevert() {
    if (!selected) return;
    try {
      await api.post(`/prompts/by-id/${selected.id}/revert`);
      await fetchPrompts();
      setDraft({});
    } catch (err) {
      console.error("Revert failed:", err);
    }
  }

  /* --- Duplicate --- */
  async function handleDuplicate() {
    if (!selected) return;
    try {
      const { data } = await api.post(`/prompts/by-id/${selected.id}/duplicate`);
      await fetchPrompts();
      setSelectedKey(data.prompt_key);
      setDraft({});
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  }

  /* --- Delete --- */
  async function handleDelete() {
    if (!selected || selected.is_system) return;
    if (!confirm(`Delete prompt "${selected.display_name}"?`)) return;
    try {
      await api.delete(`/prompts/${selected.prompt_key}`);
      setSelectedKey(null);
      setDraft({});
      await fetchPrompts();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  /* --- Export --- */
  async function handleExport() {
    try {
      const { data } = await api.get("/prompts/export/xlsx", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prompts_export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }

  function openImportModal() {
    setShowImportModal(true);
    setImportStep("upload");
    setImportPreview(null);
    setImportChecked(new Set());
    setImportResult(null);
  }

  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportFile(file: File) {
    setImportParsing(true);
    setImportError(null);
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setImportError("Only Excel files (.xlsx) are accepted");
      setImportParsing(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError("File too large. Maximum size is 5 MB");
      setImportParsing(false);
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/prompts/import/preview", fd);
      setImportPreview(data);
      const checked = new Set<number>();
      data.rows.forEach((r: any, i: number) => { if (r.action !== "error" && r.action !== "skip") checked.add(i); });
      setImportChecked(checked);
      setImportStep("preview");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to parse the Excel file";
      setImportError(msg);
    } finally {
      setImportParsing(false);
    }
  }

  async function handleImportApply() {
    if (!importPreview) return;
    setImportApplying(true);
    try {
      const selectedRows = importPreview.rows.filter((_: any, i: number) => importChecked.has(i)).map((r: any) => r.data);
      const { data } = await api.post("/prompts/import/apply", { rows: selectedRows });
      setImportResult(data);
      setImportStep("importing");
      await fetchPrompts();
    } catch (err) {
      console.error("Import apply failed:", err);
    } finally {
      setImportApplying(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const { data } = await api.get("/prompts/import/template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "Prompt_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  }

  /* --- Toggle active --- */
  function toggleActive() {
    setDraft((prev) => ({ ...prev, is_active: !currentActive }));
  }

  /* --- Line numbers for textarea --- */
  const lineCount = currentText.split("\n").length;

  /* --- Loading state --- */
  if (loading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* ============================================================ */}
      {/*  LEFT PANEL                                                   */}
      {/* ============================================================ */}
      <div className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50/50">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Prompt Library</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">{prompts.length} prompts configured</p>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {PIPELINE_SECTIONS.map((sec) => {
            const items = sectionPrompts[sec.key] || [];
            const isOpen = expandedSections.has(sec.key);

            return (
              <div key={sec.key} className="mb-1">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(sec.key)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-100 transition-colors"
                >
                  <ChevronIcon open={isOpen} />
                  <span className="flex-1 text-xs font-semibold text-gray-700">{sec.label}</span>
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200 px-1.5 text-[10px] font-medium text-gray-600">
                    {items.length}
                  </span>
                </button>

                {/* Prompt items */}
                {isOpen && items.length > 0 && (
                  <div className="ml-2 space-y-0.5 pb-1">
                    {items.map((p) => {
                      const isSelected = selectedKey === p.prompt_key;
                      return (
                        <button
                          key={p.prompt_key}
                          onClick={() => selectPrompt(p.prompt_key)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                            isSelected
                              ? "border-l-2 border-blue-500 bg-blue-50"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              p.is_active ? "bg-green-400" : "bg-gray-300"
                            }`}
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-800">
                            {p.display_name}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                              CATEGORY_COLORS[p.category] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {p.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom buttons */}
        <div className="border-t border-gray-200 p-3 flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#00338D] px-3 py-2 text-xs font-medium text-white hover:bg-[#002266] transition-colors"
          >
            <PlusIcon />
            Add Prompt
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <DownloadIcon />
            Export
          </button>
          <button
            onClick={openImportModal}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL                                                  */}
      {/* ============================================================ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center text-gray-400">
            <svg className="mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm font-medium">Select a prompt from the left panel to edit</p>
          </div>
        ) : (
          <>
            {/* ------- Editor Header ------- */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                {/* Editable display name */}
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    value={currentName}
                    onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                    }}
                    className="text-lg font-semibold text-gray-900 outline-none border-b-2 border-blue-400 bg-transparent"
                    autoFocus
                  />
                ) : (
                  <h3
                    className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => {
                      setEditingName(true);
                      setTimeout(() => nameInputRef.current?.focus(), 0);
                    }}
                    title="Click to edit name"
                  >
                    {currentName}
                  </h3>
                )}

                {/* Category badge */}
                <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[selected.category] || "bg-gray-100 text-gray-600"}`}>
                  {selected.category}
                </span>

                {/* Active toggle */}
                <button
                  onClick={toggleActive}
                  className={`relative ml-auto inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    currentActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                  title={currentActive ? "Active" : "Inactive"}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    currentActive ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
                <span className="text-[11px] text-gray-500">{currentActive ? "Active" : "Inactive"}</span>
              </div>

              {/* Prompt key + last modified */}
              <div className="mt-2 flex items-center gap-3">
                <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-600">{selected.prompt_key}</code>
                <span className="text-[11px] text-gray-400">Last modified {formatDate(selected.updated_at)}</span>
                {selected.is_overridden && (
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">Overridden</span>
                )}
                {selected.is_system && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">System</span>
                )}
              </div>
            </div>

            {/* ------- Scrollable Content ------- */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Description */}
              <div className="mb-5">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Description
                </label>
                <textarea
                  value={currentDesc}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 resize-none"
                  placeholder="Brief description of this prompt..."
                />
              </div>

              {/* Dark editor */}
              <div className="mb-4">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Prompt Text
                </label>
                <div className="relative overflow-hidden rounded-xl bg-gray-900">
                  <div className="flex">
                    {/* Line numbers */}
                    <div className="select-none border-r border-gray-700/50 bg-gray-900 py-5 pl-3 pr-2 text-right">
                      {Array.from({ length: lineCount }, (_, i) => (
                        <div key={i} className="font-mono text-xs leading-relaxed text-gray-600">
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    {/* Textarea */}
                    <textarea
                      ref={textareaRef}
                      value={currentText}
                      onChange={(e) => setDraft((d) => ({ ...d, prompt_text: e.target.value }))}
                      className="min-h-[400px] flex-1 resize-y bg-transparent p-5 font-mono text-sm leading-relaxed text-gray-100 outline-none placeholder-gray-600"
                      spellCheck={false}
                      placeholder="Enter your prompt text here..."
                    />
                  </div>

                  {/* Word / char count bar */}
                  <div className="flex items-center justify-end gap-4 border-t border-gray-700/50 px-4 py-1.5">
                    <span className="text-[10px] text-gray-500">{countWords(currentText)} words</span>
                    <span className="text-[10px] text-gray-500">{currentText.length} chars</span>
                  </div>
                </div>
              </div>

              {/* Variables section */}
              {variables.length > 0 && (
                <div className="mb-4">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Variables ({variables.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {variables.map((v) => (
                      <div
                        key={v}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5"
                      >
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-blue-500">
                          {`{${v}}`}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {VARIABLE_DESCRIPTIONS[v] || "Custom variable"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ------- Sticky Action Bar ------- */}
            <div className="sticky bottom-0 flex items-center gap-2 border-t border-gray-200 bg-white px-6 py-3">
              {/* Revert (only if overridden) */}
              {selected.is_overridden && (
                <button
                  onClick={handleRevert}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
                  </svg>
                  Revert
                </button>
              )}

              {/* Duplicate */}
              <button
                onClick={handleDuplicate}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                </svg>
                Duplicate
              </button>

              {/* Delete (only user prompts, not system) */}
              {!selected.is_system && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-medium text-white transition-colors ${
                  savedFlash
                    ? "bg-green-500"
                    : hasChanges
                    ? "bg-[#00338D] hover:bg-[#002266]"
                    : "cursor-not-allowed bg-gray-300"
                }`}
              >
                {saving ? (
                  <SpinnerSmall />
                ) : savedFlash ? (
                  <>
                    <CheckIcon />
                    Saved
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/*  ADD PROMPT MODAL                                             */}
      {/* ============================================================ */}
      {showAddModal && <AddPromptModal onClose={() => setShowAddModal(false)} onCreated={async (newPrompt) => {
        await fetchPrompts();
        setSelectedKey(newPrompt.prompt_key);
        setDraft({});
        setShowAddModal(false);
      }} />}

    {/* Import Modal */}
    {showImportModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="relative w-full max-w-2xl mx-4 rounded-xl bg-white shadow-2xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Import Prompts from Excel</h3>
            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {importStep === "upload" && (
              <div className="space-y-4">
                <div onClick={() => importFileRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60 py-12 hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                  {importParsing ? (<><SpinnerSmall /><span className="text-sm text-gray-500">Parsing...</span></>) : (
                    <><svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-sm text-gray-600">Click to upload .xlsx file</span><span className="text-xs text-gray-400">Max 5 MB</span></>
                  )}
                </div>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
                {importError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
                    <svg className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0L21.303 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    <span>{importError}</span>
                  </div>
                )}
                <button onClick={handleDownloadTemplate} className="text-xs text-blue-600 hover:underline">Download blank template</button>
              </div>
            )}
            {importStep === "preview" && importPreview && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 flex-wrap">
                  <span className="text-sm font-medium text-gray-700">{importPreview.summary.total} prompts:</span>
                  {importPreview.summary.create > 0 && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{importPreview.summary.create} new</span>}
                  {importPreview.summary.update > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{importPreview.summary.update} updates</span>}
                  {importPreview.summary.skip > 0 && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{importPreview.summary.skip} unchanged</span>}
                  {importPreview.summary.error > 0 && <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{importPreview.summary.error} errors</span>}
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-gray-50">
                      <th className="w-8 px-3 py-2"><input type="checkbox" checked={importChecked.size > 0} onChange={(e) => { if (e.target.checked) { const a = new Set<number>(); importPreview.rows.forEach((r: any, i: number) => { if (r.action !== "error" && r.action !== "skip") a.add(i); }); setImportChecked(a); } else setImportChecked(new Set()); }} className="rounded" /></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Key</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Action</th>
                    </tr></thead>
                    <tbody>{importPreview.rows.map((row: any, i: number) => (
                      <tr key={i} className={"border-b " + (row.action === "error" ? "bg-rose-50/50" : "")}>
                        <td className="px-3 py-2"><input type="checkbox" disabled={row.action === "error" || row.action === "skip"} checked={importChecked.has(i)} onChange={() => { const n = new Set(importChecked); n.has(i) ? n.delete(i) : n.add(i); setImportChecked(n); }} className="rounded" /></td>
                        <td className="px-3 py-2 font-mono text-[11px] text-gray-700">{row.prompt_key}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.display_name}</td>
                        <td className="px-3 py-2">
                          <span className={"rounded px-2 py-0.5 text-[10px] font-semibold uppercase " + (row.action === "create" ? "bg-emerald-100 text-emerald-700" : row.action === "update" ? "bg-amber-100 text-amber-700" : row.action === "skip" ? "bg-gray-100 text-gray-500" : "bg-rose-100 text-rose-700")}>{row.action}</span>
                          {row.errors?.length > 0 && row.errors.map((e: string, ei: number) => (
                            <div key={ei} className="mt-0.5 flex items-center gap-1 text-[10px] text-rose-600">
                              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
                              {e}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            {importStep === "importing" && importResult && (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-lg font-semibold text-gray-900">Import Complete</p>
                <p className="text-sm text-gray-500">{importResult.created} created, {importResult.updated} updated</p>
                <button onClick={() => setShowImportModal(false)} className="mt-4 rounded-lg bg-[#00338D] px-5 py-2 text-sm font-medium text-white hover:bg-[#002266]">Done</button>
              </div>
            )}
          </div>
          {importStep === "preview" && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <button onClick={() => { setImportStep("upload"); setImportPreview(null); }} className="text-sm text-gray-500 hover:text-gray-700">Back</button>
              <button onClick={handleImportApply} disabled={importApplying || importChecked.size === 0} className="rounded-lg bg-[#00338D] px-5 py-2 text-sm font-medium text-white hover:bg-[#002266] disabled:bg-gray-300">
                {importApplying ? <SpinnerSmall /> : "Import Selected"}
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Prompt Modal                                                    */
/* ------------------------------------------------------------------ */

function AddPromptModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: PromptConfig) => void;
}) {
  const [form, setForm] = useState<NewPromptForm>({
    display_name: "",
    prompt_key: "",
    category: "planner",
    pipeline_stage: "step2_plan",
    description: "",
    prompt_text: "",
    icon_name: "",
    variables: {},
  });
  const [creating, setCreating] = useState(false);
  const [autoKey, setAutoKey] = useState(true);

  function updateField(field: keyof NewPromptForm, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "display_name" && autoKey) {
        next.prompt_key = slugify(value);
      }
      if (field === "prompt_key") {
        setAutoKey(false);
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!form.display_name.trim() || !form.prompt_text.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        display_name: form.display_name,
        prompt_text: form.prompt_text,
        category: form.category,
        pipeline_stage: form.pipeline_stage,
      };
      if (form.prompt_key.trim()) body.prompt_key = form.prompt_key;
      if (form.description.trim()) body.description = form.description;
      if (form.icon_name.trim()) body.icon_name = form.icon_name;

      const vars = extractVariables(form.prompt_text);
      if (vars.length > 0) {
        const varObj: Record<string, string> = {};
        for (const v of vars) varObj[v] = VARIABLE_DESCRIPTIONS[v] || "";
        body.variables = varObj;
      }

      const { data } = await api.post("/prompts", body);
      onCreated(data);
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setCreating(false);
    }
  }

  const modalLineCount = form.prompt_text.split("\n").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {/* Modal header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Create New Prompt</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Display Name</label>
            <input
              value={form.display_name}
              onChange={(e) => updateField("display_name", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              placeholder="e.g. Slide Layout Planner"
            />
          </div>

          {/* Prompt Key */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Prompt Key</label>
            <input
              value={form.prompt_key}
              onChange={(e) => updateField("prompt_key", e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              placeholder="Auto-generated from name"
            />
          </div>

          {/* Category + Pipeline Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="planner">Planner</option>
                <option value="writer">Writer</option>
                <option value="designer">Designer</option>
                <option value="system">System</option>
                <option value="quick_action.planner">Quick Action - Planner</option>
                <option value="quick_action.writer">Quick Action - Writer</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Pipeline Stage</label>
              <select
                value={form.pipeline_stage}
                onChange={(e) => updateField("pipeline_stage", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              placeholder="Optional description..."
            />
          </div>

          {/* Prompt Text (dark editor) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Prompt Text</label>
            <div className="overflow-hidden rounded-xl bg-gray-900">
              <div className="flex">
                <div className="select-none border-r border-gray-700/50 bg-gray-900 py-4 pl-3 pr-2 text-right">
                  {Array.from({ length: modalLineCount }, (_, i) => (
                    <div key={i} className="font-mono text-xs leading-relaxed text-gray-600">{i + 1}</div>
                  ))}
                </div>
                <textarea
                  value={form.prompt_text}
                  onChange={(e) => updateField("prompt_text", e.target.value)}
                  className="min-h-[200px] flex-1 resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-gray-100 outline-none placeholder-gray-600"
                  spellCheck={false}
                  placeholder="Write your prompt here..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !form.display_name.trim() || !form.prompt_text.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[#00338D] px-5 py-2 text-xs font-medium text-white hover:bg-[#002266] transition-colors disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {creating ? <SpinnerSmall /> : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
