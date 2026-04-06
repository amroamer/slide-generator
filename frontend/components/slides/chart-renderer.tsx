"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Label,
} from "recharts";

const DEFAULT_COLORS = [
  "#00338D", "#0091DA", "#483698", "#00A3A1",
  "#C6007E", "#FF6D00", "#009A44", "#6D2077",
];

// ── Semantic color detection ─────────────────────────────────────────────────

const SEMANTIC_MAP: Record<string, string> = {
  green: "#10B981", "on track": "#10B981", "on-track": "#10B981",
  met: "#10B981", healthy: "#10B981", completed: "#10B981",
  pass: "#10B981", yes: "#10B981", positive: "#10B981", good: "#10B981",
  amber: "#F59E0B", yellow: "#F59E0B", warning: "#F59E0B",
  attention: "#F59E0B", "at risk": "#F59E0B", "at-risk": "#F59E0B",
  caution: "#F59E0B", "in progress": "#F59E0B", partial: "#F59E0B",
  medium: "#F59E0B", moderate: "#F59E0B",
  red: "#EF4444", critical: "#EF4444", fail: "#EF4444",
  failed: "#EF4444", "not met": "#EF4444", "off track": "#EF4444",
  "off-track": "#EF4444", overdue: "#EF4444", no: "#EF4444",
  blocked: "#EF4444", negative: "#EF4444", high: "#EF4444", bad: "#EF4444",
  neutral: "#6B7280", low: "#10B981",
};

function detectSemanticColors(labels: string[]): Record<string, string> | null {
  if (!labels?.length) return null;
  const colorMap: Record<string, string> = {};
  let matchCount = 0;
  for (const label of labels) {
    const norm = (label || "").toLowerCase().replace(/[^a-z\s-]/g, "").trim();
    for (const [key, color] of Object.entries(SEMANTIC_MAP)) {
      if (norm.includes(key)) { colorMap[label] = color; matchCount++; break; }
    }
  }
  return matchCount > labels.length * 0.5 ? colorMap : null;
}

