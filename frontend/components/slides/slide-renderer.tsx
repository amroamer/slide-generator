"use client";

import { isRTLLanguage, slideNumberPos, fontClass, textAlign, renderMd } from "@/lib/rtl-utils";
import { normalizeChartData } from "./chart-renderer";
import { TitleSlide } from "./layouts/title-slide";
import { TitleBullets } from "./layouts/title-bullets";
import { TitleTable } from "./layouts/title-table";
import { TitleChart } from "./layouts/title-chart";
import { TwoColumn } from "./layouts/two-column";
import { SectionDivider } from "./layouts/section-divider";
import { KeyTakeaway } from "./layouts/key-takeaway";

interface Props {
  content: any;
  layout: string;
  designJson?: any;
  className?: string;
  primary?: string;
  accent?: string;
  slideNumber?: number;
  language?: string;
  onGenerateChart?: () => void;
  onSwitchLayout?: (layout: string) => void;
  generatingChart?: boolean;
}

const LAYOUTS: Record<string, React.ComponentType<any>> = {
  title_slide: TitleSlide,
  title_bullets: TitleBullets,
  title_table: TitleTable,
  title_chart: TitleChart,
  two_column: TwoColumn,
  section_divider: SectionDivider,
  key_takeaway: KeyTakeaway,
  full_image: TitleBullets,
};

function resolveLayout(layout: string, content: any): React.ComponentType<any> {
  if (LAYOUTS[layout]) {
    if (layout === "title_chart" && !normalizeChartData(content?.chart_data)) {
      const table = content?.data_table;
      if (table?.headers?.length && table?.rows?.length) return TitleTable;
      return TitleBullets;
    }
    return LAYOUTS[layout];
  }
  if (normalizeChartData(content?.chart_data)) return TitleChart;
  if (content?.data_table?.headers?.length) return TitleTable;
  return TitleBullets;
}

/* ── Template Design Renderer ──────────────────────────────────────────────
   Renders slide content using the actual positions, sizes, and structure
   from the uploaded PPTX template's design_json. Colors come from the
   brand profile (primary/accent), not from the template. */

const SLIDE_W = 13.333; // Standard widescreen width in inches
const SLIDE_H = 7.5;    // Standard widescreen height in inches

const STATUS_COLORS: Record<string, string> = {
  green: "#10B981", met: "#10B981", pass: "#10B981", "on track": "#10B981",
  amber: "#F59E0B", yellow: "#F59E0B", "at risk": "#F59E0B", warning: "#F59E0B",
  red: "#EF4444", fail: "#EF4444", "not met": "#EF4444", critical: "#EF4444",
};

function getStatusColor(val: string): string | null {
  const norm = val.toLowerCase().trim();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (norm.includes(key)) return color;
  }
  return null;
}

