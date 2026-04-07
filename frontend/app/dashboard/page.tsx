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
  prompt_excerpt?: string;
  section_count?: number;
  section_titles?: string[];
  first_slide_title?: string;
  first_slide_bullets?: string[];
  first_slide_type?: string;
  has_chart?: boolean;
  has_table?: boolean;
}

interface ListResponse {
  items: Presentation[];
  total: number;
  page: number;
  page_size: number;
}

const STATUS_META: Record<string, { labelKey: string; actionKey: string; borderColor: string; badgeCls: string; dot?: string; stepsDone: number }> = {
  draft:            { labelKey: "draft",      actionKey: "statusNotStarted",     borderColor: "border-s-gray-300",    badgeCls: "bg-gray-100 text-gray-600",       stepsDone: 0 },
  input_complete:   { labelKey: "inProgress",  actionKey: "statusInputSaved",     borderColor: "border-s-amber-400",   badgeCls: "bg-amber-50 text-amber-700",  dot: "bg-amber-500", stepsDone: 1 },
  plan_complete:    { labelKey: "inProgress",  actionKey: "statusPlanGenerated",   borderColor: "border-s-amber-400",   badgeCls: "bg-amber-50 text-amber-700",  dot: "bg-amber-500", stepsDone: 2 },
  content_complete: { labelKey: "inProgress",  actionKey: "statusContentWritten",  borderColor: "border-s-amber-400",   badgeCls: "bg-amber-50 text-amber-700",  dot: "bg-amber-500", stepsDone: 3 },
  design_complete:  { labelKey: "inProgress",  actionKey: "statusDesignApplied",   borderColor: "border-s-amber-400",   badgeCls: "bg-amber-50 text-amber-700",  dot: "bg-amber-500", stepsDone: 4 },
  exported:         { labelKey: "completed",   actionKey: "statusExported",        borderColor: "border-s-emerald-400", badgeCls: "bg-emerald-50 text-emerald-700", stepsDone: 5 },
};

const STEP_LABELS = ["Input", "Plan", "Content", "Design", "Export"];

