"use client";

import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* ===== Types ===== */
interface SlideHeader {
  enabled?: boolean;
  [key: string]: unknown;
}

interface SlideFooter {
  enabled?: boolean;
  [key: string]: unknown;
}

interface SlideAccentLine {
  enabled?: boolean;
  [key: string]: unknown;
}

interface BrandProfile {
  id: string;
  name: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  text_secondary_color: string;
  chart_colors: string[];
  font_heading: string;
  font_body: string;
  font_size_title: number;
  font_size_subtitle: number;
  font_size_body: number;
  font_size_caption: number;
  logo_url: string | null;
  logo_position: string;
  logo_size: string;
  slide_header: SlideHeader | null;
  slide_footer: SlideFooter | null;
  slide_accent_line: SlideAccentLine | null;
  slide_background_style: string;
  table_style: string;
  chart_style: string;
  is_default: boolean;
  is_system: boolean;
}

/* ===== Inline SVG Icons ===== */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DotsVerticalIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
    </svg>
  );
}

function DuplicateIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SeedIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className || "h-5 w-5"}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-12 w-12"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
    </svg>
  );
}

/* ===== Brand Preview Slide ===== */
function BrandPreviewSlide({ profile }: { profile: BrandProfile }) {
  const {
    background_color,
    primary_color,
    secondary_color,
    accent_color,
    text_color,
    text_secondary_color,
    slide_header,
    slide_footer,
    slide_accent_line,
    logo_url,
    logo_position,
  } = profile;

  const showHeader = slide_header?.enabled !== false;
  const showFooter = slide_footer?.enabled !== false;
  const showAccentLine = slide_accent_line?.enabled !== false;

  // Compute logo positioning
  const logoStyle: React.CSSProperties = {};
  if (logo_url) {
    logoStyle.position = "absolute";
    logoStyle.maxWidth = "14%";
    logoStyle.maxHeight = "14%";
    logoStyle.objectFit = "contain";
    const pos = (logo_position || "top-right").toLowerCase();
    if (pos.includes("top")) logoStyle.top = "2%";
    if (pos.includes("bottom")) logoStyle.bottom = "2%";
    if (pos.includes("left")) logoStyle.left = "3%";
    if (pos.includes("right")) logoStyle.right = "3%";
    if (pos === "center" || pos === "top-center" || pos === "bottom-center") {
      logoStyle.left = "50%";
      logoStyle.transform = "translateX(-50%)";
    }
  }

  return (
    <div
      className="aspect-[16/9] relative overflow-hidden"
      style={{ backgroundColor: background_color }}
    >
      {/* Header bar */}
      {showHeader && (
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: "8%", backgroundColor: primary_color }}
        />
      )}

      {/* Accent line below header */}
      {showAccentLine && (
        <div
          className="absolute left-0 right-0"
          style={{
            top: showHeader ? "8%" : "0",
            height: "4px",
            backgroundColor: secondary_color,
          }}
        />
      )}

      {/* Content area */}
      <div
        className="absolute left-0 right-0 px-[8%]"
        style={{
          top: showHeader ? "14%" : "6%",
          bottom: showFooter ? "10%" : "4%",
        }}
      >
        {/* Title */}
        <div
          className="font-bold truncate"
          style={{
            color: text_color,
            fontSize: "8%",
            lineHeight: 1.2,
            marginBottom: "2%",
          }}
        >
          Slide Title
        </div>
        {/* Subtitle */}
        <div
          className="truncate"
          style={{
            color: text_secondary_color,
            fontSize: "5.5%",
            lineHeight: 1.3,
            marginBottom: "2%",
          }}
        >
          Subtitle text here
        </div>
        {/* Accent underline */}
        <div
          style={{
            width: "20%",
            height: "2px",
            backgroundColor: secondary_color,
            marginBottom: "4%",
          }}
        />
        {/* Bullet lines */}
        <div className="space-y-[3%]">
          {[80, 65, 72, 55].map((w, i) => (
            <div key={i} className="flex items-center" style={{ gap: "3%" }}>
              <div
                className="rounded-full flex-shrink-0"
                style={{
                  width: "4px",
                  height: "4px",
                  backgroundColor: secondary_color,
                }}
              />
              <div
                className="rounded-sm"
                style={{
                  width: `${w}%`,
                  height: "4px",
                  backgroundColor: text_color,
                  opacity: 0.25,
                }}
              />
            </div>
          ))}
        </div>
        {/* Key takeaway box */}
        <div
          className="mt-[4%] rounded-sm"
          style={{
            borderLeft: `3px solid ${accent_color}`,
            backgroundColor: `${accent_color}11`,
            padding: "2% 3%",
          }}
        >
          <div
            className="rounded-sm"
            style={{
              width: "50%",
              height: "3px",
              backgroundColor: text_color,
              opacity: 0.2,
            }}
          />
        </div>
      </div>

      {/* Footer bar */}
      {showFooter && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: "4%", backgroundColor: primary_color }}
        />
      )}

      {/* Logo */}
      {logo_url && (
        <img
          src={logo_url}
          alt="Logo"
          style={logoStyle}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </div>
  );
}

