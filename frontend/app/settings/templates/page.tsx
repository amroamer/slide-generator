"use client";

import { ObjectInspector } from "@/components/settings/object-inspector";
import { SlideProperties } from "@/components/settings/slide-properties";
import { SlideViewerModal } from "@/components/settings/slide-viewer-modal";
import api from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ===== Types ===== */
interface Metrics {
  parsing_status: {
    overall: string; total_objects: number; total_parsed: number; total_failed: number;
    text: { count: number; parsed: number; failed: number; status: string; details: string[] };
    shapes: { count: number; parsed: number; failed: number; status: string; details: string[] };
    images: { count: number; parsed: number; failed: number; status: string; details: string[] };
    tables: { count: number; parsed: number; failed: number; status: string; details: string[] };
    charts: { count: number; parsed: number; failed: number; status: string; details: string[] };
    groups: { count: number; parsed: number; failed: number; status: string; details: string[] };
  };
  content_slots: { total: number; title_slots: number; subtitle_slots: number; body_slots: number; item_slots: number; label_slots: number; date_slots: number; slots: any[] };
  usability: string; quality_score: number;
  quality_breakdown: Record<string, { points: number; max: number; detail: string }>;
}

interface Variation {
  id: string; variation_index: number; variation_name: string; tags: string[] | null;
  thumbnail_path: string | null; is_favorite: boolean; usage_count: number; design_summary: any; metrics?: Metrics;
  auto_name?: string; custom_name?: string; is_enabled?: boolean; is_primary?: boolean;
}

interface Collection {
  id: string; name: string; description: string | null; icon: string | null;
  color: string | null; source_filename: string; variation_count: number;
  created_at: string; preview_variations: Variation[];
  slide_type_category?: string; mapped_slide_types?: string[]; extracted_colors?: string[];
}

interface CollectionDetail extends Collection { variations: Variation[] }

const SLIDE_CATEGORIES = [
  { value: "title", label: "Title Slides", types: ["title", "summary"] },
  { value: "content", label: "Content / Bullets", types: ["content"] },
  { value: "charts", label: "Charts", types: ["chart"] },
  { value: "tables", label: "Tables", types: ["table"] },
  { value: "kpi", label: "KPI Dashboards", types: ["chart"] },
  { value: "roadmap", label: "Roadmaps / Timelines", types: ["content"] },
  { value: "comparison", label: "Comparisons", types: ["comparison", "two_column"] },
  { value: "divider", label: "Section Dividers", types: ["section_divider"] },
  { value: "takeaway", label: "Takeaways / Conclusions", types: ["summary", "takeaway"] },
  { value: "mixed", label: "Mixed / Other", types: ["content", "chart", "table"] },
];

type SortMode = "default" | "quality" | "slots" | "name";
type FilterMode = "all" | "usable" | "decorative" | "issues";
type DetailTab = "slides" | "objects" | "properties";

/* ===== Icon paths ===== */
const IP: Record<string, string> = {
  text: "M4 7V4h16v3M9 20h6M12 4v16",
  shapes: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  images: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  tables: "M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z",
  charts: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  warn: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  slots: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  chevL: "M15 19l-7-7 7-7",
  chevR: "M9 5l7 7-7 7",
};

