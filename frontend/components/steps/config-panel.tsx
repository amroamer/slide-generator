"use client";

import api from "@/lib/api";
import { useEffect, useState } from "react";

interface ModelInfo { model_id: string; model_name: string; description: string }
interface ProviderInfo { provider: string; display_name: string; available: boolean; models: ModelInfo[] }
interface Config { audience: string; tone: string; language: string; slideCount: number; templateId: string; brandProfileId: string; llmProvider: string; llmModel: string }
interface Props { config: Config; onChange: (config: Config) => void }

const AUDIENCES = ["Board/C-Suite", "Senior Management", "Working Team", "External Client", "Investor", "Regulatory Body"];

const TONES = [
  { value: "Formal Board-Level", label: "Formal", desc: "Board-level executive", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" },
  { value: "Client-Facing Professional", label: "Professional", desc: "Client-facing", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { value: "Internal Working Session", label: "Internal", desc: "Working session", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
];

const LANGUAGES = [
  { value: "english", label: "English", flag: "EN" },
  { value: "arabic", label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", flag: "AR" },
  { value: "bilingual", label: "Bilingual", flag: "EN+AR" },
];

const LLM_ACCENT: Record<string, string> = {
  claude: "border-purple-200 bg-purple-50/50",
  openai: "border-emerald-200 bg-emerald-50/50",
  ollama: "border-orange-200 bg-orange-50/50",
};

interface BrandOption { id: string; name: string; primary_color: string; secondary_color: string; accent_color: string; is_default: boolean; is_system: boolean }

export function ConfigPanel({ config, onChange }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [brandProfiles, setBrandProfiles] = useState<BrandOption[]>([]);
  useEffect(() => { api.get("/llm/providers").then(({ data }) => setProviders(data)).catch(() => {}); }, []);
  useEffect(() => { api.get("/brand-profiles").then(({ data }) => setBrandProfiles(data)).catch(() => {}); }, []);

  function set<K extends keyof Config>(key: K, value: Config[K]) { onChange({ ...config, [key]: value }); }

  return (
    <div className="space-y-6">
      {/* Audience */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Target Audience</label>
        <select value={config.audience} onChange={(e) => set("audience", e.target.value)} className="input-field">
          <option value="">Select audience...</option>
          {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Tone — card radio */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Tone</label>
        <div className="space-y-2">
          {TONES.map((t) => {
            const selected = config.tone === t.value;
            return (
              <button key={t.value} onClick={() => set("tone", t.value)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-200 ${
                  selected ? "border-[#00338D] bg-[#00338D]/5" : "border-gray-200 hover:border-gray-300"
                }`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#00338D] text-white" : "bg-gray-100 text-gray-500"}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${selected ? "text-[#00338D]" : "text-gray-900"}`}>{t.label}</p>
                  <p className="text-xs text-gray-400">{t.desc}</p>
                </div>
                {selected && (
                  <svg className="h-5 w-5 shrink-0 text-[#00338D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Language — card radio */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Language</label>
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map((l) => {
            const selected = config.language === l.value;
            return (
              <button key={l.value} onClick={() => set("language", l.value)}
                className={`flex flex-col items-center rounded-xl border-2 py-3 transition-all duration-200 ${
                  selected ? "border-[#00338D] bg-[#00338D]/5" : "border-gray-200 hover:border-gray-300"
                }`}>
                <span className={`text-sm font-bold ${selected ? "text-[#00338D]" : "text-gray-600"}`}>{l.flag}</span>
                <span className="mt-0.5 text-[11px] text-gray-400">{l.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide count */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Slide Count</label>
        <div className="flex items-center gap-2">
          <button onClick={() => set("slideCount", Math.max(5, config.slideCount - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition-all duration-200 hover:bg-gray-50 active:scale-95">-</button>
          <input type="number" min={5} max={50} value={config.slideCount}
            onChange={(e) => { const v = parseInt(e.target.value); if (v >= 5 && v <= 50) set("slideCount", v); }}
            className="h-11 w-20 rounded-lg border border-gray-300 bg-gray-50 text-center text-sm font-semibold text-gray-900 outline-none transition-all focus:border-[#0091DA] focus:bg-white focus:ring-2 focus:ring-[#0091DA]/20" />
          <button onClick={() => set("slideCount", Math.min(50, config.slideCount + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition-all duration-200 hover:bg-gray-50 active:scale-95">+</button>
          <span className="text-xs text-gray-400">5 &ndash; 50</span>
        </div>
      </div>

      {/* LLM Model */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">AI Model</label>
        <select
          value={`${config.llmProvider}:${config.llmModel}`}
          onChange={(e) => {
            const val = e.target.value;
            const colonIdx = val.indexOf(":");
            const provider = val.substring(0, colonIdx);
            const model = val.substring(colonIdx + 1);
            onChange({ ...config, llmProvider: provider, llmModel: model });
          }}
          className={`input-field ${LLM_ACCENT[config.llmProvider] || ""}`}>
          <option value=":">System Default</option>
          {providers.map((p) => (
            <optgroup key={p.provider} label={p.display_name}>
              {p.models.map((m) => <option key={m.model_id} value={`${p.provider}:${m.model_id}`}>{m.model_name} &mdash; {m.description}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Template placeholder */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Template</label>
        <select value={config.templateId} onChange={(e) => set("templateId", e.target.value)} className="input-field">
          <option value="">Blank / No Template</option>
        </select>
      </div>

      {/* Brand profile */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Brand Profile</label>
        <select value={config.brandProfileId} onChange={(e) => set("brandProfileId", e.target.value)} className="input-field">
          <option value="">Default (KPMG)</option>
          {brandProfiles.map((bp) => (
            <option key={bp.id} value={bp.id}>
              {bp.name}{bp.is_default ? " ★" : ""}
            </option>
          ))}
        </select>
        {config.brandProfileId && (() => {
          const bp = brandProfiles.find(b => b.id === config.brandProfileId);
          if (!bp) return null;
          return (
            <div className="mt-2 flex items-center gap-2">
              {[bp.primary_color, bp.secondary_color, bp.accent_color].map((c, i) => (
                <div key={i} className="h-4 w-4 rounded-full border border-gray-200" style={{ background: c }} />
              ))}
              <span className="text-[10px] text-gray-400">{bp.name}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
