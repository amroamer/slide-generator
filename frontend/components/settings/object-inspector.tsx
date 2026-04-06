"use client";

import api from "@/lib/api";
import { useEffect, useState } from "react";

interface ParsedObject {
  id: number; name: string; type: string; position: any;
  rotation: number; fill: any; border: any; text_content: string | null;
  text_frames: any; auto_shape: string | null; image_data: any;
  table_data: any; chart_data: any; group_children: any[] | null;
}

interface ObjectsData {
  variation_id: string; objects: ParsedObject[];
  background: any; color_palette: string[]; font_inventory: string[];
  object_count: number; has_images: boolean; has_charts: boolean; has_tables: boolean;
}

interface Props { collectionId: string; variationId: string }

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  text_box: { icon: "T", color: "text-blue-500 bg-blue-50" },
  auto_shape: { icon: "\u25A1", color: "text-purple-500 bg-purple-50" },
  picture: { icon: "\u{1F5BC}", color: "text-emerald-500 bg-emerald-50" },
  table: { icon: "\u2637", color: "text-amber-500 bg-amber-50" },
  chart: { icon: "\u2581\u2583\u2585", color: "text-cyan-500 bg-cyan-50" },
  group: { icon: "\u2B1A", color: "text-indigo-500 bg-indigo-50" },
  line: { icon: "\u2500", color: "text-gray-500 bg-gray-50" },
  freeform: { icon: "\u270E", color: "text-rose-500 bg-rose-50" },
  placeholder: { icon: "\u25A3", color: "text-orange-500 bg-orange-50" },
};

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_ICONS[type] || { icon: "?", color: "text-gray-400 bg-gray-50" };
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${t.color}`}>
      {t.icon}
    </span>
  );
}

function ColorSwatch({ color, size = "w-4 h-4" }: { color: string | null; size?: string }) {
  if (!color) return null;
  return (
    <span className={`${size} inline-block rounded-full border border-gray-200`} style={{ background: color }}
      title={color} onClick={() => navigator.clipboard?.writeText(color)} />
  );
}

export function ObjectInspector({ collectionId, variationId }: Props) {
  const [data, setData] = useState<ObjectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/template-collections/${collectionId}/variations/${variationId}/objects`)
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collectionId, variationId]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
    </div>
  );

  if (!data || !data.objects?.length) return (
    <p className="py-8 text-center text-sm text-gray-400">No parsed objects available</p>
  );

  const selected = data.objects.find((o) => o.id === selectedId) || null;

  return (
    <div className="flex h-full gap-0">
      {/* Left: Object Tree */}
      <div className="w-1/2 overflow-y-auto border-r border-gray-200 pr-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {data.object_count} Objects
        </p>
        <div className="space-y-0.5">
          {data.objects.map((obj) => (
            <ObjectNode key={obj.id} obj={obj} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
          ))}
        </div>
        {/* Summary bar */}
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap gap-1.5 text-[9px] text-gray-400">
            {Object.entries(
              data.objects.reduce((acc: Record<string, number>, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {})
            ).map(([type, count]) => (
              <span key={type}>{count} {type.replace("_", " ")}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Property Panel */}
      <div className="w-1/2 overflow-y-auto pl-3">
        {selected ? (
          <div>
            {/* Header */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <TypeBadge type={selected.type} />
                <span className="text-sm font-semibold text-gray-900">{selected.name}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="badge bg-gray-100 text-gray-600 text-[9px]">{selected.type}</span>
                {selected.auto_shape && <span className="badge bg-purple-50 text-purple-600 text-[9px]">{selected.auto_shape.replace("MSO_AUTO_SHAPE_TYPE.", "")}</span>}
              </div>
            </div>

            {/* Position */}
            <Section title="Position & Size">
              <div className="mb-2 flex items-center gap-3">
                {/* Mini slide position indicator */}
                <div className="relative w-[100px] rounded border border-gray-200 bg-gray-50" style={{ aspectRatio: "16/9" }}>
                  <div className="absolute rounded-sm bg-blue-500/30 border border-blue-500"
                    style={{
                      left: `${selected.position?.left_percent || 0}%`,
                      top: `${selected.position?.top_percent || 0}%`,
                      width: `${Math.min(selected.position?.width_percent || 0, 100)}%`,
                      height: `${Math.min(selected.position?.height_percent || 0, 100)}%`,
                    }} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                  <span className="text-gray-400">X</span><span className="font-mono text-gray-700">{selected.position?.left} in</span>
                  <span className="text-gray-400">Y</span><span className="font-mono text-gray-700">{selected.position?.top} in</span>
                  <span className="text-gray-400">W</span><span className="font-mono text-gray-700">{selected.position?.width} in</span>
                  <span className="text-gray-400">H</span><span className="font-mono text-gray-700">{selected.position?.height} in</span>
                  {selected.rotation !== 0 && <><span className="text-gray-400">Rot</span><span className="font-mono text-gray-700">{selected.rotation}\u00B0</span></>}
                </div>
              </div>
            </Section>

            {/* Fill & Border */}
            <Section title="Fill & Border">
              <div className="flex items-center gap-3">
                <span className="badge text-[9px] bg-gray-100 text-gray-600">{selected.fill?.type || "none"}</span>
                {selected.fill?.color && (
                  <div className="flex items-center gap-1.5">
                    <ColorSwatch color={selected.fill.color} size="w-6 h-6" />
                    <span className="font-mono text-[10px] text-gray-600">{selected.fill.color}</span>
                  </div>
                )}
              </div>
              {selected.border?.has_border && (
                <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                  <span className="text-gray-400">Border:</span>
                  <ColorSwatch color={selected.border.color} />
                  <span className="font-mono text-gray-600">{selected.border.width}pt</span>
                </div>
              )}
            </Section>

            {/* Text Content */}
            {selected.text_content && (
              <Section title="Text Content">
                <div className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700 leading-relaxed">
                  {selected.text_content}
                </div>
                {selected.text_frames && Array.isArray(selected.text_frames) && selected.text_frames.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {selected.text_frames.slice(0, 5).map((para: any, i: number) =>
                      (para.runs || []).slice(0, 3).map((run: any, j: number) => (
                        <div key={`${i}-${j}`} className="flex items-center gap-1.5 text-[10px]">
                          {run.font && <span className="text-gray-400">{run.font}</span>}
                          {run.size && <span className="text-gray-400">{run.size}pt</span>}
                          {run.bold && <span className="badge bg-gray-200 text-gray-600 text-[8px]">B</span>}
                          {run.color && <ColorSwatch color={run.color} />}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Section>
            )}

            {/* Table */}
            {selected.table_data && (
              <Section title="Table Data">
                <p className="text-[10px] text-gray-500 mb-2">{selected.table_data.rows} rows × {selected.table_data.columns} cols</p>
                <div className="overflow-x-auto rounded border border-gray-200">
                  <table className="w-full text-[9px]">
                    <tbody>
                      {(selected.table_data.cells || []).slice(0, 6).map((row: any[], ri: number) => (
                        <tr key={ri}>
                          {row.slice(0, 5).map((cell: any, ci: number) => (
                            <td key={ci} className="px-1 py-0.5 border-b border-gray-100 truncate max-w-[80px]"
                              style={{ background: cell.fill || (ri === 0 ? "#00338D" : undefined), color: ri === 0 ? "#fff" : undefined }}>
                              {cell.text?.slice(0, 15)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Image */}
            {selected.image_data && (
              <Section title="Image">
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span>{selected.image_data.content_type}</span>
                  {selected.image_data.width_px && <span>{selected.image_data.width_px}×{selected.image_data.height_px}px</span>}
                  <span>{Math.round((selected.image_data.size_bytes || 0) / 1024)}KB</span>
                </div>
                {selected.image_data.base64 && (
                  <img src={`data:${selected.image_data.content_type};base64,${selected.image_data.base64}`}
                    alt="Embedded" className="mt-2 max-h-[120px] rounded border border-gray-200" />
                )}
              </Section>
            )}

            {/* Chart */}
            {selected.chart_data && (
              <Section title="Chart">
                <span className="badge bg-cyan-50 text-cyan-700 text-[9px]">{selected.chart_data.chart_type}</span>
                <span className="ml-2 text-[10px] text-gray-500">{selected.chart_data.series_count} series</span>
              </Section>
            )}

            {/* Raw JSON */}
            <div className="mt-3">
              <button onClick={() => setShowRaw(!showRaw)} className="text-[10px] font-medium text-gray-400 hover:text-gray-600">
                {showRaw ? "Hide" : "Show"} raw JSON
              </button>
              {showRaw && (
                <pre className="mt-1 max-h-[200px] overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-[9px] text-gray-300 leading-relaxed">
                  {JSON.stringify(selected, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Select an object to inspect
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 pb-2 border-b border-gray-100">
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
      {children}
    </div>
  );
}

function ObjectNode({ obj, depth, selectedId, onSelect }: {
  obj: ParsedObject; depth: number; selectedId: number | null; onSelect: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = obj.group_children && obj.group_children.length > 0;
  const isSelected = selectedId === obj.id;

  return (
    <div>
      <button
        onClick={() => { onSelect(obj.id); if (hasChildren) setExpanded(!expanded); }}
        className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors ${
          isSelected ? "bg-blue-50 border-l-2 border-blue-500" : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {hasChildren && (
          <svg className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
        {!hasChildren && <span className="w-3 shrink-0" />}
        <TypeBadge type={obj.type} />
        <span className="text-xs text-gray-700 truncate flex-1">{obj.name}</span>
        {obj.fill?.color && <ColorSwatch color={obj.fill.color} />}
        {obj.text_content && <span className="text-[9px] italic text-gray-400 truncate max-w-[60px]">{obj.text_content.slice(0, 20)}</span>}
      </button>
      {expanded && hasChildren && (
        <div className="border-l border-gray-200" style={{ marginLeft: `${depth * 16 + 14}px` }}>
          {obj.group_children!.map((child) => (
            <ObjectNode key={child.id} obj={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