function Ico({ d, className }: { d: string; className?: string }) {
  return <svg className={className || "h-3 w-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

/* ===== Shared small components ===== */
function ParsingIcon({ type, status, count }: { type: string; status: string; count: number }) {
  if (count === 0) return null;
  const st: Record<string, string> = { success: "text-emerald-500 bg-emerald-50", partial: "text-amber-500 bg-amber-50", failed: "text-rose-500 bg-rose-50", none: "text-gray-300 bg-gray-50" };
  const tips: Record<string, string> = { success: `${count} ${type} \u2014 all parsed`, partial: `${count} ${type} \u2014 some failed`, failed: `${count} ${type} \u2014 failed`, none: `No ${type}` };
  return (
    <div className={`relative w-5 h-5 rounded flex items-center justify-center ${st[status] || st.none}`} title={tips[status] || ""}>
      <Ico d={IP[type] || IP.shapes} className="w-3 h-3" />
      {status === "failed" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />}
      {status === "partial" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />}
    </div>
  );
}

function QualityBadge({ score, size = "w-7 h-7" }: { score: number; size?: string }) {
  let bg: string, ring: string;
  if (score >= 80) { bg = "bg-emerald-500"; ring = "ring-emerald-500/30"; }
  else if (score >= 60) { bg = "bg-blue-500"; ring = "ring-blue-500/30"; }
  else if (score >= 40) { bg = "bg-amber-500"; ring = "ring-amber-500/30"; }
  else { bg = "bg-gray-400"; ring = "ring-gray-400/30"; }
  return (
    <div className={`${size} rounded-full ${bg} text-white ring-2 ${ring} flex items-center justify-center shadow-sm`} title={`Quality: ${score}/100`}>
      <span className="text-[9px] font-bold">{score}</span>
    </div>
  );
}

function UsabilityPill({ usability }: { usability?: string }) {
  if (!usability) return null;
  const m: Record<string, string> = {
    fully_usable: "bg-emerald-50 text-emerald-700", partially_usable: "bg-blue-50 text-blue-700",
    limited: "bg-yellow-50 text-yellow-700", decorative_only: "bg-amber-50 text-amber-700",
  };
  return <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${m[usability] || "bg-gray-100 text-gray-500"}`}>{usability.replace(/_/g, " ")}</span>;
}

/* ===== Main page ===== */
export default function TemplatesPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detail panel
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<DetailTab>("slides");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "collection" | "variation"; id: string; name: string; count?: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCollections(); }, []);

  async function loadCollections() {
    try { const { data } = await api.get("/template-collections"); setCollections(data); }
    catch {} finally { setLoading(false); }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile); fd.append("name", uploadName.trim());
      fd.append("description", uploadDesc);
      if (uploadCategory) {
        fd.append("slide_type_category", uploadCategory);
        const cat = SLIDE_CATEGORIES.find(c => c.value === uploadCategory);
        if (cat) fd.append("mapped_slide_types", JSON.stringify(cat.types));
      }
      await api.post("/template-collections/upload", fd);
      await loadCollections();
      setShowUpload(false); setUploadFile(null); setUploadName(""); setUploadDesc(""); setUploadCategory("");
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  }

  async function openDetail(id: string) {
    try {
      const { data } = await api.get(`/template-collections/${id}`);
      setDetail(data);
      setSelectedIdx(0); // auto-select first
      setActiveTab("slides");
    } catch {}
  }

  async function handleDeleteCollection(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/template-collections/${id}`);
      setDetail(null); setConfirmDelete(null); await loadCollections();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  }

  async function handleDeleteVariation(collectionId: string, variationId: string) {
    setDeleting(true); setDeleteError(null);
    try {
      const { data } = await api.delete(`/template-collections/${collectionId}/variations/${variationId}`);
      setConfirmDelete(null);
      if (data.remaining_variations <= 0) { setDetail(null); await loadCollections(); }
      else { await openDetail(collectionId); await loadCollections(); }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) setDeleteError(msg);
      else console.error(err);
    }
    finally { setDeleting(false); }
  }

  async function handleRecompute() {
    if (!detail) return;
    setRecomputing(true);
    try { await api.post(`/template-collections/${detail.id}/recompute-metrics`); await openDetail(detail.id); }
    catch (err) { console.error(err); }
    finally { setRecomputing(false); }
  }

  async function handleSetPrimary(variationId: string) {
    if (!detail) return;
    try {
      await api.put(`/template-collections/${detail.id}/primary`, { variation_id: variationId });
      await openDetail(detail.id);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) alert(msg);
      else console.error(err);
    }
  }

  async function handleToggleEnabled(variationId: string, enabled: boolean) {
    if (!detail) return;
    try {
      await api.put(`/template-collections/${detail.id}/variations/${variationId}`, { is_enabled: enabled });
      await openDetail(detail.id);
    } catch (err) { console.error(err); }
  }

  async function handleRenameVariation(variationId: string, newName: string) {
    if (!detail || !newName.trim()) return;
    try {
      await api.put(`/template-collections/${detail.id}/variations/${variationId}`, { custom_name: newName.trim() });
      await openDetail(detail.id);
    } catch (err) { console.error(err); }
    finally { setEditingName(null); }
  }

  // Filtered + sorted list
  const filteredVars = useMemo(() => {
    if (!detail?.variations) return [];
    let list = [...detail.variations];
    if (filterMode === "usable") list = list.filter(v => { const u = v.metrics?.usability; return u === "fully_usable" || u === "partially_usable"; });
    else if (filterMode === "decorative") list = list.filter(v => v.metrics?.usability === "decorative_only");
    else if (filterMode === "issues") list = list.filter(v => (v.metrics?.parsing_status?.total_failed || 0) > 0);
    if (sortMode === "quality") list.sort((a, b) => (b.metrics?.quality_score || 0) - (a.metrics?.quality_score || 0));
    else if (sortMode === "slots") list.sort((a, b) => (b.metrics?.content_slots?.total || 0) - (a.metrics?.content_slots?.total || 0));
    else if (sortMode === "name") list.sort((a, b) => a.variation_name.localeCompare(b.variation_name));
    return list;
  }, [detail?.variations, sortMode, filterMode]);

  // Selected variation (from the full unfiltered list)
  const selectedVar = detail?.variations?.[selectedIdx] || null;

  // Navigate between variations
  const goPrev = useCallback(() => {
    if (!detail?.variations) return;
    setSelectedIdx(i => Math.max(0, i - 1));
  }, [detail?.variations]);
  const goNext = useCallback(() => {
    if (!detail?.variations) return;
    setSelectedIdx(i => Math.min((detail?.variations?.length || 1) - 1, i + 1));
  }, [detail?.variations]);

  // Keyboard
  useEffect(() => {
    if (!detail) return;
    function onKey(e: KeyboardEvent) {
      if (viewerOpen || showUpload || confirmDelete) return;
      if (e.key === "Escape") { setDetail(null); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "1") setActiveTab("slides");
      if (e.key === "2") setActiveTab("objects");
      if (e.key === "3") setActiveTab("properties");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, viewerOpen, showUpload, confirmDelete, goPrev, goNext]);

  // Collection card helpers
  function avgQuality(c: Collection): number | null {
    const s = c.preview_variations.map(v => v.metrics?.quality_score).filter((n): n is number => n != null);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  }
  function issues(c: Collection) {
    const v = c.preview_variations;
    return {
      decorative: v.length > 0 && v.filter(x => x.metrics?.usability === "decorative_only").length > v.length * 0.5,
      parsing: v.length > 0 && v.filter(x => (x.metrics?.parsing_status?.total_failed || 0) > 0).length > v.length * 0.3,
    };
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" /></div>;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Slide Template Library</h2>
          <p className="mt-1 text-sm text-gray-500">Upload PowerPoint files to create reusable slide design collections</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary h-10 px-5 text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Upload Template
        </button>
      </div>

      {/* Collections grid */}
      {collections.length === 0 ? (
        <div className="card flex flex-col items-center py-16 animate-fade-in">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <p className="text-lg font-semibold text-gray-700">No template collections yet</p>
          <p className="mt-1 text-sm text-gray-400">Upload a themed PowerPoint file to get started</p>
          <button onClick={() => setShowUpload(true)} className="btn-primary mt-4">Upload Template</button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 animate-fade-in">
          {collections.map(c => {
            const aq = avgQuality(c); const iss = issues(c);
            return (
              <div key={c.id} onClick={() => openDetail(c.id)} className="card-hover overflow-hidden cursor-pointer group relative">
                <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: "collection", id: c.id, name: c.name, count: c.variation_count }); }}
                  className="absolute top-3 right-3 z-10 rounded-lg p-1.5 text-gray-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <div className="h-2" style={{ background: c.color || "#2563EB" }} />
                <div className="p-4">
                  <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                  {c.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1 mb-3">{c.description}</p>}
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-50 p-2 mb-3 mt-2">
                    {c.preview_variations.slice(0, 4).map((v: any) => (
                      <div key={v.id} className="aspect-[16/9] rounded bg-gray-200 overflow-hidden">
                        {v.thumbnail_path ? <img src={v.thumbnail_path} alt={v.variation_name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">{v.variation_index + 1}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
                    <span className="badge bg-gray-100 text-gray-600">{c.variation_count} variations</span>
                    {c.slide_type_category && (
                      <span className="badge bg-blue-50 text-blue-600">{SLIDE_CATEGORIES.find(sc => sc.value === c.slide_type_category)?.label || c.slide_type_category}</span>
                    )}
                    {aq != null && <span>Avg quality: {aq}</span>}
                    <span className="flex-1" />
                    {iss.decorative && <span className="badge bg-amber-50 text-amber-600">decorative</span>}
                    {iss.parsing && <span className="badge bg-rose-50 text-rose-500">issues</span>}
                  </div>
                  {c.extracted_colors && c.extracted_colors.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {c.extracted_colors.slice(0, 8).map((clr, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-gray-200" style={{ background: clr }} title={clr} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !uploading && setShowUpload(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-modal">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Template Collection</h3>
            <div className="mb-4">
              <input ref={fileRef} type="file" accept=".pptx" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-4 text-center hover:border-gray-400 transition-all">
                {uploadFile ? <p className="text-sm font-medium text-gray-800">{uploadFile.name}</p> : <><p className="text-sm text-gray-600">Click to select a .pptx file</p><p className="text-xs text-gray-400">Each slide becomes a design variation</p></>}
              </button>
            </div>
            <div className="mb-3"><label className="mb-1 block text-sm font-medium text-gray-700">Collection Name</label><input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="e.g., Roadmap, SWOT" className="input-field" /></div>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">Slide Type Category</label>
              <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="input-field">
                <option value="">Select a category (optional)</option>
                {SLIDE_CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
              </select>
            </div>
            <div className="mb-4"><label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label><input value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="What slides are in this collection?" className="input-field" /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowUpload(false)} disabled={uploading} className="btn-secondary h-10 text-sm">Cancel</button>
              <button onClick={handleUpload} disabled={!uploadFile || !uploadName.trim() || uploading} className="btn-primary h-10 text-sm">
                {uploading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Processing...</> : "Upload & Process"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== DETAIL PANEL (3-zone layout) ========== */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div ref={panelRef} className="relative z-10 w-[540px] h-full bg-white shadow-modal flex flex-col animate-slide-in" tabIndex={-1}>

            {/* ── Zone 1: Header ── */}
            <div className="shrink-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-6 rounded-full" style={{ background: detail.color || "#2563EB" }} />
                  <h3 className="text-sm font-semibold text-gray-900">{detail.name}</h3>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 pl-8">From: {detail.source_filename}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={handleRecompute} disabled={recomputing} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50" title="Recompute metrics">
                  {recomputing ? <div className="h-4 w-4 animate-spin rounded-full border border-gray-300 border-t-gray-600" /> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                </button>
                <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* ── Zone 2: Selected Slide Context Strip ── */}
            <div className="shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-3">
              {selectedVar ? (
                <div className="flex gap-3 items-start">
                  {/* Thumbnail */}
                  <div className="shrink-0 w-[140px] rounded-lg border-2 border-blue-500 shadow-sm overflow-hidden bg-white" style={{ aspectRatio: "16/9" }}>
                    {selectedVar.thumbnail_path ? (
                      <img key={selectedVar.id} src={selectedVar.thumbnail_path} alt={selectedVar.variation_name}
                        className="w-full h-full object-cover transition-opacity duration-200" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{selectedVar.variation_name}</div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{selectedVar.variation_name}</p>
                      {selectedVar.metrics?.quality_score != null && <QualityBadge score={selectedVar.metrics.quality_score} size="w-5 h-5" />}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Slide {selectedIdx + 1} of {detail.variations.length}</p>
                    {/* Quick stats */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {selectedVar.metrics && (
                        <>
                          <span className="text-[9px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{selectedVar.metrics.parsing_status.total_objects} objects</span>
                          <span className="text-[9px] bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">{selectedVar.metrics.content_slots.total} slots</span>
                          <UsabilityPill usability={selectedVar.metrics.usability} />
                        </>
                      )}
                    </div>
                    {/* Tags */}
                    {selectedVar.tags && selectedVar.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {selectedVar.tags.slice(0, 4).map((t, i) => (
                          <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Nav arrows */}
                  <div className="shrink-0 flex flex-col gap-1 pt-2">
                    <button onClick={goPrev} disabled={selectedIdx <= 0}
                      className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Ico d={IP.chevL} className="w-3 h-3 text-gray-600" />
                    </button>
                    <button onClick={goNext} disabled={selectedIdx >= (detail.variations.length - 1)}
                      className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Ico d={IP.chevR} className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-[140px] rounded-lg border-2 border-dashed border-gray-300 bg-white flex items-center justify-center text-gray-400" style={{ aspectRatio: "16/9" }}>
                    <Ico d={IP.images} className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-gray-400">Select a slide to inspect</p>
                </div>
              )}
            </div>

            {/* ── Zone 3: Tabs + Content ── */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Tab bar */}
              <div className="shrink-0 flex items-center border-b border-gray-200 bg-white px-4">
                {([["slides", "All Slides"], ["objects", "Objects"], ["properties", "Properties"]] as const).map(([key, label]) => {
                  const disabled = !selectedVar && key !== "slides";
                  return (
                    <button key={key} onClick={() => !disabled && setActiveTab(key as DetailTab)}
                      disabled={disabled}
                      className={`px-3 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                        activeTab === key ? "border-blue-500 text-blue-700" :
                        disabled ? "border-transparent text-gray-300 cursor-not-allowed" :
                        "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                      title={disabled ? "Select a slide first" : undefined}>
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content (scrollable) */}
              <div className="flex-1 overflow-y-auto">

                {/* ── ALL SLIDES TAB ── */}
                {activeTab === "slides" && (
                  <div className="p-4">
                    {/* Sort/filter bar */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{filteredVars.length} slides</p>
                      <span className="flex-1" />
                      <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="default">Default</option><option value="quality">Quality</option><option value="slots">Slots</option><option value="name">Name</option>
                      </select>
                      <select value={filterMode} onChange={e => setFilterMode(e.target.value as FilterMode)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="all">All</option><option value="usable">Usable</option><option value="decorative">Decorative</option><option value="issues">Issues</option>
                      </select>
                    </div>

                    {/* Variation grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {filteredVars.map(v => {
                        const vi = detail.variations.findIndex(dv => dv.id === v.id);
                        const isSelected = vi === selectedIdx;
                        const m = v.metrics;
                        const isDisabled = v.is_enabled === false;
                        return (
                          <div key={v.id}
                            className={`group/var relative rounded-lg overflow-hidden transition-all cursor-pointer ${
                              isDisabled ? "opacity-50" : ""
                            } ${
                              isSelected ? "ring-2 ring-blue-500 bg-blue-50/30 shadow-md" : "border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                            }`}
                            onClick={() => setSelectedIdx(vi)}
                            onDoubleClick={() => { setViewerIndex(vi); setViewerOpen(true); }}>
                            {/* Selected checkmark */}
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                            {/* Primary star */}
                            <button
                              className={`absolute top-1.5 left-1.5 z-20 w-5 h-5 flex items-center justify-center transition-colors ${v.is_primary ? "text-amber-400" : "text-gray-300 opacity-0 group-hover/var:opacity-100 hover:text-amber-400"}`}
                              title={v.is_primary ? "Primary variation" : "Set as primary"}
                              onClick={e => { e.stopPropagation(); if (!v.is_primary) handleSetPrimary(v.id); }}>
                              {v.is_primary
                                ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                              }
                            </button>
                            {/* Thumbnail */}
                            <div className="aspect-[16/9] bg-gray-100 overflow-hidden relative">
                              {v.thumbnail_path ? (
                                <img src={v.thumbnail_path} alt={v.variation_name} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{v.variation_name}</div>
                              )}
                              {/* Quality badge */}
                              {m?.quality_score != null && (
                                <div className="absolute bottom-1.5 left-1.5 z-10"><QualityBadge score={m.quality_score} /></div>
                              )}
                              {/* Hover overlay: fullscreen + delete */}
                              <div className="absolute inset-0 bg-black/0 group-hover/var:bg-black/20 transition-all flex items-center justify-center">
                                <div className="flex gap-2 opacity-0 group-hover/var:opacity-100 transition-opacity">
                                  <button className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white" title="Full screen"
                                    onClick={e => { e.stopPropagation(); setViewerIndex(vi); setViewerOpen(true); }}>
                                    <svg className="h-3.5 w-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  </button>
                                  <button className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white" title="Delete"
                                    onClick={e => { e.stopPropagation(); setConfirmDelete({ type: "variation", id: v.id, name: v.variation_name }); }}>
                                    <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Compact info row */}
                            <div className="px-2 py-1.5">
                              <div className="flex items-center gap-1 mb-1">
                                {m?.parsing_status && (
                                  <>
                                    <ParsingIcon type="text" status={m.parsing_status.text.status} count={m.parsing_status.text.count} />
                                    <ParsingIcon type="shapes" status={m.parsing_status.shapes.status} count={m.parsing_status.shapes.count} />
                                    <ParsingIcon type="images" status={m.parsing_status.images.status} count={m.parsing_status.images.count} />
                                    <ParsingIcon type="tables" status={m.parsing_status.tables.status} count={m.parsing_status.tables.count} />
                                    <ParsingIcon type="charts" status={m.parsing_status.charts.status} count={m.parsing_status.charts.count} />
                                  </>
                                )}
                                {m?.content_slots && (
                                  <span className="ml-auto text-[9px] text-blue-600 font-medium">{m.content_slots.total}s</span>
                                )}
                              </div>
                              {/* Variation name (editable) + primary label */}
                              <div className="flex items-center gap-1">
                                {editingName === v.id ? (
                                  <input
                                    autoFocus
                                    value={editNameValue}
                                    onChange={e => setEditNameValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleRenameVariation(v.id, editNameValue); if (e.key === "Escape") setEditingName(null); }}
                                    onBlur={() => handleRenameVariation(v.id, editNameValue)}
                                    onClick={e => e.stopPropagation()}
                                    className="text-[11px] font-medium text-gray-900 bg-white border border-blue-300 rounded px-1 py-0 w-full outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                ) : (
                                  <>
                                    <p className="text-[11px] font-medium text-gray-900 truncate">{v.custom_name || v.variation_name}</p>
                                    <button
                                      className="shrink-0 text-gray-300 hover:text-gray-500 opacity-0 group-hover/var:opacity-100 transition-opacity"
                                      title="Rename"
                                      onClick={e => { e.stopPropagation(); setEditingName(v.id); setEditNameValue(v.custom_name || v.variation_name); }}>
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                  </>
                                )}
                              </div>
                              {/* Primary label + enable toggle */}
                              <div className="flex items-center gap-1.5 mt-1">
                                {v.is_primary && (
                                  <span className="text-[8px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Primary</span>
                                )}
                                {/* Enable/disable toggle */}
                                <button
                                  className={`ml-auto shrink-0 w-7 h-4 rounded-full relative transition-colors ${v.is_enabled !== false ? "bg-emerald-400" : "bg-gray-300"}`}
                                  title={v.is_enabled !== false ? "Enabled - click to disable" : "Disabled - click to enable"}
                                  onClick={e => { e.stopPropagation(); handleToggleEnabled(v.id, v.is_enabled === false); }}>
                                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${v.is_enabled !== false ? "left-3.5" : "left-0.5"}`} />
                                </button>
                              </div>
                              {(v.tags || []).length > 0 && (
                                <div className="flex gap-1 mt-0.5 flex-wrap">
                                  {(v.tags || []).slice(0, 2).map((t, i) => (
                                    <span key={i} className="rounded bg-gray-100 px-1 py-0.5 text-[8px] text-gray-500">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {filteredVars.length === 0 && detail.variations.length > 0 && (
                      <div className="py-8 text-center">
                        <p className="text-sm text-gray-400">No variations match this filter</p>
                        <button onClick={() => setFilterMode("all")} className="mt-2 text-xs text-blue-500 hover:underline">Show all</button>
                      </div>
                    )}

                    <button onClick={() => setConfirmDelete({ type: "collection", id: detail.id, name: detail.name, count: detail.variations?.length || 0 })}
                      className="mt-6 w-full rounded-lg border border-rose-200 py-2 text-xs font-medium text-rose-500 transition-all hover:bg-rose-50">
                      Delete Collection
                    </button>
                  </div>
                )}

                {/* ── OBJECTS TAB ── */}
                {activeTab === "objects" && selectedVar && (
                  <div className="p-4">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 mb-3 text-[10px] text-gray-400">
                      <button onClick={() => setActiveTab("slides")} className="hover:text-blue-500 transition-colors">All Slides</button>
                      <Ico d={IP.chevR} className="w-2.5 h-2.5" />
                      <span className="text-gray-600">{selectedVar.variation_name}</span>
                      <Ico d={IP.chevR} className="w-2.5 h-2.5" />
                      <span className="text-gray-600">Objects</span>
                    </div>
                    {/* Compact stats bar */}
                    {selectedVar.metrics?.parsing_status && (
                      <div className="text-[10px] text-gray-500 mb-3">
                        {selectedVar.metrics.parsing_status.total_objects} objects parsed &middot; {selectedVar.metrics.parsing_status.total_parsed}/{selectedVar.metrics.parsing_status.total_objects} successful
                        {selectedVar.metrics.parsing_status.total_failed > 0 && (
                          <span className="text-rose-500"> &middot; {selectedVar.metrics.parsing_status.total_failed} failed</span>
                        )}
                      </div>
                    )}
                    {/* Object inspector */}
                    <div className="rounded-lg border border-gray-200 bg-white p-3" style={{ minHeight: "300px" }}>
                      <ObjectInspector key={selectedVar.id} collectionId={detail.id} variationId={selectedVar.id} />
                    </div>
                  </div>
                )}

                {/* ── PROPERTIES TAB ── */}
                {activeTab === "properties" && selectedVar && (
                  <div className="p-4">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 mb-3 text-[10px] text-gray-400">
                      <button onClick={() => setActiveTab("slides")} className="hover:text-blue-500 transition-colors">All Slides</button>
                      <Ico d={IP.chevR} className="w-2.5 h-2.5" />
                      <span className="text-gray-600">{selectedVar.variation_name}</span>
                      <Ico d={IP.chevR} className="w-2.5 h-2.5" />
                      <span className="text-gray-600">Properties</span>
                    </div>
                    <SlideProperties key={selectedVar.id} collectionId={detail.id} variationId={selectedVar.id} metrics={selectedVar.metrics || null} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide viewer modal */}
      {viewerOpen && detail?.variations && (
        <SlideViewerModal collectionName={detail.name} collectionId={detail.id} variations={detail.variations}
          initialIndex={viewerIndex} onClose={() => setViewerOpen(false)}
          onDelete={vid => { setViewerOpen(false); setConfirmDelete({ type: "variation", id: vid, name: detail.variations.find(v => v.id === vid)?.variation_name || "" }); }} />
      )}

      {/* Confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!deleting) { setConfirmDelete(null); setDeleteError(null); } }} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-modal text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete &ldquo;{confirmDelete.name}&rdquo;?</h3>
            <p className="mt-2 text-sm text-gray-500">
              {confirmDelete.type === "collection" ? `This will permanently delete all ${confirmDelete.count || 0} variations. Cannot be undone.` : "This variation will be permanently deleted."}
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => { setConfirmDelete(null); setDeleteError(null); }} disabled={deleting} className="btn-secondary h-10 px-5 text-sm">Cancel</button>
              <button onClick={() => { if (confirmDelete.type === "collection") handleDeleteCollection(confirmDelete.id); else if (detail) handleDeleteVariation(detail.id, confirmDelete.id); }}
                disabled={deleting} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-rose-700 disabled:opacity-50">
                {deleting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
