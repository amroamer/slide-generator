"use client";

import api from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* ===== Types ===== */
interface SlideHeader {
  enabled: boolean;
  color: string;
  height_percent: number;
}

interface SlideFooter {
  enabled: boolean;
  color: string;
  height_percent: number;
  show_page_number: boolean;
  show_date: boolean;
  show_confidentiality: boolean;
  confidentiality_text: string;
}

interface SlideAccentLine {
  enabled: boolean;
  position: string;
  thickness_px: number;
  color: string;
}

interface SlideGradient {
  start_color: string;
  end_color: string;
  direction: string;
}

interface BrandProfileForm {
  name: string;
  description: string;
  logo_path: string;
  logo_url: string | null;
  logo_position: string;
  logo_size: string;
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
  slide_header: SlideHeader;
  slide_footer: SlideFooter;
  slide_accent_line: SlideAccentLine;
  slide_background_style: string;
  slide_gradient: SlideGradient;
  table_header_color: string;
  table_header_text_color: string;
  table_alternate_row: boolean;
  table_alternate_color: string;
  table_border_color: string;
  table_style: string;
  chart_style: string;
  chart_show_grid: boolean;
  chart_show_legend: boolean;
  chart_legend_position: string;
  chart_bar_radius: number;
  is_default: boolean;
  is_system: boolean;
}

const DEFAULT_FORM: BrandProfileForm = {
  name: "",
  description: "",
  logo_path: "",
  logo_url: null,
  logo_position: "top-right",
  logo_size: "medium",
  primary_color: "#00338D",
  secondary_color: "#005EB8",
  accent_color: "#0091DA",
  background_color: "#FFFFFF",
  text_color: "#333333",
  text_secondary_color: "#666666",
  chart_colors: ["#00338D", "#005EB8", "#0091DA", "#483698", "#470A68", "#00A3A1", "#009A44", "#F2A900"],
  font_heading: "Calibri",
  font_body: "Calibri",
  font_size_title: 36,
  font_size_subtitle: 24,
  font_size_body: 14,
  font_size_caption: 10,
  slide_header: { enabled: true, color: "#00338D", height_percent: 8 },
  slide_footer: { enabled: true, color: "#00338D", height_percent: 5, show_page_number: true, show_date: false, show_confidentiality: false, confidentiality_text: "Confidential" },
  slide_accent_line: { enabled: true, position: "below-header", thickness_px: 4, color: "#005EB8" },
  slide_background_style: "solid",
  slide_gradient: { start_color: "#FFFFFF", end_color: "#F0F4F8", direction: "to-bottom" },
  table_header_color: "#00338D",
  table_header_text_color: "#FFFFFF",
  table_alternate_row: true,
  table_alternate_color: "#F8F9FA",
  table_border_color: "#E5E7EB",
  table_style: "striped",
  chart_style: "modern",
  chart_show_grid: true,
  chart_show_legend: true,
  chart_legend_position: "bottom",
  chart_bar_radius: 4,
  is_default: false,
  is_system: false,
};

const DEFAULT_CHART_COLORS = ["#00338D", "#005EB8", "#0091DA", "#483698", "#470A68", "#00A3A1", "#009A44", "#F2A900"];
const FONT_OPTIONS = ["Arial", "Calibri", "Poppins", "Inter", "Roboto", "Montserrat", "Open Sans", "Noto Sans Arabic"];