function TemplateDesignRenderer({ content, config, primary, accent, isRTL, onGenerateChart, onSwitchLayout, generating }: any) {
  const td = config?.template_design;
  if (!td) return null;

  const shapes: any[] = td.shapes || [];
  const slots: any[] = td.content_slots || [];

  // If the template has no usable content slots, fall back to the standard layout
  // rendered inside the template's main shape bounding box
  const titleSlots = slots.filter((s: any) => s.slot_type === "title");
  const subtitleSlots = slots.filter((s: any) => s.slot_type === "subtitle");
  const itemSlots = slots.filter((s: any) => s.slot_type === "item");

  const hasUsableSlots = titleSlots.length > 0 || itemSlots.length > 0;

  if (!hasUsableSlots) {
    // Find the largest shape to use as the content bounding box
    let mainShape = shapes[0];
    let maxArea = 0;
    for (const s of shapes) {
      const a = (s.position?.width_inches || 0) * (s.position?.height_inches || 0);
      if (a > maxArea) { maxArea = a; mainShape = s; }
    }

    // Render standard layout inside the template's main bounding box
    const pos = mainShape?.position || {};
    const boxStyle: React.CSSProperties = mainShape ? {
      position: "absolute",
      left: `${((pos.left_inches || 0) / SLIDE_W) * 100}%`,
      top: `${((pos.top_inches || 0) / SLIDE_H) * 100}%`,
      width: `${((pos.width_inches || SLIDE_W * 0.88) / SLIDE_W) * 100}%`,
      height: `${((pos.height_inches || SLIDE_H * 0.7) / SLIDE_H) * 100}%`,
      overflow: "hidden",
    } : { position: "absolute" as const, inset: "6%" };

    // Render decorative shapes (header bars etc.) + content in the main box
    const decorShapes = shapes.filter((s: any) => s.fill_color && s !== mainShape);
    const FallbackLayout = resolveLayout(content?.data_table?.headers?.length ? "title_table" : "title_bullets", content);

    return (
      <div className="relative h-full w-full overflow-hidden">
        {/* Decorative shapes from template */}
        {decorShapes.map((shape: any, i: number) => {
          const sp = shape.position || {};
          const isTop = (sp.top_inches || 0) < 1;
          return (
            <div key={`d${i}`} style={{
              position: "absolute",
              left: `${((sp.left_inches || 0) / SLIDE_W) * 100}%`,
              top: `${((sp.top_inches || 0) / SLIDE_H) * 100}%`,
              width: `${((sp.width_inches || 0) / SLIDE_W) * 100}%`,
              height: `${((sp.height_inches || 0) / SLIDE_H) * 100}%`,
              backgroundColor: isTop ? primary : accent,
              opacity: 0.9,
            }} />
          );
        })}
        {/* Standard layout inside the bounding box */}
        <div style={boxStyle}>
          <FallbackLayout
            content={content} primary={primary} accent={accent}
            config={{}} isRTL={isRTL}
            onGenerateChart={onGenerateChart} onSwitchLayout={onSwitchLayout}
            generating={generating}
          />
        </div>
      </div>
    );
  }

  const title = content?.title || "";
  const body = content?.body;
  const rawBullets = Array.isArray(body?.content) ? body.content : Array.isArray(body) ? body : [];
  const bullets: string[] = rawBullets.map((item: any) => typeof item === "string" ? item : String(item));
  const kt = content?.key_takeaway || "";
  const table = content?.data_table;
  const hasTable = table?.headers?.length > 0;

  // Track which bullets have been assigned
  let bulletIdx = 0;

  // Sort shapes by vertical position for consistent rendering
  const sortedShapes = shapes
    .map((s: any, i: number) => ({ ...s, _idx: i }))
    .sort((a: any, b: any) => (a.position?.top_inches || 0) - (b.position?.top_inches || 0));

  // Find the largest content area for table rendering
  let largestContentShape: any = null;
  let largestArea = 0;
  for (const s of sortedShapes) {
    const slot = slots.find((sl: any) => sl.shape_index === s._idx);
    if (slot?.slot_type === "item" || (!slot && s.position?.width_inches > 3 && s.position?.height_inches > 2)) {
      const area = (s.position?.width_inches || 0) * (s.position?.height_inches || 0);
      if (area > largestArea) {
        largestArea = area;
        largestContentShape = s;
      }
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Render each shape */}
      {sortedShapes.map((shape: any) => {
        const pos = shape.position || {};
        if (!pos.left_inches && pos.left_inches !== 0) return null;

        const style: React.CSSProperties = {
          position: "absolute",
          left: `${(pos.left_inches / SLIDE_W) * 100}%`,
          top: `${(pos.top_inches / SLIDE_H) * 100}%`,
          width: `${(pos.width_inches / SLIDE_W) * 100}%`,
          height: `${(pos.height_inches / SLIDE_H) * 100}%`,
          overflow: "hidden",
        };

        const slot = slots.find((sl: any) => sl.shape_index === shape._idx);

        // Title slot → render slide title
        if (slot?.slot_type === "title") {
          const fs = Math.min(Math.max((shape.font_size_pt || 20) * 0.8, 10), 22);
          return (
            <div key={shape._idx} style={style} className={`flex items-start ${isRTL ? "justify-end" : ""}`}>
              <p style={{ color: primary, fontSize: `${fs}px`, fontWeight: 700, lineHeight: 1.2 }} className={`line-clamp-3 ${isRTL ? "text-right w-full" : ""}`}>
                {title}
              </p>
            </div>
          );
        }

        // Subtitle slot → render key takeaway
        if (slot?.slot_type === "subtitle") {
          const fs = Math.min(Math.max((shape.font_size_pt || 14) * 0.7, 8), 14);
          return (
            <div key={shape._idx} style={style} className={`flex items-start ${isRTL ? "justify-end" : ""}`}>
              <p style={{ color: accent, fontSize: `${fs}px`, fontWeight: 500, lineHeight: 1.3 }} className={`line-clamp-2 ${isRTL ? "text-right w-full" : ""}`}>
                {renderMd(kt || (bullets[0] || ""))}
              </p>
            </div>
          );
        }

        // Item slot → render a bullet point OR table if this is the largest area
        if (slot?.slot_type === "item") {
          // If this shape IS the largest content shape and we have a table, render table here
          if (hasTable && shape._idx === largestContentShape?._idx) {
            const headers = table.headers as string[];
            const rows = (table.rows || []).slice(0, 8) as any[][];
            const manyColumns = headers.length > 5;
            const cellPad = manyColumns ? "px-1 py-0.5" : "px-1.5 py-1";
            const fontSize = manyColumns ? "text-[7px]" : "text-[8px]";
            return (
              <div key={shape._idx} style={style} className="overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {headers.map((h: string, hi: number) => (
                        <th key={hi} className={`${cellPad} ${fontSize} font-semibold text-white uppercase tracking-wide ${isRTL ? "text-right" : "text-start"}`} style={{ background: primary }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: any[], ri: number) => (
                      <tr key={ri} className={ri % 2 === 1 ? "bg-gray-50/60" : ""}>
                        {row.map((cell: any, ci: number) => {
                          const val = String(cell ?? "");
                          const sc = getStatusColor(val);
                          return (
                            <td key={ci} className={`${cellPad} ${fontSize} border-b border-gray-100 ${ci === 0 ? "font-medium text-gray-900" : "text-gray-600"} ${isRTL ? "text-right" : "text-left"}`}>
                              {sc ? (
                                <span className={`inline-flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                                  <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: sc }} />
                                  <span>{val}</span>
                                </span>
                              ) : val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // Otherwise render a bullet point
          const text = bullets[bulletIdx] || "";
          bulletIdx++;
          if (!text) return null;
          const fs = Math.min(Math.max((shape.font_size_pt || 12) * 0.7, 8), 13);
          return (
            <div key={shape._idx} style={style} className={`flex items-start gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
              <span className="mt-[4px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: accent }} />
              <span style={{ fontSize: `${fs}px`, lineHeight: 1.4, color: "#374151" }} className={`line-clamp-3 ${isRTL ? "text-right" : "text-left"}`}>{renderMd(text)}</span>
            </div>
          );
        }

        // Label slot → render small text
        if (slot?.slot_type === "label") {
          return (
            <div key={shape._idx} style={style}>
              <span className="text-[7px] text-gray-400">{shape.text || ""}</span>
            </div>
          );
        }

        // Decorative shape with fill → render as colored rectangle using brand colors
        if (shape.fill_color && !slot) {
          // Use primary for header-like bars (top of slide), accent for accent lines
          const isTopBar = (pos.top_inches || 0) < 1 && (pos.height_inches || 0) < 1;
          const isBottomBar = (pos.top_inches || 0) > 6;
          const bgColor = isTopBar || isBottomBar ? primary : accent;
          return (
            <div key={shape._idx} style={{ ...style, backgroundColor: bgColor, opacity: 0.9, borderRadius: "1px" }} />
          );
        }

        return null;
      })}

      {/* Fallback: if we have a table but no shape rendered it, show in default position */}
      {hasTable && !largestContentShape && (
        <div className="absolute overflow-hidden" style={{ left: "6%", top: "28%", width: "88%", height: "55%" }} dir={isRTL ? "rtl" : "ltr"}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {(table.headers as string[]).map((h: string, i: number) => (
                  <th key={i} className={`px-1.5 py-1 text-[8px] font-semibold text-white uppercase tracking-wide ${isRTL ? "text-right" : "text-start"}`} style={{ background: primary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {((table.rows || []).slice(0, 8) as any[][]).map((row: any[], ri: number) => (
                <tr key={ri} className={ri % 2 === 1 ? "bg-gray-50/60" : ""}>
                  {row.map((cell: any, ci: number) => {
                    const val = String(cell ?? "");
                    const sc = getStatusColor(val);
                    return (
                      <td key={ci} className={`px-1.5 py-1 text-[8px] border-b border-gray-100 ${ci === 0 ? "font-medium text-gray-900" : "text-gray-600"} ${isRTL ? "text-right" : "text-left"}`}>
                        {sc ? (
                          <span className={`inline-flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: sc }} />
                            {val}
                          </span>
                        ) : val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Key takeaway bar at bottom if not already rendered via subtitle slot */}
      {kt && subtitleSlots.length === 0 && (
        <div className="absolute rounded" style={{ left: "5%", bottom: "8%", width: "90%", padding: "1.5% 2%", background: `${primary}08`, borderLeft: `3px solid ${accent}` }}>
          <p className="text-[8px] font-semibold leading-snug" style={{ color: primary }}>{kt}</p>
        </div>
      )}
    </div>
  );
}


export function SlideRenderer({
  content, layout, designJson, className = "",
  primary = "#00338D", accent = "#0091DA", slideNumber, language,
  onGenerateChart, onSwitchLayout, generatingChart,
}: Props) {
  const isFullBg = layout === "title_slide" || layout === "section_divider";
  const isRTL = isRTLLanguage(language);

  // If design_json has template_design (applied via the apply endpoint), use the dynamic renderer
  const hasTemplateDesign = designJson?.template_design?.shapes?.length > 0;
  const LayoutComponent = hasTemplateDesign && !isFullBg
    ? TemplateDesignRenderer
    : resolveLayout(layout, content);

  return (
    <div
      className={`aspect-[16/9] overflow-hidden rounded-lg bg-white relative ${fontClass(isRTL)} ${className}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <LayoutComponent
        content={content} primary={primary} accent={accent}
        config={designJson || {}} isRTL={isRTL}
        onGenerateChart={onGenerateChart} onSwitchLayout={onSwitchLayout}
        generating={generatingChart}
      />
      <div className="absolute bottom-0 left-0 right-0 h-[3%]" style={{ background: isFullBg ? "rgba(255,255,255,0.15)" : primary }} />
      {slideNumber != null && (
        <span className={`absolute ${slideNumberPos(isRTL)} text-[9px] font-medium`} style={{ color: isFullBg ? "rgba(255,255,255,0.7)" : "white" }}>
          {slideNumber}
        </span>
      )}
    </div>
  );
}
