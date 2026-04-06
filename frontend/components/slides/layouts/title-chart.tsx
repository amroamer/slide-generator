"use client";

import { textAlign, borderSide, fontClass } from "@/lib/rtl-utils";
import { ErrorBoundary } from "react-error-boundary";
import { ChartRenderer, normalizeChartData } from "../chart-renderer";

interface Props {
  content: any; primary: string; accent: string; config: any; isRTL?: boolean;
  onGenerateChart?: () => void; onSwitchLayout?: (layout: string) => void; generating?: boolean;
}

function ChartErrorFallback() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded border border-dashed border-red-200 bg-red-50/20">
      <p className="text-[10px] font-medium text-red-400">Chart rendering error</p>
    </div>
  );
}

export function TitleChart({ content, primary, accent, isRTL = false, onGenerateChart, onSwitchLayout, generating }: Props) {
  const title = content?.title || "";
  const kt = content?.key_takeaway;
  const normalized = normalizeChartData(content?.chart_data);

  return (
    <div className={`flex h-full flex-col overflow-hidden p-[6%] pb-[8%] ${fontClass(isRTL)}`}>
      <div className="h-[3px] w-full shrink-0" style={{ background: primary }} />
      <h2 className={`mt-2 shrink-0 text-[16px] font-bold leading-snug line-clamp-2 ${textAlign(isRTL)}`} style={{ color: primary }}>{title}</h2>

      {/* Chart area — charts stay LTR universally */}
      <div className="mt-2 flex-1 min-h-0" dir="ltr">
        {normalized ? (
          <ErrorBoundary FallbackComponent={ChartErrorFallback}>
            <ChartRenderer chartData={content.chart_data} colors={[primary, accent, "#483698", "#00A3A1", "#C6007E", "#FF6D00"]} height="100%" />
          </ErrorBoundary>
        ) : (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50/40">
            <div className="text-center">
              <svg className="mx-auto mb-1 h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-[10px] font-medium text-gray-500">No chart data</p>
              {(onGenerateChart || onSwitchLayout) && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {onGenerateChart && (
                    <button onClick={(e) => { e.stopPropagation(); onGenerateChart(); }} disabled={generating}
                      className="rounded px-2 py-0.5 text-[8px] font-medium text-white disabled:opacity-50" style={{ background: primary }}>
                      {generating ? "Generating..." : "Generate Chart"}
                    </button>
                  )}
                  {onSwitchLayout && (
                    <button onClick={(e) => { e.stopPropagation(); onSwitchLayout("title_bullets"); }}
                      className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[8px] font-medium text-gray-500">Bullets</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {kt && (
        <div className={`mt-1.5 shrink-0 rounded bg-gray-50/60 py-1 text-[8px] font-semibold leading-snug ${borderSide(isRTL)} ${textAlign(isRTL)}`} style={{ borderColor: accent, color: primary }}>
          <span className="line-clamp-1">{kt}</span>
        </div>
      )}
    </div>
  );
}