/* ===== Inline SVG Icons ===== */
function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg className={`${className || "h-4 w-4"} transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-8 w-8"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
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

/* ===== Collapsible Section ===== */
function Section({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 py-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        <ChevronIcon open={open} className="h-4 w-4 text-gray-400" />
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

/* ===== Color Swatch + Hex Input ===== */
function ColorField({ label, description, value, onChange }: { label: string; description?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-start gap-3">
      <label className="relative flex-shrink-0 cursor-pointer">
        <div className="h-9 w-9 rounded-lg border border-gray-300 shadow-sm" style={{ backgroundColor: value }} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
            }}
            className="w-24 rounded-md border border-gray-300 px-2 py-1 font-mono text-xs text-gray-600 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
        {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
      </div>
    </div>
  );
}

/* ===== Toggle Switch ===== */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-gray-900" : "bg-gray-300"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

/* ===== Radio Pills ===== */
function RadioPills({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ===== Radio Cards ===== */
function RadioCards({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${
            value === opt.value ? "border-gray-900 bg-gray-50 text-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ===== Live Preview: Title Slide ===== */
function TitleSlidePreview({ form }: { form: BrandProfileForm }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Title Slide</p>
      <div className="aspect-[16/9] w-full rounded-lg border border-gray-200 shadow-sm overflow-hidden relative" style={{ backgroundColor: form.primary_color }}>
        {/* Accent line at bottom third */}
        {form.slide_accent_line.enabled && (
          <div className="absolute left-[8%] right-[50%]" style={{ top: "62%", height: `${form.slide_accent_line.thickness_px}px`, backgroundColor: form.slide_accent_line.color }} />
        )}
        {/* Title text */}
        <div className="absolute left-[8%] right-[8%]" style={{ top: "30%" }}>
          <div className="font-bold text-white" style={{ fontSize: "10%", fontFamily: form.font_heading, lineHeight: 1.2 }}>Presentation Title</div>
          <div className="mt-[3%] text-white/70" style={{ fontSize: "6%", fontFamily: form.font_body, lineHeight: 1.3 }}>Subtitle text</div>
        </div>
        {/* Logo */}
        {form.logo_url && (
          <img src={form.logo_url} alt="" className="absolute" style={{ maxWidth: "14%", maxHeight: "14%", objectFit: "contain", ...(form.logo_position.includes("top") ? { top: "4%" } : { bottom: "4%" }), ...(form.logo_position.includes("left") ? { left: "4%" } : { right: "4%" }) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
      </div>
    </div>
  );
}

/* ===== Live Preview: Content Slide ===== */
function ContentSlidePreview({ form }: { form: BrandProfileForm }) {
  const headerH = form.slide_header.enabled ? `${form.slide_header.height_percent}%` : "0%";
  const footerH = form.slide_footer.enabled ? `${form.slide_footer.height_percent}%` : "0%";

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Content Slide</p>
      <div className="aspect-[16/9] w-full rounded-lg border border-gray-200 shadow-sm overflow-hidden relative" style={{ backgroundColor: form.background_color }}>
        {/* Header */}
        {form.slide_header.enabled && (
          <div className="absolute top-0 left-0 right-0" style={{ height: headerH, backgroundColor: form.slide_header.color }} />
        )}
        {/* Content */}
        <div className="absolute left-[8%] right-[8%]" style={{ top: `calc(${headerH} + 4%)`, bottom: `calc(${footerH} + 4%)` }}>
          {/* Title */}
          <div className="font-bold truncate" style={{ color: form.text_color, fontSize: "7%", fontFamily: form.font_heading, lineHeight: 1.2, marginBottom: "3%" }}>Content Title</div>
          {/* Bullets */}
          <div className="space-y-[2.5%]">
            {[75, 60, 68, 52].map((w, i) => (
              <div key={i} className="flex items-center" style={{ gap: "2.5%" }}>
                <div className="rounded-full flex-shrink-0" style={{ width: "4px", height: "4px", backgroundColor: form.secondary_color }} />
                <div className="rounded-sm" style={{ width: `${w}%`, height: "3px", backgroundColor: form.text_color, opacity: 0.25 }} />
              </div>
            ))}
          </div>
          {/* Key takeaway box */}
          <div className="mt-[4%] rounded-sm" style={{ borderLeft: `3px solid ${form.accent_color}`, backgroundColor: `${form.accent_color}11`, padding: "2% 3%" }}>
            <div className="rounded-sm" style={{ width: "45%", height: "3px", backgroundColor: form.text_color, opacity: 0.2 }} />
          </div>
        </div>
        {/* Footer */}
        {form.slide_footer.enabled && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-[3%]" style={{ height: footerH, backgroundColor: form.slide_footer.color }}>
            {form.slide_footer.show_page_number && <span className="text-white/60" style={{ fontSize: "3.5%" }}>1</span>}
            {form.slide_footer.show_confidentiality && <span className="text-white/60" style={{ fontSize: "3%" }}>{form.slide_footer.confidentiality_text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Live Preview: Data Slide ===== */
function DataSlidePreview({ form }: { form: BrandProfileForm }) {
  const headerH = form.slide_header.enabled ? `${form.slide_header.height_percent}%` : "0%";
  const footerH = form.slide_footer.enabled ? `${form.slide_footer.height_percent}%` : "0%";
  const barHeights = [70, 90, 55, 80];

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Data Slide</p>
      <div className="aspect-[16/9] w-full rounded-lg border border-gray-200 shadow-sm overflow-hidden relative" style={{ backgroundColor: form.background_color }}>
        {/* Header */}
        {form.slide_header.enabled && (
          <div className="absolute top-0 left-0 right-0" style={{ height: headerH, backgroundColor: form.slide_header.color }} />
        )}
        {/* Content */}
        <div className="absolute left-[6%] right-[6%]" style={{ top: `calc(${headerH} + 4%)`, bottom: `calc(${footerH} + 4%)` }}>
          {/* Title */}
          <div className="font-bold truncate" style={{ color: form.text_color, fontSize: "6%", fontFamily: form.font_heading, lineHeight: 1.2, marginBottom: "3%" }}>Data Overview</div>
          <div className="flex gap-[4%]" style={{ height: "70%" }}>
            {/* Mini bar chart */}
            <div className="flex-1 flex items-end justify-around" style={{ paddingBottom: "2%" }}>
              {barHeights.map((h, i) => (
                <div key={i} className="flex-1 mx-[3%]" style={{ height: `${h}%`, backgroundColor: form.chart_colors[i] || "#ccc", borderRadius: `${form.chart_bar_radius}px ${form.chart_bar_radius}px 0 0` }} />
              ))}
            </div>
            {/* Mini table */}
            <div className="flex-1 flex flex-col" style={{ fontSize: "3.5%" }}>
              {/* Table header */}
              <div className="flex" style={{ backgroundColor: form.table_header_color, color: form.table_header_text_color, padding: "2% 3%", borderRadius: "2px 2px 0 0" }}>
                <span className="flex-1 font-semibold">Item</span>
                <span className="flex-1 text-right font-semibold">Value</span>
              </div>
              {/* Table rows */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex"
                  style={{
                    padding: "1.5% 3%",
                    backgroundColor: form.table_alternate_row && i % 2 === 1 ? form.table_alternate_color : "transparent",
                    borderBottom: `1px solid ${form.table_border_color}`,
                    color: form.text_color,
                  }}
                >
                  <span className="flex-1 opacity-60">Row {i + 1}</span>
                  <span className="flex-1 text-right opacity-60">{(i + 1) * 24}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Footer */}
        {form.slide_footer.enabled && (
          <div className="absolute bottom-0 left-0 right-0" style={{ height: footerH, backgroundColor: form.slide_footer.color }} />
        )}
      </div>
    </div>
  );
}

/* ===== Logo Position Picker ===== */
function LogoPositionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const positions = [
    { label: "TL", value: "top-left", style: "top-1 left-1" },
    { label: "TR", value: "top-right", style: "top-1 right-1" },
    { label: "BL", value: "bottom-left", style: "bottom-1 left-1" },
    { label: "BR", value: "bottom-right", style: "bottom-1 right-1" },
  ];

  return (
    <div>
      <label className="text-sm font-medium text-gray-700">Position</label>
      <div className="mt-1.5 aspect-[16/9] w-36 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 relative">
        {positions.map((pos) => (
          <button
            key={pos.value}
            type="button"
            onClick={() => onChange(pos.value)}
            className={`absolute ${pos.style} h-5 w-5 rounded-sm border-2 text-[8px] font-bold flex items-center justify-center transition-colors ${
              value === pos.value ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-400 hover:border-gray-400"
            }`}
          >
            {pos.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ===== Main Page ===== */
export default function BrandProfileEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isCreate = id === "new";

  const [form, setForm] = useState<BrandProfileForm>({ ...DEFAULT_FORM });
  const [savedForm, setSavedForm] = useState<BrandProfileForm>({ ...DEFAULT_FORM });
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  // Load existing profile
  const loadProfile = useCallback(async () => {
    if (isCreate) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/brand-profiles/${id}`);
      const loaded: BrandProfileForm = {
        name: data.name || "",
        description: data.description || "",
        logo_path: data.logo_path || "",
        logo_url: data.logo_url || null,
        logo_position: data.logo_position || "top-right",
        logo_size: data.logo_size || "medium",
        primary_color: data.primary_color || DEFAULT_FORM.primary_color,
        secondary_color: data.secondary_color || DEFAULT_FORM.secondary_color,
        accent_color: data.accent_color || DEFAULT_FORM.accent_color,
        background_color: data.background_color || DEFAULT_FORM.background_color,
        text_color: data.text_color || DEFAULT_FORM.text_color,
        text_secondary_color: data.text_secondary_color || DEFAULT_FORM.text_secondary_color,
        chart_colors: Array.isArray(data.chart_colors) && data.chart_colors.length === 8 ? data.chart_colors : [...DEFAULT_CHART_COLORS],
        font_heading: data.font_heading || DEFAULT_FORM.font_heading,
        font_body: data.font_body || DEFAULT_FORM.font_body,
        font_size_title: data.font_size_title ?? DEFAULT_FORM.font_size_title,
        font_size_subtitle: data.font_size_subtitle ?? DEFAULT_FORM.font_size_subtitle,
        font_size_body: data.font_size_body ?? DEFAULT_FORM.font_size_body,
        font_size_caption: data.font_size_caption ?? DEFAULT_FORM.font_size_caption,
        slide_header: data.slide_header ? { enabled: data.slide_header.enabled ?? true, color: data.slide_header.color || DEFAULT_FORM.slide_header.color, height_percent: data.slide_header.height_percent ?? DEFAULT_FORM.slide_header.height_percent } : { ...DEFAULT_FORM.slide_header },
        slide_footer: data.slide_footer ? { enabled: data.slide_footer.enabled ?? true, color: data.slide_footer.color || DEFAULT_FORM.slide_footer.color, height_percent: data.slide_footer.height_percent ?? DEFAULT_FORM.slide_footer.height_percent, show_page_number: data.slide_footer.show_page_number ?? true, show_date: data.slide_footer.show_date ?? false, show_confidentiality: data.slide_footer.show_confidentiality ?? false, confidentiality_text: data.slide_footer.confidentiality_text || "Confidential" } : { ...DEFAULT_FORM.slide_footer },
        slide_accent_line: data.slide_accent_line ? { enabled: data.slide_accent_line.enabled ?? true, position: data.slide_accent_line.position || "below-header", thickness_px: data.slide_accent_line.thickness_px ?? 4, color: data.slide_accent_line.color || DEFAULT_FORM.slide_accent_line.color } : { ...DEFAULT_FORM.slide_accent_line },
        slide_background_style: data.slide_background_style || "solid",
        slide_gradient: data.slide_gradient ? { start_color: data.slide_gradient.start_color || "#FFFFFF", end_color: data.slide_gradient.end_color || "#F0F4F8", direction: data.slide_gradient.direction || "to-bottom" } : { ...DEFAULT_FORM.slide_gradient },
        table_header_color: data.table_header_color || DEFAULT_FORM.table_header_color,
        table_header_text_color: data.table_header_text_color || DEFAULT_FORM.table_header_text_color,
        table_alternate_row: data.table_alternate_row ?? true,
        table_alternate_color: data.table_alternate_color || DEFAULT_FORM.table_alternate_color,
        table_border_color: data.table_border_color || DEFAULT_FORM.table_border_color,
        table_style: data.table_style || "striped",
        chart_style: data.chart_style || "modern",
        chart_show_grid: data.chart_show_grid ?? true,
        chart_show_legend: data.chart_show_legend ?? true,
        chart_legend_position: data.chart_legend_position || "bottom",
        chart_bar_radius: data.chart_bar_radius ?? 4,
        is_default: data.is_default ?? false,
        is_system: data.is_system ?? false,
      };
      setForm(loaded);
      setSavedForm(loaded);
    } catch {
      // If load fails, navigate back
      router.push("/settings/brand-profiles");
    } finally {
      setLoading(false);
    }
  }, [id, isCreate, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Helper to update a top-level form field
  const setField = <K extends keyof BrandProfileForm>(key: K, value: BrandProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Helper to update nested object fields
  const setNested = <K extends "slide_header" | "slide_footer" | "slide_accent_line" | "slide_gradient">(
    key: K,
    field: string,
    value: unknown,
  ) => {
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (isCreate) {
        const { data } = await api.post("/brand-profiles", form);
        const newId = data.id || data.profile?.id;
        if (newId) {
          router.push(`/settings/brand-profiles/${newId}`);
        } else {
          router.push("/settings/brand-profiles");
        }
      } else {
        await api.put(`/brand-profiles/${id}`, form);
        setSavedForm({ ...form });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Could add error toast
    } finally {
      setSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!window.confirm("Delete this brand profile? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/brand-profiles/${id}`);
      router.push("/settings/brand-profiles");
    } catch {
      setDeleting(false);
    }
  };

  // Set default handler
  const handleSetDefault = async () => {
    try {
      await api.post(`/brand-profiles/${id}/set-default`);
      setField("is_default", true);
      setSavedForm((prev) => ({ ...prev, is_default: true }));
    } catch {
      // swallow
    }
  };

  // Logo upload
  const handleLogoUpload = async (file: File) => {
    if (isCreate) {
      // For new profiles, show a local preview
      const url = URL.createObjectURL(file);
      setField("logo_url", url);
      return;
    }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/brand-profiles/${id}/logo`, fd);
      setField("logo_url", data.logo_url || data.url || null);
      setField("logo_path", data.logo_path || data.path || "");
      setSavedForm((prev) => ({ ...prev, logo_url: data.logo_url || data.url || null, logo_path: data.logo_path || data.path || "" }));
    } catch {
      // swallow
    } finally {
      setUploadingLogo(false);
    }
  };

  // Logo remove
  const handleLogoRemove = async () => {
    if (isCreate) {
      setField("logo_url", null);
      setField("logo_path", "");
      return;
    }
    try {
      await api.delete(`/brand-profiles/${id}/logo`);
      setField("logo_url", null);
      setField("logo_path", "");
      setSavedForm((prev) => ({ ...prev, logo_url: null, logo_path: "" }));
    } catch {
      // swallow
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <SpinnerIcon className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Back link */}
      <Link href="/settings/brand-profiles" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Brand Profiles
      </Link>

      {/* Page title */}
      <h1 className="text-xl font-bold text-gray-900 mb-6">
        {isCreate ? "Create Brand Profile" : form.name || "Edit Brand Profile"}
      </h1>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* LEFT COLUMN: Form (55%) */}
        <div className="w-[55%] min-w-0">
          {/* Section 1: Profile Info */}
          <Section label="Profile Info">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Corporate Blue"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Brief description of this brand profile..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
              />
            </div>
          </Section>

          {/* Section 2: Logo */}
          <Section label="Logo">
            {form.logo_url ? (
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                  <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {uploadingLogo ? "Uploading..." : "Replace"}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-8 hover:border-gray-400 hover:bg-gray-100 transition-colors"
              >
                {uploadingLogo ? (
                  <SpinnerIcon className="h-8 w-8 text-gray-400" />
                ) : (
                  <UploadIcon className="h-8 w-8 text-gray-400" />
                )}
                <p className="mt-2 text-sm text-gray-500">Click to upload logo</p>
                <p className="text-xs text-gray-400">PNG, JPG, SVG up to 2MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
            <div className="flex items-start gap-6">
              <LogoPositionPicker value={form.logo_position} onChange={(v) => setField("logo_position", v)} />
              <div>
                <label className="text-sm font-medium text-gray-700">Size</label>
                <div className="mt-1.5">
                  <RadioPills
                    options={[
                      { label: "Small", value: "small" },
                      { label: "Medium", value: "medium" },
                      { label: "Large", value: "large" },
                    ]}
                    value={form.logo_size}
                    onChange={(v) => setField("logo_size", v)}
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Section 3: Slide Colors */}
          <Section label="Slide Colors">
            <ColorField label="Primary Color" description="Headers, footers, title slide backgrounds" value={form.primary_color} onChange={(v) => setField("primary_color", v)} />
            <ColorField label="Secondary Color" description="Bullet markers, accent lines" value={form.secondary_color} onChange={(v) => setField("secondary_color", v)} />
            <ColorField label="Accent Color" description="Key takeaway boxes, highlights" value={form.accent_color} onChange={(v) => setField("accent_color", v)} />
            <ColorField label="Background Color" description="Slide background fill" value={form.background_color} onChange={(v) => setField("background_color", v)} />
            <ColorField label="Text Color" description="Headings, body text" value={form.text_color} onChange={(v) => setField("text_color", v)} />
            <ColorField label="Text Secondary" description="Subtitles, captions" value={form.text_secondary_color} onChange={(v) => setField("text_secondary_color", v)} />

            {/* Chart Colors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Chart Colors</label>
                <button
                  type="button"
                  onClick={() => setField("chart_colors", [...DEFAULT_CHART_COLORS])}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className="flex gap-2">
                {form.chart_colors.map((color, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <label className="relative cursor-pointer">
                      <div className="h-8 w-8 rounded-md border border-gray-300 shadow-sm" style={{ backgroundColor: color }} />
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...form.chart_colors];
                          newColors[i] = e.target.value;
                          setField("chart_colors", newColors);
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </label>
                    <span className="text-[9px] text-gray-400">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Section 4: Fonts */}
          <Section label="Fonts">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heading Font</label>
                <select
                  value={form.font_heading}
                  onChange={(e) => setField("font_heading", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Font</label>
                <select
                  value={form.font_body}
                  onChange={(e) => setField("font_body", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Font Sizes</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["Title", "font_size_title"],
                  ["Subtitle", "font_size_subtitle"],
                  ["Body", "font_size_body"],
                  ["Caption", "font_size_caption"],
                ] as const).map(([label, key]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14">{label}</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={form[key]}
                        onChange={(e) => setField(key, Number(e.target.value) || 0)}
                        min={6}
                        max={72}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 pr-7 text-sm font-mono focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">pt</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Section 5: Table Styling */}
          <Section label="Table Styling">
            <ColorField label="Header Color" value={form.table_header_color} onChange={(v) => setField("table_header_color", v)} />
            <ColorField label="Header Text Color" value={form.table_header_text_color} onChange={(v) => setField("table_header_text_color", v)} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Alternate Rows</span>
              <Toggle checked={form.table_alternate_row} onChange={(v) => setField("table_alternate_row", v)} />
            </div>
            {form.table_alternate_row && (
              <ColorField label="Alternate Row Color" value={form.table_alternate_color} onChange={(v) => setField("table_alternate_color", v)} />
            )}
            <ColorField label="Border Color" value={form.table_border_color} onChange={(v) => setField("table_border_color", v)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Table Style</label>
              <RadioCards
                options={[
                  { label: "Striped", value: "striped" },
                  { label: "Bordered", value: "bordered" },
                  { label: "Minimal", value: "minimal" },
                ]}
                value={form.table_style}
                onChange={(v) => setField("table_style", v)}
              />
            </div>
          </Section>

          {/* Section 6: Chart Styling */}
          <Section label="Chart Styling">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chart Style</label>
              <RadioCards
                options={[
                  { label: "Modern", value: "modern" },
                  { label: "Classic", value: "classic" },
                  { label: "Minimal", value: "minimal" },
                ]}
                value={form.chart_style}
                onChange={(v) => setField("chart_style", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Show Grid</span>
              <Toggle checked={form.chart_show_grid} onChange={(v) => setField("chart_show_grid", v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Show Legend</span>
              <Toggle checked={form.chart_show_legend} onChange={(v) => setField("chart_show_legend", v)} />
            </div>
            {form.chart_show_legend && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Legend Position</label>
                <RadioPills
                  options={[
                    { label: "Top", value: "top" },
                    { label: "Bottom", value: "bottom" },
                    { label: "Right", value: "right" },
                  ]}
                  value={form.chart_legend_position}
                  onChange={(v) => setField("chart_legend_position", v)}
                />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Bar Corner Radius</label>
                <span className="text-xs font-mono text-gray-500">{form.chart_bar_radius}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                value={form.chart_bar_radius}
                onChange={(e) => setField("chart_bar_radius", Number(e.target.value))}
                className="w-full accent-gray-900"
              />
            </div>
          </Section>

          {/* Section 7: Slide Master */}
          <Section label="Slide Master">
            {/* Header bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Header Bar</span>
                <Toggle checked={form.slide_header.enabled} onChange={(v) => setNested("slide_header", "enabled", v)} />
              </div>
              {form.slide_header.enabled && (
                <>
                  <ColorField label="Color" value={form.slide_header.color} onChange={(v) => setNested("slide_header", "color", v)} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-gray-600">Height</label>
                      <span className="text-xs font-mono text-gray-500">{form.slide_header.height_percent}%</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={12}
                      value={form.slide_header.height_percent}
                      onChange={(e) => setNested("slide_header", "height_percent", Number(e.target.value))}
                      className="w-full accent-gray-900"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer bar */}
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Footer Bar</span>
                <Toggle checked={form.slide_footer.enabled} onChange={(v) => setNested("slide_footer", "enabled", v)} />
              </div>
              {form.slide_footer.enabled && (
                <>
                  <ColorField label="Color" value={form.slide_footer.color} onChange={(v) => setNested("slide_footer", "color", v)} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Page Number</span>
                    <Toggle checked={form.slide_footer.show_page_number} onChange={(v) => setNested("slide_footer", "show_page_number", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidentiality</span>
                    <Toggle checked={form.slide_footer.show_confidentiality} onChange={(v) => setNested("slide_footer", "show_confidentiality", v)} />
                  </div>
                  {form.slide_footer.show_confidentiality && (
                    <input
                      type="text"
                      value={form.slide_footer.confidentiality_text}
                      onChange={(e) => setNested("slide_footer", "confidentiality_text", e.target.value)}
                      placeholder="Confidential"
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  )}
                </>
              )}
            </div>

            {/* Accent line */}
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Accent Line</span>
                <Toggle checked={form.slide_accent_line.enabled} onChange={(v) => setNested("slide_accent_line", "enabled", v)} />
              </div>
              {form.slide_accent_line.enabled && (
                <>
                  <ColorField label="Color" value={form.slide_accent_line.color} onChange={(v) => setNested("slide_accent_line", "color", v)} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-gray-600">Thickness</label>
                      <span className="text-xs font-mono text-gray-500">{form.slide_accent_line.thickness_px}px</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={8}
                      value={form.slide_accent_line.thickness_px}
                      onChange={(e) => setNested("slide_accent_line", "thickness_px", Number(e.target.value))}
                      className="w-full accent-gray-900"
                    />
                  </div>
                </>
              )}
            </div>
          </Section>
        </div>

        {/* RIGHT COLUMN: Live Preview (45%) */}
        <div className="w-[45%] min-w-0">
          <div className="sticky top-20 space-y-6">
            <TitleSlidePreview form={form} />
            <ContentSlidePreview form={form} />
            <DataSlidePreview form={form} />
          </div>
        </div>
      </div>

      {/* Bottom sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          {/* Delete (left) */}
          <div>
            {!isCreate && !form.is_system && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50"
              >
                {deleting ? <SpinnerIcon className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
                Delete Profile
              </button>
            )}
          </div>

          {/* Set as Default (center) */}
          <div>
            {!isCreate && !form.is_default && (
              <button
                type="button"
                onClick={handleSetDefault}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Set as Default
              </button>
            )}
            {!isCreate && form.is_default && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Default Profile
              </span>
            )}
          </div>

          {/* Save (right) */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!isCreate && !isDirty)}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium shadow-sm transition-all ${
              saved
                ? "bg-emerald-600 text-white"
                : "bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {saving && <SpinnerIcon className="h-4 w-4" />}
            {saved ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            ) : isCreate ? (
              "Create Profile"
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
