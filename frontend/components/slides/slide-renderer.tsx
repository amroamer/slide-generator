"use client";

import { isRTLLanguage, slideNumberPos, fontClass } from "@/lib/rtl-utils";
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

export function SlideRenderer({
  content, layout, designJson, className = "",
  primary = "#00338D", accent = "#0091DA", slideNumber, language,
  onGenerateChart, onSwitchLayout, generatingChart,
}: Props) {
  const LayoutComponent = resolveLayout(layout, content);
  const isFullBg = layout === "title_slide" || layout === "section_divider";
  const isRTL = isRTLLanguage(language);

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
      {/* Footer bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3%]" style={{ background: isFullBg ? "rgba(255,255,255,0.15)" : primary }} />
      {slideNumber != null && (
        <span className={`absolute ${slideNumberPos(isRTL)} text-[9px] font-medium`} style={{ color: isFullBg ? "rgba(255,255,255,0.7)" : "white" }}>
          {slideNumber}
        </span>
      )}
    </div>
  );
}
