"use client";

import api from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Presentation {
  id: string;
  title: string;
  status: string;
  language: string;
  slide_count: number;
  llm_provider: string | null;
  current_step: number;
  updated_at: string;
}

interface ListResponse {
  items: Presentation[];
  total: number;
  page: number;
  page_size: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; dot?: string; border: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600", border: "border-l-gray-300" },
  input_complete: { label: "In Progress", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500", border: "border-l-amber-400" },
  plan_complete: { label: "In Progress", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500", border: "border-l-amber-400" },
  content_complete: { label: "In Progress", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500", border: "border-l-amber-400" },
  design_complete: { label: "In Progress", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500", border: "border-l-amber-400" },
  exported: { label: "Completed", color: "bg-emerald-50 text-emerald-700", border: "border-l-emerald-400" },
};

const LANG: Record<string, string> = { english: "EN", arabic: "AR", bilingual: "EN+AR" };
const LLM: Record<string, { label: string; cls: string }> = {
  claude: { label: "Claude", cls: "text-purple-600" },
  openai: { label: "GPT", cls: "text-emerald-600" },
  ollama: { label: "Local", cls: "text-orange-600" },
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "input_complete", label: "In Progress" },
  { value: "exported", label: "Completed" },
];

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const fetch = useCallback(async (s?: string, st?: string) => {
    try {
      const params: Record<string, string> = {};
      if (s ?? search) params.search = s ?? search;
      if (st ?? statusFilter) params.status = st ?? statusFilter;
      const { data: res } = await api.get("/presentations", { params });
      setData(res);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetch(); }, [statusFilter]); // eslint-disable-line

  function handleSearch(v: string) {
    setSearch(v);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setLoading(true); fetch(v, statusFilter); }, 300);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const { data: p } = await api.post("/presentations", {});
      router.push(`/presentation/${p.id}`);
    } catch { setCreating(false); }
  }

  async function handleDuplicate(id: string) { setOpenMenuId(null); await api.post(`/presentations/${id}/duplicate`); fetch(); }
  async function handleDelete(id: string) { setOpenMenuId(null); await api.delete(`/presentations/${id}`); fetch(); }

  const { t, language, setLanguage } = useLanguage();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 animate-fade-in">
      {/* Top bar with guide + language */}
      <div className="mb-4 flex items-center justify-end gap-3">
        <Link href="/settings/llm" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{t("settings")}</Link>
        <Link href="/guide" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          {t("guide")}
        </Link>
        <button onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
          {language === "en" ? "عربي" : "EN"}
        </button>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t("myPresentations")}</h2>
          <p className="mt-1 text-sm text-gray-500">Create and manage your AI-powered presentations</p>
        </div>
        <button onClick={handleCreate} disabled={creating} className="btn-primary h-11 px-6 shadow-lg">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          {creating ? t("loading") : t("newPresentation")}
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-6 card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search presentations..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        {/* Segmented control */}
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setLoading(true); }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
                statusFilter === f.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-5">
              <div className="skeleton mb-3 h-5 w-3/4" />
              <div className="skeleton mb-2 h-4 w-1/2" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.items.length === 0 && (
        <div className="card flex flex-col items-center py-20 animate-fade-in">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-700">
            {search || statusFilter ? "No presentations match your filters" : "No presentations yet"}
          </p>
          <p className="mt-1.5 text-sm text-gray-400">
            {search || statusFilter ? "Try adjusting your search or filter" : "Create your first AI-powered presentation to get started"}
          </p>
          {!search && !statusFilter && (
            <button onClick={handleCreate} disabled={creating} className="btn-primary mt-6 h-11 px-6">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Create Presentation
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && data && data.items.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 animate-fade-in">
          {data.items.map((p) => {
            const s = STATUS_MAP[p.status] || STATUS_MAP.draft;
            const llm = p.llm_provider ? LLM[p.llm_provider] : null;
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/presentation/${p.id}`)}
                className={`card-hover group relative cursor-pointer border-l-[3px] p-5 ${s.border}`}
              >
                {/* Menu */}
                <div className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                    className="rounded-lg p-1.5 text-gray-400 opacity-0 transition-all duration-200 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                  {openMenuId === p.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 z-20 mt-1 w-40 animate-fade-in rounded-xl border border-gray-200 bg-white py-1.5 shadow-elevated">
                        <button onClick={() => { setOpenMenuId(null); router.push(`/presentation/${p.id}`); }} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Open
                        </button>
                        <button onClick={() => handleDuplicate(p.id)} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          Duplicate
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Title */}
                <h3 className="mb-3 pr-8 text-base font-semibold text-gray-900 line-clamp-2">{p.title}</h3>

                {/* Badges */}
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                  <span className={`badge ${s.color}`}>
                    {s.dot && <span className={`h-1.5 w-1.5 rounded-full ${s.dot} animate-pulse-dot`} />}
                    {s.label === "Completed" && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    {s.label}
                  </span>
                  <span className="badge border border-gray-200 bg-white text-gray-500">{LANG[p.language] || "EN"}</span>
                  {llm && <span className={`text-[10px] font-semibold ${llm.cls}`}>{llm.label}</span>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{p.slide_count} slides</span>
                  <span>Edited {timeAgo(p.updated_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && data && data.total > data.page_size && (
        <p className="mt-8 text-center text-sm text-gray-400">
          Showing {data.items.length} of {data.total} presentations
        </p>
      )}
    </main>
  );
}
