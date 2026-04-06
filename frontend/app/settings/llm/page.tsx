"use client";

import api from "@/lib/api";
import { useEffect, useState, useRef, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────────────────── */

interface ModelInfo {
  model_id: string;
  model_name: string;
  description: string;
  size?: string;
  parameter_size?: string;
  modified_at?: string;
}
interface ProviderInfo {
  provider: string;
  display_name: string;
  available: boolean;
  requires_api_key: boolean;
  models: ModelInfo[];
}
interface SavedConfig {
  id: string;
  provider: string;
  model_name: string;
  api_key_masked: string | null;
  endpoint_url: string | null;
  is_default: boolean;
  display_name: string | null;
  provider_type: string | null;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_latency_ms: number | null;
  last_test_error: string | null;
}
interface TestResult {
  success: boolean;
  message: string;
  latency_ms: number | null;
  model_used: string | null;
}

/* ── Provider theme ────────────────────────────────────────────────── */

const THEMES: Record<string, { accent: string; letter: string; bg: string }> = {
  ollama:    { accent: "#F59E0B", letter: "O", bg: "#FFFBEB" },
  claude:    { accent: "#7C3AED", letter: "C", bg: "#F5F3FF" },
  anthropic: { accent: "#7C3AED", letter: "C", bg: "#F5F3FF" },
  openai:    { accent: "#10B981", letter: "G", bg: "#ECFDF5" },
  custom:    { accent: "#3B82F6", letter: "X", bg: "#EFF6FF" },
};

function theme(provider: string) {
  const key = provider.toLowerCase();
  if (key.includes("ollama")) return THEMES.ollama;
  if (key.includes("claude") || key.includes("anthropic")) return THEMES.claude;
  if (key.includes("openai")) return THEMES.openai;
  return THEMES[key] || THEMES.custom;
}

const DEFAULT_ENDPOINTS: Record<string, string> = {
  ollama: "http://host.docker.internal:11434",
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com/v1",
  custom: "",
};

function providerTypeLabel(cfg: SavedConfig) {
  const p = cfg.provider.toLowerCase();
  if (p.includes("ollama")) return "Local";
  return "API";
}

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── Icons (inline SVG) ────────────────────────────────────────────── */

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  );
}

function SpinnerIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function LLMSettingsPage() {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SavedConfig | null>(null);

  // Models panel state
  const [modelsPanelConfig, setModelsPanelConfig] = useState<SavedConfig | null>(null);
  const [installedModels, setInstalledModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);

  // Testing state
  const [testingId, setTestingId] = useState<string | null>(null);

  // Inline model editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineModels, setInlineModels] = useState<ModelInfo[]>([]);
  const [inlineModelsLoading, setInlineModelsLoading] = useState(false);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);

  // Confirm delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  /* ── Data fetching ─────────────────────────────────────────────── */

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, provRes] = await Promise.all([
        api.get("/llm/configs"),
        api.get("/llm/providers"),
      ]);
      setConfigs(cfgRes.data);
      setProviders(provRes.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || "Failed to load LLM settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeConfigs = configs.filter((c) => c.is_active);
  const defaultConfig = configs.find((c) => c.is_default);

  /* ── Handlers ──────────────────────────────────────────────────── */

  async function handleSetDefault(configId: string) {
    try {
      await api.put("/llm/default", { config_id: configId });
      setConfigs((prev) =>
        prev.map((c) => ({ ...c, is_default: c.id === configId }))
      );
    } catch {}
  }

  async function handleToggleActive(cfg: SavedConfig) {
    try {
      const endpoint = cfg.is_active
        ? `/llm/configs/${cfg.id}/deactivate`
        : `/llm/configs/${cfg.id}/activate`;
      await api.put(endpoint);
      setConfigs((prev) =>
        prev.map((c) => c.id === cfg.id ? { ...c, is_active: !c.is_active } : c)
      );
    } catch {}
  }

  async function handleTest(cfg: SavedConfig) {
    setTestingId(cfg.id);
    try {
      const { data } = await api.post<TestResult>("/llm/test", {
        config_id: cfg.id,
        provider: cfg.provider,
        model: cfg.model_name,
        endpoint_url: cfg.endpoint_url,
      });
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === cfg.id
            ? {
                ...c,
                last_tested_at: new Date().toISOString(),
                last_test_status: data.success ? "success" : "failure",
                last_test_latency_ms: data.latency_ms,
                last_test_error: data.success ? null : data.message,
              }
            : c
        )
      );
    } catch (e: any) {
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === cfg.id
            ? {
                ...c,
                last_tested_at: new Date().toISOString(),
                last_test_status: "failure",
                last_test_latency_ms: null,
                last_test_error: e?.response?.data?.detail || e.message,
              }
            : c
        )
      );
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    const cfg = configs.find((c) => c.id === id);
    if (cfg?.is_default) return;
    try {
      await api.delete(`/llm/configs/${id}`);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirmId(null);
    } catch {}
  }

  async function handleInlineModelChange(cfgId: string, newModel: string) {
    try {
      await api.put(`/llm/configs/${cfgId}`, { model_name: newModel });
      setConfigs((prev) =>
        prev.map((c) => c.id === cfgId ? { ...c, model_name: newModel } : c)
      );
      setInlineEditId(null);
      setSavedFlashId(cfgId);
      setTimeout(() => setSavedFlashId(null), 1500);
    } catch {}
  }

  async function openInlineEdit(cfg: SavedConfig) {
    setInlineEditId(cfg.id);
    setInlineModelsLoading(true);
    try {
      const { data } = await api.get<ModelInfo[]>(`/llm/configs/${cfg.id}/models`);
      setInlineModels(data);
    } catch {
      // Fall back to provider models
      const prov = providers.find((p) => p.provider === cfg.provider);
      setInlineModels(prov?.models || []);
    } finally {
      setInlineModelsLoading(false);
    }
  }

  /* ── Models panel ──────────────────────────────────────────────── */

  async function openModelsPanel(cfg: SavedConfig) {
    setModelsPanelConfig(cfg);
    setModelsLoading(true);
    try {
      const { data } = await api.get<ModelInfo[]>(`/llm/configs/${cfg.id}/models`);
      setInstalledModels(data);
    } catch {
      setInstalledModels([]);
    } finally {
      setModelsLoading(false);
    }
  }

  async function refreshModels() {
    if (!modelsPanelConfig) return;
    setModelsLoading(true);
    try {
      const { data } = await api.get<ModelInfo[]>(`/llm/configs/${modelsPanelConfig.id}/models`);
      setInstalledModels(data);
    } catch {} finally {
      setModelsLoading(false);
    }
  }

  async function pullModel() {
    if (!modelsPanelConfig || !pullName.trim()) return;
    setPulling(true);
    try {
      await api.post(`/llm/configs/${modelsPanelConfig.id}/models/pull`, { model_name: pullName.trim() });
      setPullName("");
      await refreshModels();
    } catch {} finally {
      setPulling(false);
    }
  }

  async function deleteModel(modelName: string) {
    if (!modelsPanelConfig) return;
    try {
      await api.post(`/llm/configs/${modelsPanelConfig.id}/models/delete`, { model_name: modelName });
      setInstalledModels((prev) => prev.filter((m) => m.model_name !== modelName));
    } catch {}
  }

  async function useModel(modelName: string) {
    if (!modelsPanelConfig) return;
    await handleInlineModelChange(modelsPanelConfig.id, modelName);
    setModelsPanelConfig((prev) => prev ? { ...prev, model_name: modelName } : null);
  }

  /* ── Loading / Error ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <SpinnerIcon className="w-8 h-8 text-gray-400" />
          <p className="text-sm text-gray-500">Loading LLM settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-700 font-medium mb-2">Failed to load</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button onClick={fetchAll} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div className="w-full space-y-8">
      {/* ── Section 1: Default Model Bar ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <StarIcon className="text-amber-500" />
            <span className="text-base font-semibold text-gray-900">Default Model</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <select
              value={defaultConfig?.id || ""}
              onChange={(e) => handleSetDefault(e.target.value)}
              className="w-80 h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" disabled>Select default model...</option>
              {activeConfigs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name || c.provider} — {c.model_name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-400">This model will be used for all new presentations</span>
          </div>
        </div>
      </div>

      {/* ── Section 2: Provider List ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Providers</h2>
          <button
            onClick={() => { setEditingConfig(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon />
            Add Provider
          </button>
        </div>

        {configs.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-sm">No providers configured yet. Click &quot;Add Provider&quot; to get started.</p>
          </div>
        )}

        {configs.map((cfg) => {
          const t = theme(cfg.provider);
          const isInactive = !cfg.is_active;
          const isOllama = cfg.provider.toLowerCase().includes("ollama");

          return (
            <div
              key={cfg.id}
              className={`bg-white rounded-xl border border-gray-200 p-6 mb-4 transition-opacity ${isInactive ? "opacity-50" : ""}`}
            >
              <div className="flex gap-6">
                {/* ── Left Column: Provider Identity ─────────── */}
                <div className="w-48 shrink-0 flex flex-col items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                    style={{ backgroundColor: t.accent }}
                  >
                    {t.letter}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 text-center">
                    {cfg.display_name || cfg.provider}
                  </div>
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: t.bg,
                      color: t.accent,
                    }}
                  >
                    {providerTypeLabel(cfg)}
                  </span>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleActive(cfg)}
                    className="flex items-center gap-2 mt-1"
                  >
                    <div
                      className={`relative w-10 h-5 rounded-full transition-colors ${cfg.is_active ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.is_active ? "translate-x-5" : "translate-x-0.5"}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{cfg.is_active ? "Active" : "Inactive"}</span>
                  </button>

                  {cfg.is_default && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                      <StarIcon className="w-3 h-3" /> Default
                    </span>
                  )}
                </div>

                {/* ── Center Column: Configuration ───────────── */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Model */}
                    <div>
                      <label className="text-xs text-gray-400 uppercase tracking-wide">Model</label>
                      {inlineEditId === cfg.id ? (
                        <div className="mt-1">
                          {inlineModelsLoading ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <SpinnerIcon /> Loading...
                            </div>
                          ) : (
                            <select
                              autoFocus
                              defaultValue={cfg.model_name}
                              onChange={(e) => handleInlineModelChange(cfg.id, e.target.value)}
                              onBlur={() => setInlineEditId(null)}
                              className="w-full h-8 rounded border border-blue-400 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {inlineModels.map((m) => (
                                <option key={m.model_id} value={m.model_id}>
                                  {m.model_name}
                                </option>
                              ))}
                              {inlineModels.length === 0 && (
                                <option value={cfg.model_name}>{cfg.model_name}</option>
                              )}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            onClick={() => openInlineEdit(cfg)}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors cursor-pointer text-left"
                          >
                            {cfg.model_name}
                          </button>
                          {savedFlashId === cfg.id && (
                            <span className="text-xs text-green-600 font-medium animate-pulse">Saved</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Endpoint */}
                    <div>
                      <label className="text-xs text-gray-400 uppercase tracking-wide">Endpoint</label>
                      <p className="mt-1 text-sm font-mono text-gray-500 truncate">
                        {cfg.endpoint_url || "Default"}
                      </p>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="text-xs text-gray-400 uppercase tracking-wide">API Key</label>
                      <p className="mt-1 text-sm text-gray-500">
                        {cfg.api_key_masked || "No key required"}
                      </p>
                    </div>
                  </div>

                  {/* Connection status bar */}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          cfg.last_test_status === "success"
                            ? "#10B981"
                            : cfg.last_test_status === "failure"
                            ? "#EF4444"
                            : "#D1D5DB",
                      }}
                    />
                    <span className="text-sm text-gray-600">
                      {cfg.last_test_status === "success"
                        ? "Connected"
                        : cfg.last_test_status === "failure"
                        ? cfg.last_test_error || "Connection failed"
                        : "Not tested"}
                    </span>
                    {cfg.last_test_latency_ms != null && (
                      <span className="text-xs text-gray-400 ml-auto">
                        {cfg.last_test_latency_ms}ms
                      </span>
                    )}
                    {cfg.last_tested_at && (
                      <span className="text-xs text-gray-400">
                        {timeAgo(cfg.last_tested_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Right Column: Actions ──────────────────── */}
                <div className="w-48 shrink-0 flex flex-col gap-2">
                  <button
                    disabled={isInactive || testingId === cfg.id}
                    onClick={() => handleTest(cfg)}
                    className="w-full h-9 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {testingId === cfg.id ? <><SpinnerIcon /> Testing...</> : "Test Connection"}
                  </button>

                  <button
                    onClick={() => { setEditingConfig(cfg); setModalOpen(true); }}
                    className="w-full h-9 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>

                  {cfg.is_default ? (
                    <button disabled className="w-full h-9 text-sm rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center gap-1.5 cursor-default">
                      <StarIcon className="w-3.5 h-3.5" /> Default
                    </button>
                  ) : (
                    <button
                      disabled={isInactive}
                      onClick={() => handleSetDefault(cfg.id)}
                      className="w-full h-9 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Set as Default
                    </button>
                  )}

                  {isOllama && (
                    <button
                      disabled={isInactive}
                      onClick={() => openModelsPanel(cfg)}
                      className="w-full h-9 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      View Models
                    </button>
                  )}

                  <button
                    disabled={cfg.is_default}
                    onClick={() => setDeleteConfirmId(cfg.id)}
                    className="w-full h-9 text-sm rounded-lg text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Delete Confirm Dialog ────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Provider</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this provider configuration? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit / Add Modal ─────────────────────────────────────── */}
      {modalOpen && (
        <EditModal
          config={editingConfig}
          providers={providers}
          onClose={() => { setModalOpen(false); setEditingConfig(null); }}
          onSaved={() => { setModalOpen(false); setEditingConfig(null); fetchAll(); }}
          onDeleted={() => { setModalOpen(false); setEditingConfig(null); fetchAll(); }}
        />
      )}

      {/* ── View Models Slide-over ───────────────────────────────── */}
      {modelsPanelConfig && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setModelsPanelConfig(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-[400px] h-full bg-white shadow-2xl flex flex-col animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Installed Models</h3>
              <div className="flex items-center gap-2">
                <button onClick={refreshModels} disabled={modelsLoading} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-40">
                  <RefreshIcon />
                </button>
                <button onClick={() => setModelsPanelConfig(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Model list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {modelsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <SpinnerIcon className="w-6 h-6 text-gray-400" />
                </div>
              ) : installedModels.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No models installed</p>
              ) : (
                installedModels.map((m) => {
                  const isActive = m.model_name === modelsPanelConfig.model_name || m.model_id === modelsPanelConfig.model_name;
                  return (
                    <div key={m.model_id} className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-900">{m.model_name}</span>
                        {isActive && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Active</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {m.size && <span>{m.size}</span>}
                        {m.parameter_size && <span>{m.parameter_size}</span>}
                        {m.modified_at && <span>{new Date(m.modified_at).toLocaleDateString()}</span>}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        {!isActive && (
                          <button
                            onClick={() => useModel(m.model_id || m.model_name)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            Use
                          </button>
                        )}
                        <button
                          onClick={() => deleteModel(m.model_name)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pull section */}
            <div className="border-t border-gray-200 p-4 space-y-3">
              <label className="text-sm font-medium text-gray-700">Pull Model</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pullName}
                  onChange={(e) => setPullName(e.target.value)}
                  placeholder="e.g. llama3.2"
                  className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && pullModel()}
                />
                <button
                  onClick={pullModel}
                  disabled={pulling || !pullName.trim()}
                  className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {pulling ? <SpinnerIcon /> : null}
                  Pull
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}

/* ── Edit / Add Modal Component ────────────────────────────────────── */

function EditModal({
  config,
  providers,
  onClose,
  onSaved,
  onDeleted,
}: {
  config: SavedConfig | null;
  providers: ProviderInfo[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!config;

  const TYPE_OPTIONS = [
    { key: "ollama", label: "Ollama", desc: "Local models", accent: "#F59E0B", letter: "O" },
    { key: "anthropic", label: "Anthropic", desc: "Claude models", accent: "#7C3AED", letter: "C" },
    { key: "openai", label: "OpenAI", desc: "GPT models", accent: "#10B981", letter: "G" },
    { key: "custom", label: "Custom", desc: "Custom endpoint", accent: "#3B82F6", letter: "X" },
  ];

  const [selectedType, setSelectedType] = useState(
    config ? (config.provider.toLowerCase().includes("ollama") ? "ollama" : config.provider.toLowerCase().includes("claude") || config.provider.toLowerCase().includes("anthropic") ? "anthropic" : config.provider.toLowerCase().includes("openai") ? "openai" : "custom") : ""
  );
  const [displayName, setDisplayName] = useState(config?.display_name || "");
  const [endpointUrl, setEndpointUrl] = useState(config?.endpoint_url || "");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState(config?.model_name || "");
  const [isDefault, setIsDefault] = useState(config?.is_default || false);
  const [isActive, setIsActive] = useState(config?.is_active ?? true);

  const [modelOptions, setModelOptions] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const requiresKey = selectedType !== "ollama";

  // Pre-fill endpoint when type changes (add mode only)
  useEffect(() => {
    if (!isEdit && selectedType) {
      setEndpointUrl(DEFAULT_ENDPOINTS[selectedType] || "");
      // Load models from provider info
      const prov = providers.find((p) => p.provider.toLowerCase().includes(selectedType));
      if (prov) setModelOptions(prov.models);
      else setModelOptions([]);
    }
  }, [selectedType, isEdit, providers]);

  // Load models for edit mode
  useEffect(() => {
    if (isEdit && config) {
      const prov = providers.find((p) => p.provider === config.provider);
      if (prov) setModelOptions(prov.models);
    }
  }, [isEdit, config, providers]);

  async function fetchModels() {
    if (!endpointUrl) return;
    setModelsLoading(true);
    try {
      if (isEdit && config) {
        const { data } = await api.get<ModelInfo[]>(`/llm/configs/${config.id}/models`);
        setModelOptions(data);
      } else {
        // For new providers, try fetching from the endpoint indirectly via providers list
        const prov = providers.find((p) => p.provider.toLowerCase().includes(selectedType));
        if (prov) setModelOptions(prov.models);
      }
    } catch {
      setModelOptions([]);
    } finally {
      setModelsLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post<TestResult>("/llm/test", {
        provider: selectedType,
        model: modelName,
        api_key: apiKey || undefined,
        endpoint_url: endpointUrl || undefined,
        config_id: config?.id,
      });
      setTestResult(data);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.response?.data?.detail || e.message || "Test failed",
        latency_ms: null,
        model_used: null,
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, any> = {
        provider: selectedType,
        model_name: modelName,
        display_name: displayName || undefined,
        endpoint_url: endpointUrl || undefined,
        provider_type: selectedType === "ollama" ? "local" : "api",
        is_default: isDefault,
        is_active: isActive,
      };
      if (apiKey) body.api_key = apiKey;

      if (isEdit && config) {
        await api.put(`/llm/configs/${config.id}`, body);
      } else {
        await api.post("/llm/configs", body);
      }
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!config) return;
    try {
      await api.delete(`/llm/configs/${config.id}`);
      onDeleted();
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Provider" : "Add Provider"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
            <XIcon />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Type selector (add mode only) */}
          {!isEdit && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Provider Type</label>
              <div className="grid grid-cols-2 gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedType(opt.key)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      selectedType === opt.key
                        ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50/50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: opt.accent }}
                    >
                      {opt.letter}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form fields (show after type selected) */}
          {(isEdit || selectedType) && (
            <>
              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. My Claude Instance"
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Endpoint URL */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Endpoint URL</label>
                <input
                  type="text"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* API Key (hidden for ollama) */}
              {requiresKey && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={isEdit ? "Leave blank to keep existing key" : "sk-..."}
                    className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Model */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Model</label>
                  {(selectedType === "ollama" || config?.provider.toLowerCase().includes("ollama")) && (
                    <button
                      onClick={fetchModels}
                      disabled={modelsLoading}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      {modelsLoading ? <SpinnerIcon /> : <RefreshIcon />}
                      Fetch Models
                    </button>
                  )}
                </div>
                {modelOptions.length > 0 ? (
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a model...</option>
                    {modelOptions.map((m) => (
                      <option key={m.model_id} value={m.model_id}>
                        {m.model_name}{m.description ? ` — ${m.description}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. claude-sonnet-4-20250514"
                    className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>

              {/* Options row */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Set as Default</span>
                </label>
              </div>

              {/* Test button + result */}
              <div className="space-y-3">
                <button
                  onClick={handleTest}
                  disabled={testing || !modelName}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {testing ? <SpinnerIcon /> : null}
                  Test Connection
                </button>

                {testResult && (
                  <div
                    className={`rounded-xl p-4 text-sm ${
                      testResult.success
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                  >
                    <div className="font-medium">{testResult.success ? "Connection Successful" : "Connection Failed"}</div>
                    <div className="mt-1 text-xs opacity-80">{testResult.message}</div>
                    {testResult.latency_ms != null && (
                      <div className="mt-1 text-xs opacity-60">Latency: {testResult.latency_ms}ms</div>
                    )}
                    {testResult.model_used && (
                      <div className="mt-0.5 text-xs opacity-60">Model: {testResult.model_used}</div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div>
            {isEdit && !config?.is_default && (
              deleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-rose-600">Confirm?</span>
                  <button onClick={handleDelete} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                    Yes, Delete
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <TrashIcon />
                  Delete
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !modelName || (!isEdit && !selectedType)}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <SpinnerIcon /> : null}
              {isEdit ? "Save Changes" : "Create Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
