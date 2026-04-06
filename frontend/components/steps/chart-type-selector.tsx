"use client";

import { normalizeChartData } from "@/components/slides/chart-renderer";

const CHART_TYPES = [
  { id: "bar", label: "Bar", icon: "\u2581\u2583\u2585\u2587" },
  { id: "horizontal_bar", label: "H-Bar", icon: "\u2500\u2501\u2500" },
  { id: "line", label: "Line", icon: "\u279F" },
  { id: "pie", label: "Pie", icon: "\u25D4" },
  { id: "donut", label: "Donut", icon: "\u25CE" },
  { id: "area", label: "Area", icon: "\u25E2" },
];

const TIME_PATTERNS = [
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /^(q[1-4])\b/i,
  /^\d{4}$/,                       // "2024"
  /^\d{1,2}[\/-]\d{1,2}/,         // "01/24", "1-2025"
  /^(fy|h[12]|20\d{2})/i,         // "FY24", "H1", "2024"
  /\d{4}[\/-]\d{2}/,              // "2024-01"
  /^(week|wk|w)\s?\d/i,           // "Week 1"
  /^(mon|tue|wed|thu|fri|sat|sun)/i,
  /^(spring|summer|fall|autumn|winter)/i,
];

const COMPARISON_PATTERNS = [
  /\bvs\.?\b/i, /\bversus\b/i, /\bactual\b/i, /\btarget\b/i,
  /\bbudget\b/i, /\bforecast\b/i, /\bplan(ned)?\b/i, /\bbefore\b/i,
  /\bafter\b/i, /\bcurrent\b/i, /\bprevious\b/i, /\byoy\b/i,
];

function isTimeSeries(labels: string[]): boolean {
  if (labels.length < 3) return false;
  let matches = 0;
  for (const l of labels) {
    if (TIME_PATTERNS.some((p) => p.test(l.trim()))) matches++;
  }
  return matches >= labels.length * 0.6;
}

function isSorted(values: number[]): boolean {
  if (values.length < 3) return false;
  let asc = true, desc = true;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) asc = false;
    if (values[i] > values[i - 1]) desc = false;
  }
  return asc || desc;
}

function hasComparisonLabels(labels: string[], datasetLabels: string[]): boolean {
  const all = [...labels, ...datasetLabels].join(" ");
  return COMPARISON_PATTERNS.some((p) => p.test(all));
}

function isPartToWhole(values: number[]): boolean {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return false;
  // Likely percentages summing to ~100, or all positive values
  return (Math.abs(sum - 100) < 5) || values.every((v) => v >= 0);
}

/** Analyze chart data shape and recommend the best chart type. */
function recommendChartType(chartData: any): string | null {
  const n = normalizeChartData(chartData);
  if (!n) return null;

  const { labels, datasets } = n;
  const catCount = labels.length;
  const seriesCount = datasets.length;
  const values = datasets[0]?.values || [];
  const dsLabels = datasets.map((d) => d.label);

  // Time series → Line
  if (isTimeSeries(labels)) {
    return "line";
  }

  // 2-3 categories with one metric → Pie/Donut
  if (catCount <= 3 && seriesCount === 1 && values.every((v) => v >= 0)) {
    return catCount === 2 ? "pie" : "donut";
  }

  // Actual vs Target / Before vs After style → grouped bar
  if (seriesCount === 2 && hasComparisonLabels(labels, dsLabels)) {
    return "bar";
  }

  // Multiple series, part-to-whole → stacked bar (rendered as bar since ChartRenderer falls back)
  if (seriesCount >= 2 && catCount >= 3) {
    return "bar";
  }

  // Sorted values → ranking → Horizontal Bar
  if (seriesCount === 1 && catCount >= 4 && isSorted(values)) {
    return "horizontal_bar";
  }

  // Many categories, one series, part-to-whole with percentages → Pie
  if (seriesCount === 1 && catCount >= 4 && catCount <= 8 && isPartToWhole(values)) {
    return "pie";
  }

  // Distribution / continuous feel → Area
  if (seriesCount === 1 && catCount >= 6) {
    return "area";
  }

  // Default → Bar
  return "bar";
}

interface Props {
  selected: string;
  onChange: (chartType: string) => void;
  chartData?: any;
}

export function ChartTypeSelector({ selected, onChange, chartData }: Props) {
  const recommended = chartData ? recommendChartType(chartData) : null;

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto py-1">
        {CHART_TYPES.map((ct) => (
          <button
            key={ct.id}
            onClick={() => onChange(ct.id)}
            className={`relative flex shrink-0 flex-col items-center rounded-lg border-2 px-3 py-2 transition-all duration-200 ${
              selected === ct.id
                ? "border-[#00338D] bg-[#00338D]/5 text-[#00338D]"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
            style={{ minWidth: "62px" }}
          >
            {recommended === ct.id && selected !== ct.id && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-px text-[8px] font-semibold text-amber-700 flex items-center gap-0.5">
                <svg className="h-2 w-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.09 6.26L21 9.27l-5.18 4.73L17.82 21 12 17.27 6.18 21l1.09-6.73L2 9.27l6.91-1.01L12 2z" /></svg>
                AI Pick
              </span>
            )}
            <span className="text-lg leading-none">{ct.icon}</span>
            <span className="mt-1 text-[10px] font-medium">{ct.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
