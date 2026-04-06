"use client";

import api from "@/lib/api";
import { useEffect, useState } from "react";

interface Metrics {
  parsing_status: any;
  content_slots: any;
  usability: string;
  quality_score: number;
  quality_breakdown: Record<string, { points: number; max: number; detail: string }>;
}

interface Props {
  collectionId: string;
  variationId: string;
  metrics?: Metrics | null;
}

function SvgIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={className || "h-3 w-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export function SlideProperties({ collectionId, variationId, metrics: propMetrics }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFailures, setShowFailures] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/template-collections/${collectionId}/variations/${variationId}/objects`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collectionId, variationId]);

  if (loading) return <Shimmer />;
  if (!data && !propMetrics) return <p className="py-8 text-center text-sm text-gray-400">No data</p>;

  const colors: string[] = data?.color_palette || [];
  const fonts: string[] = data?.font_inventory || [];
  const objects: any[] = data?.objects || [];
  const types: Record<string, number> = {};
  for (const o of objects) types[o.type || o.object_type] = (types[o.type || o.object_type] || 0) + 1;

  const metrics = propMetrics || null;
  const score = metrics?.quality_score ?? 0;
  const breakdown = metrics?.quality_breakdown || {};
  const ps = metrics?.parsing_status;
  const cs = metrics?.content_slots;
  const usability = metrics?.usability;

  const allFailures: string[] = [];
  if (ps) {
    for (const cat of ["text", "shapes", "images", "tables", "charts", "groups"]) {
      const d = ps[cat];
      if (d?.details?.length) allFailures.push(...d.details);
    }
  }

  const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Poor";
  const scoreColor = score >= 80 ? "#10B981" : score >= 60 ? "#3B82F6" : score >= 40 ? "#F59E0B" : "#9CA3AF";

  // Fix slide dimensions — compute from EMU if inches are missing
  const dims = data?.slide_dimensions;
  const widthIn = dims?.width_inches || (dims?.width_emu ? (dims.width_emu / 914400).toFixed(2) : null);
  const heightIn = dims?.height_inches || (dims?.height_emu ? (dims.height_emu / 914400).toFixed(2) : null);

  return (
    <div className="space-y-4">
      {/* Slide Dimensions */}
      {data && (
        <Sec title="Slide Dimensions">
          <p className="text-xs text-gray-700">
            {widthIn && heightIn ? `${widthIn} \u00D7 ${heightIn} inches` : "Dimensions not available"}
          </p>
          <p className="text-[10px] text-gray-400">16:9 Widescreen</p>
          {data.layout_name && <p className="text-[10px] text-gray-400 mt-0.5">Layout: {data.layout_name}</p>}
        </Sec>
      )}

      {/* Background */}
      {data && (
        <Sec title="Background">
          <span className="badge bg-gray-100 text-gray-600 text-[9px]">{data.background?.type || "none"}</span>
          {data.background?.color && (
            <span className="ml-2 inline-flex items-center gap-1.5">
              <span className="h-4 w-4 rounded border border-gray-200" style={{ background: data.background.color }} />
              <span className="font-mono text-[10px] text-gray-600">{data.background.color}</span>
            </span>
          )}
        </Sec>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <Sec title={`Color Palette (${colors.length})`}>
          <div className="flex flex-wrap gap-2">
            {colors.map((c, i) => (
              <div key={i} className="text-center cursor-pointer" onClick={() => navigator.clipboard?.writeText(c)} title="Click to copy">
                <div className="h-8 w-8 rounded-lg border border-gray-200" style={{ background: c }} />
                <span className="mt-0.5 block font-mono text-[8px] text-gray-400">{c.replace("#", "")}</span>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* Fonts */}
      {fonts.length > 0 && (
        <Sec title={`Fonts (${fonts.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {fonts.map((f, i) => (
              <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{f}</span>
            ))}
          </div>
        </Sec>
      )}

      {/* Content Slots */}
      {cs && (
        <Sec title={`Content Slots (${cs.total})`}>
          {cs.total === 0 ? (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
              <SvgIcon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-amber-700">No content slots detected</p>
                <p className="text-[10px] text-amber-600 mt-0.5">This template is decorative only.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {cs.title_slots > 0 && <span className="badge bg-blue-50 text-blue-700 text-[9px]">{cs.title_slots} title</span>}
                {cs.subtitle_slots > 0 && <span className="badge bg-indigo-50 text-indigo-700 text-[9px]">{cs.subtitle_slots} subtitle</span>}
                {cs.body_slots > 0 && <span className="badge bg-teal-50 text-teal-700 text-[9px]">{cs.body_slots} body</span>}
                {cs.item_slots > 0 && <span className="badge bg-emerald-50 text-emerald-700 text-[9px]">{cs.item_slots} item</span>}
                {cs.label_slots > 0 && <span className="badge bg-gray-100 text-gray-600 text-[9px]">{cs.label_slots} label</span>}
              </div>
              {(cs.slots || []).map((slot: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                    slot.slot_type === "title" ? "bg-blue-100 text-blue-700" :
                    slot.slot_type === "subtitle" ? "bg-indigo-100 text-indigo-700" :
                    slot.slot_type === "body" ? "bg-teal-100 text-teal-700" :
                    slot.slot_type === "item" ? "bg-emerald-100 text-emerald-700" :
                    "bg-gray-200 text-gray-600"
                  }`}>{slot.slot_type}</span>
                  <span className="text-[10px] text-gray-500 truncate flex-1">&ldquo;{slot.placeholder_text || "Empty"}&rdquo;</span>
                  {slot.shape_index != null && <span className="text-[9px] text-gray-400">#{slot.shape_index}</span>}
                </div>
              ))}
            </div>
          )}
        </Sec>
      )}

      {/* Quality Score */}
      {metrics && (
        <Sec title="Quality Score">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#E5E7EB" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke={scoreColor} strokeWidth="4"
                  strokeDasharray={`${(score / 100) * 175.9} 175.9`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{score}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{scoreLabel}</p>
              <p className="text-xs text-gray-500">Template quality score</p>
              {usability && (
                <span className={`mt-1 inline-block text-[9px] font-medium px-2 py-0.5 rounded-full ${
                  usability === "fully_usable" ? "bg-emerald-50 text-emerald-700" :
                  usability === "partially_usable" ? "bg-blue-50 text-blue-700" :
                  usability === "limited" ? "bg-yellow-50 text-yellow-700" :
                  usability === "decorative_only" ? "bg-amber-50 text-amber-700" :
                  "bg-gray-100 text-gray-500"
                }`}>{usability.replace(/_/g, " ")}</span>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            {Object.entries(breakdown).map(([key, d]) => (
              <div key={key} className="flex items-center gap-3 py-1">
                <span className="text-[10px] text-gray-500 w-[80px] capitalize">{key.replace(/_/g, " ")}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${d.max > 0 ? (d.points / d.max) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] font-mono text-gray-400 w-[40px] text-right">{d.points}/{d.max}</span>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* Statistics */}
      {data && (
        <Sec title="Statistics">
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Total" value={data.object_count} />
            <StatBox label="Text" value={types["text_box"] || 0} />
            <StatBox label="Shapes" value={types["auto_shape"] || 0} />
            <StatBox label="Tables" value={types["table"] || 0} />
            <StatBox label="Images" value={types["picture"] || 0} />
            <StatBox label="Charts" value={types["chart"] || 0} />
          </div>
        </Sec>
      )}

      {/* Parsing Status */}
      {ps && (
        <Sec title="Parsing Status">
          <div className="space-y-1">
            {(["text", "shapes", "images", "tables", "charts", "groups"] as const).map((type) => {
              const d = ps[type];
              if (!d || d.count === 0) return null;
              return (
                <div key={type} className="flex items-center gap-2 py-1">
                  <StatusDot status={d.status} />
                  <span className="text-[11px] text-gray-700 capitalize flex-1">{type}</span>
                  <span className="text-[10px] text-gray-400">{d.parsed}/{d.count}</span>
                  {d.failed > 0 && <span className="text-[9px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">{d.failed} failed</span>}
                </div>
              );
            })}
          </div>
          {allFailures.length > 0 && (
            <div className="mt-3 p-3 bg-rose-50 rounded-lg border border-rose-200">
              <button onClick={() => setShowFailures(!showFailures)} className="flex items-center gap-1 w-full text-left">
                <span className="text-[11px] font-medium text-rose-700">
                  {ps.total_failed} object{ps.total_failed > 1 ? "s" : ""} failed
                </span>
                <svg className={`h-3 w-3 text-rose-400 ml-auto transition-transform ${showFailures ? "rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {showFailures && (
                <div className="mt-2 space-y-0.5">
                  {allFailures.map((detail, i) => (
                    <p key={i} className="text-[10px] text-rose-600 py-0.5">&bull; {detail}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Sec>
      )}
    </div>
  );
}

function Shimmer() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i}>
          <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-3 border-b border-gray-100">
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
      {children}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 text-center">
      <p className="text-base font-bold text-gray-900">{value}</p>
      <p className="text-[9px] text-gray-400">{label}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { success: "bg-emerald-500", partial: "bg-amber-500", failed: "bg-rose-500", none: "bg-gray-300" };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || colors.none}`} />;
}