function getColor(label: string, index: number, semantic: Record<string, string> | null, brand: string[]): string {
  if (semantic?.[label]) return semantic[label];
  return brand[index % brand.length] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

// ── Normalizer — handles every LLM format variant ────────────────────────────

interface NormalizedDataset { label: string; values: number[] }
interface NormalizedChart { chart_type: string; labels: string[]; datasets: NormalizedDataset[] }

function toNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function normalizeChartData(raw: any): NormalizedChart | null {
  if (!raw || typeof raw !== "object") return null;

  // Unwrap nested wrappers: {chart_data: {...}}, {chart: {...}}
  let data = raw;
  if (data.chart_data && typeof data.chart_data === "object") data = data.chart_data;
  else if (data.chart && typeof data.chart === "object") data = data.chart;

  const chart_type = String(data.chart_type || data.chartType || data.type || "bar")
    .toLowerCase().replace(/\s+/g, "_");

  // Labels: accept "labels", "categories", or a CSV string
  let labels: string[] = [];
  const rawLabels = data.labels || data.categories;
  if (Array.isArray(rawLabels)) labels = rawLabels.map((l: any) => String(l ?? ""));
  else if (typeof rawLabels === "string") labels = rawLabels.split(",").map((s: string) => s.trim());

  // Datasets: accept "datasets", "series", or flat {values: [...]}
  let datasets: NormalizedDataset[] = [];
  const rawDs = data.datasets || data.series;

  if (Array.isArray(rawDs)) {
    for (let i = 0; i < rawDs.length; i++) {
      const ds = rawDs[i];
      if (!ds || typeof ds !== "object") continue;
      const label = String(ds.label || ds.name || ds.series || `Series ${i + 1}`);
      const rawVals = ds.values || ds.data || ds.points;
      if (!Array.isArray(rawVals) || rawVals.length === 0) continue;
      datasets.push({ label, values: rawVals.map(toNumber) });
    }
  } else if (Array.isArray(data.values)) {
    datasets.push({
      label: String(data.label || data.name || "Value"),
      values: data.values.map(toNumber),
    });
  }

  if (datasets.length === 0 || labels.length === 0) return null;

  // Pad/truncate to match lengths
  const maxLen = Math.max(labels.length, ...datasets.map((d) => d.values.length));
  while (labels.length < maxLen) labels.push("");
  datasets = datasets.map((ds) => ({
    ...ds,
    values: ds.values.concat(Array(Math.max(0, maxLen - ds.values.length)).fill(0)).slice(0, maxLen),
  }));
  labels = labels.slice(0, maxLen);

  return { chart_type, labels, datasets };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRows(labels: string[], datasets: NormalizedDataset[]) {
  return labels.map((label, i) => {
    const row: Record<string, any> = { name: label };
    for (const ds of datasets) row[ds.label] = ds.values[i] ?? 0;
    return row;
  });
}

const tooltipStyle = {
  contentStyle: {
    background: "#fff", border: "1px solid #E5E7EB", borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "9px", padding: "4px 8px",
  },
};
const axisStyle = { fontSize: 8, fill: "#9CA3AF" };
const legendStyle = { fontSize: 8, iconType: "circle" as const, iconSize: 7 };

function ChartFallback({ message }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50">
      <p className="text-[0.7em] text-gray-400">{message || "No chart data"}</p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props { chartData: any; colors?: string[]; height?: number | string }

export function ChartRenderer({ chartData, colors = DEFAULT_COLORS, height = "100%" }: Props) {
  // NORMALIZE FIRST — this handles all LLM format variations
  const n = normalizeChartData(chartData);
  if (!n) return <ChartFallback />;

  const { chart_type, labels, datasets } = n;
  if (!labels.length || !datasets.length) return <ChartFallback />;

  const rows = buildRows(labels, datasets);
  const needsAngle = labels.length > 6;
  const semanticColors = detectSemanticColors(labels);
  const showLegend = datasets.length > 1;

  // ── Bar (vertical) ──
  if (chart_type === "bar" || chart_type === "vertical_bar" || chart_type === "column") {
    if (datasets.length === 1 && semanticColors) {
      const dataWithColor = rows.map((row, i) => ({ ...row, fill: getColor(labels[i] || "", i, semanticColors, colors) }));
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={dataWithColor} margin={{ top: 5, right: 8, left: 0, bottom: needsAngle ? 30 : 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={axisStyle} angle={needsAngle ? -35 : 0} textAnchor={needsAngle ? "end" : "middle"} />
            <YAxis tick={axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey={datasets[0].label} radius={[4, 4, 0, 0]} maxBarSize={32}>
              {dataWithColor.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 5, right: 8, left: 0, bottom: needsAngle ? 30 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={axisStyle} angle={needsAngle ? -35 : 0} textAnchor={needsAngle ? "end" : "middle"} />
          <YAxis tick={axisStyle} />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={legendStyle} />}
          {datasets.map((ds, i) => (
            <Bar key={ds.label} dataKey={ds.label} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={32} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Horizontal bar ──
  if (chart_type === "horizontal_bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 8, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={axisStyle} />
          <YAxis type="category" dataKey="name" tick={axisStyle} width={80} />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={legendStyle} />}
          {datasets.map((ds, i) => (
            <Bar key={ds.label} dataKey={ds.label} fill={colors[i % colors.length]} radius={[0, 4, 4, 0]} maxBarSize={24}>
              {semanticColors && datasets.length === 1 && labels.map((l, li) => <Cell key={li} fill={getColor(l, li, semanticColors, colors)} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Line ──
  if (chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 5, right: 8, left: 0, bottom: needsAngle ? 30 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={axisStyle} angle={needsAngle ? -35 : 0} textAnchor={needsAngle ? "end" : "middle"} />
          <YAxis tick={axisStyle} />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={legendStyle} />}
          {datasets.map((ds, i) => (
            <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Area ──
  if (chart_type === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 5, right: 8, left: 0, bottom: needsAngle ? 30 : 5 }}>
          <defs>
            {datasets.map((ds, i) => (
              <linearGradient key={ds.label} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={axisStyle} angle={needsAngle ? -35 : 0} textAnchor={needsAngle ? "end" : "middle"} />
          <YAxis tick={axisStyle} />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={legendStyle} />}
          {datasets.map((ds, i) => (
            <Area key={ds.label} type="monotone" dataKey={ds.label} stroke={colors[i % colors.length]} strokeWidth={2} fill={`url(#grad-${i})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── Pie / Donut ──
  if (chart_type === "pie" || chart_type === "donut" || chart_type === "doughnut") {
    if (!datasets[0]) return <ChartFallback />;
    const pieData = labels.map((label, i) => ({ name: label, value: datasets[0].values[i] ?? 0 }));
    if (!pieData.length) return <ChartFallback />;
    const isDonut = chart_type === "donut" || chart_type === "doughnut";
    const total = pieData.reduce((s, d) => s + d.value, 0);

    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={pieData} cx="50%" cy="50%"
            innerRadius={isDonut ? "45%" : 0} outerRadius="75%"
            paddingAngle={2} dataKey="value"
            label={({ name, percent }) => `${(name || "").slice(0, 12)} ${((percent || 0) * 100).toFixed(0)}%`}
            fontSize={8}
            labelLine={{ strokeWidth: 1 }}
          >
            {pieData.map((entry, i) => <Cell key={i} fill={getColor(entry.name, i, semanticColors, colors)} />)}
            {isDonut && <Label value={`${total}`} position="center" style={{ fontSize: "1.5em", fontWeight: 700, fill: "#374151" }} />}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={legendStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // ── Fallback: bar ──
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="name" tick={axisStyle} />
        <YAxis tick={axisStyle} />
        <Tooltip {...tooltipStyle} />
        {datasets.map((ds, i) => (
          <Bar key={ds.label} dataKey={ds.label} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