/* ===== Card Menu ===== */
function CardMenu({
  profile,
  onDuplicate,
  onSetDefault,
  onDelete,
}: {
  profile: BrandProfile;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="Actions"
      >
        <DotsVerticalIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1 animate-fade-in">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDuplicate();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <DuplicateIcon className="h-4 w-4 text-gray-400" />
            Duplicate
          </button>
          {!profile.is_default && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onSetDefault();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <StarIcon className="h-4 w-4 text-gray-400" />
              Set as Default
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4 text-red-400" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== Profile Card ===== */
function ProfileCard({
  profile,
  onMutate,
  onRequestDelete,
}: {
  profile: BrandProfile;
  onMutate: () => void;
  onRequestDelete: (profile: BrandProfile) => void;
}) {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [acting, setActing] = useState(false);

  const handleDuplicate = async () => {
    setActing(true);
    try {
      await api.post(`/brand-profiles/${profile.id}/duplicate`);
      onMutate();
    } catch {
      // swallow
    } finally {
      setActing(false);
    }
  };

  const handleSetDefault = async () => {
    setActing(true);
    try {
      await api.post(`/brand-profiles/${profile.id}/set-default`);
      onMutate();
    } catch {
      // swallow
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      className={`group rounded-xl bg-white border overflow-hidden hover:shadow-md transition-all cursor-pointer relative ${
        profile.is_default ? "ring-1 ring-blue-300" : ""
      } ${acting ? "opacity-60 pointer-events-none" : ""}`}
      onClick={() => router.push(`/settings/brand-profiles/${profile.id}`)}
      onMouseEnter={() => setMenuVisible(true)}
      onMouseLeave={() => setMenuVisible(false)}
    >
      {/* Preview */}
      <BrandPreviewSlide profile={profile} />

      {/* Card info */}
      <div className="p-4">
        {/* Name + badges */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {profile.name}
          </span>
          {profile.is_default && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Default
            </span>
          )}
          {profile.is_system && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
              System
            </span>
          )}
        </div>

        {/* Color strip */}
        <div className="flex items-center gap-1.5 mb-2">
          {[
            profile.primary_color,
            profile.secondary_color,
            profile.accent_color,
            profile.background_color,
            profile.text_color,
            profile.text_secondary_color,
          ].map((color, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border border-gray-200"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        {/* Font info */}
        <div className="text-[10px] text-gray-400 truncate">
          {profile.font_heading} / {profile.font_body}
        </div>
      </div>

      {/* Three-dot menu overlay */}
      <div
        className={`absolute top-2 right-2 transition-opacity ${
          menuVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-sm">
          <CardMenu
            profile={profile}
            onDuplicate={handleDuplicate}
            onSetDefault={handleSetDefault}
            onDelete={() => onRequestDelete(profile)}
          />
        </div>
      </div>
    </div>
  );
}

/* ===== Main Page ===== */
export default function BrandProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrandProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importChecked, setImportChecked] = useState<Set<number>>(new Set());
  const [importParsing, setImportParsing] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/brand-profiles");
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load brand profiles";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api.post("/brand-profiles/seed");
      await fetchProfiles();
    } catch {
      // swallow
    } finally {
      setSeeding(false);
    }
  };

  async function handleExport() {
    try {
      const { data } = await api.get("/brand-profiles/export/xlsx", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "brand_profiles_export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const { data } = await api.get("/brand-profiles/import/template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "Brand_Profile_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  }

  function openImportModal() {
    setShowImportModal(true);
    setImportStep("upload");
    setImportPreview(null);
    setImportChecked(new Set());
    setImportResult(null);
    setImportError(null);
  }

  async function handleImportFile(file: File) {
    setImportParsing(true);
    setImportError(null);
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setImportError("Only Excel files (.xlsx) are accepted");
      setImportParsing(false);
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/brand-profiles/import/preview", fd);
      setImportPreview(data);
      const checked = new Set<number>();
      data.rows.forEach((r: any, i: number) => { if (r.action !== "error" && r.action !== "skip") checked.add(i); });
      setImportChecked(checked);
      setImportStep("preview");
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || err?.message || "Upload failed");
    } finally {
      setImportParsing(false);
    }
  }

  async function handleImportApply() {
    if (!importPreview) return;
    setImportApplying(true);
    try {
      const selectedRows = importPreview.rows.filter((_: any, i: number) => importChecked.has(i)).map((r: any) => r.data);
      const { data } = await api.post("/brand-profiles/import/apply", { rows: selectedRows });
      setImportResult(data);
      setImportStep("done");
      await fetchProfiles();
    } catch (err) {
      console.error("Import apply failed:", err);
    } finally {
      setImportApplying(false);
    }
  }

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/brand-profiles/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchProfiles();
    } catch {
      // swallow
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Brand Profiles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure visual themes applied to your presentation slides
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button onClick={openImportModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          <button
            onClick={() => router.push("/settings/brand-profiles/new")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00338D] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#00338D]/90 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Create Profile
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <SpinnerIcon className="h-8 w-8 text-[#00338D]/60" />
          <p className="mt-3 text-sm">Loading brand profiles...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchProfiles}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && profiles.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
          <div className="text-gray-300 mb-4">
            <PaletteIcon className="h-12 w-12" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            No brand profiles yet
          </h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm text-center">
            Brand profiles define colors, fonts, and layout styles applied to your
            generated slides. Create one to get started.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/settings/brand-profiles/new")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00338D] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#00338D]/90 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Create Profile
            </button>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {seeding ? (
                <SpinnerIcon className="h-4 w-4" />
              ) : (
                <SeedIcon className="h-4 w-4" />
              )}
              Seed System Profiles
            </button>
          </div>
        </div>
      )}

      {/* Profile grid */}
      {!loading && !error && profiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onMutate={fetchProfiles}
              onRequestDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <TrashIcon className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="mb-2 text-center text-lg font-semibold text-gray-900">
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h3>
            <p className="mb-6 text-center text-sm text-gray-500">
              This brand profile will be permanently deleted. Presentations using it will fall back to the default theme.
            </p>
            <div className="mb-6 overflow-hidden rounded-lg border border-gray-200">
              <BrandPreviewSlide profile={deleteTarget} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? (
                  <SpinnerIcon className="h-4 w-4" />
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => !importApplying && setShowImportModal(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-modal animate-fade-in max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Import Brand Profiles</h3>
              <button onClick={() => setShowImportModal(false)} className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {importStep === "upload" && (
              <div>
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                  <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  <p className="text-sm text-gray-600 mb-3">Upload an Excel file (.xlsx) with brand profiles</p>
                  <input type="file" accept=".xlsx,.xls" className="hidden" id="brand-import-file"
                    onChange={(e) => { if (e.target.files?.[0]) handleImportFile(e.target.files[0]); }} />
                  <label htmlFor="brand-import-file"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#00338D] px-4 py-2 text-sm font-medium text-white hover:bg-[#00338D]/90 transition-colors">
                    {importParsing ? <SpinnerIcon className="h-4 w-4" /> : "Choose File"}
                  </label>
                  {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <button onClick={handleDownloadTemplate} className="text-xs text-blue-600 hover:underline">Download blank template</button>
                  <p className="text-xs text-gray-400">Use the same format as Export</p>
                </div>
              </div>
            )}

            {importStep === "preview" && importPreview && (
              <div>
                <div className="mb-4 flex gap-3 text-sm">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">{importPreview.summary.create} new</span>
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">{importPreview.summary.update} update</span>
                  {importPreview.summary.error > 0 && <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">{importPreview.summary.error} errors</span>}
                </div>
                <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">
                          <input type="checkbox"
                            checked={importChecked.size === importPreview.rows.filter((r: any) => r.action !== "error").length}
                            onChange={() => {
                              const validIdxs = importPreview.rows.map((r: any, i: number) => r.action !== "error" ? i : -1).filter((i: number) => i >= 0);
                              setImportChecked(importChecked.size === validIdxs.length ? new Set() : new Set(validIdxs));
                            }}
                            className="rounded border-gray-300" />
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Color</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importPreview.rows.map((row: any, i: number) => (
                        <tr key={i} className={row.action === "error" ? "bg-red-50/50" : ""}>
                          <td className="px-3 py-2">
                            <input type="checkbox" disabled={row.action === "error"}
                              checked={importChecked.has(i)}
                              onChange={() => { const s = new Set(importChecked); s.has(i) ? s.delete(i) : s.add(i); setImportChecked(s); }}
                              className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                          <td className="px-3 py-2">
                            {row.primary_color && <span className="inline-block h-4 w-4 rounded-full border border-gray-200" style={{ background: row.primary_color }} />}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              row.action === "create" ? "bg-emerald-100 text-emerald-700" :
                              row.action === "update" ? "bg-amber-100 text-amber-700" :
                              row.action === "error" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{row.action}</span>
                            {row.errors?.length > 0 && <p className="text-[10px] text-red-500 mt-0.5">{row.errors.join(", ")}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setImportStep("upload")} className="btn-secondary px-4 py-2 text-sm">Back</button>
                  <button onClick={handleImportApply} disabled={importApplying || importChecked.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00338D] px-4 py-2 text-sm font-medium text-white hover:bg-[#00338D]/90 disabled:opacity-50 transition-colors">
                    {importApplying ? <SpinnerIcon className="h-4 w-4" /> : `Import ${importChecked.size} profiles`}
                  </button>
                </div>
              </div>
            )}

            {importStep === "done" && importResult && (
              <div className="text-center py-6">
                <svg className="mx-auto mb-3 h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h4 className="text-lg font-semibold text-gray-900 mb-1">Import Complete</h4>
                <p className="text-sm text-gray-500">{importResult.created} created, {importResult.updated} updated</p>
                <button onClick={() => setShowImportModal(false)} className="mt-4 btn-primary px-6 py-2 text-sm">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
