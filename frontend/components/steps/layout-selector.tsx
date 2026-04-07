"use client";

import { useLanguage } from "@/lib/language-context";

const ALL_LAYOUTS = [
  { id: "title_slide", label: "Title", icon: "T" },
  { id: "title_bullets", label: "Bullets", icon: "\u2261" },
  { id: "title_table", label: "Table", icon: "\u2637" },
  { id: "title_chart", label: "Chart", icon: "\u2581\u2583\u2585\u2587" },
  { id: "two_column", label: "2-Col", icon: "\u2225" },
  { id: "section_divider", label: "Divider", icon: "\u2500" },
  { id: "key_takeaway", label: "Takeaway", icon: "\u2605" },
];

/** Given slide content, return the layout IDs that are relevant and which one is recommended. */
function getRelevantLayouts(content: any): { allowed: Set<string>; recommended: string | null } {
  if (!content) return { allowed: new Set(ALL_LAYOUTS.map((l) => l.id)), recommended: null };

  const slideType = (content.slide_type || "").toLowerCase();
  const chartData = content.chart_data;
  const hasChart = !!(chartData && typeof chartData === "object" && chartData.labels && chartData.datasets);
  const tableData = content.data_table;
  const hasTable = !!(tableData && typeof tableData === "object" && tableData.headers && tableData.rows);

  // Section divider
  if (slideType === "section_divider") {
    return { allowed: new Set(["section_divider"]), recommended: "section_divider" };
  }

  // Title / cover
  if (slideType === "title") {
    return { allowed: new Set(["title_slide"]), recommended: "title_slide" };
  }

  // Chart data present
  if (hasChart) {
    return {
      allowed: new Set(["title_chart", "two_column", "key_takeaway", "title_bullets"]),
      recommended: "title_chart",
    };
  }

  // Table data present
  if (hasTable) {
    return {
      allowed: new Set(["title_table", "two_column", "title_bullets"]),
      recommended: "title_table",
    };
  }

  // Summary slide type
  if (slideType === "summary") {
    return {
      allowed: new Set(["key_takeaway", "title_bullets", "title_slide"]),
      recommended: "key_takeaway",
    };
  }

  // Comparison slide type
  if (slideType === "comparison") {
    return {
      allowed: new Set(["two_column", "title_bullets", "title_table"]),
      recommended: "two_column",
    };
  }

  // Default: text/bullets content
  return {
    allowed: new Set(["title_bullets", "title_slide", "two_column", "key_takeaway"]),
    recommended: "title_bullets",
  };
}

interface Props {
  selected: string;
  onChange: (layout: string) => void;
  content?: any;
}

export function LayoutSelector({ selected, onChange, content }: Props) {
  const { t, isRTL } = useLanguage();
  const { allowed, recommended } = getRelevantLayouts(content);
  const layouts = ALL_LAYOUTS.filter((l) => allowed.has(l.id));

  return (
    <div className="flex gap-1.5 overflow-x-auto py-1">
      {layouts.map((l) => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          className={`relative flex shrink-0 flex-col items-center rounded-lg border-2 px-3 py-2 transition-all duration-200 ${
            selected === l.id
              ? "border-[#00338D] bg-[#00338D]/5 text-[#00338D]"
              : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
          style={{ minWidth: "70px" }}
        >
          {recommended === l.id && selected !== l.id && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-px text-[8px] font-semibold text-emerald-700">
              {t("recommended")}
            </span>
          )}
          <span className="text-lg leading-none">{l.icon}</span>
          <span className="mt-1 text-[10px] font-medium">{l.label}</span>
        </button>
      ))}
    </div>
  );
}