const LANG: Record<string, string> = { english: "EN", arabic: "AR", bilingual: "EN+AR" };
const LLM: Record<string, { label: string; cls: string }> = {
  ollama: { label: "Local", cls: "text-orange-600" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; titles: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const fetchData = useCallback(async (s?: string, st?: string) => {
    try {
      const params: Record<string, string> = {};
      if (s ?? search) params.search = s ?? search;
      if (st ?? statusFilter) params.status = st ?? statusFilter;
      const { data: res } = await api.get("/presentations", { params });
      setData(res);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchData(); }, [statusFilter]); // eslint-disable-line

  function handleSearch(v: string) {
    setSearch(v);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setLoading(true); fetchData(v, statusFilter); }, 300);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const { data: p } = await api.post("/presentations", {});
      router.push(`/presentation/${p.id}`);
    } catch { setCreating(false); }
  }

  async function handleDuplicate(id: string) { setOpenMenuId(null); await api.post(`/presentations/${id}/duplicate`); fetchData(); }

  // Selection helpers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selectedIds.size === data.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.items.map((p) => p.id)));
    }
  }

  // Delete flow
  function requestDeleteSingle(id: string, title: string) {
    setOpenMenuId(null);
    setConfirmDelete({ ids: [id], titles: [title] });
  }

  function requestDeleteSelected() {
    if (!data) return;
    const items = data.items.filter((p) => selectedIds.has(p.id));
    setConfirmDelete({ ids: items.map((p) => p.id), titles: items.map((p) => p.title) });
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await Promise.all(confirmDelete.ids.map((id) => api.delete(`/presentations/${id}`)));
      const count = confirmDelete.ids.length;
      showToast(count === 1 ? t("presentationDeleted") : `${t("presentationDeleted")} (${count})`);
      setSelectedIds(new Set());
      setConfirmDelete(null);
      fetchData();
    } catch {
      showToast(t("error"));
    } finally {
      setDeleting(false);
    }
  }

  const { t, language, setLanguage, isRTL } = useLanguage();

  const FILTERS = [
    { value: "", labelKey: "all" },
    { value: "draft", labelKey: "draft" },
    { value: "input_complete", labelKey: "inProgress" },
    { value: "exported", labelKey: "completed" },
  ];

  function timeAgo(d: string) {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return t("justNow");
    if (m < 60) return isRTL ? `منذ ${m} دقيقة` : `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return isRTL ? `منذ ${h} ساعة` : `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
    return new Date(d).toLocaleDateString();
  }

  const hasSelection = selectedIds.size > 0;
  const allSelected = data ? selectedIds.size === data.items.length && data.items.length > 0 : false;

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
          <p className="mt-1 text-sm text-gray-500">{t("createAndManage")}</p>
        </div>
        <button onClick={handleCreate} disabled={creating} className="btn-primary h-11 px-6 shadow-lg">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          {creating ? t("loading") : t("newPresentation")}
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-6 card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        {/* Select all checkbox */}
        {data && data.items.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
            title={allSelected ? t("deselectAll") : t("selectAll")}
          >
            <div className={`flex h-4.5 w-4.5 items-center justify-center rounded border-2 transition-all ${
              allSelected ? "border-[#00338D] bg-[#00338D]" : selectedIds.size > 0 ? "border-[#00338D] bg-[#00338D]/20" : "border-gray-300"
            }`}>
              {allSelected && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              {!allSelected && selectedIds.size > 0 && <div className="h-1.5 w-1.5 rounded-sm bg-[#00338D]" />}
            </div>
          </button>
        )}
        <div className="relative flex-1">
          <svg className="absolute inset-inline-start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-field ps-10"
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
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton h-32 w-full rounded-none" />
              <div className="p-4">
                <div className="skeleton mb-3 h-4 w-3/4" />
                <div className="mb-3 flex gap-1">{[1,2,3,4,5].map(j=><div key={j} className="skeleton h-1 flex-1 rounded-full"/>)}</div>
                <div className="skeleton h-3 w-1/2" />
              </div>
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
            {search || statusFilter ? t("noPresMatch") : t("noPresYet")}
          </p>
          <p className="mt-1.5 text-sm text-gray-400">
            {search || statusFilter ? t("adjustFilters") : t("createFirstDesc")}
          </p>
          {!search && !statusFilter && (
            <button onClick={handleCreate} disabled={creating} className="btn-primary mt-6 h-11 px-6">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t("createPresentation")}
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && data && data.items.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 animate-fade-in">
          {data.items.map((p) => {
            const meta = STATUS_META[p.status] || STATUS_META.draft;
            const llm = p.llm_provider ? LLM[p.llm_provider] : null;
            const isChecked = selectedIds.has(p.id);
            return (
              <div
                key={p.id}
                onClick={() => { if (!hasSelection) router.push(`/presentation/${p.id}`); else toggleSelect(p.id); }}
                className={`card-hover group relative cursor-pointer overflow-hidden border-s-[3px] transition-all ${meta.borderColor} ${
                  isChecked ? "ring-2 ring-[#00338D] ring-offset-1" : ""
                }`}
              >
                {/* ── Dynamic Thumbnail ── */}
                <div className="relative h-32 overflow-hidden bg-gradient-to-br from-slate-50 to-gray-100">
                  {/* Status-based thumbnail content */}
                  {meta.stepsDone <= 1 ? (
                    /* Draft / Input saved: prompt excerpt */
                    <div className="flex h-full flex-col justify-center px-5 py-3 bg-gradient-to-br from-[#00338D]/[0.03] via-white to-[#0091DA]/[0.06]">
                      {p.prompt_excerpt ? (
                        <p className="text-[10px] italic leading-relaxed text-gray-500 line-clamp-4">&ldquo;{p.prompt_excerpt}&rdquo;</p>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-300">
                          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          <span className="text-[9px]">{t("draft")}</span>
                        </div>
                      )}
                    </div>
                  ) : meta.stepsDone === 2 ? (
                    /* Plan complete: section titles */
                    <div className="flex h-full flex-col px-4 py-3">
                      {p.section_titles && p.section_titles.length > 0 ? (
                        <>
                          <div className="space-y-1 flex-1">
                            {p.section_titles.slice(0, 5).map((s, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-[#00338D]/60" />
                                <p className="truncate text-[8px] font-medium text-gray-600">{s}</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-auto text-end text-[9px] font-medium text-[#0091DA]">
                            {p.section_count} {isRTL ? 'أقسام' : 'sections'}
                          </p>
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <p className="text-[9px] text-gray-400">{t("planComplete")}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Content/Design/Exported: mini slide */
                    <div className="flex h-full flex-col bg-white">
                      <div className="h-1 w-full bg-[#00338D]" />
                      <div className="flex-1 px-3 py-2">
                        <p className="text-[9px] font-bold text-gray-800 line-clamp-2 leading-tight">{p.first_slide_title || p.title}</p>
                        {p.first_slide_bullets && p.first_slide_bullets.length > 0 ? (
                          <div className="mt-1.5 space-y-[3px]">
                            {p.first_slide_bullets.map((b, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[#0091DA]" />
                                <p className="text-[7px] leading-tight text-gray-500 line-clamp-1">{b}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            <div className="h-1 w-4/5 rounded bg-gray-200/60" />
                            <div className="h-1 w-3/5 rounded bg-gray-200/40" />
                            <div className="h-1 w-2/3 rounded bg-gray-200/30" />
                          </div>
                        )}
                        {(p.has_chart || p.has_table) && (
                          <div className="mt-auto flex gap-1.5 pt-1">
                            {p.has_chart && (
                              <svg className="h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13h4v8H3zm7-5h4v13h-4zm7-5h4v18h-4z" /></svg>
                            )}
                            {p.has_table && (
                              <svg className="h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" /></svg>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/10 group-hover:opacity-100">
                    <span className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm backdrop-blur-sm opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                      {meta.stepsDone < 5
                        ? `${isRTL ? 'متابعة الخطوة' : 'Continue Step'} ${meta.stepsDone + 1}`
                        : t("open")
                      }
                    </span>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`absolute inset-inline-start-2 top-2 z-10 transition-opacity ${
                      isChecked || hasSelection ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all cursor-pointer shadow-sm ${
                      isChecked ? "border-[#00338D] bg-[#00338D]" : "border-gray-300 bg-white hover:border-gray-400"
                    }`}>
                      {isChecked && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>

                  {/* Menu */}
                  <div className="absolute inset-inline-end-2 top-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                      className="rounded-lg bg-white/80 p-1 text-gray-400 opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-gray-600 group-hover:opacity-100"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" /></svg>
                    </button>
                    {openMenuId === p.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute inset-inline-end-0 z-20 mt-1 w-40 animate-fade-in rounded-xl border border-gray-200 bg-white py-1.5 shadow-elevated">
                          <button onClick={() => { setOpenMenuId(null); router.push(`/presentation/${p.id}`); }} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            {t("open")}
                          </button>
                          <button onClick={() => handleDuplicate(p.id)} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            {t("duplicate")}
                          </button>
                          <button onClick={() => requestDeleteSingle(p.id, p.title)} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            {t("delete")}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Card body ── */}
                <div className="px-4 pb-4 pt-3">
                  {/* Title */}
                  <h3 className="mb-2.5 text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{p.title}</h3>

                  {/* Step progress bar */}
                  <div className="mb-3 flex items-center gap-1">
                    {STEP_LABELS.map((label, i) => {
                      const done = i < meta.stepsDone;
                      const current = i === meta.stepsDone && meta.stepsDone < 5;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div className={`h-1 w-full rounded-full transition-all ${
                            done ? "bg-[#00338D]" : current ? "bg-amber-400" : "bg-gray-200"
                          }`} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Badges row */}
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <span className={`badge ${meta.badgeCls}`}>
                      {meta.dot && <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} animate-pulse-dot`} />}
                      {meta.labelKey === "completed" && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      {t(meta.labelKey)}
                    </span>
                    <span className="badge border border-gray-200 bg-white text-gray-500">{LANG[p.language] || "EN"}</span>
                    {llm && <span className={`text-[10px] font-semibold ${llm.cls}`}>{llm.label}</span>}
                  </div>

                  {/* Footer: action context + time */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>{t(meta.actionKey)}</span>
                    <span>{timeAgo(p.updated_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && data && data.total > data.page_size && (
        <p className="mt-8 text-center text-sm text-gray-400">
          {data.items.length} {t("of")} {data.total}
        </p>
      )}

      {/* ── Floating Action Bar ── */}
      {hasSelection && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center animate-fade-in">
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-3 shadow-elevated">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} {t("selected")}
            </span>
            <div className="h-5 w-px bg-gray-200" />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-500 transition-colors hover:text-gray-700"
            >
              {t("cancel")}
            </button>
            <button
              onClick={requestDeleteSelected}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              {t("deleteSelected")}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            {/* Warning icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="mb-2 text-center text-lg font-semibold text-gray-900">
              {confirmDelete.ids.length === 1
                ? t("deletePresentation")
                : `${t("delete")} ${confirmDelete.ids.length} ${isRTL ? 'عروض تقديمية' : 'Presentations'}?`
              }
            </h3>
            <p className="mb-6 text-center text-sm text-gray-500">
              {t("deleteConfirmMsg")}
            </p>

            {/* Show titles for context */}
            {confirmDelete.titles.length <= 3 && (
              <div className="mb-6 space-y-1">
                {confirmDelete.titles.map((title, i) => (
                  <p key={i} className="truncate rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-700">{title}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="btn-secondary flex-1"
              >
                {t("cancel")}
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    {t("delete")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div className="fixed bottom-6 inset-inline-start-6 z-50 animate-fade-in">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-elevated">
            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            {toast}
          </div>
        </div>
      )}

      {/* Bottom spacer when floating bar is visible */}
      {hasSelection && <div className="h-20" />}
    </main>
  );
}
