"use client";

import api from "@/lib/api";
import { useEffect, useState } from "react";

interface ModelInfo { model_id: string; model_name: string; description: string }
interface ProviderInfo { provider: string; display_name: string; available: boolean; requires_api_key: boolean; models: ModelInfo[] }
interface SavedConfig { id: string; provider: string; model_name: string; api_key_masked: string | null; endpoint_url: string | null; is_default: boolean }
interface TestResult { success: boolean; message: string; latency_ms: number | null; model_used: string | null }

const PROVIDER_THEME: Record<string, { accent: string; bg: string; border: string; glow: string; icon: string; gradient: string }> = {
  claude: { accent: "#7C3AED", bg: "bg-purple-50", border: "border-purple-200", glow: "shadow-glow-purple", icon: "C", gradient: "from-purple-600 to-violet-500" },
  openai: { accent: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", glow: "shadow-glow-green", icon: "G", gradient: "from-emerald-600 to-teal-500" },
  ollama: { accent: "#F59E0B", bg: "bg-amber-50", border: "border-amber-200", glow: "shadow-glow-orange", icon: "L", gradient: "from-amber-500 to-orange-500" },
};

export default function LLMSettingsPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [endpoints, setEndpoints] = useState<Record<string, string>>({});
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [pRes, cRes] = await Promise.all([api.get("/llm/providers"), api.get("/llm/configs")]);
      setProviders(pRes.data); setConfigs(cRes.data);
      const keys: Record<string, string> = {}, eps: Record<string, string> = {}, models: Record<string, string> = {};
      for (const c of cRes.data as SavedConfig[]) { if (c.api_key_masked) keys[c.provider] = ""; if (c.endpoint_url) eps[c.provider] = c.endpoint_url; models[c.provider] = c.model_name; }
      for (const p of pRes.data as ProviderInfo[]) { if (!models[p.provider] && p.models.length) models[p.provider] = p.models[0].model_id; }
      setApiKeys(keys); setEndpoints(eps); setSelectedModels(models);
    } catch {} finally { setLoading(false); }
  }

  async function handleTest(provider: string) {
    setTesting((p) => ({ ...p, [provider]: true })); setTestResults((p) => ({ ...p, [provider]: null }));
    try {
      const payload: Record<string, string> = { provider, model: selectedModels[provider] || "" };
      if (apiKeys[provider]) payload.api_key = apiKeys[provider]; if (endpoints[provider]) payload.endpoint_url = endpoints[provider];
      const { data } = await api.post("/llm/test", payload); setTestResults((p) => ({ ...p, [provider]: data }));
    } catch { setTestResults((p) => ({ ...p, [provider]: { success: false, message: "Request failed", latency_ms: null, model_used: null } })); }
    finally { setTesting((p) => ({ ...p, [provider]: false })); }
  }

  async function handleSave(provider: string) {
    setSaving((p) => ({ ...p, [provider]: true })); setSaveMsg((p) => ({ ...p, [provider]: "" }));
    try {
      const existing = configs.find((c) => c.provider === provider);
      const payload: Record<string, unknown> = { provider, model_name: selectedModels[provider] || "", is_default: false };
      if (apiKeys[provider]) payload.api_key = apiKeys[provider]; if (endpoints[provider]) payload.endpoint_url = endpoints[provider];
      if (existing) await api.put(`/llm/configs/${existing.id}`, payload); else await api.post("/llm/configs", payload);
      setSaveMsg((p) => ({ ...p, [provider]: "Saved" })); const { data } = await api.get("/llm/configs"); setConfigs(data);
      setTimeout(() => setSaveMsg((p) => ({ ...p, [provider]: "" })), 2000);
    } catch { setSaveMsg((p) => ({ ...p, [provider]: "Failed" })); }
    finally { setSaving((p) => ({ ...p, [provider]: false })); }
  }

  async function handleSetDefault(provider: string) {
    const existing = configs.find((c) => c.provider === provider);
    if (!existing) { await handleSave(provider); const { data } = await api.get("/llm/configs"); setConfigs(data); const n = (data as SavedConfig[]).find((c) => c.provider === provider); if (n) await api.put(`/llm/configs/${n.id}`, { is_default: true }); }
    else await api.put(`/llm/configs/${existing.id}`, { is_default: true });
    const { data } = await api.get("/llm/configs"); setConfigs(data);
  }

  if (loading) return (
    <div className="grid gap-6 lg:grid-cols-3">
      {[1, 2, 3].map((i) => <div key={i} className="card p-6"><div className="skeleton mb-4 h-12 w-12 rounded-xl" /><div className="skeleton mb-2 h-5 w-32" /><div className="skeleton h-4 w-48" /></div>)}
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">LLM Configuration</h2>
        <p className="mt-1 text-sm text-gray-500">Configure your AI model providers. Agents use the default provider unless overridden per presentation.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {providers.map((provider) => {
          const theme = PROVIDER_THEME[provider.provider] || PROVIDER_THEME.claude;
          const saved = configs.find((c) => c.provider === provider.provider);
          const result = testResults[provider.provider];
          const isDefault = saved?.is_default;

          return (
            <div key={provider.provider} className={`card overflow-hidden transition-all duration-300 ${isDefault ? theme.glow : ""}`}>
              {/* Accent top border */}
              <div className="h-1" style={{ background: theme.accent }} />

              <div className="p-6">
                {/* Header */}
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${theme.gradient} text-lg font-bold text-white shadow-sm`}>
                      {theme.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{provider.display_name}</h3>
                      <p className="text-xs text-gray-500">{provider.models.length} model{provider.models.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {isDefault && <span className="badge bg-[#00338D] text-white">Default</span>}
                </div>

                <div className="space-y-4">
                  {/* Model */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500 uppercase tracking-wider">Model</label>
                    <select value={selectedModels[provider.provider] || ""} onChange={(e) => setSelectedModels((p) => ({ ...p, [provider.provider]: e.target.value }))} className="input-field text-sm">
                      {provider.models.map((m) => <option key={m.model_id} value={m.model_id}>{m.model_name} &mdash; {m.description}</option>)}
                    </select>
                  </div>

                  {/* API Key */}
                  {provider.requires_api_key && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</label>
                      <div className="relative">
                        <input
                          type={showKey[provider.provider] ? "text" : "password"}
                          value={apiKeys[provider.provider] || ""}
                          onChange={(e) => setApiKeys((p) => ({ ...p, [provider.provider]: e.target.value }))}
                          placeholder={saved?.api_key_masked || "Enter API key"}
                          className="input-field pr-10 text-sm"
                        />
                        <button onClick={() => setShowKey((p) => ({ ...p, [provider.provider]: !p[provider.provider] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {showKey[provider.provider]
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                            }
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Endpoint (Ollama) */}
                  {provider.provider === "ollama" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint URL</label>
                      <input type="text" value={endpoints[provider.provider] || "http://host.docker.internal:11434"} onChange={(e) => setEndpoints((p) => ({ ...p, [provider.provider]: e.target.value }))} className="input-field text-sm" />
                    </div>
                  )}
                </div>

                {/* Test result */}
                {result && (
                  <div className={`mt-4 animate-fade-in rounded-lg border p-3 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        {result.success ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                        {result.success ? "Connected" : "Failed"}
                      </span>
                      {result.latency_ms && <span className="text-xs opacity-70">{result.latency_ms.toFixed(0)}ms</span>}
                    </div>
                    {!result.success && <p className="mt-1 text-xs opacity-75">{result.message}</p>}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-5 flex items-center gap-2">
                  <button onClick={() => handleTest(provider.provider)} disabled={testing[provider.provider]} className="btn-secondary flex-1 text-sm">
                    {testing[provider.provider] ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                    ) : "Test"}
                  </button>
                  <button onClick={() => handleSave(provider.provider)} disabled={saving[provider.provider]} className="btn-primary flex-1 text-sm">
                    {saving[provider.provider] ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : saveMsg[provider.provider] ? (
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {saveMsg[provider.provider]}
                      </span>
                    ) : "Save"}
                  </button>
                </div>

                {/* Default toggle */}
                {!isDefault && (
                  <button onClick={() => handleSetDefault(provider.provider)}
                    className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 transition-all duration-200 hover:border-gray-400 hover:text-gray-700">
                    Set as Default
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
