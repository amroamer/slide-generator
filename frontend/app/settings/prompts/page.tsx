"use client";

import api from "@/lib/api";
import { useEffect, useRef, useState } from "react";

interface PromptConfig {
  id: string;
  prompt_key: string;
  prompt_text: string;
  category: string;
  variables: Record<string, string> | null;
  is_active: boolean;
  is_system: boolean;
  is_overridden: boolean;
  display_name: string;
  description: string | null;
  icon_name: string | null;
  sort_order: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  planner: "Planner Agent",
  writer: "Writer Agent",
  designer: "Designer Agent",
  "quick_action.planner": "Quick Actions — Planner",
  "quick_action.writer": "Quick Actions — Writer",
};

const CATEGORY_BADGE: Record<string, string> = {
  planner: "bg-purple-50 text-purple-700",
  writer: "bg-blue-50 text-blue-700",
  designer: "bg-emerald-50 text-emerald-700",
  "quick_action.planner": "bg-amber-50 text-amber-700",
  "quick_action.writer": "bg-amber-50 text-amber-700",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "planner", label: "Planner" },
  { key: "writer", label: "Writer" },
  { key: "designer", label: "Designer" },
  { key: "quick_action.planner", label: "Quick Actions — Plan" },
  { key: "quick_action.writer", label: "Quick Actions — Write" },
];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [testKey, setTestKey] = useState<string | null>(null);
  const [testVars, setTestVars] = useState<Record<string, string>>({});
  const [testRendered, setTestRendered] = useState("");
  const [testLlmResponse, setTestLlmResponse] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    api.get("/prompts").then(({ data }) => { setPrompts(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = prompts.filter((p) => {
    if (tab !== "all" && p.category !== tab) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.display_name.toLowerCase().includes(s) || p.prompt_key.includes(s) || p.prompt_text.toLowerCase().includes(s);
    }
    return true;
  });

  const grouped: Record<string, PromptConfig[]> = {};
  for (const p of filtered) {
    const cat = p.category;
    (grouped[cat] = grouped[cat] || []).push(p);
  }

  function expand(key: string) {
    if (expandedKey === key) { setExpandedKey(null); return; }
    setExpandedKey(key);
    const p = prompts.find((x) => x.prompt_key === key);
    setEditText(p?.prompt_text || "");
  }

  async function handleSave(promptKey: string) {
    setSaving(true);
    try {
      const { data } = await api.put(`/prompts/${promptKey}`, { prompt_text: editText });
      setPrompts((prev) => prev.map((p) => p.prompt_key === promptKey ? { ...p, ...data } : p));
      setSaved(promptKey);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleReset(promptKey: string) {
    try {
      await api.delete(`/prompts/${promptKey}`);
      // Reload all to get system default back
      const { data } = await api.get("/prompts");
      setPrompts(data);
      const p = data.find((x: PromptConfig) => x.prompt_key === promptKey);
      if (p) setEditText(p.prompt_text);
    } catch (err) { console.error(err); }
  }

  function openTest(p: PromptConfig) {
    setTestKey(p.prompt_key);
    const vars: Record<string, string> = {};
    if (p.variables) {
      for (const [k, v] of Object.entries(p.variables)) {
        vars[k] = typeof v === "string" ? v : String(v);
      }
    }
    // Also detect {variables} in prompt text
    const matches = p.prompt_text.match(/\{(\w+)\}/g);
    if (matches) {
      for (const m of matches) {
        const key = m.slice(1, -1);
        if (!vars[key]) vars[key] = "";
      }
    }
    setTestVars(vars);
    setTestRendered("");
    setTestLlmResponse("");
  }

  async function runTest(sendToLlm: boolean) {
    setTestLoading(true);
    try {
      const p = prompts.find((x) => x.prompt_key === testKey);
      const { data } = await api.post("/prompts/test", {
        prompt_text: p?.prompt_text || editText,
        variables: testVars,
        run_llm: sendToLlm,
      });
      setTestRendered(data.rendered_text);
      if (data.llm_response) setTestLlmResponse(data.llm_response);
    } catch (err) { console.error(err); }
    finally { setTestLoading(false); }
  }

  // Detect variables in text
  function getVariables(text: string): string[] {
    const matches = text.match(/\{(\w+)\}/g);
    return matches ? Array.from(new Set(matches.map((m) => m.slice(1, -1)))) : [];
  }

  const overrideCount = (cat: string) => prompts.filter((p) => (cat === "all" || p.category === cat) && p.is_overridden).length;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Prompt Configuration</h2>
        <p className="mt-1 text-sm text-gray-500">Customize the AI prompts used by each agent to tune behavior for your specific needs</p>
      </div>

      {/* Search + Tabs */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompts..."
          className="input-field flex-1 h-10" />
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
              {overrideCount(t.key) > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                  {overrideCount(t.key)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt list */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {CATEGORY_LABELS[cat] || cat}
          </p>
          <div className="space-y-2">
            {items.map((p) => {
              const isExpanded = expandedKey === p.prompt_key;
              const hasChanges = isExpanded && editText !== p.prompt_text;
              const vars = getVariables(isExpanded ? editText : p.prompt_text);

              return (
                <div key={p.prompt_key} className={`card overflow-hidden transition-all ${hasChanges ? "border-amber-300" : ""}`}>
                  {/* Header */}
                  <button onClick={() => expand(p.prompt_key)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{p.display_name}</p>
                    </div>
                    <span className={`badge text-[10px] ${CATEGORY_BADGE[p.category] || "bg-gray-100 text-gray-600"}`}>
                      {p.category.replace("quick_action.", "QA ")}
                    </span>
                    {p.is_overridden && <span className="badge bg-blue-100 text-blue-700 text-[10px]">Customized</span>}
                    {!p.is_overridden && <span className="text-[10px] text-gray-400">Default</span>}
                    <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-4 animate-fade-in">
                      {p.description && <p className="mb-3 text-sm text-gray-500">{p.description}</p>}

                      {/* Variables bar */}
                      {vars.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {vars.map((v) => (
                            <span key={v} className="rounded bg-gray-800 px-2 py-0.5 font-mono text-[10px] text-cyan-400">
                              {`{${v}}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Editor */}
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[200px] w-full rounded-xl bg-gray-900 p-4 font-mono text-sm leading-relaxed text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/30"
                        spellCheck={false}
                      />

                      {/* Actions */}
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => handleSave(p.prompt_key)} disabled={saving || !hasChanges}
                          className="btn-primary h-9 px-4 text-xs">
                          {saving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> :
                            saved === p.prompt_key ? (
                              <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Saved</>
                            ) : "Save"}
                        </button>
                        <button onClick={() => openTest(p)} className="btn-secondary h-9 text-xs">Test</button>
                        {p.is_overridden && (
                          <button onClick={() => handleReset(p.prompt_key)} className="btn-ghost h-9 text-xs text-rose-500 hover:text-rose-700">
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-12">No prompts match your search</p>
      )}

      {/* Test modal */}
      {testKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setTestKey(null)} />
          <div className="relative z-10 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-modal">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Test Prompt</h3>
              <button onClick={() => setTestKey(null)} className="btn-ghost p-1">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Variable inputs */}
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Variables</p>
              {Object.entries(testVars).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 rounded bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-600">{`{${key}}`}</span>
                  <input value={val} onChange={(e) => setTestVars({ ...testVars, [key]: e.target.value })}
                    className="input-field h-9 flex-1 text-sm" placeholder={`Value for ${key}`} />
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => runTest(false)} disabled={testLoading} className="btn-secondary h-9 text-xs">Render Preview</button>
              <button onClick={() => runTest(true)} disabled={testLoading} className="btn-primary h-9 text-xs">
                {testLoading ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "Send to LLM"}
              </button>
            </div>

            {testRendered && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rendered</p>
                <pre className="max-h-[200px] overflow-auto rounded-lg bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">{testRendered}</pre>
              </div>
            )}
            {testLlmResponse && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">LLM Response</p>
                <pre className="max-h-[200px] overflow-auto rounded-lg bg-white border p-4 text-sm text-gray-700 whitespace-pre-wrap">{testLlmResponse}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
